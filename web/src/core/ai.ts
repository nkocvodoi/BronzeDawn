import { Building, Player, Unit } from "./entities";
import { Footprint, Tile, Vec2 } from "./geom";
import { walkable } from "./grid";
import { isRanged, RES_ALL, Res, ResBag, Rules, UnitDef } from "./rules";
import type { World } from "./world";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export const LEVEL = {
  easy: { firstAttack: 900, firstWave: 6, villagerTarget: 18, producers: 1, counters: false, gather: 1 },
  normal: { firstAttack: 660, firstWave: 8, villagerTarget: 24, producers: 2, counters: true, gather: 1 },
  // Hard plays like normal with a bigger army and an open economic bonus, as many classic RTS AIs do.
  hard: { firstAttack: 600, firstWave: 10, villagerTarget: 26, producers: 3, counters: true, gather: 1.2 },
};

/** Equal-spend strength of a against b (Lanchester square law), the same formula as balance.py. */
export function strength(a: UnitDef, b: UnitDef, rules: Rules) {
  const armor = isRanged(a) ? b.pierce_armor : b.armor;
  const dmg = Math.max(rules.minDamage, a.attack - armor) + (a.bonus?.[b.class] ?? 0);
  const cost = Math.max(1, ResBag.of(a.cost).total);
  return (dmg / a.attack_cooldown) * a.hp / (cost * cost);
}

const dist = (a: Unit, p: Vec2) => a.pos.distance(p);
function minBy<T>(xs: T[], f: (x: T) => number): T | null {
  let best: T | null = null, bv = Infinity;
  for (const x of xs) { const v = f(x); if (v < bv) { bv = v; best = x; } }
  return best;
}

/**
 * The computer opponent. It plays by the same rules and through the same commands
 * as the player. It knows where the enemy base is, but not what is in it.
 */
export class AIController {
  private waveSize: number;
  waves = 0;
  private thinks = 0;
  private level: (typeof LEVEL)[Difficulty];

  constructor(readonly player: number, readonly difficulty: Difficulty = "normal") {
    this.level = LEVEL[difficulty];
    this.waveSize = this.level.firstWave;
  }

  /** Called once when the AI joins a world: applies its open economic bonus. */
  attach(w: World) {
    w.players[this.player].gatherBonus = this.level.gather;
  }

  /** The plan, once a second. */
  think(w: World) {
    const p = w.players[this.player];
    if (p.defeated) return;
    this.thinks++;
    if (this.difficulty === "easy" && this.thinks % 2 === 0) return;

    const mine = w.unitsOf(this.player);
    const villagers = mine.filter((u) => u.isVillager);
    const army = mine.filter((u) => !u.isVillager);
    const bs = w.buildingsOf(this.player);
    const tc = bs.find((b) => b.def.id === "town_center");
    if (!tc) {
      this.rebuildTownCenter(w, villagers);
      if (army.length) this.attackNearest(w, army);
      return;
    }
    const home = tc.center;
    this.defend(w, army, villagers, bs);
    this.economy(w, tc, villagers, bs);
    this.military(w, army, bs, villagers.length);
    this.attack(w, home, army);
  }

  private count(bs: Building[], type: string) { return bs.filter((b) => b.def.id === type).length; }

