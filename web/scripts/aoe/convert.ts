// Turns a parsed empires.dat into a Bronze Dawn rules.json.
//
// It starts from the game's own rules.json (ids, tags, classes, the civ list, Lac Viet) and overwrites every
// number it can find in the player's copy of Age of Empires: costs, times, hit points, attack and armour,
// range, reload, speed, line of sight, gather rates and carry, resource amounts, ages, techs and civ bonuses.
// Anything the data says that Bronze Dawn's effect types cannot express goes into a `notes` list next to it.

import type { DatCiv, DatEffectCommand, DatFile, DatUnit } from "./dat";
import { ATTRIBUTES, RESOURCES, UNIT_CLASSES, name } from "./names";
import type { Effect, RulesFile, Target, TechDef, UnitDef } from "../../src/core/rules";

/** Bronze Dawn unit id -> AoE unit id. */
export const UNIT_MAP: Record<string, number> = {
  villager: 83, clubman: 73, axeman: 74, slinger: 347, short_swordsman: 75, broad_swordsman: 76,
  long_swordsman: 77, legion: 282, hoplite: 93, phalanx: 94, centurion: 291, bowman: 4, improved_bowman: 5,
  composite_bowman: 6, chariot_archer: 41, horse_archer: 39, heavy_horse_archer: 281, elephant_archer: 25,
  scout: 299, chariot: 40, scythe_chariot: 339, cavalry: 37, heavy_cavalry: 38, cataphract: 283,
  war_elephant: 46, armored_elephant: 345, camel_rider: 338, stone_thrower: 35, catapult: 36,
  heavy_catapult: 280, ballista: 11, helepolis: 279, priest: 125, fishing_boat: 13, fishing_ship: 14,
  scout_ship: 19, war_galley: 20, trireme: 21, catapult_trireme: 250, juggernaught: 277, trade_boat: 15,
  merchant_ship: 16, light_transport: 17, heavy_transport: 18, fire_galley: 360,
};

/** Bronze Dawn building id -> AoE unit id (the first-age look). */
export const BUILDING_MAP: Record<string, number> = {
  town_center: 109, house: 70, granary: 68, storage_pit: 103, barracks: 12, dock: 45, archery_range: 87,
  stable: 101, market: 84, farm: 50, small_wall: 72, medium_wall: 117, fortification: 155, watch_tower: 79,
  sentry_tower: 199, guard_tower: 69, ballista_tower: 278, government_center: 82, temple: 104, academy: 0,
  siege_workshop: 49, wonder: 276,
};

/** Bronze Dawn tech id -> AoE tech id. */
export const TECH_MAP: Record<string, number> = {
  toolworking: 46, metalworking: 51, metallurgy: 52, bronze_shield: 47, iron_shield: 117, tower_shield: 122,
  leather_armor_infantry: 40, scale_armor_infantry: 43, chain_armor_infantry: 48, leather_armor_archers: 41,
  scale_armor_archers: 44, chain_armor_archers: 49, leather_armor_cavalry: 42, scale_armor_cavalry: 45,
  chain_armor_cavalry: 50, small_wall_tech: 11, watch_tower_tech: 16, medium_wall_tech: 13,
  sentry_tower_tech: 12, fortification_tech: 14, guard_tower_tech: 15, ballista_tower_tech: 2,
  woodworking: 107, artisanship: 32, craftsmanship: 110, stone_mining: 109, siegecraft: 111, gold_mining: 108,
  coinage: 30, domestication: 81, plow: 31, irrigation: 80, wheel: 28, architecture: 112, nobility: 34,
  logistics: 121, aristocracy: 113, alchemy: 37, ballistics: 106, engineering: 35, astrology: 22,
  mysticism: 21, polytheism: 24, fanaticism: 20, monotheism: 19, afterlife: 18, jihad: 23, medicine: 119,
  martyrdom: 120, fishing_ship_tech: 4, merchant_ship_tech: 6, heavy_transport_tech: 8, war_galley_tech: 5,
  trireme_tech: 7, catapult_trireme_tech: 9, juggernaught_tech: 25, battle_axe: 63, short_sword: 64,
  broad_sword: 65, long_sword: 66, legion_tech: 77, phalanx_tech: 73, centurion_tech: 79, improved_bow: 56,
  composite_bow: 57, heavy_horse_archer_tech: 38, heavy_cavalry_tech: 71, cataphract_tech: 78,
  scythe_chariot_tech: 126, armored_elephant_tech: 125, catapult_tech: 54, heavy_catapult_tech: 36,
  helepolis_tech: 27,
};

