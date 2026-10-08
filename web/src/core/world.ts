import { AIController } from "./ai";
import { Building, Entity, GAIA, GameEvent, IDLE, Player, QueueItem, ResourceNode, Unit } from "./entities";
import { Fog } from "./fog";
import { Footprint, RNG, Tile, Vec2 } from "./geom";
import { GridMap, Terrain, walkable } from "./grid";
import { generateMap } from "./mapgen";
import { Pathfinder } from "./path";
import { NodeDef, RES_KEY, Res, ResBag, Rules, TechDef, UnitDef } from "./rules";
import { BuildingStats, Mods, UnitStats } from "./stats";

/** What a context (right) click turned into, so the UI can give feedback. */
export type SmartResult = "moved" | "attacked" | "gathered" | "built" | "returned" | "converted" | "healed" | "nothing";

/** Who fired, with what. Damage is worked out against each target at impact (splash hits several). */
interface Shot { attackerId: number; owner: number; attack: number; pierce: boolean; bonus?: Record<string, number> }
interface Missile { shot: Shot; targetId: number | null; at: Vec2 | null; area: number; remaining: number }

type Approach = "arrived" | "moving" | "blocked";

/** Group move offsets: lattice points sorted by distance. No trigonometry, so every browser agrees. */
const FORMATION: Vec2[] = (() => {
  const pts: Vec2[] = [];
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) pts.push(new Vec2(x * 0.75, y * 0.75));
  pts.sort((a, b) => a.length - b.length || a.y - b.y || a.x - b.x);
  return pts;
})();

export interface WorldOptions { civs?: (string | null)[] }

/**
 * The whole simulation. No rendering in here: it runs the same in the browser,
 * in tests, and in a headless AI-versus-AI match.
 */
export class World {
  static readonly dt = 0.05; // 20 steps a second

  readonly map: GridMap;
  readonly pathfinder: Pathfinder;
  readonly players: Player[] = [];
  units: Unit[] = [];
  buildings: Building[] = [];
  nodes: ResourceNode[] = [];
  readonly fog: Fog[] = [];
  time = 0;
  tick = 0;
  winner: number | null = null;
  events: GameEvent[] = [];
  ais: AIController[] = [];
  /** Start tile of each player's town center. */
  startTiles: Tile[] = [];

  rng: RNG;
  private byId = new Map<number, Entity>();
  private nextId = 1;
  private missiles: Missile[] = [];
  private alertTimer: number[] = [];
  private animalDefs = new Map<string, UnitDef>();
  private carcassDefs = new Map<string, NodeDef>();

  constructor(readonly rules: Rules, readonly seed: number, playerNames = ["You", "Enemy"], size = 72, generate = true,
              options: WorldOptions = {}) {
    this.rng = new RNG(seed);
    this.map = new GridMap(size, size);
    this.pathfinder = new Pathfinder(this.map);
    playerNames.forEach((n, i) => {
      const mods = new Mods(rules);
      const civId = options.civs?.[i];
      mods.setCiv(civId ? rules.civs.find((c) => c.id === civId) ?? null : null);
      this.players.push(new Player(i, n, ResBag.of(rules.economy.start), mods));
      this.fog.push(new Fog(size, size));
      this.alertTimer.push(0);
    });
    if (generate) generateMap(this);
    this.refreshPopulation();
    for (const p of this.players) this.fog[p.id].update(this, p.id);
  }

  // ---- lookup

  entity(id: number): Entity | null {
    const e = this.byId.get(id);
    return e && e.alive ? e : null;
  }
  unit(id: number) { const e = this.entity(id); return e instanceof Unit ? e : null; }
  building(id: number) { const e = this.entity(id); return e instanceof Building ? e : null; }
  node(id: number) { const e = this.entity(id); return e instanceof ResourceNode ? e : null; }

  unitsOf(p: number) { return this.units.filter((u) => u.alive && u.owner === p); }
  buildingsOf(p: number) { return this.buildings.filter((b) => b.alive && b.owner === p); }
  isEnemy(a: number, b: number) { return a !== b && a !== GAIA && b !== GAIA; }

  /** May something owned by `owner` attack `t`? Players hunt animals; animals fight players. */
  hostile(owner: number, t: Entity) {
    if (t instanceof Unit && t.isAnimal) return owner !== GAIA;
    if (owner === GAIA) return t.owner !== GAIA && !(t instanceof ResourceNode);
    return this.isEnemy(owner, t.owner);
  }

  // ---- stats after techs and civ bonuses

  stats(u: Unit): UnitStats {
    if (u.owner < 0) {
      const d = u.def;
      return { hp: d.hp, attack: d.attack, armor: d.armor, pierce_armor: d.pierce_armor, range: d.range, attack_cooldown: d.attack_cooldown,
        speed: d.speed, los: d.los, train_time: 0, pop: 0, cost: new ResBag() };
    }
    return this.players[u.owner].mods.unit(u.def);
  }
  unitStats(player: number, type: string) { return this.players[player].mods.unit(this.rules.units.get(type)!); }
  bstats(b: Building): BuildingStats { return this.players[Math.max(0, b.owner)].mods.building(b.def); }
  buildingStats(player: number, type: string) { return this.players[player].mods.building(this.rules.buildings.get(type)!); }
  unitCost(player: number, type: string) { return this.unitStats(player, type).cost; }
  buildingCost(player: number, type: string) { return this.buildingStats(player, type).cost; }

  // ---- creating things

