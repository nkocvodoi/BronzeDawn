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

export interface AgeDef { id: string; name: string; cost?: Record<string, number>; research_time?: number; requires_buildings?: number }
export interface NodeDef { id: string; name: string; resource: string; amount: number }
export interface EconomyDef {
  carry: number;
  gather_rates: Record<string, number>;
  start: Record<string, number>;
  start_villagers: number;
  pop_max: number;
}
export interface UnitDef {
  id: string; name: string; class: string; age: string; trained_at: string;
  cost: Record<string, number>; train_time: number; hp: number; attack: number;
  armor: number; pierce_armor: number; range: number; attack_cooldown: number;
  speed: number; los: number; pop: number; bonus?: Record<string, number>;
}
export interface BuildingDef {
  id: string; name: string; age: string; cost: Record<string, number>; size: number;
  hp: number; build_time: number; los?: number; pop_provided?: number;
  drop_off?: string[]; trains?: string[]; requires?: string[];
  resource?: Record<string, number>; attack?: number; range?: number;
  attack_cooldown?: number; armor?: number; pierce_armor?: number;
}
export interface RulesFile {
  resources: string[];
  ages: AgeDef[];
  combat?: { min_damage?: number };
  economy: EconomyDef;
  nodes: NodeDef[];
  units: UnitDef[];
  buildings: BuildingDef[];
}

export const isWorker = (u: UnitDef) => u.class === "worker";
export const isRanged = (u: UnitDef) => u.range > 0;

export class Rules {
  readonly ages: AgeDef[];
  readonly economy: EconomyDef;
  readonly minDamage: number;
  readonly nodes = new Map<string, NodeDef>();
  readonly units = new Map<string, UnitDef>();
  readonly unitOrder: string[];
  readonly buildings = new Map<string, BuildingDef>();
  readonly buildingOrder: string[];

  constructor(file: RulesFile) {
    for (const r of file.resources) {
      if (resFromKey(r) === null) throw new Error(`rules.json: unknown resource '${r}'`);
    }
    this.ages = file.ages;
    this.economy = file.economy;
    this.minDamage = file.combat?.min_damage ?? 1;
    for (const n of file.nodes) this.nodes.set(n.id, n);
    for (const u of file.units) this.units.set(u.id, u);
    for (const b of file.buildings) this.buildings.set(b.id, b);
    this.unitOrder = file.units.map((u) => u.id);
    this.buildingOrder = file.buildings.map((b) => b.id);
    for (const id of ["town_center", "house", "farm"]) {
      if (!this.buildings.has(id)) throw new Error(`rules.json: this build needs a '${id}' building`);
    }
    if (!this.units.has("villager")) throw new Error("rules.json: this build needs a 'villager' unit");
  }

  ageIndex(id: string) { return Math.max(0, this.ages.findIndex((a) => a.id === id)); }
  unitCost(id: string) { return ResBag.of(this.units.get(id)?.cost); }
  buildingCost(id: string) { return ResBag.of(this.buildings.get(id)?.cost); }
  gatherRate(r: Res) { return this.economy.gather_rates[RES_KEY[r]] ?? 0.4; }
}
