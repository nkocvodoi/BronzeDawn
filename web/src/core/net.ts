// Playing online, in lockstep. Every machine runs the whole simulation; what travels is the players'
// commands. The simulation is deterministic (integer random numbers, no trigonometry, a fixed step), so
// the same commands on the same turns give the same world everywhere.
//
// Time goes in turns of TURN_TICKS steps. The host decides what happens on each turn: a command it gets,
// its own or a guest's, is put DELAY turns ahead of where the host is, and once the host reaches a turn
// it sends the turn's commands to every guest, then plays it. A guest plays a turn only when it has the
// host's word for it, so it can never run ahead. The host waits when a guest falls too far behind.
// Every so often each machine sends a fingerprint of its world for the same turn: if one differs, the
// game has come apart and everyone is told.
import { Command, isCommand, runCommand } from "./commands";
import type { World } from "./world";

export const TURN_TICKS = 4;
/** How many turns ahead a command is put: its time to reach every guest before it is played. */
export const DELAY = 3;
/** How far a guest may fall behind before the host waits for it. */
export const MAX_LAG = 12;
/** A fingerprint of the world goes with every this many turns. */
export const CHECK_EVERY = 25;

/** One end of a connection: send a message, hear one. */
export interface Link { send(msg: unknown): void; onMessage(handler: (msg: unknown) => void): void }

/** A turn's commands: who gave each, in the order the host settled on. */
export interface Turn { n: number; cmds: [number, Command][] }

/** A cheap fingerprint of the world: the random generator and every unit's place and health, folded. */
export function fingerprint(w: World): number {
  let h = 2166136261 >>> 0;
  const mix = (v: number) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
  const r = w.rng as unknown as { s0: number; s1: number; s2: number; s3: number };
  mix(r.s0); mix(r.s1); mix(r.s2); mix(r.s3); mix(w.tick);
  for (const u of w.units) { mix(u.id); mix(Math.round(u.pos.x * 1000)); mix(Math.round(u.pos.y * 1000)); mix(Math.round(u.hp * 100)); }
  for (const b of w.buildings) { mix(b.id); mix(Math.round(b.hp * 100)); mix(b.queue.length); }
  for (const p of w.players) for (const v of p.res.values) mix(Math.round(v * 100));
  return h;
}

abstract class Lockstep {
  /** The next turn to play, or the one being played. */
  turn = 0;
  /** Steps of the current turn already played; 0 means its commands have not run yet. */
  protected tickInTurn = 0;
  /** Set when the worlds no longer agree, with the turn it was found at. */
  desync: number | null = null;
  /** Called with each command run, and what it said (for the interface's feedback). */
  onCommand: ((player: number, c: Command, result: unknown) => void) | null = null;
  protected checks = new Map<number, number>();

  constructor(readonly world: World, readonly me: number) {}

  /** A turn's commands, run before its first step. */
  protected runTurn(t: Turn) {
    for (const [player, c] of t.cmds) {
      const result = runCommand(this.world, player, c);
      this.onCommand?.(player, c, result);
    }
  }

  /** The turn to start now, if it may start: the host settles it, a guest must have it from the host. */
  protected abstract begin(): Turn | null;
  /** A turn has been played to its end. */
  protected abstract finished(): void;

  /** Plays one step, if the game may go on; false when it must wait (for the host, or for a guest). The
   *  interface calls this as often as its clock says, so units move smoothly within a turn. */
  stepTick(): boolean {
    if (this.tickInTurn === 0) {
      const t = this.begin();
      if (!t) return false;
      this.runTurn(t);
    }
    this.world.step();
    if (++this.tickInTurn === TURN_TICKS) {
      this.tickInTurn = 0;
      this.turn++;
      if (this.turn % CHECK_EVERY === 0) this.checks.set(this.turn, fingerprint(this.world));
      this.finished();
    }
    return true;
  }

  /** Plays up to `maxTurns` whole turns, as far as allowed; returns how many it finished. */
  advance(maxTurns: number) {
    const from = this.turn;
    while (this.turn - from < maxTurns && this.stepTick()) { /* step on */ }
    return this.turn - from;
  }

  /** A command of this player's, to be played on every machine. */
  abstract issue(c: Command): void;
  /** Messages that are not the game's own: the interface's (speed, chat, the start). */
  onOther: ((msg: unknown, from: number) => void) | null = null;
}