  private economy(w: World, tc: Building, villagers: Unit[], bs: Building[]) {
    const p = w.players[this.player];
    const home = tc.center;
    const queued = bs.reduce((s, b) => s + b.queue.length, 0);

    // Advance as soon as we can.
    if (tc.complete && tc.researching === null && w.blockerForNextAge(this.player) === null) {
      w.advanceAge(this.player, tc.id);
    }

    // Villagers, but save 500 food for the next age once there are enough.
    const ageBlock = w.blockerForNextAge(this.player);
    const saving = p.age === 0 && villagers.length >= 14 && (ageBlock === null || ageBlock === "Not enough resources");
    if (tc.complete && tc.researching === null && tc.queue.length < 2 &&
        villagers.length + tc.queue.length < this.level.villagerTarget && !saving && p.res.food >= 50) {
      w.train(this.player, tc.id, "villager");
    }

    // Houses before we are capped.
    const houseBuilding = bs.some((b) => b.def.id === "house" && !b.complete);
    const room = p.popCap - p.pop - queued;
    if (p.popCap < w.rules.economy.pop_max && room <= 3 && !houseBuilding && p.res.wood >= 30) {
      this.placeNear(w, "house", home, 3, 12, villagers);
    }

    // Drop sites next to the resources.
    if (this.count(bs, "storage_pit") === 0 && villagers.length >= 5 && p.res.wood >= 120) {
      const spot = w.nearestNode(Res.wood, home, 22)?.center ?? home;
      this.placeNear(w, "storage_pit", spot, 1, 6, villagers, false);
    }
    if (this.count(bs, "granary") === 0 && villagers.length >= 7 && p.res.wood >= 120) {
      const spot = w.nearestNode(Res.food, home, 14)?.center ?? home;
      this.placeNear(w, "granary", spot, 1, 6, villagers, false);
    }
    if (this.count(bs, "barracks") === 0 && villagers.length >= 9 && p.res.wood >= 125) {
      this.placeNear(w, "barracks", home, 5, 14, villagers);
    }
    if (p.age >= 1) {
      if (this.count(bs, "archery_range") === 0 && p.res.wood >= 150) {
        this.placeNear(w, "archery_range", home, 5, 15, villagers);
      } else if (this.count(bs, "stable") === 0 && p.res.wood >= 150) {
        this.placeNear(w, "stable", home, 5, 15, villagers);
      } else if (this.count(bs, "watch_tower") < 2 && p.res.stone >= 150) {
        const enemy = this.enemyHome(w) ?? home;
        this.placeNear(w, "watch_tower", home.lerp(enemy, 0.15), 1, 6, villagers);
      }
    }

    // Farms when the berries near home are gone.
    const foodNear = w.nearestNode(Res.food, home, 16) !== null;
    const farms = bs.filter((b) => b.isFarm);
    // One farmer per farm: as many farms as food workers wanted, less those still on berries.
    const foodWorkers = Math.ceil(this.shares(p)[Res.food] * villagers.length);
    const wantFarms = Math.max(0, foodWorkers - (foodNear ? 4 : 0));
    const building = farms.filter((f) => !f.complete).length;
    if (farms.length < wantFarms && building < 2 && p.res.wood >= 75 && w.blockerBuilding("farm", this.player) === null) {
      const granary = bs.find((b) => b.def.id === "granary" && b.complete)?.center ?? home;
      this.placeNear(w, "farm", granary, 2, 9, villagers, false);
    }

    this.assignIdle(w, home, villagers, farms);
    this.finishAbandoned(w, villagers, bs);
    if (this.thinks % 8 === 0) this.rebalance(w, villagers, home);
  }

  /** How to split the villagers. A big stockpile of something pulls workers off it. */
  shares(p: Player): number[] {
    let want: number[];
    if (p.age === 0) want = p.pop >= 14 ? [0.7, 0.3, 0, 0] : [0.55, 0.45, 0, 0];
    else want = [0.5, 0.3, 0.14, 0.06];
    for (const r of RES_ALL) {
      const stock = p.res.get(r);
      if (stock > 600) want[r] *= 0.15; else if (stock > 300) want[r] *= 0.5;
    }
    if (p.res.stone >= 150) want[Res.stone] = 0;
    const sum = want.reduce((a, b) => a + b, 0);
    return want.map((v) => v / Math.max(sum, 0.0001));
  }

  /** Every so often move one worker from the most over-staffed resource to the most under-staffed. */
  private rebalance(w: World, villagers: Unit[], home: Vec2) {
    const want = this.shares(w.players[this.player]);
    const on: Unit[][] = [[], [], [], []];
    for (const u of villagers) if (u.order.kind === "gather" && u.lastGather !== null && u.carry < 1) on[u.lastGather].push(u);
    const total = villagers.length;
    const gap = (r: Res) => want[r] * total - on[r].length;
    let need = Res.food, spare = Res.food;
    for (const r of RES_ALL) { if (gap(r) > gap(need)) need = r; if (gap(r) < gap(spare)) spare = r; }
    if (gap(need) < 1.5 || gap(spare) > -1.5 || !on[spare].length) return;
    const u = on[spare][0];
    const farm = need === Res.food
      ? w.buildingsOf(this.player).find((b) => b.isFarm && b.complete && !villagers.some((v) => v.order.kind === "gather" && v.order.id === b.id))
      : undefined;
    if (farm) w.gather(this.player, [u.id], farm.id);
    else { const n = w.nearestNode(need, home, 30); if (n) w.gather(this.player, [u.id], n.id); }
  }

