import { Footprint, Tile, Vec2 } from "./geom";
import { AnimalDef, BuildingDef, isWorker, NodeDef, Res, ResBag, resFromKey, UnitDef } from "./rules";
import { Mods } from "./stats";

export const GAIA = -1;

export type Order =
  | { kind: "idle" }
  | { kind: "move"; to: Vec2; attackMove: boolean }
  | { kind: "gather"; id: number }
  | { kind: "return"; resume: number | null; drop?: number }
  | { kind: "build"; id: number }
  | { kind: "attack"; id: number }
  | { kind: "convert"; id: number }
  | { kind: "heal"; id: number };

export const IDLE: Order = { kind: "idle" };

/**
 * Anything on the map. Entities refer to each other by id, never by reference,
 * so a dead target is a lookup that fails instead of a dangling pointer.
 */
export abstract class Entity {
  hp: number;
  maxHp: number;
  alive = true;

  /** The owner changes when a priest converts it. */
  constructor(readonly id: number, public owner: number, hp: number) {
    this.hp = hp;
    this.maxHp = hp;
  }

  abstract get center(): Vec2;
  /** Distance from p to this entity's edge. */
  abstract distance(p: Vec2): number;
  abstract get typeId(): string;
  abstract get name(): string;
}

export class Unit extends Entity {
  pos: Vec2;
  /** Position at the start of the last step, for smooth drawing between steps. */
  prevPos: Vec2;
  order: Order = IDLE;
  /** Where an attack-move was heading before it stopped to fight. */
  resumeMove: Vec2 | null = null;
  path: Vec2[] = [];
  pathTarget: Vec2 | null = null;
  repathTimer = 0;
  scanTimer = 0;
  cooldown = 0;
  carryRes: Res | null = null;
  /** Food from a farm or bush is "plant", from an animal or fish "meat": they go to different buildings. */
  carryKind: "plant" | "meat" | null = null;
  carry = 0;
  /** The resource this villager was last told to gather, to find more when a node runs out. */
  lastGather: Res | null = null;
  /** The kind of node last gathered (a berry bush, a gazelle carcass), to find the next of the same. */
  lastNodeType: string | null = null;
  facing = new Vec2(1, 0);
  /** Gathering, building or striking this step (for animation). */
  busy = false;
  /** An enemy this unit could not reach, skipped by auto-targeting until the given time. */
  unreachable: { id: number; until: number } | null = null;
  /** Foundations still to build after this one (walls are laid as a row of them). */
  buildQueue: number[] = [];
  /** Priests: faith 0..100, needed full to convert; chants so far on the current target. */
  faith = 100;
  chants = 0;
  /** Animals: what they are and how long they keep running. */
  readonly animal: AnimalDef | null;
  fleeTimer = 0;

  constructor(id: number, owner: number, public def: UnitDef, pos: Vec2, animal: AnimalDef | null = null) {
    super(id, owner, def.hp);
    this.pos = pos;
    this.prevPos = pos;
    this.animal = animal;
  }

  get center() { return this.pos; }
  distance(p: Vec2) { return Math.max(0, this.pos.distance(p) - 0.3); }
  get typeId() { return this.def.id; }
  get name() { return this.def.name; }
  get isVillager() { return isWorker(this.def); }
  get isAnimal() { return this.animal !== null; }
  get isPriest() { return this.def.converts === true; }
}

/** One thing a building is working on: a unit, a technology, or the next age. */
export interface QueueItem { kind: "unit" | "tech" | "age"; id: string }

export class Building extends Entity {
  readonly footprint: Footprint;
  progress: number;
  complete: boolean;
  queue: QueueItem[] = [];
  queueTimer = 0;
  rally: Vec2 | null = null;
  /** Farms: food left, and the villager working it. */
  food: number;
  farmer: number | null = null;
  cooldown = 0;
  housingWarned = false;

