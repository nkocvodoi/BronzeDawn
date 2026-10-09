// Everything the game reads from rules.json. Every number lives there.
// Same file and same schema as the Mac build and balance.py.

export enum Res { food, wood, gold, stone }
export const RES_ALL: Res[] = [Res.food, Res.wood, Res.gold, Res.stone];
export const RES_KEY = ["food", "wood", "gold", "stone"] as const;
export const RES_LABEL = ["Food", "Wood", "Gold", "Stone"] as const;

export function resFromKey(k: string): Res | null {
  const i = (RES_KEY as readonly string[]).indexOf(k);
  return i < 0 ? null : (i as Res);
}

/** An amount of each resource. */
export class ResBag {
  values = [0, 0, 0, 0];

  static of(dict: Record<string, number> | undefined): ResBag {
    const b = new ResBag();
    for (const [k, v] of Object.entries(dict ?? {})) {
      const r = resFromKey(k);
      if (r !== null) b.values[r] = v;
    }
    return b;
  }

  get(r: Res) { return this.values[r]; }
  set(r: Res, v: number) { this.values[r] = v; }
  covers(c: ResBag) { return RES_ALL.every((r) => this.values[r] >= c.values[r]); }
  spend(c: ResBag) { for (const r of RES_ALL) this.values[r] -= c.values[r]; }
  add(c: ResBag) { for (const r of RES_ALL) this.values[r] += c.values[r]; }
  get total() { return this.values.reduce((a, b) => a + b, 0); }
  get food() { return this.values[Res.food]; }
  get wood() { return this.values[Res.wood]; }
  get gold() { return this.values[Res.gold]; }
  get stone() { return this.values[Res.stone]; }

  /** "50 food, 20 gold" */
  get text() {
    return RES_ALL.filter((r) => this.values[r] > 0).map((r) => `${Math.floor(this.values[r])} ${RES_KEY[r]}`).join(", ");
  }
}

export interface AgeDef {
  id: string; name: string; cost?: Record<string, number>; research_time?: number;
  requires_buildings?: number;
  /** The buildings that count toward requires_buildings (two different ones, as in the original). */
  requires_from?: string[];
}
export interface NodeDef {
  id: string; name: string; resource: string; amount: number;
  /** Gather rate override (shore fish are faster). */
  rate?: number;
  /** "plant" food goes to a Granary, "meat" to a Storage Pit; the Town Center takes both. */
  food_kind?: "plant" | "meat";
  on_water?: boolean;
  /** Deep-sea fish: only boats reach them. */
  boats_only?: boolean;
}
export interface AnimalDef {
  id: string; name: string; hp: number; attack: number; armor: number; attack_cooldown?: number;
  speed: number; los: number; food: number; behavior: "flee" | "defend" | "aggressive";
  /** Food a carcass loses per second. */
  decay: number; herd: [number, number]; near_water?: boolean;
}
export interface EconomyDef {
  carry: number;
  gather_rates: Record<string, number>;
  start: Record<string, number>;
  /** Other starting stockpiles, by the start screen's name for them. "low" is `start`. */
  start_levels?: Record<string, Record<string, number>>;
  start_villagers: number;
  /** The default population limit; the start screen may pick another from `pop_limits`. */
  pop_max: number;
  pop_limits?: number[];
  /** Fishing boats a player may have, alive or in training, for each finished Dock. */
  fishing_boats_per_dock?: number;
  /** How long a finished Wonder must stand to win, and all Ruins or all Artifacts be held. */
  wonder_seconds?: number;
  /** How many Ruins and Artifacts a map gets, how near a unit must be to take one, how fast an Artifact moves. */
  relics?: { ruins: number; artifacts: number; ruins_radius: number; artifact_radius: number; artifact_speed: number };
  /** Gold a trade trip brings for each tile between the two Docks. */
  trade_gold_per_tile?: number;
  /** Repair speed, as a share of the building speed. */
  repair_rate?: number;
  /** What a full bar of repair costs, as a share of the building's price. */
  repair_cost?: number;
}
export interface UnitDef {
  id: string; name: string; class: string; age: string; trained_at: string;
  cost: Record<string, number>; train_time: number; hp: number; attack: number;
  armor: number; pierce_armor: number; range: number; attack_cooldown: number;
  speed: number; los: number; pop: number; bonus?: Record<string, number>;
  tags?: string[];
  requires_tech?: string;
  /** Overrides the damage type: "pierce" by default for anything with range. */
  damage?: "melee" | "pierce";
  /** Splash radius of a siege stone. */
  area?: number;
  min_range?: number;
  /** Stones that land with Attack Ground knock down trees (no wood from them). */
  clears_trees?: boolean;
  projectile?: "arrow" | "stone" | "bolt" | "spear" | "fire";
  /** Elephants and scythe chariots hit everything this close to their target. */
  trample?: number;
  converts?: boolean;
  heal?: number;
  /** Conversion is this many times harder. */
  convert_resist?: number;
  /** Scouts do not chase villagers on their own. */
  ignores_villagers?: boolean;
  /** Boats: they move on water only. */
  naval?: boolean;
  /** Boats that gather, and what from ("fish"). */
  gathers?: string[];
  /** A boat's own gather rate, whatever it gathers. */
  gather_rate?: number;
  /** Transports: how many land units they carry. */
  capacity?: number;
  /** Trade boats: they carry goods between Docks for gold. */
  trades?: boolean;
}
export interface BuildingDef {
  id: string; name: string; age: string; cost: Record<string, number>; size: number;
  hp: number; build_time: number; los?: number; pop_provided?: number;
  drop_off?: string[]; trains?: string[]; requires?: string[];
  resource?: Record<string, number>; attack?: number; range?: number;
  attack_cooldown?: number; armor?: number; pierce_armor?: number;
  food_kinds?: ("plant" | "meat")[];
  requires_tech?: string;
  tags?: string[];
  projectile?: "arrow" | "stone" | "bolt" | "spear" | "fire";
  /** Stands in the water by the shore (a Dock). */
  on_water?: boolean;
}

