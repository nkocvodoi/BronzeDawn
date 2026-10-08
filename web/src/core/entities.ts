import { Footprint, Tile, Vec2 } from "./geom";
import { BuildingDef, isWorker, NodeDef, Res, ResBag, resFromKey, UnitDef } from "./rules";

export const GAIA = -1;

export type Order =
  | { kind: "idle" }
  | { kind: "move"; to: Vec2; attackMove: boolean }
  | { kind: "gather"; id: number }
  | { kind: "return"; resume: number | null }
  | { kind: "build"; id: number }
  | { kind: "attack"; id: number };

export const IDLE: Order = { kind: "idle" };

/**
 * Anything on the map. Entities refer to each other by id, never by reference,
 * so a dead target is a lookup that fails instead of a dangling pointer.
 */
export abstract class Entity {
  hp: number;
  readonly maxHp: number;
  alive = true;

  constructor(readonly id: number, readonly owner: number, hp: number) {
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
  carry = 0;
  /** The resource this villager was last told to gather, to find more when a node runs out. */
  lastGather: Res | null = null;
  facing = new Vec2(1, 0);
  /** Gathering, building or striking this step (for animation). */
  busy = false;

  constructor(id: number, owner: number, readonly def: UnitDef, pos: Vec2) {
    super(id, owner, def.hp);
    this.pos = pos;
    this.prevPos = pos;
  }

  get center() { return this.pos; }
  distance(p: Vec2) { return Math.max(0, this.pos.distance(p) - 0.3); }
  get typeId() { return this.def.id; }
  get name() { return this.def.name; }
  get isVillager() { return isWorker(this.def); }
}

export class Building extends Entity {
  readonly footprint: Footprint;
  progress: number;
  complete: boolean;
  queue: string[] = [];
  queueTimer = 0;
  /** Age index being researched. */
  researching: number | null = null;
  researchTimer = 0;
  rally: Vec2 | null = null;
  /** Farms: food left. */
  food: number;
  cooldown = 0;
  housingWarned = false;

  constructor(id: number, owner: number, readonly def: BuildingDef, origin: Tile, complete: boolean) {
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
  dropsOff(r: Res) { return this.def.drop_off?.some((k) => resFromKey(k) === r) ?? false; }
}

export class ResourceNode extends Entity {
  readonly res: Res;
  amount: number;

  constructor(id: number, readonly def: NodeDef, readonly tile: Tile) {
    super(id, GAIA, 1);
    this.res = resFromKey(def.resource) ?? Res.food;
    this.amount = def.amount;
  }

  get center() { return this.tile.center; }
  distance(p: Vec2) { return new Footprint(this.tile, 1).distance(p); }
  get typeId() { return this.def.id; }
  get name() { return this.def.name; }
}

export class PlayerStats {
  gathered = new ResBag();
  trained = 0;
  kills = 0;
  lost = 0;
  built = 0;
}

export class Player {
  age = 0;
  pop = 0;
  popCap = 0;
  defeated = false;
  stats = new PlayerStats();
  constructor(readonly id: number, readonly name: string, public res: ResBag) {}
}

export type GameEvent =
  | { kind: "projectile"; from: Vec2; to: Vec2; flight: number }
  | { kind: "hit"; at: Vec2 }
  | { kind: "died"; id: number; owner: number; at: Vec2; wasBuilding: boolean }
  | { kind: "completed"; id: number; owner: number }
  | { kind: "trained"; id: number; owner: number }
  | { kind: "message"; player: number; text: string }
  | { kind: "underAttack"; player: number; at: Vec2 }
  | { kind: "ageReached"; player: number; age: number }
  | { kind: "gameOver"; winner: number };