  /** A building nobody is working on gets the nearest villager. */
  private finishAbandoned(w: World, villagers: Unit[], bs: Building[]) {
    for (const b of bs) {
      if (b.complete) continue;
      const working = villagers.some((v) => v.order.kind === "build" && v.order.id === b.id);
      const v = working ? null : this.pickBuilder(villagers, b.center);
      if (v) w.build(this.player, [v.id], b.id);
    }
  }

  private assignIdle(w: World, home: Vec2, villagers: Unit[], farms: Building[]) {
    const idle = villagers.filter((u) => u.order.kind === "idle");
    if (!idle.length) return;
    const working = [0, 0, 0, 0];
    const farmed = new Set<number>();
    for (const u of villagers) {
      if (u.order.kind === "gather") {
        if (u.lastGather !== null) working[u.lastGather]++;
        if (w.building(u.order.id)) farmed.add(u.order.id);
      } else if (u.order.kind === "return" && u.carryRes !== null) working[u.carryRes]++;
    }
    const want = this.shares(w.players[this.player]);
    const total = villagers.length;
    for (const u of idle) {
      let pick = Res.food;
      for (const r of RES_ALL) if (want[r] * total - working[r] > want[pick] * total - working[pick]) pick = r;
      let target: number | null = null;
      if (pick === Res.food) {
        const f = farms.find((b) => b.complete && !farmed.has(b.id));
        if (f) { target = f.id; farmed.add(f.id); }
      }
      if (target === null) target = w.nearestNode(pick, home, 30)?.id ?? null;
      if (target === null) target = w.nearestNode(Res.wood, u.pos, 40)?.id ?? null;
      if (target !== null) { w.gather(this.player, [u.id], target); working[pick]++; }
    }
  }

  // ---- army

  private military(w: World, army: Unit[], bs: Building[], villagers: number) {
    const p = w.players[this.player];
    if (villagers < 10 && !army.length && w.time <= 360) return;
    // Before the next age, keep 500 food for it.
    const reserve = p.age === 0 ? 520 : 60;
    const enemyArmy = w.units.filter((u) => u.alive && w.isEnemy(this.player, u.owner) && !u.isVillager);
    const producing = bs.filter((b) => b.complete && b.def.id !== "town_center" && b.queue.length > 0).length;
    let slots = this.level.producers - producing;
    for (const b of bs) {
      if (!b.complete || !(b.def.trains ?? []).length || b.def.id === "town_center" || b.queue.length >= 2) continue;
      if (!b.queue.length) { if (slots <= 0) continue; slots--; }
      const options = (b.def.trains ?? []).filter((t) => w.blockerUnit(t, this.player) === null);
      if (!options.length) continue;
      let pick: string;
      if (this.level.counters) {
        pick = options[0];
        for (const o of options) if (this.score(w, o, enemyArmy) > this.score(w, pick, enemyArmy)) pick = o;
      } else pick = options[Math.floor(this.thinks / 7) % options.length];
      const cost = w.rules.unitCost(pick);
      if (p.res.food - cost.food >= reserve || p.age > 0) w.train(this.player, b.id, pick);
    }
  }

  /** How well a unit type fares against what the enemy has. No logarithms, so it is exact everywhere. */
  private score(w: World, type: string, enemies: Unit[]) {
    const me = w.rules.units.get(type);
    if (!me) return 0;
    if (!enemies.length) return ResBag.of(me.cost).total + (isRanged(me) ? 15 : 0);
    let s = 0;
    for (const e of enemies) {
      const r = Math.max(0.01, strength(me, e.def, w.rules) / Math.max(0.0001, strength(e.def, me, w.rules)));
      s += r >= 1 ? r - 1 : 1 - 1 / r;
    }
    return s;
  }

  private defend(w: World, army: Unit[], villagers: Unit[], bs: Building[]) {
    const threats = w.units.filter((e) => e.alive && w.isEnemy(this.player, e.owner) && bs.some((b) => b.distance(e.pos) < 10));
    if (!threats.length) return;
    for (const u of army) {
      if (u.order.kind === "attack") continue;
      const t = minBy(threats, (t) => dist(t, u.pos))!;
      if (dist(t, u.pos) < 30) w.attack(this.player, [u.id], t.id);
    }
    // Outnumbered at home: villagers next to the fight join in.
    const soldiers = threats.filter((t) => !t.isVillager).length;
    if (soldiers > army.length) {
      for (const v of villagers) {
        const t = minBy(threats, (t) => dist(t, v.pos));
        if (t && dist(t, v.pos) < 5) w.attack(this.player, [v.id], t.id);
      }
    }
  }

