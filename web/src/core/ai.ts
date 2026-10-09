import { Building, Player, Unit } from "./entities";
import { Footprint, Tile, Vec2 } from "./geom";
import { walkable } from "./grid";
import { RES_ALL, Res, ResBag, Rules, UnitDef } from "./rules";
import type { World } from "./world";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export const LEVEL = {
  // Easy is passive, as the original's easiest AI was: a small economy, late small attacks, no Iron Age.
  easy: { firstAttack: 1200, firstWave: 5, villagers: [12, 16, 18, 18], producers: 1, counters: false, gather: 1, maxAge: 2, guard: [1, 3, 4, 4] },
  normal: { firstAttack: 720, firstWave: 8, villagers: [20, 26, 30, 32], producers: 2, counters: true, gather: 1, maxAge: 3, guard: [3, 6, 9, 12] },
  // Hard plays like normal with a bigger army and an open economic bonus, as the original's hardest AI did.
  hard: { firstAttack: 900, firstWave: 12, villagers: [22, 28, 32, 34], producers: 3, counters: true, gather: 1.2, maxAge: 3, guard: [4, 8, 10, 12] },
};

/** Buildings the AI puts up in each age, in order: what the next age needs, then the army. */
const PLAN: string[][] = [
  ["granary", "storage_pit", "barracks"],
  ["market", "archery_range", "stable"],
  ["government_center", "temple", "siege_workshop", "academy"],
  [],
];

/** Technologies worth having, in order of how much they help. */
const TECHS = [
  "woodworking", "gold_mining", "domestication", "toolworking", "leather_armor_infantry", "battle_axe", "wheel", "fishing_ship_tech",
  "artisanship", "plow", "stone_mining", "metalworking", "bronze_shield", "short_sword", "broad_sword", "improved_bow",
  "composite_bow", "scale_armor_infantry", "leather_armor_archers", "leather_armor_cavalry", "architecture", "nobility",
  "astrology", "mysticism", "craftsmanship", "irrigation", "coinage", "metallurgy", "long_sword", "iron_shield",
  "chain_armor_infantry", "scale_armor_cavalry", "heavy_cavalry_tech", "catapult_tech", "phalanx_tech", "alchemy",
  "engineering", "ballistics", "aristocracy", "fanaticism", "centurion_tech", "legion_tech", "cataphract_tech",
];

/** Equal-spend strength of a against b (Lanchester square law), the same formula as balance.py. */
export function strength(a: UnitDef, b: UnitDef, rules: Rules) {
  const pierce = a.damage ? a.damage === "pierce" : a.range > 0;
  const armor = pierce ? b.pierce_armor : b.armor;
  const dmg = Math.max(rules.minDamage, Math.max(0, a.attack - armor) + (a.bonus?.[b.class] ?? 0));
  const cost = Math.max(1, ResBag.of(a.cost).total);
  return (dmg / a.attack_cooldown) * a.hp / (cost * cost);
}

