// Playing online, in lockstep. Every machine runs the whole simulation; what travels is the players'
// commands. The simulation is deterministic (integer random numbers, no trigonometry, a fixed step), so
// the same commands on the same turns give the same world everywhere.
//
// Time goes in turns of TURN_TICKS steps. Each player settles their own commands: an order given now is
// for a turn `delay` turns ahead, and as each turn begins, every player sends the others their commands
// for the turn that far ahead (an empty list, often). A machine plays a turn once it has every player's
// list for it. So every player waits the same short delay, the host as much as a friend, as in the
// original game. (It used to wait only for the host's word: a friend felt a whole round trip, the host
// nothing.) The delay is the slowest connection's one-way time and a little more, measured as the game
// goes; the interface hides it by answering every order at once.
// The friends are linked to the host only: the host passes each friend's lists on to the others. Every so
// often each machine sends a fingerprint of its world for the same turn: if one differs, the game has come
// apart and everyone is told.
import { Command, isCommand, runCommand } from "./commands";
import type { World } from "./world";

/** Two steps, a tenth of a second: the finest a command's timing can be. */
export const TURN_TICKS = 2;
/** The delay a game starts with, in turns, before the connections are measured. The turns before it
 *  have no commands, on every machine. */
export const START_DELAY = 3;
/** The delay is kept within these, in turns. */
export const MIN_DELAY = 2;
export const MAX_DELAY = 12;
/** A fingerprint of the world goes with every this many turns. */
export const CHECK_EVERY = 25;
/** How often the host measures each connection, in milliseconds. */
const PING_EVERY = 1000;
/** Kept in hand against a connection's unevenness, in milliseconds. */
const JITTER = 40;
/** The most commands a player may put in one turn. */
const MAX_CMDS = 64;

/** One end of a connection: send a message, hear one. */
export interface Link { send(msg: unknown): void; onMessage(handler: (msg: unknown) => void): void }

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

/** The delay, in turns, for friends whose one-way times are `oneWay` (milliseconds), with turns of
 *  `turnMs`. A friend's list reaches another friend through the host: two one-way trips. Commands sealed
 *  as turn T begins are played at T + delay - 1, so they have delay - 1 turns to arrive. */
export function delayFor(oneWay: number[], turnMs: number) {
  const s = [...oneWay].sort((a, b) => b - a);
  const worst = (s[0] ?? 0) + (s[1] ?? 0);
  return Math.max(MIN_DELAY, Math.min(MAX_DELAY, Math.ceil((worst + JITTER) / turnMs) + 1));
}

const isCmdList = (x: unknown): x is Command[] => Array.isArray(x) && x.length <= MAX_CMDS && x.every(isCommand);

abstract class Lockstep {
  /** The next turn to play, or the one being played. */
  turn = 0;
  /** Steps of the current turn already played; 0 means its commands have not run yet. */
  protected tickInTurn = 0;
  /** Set when the worlds no longer agree, with the turn it was found at. */
  desync: number | null = null;
  /** Called with each command run, and what it said (for the interface's feedback). */
  onCommand: ((player: number, c: Command, result: unknown) => void) | null = null;
  /** Messages that are not the game's own: the interface's (speed, chat, the start). */
  onOther: ((msg: unknown, from: number) => void) | null = null;
  /** How many turns ahead this player's orders are for. */
  delay = START_DELAY;
  protected checks = new Map<number, number>();
  /** Every player's commands, by turn and player, as they arrive (empty lists are not kept). */
  private inputs = new Map<number, Map<number, Command[]>>();
  /** The last turn each player's commands are known for. */
  protected last = new Map<number, number>();
  /** Players who have left, with the last turn of theirs to wait for. */
  protected gone = new Map<number, number>();
  /** This player's orders, not yet sealed into a turn. */
  private queue: Command[] = [];

  /** `humans`: the players at a keyboard (the computers' orders are part of the simulation). */
  constructor(readonly world: World, readonly me: number, humans: number[]) {
    for (const p of new Set([me, ...humans])) this.last.set(p, START_DELAY - 1);
  }

  /** A command of this player's, to be played on every machine: on the next turn not yet sealed. */
  issue(c: Command) { this.queue.push(c); }

  /** The turn this player's next order will be played on. */
  get nextOrderTurn() { return this.last.get(this.me)! + 1; }

  /** Sends a sealed turn of this player's commands to the others. */
  protected abstract sendInput(n: number, cmds: Command[]): void;
  /** Whether this player seals new turns (not while the host has paused). */
  protected sealing() { return true; }
  /** Called as a turn is about to begin. */
  protected beginning() { /* nothing by default */ }
  /** A turn has been played to its end. */
  protected abstract finished(): void;