  private attack(w: World, home: Vec2, army: Unit[]) {
    const idle = army.filter((u) => u.order.kind === "idle");
    // Units that already took a base apart keep going to the next building.
    const away = idle.filter((u) => dist(u, home) > 18);
    if (away.length) this.attackNearest(w, away);

    if (w.time < this.level.firstAttack) return;
    const ready = idle.filter((u) => dist(u, home) <= 18);
    const p = w.players[this.player];
    const maxed = p.pop >= p.popCap - 2 && ready.length >= 6;
    const theirArmy = w.units.filter((u) => u.alive && w.isEnemy(this.player, u.owner) && !u.isVillager).length;
    const weak = ready.length >= 6 && theirArmy * 2 <= ready.length;
    const target = this.enemyHome(w);
    if (!(ready.length >= this.waveSize || maxed || weak) || !target) return;
    w.move(this.player, ready.map((u) => u.id), target, true);
    this.waves++;
    this.waveSize = Math.min(this.waveSize + 2, 14);
  }

  private attackNearest(w: World, group: Unit[]) {
    const c = group[0]?.pos;
    if (!c) return;
    const t = minBy(w.buildings.filter((b) => b.alive && w.isEnemy(this.player, b.owner)), (b) => b.distance(c));
    if (t) { w.move(this.player, group.map((u) => u.id), t.center, true); return; }
    const u = w.units.find((u) => u.alive && w.isEnemy(this.player, u.owner));
    if (u) w.move(this.player, group.map((g) => g.id), u.pos, true);
  }

  private enemyHome(w: World): Vec2 | null {
    const e = w.players.find((p) => w.isEnemy(this.player, p.id) && !p.defeated);
    if (!e) return null;
    const tc = w.buildings.find((b) => b.alive && b.owner === e.id && b.def.id === "town_center");
    if (tc) return tc.center;
    return w.buildings.find((b) => b.alive && b.owner === e.id)?.center ?? w.startTiles[e.id].center;
  }

  private rebuildTownCenter(w: World, villagers: Unit[]) {
    const v = villagers[0];
    if (!v || w.blockerBuilding("town_center", this.player) !== null) return;
    this.placeNear(w, "town_center", v.pos, 2, 12, villagers);
  }

  // ---- placement

  private placeNear(w: World, type: string, near: Vec2, minR: number, maxR: number, villagers: Unit[], margin = true) {
    if (w.blockerBuilding(type, this.player) !== null) return;
    const builder = this.pickBuilder(villagers, near);
    if (!builder) return;
    const spot = this.findSpot(w, type, near, minR, maxR, margin);
    if (spot) w.place(this.player, type, spot, [builder.id]);
  }

  private pickBuilder(villagers: Unit[], near: Vec2): Unit | null {
    const free = villagers.filter((u) => u.order.kind !== "build" && u.carry < 5);
    return free.find((u) => u.order.kind === "idle") ?? minBy(free, (u) => dist(u, near));
  }

  findSpot(w: World, type: string, near: Vec2, minR: number, maxR: number, margin: boolean): Tile | null {
    const size = w.rules.buildings.get(type)?.size;
    if (!size) return null;
    const c = near.tile;
    const half = Math.floor(size / 2);
    for (let r = minR; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const origin = new Tile(c.x + dx - half, c.y + dy - half);
          if (w.canPlace(type, origin, this.player) && this.hasGap(w, origin, size, margin)) return origin;
        }
      }
    }
    return null;
  }

  /** Keeps a one-tile lane around new buildings so the base never walls itself in. */
  private hasGap(w: World, origin: Tile, size: number, checkNodes: boolean) {
    const fp = new Footprint(origin, size);
    for (let y = origin.y - 1; y <= origin.y + size; y++) {
      for (let x = origin.x - 1; x <= origin.x + size; x++) {
        const t = new Tile(x, y);
        if (fp.contains(t)) continue;
        if (!w.map.inside(t) || !walkable(w.map.terrainAt(t))) return false;
        const id = w.map.occupantAt(t);
        if (id === 0) continue;
        if (w.building(id) || checkNodes) return false;
      }
    }
    return true;
  }
}