export const AGE_TECHS: Record<string, number> = { tool: 101, bronze: 102, iron: 103 };

/** Bronze Dawn civ id -> AoE civ index. Lac Viet is Bronze Dawn's own and keeps its rules. */
export const CIV_MAP: Record<string, number> = {
  egyptian: 1, greek: 2, babylonian: 3, assyrian: 4, minoan: 5, hittite: 6, phoenician: 7, sumerian: 8,
  persian: 9, shang: 10, yamato: 11, choson: 12, roman: 13, carthaginian: 14, palmyran: 15, macedonian: 16,
};

export const ANIMAL_MAP: Record<string, { live: number; dead: number }> = {
  gazelle: { live: 65, dead: 262 }, elephant: { live: 48, dead: 335 }, lion: { live: 126, dead: 369 },
  alligator: { live: 1, dead: 85 },
};

export const NODE_MAP: Record<string, number> = {
  tree: 113, lone_tree: 134, berry_bush: 59, gold_mine: 66, stone_mine: 102, fish: 260, deep_fish: 53,
};

/** Villager jobs: the AoE unit a villager turns into for each kind of work. */
export const JOBS = {
  forage: 120, hunt: 122, farm: 259, fish: 119, wood: 123, gold: 251, stone: 124, build: 118, repair: 156,
} as const;

const RES_KEYS: Record<number, string> = { 0: "food", 1: "wood", 2: "stone", 3: "gold" };

/** Melee attack/armour class and pierce class. */
const MELEE = 4;
const PIERCE = 3;
/** Player resources in empires.dat (names.ts RESOURCES). */
const FAITH_RATE = 35;
const TRIBUTE_FEE = 46;

export interface Converted {
  rules: RulesFile;
  /** One line per value or effect that could not be carried over exactly. */
  notes: string[];
}

export function cost(list: { type: number; amount: number; flag: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of list) if (RES_KEYS[c.type] && c.amount > 0) out[RES_KEYS[c.type]] = c.amount;
  return out;
}

const amountOf = (list: { class: number; amount: number }[] | undefined, cls: number): number | undefined =>
  list?.find((a) => a.class === cls)?.amount;

