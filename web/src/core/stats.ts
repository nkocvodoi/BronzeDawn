// What a player's technologies and civilization do to the numbers in rules.json.
// Every effect is data; this file only knows how to apply the effect types.
import { BuildingDef, CivDef, Effect, Res, RES_KEY, ResBag, Rules, Target, TechDef, UnitDef } from "./rules";

export interface UnitStats {
  hp: number; attack: number; armor: number; pierce_armor: number; range: number;
  attack_cooldown: number; speed: number; los: number; train_time: number; pop: number; cost: ResBag;
}
export interface BuildingStats { hp: number; build_time: number; range: number; attack: number; los: number; cost: ResBag }

type StatEffect = Extract<Effect, { type: "stat" }>;

const unitMatches = (t: Target, u: UnitDef) =>
  (t.units ? t.units.includes(u.id) : false) ||
  (t.tags ? t.tags.length > 0 && t.tags.every((tag) => u.tags?.includes(tag)) : false);

function buildingMatches(t: Target, b: BuildingDef) {
  if (t.buildings?.includes(b.id)) return true;
  const tags = t.buildings_tags;
  if (!tags) return false;
  const own = b.tags ?? [];
  const pos = tags.filter((x) => !x.startsWith("!"));
  const neg = tags.filter((x) => x.startsWith("!")).map((x) => x.slice(1));
  if (neg.some((x) => own.includes(x))) return false;
  return pos.length === 0 || pos.includes("*") || pos.some((x) => own.includes(x));
}

/** One player's researched techs and civilization, and the numbers that follow from them. */
export class Mods {
  readonly researched = new Set<string>();
  readonly flags = new Set<string>();
  /** Unit or building ids replaced by an upgrade: from -> to. */
  readonly upgraded = new Map<string, string>();
  readonly disabled = new Set<string>();
  private stats: StatEffect[] = [];
  private gatherRate = new Map<string, number>(); // "wood" or "food:hunt" -> multiplier
  private carryAdd = new Map<string, number>();
  private carryAll = 0;
  private farmAdd = 0;
  private farmMul = 1;
  private mineYield = new Map<string, number>();
  conversionChance = 1;
  conversionRegen = 1;
  conversionResist = 1;
  healMul = 1;
  private unitCache = new Map<string, UnitStats>();
  private buildingCache = new Map<string, BuildingStats>();
  civ: CivDef | null = null;

  constructor(readonly rules: Rules) {}

  setCiv(civ: CivDef | null) {
    this.civ = civ;
    if (!civ) return;
    for (const d of civ.disabled) this.disabled.add(d);
    for (const e of civ.effects) this.apply(e);
  }

  research(t: TechDef) {
    this.researched.add(t.id);
    for (const e of t.effects) this.apply(e);
  }

  private apply(e: Effect) {
    this.unitCache.clear();
    this.buildingCache.clear();
    switch (e.type) {
      case "stat": this.stats.push(e); break;
      case "gather": {
        const keys = e.resource === "all" ? RES_KEY.map(String) : [e.kind ? `${e.resource}:${e.kind}` : e.resource];
        for (const k of keys) {
          this.gatherRate.set(k, (this.gatherRate.get(k) ?? 1) * e.rate);
          if (e.carry) this.carryAdd.set(k, (this.carryAdd.get(k) ?? 0) + e.carry);
        }
        break;
      }
      case "upgrade": this.upgraded.set(e.from, e.to); break;
      case "farm_food": if (e.op === "add") this.farmAdd += e.value; else this.farmMul *= e.value; break;
      case "mine_yield": this.mineYield.set(e.resource, (this.mineYield.get(e.resource) ?? 1) * e.value); break;
      case "flag": this.flags.add(e.flag); break;
      case "conversion":
        if (e.stat === "chance") this.conversionChance *= e.value;
        else if (e.stat === "regen") this.conversionRegen *= e.value;
        else this.conversionResist *= e.value;
        break;
      case "carry": this.carryAll += e.value; break;
      case "heal": this.healMul *= e.value; break;
    }
  }

  private fold(base: number, stat: string, match: (t: Target) => boolean) {
    let add = 0, mul = 1;
    for (const e of this.stats) {
      if (e.stat !== stat || !match(e.target)) continue;
      if (e.op === "add") add += e.value; else mul *= e.value;
    }
    return (base + add) * mul;
  }

  unit(def: UnitDef): UnitStats {
    const hit = this.unitCache.get(def.id);
    if (hit) return hit;
    const m = (t: Target) => unitMatches(t, def);
    const f = (base: number, stat: string) => this.fold(base, stat, m);
    const cost = ResBag.of(def.cost);
    const k = f(1, "cost");
    for (let i = 0; i < 4; i++) cost.values[i] = Math.round(cost.values[i] * k);
    const s: UnitStats = {
      hp: Math.round(f(def.hp, "hp")), attack: f(def.attack, "attack"), armor: f(def.armor, "armor"),
      pierce_armor: f(def.pierce_armor, "pierce_armor"), range: def.range > 0 ? f(def.range, "range") : 0,
      attack_cooldown: f(def.attack_cooldown, "attack_cooldown"), speed: f(def.speed, "speed"), los: f(def.los, "los"),
      train_time: f(def.train_time, "train_time"), pop: f(def.pop, "pop"), cost,
    };
    this.unitCache.set(def.id, s);
    return s;
  }

  building(def: BuildingDef): BuildingStats {
    const hit = this.buildingCache.get(def.id);
    if (hit) return hit;
    const m = (t: Target) => buildingMatches(t, def);
    const f = (base: number, stat: string) => this.fold(base, stat, m);
    const cost = ResBag.of(def.cost);
    const k = f(1, "cost");
    for (let i = 0; i < 4; i++) cost.values[i] = Math.round(cost.values[i] * k);
    const s: BuildingStats = {
      hp: Math.round(f(def.hp, "hp")), build_time: f(def.build_time, "build_time"),
      range: f(def.range ?? 0, "range"), attack: f(def.attack ?? 0, "attack"), los: f(def.los ?? 2, "los"), cost,
    };
    this.buildingCache.set(def.id, s);
    return s;
  }

  /** Gather speed for a resource from a kind of source (farm, hunt, forage, fish). */
  gather(r: Res, kind: string | null) {
    const key = RES_KEY[r];
    return (this.gatherRate.get(key) ?? 1) * (kind ? this.gatherRate.get(`${key}:${kind}`) ?? 1 : 1);
  }

  carry(r: Res, base: number) {
    return Math.max(2, base + (this.carryAdd.get(RES_KEY[r]) ?? 0) + this.carryAll);
  }

  farmFood(base: number) { return (base + this.farmAdd) * this.farmMul; }
  yieldOf(r: Res) { return this.mineYield.get(RES_KEY[r]) ?? 1; }

  /** Whether a unit, building or tech id is open to this player (techs and upgrades considered). */
  has(id: string) { return this.researched.has(id); }
}

export { unitMatches, buildingMatches };