  /** A player's commands for turn n. They come in order, one list per turn; anything else is refused. */
  protected input(player: number, n: number, cmds: Command[]) {
    const last = this.last.get(player);
    if (last === undefined || n !== last + 1 || this.gone.has(player)) return false;
    this.last.set(player, n);
    if (cmds.length) {
      const t = this.inputs.get(n) ?? new Map<number, Command[]>();
      t.set(player, cmds);
      this.inputs.set(n, t);
    }
    return true;
  }

  /** Whether every player's commands for turn n are here. */
  protected ready(n: number) {
    for (const [p, l] of this.last) if (l < n && !(this.gone.has(p) && n > this.gone.get(p)!)) return false;
    return true;
  }

  /** Turns this machine could play now, beyond the current one. */
  get ahead() {
    let n = 0;
    while (n < 1000 && this.ready(this.turn + n)) n++;
    return Math.max(0, n - 1);
  }

  /** Turns this machine has fallen behind the others, to catch up by playing faster. In step, the others'
   *  lists reach at most delay - 1 turns past the current one. */
  get behind() { return Math.max(0, this.ahead - this.delay); }

  /** Seals this player's orders as a turn begins: every turn up to `delay` ahead gets its list. */
  private seal() {
    const to = this.turn + this.delay - 1;
    for (let n = this.last.get(this.me)! + 1; n <= to; n++) {
      const cmds = this.queue.splice(0, MAX_CMDS);
      this.input(this.me, n, cmds);
      this.sendInput(n, cmds);
    }
  }