  constructor(id: number, owner: number, public def: BuildingDef, origin: Tile, complete: boolean) {
    super(id, owner, def.hp);
    this.footprint = new Footprint(origin, def.size);
    this.progress = complete ? 1 : 0;
    this.complete = complete;
    this.food = def.resource?.food ?? 0;
    if (!complete) this.hp = 1;
  }

  get center() { return this.footprint.center; }
  distance(p: Vec2) { return this.footprint.distance(p); }
  get typeId() { return this.def.id; }
  get name() { return this.def.name; }
  get isFarm() { return this.def.resource?.food !== undefined; }
  get isWall() { return this.def.tags?.includes("wall") ?? false; }
  /** The age being researched here, if that is what it is doing. */
  get researching(): number | null {
    const h = this.queue[0];
    return h && h.kind === "age" ? Number(h.id) : null;
  }

  /** Whether this building takes a resource, and for food whether it takes this kind. */
  dropsOff(r: Res, kind: "plant" | "meat" | null = null) {
    if (!(this.def.drop_off?.some((k) => resFromKey(k) === r) ?? false)) return false;
    if (r !== Res.food || !this.def.food_kinds || kind === null) return true;
    return this.def.food_kinds.includes(kind);
  }
}

export class ResourceNode extends Entity {
  readonly res: Res;
  amount: number;
  /** Carcasses lie on the ground without blocking anyone, and rot. */
  readonly solid: boolean;
  readonly decay: number;
  readonly foodKind: "plant" | "meat" | null;
  /** Where a carcass lies; for everything else the tile centre. */
  readonly at: Vec2;

  constructor(id: number, readonly def: NodeDef, readonly tile: Tile, opts: { amount?: number; solid?: boolean; decay?: number; at?: Vec2 } = {}) {
    super(id, GAIA, 1);
    this.res = resFromKey(def.resource) ?? Res.food;
    this.amount = opts.amount ?? def.amount;
    this.solid = opts.solid ?? true;
    this.decay = opts.decay ?? 0;
    this.foodKind = this.res === Res.food ? def.food_kind ?? "plant" : null;
    this.at = opts.at ?? tile.center;
  }

  get center() { return this.at; }
  distance(p: Vec2) { return this.solid ? new Footprint(this.tile, 1).distance(p) : Math.max(0, this.at.distance(p) - 0.4); }
  get typeId() { return this.def.id; }
  get name() { return this.def.name; }
}

export class PlayerStats {
  gathered = new ResBag();
  trained = 0;
  kills = 0;
  lost = 0;
  built = 0;
  researched = 0;
  converted = 0;
}

export class Player {
  age = 0;
  pop = 0;
  popCap = 0;
  defeated = false;
  /** Gather speed multiplier. 1 for people; the hard AI gets an announced bonus. */
  gatherBonus = 1;
  stats = new PlayerStats();
  /** When this player's finished Wonder wins the game, if it stands. */
  wonderAt: number | null = null;
  /** Farms that run out are sown again at a farm's price, if there is the wood: AoE2's reseeding,
   *  as a game setting. Off by default, as in the original, where a spent farm is gone. */
  autoReseed = false;

  constructor(readonly id: number, readonly name: string, public res: ResBag, readonly mods: Mods) {}
  get civ() { return this.mods.civ; }
}

export type GameEvent =
  | { kind: "projectile"; from: Vec2; to: Vec2; flight: number; projectile: string }
  | { kind: "hit"; at: Vec2; melee: boolean; building: boolean }
  | { kind: "splash"; at: Vec2; radius: number }
  | { kind: "died"; id: number; owner: number; at: Vec2; wasBuilding: boolean }
  | { kind: "completed"; id: number; owner: number }
  | { kind: "trained"; id: number; owner: number }
  | { kind: "researched"; player: number; tech: string }
  | { kind: "converted"; id: number; from: number; to: number; at: Vec2 }
  | { kind: "message"; player: number; text: string }
  | { kind: "underAttack"; player: number; at: Vec2 }
  | { kind: "ageReached"; player: number; age: number }
  | { kind: "gameOver"; winner: number; how: "conquest" | "wonder" };