/** What an effect applies to. Unit tags must all match; building tags match any, "!tag" excludes, "*" is every building. */
export interface Target { tags?: string[]; units?: string[]; buildings?: string[]; buildings_tags?: string[] }
export type Effect =
  | { type: "stat"; stat: string; op: "add" | "mul"; value: number; target: Target }
  | { type: "gather"; resource: string; rate: number; carry: number; kind?: "farm" | "hunt" | "forage" | "fish" }
  | { type: "upgrade"; from: string; to: string }
  | { type: "farm_food"; op: "add" | "mul"; value: number }
  | { type: "mine_yield"; resource: string; value: number }
  | { type: "flag"; flag: string }
  | { type: "conversion"; stat: "chance" | "regen" | "resist"; value: number }
  | { type: "carry"; value: number }
  | { type: "heal"; value: number };
export interface TechDef {
  id: string; name: string; age: string; building: string; cost: Record<string, number>; time: number;
  requires: string[]; effects: Effect[];
}
export interface CivDef { id: string; name: string; arch: string; effects: Effect[]; disabled: string[] }
export interface RulesFile {
  resources: string[];
  ages: AgeDef[];
  combat?: { min_damage?: number; building_factor?: number; building_min?: number };
  economy: EconomyDef;
  nodes: NodeDef[];
  animals?: AnimalDef[];
  units: UnitDef[];
  buildings: BuildingDef[];
  techs?: TechDef[];
  civs?: CivDef[];
}

export const isWorker = (u: UnitDef) => u.class === "worker";
export const isRanged = (u: UnitDef) => u.range > 0;
export const hasTag = (u: UnitDef, t: string) => u.tags?.includes(t) ?? false;

export class Rules {
  readonly ages: AgeDef[];
  readonly economy: EconomyDef;
  readonly minDamage: number;
  readonly nodes = new Map<string, NodeDef>();
  readonly units = new Map<string, UnitDef>();
  readonly unitOrder: string[];
  readonly buildings = new Map<string, BuildingDef>();
  readonly buildingOrder: string[];
  readonly animals = new Map<string, AnimalDef>();
  readonly techs = new Map<string, TechDef>();
  readonly techOrder: string[];
  readonly civs: CivDef[];
  readonly buildingFactor: number;
  readonly buildingMin: number;

  constructor(file: RulesFile) {
    for (const r of file.resources) {
      if (resFromKey(r) === null) throw new Error(`rules.json: unknown resource '${r}'`);
    }
    this.ages = file.ages;
    this.economy = file.economy;
    this.minDamage = file.combat?.min_damage ?? 1;
    this.buildingFactor = file.combat?.building_factor ?? 1;
    this.buildingMin = file.combat?.building_min ?? this.minDamage;
    for (const a of file.animals ?? []) this.animals.set(a.id, a);
    for (const t of file.techs ?? []) this.techs.set(t.id, t);
    this.techOrder = (file.techs ?? []).map((t) => t.id);
    this.civs = file.civs ?? [];
    for (const n of file.nodes) this.nodes.set(n.id, n);
    for (const u of file.units) this.units.set(u.id, u);
    for (const b of file.buildings) this.buildings.set(b.id, b);
    this.unitOrder = file.units.map((u) => u.id);
    this.buildingOrder = file.buildings.map((b) => b.id);
    for (const id of ["town_center", "house"]) {
      if (!this.buildings.has(id)) throw new Error(`rules.json: this build needs a '${id}' building`);
    }
    if (!this.units.has("villager")) throw new Error("rules.json: this build needs a 'villager' unit");
  }

  ageIndex(id: string) { return Math.max(0, this.ages.findIndex((a) => a.id === id)); }
  unitCost(id: string) { return ResBag.of(this.units.get(id)?.cost); }
  buildingCost(id: string) { return ResBag.of(this.buildings.get(id)?.cost); }
  gatherRate(r: Res) { return this.economy.gather_rates[RES_KEY[r]] ?? 0.4; }
}