  /** Plays one step, if the game may go on; false when it must wait for the others' commands (or for the
   *  host's, when paused). The interface calls this as often as its clock says, so units move smoothly. */
  stepTick(): boolean {
    if (this.tickInTurn === 0) {
      this.beginning();
      if (this.sealing()) this.seal();
      if (!this.ready(this.turn)) return false;
      const t = this.inputs.get(this.turn);
      this.inputs.delete(this.turn);
      // In player order, the same on every machine.
      if (t) for (const p of [...t.keys()].sort((a, b) => a - b)) {
        for (const c of t.get(p)!) {
          const result = runCommand(this.world, p, c); // not inside the call below: `?.` would skip it with no one listening
          this.onCommand?.(p, c, result);
        }
      }
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
}

/** The host: passes the friends' commands on, measures the connections and sets the delay. */
export class LockstepHost extends Lockstep {
  private links = new Map<number, Link>();
  /** Each friend's last few round trips, measured, in milliseconds. */
  private trips = new Map<number, number[]>();
  private lastPing = -Infinity;
  /** How long a turn takes on the clock (a faster game shortens it), in milliseconds. */
  turnMs = 100;
  /** Paused by the host: no new turns are sealed, so every machine plays to the last one sealed and stops
   *  there, all at the same turn. */
  paused = false;
  /** Times in a row a lower delay was measured: the delay goes down only when it stays down. */
  private lower = 0;

  constructor(world: World, me: number, private clock: () => number = () => performance.now()) { super(world, me, [me]); }

  /** A friend playing as `player`, reached through `link`. Whatever arrives from it is that player's. */
  addGuest(player: number, link: Link) {
    this.links.set(player, link);
    this.last.set(player, START_DELAY - 1);
    link.onMessage((m) => this.hear(player, m));
  }

  private hear(player: number, m: unknown) {
    const msg = m as { t?: string; n?: unknown; cmds?: unknown; h?: unknown; at?: unknown; s?: unknown };
    if (msg.t === "in") {
      if (typeof msg.n !== "number" || !isCmdList(msg.cmds) || !this.links.has(player)) return;
      if (!this.input(player, msg.n, msg.cmds)) return;
      for (const [p, l] of this.links) if (p !== player) l.send({ t: "in", p: player, n: msg.n, cmds: msg.cmds });
    } else if (msg.t === "hash") {
      if (typeof msg.h === "number" && typeof msg.at === "number") this.compare(msg.at, msg.h);
    } else if (msg.t === "pong") {
      if (typeof msg.s !== "number" || !Number.isFinite(msg.s)) return;
      const trips = this.trips.get(player) ?? [];
      trips.push(Math.max(0, Math.min(10000, this.clock() - msg.s)));
      this.trips.set(player, trips.slice(-5));
    } else this.onOther?.(m, player);
  }

  /** Friends' fingerprints for turns this machine has not reached yet. */
  private early = new Map<number, number[]>();

  private compare(turn: number, h: number) {
    const mine = this.checks.get(turn);
    if (mine === undefined) {
      // A friend may be a little ahead: kept until this machine gets there.
      if (turn > this.turn && turn <= this.turn + 1000) this.early.set(turn, [...(this.early.get(turn) ?? []), h].slice(0, 16));
      return;
    }
    if (mine === h || this.desync !== null) return;
    this.desync = turn;
    this.broadcast({ t: "desync", n: turn });
  }

  protected sendInput(n: number, cmds: Command[]) { this.broadcast({ t: "in", p: this.me, n, cmds }); }

  protected sealing() { return !this.paused; }

  protected beginning() {
    const now = this.clock();
    if (now - this.lastPing >= PING_EVERY) {
      this.lastPing = now;
      this.broadcast({ t: "ping", s: now });
      this.retune();
    }
  }

  /** The delay, from the measured connections: up at once, down a turn at a time when it stays down. */
  private retune() {
    if (this.links.size && this.trips.size < this.links.size) return; // not all measured yet
    const want = this.links.size ? delayFor(this.oneWayTimes, this.turnMs) : MIN_DELAY;
    if (want > this.delay) { this.lower = 0; this.setDelay(want); }
    else if (want < this.delay) { if (++this.lower >= 2) { this.lower = 0; this.setDelay(this.delay - 1); } }
    else this.lower = 0;
  }

  /** Each friend's one-way time: half a round trip, the slowest of the last few but one (a single slow
   *  trip, as when a window was busy, is not counted). */
  get oneWayTimes() {
    return [...this.trips.values()].map((t) => { const s = [...t].sort((a, b) => b - a); return (s[Math.min(1, s.length - 1)] ?? 0) / 2; });
  }

  private setDelay(d: number) {
    this.delay = d;
    this.broadcast({ t: "delay", d });
  }

  protected finished() {
    const early = this.early.get(this.turn);
    if (early) { this.early.delete(this.turn); for (const h of early) this.compare(this.turn, h); }
    // Old fingerprints are no longer needed once every friend has gone past them.
    for (const n of this.checks.keys()) if (n < this.turn - CHECK_EVERY * 8) this.checks.delete(n);
  }

  /** A friend has gone: the game no longer waits for them. Their people stay where they are. */
  dropGuest(player: number) {
    if (!this.links.delete(player)) return;
    const after = this.last.get(player)!;
    this.gone.set(player, after);
    this.trips.delete(player);
    this.broadcast({ t: "gone", p: player, after });
  }

  /** Sends something to every friend. */
  broadcast(msg: unknown) { for (const l of this.links.values()) l.send(msg); }
}

/** A friend: sends its commands to the host, and hears everyone's from it. */
export class LockstepGuest extends Lockstep {
  /** Told by the host that the worlds came apart. */
  onDesync: ((turn: number) => void) | null = null;

  /** `humans`: every player at a keyboard, the host among them. */
  constructor(world: World, me: number, private host: Link, humans: number[]) {
    super(world, me, humans);
    host.onMessage((m) => this.hear(m));
  }

  private hear(m: unknown) {
    const msg = m as { t?: string; p?: unknown; n?: unknown; cmds?: unknown; d?: unknown; after?: unknown; s?: unknown };
    if (msg.t === "in") {
      if (typeof msg.p === "number" && msg.p !== this.me && typeof msg.n === "number" && isCmdList(msg.cmds)) this.input(msg.p, msg.n, msg.cmds);
    } else if (msg.t === "ping") this.host.send({ t: "pong", s: msg.s });
    else if (msg.t === "delay") {
      if (typeof msg.d === "number" && msg.d >= MIN_DELAY && msg.d <= MAX_DELAY) this.delay = Math.round(msg.d);
    } else if (msg.t === "gone") {
      if (typeof msg.p === "number" && typeof msg.after === "number" && this.last.has(msg.p)) this.gone.set(msg.p, msg.after);
    } else if (msg.t === "desync" && typeof msg.n === "number") {
      this.desync = msg.n;
      this.onDesync?.(msg.n);
    } else this.onOther?.(m, 0);
  }

  protected sendInput(n: number, cmds: Command[]) { this.host.send({ t: "in", n, cmds }); }

  protected finished() {
    // Every CHECK_EVERY turns, the fingerprint of the world this turn leaves, for the host to compare.
    const h = this.checks.get(this.turn);
    if (h !== undefined) this.host.send({ t: "hash", h, at: this.turn });
    this.checks.delete(this.turn);
  }
}