export function convert(dat: DatFile, base: RulesFile): Converted {
  const notes: string[] = [];
  const rules: RulesFile = structuredClone(base);
  const units = dat.civs[1].units;
  const gaia = dat.civs[0].units;
  const unit = (id: number): DatUnit => {
    const u = units[id] ?? gaia[id];
    if (!u) throw new Error(`empires.dat has no unit ${id}`);
    return u;
  };
  const byAoe = new Map<number, string>();
  for (const [k, v] of Object.entries(UNIT_MAP)) byAoe.set(v, k);
  const buildingByAoe = new Map<number, string>();
  for (const [k, v] of Object.entries(BUILDING_MAP)) buildingByAoe.set(v, k);
  // Later looks of a building (Barracks2, Town_Center2, ...) are the same building in Bronze Dawn.
  for (const [later, first] of [[132, 12], [71, 109], [133, 45], [116, 84], [86, 101], [105, 103], [154, 70]]) {
    buildingByAoe.set(later, buildingByAoe.get(first)!);
  }

  // Ages.
  for (const age of rules.ages) {
    const t = AGE_TECHS[age.id];
    if (t === undefined) continue;
    age.cost = cost(dat.techs[t].costs);
    age.research_time = dat.techs[t].researchTime;
  }

  // Economy.
  const civ = dat.civs[1];
  const job = (k: keyof typeof JOBS) => unit(JOBS[k]);
  const eco = rules.economy as RulesFile["economy"] & { gather_kind_rates?: Record<string, number> };
  eco.start = { food: civ.resources[0], wood: civ.resources[1], gold: civ.resources[3], stone: civ.resources[2] };
  eco.carry = job("wood").resourceCapacity;
  eco.gather_rates = {
    food: job("forage").action!.workRate,
    wood: job("wood").action!.workRate,
    gold: job("gold").action!.workRate,
    stone: job("stone").action!.workRate,
  };
  eco.gather_kind_rates = {
    forage: job("forage").action!.workRate,
    hunt: job("hunt").action!.workRate,
    farm: job("farm").action!.workRate,
    fish: job("fish").action!.workRate,
  };
  for (const k of ["forage", "hunt", "farm", "fish", "gold", "stone"] as const) {
    if (job(k).resourceCapacity !== eco.carry) notes.push(`economy: ${k} carries ${job(k).resourceCapacity}, wood carries ${eco.carry}`);
  }
  eco.gather_speed = 1;
  eco.build_speed = 1;

  // Resource nodes.
  for (const n of rules.nodes) {
    const id = NODE_MAP[n.id];
    if (id === undefined) continue;
    const u = unit(id);
    const s = u.resourceStorages.find((r) => r.type >= 0 && r.type <= 3);
    if (s) n.amount = s.amount;
  }
  const fishNode = rules.nodes.find((n) => n.id === "fish");
  if (fishNode) fishNode.rate = job("fish").action!.workRate;
  const deep = rules.nodes.find((n) => n.id === "deep_fish");
  if (deep) deep.rate = unit(13).action!.workRate;

  // Animals.
  for (const a of rules.animals ?? []) {
    const m = ANIMAL_MAP[a.id];
    if (!m) continue;
    const live = unit(m.live);
    const dead = unit(m.dead);
    a.hp = live.hitPoints;
    a.speed = live.speed ?? a.speed;
    a.los = live.lineOfSight;
    // The lion's claws are a blow of class 12 of their own, not melee.
    a.attack = amountOf(live.combat?.attacks, MELEE) || Math.max(0, ...(live.combat?.attacks ?? []).map((x) => x.amount));
    a.armor = amountOf(live.combat?.armors, MELEE) ?? 0;
    if (live.combat && live.combat.reloadTime > 0) a.attack_cooldown = live.combat.reloadTime;
    const food = live.resourceStorages.find((r) => r.type === 0);
    if (food) a.food = food.amount;
    // How fast the meat rots is the living animal's decay (gazelle 0.3, elephant 0.2, lion 1 food a
    // second); the carcass unit's own is 1 for every animal.
    a.decay = live.resourceDecay || dead.resourceDecay;
  }

  // Units.
  for (const def of rules.units) {
    const id = UNIT_MAP[def.id];
    if (id === undefined) continue;
    applyUnit(def, unit(id), notes);
  }

  // Buildings.
  for (const b of rules.buildings) {
    const id = BUILDING_MAP[b.id];
    if (id === undefined) continue;
    const u = unit(id);
    if (u.creatable) {
      b.cost = cost(u.creatable.costs);
      b.build_time = u.creatable.trainTime;
    }
    b.hp = u.hitPoints;
    b.los = u.lineOfSight;
    const pop = u.resourceStorages.find((r) => r.type === 4 && r.amount > 0);
    if (pop) b.pop_provided = pop.amount;
    if (u.combat && u.combat.attacks.length) {
      b.attack = amountOf(u.combat.attacks, PIERCE) ?? amountOf(u.combat.attacks, MELEE) ?? b.attack;
      b.range = u.combat.maxRange;
      b.attack_cooldown = u.combat.reloadTime;
    }
    const arm = amountOf(u.combat?.armors, MELEE);
    const parm = amountOf(u.combat?.armors, PIERCE);
    if (arm !== undefined && arm !== 0) b.armor = arm;
    if (parm !== undefined && parm !== 0) b.pierce_armor = parm;
    // A Farm's food is the player's "farm food amount" (resource 36, 250), not the 15 the Farm unit holds.
    if (b.id === "farm") {
      const food = dat.civs[1].resources[36];
      if (food > 0) b.resource = { food };
    }
  }

  // Techs.
  const ctx: Ctx = { dat, unit, byAoe, buildingByAoe, rules, eco };
  for (const t of rules.techs ?? []) {
    const id = TECH_MAP[t.id];
    if (id === undefined) continue;
    const tech = dat.techs[id];
    t.cost = cost(tech.costs);
    t.time = tech.researchTime;
    const eff = dat.effects[tech.effectId];
    if (!eff) continue;
    const { effects, unmapped } = convertCommands(eff.commands, ctx);
    const meaningful = unmapped.filter((u) => !u.ignorable);
    const tt = t as TechDef & { notes?: string[] };
    if (meaningful.length === 0 && effects.length > 0) tt.effects = mergeUpgrades(t.effects, effects);
    else if (meaningful.length) {
      tt.notes = meaningful.map((u) => u.text);
      notes.push(...meaningful.map((u) => `tech ${t.id}: kept Bronze Dawn effects; AoE also has: ${u.text}`));
    }
  }

  // Civs.
  for (const c of rules.civs ?? []) {
    const idx = CIV_MAP[c.id];
    if (idx === undefined) continue;
    const aoeCiv: DatCiv = dat.civs[idx];
    const eff = dat.effects[aoeCiv.techTreeEffect];
    if (!eff) continue;
    const bonus = eff.commands.filter((k) => k.type !== 102);
    const { effects, unmapped } = convertCommands(bonus, ctx);
    const cc = c as typeof c & { notes?: string[] };
    c.effects = effects;
    const meaningful = unmapped.filter((u) => !u.ignorable);
    if (meaningful.length) {
      cc.notes = meaningful.map((u) => u.text);
      notes.push(...meaningful.map((u) => `civ ${c.id}: ${u.text}`));
    }
    c.disabled = disabledFor(eff.commands.filter((k) => k.type === 102).map((k) => k.d), ctx, c.disabled);
  }

  return { rules, notes };
}