/** The host: settles each turn and sends it to the guests. */
export class LockstepHost extends Lockstep {
  private pending = new Map<number, [number, Command][]>();
  /** The last turn each guest has played, by player. */
  private acked = new Map<number, number>();
  private links = new Map<number, Link>();

  constructor(world: World, me: number) { super(world, me); }

  /** A guest playing as `player`, reached through `link`. Whatever arrives from it is that player's. */
  addGuest(player: number, link: Link) {
    this.links.set(player, link);
    this.acked.set(player, -1);
    link.onMessage((m) => this.hear(player, m));
  }

  private schedule(player: number, c: Command) {
    const at = this.turn + DELAY;
    const list = this.pending.get(at) ?? [];
    list.push([player, c]);
    this.pending.set(at, list);
  }

  private hear(player: number, m: unknown) {
    const msg = m as { t?: string; c?: unknown; n?: number; h?: number; at?: number };
    if (msg.t === "cmd" && isCommand(msg.c)) this.schedule(player, msg.c);
    else if (msg.t === "ack" && typeof msg.n === "number") {
      this.acked.set(player, Math.max(this.acked.get(player) ?? -1, msg.n));
      if (typeof msg.h === "number" && typeof msg.at === "number") this.compare(msg.at, msg.h);
    } else this.onOther?.(m, player);
  }

  private compare(turn: number, h: number) {
    const mine = this.checks.get(turn);
    if (mine === undefined || mine === h || this.desync !== null) return;
    this.desync = turn;
    for (const l of this.links.values()) l.send({ t: "desync", n: turn });
  }

  issue(c: Command) { this.schedule(this.me, c); }

  /** How far the slowest guest is behind. */
  get lag() {
    let slowest = this.turn - 1;
    for (const a of this.acked.values()) slowest = Math.min(slowest, a);
    return this.turn - 1 - slowest;
  }

  /** Paused by the host: the turn being played is finished, and no new one starts. */
  paused = false;

  protected begin(): Turn | null {
    if (this.paused || this.lag >= MAX_LAG) return null;
    const t: Turn = { n: this.turn, cmds: this.pending.get(this.turn) ?? [] };
    this.pending.delete(this.turn);
    for (const l of this.links.values()) l.send({ t: "turn", turn: t });
    return t;
  }

  protected finished() {
    // Old fingerprints are no longer needed once every guest has gone past them.
    for (const n of this.checks.keys()) if (n < this.turn - MAX_LAG - CHECK_EVERY * 2) this.checks.delete(n);
  }

  /** A guest has gone: the game no longer waits for it. Its people stay where they are. */
  dropGuest(player: number) {
    this.links.delete(player);
    this.acked.delete(player);
  }

  /** Sends something of the interface's to every guest. */
  broadcast(msg: unknown) { for (const l of this.links.values()) l.send(msg); }
}

/** A guest: plays the turns the host sends, and sends its own commands to the host. */
export class LockstepGuest extends Lockstep {
  private turns = new Map<number, Turn>();
  /** Told by the host that the worlds came apart. */
  onDesync: ((turn: number) => void) | null = null;

  constructor(world: World, me: number, private host: Link) {
    super(world, me);
    host.onMessage((m) => this.hear(m));
  }

  private hear(m: unknown) {
    const msg = m as { t?: string; turn?: Turn; n?: number };
    if (msg.t === "turn" && msg.turn && typeof msg.turn.n === "number") {
      const t = msg.turn;
      if (Array.isArray(t.cmds) && t.cmds.every(([p, c]) => typeof p === "number" && isCommand(c))) this.turns.set(t.n, t);
    } else if (msg.t === "desync" && typeof msg.n === "number") {
      this.desync = msg.n;
      this.onDesync?.(msg.n);
    } else this.onOther?.(m, 0);
  }

  issue(c: Command) { this.host.send({ t: "cmd", c }); }

  /** Turns that have arrived and wait to be played. */
  get buffered() { return this.turns.size; }

  protected begin(): Turn | null {
    const t = this.turns.get(this.turn);
    if (!t) return null;
    this.turns.delete(this.turn);
    return t;
  }

  protected finished() {
    // The turn played; with the fingerprint of the world it leaves, every CHECK_EVERY turns, for the host
    // to compare with its own for the same turn.
    const h = this.checks.get(this.turn);
    this.host.send(h === undefined ? { t: "ack", n: this.turn - 1 } : { t: "ack", n: this.turn - 1, h, at: this.turn });
    this.checks.delete(this.turn);
  }
}