const dist = (a: Unit, p: Vec2) => a.pos.distance(p);
/** How far from home villagers are sent for gold and stone once the mines nearby are spent. */
const FAR = 50;
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
  /** A wave gathering at a point on the way, so it arrives together rather than one by one. */
  private staging: { at: Vec2; target: Vec2; ids: number[]; since: number } | null = null;
  waves = 0;
  /** Units sent in an attack wave, who press on once they are in the enemy's land. */
  private sent = new Set<number>();
  private thinks = 0;
  /** The soldier sent to take a Ruin or an Artifact, while it is on its way. */
  private relicRunner: number | null = null;
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
    // The army on land, and the war ships apart: they go where the water goes.
    const army = mine.filter((u) => u.isSoldier && !u.isBoat && u.aboard === null);
    const navy = mine.filter((u) => u.isSoldier && u.isBoat);
    const priests = mine.filter((u) => u.isPriest && u.aboard === null);
    const bs = w.buildingsOf(this.player);
    const tc = bs.find((b) => b.def.id === "town_center");
    if (!tc) {
      this.rebuildTownCenter(w, villagers);
      if (army.length) this.attackNearest(w, army);
      return;
    }
    const home = tc.center;
    this.defend(w, army, villagers, bs);
    // The Dock first: on a map with a sea it feeds the town, counts for the Tool Age, and on islands is the way out.
    this.fishing(w, tc, villagers, bs);
    this.economy(w, tc, villagers, bs);
    this.repair(w, villagers, bs);
    this.research(w, bs, army);
    this.military(w, army, bs, villagers.length);
    this.navy(w, home, navy, bs);
    this.attack(w, home, army, priests);
    this.relics(w, home, army);
  }

  // ---- Ruins and Artifacts

  /** One soldier at a time goes to take a Ruin or an Artifact it knows of, near enough and on its own
   *  land. When an enemy holds all of either kind, the army at home goes to take one back. */
  private relics(w: World, home: Vec2, army: Unit[]) {
    const relics = w.units.filter((u) => u.alive && u.isRelic && u.aboard === null && !w.allied(this.player, u.owner));
    if (!relics.length) return;
    const known = relics.filter((r) => w.fog[this.player].isExplored(r.pos.tile) && this.byLand(w, home, r.pos));
    const threat = (["ruins", "artifact"] as const).map((k) => w.relicHold[k]).find((h) => h && w.isEnemy(this.player, h.player));
    if (threat && w.victory.kind === "standard") {
      const t = minBy(known.filter((r) => r.owner >= 0), (r) => r.pos.distance(home));
      const ready = army.filter((u) => u.order.kind === "idle" && dist(u, home) <= 18);
      if (t && ready.length >= 3) {
        w.move(this.player, ready.map((u) => u.id), t.pos, true);
        for (const u of ready) this.sent.add(u.id);
        return;
      }
    }
    const runner = this.relicRunner !== null ? w.unit(this.relicRunner) : null;
    if (runner && runner.order.kind === "move") return;
    this.relicRunner = null;
    if (this.thinks % 10 !== 0) return;
    const free = army.filter((u) => u.order.kind === "idle" && dist(u, home) <= 18 && !u.standGround);
    if (free.length < 3) return; // the town keeps its guard
    const t = minBy(known.filter((r) => r.pos.distance(home) < 45), (r) => r.pos.distance(home));
    if (!t) return;
    const go = minBy(free, (u) => -w.stats(u).speed)!;
    w.move(this.player, [go.id], t.pos, true);
    this.relicRunner = go.id;
  }

  // ---- at sea

  /** On a map with a sea: a few war ships from the Tool Age, more than the enemy has. They keep enemy
   *  boats off our fishing grounds, and once there are four go for the enemy's Docks and boats. */
  private navy(w: World, home: Vec2, navy: Unit[], bs: Building[]) {
    const p = w.players[this.player];
    const dock = bs.find((b) => b.def.on_water && b.complete);
    if (!dock || p.age < 1 || !w.nodes.some((n) => n.def.boats_only)) return;
    const enemyShips = w.units.filter((u) => u.alive && u.isBoat && u.isSoldier && !u.isRelic && w.isEnemy(this.player, u.owner)).length;
    // A small fleet: one more than the enemy shows, within a cap by age, and never more than a fifth of
    // the population, so a race of ships does not starve the army that has to finish the game.
    const want = Math.min([0, 2, 3, 4][Math.min(p.age, 3)], enemyShips + 1, Math.floor(p.popCap / 5));
    if (navy.length < Math.max(want, Math.min(2, [0, 2, 3, 4][Math.min(p.age, 3)])) && dock.queue.length === 0
      && p.pop + 1 <= p.popCap - (this.needsFerry ? 1 : 0)) {
      const cat = w.current(this.player, "catapult_trireme");
      const cats = navy.filter((u) => u.def.tags?.includes("catapult_ship")).length;
      const pick = cats * 3 < navy.length && w.blockerUnit(cat, this.player) === null ? cat : w.current(this.player, "scout_ship");
      if (w.blockerUnit(pick, this.player) === null && this.affordable(w, w.unitCost(this.player, pick))) w.train(this.player, dock.id, pick);
    }
    const idle = navy.filter((u) => u.order.kind === "idle");
    if (!idle.length) return;
    const enemy = (u: Unit) => u.alive && u.isBoat && !u.isRelic && w.isEnemy(this.player, u.owner);
    const near = minBy(w.units.filter((u) => enemy(u) && u.pos.distance(dock.center) < 22), (u) => u.pos.distance(dock.center));
    if (near) { w.attack(this.player, idle.map((u) => u.id), near.id); return; }
    if (navy.length < 4) return;
    const docks = w.buildings.filter((b) => b.alive && b.def.on_water && w.isEnemy(this.player, b.owner));
    const prey: { center: Vec2 }[] = [...docks, ...w.units.filter(enemy).map((u) => ({ center: u.pos }))];
    const goal = minBy(prey, (x) => x.center.distance(home));
    if (goal) w.move(this.player, idle.map((u) => u.id), goal.center, true);
  }

  /** A wave on its way by sea: the transport, who is to go, and how far it has got. */
  private ferry: { transport: number; ids: number[]; target: Vec2; since: number; sailing: boolean } | null = null;
  /** Across the sea from the enemy, with no transport yet. */
  private needsFerry = false;

  /** Whether there is room to train one more on land, keeping two places for a transport when one is needed
   *  (counting what is already in the queues). */
  private ferryRoom(w: World, bs: Building[]) {
    if (!this.needsFerry) return true;
    const p = w.players[this.player];
    const queued = bs.reduce((n, b) => n + b.queue.filter((q) => q.kind === "unit").length, 0);
    return p.pop + queued + 3 <= p.popCap || p.popCap < w.popMax - 2;
  }
  private seaCheck: { key: number; across: boolean; at: number } | null = null;
  private land: { seen: Uint8Array; at: number } | null = null;

  /** Whether a point can be walked to from home (the walkable land is worked out now and then). */
  private byLand(w: World, home: Vec2, p: Vec2) {
    if (!this.land || this.thinks - this.land.at >= 60) {
      this.land = { seen: w.map.reachable(w.map.nearestPassable(home.tile, 4) ?? home.tile, (id) => w.building(id) !== null), at: this.thinks };
    }
    const to = w.map.nearestPassable(p.tile, 2) ?? p.tile;
    return this.land.seen[w.map.index(to)] === 1;
  }

  /** Whether the way to a target is over the water: no path by land from home (rechecked now and then). */
  private overSea(w: World, home: Vec2, target: Vec2) {
    const key = w.map.index(target.tile);
    if (this.seaCheck && this.seaCheck.key === key && this.thinks - this.seaCheck.at < 60) return this.seaCheck.across;
    const seen = w.map.reachable(w.map.nearestPassable(home.tile, 4) ?? home.tile, (id) => w.building(id) !== null);
    const to = w.map.nearestPassable(target.tile, 4) ?? target.tile;
    const across = !seen[w.map.index(to)];
    this.seaCheck = { key, across, at: this.thinks };
    return across;
  }

  /** A transport from the Dock, when the way to the enemy is over the sea and there is none. */
  private trainTransport(w: World) {
    const p = w.players[this.player];
    if (w.unitsOf(this.player).some((u) => u.isTransport)) return;
    const docks = w.buildingsOf(this.player).filter((b) => b.def.on_water && b.complete);
    if (!docks.length || docks.some((d) => d.queue.some((q) => q.kind === "unit" && w.rules.units.get(q.id)?.capacity))) return;
    // No room left for one: as a player would, give up one unit to make room (an idle soldier, else a villager).
    if (p.pop + 1 > p.popCap) {
      const mine = w.unitsOf(this.player).filter((u) => u.aboard === null);
      const spare = mine.find((u) => u.isSoldier && !u.isBoat && u.order.kind === "idle") ?? mine.find((u) => u.isVillager && u.order.kind !== "build");
      if (spare) w.destroy(this.player, spare.id);
    }
    const dock = docks.find((d) => d.queue.length === 0) ?? docks[0];
    const type = w.current(this.player, "light_transport");
    if (w.blockerUnit(type, this.player) === null && this.affordable(w, w.unitCost(this.player, type))) w.train(this.player, dock.id, type);
  }

  /** Starts a wave by sea: a transport (trained if there is none) takes as many as it carries. */
  private startFerry(w: World, home: Vec2, target: Vec2, ids: number[]): boolean {
    const transports = w.unitsOf(this.player).filter((u) => u.isTransport && !u.cargo.length && u.order.kind === "idle");
    this.needsFerry = !transports.length && !w.unitsOf(this.player).some((u) => u.isTransport);
    if (!transports.length) { this.trainTransport(w); return false; }
    const t = transports[0];
    const landing = w.landingNear(home);
    if (!landing) return false;
    const go = ids.slice(0, t.def.capacity ?? 5);
    w.move(this.player, [t.id], landing.center);
    w.board(this.player, go, t.id);
    this.ferry = { transport: t.id, ids: go, target, since: w.time, sailing: false };
    return true;
  }

  /** Loads, sails, lands, and lets the wave loose on the far shore. */
  private runFerry(w: World) {
    const f = this.ferry!;
    const t = w.unit(f.transport);
    const alive = f.ids.map((id) => w.unit(id)).filter((u): u is Unit => !!u);
    if (!t || !alive.length) { this.ferry = null; return; }
    if (!f.sailing) {
      const aboard = alive.filter((u) => u.aboard === t.id), ashore = alive.filter((u) => u.aboard === null);
      for (const u of ashore) if (u.order.kind === "idle") w.board(this.player, [u.id], t.id);
      if (aboard.length && (!ashore.length || w.time - f.since > 60)) { w.unload(this.player, [t.id], f.target); f.sailing = true; }
      return;
    }
    if (t.cargo.length) {
      if (t.unloadAt === null && t.order.kind === "idle") w.unload(this.player, [t.id], f.target); // put in again
      return;
    }
    const landed = alive.filter((u) => u.aboard === null);
    w.move(this.player, landed.map((u) => u.id), f.target, true);
    for (const u of landed) this.sent.add(u.id);
    this.ferry = null;
  }

  private count(bs: Building[], type: string) { return bs.filter((b) => b.def.id === type).length; }

  /** Food and gold held back for the next age once its buildings stand, so other spending does not eat it. */
  private reserve(w: World): ResBag {
    const p = w.players[this.player];
    if (p.age >= this.level.maxAge) return new ResBag();
    const next = w.rules.ages[p.age + 1];
    if (!next || w.ageRequirementCount(this.player) < (next.requires_buildings ?? 0)) return new ResBag();
    return ResBag.of(next.cost);
  }

  private affordable(w: World, cost: ResBag) {
    const have = w.players[this.player].res, keep = this.reserve(w);
    return RES_ALL.every((r) => have.get(r) - keep.get(r) >= cost.get(r));
  }

  private economy(w: World, tc: Building, villagers: Unit[], bs: Building[]) {
    const p = w.players[this.player];
    const home = tc.center;
    const queued = bs.reduce((s, b) => s + b.queue.filter((q) => q.kind === "unit").length, 0);

    // Advance as soon as we can.
    if (tc.complete && tc.researching === null && p.age < this.level.maxAge && w.blockerForNextAge(this.player) === null) w.advanceAge(this.player, tc.id);

    // Villagers, but hold back to save for the next age once its buildings stand.
    const target = this.level.villagers[Math.min(p.age, 3)];
    const ageBlock = w.blockerForNextAge(this.player);
    const saving = p.age < this.level.maxAge && villagers.length >= 14 + p.age * 4 && (ageBlock === null || ageBlock === "Not enough resources");
    const tcBusy = tc.queue.some((q) => q.kind === "age");
    if (tc.complete && !tcBusy && tc.queue.length < 2 && villagers.length + tc.queue.length < target && !saving && this.ferryRoom(w, bs) && p.res.food >= 50) {
      w.train(this.player, tc.id, "villager");
    }

    // Houses before we are capped.
    const houseBuilding = bs.some((b) => b.def.id === "house" && !b.complete);
    const room = p.popCap - p.pop - queued;
    if (p.popCap < w.popMax && room <= 3 && !houseBuilding && p.res.wood >= 30) {
      this.placeNear(w, "house", home, 3, 12, villagers);
    }

    // Drop sites next to the resources.
    if (this.count(bs, "granary") === 0 && villagers.length >= 4 && p.res.wood >= 120) {
      const spot = w.nearestNode(Res.food, home, 14, null, "berry_bush")?.center ?? home;
      this.placeNear(w, "granary", spot, 2, 7, villagers, false);
    }
    if (this.count(bs, "storage_pit") === 0 && villagers.length >= 6 && p.res.wood >= 120) {
      const spot = w.nearestNode(Res.wood, home, 22)?.center ?? home;
      this.placeNear(w, "storage_pit", spot, 2, 7, villagers, false);
    }
    // When the gold near home runs out, a new pit by the next mine, further out (as far as the
    // villagers will go for it), so the Iron Age stays within reach.
    if (p.age >= 1 && this.count(bs, "storage_pit") < 4 && villagers.length >= 16 && p.res.wood >= 150) {
      const gold = w.nearestNode(Res.gold, home, FAR);
      if (gold && !bs.some((b) => b.def.id === "storage_pit" && b.distance(gold.center) < 8)) this.placeNear(w, "storage_pit", gold.center, 2, 6, villagers, false);
    }

    // What the next age needs, and the army buildings, one at a time.
    const building = bs.some((b) => !b.complete && !b.isFarm && b.def.id !== "house");
    if (!building) {
      for (let a = 0; a <= p.age; a++) {
        const want = PLAN[a].find((id) => this.count(bs, id) === 0 && w.blockerBuilding(id, this.player) === null && villagers.length >= 6 + a * 3);
        if (want && this.affordable(w, w.buildingCost(this.player, want))) {
          this.placeNear(w, want, home, 5, 15, villagers);
          break;
        }
      }
      const tower = w.current(this.player, "watch_tower");
      const towers = bs.filter((b) => b.def.tags?.includes("tower")).length;
      if (p.age >= 1 && towers < 2 && p.res.stone >= 150 && w.blockerBuilding(tower, this.player) === null) {
        const enemy = this.enemyHome(w) ?? home;
        this.placeNear(w, tower, home.lerp(enemy, 0.15), 1, 6, villagers);
      }
    }

    // Farms when the berries and game near home are gone. One farmer each.
    const foodNear = w.nearestNode(Res.food, home, 16) !== null || this.huntNear(w, home) !== null;
    const farms = bs.filter((b) => b.isFarm);
    const foodWorkers = Math.ceil(this.shares(p, this.reserve(w))[Res.food] * villagers.length);
    const wantFarms = Math.max(0, foodWorkers - (foodNear ? 5 : 0));
    const farmsBuilding = farms.filter((f) => !f.complete).length;
    if (farms.length < wantFarms && farmsBuilding < 2 && p.res.wood >= 75 && w.blockerBuilding("farm", this.player) === null) {
      const granary = bs.find((b) => b.def.id === "granary" && b.complete)?.center ?? home;
      this.placeNear(w, "farm", granary, 3, 10, villagers, false);
    }

    this.assignIdle(w, home, villagers);
    this.finishAbandoned(w, villagers, bs);
    if (this.thinks % 3 === 0) this.rebalance(w, villagers, home);
  }

  private huntNear(w: World, home: Vec2): Unit | null {
    return minBy(w.units.filter((u) => u.alive && u.isAnimal && u.animal!.behavior !== "aggressive" && u.pos.distance(home) < 16),
      (u) => u.pos.distance(home));
  }

  /** How to split the villagers. A big stockpile of something pulls workers off it. */
  /** `keep` is what is being saved for the next age: a stock counts as plenty only above it. */
  shares(p: Player, keep: ResBag = new ResBag()): number[] {
    // Food first in every age, as in the original: villagers, ages, techs and most soldiers cost food.
    const byAge = [[0.65, 0.35, 0, 0], [0.55, 0.3, 0.1, 0.05], [0.55, 0.2, 0.2, 0.05], [0.55, 0.15, 0.25, 0.05]];
    const want = [...byAge[Math.min(p.age, 3)]];
    for (const r of RES_ALL) {
      const stock = p.res.get(r) - keep.get(r);
      if (stock > 800) want[r] *= 0.1; else if (stock > 400) want[r] *= 0.4;
    }
    if (p.res.stone >= 200) want[Res.stone] = 0;
    const sum = want.reduce((a, b) => a + b, 0);
    return want.map((v) => v / Math.max(sum, 0.0001));
  }

  /** Every so often move one worker from the most over-staffed resource to the most under-staffed. */
  private rebalance(w: World, villagers: Unit[], home: Vec2) {
    const want = this.shares(w.players[this.player], this.reserve(w));
    const on: Unit[][] = [[], [], [], []];
    for (const u of villagers) if (u.order.kind === "gather" && u.lastGather !== null && u.carry < 1) on[u.lastGather].push(u);
    const total = villagers.length;
    const gap = (r: Res) => want[r] * total - on[r].length;
    let need = Res.food, spare = Res.food;
    for (const r of RES_ALL) { if (gap(r) > gap(need)) need = r; if (gap(r) < gap(spare)) spare = r; }
    if (gap(need) < 1.5 || gap(spare) > -1.5 || !on[spare].length) return;
    this.sendTo(w, on[spare][0], need, home);
  }

  /** Puts a villager on a resource: a free farm, meat on the ground, berries, game to hunt, or the nearest node. */
  private sendTo(w: World, u: Unit, r: Res, home: Vec2): boolean {
    if (r === Res.food) {
      const farm = w.freeFarm(this.player, home);
      if (farm) { w.gather(this.player, [u.id], farm.id); return true; }
      const meat = w.nodes.find((n) => n.alive && n.decay > 0 && n.at.distance(home) < 16);
      if (meat) { w.gather(this.player, [u.id], meat.id); return true; }
      const berry = w.nearestNode(Res.food, home, 14, null, "berry_bush");
      if (berry) { w.gather(this.player, [u.id], berry.id); return true; }
      const game = this.huntNear(w, home);
      if (game) { w.attack(this.player, [u.id], game.id); return true; }
    }
    const n = w.nearestNode(r, home, r === Res.gold || r === Res.stone ? FAR : 30);
    if (n) { w.gather(this.player, [u.id], n.id); return true; }
    return false;
  }

  /** A building nobody is working on gets the nearest villager. */
  private finishAbandoned(w: World, villagers: Unit[], bs: Building[]) {
    for (const b of bs) {
      if (b.complete) continue;
      const working = villagers.some((v) => v.order.kind === "build" && (v.order.id === b.id || v.buildQueue.includes(b.id)));
      const v = working ? null : this.pickBuilder(villagers, b.center);
      if (v) w.build(this.player, [v.id], b.id);
    }
  }

  /** Where this AI's Dock goes: the shore nearest home with fish out at sea, or null if there is none. */
  private dockAt: Tile | null | undefined = undefined;
  /** The villager sent to look at the shore before the Dock goes up. */
  private dockScout: number | null = null;

  /** A Dock at the shore when there is fish at sea near home, and a few fishing boats kept busy. */
  private fishing(w: World, tc: Building, villagers: Unit[], bs: Building[]) {
    const p = w.players[this.player], home = tc.center;
    const docks = bs.filter((b) => b.def.on_water);
    if (!docks.length) {
      if (villagers.length < 8 || w.blockerBuilding("dock", this.player) !== null) return;
      if (!this.affordable(w, w.buildingCost(this.player, "dock"))) return;
      if (this.dockAt === undefined || (this.dockAt === null && this.thinks % 20 === 0)) this.dockAt = this.findDockSpot(w, home);
      if (!this.dockAt) return;
      if (!w.canPlace("dock", this.dockAt, this.player)) {
        if (!w.canPlace("dock", this.dockAt)) { this.dockAt = null; return; } // someone built there
        // Not seen yet: a villager walks to the shore to look, as a player would before building there,
        // as close as it can get to the part of the site it has not seen.
        const hidden = new Footprint(this.dockAt, 3).tiles().find((t) => !w.fog[this.player].isExplored(t));
        const scout = this.dockScout !== null ? w.unit(this.dockScout) : null;
        if (hidden && (!scout || scout.order.kind !== "move")) {
          const v = scout && scout.alive ? scout : this.pickBuilder(villagers, hidden.center);
          if (v) { w.move(this.player, [v.id], hidden.center); this.dockScout = v.id; }
        }
        return;
      }
      this.dockScout = null;
      const v = this.pickBuilder(villagers, this.dockAt.center);
      if (v && "error" in w.place(this.player, "dock", this.dockAt, [v.id])) this.dockAt = null;
      return;
    }
    const dock = docks.find((d) => d.complete);
    if (!dock) return;
    const boats = w.unitsOf(this.player).filter((u) => u.isBoat && u.isGatherer);
    const want = [3, 4, 5, 5][Math.min(p.age, 3)];
    const type = w.current(this.player, "fishing_boat");
    if (boats.length + dock.queue.length < want && dock.queue.length === 0 && p.pop + 1 <= p.popCap - (this.needsFerry ? 1 : 0) && w.blockerUnit(type, this.player) === null
      && this.affordable(w, w.unitCost(this.player, type))) w.train(this.player, dock.id, type);
    for (const b of boats) {
      if (b.order.kind !== "idle") continue;
      const fish = minBy(w.nodes.filter((n) => n.alive && n.def.on_water && n.amount > 0 && n.center.distance(dock.center) < 35),
        (n) => n.center.distance(b.pos));
      if (fish) w.gather(this.player, [b.id], fish.id);
    }
  }

  /** The nearest place for a Dock to home, within reach, with deep-sea fish not far from it. */
  private findDockSpot(w: World, home: Vec2): Tile | null {
    // Deep-sea fish only: by a lake's shore fish, villagers fishing from the bank do better than boats.
    const fish = w.nodes.filter((n) => n.alive && n.def.boats_only);
    if (!fish.length) return null;
    const c = home.tile;
    let best: Tile | null = null, bestD = Infinity;
    for (let y = c.y - 22; y <= c.y + 22; y++) {
      for (let x = c.x - 22; x <= c.x + 22; x++) {
        const t = new Tile(x, y);
        const d = t.center.distance(home);
        if (d >= bestD || d > 22 || !w.canPlace("dock", t)) continue;
        if (!fish.some((f) => f.center.distance(t.center) < 20)) continue;
        best = t; bestD = d;
      }
    }
    return best;
  }

  /** A badly damaged building gets one villager to repair it, once the fighting there is over and
   *  there is a margin of resources for it. */
  private repair(w: World, villagers: Unit[], bs: Building[]) {
    if (this.difficulty === "easy") return;
    const p = w.players[this.player];
    let busy = villagers.filter((v) => v.order.kind === "repair").length;
    for (const b of bs) {
      if (busy >= 2) return;
      if (!b.complete || b.isFarm || b.hp > b.maxHp * 0.6) continue;
      if (villagers.some((v) => v.order.kind === "repair" && v.order.id === b.id)) continue;
      if (!p.res.covers(w.bstats(b).cost)) continue; // keep the margin: a full bar costs half of this
      const danger = w.units.some((u) => u.alive && !u.isAnimal && !u.isRelic && w.isEnemy(this.player, u.owner) && dist(u, b.center) < 8);
      if (danger) continue;
      const v = this.pickBuilder(villagers, b.center);
      if (v) { w.repair(this.player, [v.id], b.id); busy++; }
    }
  }

  private assignIdle(w: World, home: Vec2, villagers: Unit[]) {
    const idle = villagers.filter((u) => u.order.kind === "idle");
    if (!idle.length) return;
    const working = [0, 0, 0, 0];
    for (const u of villagers) {
      if ((u.order.kind === "gather" || u.order.kind === "return") && u.lastGather !== null) working[u.lastGather]++;
      if (u.order.kind === "attack") working[Res.food]++; // hunting
    }
    const want = this.shares(w.players[this.player], this.reserve(w));
    const total = villagers.length;
    for (const u of idle) {
      const order = [...RES_ALL].sort((a, b) => (want[b] * total - working[b]) - (want[a] * total - working[a]));
      for (const r of order) {
        if (want[r] === 0) continue;
        if (this.sendTo(w, u, r, home)) { working[r]++; break; }
      }
    }
  }

  // ---- research

  private research(w: World, bs: Building[], army: Unit[]) {
    if (this.thinks % 3 !== 0) return;
    if (this.difficulty === "easy" && (this.thinks / 3) % 3 !== 0) return;
    const p = w.players[this.player];
    // Keep the army's unit lines current, then the list; tower upgrades once towers stand.
    const uses = new Set(army.map((u) => u.def.id));
    const list = [...TECHS];
    for (const t of w.rules.techs.values()) {
      if (t.effects.some((e) => e.type === "upgrade" && uses.has(e.from)) && !list.includes(t.id)) list.unshift(t.id);
    }
    if (bs.some((b) => b.def.tags?.includes("tower"))) list.push("sentry_tower_tech", "guard_tower_tech");
    if (p.res.stone >= 150) list.unshift("watch_tower_tech");
    for (const id of list) {
      const t = w.rules.techs.get(id);
      if (!t || w.blockerTech(id, this.player) !== null) continue;
      if (!this.affordable(w, ResBag.of(t.cost))) continue;
      const at = bs.find((b) => b.complete && b.def.id === t.building && b.queue.length === 0);
      if (!at) continue;
      w.research(this.player, at.id, id);
      return;
    }
  }

  // ---- army

  private military(w: World, army: Unit[], bs: Building[], villagers: number) {
    const p = w.players[this.player];
    if (villagers < 10 && !army.length && w.time <= 400) return;
    // Waiting for a transport to cross the sea: leave room in the population for it.
    if (!this.ferryRoom(w, bs)) return;
    const enemyArmy = w.units.filter((u) => u.alive && !u.isRelic && w.isEnemy(this.player, u.owner) && !u.isVillager);
    const producing = bs.filter((b) => b.complete && b.def.id !== "town_center" && b.queue.some((q) => q.kind === "unit")).length;
    let slots = this.level.producers + (p.age >= 2 ? 1 : 0) - producing;
    const siege = army.filter((u) => u.def.class === "siege").length;
    const priests = w.unitsOf(this.player).filter((u) => u.isPriest).length;
    for (const b of bs) {
      if (!b.complete || !(b.def.trains ?? []).length || b.def.id === "town_center" || b.def.on_water || b.queue.length >= 2) continue;
      if (!b.queue.length) { if (slots <= 0) continue; slots--; }
      let options = (b.def.trains ?? []).filter((t) => w.unitShown(t, this.player) && w.blockerUnit(t, this.player) === null);
      if (b.def.id === "siege_workshop" && siege >= 3) options = [];
      if (b.def.id === "temple" && priests >= 2) options = [];
      if (!options.length) continue;
      let pick: string;
      if (b.def.id === "siege_workshop") pick = options.find((o) => w.rules.units.get(o)?.area) ?? options[0];
      else if (this.level.counters) {
        pick = options[0];
        for (const o of options) if (this.score(w, o, enemyArmy) > this.score(w, pick, enemyArmy)) pick = o;
      } else pick = options[Math.floor(this.thinks / 7) % options.length];
      // Below the standing guard for this age, soldiers come before saving for the next age.
      const cost = w.unitCost(this.player, pick);
      // Short of guards, the food and wood saved for the next age may go on them, never the gold:
      // a long war would otherwise keep the Iron Age out of reach.
      const short = army.length < this.level.guard[Math.min(p.age, 3)];
      const goldFree = p.res.gold - this.reserve(w).gold >= cost.gold;
      if (short ? p.res.covers(cost) && goldFree : this.affordable(w, cost)) w.train(this.player, b.id, pick);
    }
  }

  /** How well a unit type fares against what the enemy has. No logarithms, so it is exact everywhere. */
  private score(w: World, type: string, enemies: Unit[]) {
    const me = w.rules.units.get(type);
    if (!me) return 0;
    const st = w.unitStats(this.player, type);
    const mine: UnitDef = { ...me, hp: st.hp, attack: st.attack, armor: st.armor, pierce_armor: st.pierce_armor, attack_cooldown: st.attack_cooldown };
    if (!enemies.length) return (st.hp * st.attack) / Math.max(1, st.cost.total) + (me.range > 0 ? 0.5 : 0);
    let s = 0;
    for (const e of enemies) {
      const r = Math.max(0.01, strength(mine, e.def, w.rules) / Math.max(0.0001, strength(e.def, mine, w.rules)));
      s += r >= 1 ? r - 1 : 1 - 1 / r;
    }
    return s;
  }

  private defend(w: World, army: Unit[], villagers: Unit[], bs: Building[]) {
    const threats = w.units.filter((e) => e.alive && (!e.isRelic && w.isEnemy(this.player, e.owner) || (e.isAnimal && e.animal!.behavior === "aggressive"))
      && bs.some((b) => b.distance(e.pos) < 10));
    if (!threats.length) return;
    for (const u of army) {
      if (u.order.kind === "attack") continue;
      const t = minBy(threats, (t) => dist(t, u.pos))!;
      if (dist(t, u.pos) < 30) w.attack(this.player, [u.id], t.id);
    }
    // Outnumbered at home: villagers next to the fight join in.
    const soldiers = threats.filter((t) => !t.isVillager && !t.isAnimal).length;
    if (soldiers > army.length) {
      for (const v of villagers) {
        const t = minBy(threats, (t) => dist(t, v.pos));
        if (t && dist(t, v.pos) < 5) w.attack(this.player, [v.id], t.id);
      }
    }
  }

  private attack(w: World, home: Vec2, army: Unit[], priests: Unit[]) {
    const idle = army.filter((u) => u.order.kind === "idle");
    // Units sent in a wave that took a base apart keep going to the next building. Defenders that
    // chased an enemy far from home give up and come back, as the original's computer did: a chase
    // must not turn into an attack the plan never made.
    const away = idle.filter((u) => dist(u, home) > 18);
    const raiders = away.filter((u) => this.sent.has(u.id)), strays = away.filter((u) => !this.sent.has(u.id));
    if (raiders.length) this.attackNearest(w, raiders);
    if (strays.length) w.move(this.player, strays.map((u) => u.id), home);
    // Priests near a fight convert the strongest enemy in reach.
    for (const pr of priests) {
      if (pr.order.kind !== "idle" || pr.faith < 100) continue;
      const t = minBy(w.units.filter((e) => e.alive && !e.isRelic && w.isEnemy(this.player, e.owner) && !e.isVillager && !e.isPriest && e.pos.distance(pr.pos) < 12),
        (e) => -w.stats(e).hp);
      if (t) w.convert(this.player, [pr.id], t.id);
    }

    // Across the sea from the enemy (islands)? Then keep room for a transport from the start.
    const far = this.enemyHome(w);
    if (far && this.thinks % 10 === 0) this.needsFerry = this.overSea(w, home, far) && !w.unitsOf(this.player).some((u) => u.isTransport);
    if (this.needsFerry && w.time >= this.level.firstAttack * 0.8) this.trainTransport(w);
    if (this.ferry) { this.runFerry(w); return; }
    // A gathered wave goes in together once most of it has arrived, or after a minute.
    if (this.staging) {
      const st = this.staging;
      const alive = st.ids.map((id) => w.unit(id)).filter((u): u is Unit => !!u);
      const there = alive.filter((u) => dist(u, st.at) < 8).length;
      if (!alive.length) this.staging = null;
      else if (there >= alive.length * 0.75 || w.time - st.since > 60) {
        w.move(this.player, alive.map((u) => u.id), this.enemyHome(w) ?? st.target, true);
        this.staging = null;
      }
      return;
    }
    if (w.time < this.level.firstAttack) return;
    const ready = idle.filter((u) => dist(u, home) <= 18);
    const p = w.players[this.player];
    const maxed = p.pop >= p.popCap - 2 && ready.length >= 6;
    const theirArmy = w.units.filter((u) => u.alive && !u.isRelic && w.isEnemy(this.player, u.owner) && !u.isVillager).length;
    const weak = ready.length >= 6 && theirArmy * 2 <= ready.length;
    const target = this.enemyHome(w);
    if (!(ready.length >= this.waveSize || maxed || weak) || !target) return;
    const sendPriests = priests.filter((u) => u.order.kind === "idle" && dist(u, home) <= 18).map((u) => u.id);
    const ids = ready.map((u) => u.id).concat(sendPriests);
    // Over the water (islands): by transport, as many as it carries a trip.
    if (this.overSea(w, home, target)) {
      if (this.startFerry(w, home, target, ids)) { this.waves++; this.waveSize = Math.min(this.waveSize + 1, 10); }
      return;
    }
    // Far away (a big map): gather two thirds of the way there first. Close: go straight in.
    if (home.distance(target) > 45) {
      const at = home.lerp(target, 0.66);
      w.move(this.player, ids, at, true);
      this.staging = { at, target, ids, since: w.time };
    } else w.move(this.player, ids, target, true);
    this.waves++;
    this.waveSize = Math.min(this.waveSize + 2, 16);
    for (const id of ids) this.sent.add(id);
    if (this.sent.size > 400) for (const id of [...this.sent]) if (!w.unit(id)) this.sent.delete(id);
  }

  private attackNearest(w: World, group: Unit[]) {
    const c = group[0]?.pos;
    if (!c) return;
    const t = minBy(w.buildings.filter((b) => b.alive && w.isEnemy(this.player, b.owner) && !b.isWall), (b) => b.distance(c));
    if (t) { w.move(this.player, group.map((u) => u.id), t.center, true); return; }
    const u = w.units.find((u) => u.alive && !u.isRelic && w.isEnemy(this.player, u.owner));
    if (u) w.move(this.player, group.map((g) => g.id), u.pos, true);
  }

  /** The home of the nearest enemy still in the game: its Town Center, else any building, else where it began. */
  private enemyHome(w: World): Vec2 | null {
    const mine = w.startTiles[this.player]?.center ?? null;
    const homes = w.players.filter((p) => w.isEnemy(this.player, p.id) && !p.defeated).map((e) => {
      const tc = w.buildings.find((b) => b.alive && b.owner === e.id && b.def.id === "town_center");
      return tc?.center ?? w.buildings.find((b) => b.alive && b.owner === e.id && !b.isWall)?.center ?? w.startTiles[e.id].center;
    });
    return mine ? minBy(homes, (h) => h.distance(mine)) : homes[0] ?? null;
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
    const free = villagers.filter((u) => u.order.kind !== "build" && u.order.kind !== "attack" && u.carry < 5);
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