function applyUnit(def: UnitDef, u: DatUnit, notes: string[]): void {
  if (u.creatable) {
    def.cost = cost(u.creatable.costs);
    def.train_time = u.creatable.trainTime;
  }
  def.hp = u.hitPoints;
  def.los = u.lineOfSight;
  if (u.speed !== undefined) def.speed = u.speed;
  const c = u.combat;
  if (!c) return;
  const melee = amountOf(c.attacks, MELEE);
  const pierce = amountOf(c.attacks, PIERCE);
  if (pierce !== undefined && (c.maxRange > 0 || melee === undefined)) {
    def.attack = pierce;
    if (def.damage === "melee") delete def.damage;
  } else if (melee !== undefined) {
    def.attack = melee;
    if (c.maxRange > 0) def.damage = "melee";
  } else if (!def.converts) {
    def.attack = 0;
  }
  // A blow of another class only (the catapult ships' stones, class 6; the lion's claws, class 12), with no
  // melee or pierce of its own, or only a zero one: that blow is the attack.
  if (!def.converts && !(def.attack > 0)) {
    const other = Math.max(0, ...c.attacks.filter((a) => a.class !== MELEE && a.class !== PIERCE).map((a) => a.amount));
    if (other > 0) def.attack = other;
  }
  def.armor = amountOf(c.armors, MELEE) ?? 0;
  def.pierce_armor = amountOf(c.armors, PIERCE) ?? 0;
  def.range = c.maxRange;
  if (c.minRange > 0) def.min_range = c.minRange;
  else delete def.min_range;
  if (c.reloadTime > 0) def.attack_cooldown = c.reloadTime;
  if (c.blastWidth > 0) {
    if (def.trample !== undefined) def.trample = c.blastWidth;
    else def.area = c.blastWidth;
  }
  if (def.gather_rate !== undefined && u.action) def.gather_rate = u.action.workRate;
  if (def.capacity !== undefined) def.capacity = u.garrisonCapacity;
  const extra = c.attacks.filter((a) => a.class !== MELEE && a.class !== PIERCE && a.amount !== 0);
  if (extra.length) notes.push(`unit ${def.id}: attack also has ${extra.map((a) => `class ${a.class} = ${a.amount}`).join(", ")}`);
}

interface Ctx {
  dat: DatFile;
  unit: (id: number) => DatUnit;
  byAoe: Map<number, string>;
  buildingByAoe: Map<number, string>;
  rules: RulesFile;
  eco: { gather_rates: Record<string, number>; gather_kind_rates?: Record<string, number> };
}