  spawnUnit(type: string, owner: number, at: Vec2): Unit {
    const u = new Unit(this.nextId++, owner, this.rules.units.get(type)!, at);
    if (owner >= 0) u.hp = u.maxHp = this.stats(u).hp;
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  spawnAnimal(type: string, at: Vec2): Unit | null {
    const a = this.rules.animals.get(type);
    if (!a) return null;
    let def = this.animalDefs.get(type);
    if (!def) {
      def = { id: a.id, name: a.name, class: "animal", age: "stone", trained_at: "", cost: {}, train_time: 0, hp: a.hp,
        attack: a.attack, armor: a.armor, pierce_armor: 0, range: 0, attack_cooldown: a.attack_cooldown ?? 1.5, speed: a.speed,
        los: a.los, pop: 0, tags: ["animal"] };
      this.animalDefs.set(type, def);
    }
    const u = new Unit(this.nextId++, GAIA, def, at, a);
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  addBuilding(type: string, owner: number, origin: Tile, complete: boolean): Building {
    const b = new Building(this.nextId++, owner, this.rules.buildings.get(type)!, origin, complete);
    if (owner >= 0) {
      b.maxHp = this.bstats(b).hp;
      b.hp = complete ? b.maxHp : 1;
      if (b.isFarm) b.food = this.players[owner].mods.farmFood(b.def.resource!.food);
    }
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.map.setOccupant(b.footprint, b.id, !b.isFarm);
    if (!b.isFarm) this.nudgeUnits(b.footprint);
    return b;
  }

  addNode(type: string, tile: Tile): ResourceNode | null {
    const def = this.rules.nodes.get(type);
    if (!def) return null;
    if (def.on_water) {
      if (this.map.terrainAt(tile) !== Terrain.water || this.map.occupantAt(tile) !== 0) return null;
    } else if (!this.map.passable(tile) || this.map.occupantAt(tile) !== 0) return null;
    const n = new ResourceNode(this.nextId++, def, tile);
    this.nodes.push(n);
    this.byId.set(n.id, n);
    this.map.setOccupant(new Footprint(tile, 1), n.id);
    return n;
  }

  /** A hunted animal leaves meat where it fell. It does not block anyone, and it rots. */
  private addCarcass(a: Unit): ResourceNode {
    const animal = a.animal!;
    let def = this.carcassDefs.get(animal.id);
    if (!def) {
      def = { id: `carcass_${animal.id}`, name: `${animal.name} (meat)`, resource: "food", amount: animal.food, food_kind: "meat" };
      this.carcassDefs.set(animal.id, def);
    }
    const n = new ResourceNode(this.nextId++, def, a.pos.tile, { solid: false, decay: animal.decay, at: a.pos });
    this.nodes.push(n);
    this.byId.set(n.id, n);
    return n;
  }

  private nudgeUnits(fp: Footprint) {
    for (const u of this.units) {
      if (u.alive && fp.contains(u.pos.tile)) {
        const t = this.map.nearestPassable(u.pos.tile);
        if (t) { u.pos = t.center; u.prevPos = u.pos; u.path = []; }
      }
    }
  }

  // ---- what is open to a player

  private ageOf(id: string) { return this.rules.ageIndex(id); }

  /** The unit or building a type has been upgraded into, following the chain. */
  current(player: number, type: string) {
    const up = this.players[player].mods.upgraded;
    let t = type;
    for (let i = 0; i < 8 && up.has(t); i++) t = up.get(t)!;
    return t;
  }

  canPlace(type: string, origin: Tile, player: number | null = null) {
    const def = this.rules.buildings.get(type);
    if (!def) return false;
    for (const t of new Footprint(origin, def.size).tiles()) {
      if (!this.map.inside(t) || !walkable(this.map.terrainAt(t)) || this.map.occupantAt(t) !== 0) return false;
      if (player !== null && !this.fog[player].isExplored(t)) return false;
    }
    return true;
  }

  /** Why the player cannot place this building now, or null when they can. */
  blockerBuilding(type: string, player: number): string | null {
    const def = this.rules.buildings.get(type);
    if (!def) return "unknown building";
    const p = this.players[player];
    if (p.mods.disabled.has(type)) return `Not available to the ${p.civ?.name}`;
    if (p.mods.upgraded.has(type)) return "Replaced by an upgrade";
    if (this.ageOf(def.age) > p.age) return `Needs ${this.rules.ages[this.ageOf(def.age)].name}`;
    if (def.requires_tech && !p.mods.has(def.requires_tech)) return `Research ${this.rules.techs.get(def.requires_tech)?.name ?? def.requires_tech}`;
    for (const req of def.requires ?? []) {
      if (!this.buildingsOf(player).some((b) => b.def.id === req && b.complete)) return `Needs a ${this.rules.buildings.get(req)?.name ?? req}`;
    }
    // More than one Town Center needs a Government Center.
    if (type === "town_center" && this.buildingsOf(player).some((b) => b.def.id === "town_center") &&
        !this.buildingsOf(player).some((b) => b.def.id === "government_center" && b.complete)) return "Needs a Government Center";
    if (!p.res.covers(this.buildingCost(player, type))) return "Not enough resources";
    return null;
  }

  blockerUnit(type: string, player: number): string | null {
    const def = this.rules.units.get(type);
    if (!def) return "unknown unit";
    const p = this.players[player];
    if (p.mods.disabled.has(type) || p.mods.disabled.has(def.trained_at)) return `Not available to the ${p.civ?.name}`;
    if (p.mods.upgraded.has(type)) return "Replaced by an upgrade";
    if (this.ageOf(def.age) > p.age) return `Needs ${this.rules.ages[this.ageOf(def.age)].name}`;
    if (def.requires_tech && !p.mods.has(def.requires_tech)) return `Research ${this.rules.techs.get(def.requires_tech)?.name ?? def.requires_tech}`;
    if (!p.res.covers(this.unitCost(player, type))) return "Not enough resources";
    return null;
  }

  /** Whether a unit type shows up at all for this player right now (not replaced, not disabled). */
  unitShown(type: string, player: number) {
    const def = this.rules.units.get(type);
    const p = this.players[player];
    if (!def || p.mods.disabled.has(type) || p.mods.upgraded.has(type)) return false;
    // An upgrade target shows once researched; a plain unit shows from its age on.
    const isUpgrade = [...this.rules.techs.values()].some((t) => t.effects.some((e) => e.type === "upgrade" && e.to === type));
    if (isUpgrade) return def.requires_tech ? p.mods.has(def.requires_tech) : true;
    return this.ageOf(def.age) <= p.age;
  }

  buildingShown(type: string, player: number) {
    const def = this.rules.buildings.get(type);
    const p = this.players[player];
    if (!def || p.mods.disabled.has(type) || p.mods.upgraded.has(type)) return false;
    const isUpgrade = [...this.rules.techs.values()].some((t) => t.effects.some((e) => e.type === "upgrade" && e.to === type));
    if (isUpgrade) return def.requires_tech ? p.mods.has(def.requires_tech) : false;
    return true;
  }

  private techQueued(player: number, id: string) {
    return this.buildings.some((b) => b.alive && b.owner === player && b.queue.some((q) => q.kind === "tech" && q.id === id));
  }

  /** Why the player cannot research this now, or null. */
  blockerTech(id: string, player: number): string | null {
    const t = this.rules.techs.get(id);
    if (!t) return "unknown technology";
    const p = this.players[player];
    if (p.mods.has(id)) return "Already researched";
    if (this.techQueued(player, id)) return "Already researching";
    if (p.mods.disabled.has(id) || p.mods.disabled.has(t.building)) return `Not available to the ${p.civ?.name}`;
    if (this.ageOf(t.age) > p.age) return `Needs ${this.rules.ages[this.ageOf(t.age)].name}`;
    for (const r of t.requires) if (!p.mods.has(r)) return `Research ${this.rules.techs.get(r)?.name ?? r} first`;
    if (!p.res.covers(ResBag.of(t.cost))) return "Not enough resources";
    return null;
  }

  /** Techs this building offers that the player has not got, in rules order. */
  techsAt(b: Building, player: number): TechDef[] {
    const p = this.players[player];
    return this.rules.techOrder.map((id) => this.rules.techs.get(id)!).filter((t) =>
      t.building === b.def.id && !p.mods.has(t.id) && !p.mods.disabled.has(t.id) &&
      this.ageOf(t.age) <= p.age + 1 && t.requires.every((r) => p.mods.has(r) || this.ageOf(this.rules.techs.get(r)?.age ?? "stone") <= p.age + 1));
  }

  /** Distinct finished buildings of the kinds that count toward the next age. */
  ageRequirementCount(player: number) {
    const p = this.players[player];
    const next = this.rules.ages[p.age + 1];
    const from = next?.requires_from;
    const kinds = new Set<string>();
    for (const b of this.buildingsOf(player)) {
      if (!b.complete) continue;
      if (from ? from.includes(b.def.id) : b.def.id !== "town_center" && b.def.id !== "house" && this.ageOf(b.def.age) <= p.age) kinds.add(b.def.id);
    }
    return kinds.size;
  }

  blockerForNextAge(player: number): string | null {
    const p = this.players[player];
    if (p.age + 1 >= this.rules.ages.length) return "Already in the last age";
    if (this.buildings.some((b) => b.alive && b.owner === player && b.queue.some((q) => q.kind === "age"))) return "Already advancing";
    const next = this.rules.ages[p.age + 1];
    const need = next.requires_buildings ?? 0;
    const have = this.ageRequirementCount(player);
    if (have < need) {
      const names = (next.requires_from ?? []).map((id) => this.rules.buildings.get(id)?.name ?? id).join(", ");
      return `Needs ${need} different buildings${names ? ` (${names})` : ""}: ${have} built`;
    }
    if (!p.res.covers(ResBag.of(next.cost))) return "Not enough resources";
    return null;
  }

  private itemTime(b: Building, q: QueueItem) {
    const owner = Math.max(0, b.owner);
    if (q.kind === "age") return this.rules.ages[Number(q.id)].research_time ?? 60;
    if (q.kind === "tech") return this.rules.techs.get(q.id)?.time ?? 30;
    return this.unitStats(owner, q.id).train_time;
  }

  trainProgress(b: Building) {
    const q = b.queue[0];
    return q ? Math.min(1, b.queueTimer / this.itemTime(b, q)) : 0;
  }

  // ---- commands. The player and the AI both go through these.

  private own(ids: number[], player: number): Unit[] {
    return ids.map((i) => this.unit(i)).filter((u): u is Unit => u !== null && u.owner === player);
  }

  move(player: number, ids: number[], target: Vec2, attackMove = false) {
    this.own(ids, player).forEach((u, i) => {
      let dest = target.add(FORMATION[Math.min(i, FORMATION.length - 1)]);
      if (!this.map.passable(dest.tile)) {
        const t = this.map.nearestPassable(dest.tile, 4);
        if (t) dest = t.center;
      }
      u.resumeMove = null;
      u.buildQueue = [];
      const goal = dest.tile;
      u.path = this.pathfinder.find(u.pos, dest, (t) => t.equals(goal));
      if (u.path.length) {
        // Finish on the exact point only when it was reached and the last leg is clear;
        // otherwise stop at the closest tile (the shore of a lake, the edge of a wall).
        const before = u.path.length > 1 ? u.path[u.path.length - 2] : u.pos;
        if (this.pathfinder.reached && this.map.clearLine(before, dest)) u.path[u.path.length - 1] = dest;
        else dest = u.path[u.path.length - 1];
      } else if (!this.pathfinder.reached) dest = u.pos;
      u.order = { kind: "move", to: dest, attackMove: attackMove && !u.isVillager };
      u.pathTarget = dest;
    });
  }

  stop(player: number, ids: number[]) {
    for (const u of this.own(ids, player)) { u.order = IDLE; u.path = []; u.resumeMove = null; u.buildQueue = []; }
  }

  attack(player: number, ids: number[], target: number) {
    const t = this.entity(target);
    if (!t || !this.hostile(player, t)) return;
    for (const u of this.own(ids, player)) {
      if (u.isPriest) continue;
      u.order = { kind: "attack", id: t.id };
      u.resumeMove = null; u.path = []; u.repathTimer = 0;
    }
  }

  convert(player: number, ids: number[], target: number) {
    const t = this.entity(target);
    if (!t || !this.isEnemy(player, t.owner)) return;
    for (const u of this.own(ids, player)) {
      if (!u.isPriest) continue;
      u.order = { kind: "convert", id: t.id };
      u.chants = 0; u.path = []; u.repathTimer = 0;
    }
  }

  heal(player: number, ids: number[], target: number) {
    const t = this.unit(target);
    if (!t || t.owner !== player) return;
    for (const u of this.own(ids, player)) if (u.isPriest && u !== t) { u.order = { kind: "heal", id: t.id }; u.path = []; u.repathTimer = 0; }
  }

  gather(player: number, ids: number[], target: number) {
    const e = this.entity(target);
    let res: Res;
    if (e instanceof ResourceNode) res = e.res;
    else if (e instanceof Building && e.isFarm && e.owner === player) res = Res.food;
    else return;
    for (const u of this.own(ids, player)) {
      if (!u.isVillager) continue;
      u.order = { kind: "gather", id: e.id };
      u.lastGather = res;
      u.lastNodeType = e instanceof ResourceNode ? e.def.id : "farm";
      u.path = []; u.repathTimer = 0; u.buildQueue = [];
    }
  }

  build(player: number, ids: number[], target: number, queue: number[] = []) {
    const b = this.building(target);
    if (!b || b.owner !== player) return;
    for (const u of this.own(ids, player)) {
      if (!u.isVillager) continue;
      u.order = { kind: "build", id: b.id };
      u.buildQueue = [...queue];
      u.path = []; u.repathTimer = 0;
    }
  }

  /** The right click: attack, hunt, convert, heal, gather, build or farm your own building, or move. */
  smart(player: number, ids: number[], target: number | null, at: Vec2): SmartResult {
    const group = this.own(ids, player);
    if (!group.length) return "nothing";
    const e = target !== null ? this.entity(target) : null;
    if (!e) { this.move(player, ids, at); return "moved"; }
    const priests = group.filter((u) => u.isPriest).map((u) => u.id);
    const rest = group.filter((u) => !u.isPriest);
    let result: SmartResult = "moved";
    if (priests.length) {
      if (this.isEnemy(player, e.owner)) { this.convert(player, priests, e.id); result = "converted"; }
      else if (e instanceof Unit && e.owner === player && e.hp < e.maxHp) { this.heal(player, priests, e.id); result = "healed"; }
      else this.move(player, priests, at);
    }
    if (!rest.length) return result;
    if (this.hostile(player, e)) { this.attack(player, rest.map((u) => u.id), e.id); return "attacked"; }
    const villagers = rest.filter((u) => u.isVillager).map((u) => u.id);
    const movers = rest.filter((u) => !u.isVillager).map((u) => u.id);
    if (villagers.length) {
      if (e instanceof ResourceNode) { this.gather(player, villagers, e.id); result = "gathered"; }
      else if (e instanceof Building && e.owner === player) {
        if (!e.complete) { this.build(player, villagers, e.id); result = "built"; }
        else if (e.isFarm) { this.gather(player, villagers, e.id); result = "gathered"; }
        else {
          const carriers = villagers.filter((id) => {
            const u = this.unit(id);
            return !!u && u.carry > 0 && u.carryRes !== null && e.dropsOff(u.carryRes, u.carryKind);
          });
          for (const id of carriers) { const u = this.unit(id)!; u.order = { kind: "return", resume: null, drop: e.id }; u.path = []; }
          movers.push(...villagers.filter((id) => !carriers.includes(id)));
          if (carriers.length) result = "returned";
        }
      } else movers.push(...villagers);
    }
    // One move for everyone left, so they share one formation instead of piling up.
    if (movers.length) this.move(player, movers, at);
    return result;
  }

  /** Places a building and sends the builders. Returns the new building's id, or why not. */
  place(player: number, type: string, origin: Tile, builders: number[]): { id: number } | { error: string } {
    const why = this.blockerBuilding(type, player);
    if (why) return { error: why };
    if (!this.canPlace(type, origin, player)) return { error: "Cannot build there" };
    this.players[player].res.spend(this.buildingCost(player, type));
    const b = this.addBuilding(type, player, origin, false);
    this.build(player, builders, b.id);
    return { id: b.id };
  }

  /** Tiles of a wall dragged from a to b: a 4-connected line, at most 40 long. */
  wallTiles(a: Tile, b: Tile): Tile[] {
    const out: Tile[] = [];
    let x = a.x, y = a.y;
    out.push(new Tile(x, y));
    while ((x !== b.x || y !== b.y) && out.length < 40) {
      const dx = b.x - x, dy = b.y - y;
      if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx); else y += Math.sign(dy);
      out.push(new Tile(x, y));
    }
    return out;
  }

  /** Lays a row of wall foundations; builders work along it. */
  placeWall(player: number, type: string, a: Tile, b: Tile, builders: number[]): { placed: number } | { error: string } {
    const why = this.blockerBuilding(type, player);
    if (why) return { error: why };
    const cost = this.buildingCost(player, type);
    const ids: number[] = [];
    for (const t of this.wallTiles(a, b)) {
      if (!this.canPlace(type, t, player) || !this.players[player].res.covers(cost)) continue;
      this.players[player].res.spend(cost);
      ids.push(this.addBuilding(type, player, t, false).id);
    }
    if (!ids.length) return { error: "Cannot build there" };
    this.build(player, builders, ids[0], ids.slice(1));
    return { placed: ids.length };
  }

  train(player: number, buildingId: number, type: string): string | null {
    const b = this.building(buildingId);
    if (!b || b.owner !== player || !b.complete) return "No building";
    if (!b.def.trains?.includes(type)) return "Cannot train that here";
    const why = this.blockerUnit(type, player);
    if (why) return why;
    if (b.queue.length >= 5) return "Queue is full";
    this.players[player].res.spend(this.unitCost(player, type));
    b.queue.push({ kind: "unit", id: type });
    return null;
  }

  research(player: number, buildingId: number, techId: string): string | null {
    const b = this.building(buildingId);
    const t = this.rules.techs.get(techId);
    if (!b || !t || b.owner !== player || !b.complete) return "No building";
    if (t.building !== b.def.id) return "Cannot research that here";
    const why = this.blockerTech(techId, player);
    if (why) return why;
    if (b.queue.length >= 5) return "Queue is full";
    this.players[player].res.spend(ResBag.of(t.cost));
    b.queue.push({ kind: "tech", id: techId });
    return null;
  }

  cancel(player: number, buildingId: number) {
    const b = this.building(buildingId);
    if (!b || b.owner !== player || !b.queue.length) return;
    const q = b.queue.pop()!;
    const p = this.players[player];
    if (q.kind === "unit") p.res.add(this.unitCost(player, q.id));
    else if (q.kind === "tech") p.res.add(ResBag.of(this.rules.techs.get(q.id)?.cost));
    else p.res.add(ResBag.of(this.rules.ages[Number(q.id)].cost));
    if (!b.queue.length) b.queueTimer = 0;
  }

  advanceAge(player: number, buildingId: number): string | null {
    const b = this.building(buildingId);
    if (!b || b.owner !== player || !b.complete || b.def.id !== "town_center") return "Only a Town Center can advance";
    const why = this.blockerForNextAge(player);
    if (why) return why;
    if (b.queue.length >= 5) return "Queue is full";
    const next = this.players[player].age + 1;
    this.players[player].res.spend(ResBag.of(this.rules.ages[next].cost));
    b.queue.push({ kind: "age", id: String(next) });
    return null;
  }

  setRally(player: number, buildingId: number, to: Vec2) {
    const b = this.building(buildingId);
    if (b && b.owner === player) b.rally = to;
  }

  /** The Delete key. An unfinished foundation gives back half of the part not yet built, as in the original. */
  destroy(player: number, id: number) {
    const e = this.entity(id);
    if (!e || e.owner !== player) return;
    if (e instanceof Building && !e.complete) {
      const back = this.buildingCost(player, e.def.id);
      const out = new ResBag();
      for (let i = 0; i < 4; i++) out.values[i] = Math.floor(back.values[i] * (1 - e.progress) * 0.5);
      this.players[player].res.add(out);
    }
    this.kill(e, 0);
  }

  // ---- technologies

  private applyTech(p: Player, t: TechDef) {
    p.mods.research(t);
    p.stats.researched++;
    for (const e of t.effects) {
      if (e.type !== "upgrade") continue;
      const toUnit = this.rules.units.get(e.to), toBuilding = this.rules.buildings.get(e.to);
      for (const u of this.units) if (u.alive && u.owner === p.id && u.def.id === e.from && toUnit) u.def = toUnit;
      for (const b of this.buildings) if (b.alive && b.owner === p.id && b.def.id === e.from && toBuilding) b.def = toBuilding;
      for (const b of this.buildings) if (b.alive && b.owner === p.id) for (const q of b.queue) if (q.kind === "unit" && q.id === e.from) q.id = e.to;
    }
    this.refreshHp(p.id);
    this.events.push({ kind: "researched", player: p.id, tech: t.id });
    this.events.push({ kind: "message", player: p.id, text: `${t.name} researched` });
  }

  /** After a tech or a conversion, hit points follow the new maximum, keeping the same share. */
  private refreshHp(player: number) {
    for (const u of this.units) {
      if (!u.alive || u.owner !== player) continue;
      const max = this.stats(u).hp;
      if (max !== u.maxHp) { u.hp = (u.hp / u.maxHp) * max; u.maxHp = max; }
    }
    for (const b of this.buildings) {
      if (!b.alive || b.owner !== player || !b.complete) continue;
      const max = this.bstats(b).hp;
      if (max !== b.maxHp) { b.hp = (b.hp / b.maxHp) * max; b.maxHp = max; }
    }
  }

  // ---- the step

  step() {
    const dt = World.dt;
    this.tick++;
    this.time += dt;
    for (const u of this.units) if (u.alive) { u.prevPos = u.pos; u.busy = false; }
    for (let i = 0; i < this.alertTimer.length; i++) this.alertTimer[i] -= dt;

    if (this.winner === null) {
      for (const ai of this.ais) if (this.tick % 20 === (ai.player * 7) % 20) ai.think(this);
    }
    for (const b of this.buildings) if (b.alive) this.updateBuilding(b, dt);
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    for (const n of this.nodes) {
      if (n.alive && n.decay > 0) { n.amount -= n.decay * dt; if (n.amount <= 0) this.removeNode(n); }
    }
    this.updateMissiles(dt);
    this.separate();
    this.compact();
    this.refreshPopulation();
    if (this.tick % 5 === 0) for (const p of this.players) this.fog[p.id].update(this, p.id);
    if (this.tick % 20 === 0) this.checkDefeat();
  }

  refreshPopulation() {
    for (const p of this.players) { p.pop = 0; p.popCap = 0; }
    for (const u of this.units) if (u.alive && u.owner >= 0) this.players[u.owner].pop += this.stats(u).pop;
    for (const b of this.buildings) if (b.alive && b.complete && b.owner >= 0) this.players[b.owner].popCap += b.def.pop_provided ?? 0;
    for (const p of this.players) p.popCap = Math.min(p.popCap, this.rules.economy.pop_max);
  }

  private compact() {
    if (this.units.some((u) => !u.alive)) this.units = this.units.filter((u) => u.alive);
    if (this.buildings.some((b) => !b.alive)) this.buildings = this.buildings.filter((b) => b.alive);
    if (this.nodes.some((n) => !n.alive)) this.nodes = this.nodes.filter((n) => n.alive);
  }

  /** Conquest: every unit and every building but walls gone. Or a Wonder that stood long enough. */
  private checkDefeat() {
    if (this.winner !== null) return;
    for (const p of this.players) {
      if (p.defeated) continue;
      const hasUnits = this.units.some((u) => u.alive && u.owner === p.id);
      const hasBuildings = this.buildings.some((b) => b.alive && b.owner === p.id && !b.isWall);
      if (!hasUnits && !hasBuildings) {
        p.defeated = true;
        this.events.push({ kind: "message", player: -1, text: `${p.name} has been defeated` });
      }
      if (p.wonderAt !== null && this.time >= p.wonderAt && !p.defeated) {
        this.winner = p.id;
        this.events.push({ kind: "gameOver", winner: p.id, how: "wonder" });
        return;
      }
    }
    const left = this.players.filter((p) => !p.defeated);
    if (left.length <= 1) {
      this.winner = left.length ? left[0].id : -1;
      this.events.push({ kind: "gameOver", winner: this.winner, how: "conquest" });
    }
  }

  // ---- buildings

  private updateBuilding(b: Building, dt: number) {
    if (!b.complete || b.owner < 0) return;
    const p = this.players[b.owner];
    const q = b.queue[0];
    if (q) {
      if (q.kind === "unit") {
        const type = this.current(p.id, q.id);
        q.id = type;
        const st = this.unitStats(p.id, type);
        if (p.pop + st.pop > p.popCap + 1e-9) {
          if (!b.housingWarned) {
            b.housingWarned = true;
            this.events.push({ kind: "message", player: p.id, text: "Need more houses" });
          }
        } else {
          b.housingWarned = false;
          b.queueTimer += dt;
          if (b.queueTimer >= st.train_time) {
            b.queue.shift();
            b.queueTimer = 0;
            const u = this.spawnUnit(type, p.id, this.exitTile(b, b.rally).center);
            p.pop += st.pop;
            p.stats.trained++;
            this.events.push({ kind: "trained", id: u.id, owner: p.id });
            if (b.rally) {
              const node = this.node(this.map.occupantAt(b.rally.tile));
              if (u.isVillager && node) this.gather(p.id, [u.id], node.id);
              else this.move(p.id, [u.id], b.rally);
            }
          }
        }
      } else {
        b.queueTimer += dt;
        if (b.queueTimer >= this.itemTime(b, q)) {
          b.queue.shift();
          b.queueTimer = 0;
          if (q.kind === "age") {
            const age = Number(q.id);
            p.age = Math.max(p.age, age);
            this.refreshHp(p.id);
            this.events.push({ kind: "ageReached", player: p.id, age });
            this.events.push({ kind: "message", player: p.id, text: `${p.name} reached the ${this.rules.ages[age].name}` });
          } else {
            const t = this.rules.techs.get(q.id);
            if (t && !p.mods.has(t.id)) this.applyTech(p, t);
          }
        }
      }
    }
    if (b.def.attack !== undefined && b.def.range !== undefined) {
      b.cooldown -= dt;
      if (b.cooldown <= 0) {
        const st = this.bstats(b);
        const t = this.nearestEnemyUnit(b.owner, b.center, st.range + b.def.size / 2);
        if (t) {
          this.fire(b.center, { attackerId: b.id, owner: b.owner, attack: st.attack, pierce: true }, t, 0, b.def.projectile ?? "arrow");
          b.cooldown = b.def.attack_cooldown ?? 2;
        }
      }
    }
  }

  private exitTile(b: Building, toward: Vec2 | null): Tile {
    const fp = b.footprint;
    let best: Tile | null = null, bestD = Infinity;
    const aim = toward ?? new Vec2(fp.maxX + 1, fp.maxY + 1);
    for (let y = fp.origin.y - 1; y <= fp.origin.y + fp.size; y++) {
      for (let x = fp.origin.x - 1; x <= fp.origin.x + fp.size; x++) {
        const t = new Tile(x, y);
        if (fp.contains(t) || !this.map.passable(t)) continue;
        const d = t.center.distance(aim);
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    return best ?? this.map.nearestPassable(fp.origin, 8) ?? fp.origin;
  }

  // ---- units

  /** Walks u toward entity e until within reach of its edge. */
  private approach(u: Unit, e: Entity, reach: number, dt: number): Approach {
    if (e.distance(u.pos) <= reach + 0.05) { u.path = []; return "arrived"; }
    u.repathTimer -= dt;
    const goal = e.center;
    const stale = u.pathTarget ? u.pathTarget.distance(goal) > 1.0 : true;
    if (!u.path.length || (stale && u.repathTimer <= 0)) {
      if (u.repathTimer > 0 && !u.path.length) return "moving"; // waiting out a failed search
      this.pathfinder.maxExpanded = 4000; // approaching something nearby should never search the whole map
      u.path = this.pathfinder.find(u.pos, goal, (t) => e.distance(t.center) <= reach);
      this.pathfinder.maxExpanded = 9000;
      u.pathTarget = goal;
      u.repathTimer = 0.6 + (u.id % 7) * 0.05;
      if (!u.path.length) {
        // Already on a goal tile: step to its center, which is in reach.
        const here = u.pos.tile;
        if (!this.map.passable(here) || e.distance(here.center) > reach) return "blocked";
        u.path = [here.center];
      }
    }
    this.followPath(u, dt);
    return "moving";
  }

  private followPath(u: Unit, dt: number): boolean {
    let budget = this.stats(u).speed * dt;
    while (budget > 0 && u.path.length) {
      const next = u.path[0];
      if (this.map.solidAt(next.tile)) {
        u.path = []; u.repathTimer = 0;
        return true;
      }
      const d = next.sub(u.pos);
      const len = d.length;
      if (len <= budget) {
        u.pos = next;
        u.path.shift();
        budget -= len;
      } else {
        u.facing = d.mul(1 / len);
        u.pos = u.pos.add(d.mul(budget / len));
        budget = 0;
      }
    }
    return !u.path.length;
  }

  private face(u: Unit, p: Vec2) {
    const d = p.sub(u.pos);
    if (d.length > 0.01) u.facing = d.mul(1 / d.length);
  }

  /** Auto-targets for a soldier: enemies, and wild animals that attack, but not gazelles or elephants. */
  private scanFor(u: Unit, radius: number): Entity | null {
    const skip = this.skipFor(u);
    return this.nearestEnemy(u.owner, u.pos, radius, (e) =>
      (skip?.(e) ?? false) ||
      (e instanceof Unit && e.isAnimal && e.animal!.behavior !== "aggressive") ||
      (u.def.ignores_villagers === true && e instanceof Unit && e.isVillager));
  }

  private updateUnit(u: Unit, dt: number) {
    u.cooldown -= dt;
    u.scanTimer -= dt;
    if (u.isAnimal) { this.updateAnimal(u, dt); return; }
    if (u.isPriest && u.faith < 100) {
      u.faith = Math.min(100, u.faith + 2 * this.players[u.owner].mods.conversionRegen * dt);
    }
    const o = u.order;
    switch (o.kind) {
      case "idle":
        if (u.scanTimer <= 0) {
          u.scanTimer = 0.5;
          if (u.isPriest) {
            const hurt = this.units.find((w) => w.alive && w.owner === u.owner && w !== u && !w.isAnimal && w.hp < w.maxHp && w.pos.distance(u.pos) < 6);
            if (hurt) u.order = { kind: "heal", id: hurt.id };
          } else if (!u.isVillager) {
            const t = this.scanFor(u, this.stats(u).los);
            if (t) u.order = { kind: "attack", id: t.id };
          }
        }
        break;

      case "move": {
        if (o.attackMove && u.scanTimer <= 0) {
          u.scanTimer = 0.5;
          const t = this.scanFor(u, this.stats(u).los);
          if (t) {
            u.resumeMove = o.to;
            u.order = { kind: "attack", id: t.id };
            u.path = [];
            return;
          }
        }
        if (!u.path.length) {
          if (u.pos.distance(o.to) <= 0.15) { u.order = IDLE; return; }
          if (this.map.clearLine(u.pos, o.to)) u.path = [o.to];
          else {
            // Something was built across the way: find a new path, no more than twice a second.
            u.repathTimer -= dt;
            if (u.repathTimer > 0) return;
            u.repathTimer = 0.5;
            const goal = o.to.tile;
            u.path = this.pathfinder.find(u.pos, o.to, (t) => t.equals(goal));
            if (!u.path.length) { u.order = IDLE; return; }
          }
        }
        if (this.followPath(u, dt)) u.order = IDLE;
        break;
      }

      case "gather": this.updateGather(u, o.id, dt); break;
      case "return": this.updateReturn(u, o.resume, dt, o.drop); break;
      case "build": this.updateBuild(u, o.id, dt); break;
      case "attack": this.updateAttack(u, o.id, dt); break;
      case "convert": this.updateConvert(u, o.id, dt); break;
      case "heal": this.updateHeal(u, o.id, dt); break;
    }
  }

  private updateAttack(u: Unit, id: number, dt: number) {
    const t = this.entity(id);
    if (!t || !this.hostile(u.owner, t)) {
      if (u.resumeMove) {
        const m = u.resumeMove;
        u.resumeMove = null;
        this.move(u.owner, [u.id], m, true);
      } else { u.order = IDLE; u.scanTimer = 0; }
      return;
    }
    // Hitting a building while soldiers attack you is how armies die: turn to face them.
    if (t instanceof Building && u.scanTimer <= 0 && !u.isVillager) {
      u.scanTimer = 0.5;
      const threat = this.nearestEnemyUnit(u.owner, u.pos, this.stats(u).los);
      if (threat) { u.order = { kind: "attack", id: threat.id }; u.path = []; u.repathTimer = 0; return; }
    }
    const st = this.stats(u);
    // Villagers hunt with thrown spears; everyone else uses their own weapon.
    const hunting = u.isVillager && t instanceof Unit && t.isAnimal;
    const reach = hunting ? 3 : st.range > 0 ? st.range : 0.9;
    const a = this.approach(u, t, reach, dt);
    if (a === "arrived") {
      this.face(u, t.center);
      u.busy = true;
      if (u.cooldown <= 0) {
        u.cooldown = st.attack_cooldown;
        const ranged = hunting || st.range > 0;
        const pierce = u.def.damage ? u.def.damage === "pierce" : ranged;
        const shot: Shot = { attackerId: u.id, owner: u.owner, attack: hunting ? 4 : st.attack, pierce, bonus: u.def.bonus };
        if (ranged) this.fire(u.pos, shot, t, u.def.area ?? 0, hunting ? "spear" : u.def.projectile ?? "arrow");
        else {
          this.hit(t, shot);
          if (u.def.trample) this.trample(u, t, shot, u.def.trample);
        }
      }
    } else if (a === "blocked") {
      u.unreachable = { id: t.id, until: this.time + 10 };
      u.order = IDLE;
    }
  }

  /** Elephants and scythe chariots also hit every enemy close to their target. */
  private trample(u: Unit, target: Entity, shot: Shot, radius: number) {
    for (const o of this.units) {
      if (o === target || !o.alive || !this.hostile(u.owner, o) || o.isAnimal) continue;
      if (o.pos.distance(target.center) <= radius) this.hit(o, shot);
    }
  }

  /** Priests chant; after a few chants each one may convert. Faith must be full to start and drops to 0 after. */
  private updateConvert(u: Unit, id: number, dt: number) {
    const t = this.entity(id);
    const mods = this.players[u.owner].mods;
    const ok = (e: Entity | null): e is Entity => {
      if (!e || !this.isEnemy(u.owner, e.owner) || e instanceof ResourceNode) return false;
      if (e instanceof Building) return mods.flags.has("monotheism") && !["town_center", "wonder"].includes(e.def.id) && !e.isWall;
      if (e instanceof Unit && e.isPriest) return mods.flags.has("monotheism");
      return true;
    };
    if (!ok(t)) { u.order = IDLE; return; }
    const reach = t instanceof Building ? 1 : this.stats(u).range;
    const a = this.approach(u, t, reach, dt);
    if (a === "blocked") { u.order = IDLE; return; }
    if (a !== "arrived") return;
    this.face(u, t.center);
    if (u.faith < 100) return; // waiting for faith to come back
    u.busy = true;
    if (u.cooldown > 0) return;
    u.cooldown = 1.5;
    u.chants++;
    if (u.chants > 100) { u.order = IDLE; return; }
    if (u.chants < 3) return;
    const resist = (t instanceof Unit ? t.def.convert_resist ?? 1 : 2) * this.players[t.owner].mods.conversionResist;
    if (this.rng.unit() < (0.3 * mods.conversionChance) / resist) this.convertEntity(t, u);
  }

  private convertEntity(t: Entity, priest: Unit) {
    const from = t.owner;
    t.owner = priest.owner;
    priest.faith = 0;
    priest.chants = 0;
    priest.order = IDLE;
    if (t instanceof Unit) { t.order = IDLE; t.path = []; t.buildQueue = []; }
    if (t instanceof Building) { t.queue = []; t.queueTimer = 0; }
    this.refreshHp(t.owner);
    this.players[priest.owner].stats.converted++;
    this.events.push({ kind: "converted", id: t.id, from, to: t.owner, at: t.center });
    this.events.push({ kind: "message", player: from, text: `Your ${t.name} was converted` });
    this.events.push({ kind: "message", player: t.owner, text: `${t.name} converted` });
  }

  private updateHeal(u: Unit, id: number, dt: number) {
    const t = this.unit(id);
    if (!t || t.owner !== u.owner || t.hp >= t.maxHp) { u.order = IDLE; u.scanTimer = 0; return; }
    const a = this.approach(u, t, 1.2, dt);
    if (a === "blocked") { u.order = IDLE; return; }
    if (a !== "arrived") return;
    this.face(u, t.center);
    u.busy = true;
    t.hp = Math.min(t.maxHp, t.hp + (u.def.heal ?? 3) * this.players[u.owner].mods.healMul * dt);
  }

  // ---- animals

  /** Gazelles run, elephants defend themselves, lions and alligators hunt whatever comes near. */
  private updateAnimal(u: Unit, dt: number) {
    const a = u.animal!;
    if (u.order.kind === "attack") {
      const t = this.entity(u.order.id);
      if (t && t.alive && t.center.distance(u.pos) < a.los * 2.5) { this.updateAttack(u, u.order.id, dt); return; }
      u.order = IDLE;
    }
    if (u.order.kind === "move") {
      if (!u.path.length || this.followPath(u, dt)) u.order = IDLE;
      if (u.fleeTimer > 0) u.fleeTimer -= dt;
      return;
    }
    if (u.scanTimer > 0) return;
    u.scanTimer = 0.5 + (u.id % 5) * 0.05;
    const near = this.nearestPlayerUnit(u.pos, a.behavior === "flee" ? 3 : a.los);
    if (near && a.behavior === "aggressive") { u.order = { kind: "attack", id: near.id }; return; }
    if (near && a.behavior === "flee") { this.flee(u, near.pos); return; }
    // Wander a little, now and then.
    if (this.rng.unit() < 0.08) {
      const t = new Vec2(u.pos.x + this.rng.int(-3, 3), u.pos.y + this.rng.int(-3, 3));
      if (this.map.passable(t.tile)) this.move(GAIA, [u.id], t);
    }
  }

  private flee(u: Unit, from: Vec2) {
    const d = u.pos.sub(from);
    const len = Math.max(0.1, d.length);
    let to = u.pos.add(d.mul(4 / len));
    if (!this.map.passable(to.tile)) { const t = this.map.nearestPassable(to.tile, 3); if (!t) return; to = t.center; }
    this.move(GAIA, [u.id], to);
    u.fleeTimer = 2;
  }

  private nearestPlayerUnit(p: Vec2, r: number): Unit | null {
    let best: Unit | null = null, bestD = r;
    for (const o of this.units) {
      if (!o.alive || o.owner < 0) continue;
      const d = o.pos.distance(p);
      if (d <= bestD) { bestD = d; best = o; }
    }
    return best;
  }

  // ---- gathering

  private gatherSource(u: Unit, id: number): { src: Entity; res: Res; kind: string | null; foodKind: "plant" | "meat" | null } | null {
    const n = this.node(id);
    if (n && n.amount > 0) {
      const kind = n.def.id === "fish" ? "fish" : n.decay > 0 ? "hunt" : n.res === Res.food ? "forage" : null;
      return { src: n, res: n.res, kind, foodKind: n.foodKind };
    }
    const b = this.building(id);
    if (b && b.isFarm && b.complete && b.owner === u.owner && b.food > 0) return { src: b, res: Res.food, kind: "farm", foodKind: "plant" };
    return null;
  }

  private updateGather(u: Unit, id: number, dt: number) {
    const source = this.gatherSource(u, id);
    if (!source) {
      // The node ran out or the farm is gone: find more of the same nearby, or the next animal of that kind.
      const next = this.nextSource(u);
      if (next) { u.order = next; u.path = []; u.repathTimer = 0; }
      else if (u.carry > 0) u.order = { kind: "return", resume: null };
      else u.order = IDLE;
      return;
    }
    const { src, res, kind, foodKind } = source;
    // Switching to another resource drops the load; food to food keeps it.
    if (u.carry > 0 && u.carryRes !== res) u.carry = 0;
    const mods = this.players[u.owner].mods;
    const capacity = mods.carry(res, this.rules.economy.carry);
    if (u.carry >= capacity) { u.order = { kind: "return", resume: id }; u.path = []; return; }
    // One farmer per farm: a second villager looks for an empty farm nearby.
    if (src instanceof Building && src.farmer !== u.id && this.unit(src.farmer ?? -1)?.order.kind === "gather") {
      const other = this.freeFarm(u.owner, u.pos, src.id);
      if (other) { u.order = { kind: "gather", id: other.id }; u.path = []; u.repathTimer = 0; }
      else if (src.distance(u.pos) < 1.5) u.order = IDLE;
      return;
    }
    const a = this.approach(u, src, 0.9, dt);
    if (a === "arrived") {
      if (src instanceof Building) src.farmer = u.id;
      this.face(u, src.center);
      u.busy = true;
      const base = src instanceof ResourceNode ? src.def.rate ?? this.rules.gatherRate(res) : this.rules.gatherRate(res);
      const rate = base * mods.gather(res, kind) * this.players[u.owner].gatherBonus;
      const yieldK = mods.yieldOf(res);
      if (src instanceof ResourceNode) {
        const take = Math.min(rate * dt, src.amount, (capacity - u.carry) / yieldK);
        src.amount -= take;
        u.carry += take * yieldK;
        if (src.amount <= 0.0001) this.removeNode(src);
      } else if (src instanceof Building) {
        const take = Math.min(rate * dt, src.food, capacity - u.carry);
        src.food -= take;
        u.carry += take;
        if (src.food <= 0.0001) {
          src.alive = false;
          this.map.setOccupant(src.footprint, 0);
          this.events.push({ kind: "died", id: src.id, owner: src.owner, at: src.center, wasBuilding: true });
          this.events.push({ kind: "message", player: src.owner, text: "A farm ran out" });
        }
      }
      u.carryRes = res;
      u.carryKind = foodKind;
      u.lastGather = res;
    } else if (a === "blocked") {
      // Cannot reach this one (fenced in by trees): try another.
      const n = this.nearestNode(res, u.pos, 10, id);
      if (n) { u.order = { kind: "gather", id: n.id }; u.repathTimer = 0; } else u.order = IDLE;
    }
  }

  /** What a villager does when its source is gone: the same kind of node nearby, or the next animal of that kind. */
  private nextSource(u: Unit): { kind: "gather"; id: number } | { kind: "attack"; id: number } | null {
    const type = u.lastNodeType;
    if (type?.startsWith("carcass_")) {
      const animal = type.slice("carcass_".length);
      const meat = this.nodes.find((n) => n.alive && n.def.id === type && n.at.distance(u.pos) < 8);
      if (meat) return { kind: "gather", id: meat.id };
      let best: Unit | null = null, bestD = 10;
      for (const o of this.units) {
        if (!o.alive || !o.isAnimal || o.def.id !== animal) continue;
        const d = o.pos.distance(u.pos);
        if (d < bestD) { bestD = d; best = o; }
      }
      return best ? { kind: "attack", id: best.id } : null;
    }
    if (type === "farm") {
      const f = this.freeFarm(u.owner, u.pos);
      return f ? { kind: "gather", id: f.id } : null;
    }
    if (u.lastGather === null) return null;
    const n = this.nearestNode(u.lastGather, u.pos, 10, null, type);
    return n ? { kind: "gather", id: n.id } : null;
  }

  private updateReturn(u: Unit, resume: number | null, dt: number, dropId?: number) {
    if (u.carry <= 0 || u.carryRes === null) {
      u.order = resume !== null && this.gatherSource(u, resume) ? { kind: "gather", id: resume } : IDLE;
      return;
    }
    const r = u.carryRes;
    // The drop-off the player right-clicked, while it stands; otherwise the nearest that takes this load.
    const chosen = dropId !== undefined ? this.building(dropId) : null;
    const drop = chosen && chosen.complete && chosen.dropsOff(r, u.carryKind) ? chosen : this.nearestDropOff(r, u.owner, u.pos, u.carryKind);
    if (!drop) {
      u.order = IDLE;
      this.events.push({ kind: "message", player: u.owner, text: `No place to drop off ${u.carryKind === "meat" ? "meat" : RES_KEY[r]}` });
      return;
    }
    const a = this.approach(u, drop, 0.9, dt);
    if (a === "arrived") {
      const p = this.players[u.owner];
      p.res.values[r] += u.carry;
      p.stats.gathered.values[r] += u.carry;
      u.carry = 0;
      if (resume !== null && this.gatherSource(u, resume)) u.order = { kind: "gather", id: resume };
      else {
        const next = this.nextSource(u);
        u.order = next ?? IDLE;
      }
      u.path = [];
      u.repathTimer = 0;
    } else if (a === "blocked") u.order = IDLE;
  }

  private updateBuild(u: Unit, id: number, dt: number) {
    const b = this.building(id);
    if (!b || b.owner !== u.owner) { this.nextFoundation(u) || (u.order = IDLE); return; }
    if (b.complete) { this.afterBuild(u, b); return; }
    const a = this.approach(u, b, 0.9, dt);
    if (a === "arrived") {
      this.face(u, b.center);
      u.busy = true;
      const step = dt / this.bstats(b).build_time;
      b.progress = Math.min(1, b.progress + step);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * step);
      if (b.progress >= 1) {
        b.complete = true;
        this.players[b.owner].stats.built++;
        this.events.push({ kind: "completed", id: b.id, owner: b.owner });
        if (b.def.id === "wonder") this.wonderBuilt(b);
        this.afterBuild(u, b);
      }
    } else if (a === "blocked") { if (!this.nextFoundation(u)) u.order = IDLE; }
  }

  private nextFoundation(u: Unit): boolean {
    while (u.buildQueue.length) {
      const next = this.building(u.buildQueue.shift()!);
      if (next && !next.complete && next.owner === u.owner) { u.order = { kind: "build", id: next.id }; u.path = []; u.repathTimer = 0; return true; }
    }
    return false;
  }

  /** After finishing a building: the next wall piece, farm it, or gather next to a new drop-off. */
  private afterBuild(u: Unit, b: Building) {
    u.path = [];
    u.repathTimer = 0;
    if (this.nextFoundation(u)) return;
    if (b.isFarm) { u.order = { kind: "gather", id: b.id }; u.lastGather = Res.food; u.lastNodeType = "farm"; return; }
    if (b.def.drop_off && b.def.id !== "town_center") {
      const prefs = b.def.drop_off.map((k) => RES_KEY.indexOf(k as (typeof RES_KEY)[number])).filter((r) => r >= 0) as Res[];
      const ordered = (u.lastGather !== null && prefs.includes(u.lastGather) ? [u.lastGather] : []).concat(prefs);
      for (const r of ordered) {
        const n = this.nearestNode(r, b.center, 7, null, null, b);
        if (n) { u.order = { kind: "gather", id: n.id }; u.lastGather = r; u.lastNodeType = n.def.id; return; }
      }
    }
    u.order = IDLE;
  }

  private wonderBuilt(b: Building) {
    const p = this.players[b.owner];
    p.wonderAt = this.time + (this.rules.economy.wonder_seconds ?? 900);
    this.events.push({ kind: "message", player: -1, text: `${p.name} has built a Wonder. Destroy it or lose.` });
  }

  private removeNode(n: ResourceNode) {
    n.alive = false;
    n.amount = 0;
    if (n.solid) this.map.setOccupant(new Footprint(n.tile, 1), 0);
    this.events.push({ kind: "died", id: n.id, owner: GAIA, at: n.center, wasBuilding: false });
  }

  // ---- combat

  /** The damage rule of the original: attack minus the matching armor, plus bonuses, at least 1.
   *  Buildings take a fifth of that (at least 0.1). */
  damage(attack: number, ranged: boolean, bonus: Record<string, number> | undefined, target: Entity) {
    if (target instanceof Building) {
      const armor = ranged ? target.def.pierce_armor ?? 0 : target.def.armor ?? 0;
      let b = bonus?.building ?? 0;
      for (const tag of target.def.tags ?? []) b += bonus?.[tag] ?? 0;
      return Math.max(this.rules.buildingMin, (Math.max(0, attack - armor) + b) * this.rules.buildingFactor);
    }
    let armor = 0, cls = "animal";
    if (target instanceof Unit) {
      const st = this.stats(target);
      armor = ranged ? st.pierce_armor : st.armor;
      cls = target.def.class;
    }
    return Math.max(this.rules.minDamage, Math.max(0, attack - armor) + (bonus?.[cls] ?? 0));
  }

  private shotDamage(s: Shot, t: Entity) { return this.damage(s.attack, s.pierce, s.bonus, t); }

  /** Arrows follow their target. Stones and bolts land where the target was when they were thrown,
   *  so moving units can dodge them, unless the thrower's owner has researched Ballistics. */
  private fire(from: Vec2, shot: Shot, t: Entity, area: number, projectile: string) {
    const flight = Math.max(0.15, from.distance(t.center) / (projectile === "stone" ? 8 : 12));
    const heavy = projectile === "stone" || projectile === "bolt";
    let at: Vec2 | null = null;
    if (heavy) {
      at = t.center;
      if (t instanceof Unit && shot.owner >= 0 && this.players[shot.owner].mods.flags.has("ballistics")) {
        at = t.pos.add(t.pos.sub(t.prevPos).mul(flight / World.dt)); // lead the target
      }
    }
    this.missiles.push({ shot, targetId: heavy ? null : t.id, at, area, remaining: flight });
    this.events.push({ kind: "projectile", from, to: at ?? t.center, flight, projectile });
  }

  private updateMissiles(dt: number) {
    if (!this.missiles.length) return;
    const keep: Missile[] = [];
    for (const m of this.missiles) {
      m.remaining -= dt;
      if (m.remaining > 0) { keep.push(m); continue; }
      if (m.targetId !== null) {
        const t = this.entity(m.targetId);
        if (t) this.hit(t, m.shot);
        continue;
      }
      // A stone or bolt lands: it hits what is there now.
      const at = m.at!, r = Math.max(m.area, 0.45);
      if (m.area > 0) this.events.push({ kind: "splash", at, radius: m.area });
      for (const u of this.units) if (u.alive && this.hostile(m.shot.owner, u) && u.pos.distance(at) <= r) this.hit(u, m.shot);
      for (const b of this.buildings) if (b.alive && this.hostile(m.shot.owner, b) && b.footprint.distance(at) <= m.area + 0.05) this.hit(b, m.shot);
    }
    this.missiles = keep;
  }

  private hit(t: Entity, s: Shot) { this.applyDamage(t, this.shotDamage(s, t), s.attackerId); }

  applyDamage(t: Entity, amount: number, attackerId: number) {
    if (!t.alive || t instanceof ResourceNode) return;
    t.hp -= amount;
    this.events.push({ kind: "hit", at: t.center });
    if (t.owner >= 0 && this.alertTimer[t.owner] <= 0) {
      this.alertTimer[t.owner] = 10;
      this.events.push({ kind: "underAttack", player: t.owner, at: t.center });
    }
    const a = this.entity(attackerId);
    if (t instanceof Unit && a && t.order.kind !== "attack") {
      if (t.isAnimal) {
        // Elephants and the hunters' prey: fight back or run.
        if (t.animal!.behavior === "flee") this.flee(t, a.center);
        else t.order = { kind: "attack", id: a.id };
      } else if (!t.isPriest && (!t.isVillager || (a instanceof Unit && a.isAnimal)) && t.order.kind === "idle" && this.hostile(t.owner, a)) {
        // Idle soldiers hit back; villagers only fight off animals.
        t.order = { kind: "attack", id: a.id };
      } else if (t.isVillager && a instanceof Unit && a.isAnimal && t.order.kind !== "move") {
        t.order = { kind: "attack", id: a.id };
      }
    }
    if (t.hp <= 0) this.kill(t, attackerId);
  }

  private kill(t: Entity, attackerId: number) {
    t.alive = false;
    t.hp = 0;
    if (t instanceof Building) {
      this.map.setOccupant(t.footprint, 0);
      if (t.def.id === "wonder" && t.owner >= 0) this.players[t.owner].wonderAt = null;
    }
    if (t.owner >= 0) this.players[t.owner].stats.lost++;
    const a = this.entity(attackerId);
    if (a && a.owner >= 0 && !(t instanceof Unit && t.isAnimal)) this.players[a.owner].stats.kills++;
    this.events.push({ kind: "died", id: t.id, owner: t.owner, at: t.center, wasBuilding: t instanceof Building });
    // Only a villager's kill leaves meat; soldiers' kills are wasted, as in the original.
    if (t instanceof Unit && t.isAnimal && a instanceof Unit && a.isVillager) {
      const meat = this.addCarcass(t);
      for (const u of this.units) {
        if (u.alive && u.isVillager && u.order.kind === "attack" && u.order.id === t.id) {
          u.order = { kind: "gather", id: meat.id };
          u.lastGather = Res.food;
          u.lastNodeType = meat.def.id;
          u.path = []; u.repathTimer = 0;
        }
      }
    }
  }

  // ---- queries

  nearestEnemy(player: number, p: Vec2, r: number, skip?: (e: Entity) => boolean): Entity | null {
    let best: Entity | null = null, bestD = r;
    for (const u of this.units) {
      if (!u.alive || !this.hostile(player, u) || skip?.(u)) continue;
      const d = u.pos.distance(p);
      if (d <= bestD) { bestD = d; best = u; }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (!b.alive || !this.isEnemy(player, b.owner) || skip?.(b)) continue;
      const d = b.distance(p);
      if (d <= bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /** Auto-targeting skips an enemy this unit recently failed to reach. */
  private skipFor(u: Unit): ((e: Entity) => boolean) | undefined {
    const r = u.unreachable;
    if (!r) return undefined;
    if (r.until < this.time) { u.unreachable = null; return undefined; }
    return (e) => e.id === r.id;
  }

  nearestEnemyUnit(player: number, p: Vec2, r: number): Unit | null {
    let best: Unit | null = null, bestD = r;
    for (const u of this.units) {
      if (!u.alive || !this.isEnemy(player, u.owner)) continue;
      const d = u.pos.distance(p);
      if (d <= bestD) { bestD = d; best = u; }
    }
    return best;
  }

  /** Nearest node of a resource; optionally of one type, or that a given building takes. */
  nearestNode(r: Res, p: Vec2, radius: number, excluding: number | null = null, type: string | null = null, dropAt: Building | null = null): ResourceNode | null {
    let best: ResourceNode | null = null, bestD = radius;
    for (const n of this.nodes) {
      if (!n.alive || n.res !== r || n.id === excluding || n.decay > 0) continue;
      if (type !== null && n.def.id !== type) continue;
      if (dropAt && !dropAt.dropsOff(n.res, n.foodKind)) continue;
      const d = n.center.distance(p);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  /** The nearest finished farm of this owner nobody is working, within 10 tiles. */
  freeFarm(owner: number, p: Vec2, excluding: number | null = null): Building | null {
    let best: Building | null = null, bestD = 10;
    for (const b of this.buildings) {
      if (!b.alive || !b.isFarm || !b.complete || b.owner !== owner || b.id === excluding) continue;
      if (b.farmer !== null && this.unit(b.farmer)?.order.kind === "gather") continue;
      const d = b.distance(p);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  nearestDropOff(r: Res, owner: number, p: Vec2, kind: "plant" | "meat" | null = null): Building | null {
    let best: Building | null = null, bestD = Infinity;
    for (const b of this.buildings) {
      if (!b.alive || !b.complete || b.owner !== owner || !b.dropsOff(r, kind)) continue;
      const d = b.distance(p);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // ---- separation

  /** Pushes overlapping units apart. Units at work are not pushed, and units walking a path
   *  are not pushed either: they pass through, or a crowd at a berry bush could hold them forever. */
  private separate() {
    const minD = 0.42;
    const w = this.map.width;
    if (this.units.length < 2) return;
    const buckets = new Map<number, number[]>();
    this.units.forEach((u, i) => {
      if (!u.alive) return;
      const t = u.pos.tile;
      const k = t.y * w + t.x;
      const list = buckets.get(k);
      if (list) list.push(i); else buckets.set(k, [i]);
    });
    this.units.forEach((a, i) => {
      if (!a.alive) return;
      const t = a.pos.tile;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const list = buckets.get((t.y + dy) * w + (t.x + dx));
          if (!list) continue;
          for (const j of list) {
            if (j <= i) continue;
            const b = this.units[j];
            const d = b.pos.sub(a.pos);
            const len = d.length;
            if (len >= minD) continue;
            const dir = len > 0.0001 ? d.mul(1 / len) : new Vec2(((a.id * 37) % 7) - 3, 1).mul(0.2);
            const push = (minD - len) * 0.5;
            const aFree = !a.busy && !a.path.length, bFree = !b.busy && !b.path.length;
            if (aFree) {
              const np = a.pos.sub(dir.mul(bFree ? push : push * 2));
              if (this.map.passable(np.tile)) a.pos = np;
            }
            if (bFree) {
              const np = b.pos.add(dir.mul(aFree ? push : push * 2));
              if (this.map.passable(np.tile)) b.pos = np;
            }
          }
        }
      }
    });
  }
}

