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
  hard: { firstAttack: 660, firstWave: 10, villagers: [22, 28, 32, 34], producers: 3, counters: true, gather: 1.2, maxAge: 3, guard: [4, 8, 10, 12] },
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
  "woodworking", "gold_mining", "domestication", "toolworking", "leather_armor_infantry", "battle_axe", "wheel",
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
    const army = mine.filter((u) => !u.isVillager && !u.isPriest);
    const priests = mine.filter((u) => u.isPriest);
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
    this.repair(w, villagers, bs);
    this.research(w, bs, army);
    this.military(w, army, bs, villagers.length);
    this.attack(w, home, army, priests);
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
    if (tc.complete && !tcBusy && tc.queue.length < 2 && villagers.length + tc.queue.length < target && !saving && p.res.food >= 50) {
      w.train(this.player, tc.id, "villager");
    }

    // Houses before we are capped.
    const houseBuilding = bs.some((b) => b.def.id === "house" && !b.complete);
    const room = p.popCap - p.pop - queued;
    if (p.popCap < w.rules.economy.pop_max && room <= 3 && !houseBuilding && p.res.wood >= 30) {
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
    if (p.age >= 1 && this.count(bs, "storage_pit") < 2 && villagers.length >= 16 && p.res.wood >= 150) {
      const gold = w.nearestNode(Res.gold, home, 26);
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
    const foodWorkers = Math.ceil(this.shares(p)[Res.food] * villagers.length);
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
  shares(p: Player): number[] {
    // Food first in every age, as in the original: villagers, ages, techs and most soldiers cost food.
    const byAge = [[0.65, 0.35, 0, 0], [0.55, 0.3, 0.1, 0.05], [0.55, 0.2, 0.2, 0.05], [0.55, 0.15, 0.25, 0.05]];
    const want = [...byAge[Math.min(p.age, 3)]];
    for (const r of RES_ALL) {
      const stock = p.res.get(r);
      if (stock > 800) want[r] *= 0.1; else if (stock > 400) want[r] *= 0.4;
    }
    if (p.res.stone >= 200) want[Res.stone] = 0;
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
    const n = w.nearestNode(r, home, 30);
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
      const danger = w.units.some((u) => u.alive && !u.isAnimal && w.isEnemy(this.player, u.owner) && dist(u, b.center) < 8);
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
    const want = this.shares(w.players[this.player]);
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
    const enemyArmy = w.units.filter((u) => u.alive && w.isEnemy(this.player, u.owner) && !u.isVillager);
    const producing = bs.filter((b) => b.complete && b.def.id !== "town_center" && b.queue.some((q) => q.kind === "unit")).length;
    let slots = this.level.producers + (p.age >= 2 ? 1 : 0) - producing;
    const siege = army.filter((u) => u.def.class === "siege").length;
    const priests = w.unitsOf(this.player).filter((u) => u.isPriest).length;
    for (const b of bs) {
      if (!b.complete || !(b.def.trains ?? []).length || b.def.id === "town_center" || b.queue.length >= 2) continue;
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
      const short = army.length < this.level.guard[Math.min(p.age, 3)];
      if (short ? p.res.covers(cost) : this.affordable(w, cost)) w.train(this.player, b.id, pick);
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
    const threats = w.units.filter((e) => e.alive && (w.isEnemy(this.player, e.owner) || (e.isAnimal && e.animal!.behavior === "aggressive"))
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
    // Units that already took a base apart keep going to the next building.
    const away = idle.filter((u) => dist(u, home) > 18);
    if (away.length) this.attackNearest(w, away);
    // Priests near a fight convert the strongest enemy in reach.
    for (const pr of priests) {
      if (pr.order.kind !== "idle" || pr.faith < 100) continue;
      const t = minBy(w.units.filter((e) => e.alive && w.isEnemy(this.player, e.owner) && !e.isVillager && !e.isPriest && e.pos.distance(pr.pos) < 12),
        (e) => -w.stats(e).hp);
      if (t) w.convert(this.player, [pr.id], t.id);
    }

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
    const theirArmy = w.units.filter((u) => u.alive && w.isEnemy(this.player, u.owner) && !u.isVillager).length;
    const weak = ready.length >= 6 && theirArmy * 2 <= ready.length;
    const target = this.enemyHome(w);
    if (!(ready.length >= this.waveSize || maxed || weak) || !target) return;
    const sendPriests = priests.filter((u) => u.order.kind === "idle" && dist(u, home) <= 18).map((u) => u.id);
    const ids = ready.map((u) => u.id).concat(sendPriests);
    // Far away (a big map): gather two thirds of the way there first. Close: go straight in.
    if (home.distance(target) > 45) {
      const at = home.lerp(target, 0.66);
      w.move(this.player, ids, at, true);
      this.staging = { at, target, ids, since: w.time };
    } else w.move(this.player, ids, target, true);
    this.waves++;
    this.waveSize = Math.min(this.waveSize + 2, 16);
  }

  private attackNearest(w: World, group: Unit[]) {
    const c = group[0]?.pos;
    if (!c) return;
    const t = minBy(w.buildings.filter((b) => b.alive && w.isEnemy(this.player, b.owner) && !b.isWall), (b) => b.distance(c));
    if (t) { w.move(this.player, group.map((u) => u.id), t.center, true); return; }
    const u = w.units.find((u) => u.alive && w.isEnemy(this.player, u.owner));
    if (u) w.move(this.player, group.map((g) => g.id), u.pos, true);
  }

  private enemyHome(w: World): Vec2 | null {
    const e = w.players.find((p) => w.isEnemy(this.player, p.id) && !p.defeated);
    if (!e) return null;
    const tc = w.buildings.find((b) => b.alive && b.owner === e.id && b.def.id === "town_center");
    if (tc) return tc.center;
    return w.buildings.find((b) => b.alive && b.owner === e.id && !b.isWall)?.center ?? w.startTiles[e.id].center;
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