interface Unmapped { text: string; ignorable: boolean }

/** Describe one effect command in words. */
export function describe(k: DatEffectCommand, unitName: (id: number) => string, techName: (id: number) => string): string {
  const who = (a: number, b: number) => (a >= 0 ? unitName(a) : b >= 0 ? `class ${name(UNIT_CLASSES, b)}` : "all");
  const attr = (c: number, d: number) => {
    if (c === 8 || c === 9) {
      const cls = Math.floor(d / 256);
      const amt = d - cls * 256;
      return `${ATTRIBUTES[c]} (class ${cls}${cls === 3 ? " pierce" : cls === 4 ? " melee" : ""}) ${amt >= 0 ? "+" : ""}${amt}`;
    }
    return `${name(ATTRIBUTES, c)} ${d}`;
  };
  switch (k.type) {
    case 0: return `set ${who(k.a, k.b)}: ${attr(k.c, k.d).replace(/ (-?[\d.]+)$/, " = $1")}`;
    case 4: return `${who(k.a, k.b)}: ${(k.c === 8 || k.c === 9) ? attr(k.c, k.d) : `${name(ATTRIBUTES, k.c)} ${k.d >= 0 ? "+" : ""}${k.d}`}`;
    case 5: return `${who(k.a, k.b)}: ${name(ATTRIBUTES, k.c)} ×${k.d}`;
    case 1: return `resource ${name(RESOURCES, k.a)} ${k.b ? (k.d >= 0 ? "+" : "") + k.d : "= " + k.d}`;
    case 6: return `resource ${name(RESOURCES, k.a)} ×${k.d}`;
    case 2: return `${k.b ? "enable" : "disable"} ${unitName(k.a)}`;
    case 3: return `upgrade ${unitName(k.a)} → ${unitName(k.b)}`;
    case 102: return `disable tech ${techName(k.d)}`;
    default: return `command ${k.type} (${k.a}, ${k.b}, ${k.c}, ${k.d})`;
  }
}

function convertCommands(cmds: DatEffectCommand[], ctx: Ctx): { effects: Effect[]; unmapped: Unmapped[] } {
  const effects: Effect[] = [];
  const unmapped: Unmapped[] = [];
  const unitName = (id: number) => ctx.byAoe.get(id) ?? ctx.buildingByAoe.get(id) ?? `AoE unit ${id} (${(ctx.dat.civs[1].units[id] ?? ctx.dat.civs[0].units[id])?.name ?? "?"})`;
  const techName = (id: number) => ctx.dat.techs[id]?.name ?? `#${id}`;
  const miss = (k: DatEffectCommand, ignorable = false) => unmapped.push({ text: describe(k, unitName, techName), ignorable });

  for (const k of cmds) {
    if (k.type === 1 && k.a === 21) continue; // technology count, only the score uses it
    if (k.type === 1 && k.a === 36 && k.b === 1) { effects.push({ type: "farm_food", op: "add", value: k.d }); continue; }
    if (k.type === 3) {
      const from = ctx.byAoe.get(k.a);
      const to = ctx.byAoe.get(k.b);
      if (from && to) effects.push({ type: "upgrade", from, to });
      else miss(k, ctx.buildingByAoe.has(k.a) || ctx.buildingByAoe.has(k.b));
      continue;
    }
    if (k.type === 2) { miss(k, true); continue; } // unlocks: Bronze Dawn's tech tree handles these
    // Resources the game keeps per player: how fast a priest's faith comes back (2 a second unless changed),
    // and what a tribute costs on top (a quarter unless changed).
    if (k.type === 1 && k.a === FAITH_RATE) {
      const base = ctx.dat.civs[1].resources[FAITH_RATE] || 2;
      effects.push({ type: "conversion", stat: "regen", value: round((k.b ? base + k.d : k.d) / base) });
      continue;
    }
    if (k.type === 1 && k.a === TRIBUTE_FEE && !k.b && k.d === 0) { effects.push({ type: "flag", flag: "free_tribute" }); continue; }
    if (k.type !== 0 && k.type !== 4 && k.type !== 5) { miss(k); continue; }

    // A Farm's own work rate is how fast it is farmed.
    if (k.c === 13 && ctx.buildingByAoe.get(k.a) === "farm" && k.type !== 0) {
      const base = ctx.unit(k.a).action?.workRate || 0.4;
      effects.push({ type: "gather", resource: "food", rate: round(k.type === 4 ? (base + k.d) / base : k.d), carry: 0, kind: "farm" });
      continue;
    }

    // Gather work rate and carry capacity on the villager jobs.
    const jobRes = jobOf(k.a);
    if (jobRes && (k.c === 13 || k.c === 14) && k.type !== 0) {
      const base = jobRes.kind ? ctx.eco.gather_kind_rates?.[jobRes.kind] ?? ctx.eco.gather_rates[jobRes.res] : ctx.eco.gather_rates[jobRes.res];
      const rate = k.c === 13 ? (k.type === 4 ? (base + k.d) / base : k.d) : 1;
      const carry = k.c === 14 && k.type === 4 ? k.d : 0;
      if (k.c === 14 && k.type === 5) { miss(k); continue; }
      const prev = effects.find((e): e is Extract<Effect, { type: "gather" }> => e.type === "gather" && e.resource === jobRes.res && e.kind === jobRes.kind);
      if (prev) { prev.rate *= rate; prev.carry += carry; }
      else effects.push({ type: "gather", resource: jobRes.res, rate: round(rate), carry, ...(jobRes.kind ? { kind: jobRes.kind } : {}) });
      continue;
    }

    const target = targetOf(k.a, k.b, ctx);
    // A unit or a class Bronze Dawn does not have (heroes, domestic animals) has nothing to change.
    if (!target) { miss(k, (k.a >= 0 && isNonGameUnit(k.a, ctx)) || (k.a < 0 && k.b >= 0)); continue; }
    const op = k.type === 0 ? "set" : k.type === 4 ? "add" : "mul";
    let stat: string | null = null;
    let value = k.d;
    // A cost set outright becomes the same cost as a share of each unit's own ("Civilian cost 35": 35 of 50).
    if (k.c === 100 && op === "set") {
      for (const id of target.units ?? []) {
        const total = Object.values(ctx.rules.units?.find((u) => u.id === id)?.cost ?? {}).reduce((a, b) => a + (b ?? 0), 0);
        if (total > 0) effects.push({ type: "stat", stat: "cost", op: "mul", value: round(k.d / total), target: { units: [id] } });
      }
      continue;
    }
    // Base armor counts against every kind of attack the unit has no armor of its own for: for the
    // villager, which has none, both melee and pierce.
    if (k.c === 15 && op === "add") {
      for (const s of ["armor", "pierce_armor"]) effects.push({ type: "stat", stat: s, op, value: k.d, target });
      continue;
    }
    switch (k.c) {
      case 0: stat = "hp"; break;
      case 1: stat = "los"; break;
      case 5: stat = "speed"; break;
      case 10: stat = "attack_cooldown"; break;
      case 12: stat = "range"; break;
      case 100: stat = "cost"; break;
      case 8: case 9: {
        if (op === "mul") break;
        const cls = Math.floor(k.d / 256);
        value = k.d - cls * 256;
        if (cls === MELEE) stat = k.c === 8 ? "armor" : "attack";
        else if (cls === PIERCE) stat = k.c === 8 ? "pierce_armor" : "attack";
        if (value === 0 && stat) { stat = null; unmapped.push({ text: describe(k, unitName, techName), ignorable: true }); continue; }
        break;
      }
    }
    if (!stat) { miss(k); continue; }
    effects.push({ type: "stat", stat, op, value: round(value), target });
  }
  return { effects: mergeTargets(effects), unmapped };
}

function jobOf(aoe: number): { res: string; kind?: "farm" | "hunt" | "forage" | "fish" } | null {
  switch (aoe) {
    case JOBS.wood: return { res: "wood" };
    case JOBS.gold: return { res: "gold" };
    case JOBS.stone: return { res: "stone" };
    case JOBS.forage: return { res: "food", kind: "forage" };
    case JOBS.hunt: return { res: "food", kind: "hunt" };
    case JOBS.farm: return { res: "food", kind: "farm" };
    case JOBS.fish: return { res: "food", kind: "fish" };
    default: return null;
  }
}

/** Heroes, campaign and cheat units: effects on them do not matter to Bronze Dawn. */
function isNonGameUnit(aoe: number, ctx: Ctx): boolean {
  const u = ctx.dat.civs[1].units[aoe] ?? ctx.dat.civs[0].units[aoe];
  return !u || u.class === 25 || /hero|saint|nuke|laser|zug|winsett|space|baby|jason|missle|missile/i.test(u.name);
}

/** Bronze Dawn units and buildings that an AoE unit id or class stands for. */
function targetOf(a: number, b: number, ctx: Ctx): Target | null {
  if (a >= 0) {
    if (a === 83 || jobOf(a)) return { units: ["villager"] };
    const u = ctx.byAoe.get(a);
    if (u) return { units: [u] };
    const bl = ctx.buildingByAoe.get(a);
    if (bl) return { buildings: [bl] };
    return null;
  }
  if (b < 0) return null;
  const units: string[] = [];
  const buildings: string[] = [];
  for (const [bd, id] of Object.entries(UNIT_MAP)) if (ctx.unit(id).class === b) units.push(bd);
  for (const [bd, id] of Object.entries(BUILDING_MAP)) if (ctx.unit(id).class === b) buildings.push(bd);
  if (b === 4) units.push("villager");
  if (!units.length && !buildings.length) return null;
  return { ...(units.length ? { units: [...new Set(units)] } : {}), ...(buildings.length ? { buildings } : {}) };
}

/** Effects that only differ by target become one effect with both targets. */
function mergeTargets(list: Effect[]): Effect[] {
  const out: Effect[] = [];
  for (const e of list) {
    if (e.type !== "stat") { out.push(e); continue; }
    const same = out.find((o): o is Extract<Effect, { type: "stat" }> => o.type === "stat" && o.stat === e.stat && o.op === e.op && o.value === e.value);
    if (same) {
      const units = [...new Set([...(same.target.units ?? []), ...(e.target.units ?? [])])];
      const buildings = [...new Set([...(same.target.buildings ?? []), ...(e.target.buildings ?? [])])];
      same.target = { ...(units.length ? { units } : {}), ...(buildings.length ? { buildings } : {}) };
    } else out.push(e);
  }
  return out;
}

/** Bronze Dawn names its unit upgrades itself; keep its upgrade effects and use the data for the rest. */
// The original upgrades from a line's first unit ("Scout Ship → Trireme"); Bronze Dawn upgrades the units
// standing as the one before ("War Galley → Trireme"), which is what makes the ships on the water change.
// The data's own upgrades are taken only where Bronze Dawn has none (Battle Axe: Clubman → Axeman).
function mergeUpgrades(old: Effect[], fresh: Effect[]): Effect[] {
  const ups = old.filter((e) => e.type === "upgrade");
  const freshUps = fresh.filter((e) => e.type === "upgrade");
  return [...fresh.filter((e) => e.type !== "upgrade"), ...(ups.length ? ups : freshUps)];
}

function disabledFor(aoeTechs: number[], ctx: Ctx, keep: string[]): string[] {
  const techByAoe = new Map<number, string>();
  for (const [k, v] of Object.entries(TECH_MAP)) techByAoe.set(v, k);
  const out = new Set<string>();
  for (const t of aoeTechs) {
    const bd = techByAoe.get(t);
    if (bd) out.add(bd);
    const eff = ctx.dat.effects[ctx.dat.techs[t]?.effectId ?? -1];
    for (const k of eff?.commands ?? []) {
      if (k.type === 2 && k.b === 1) {
        const u = ctx.byAoe.get(k.a) ?? ctx.buildingByAoe.get(k.a);
        if (u) out.add(u);
      }
      if (k.type === 3) {
        const u = ctx.byAoe.get(k.b);
        if (u) out.add(u);
      }
    }
  }
  // Ids the AoE data cannot name (Bronze Dawn-only content) stay as they were.
  const known = new Set([...Object.keys(UNIT_MAP), ...Object.keys(BUILDING_MAP), ...Object.keys(TECH_MAP)]);
  for (const k of keep) if (!known.has(k)) out.add(k);
  return [...out];
}

const round = (v: number) => Number(v.toPrecision(6));
