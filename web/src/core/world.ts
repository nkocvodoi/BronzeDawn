import { AIController } from "./ai";
import { Building, Entity, GAIA, GameEvent, IDLE, Player, ResourceNode, Unit } from "./entities";
import { Fog } from "./fog";
import { Footprint, RNG, Tile, Vec2 } from "./geom";
import { GridMap, walkable } from "./grid";
import { generateMap } from "./mapgen";
import { Pathfinder } from "./path";
import { isRanged, RES_KEY, Res, ResBag, resFromKey, Rules } from "./rules";

/** What a context (right) click turned into, so the UI can give feedback. */
export type SmartResult = "moved" | "attacked" | "gathered" | "built" | "returned" | "nothing";

interface Missile { targetId: number; damage: number; attackerId: number; remaining: number }

type Approach = "arrived" | "moving" | "blocked";

/** Group move offsets: lattice points sorted by distance. No trigonometry, so every browser agrees. */
const FORMATION: Vec2[] = (() => {
  const pts: Vec2[] = [];
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) pts.push(new Vec2(x * 0.75, y * 0.75));
  pts.sort((a, b) => a.length - b.length || a.y - b.y || a.x - b.x);
  return pts;
})();

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

  constructor(readonly rules: Rules, readonly seed: number, playerNames = ["You", "Enemy"], size = 72, generate = true) {
    this.rng = new RNG(seed);
    this.map = new GridMap(size, size);
    this.pathfinder = new Pathfinder(this.map);
    playerNames.forEach((n, i) => {
      this.players.push(new Player(i, n, ResBag.of(rules.economy.start)));
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

  // ---- creating things

  spawnUnit(type: string, owner: number, at: Vec2): Unit {
    const u = new Unit(this.nextId++, owner, this.rules.units.get(type)!, at);
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  addBuilding(type: string, owner: number, origin: Tile, complete: boolean): Building {
    const b = new Building(this.nextId++, owner, this.rules.buildings.get(type)!, origin, complete);
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.map.setOccupant(b.footprint, b.id);
    this.nudgeUnits(b.footprint);
    return b;
  }

  addNode(type: string, tile: Tile): ResourceNode | null {
    const def = this.rules.nodes.get(type);
    if (!def || !this.map.passable(tile)) return null;
    const n = new ResourceNode(this.nextId++, def, tile);
    this.nodes.push(n);
    this.byId.set(n.id, n);
    this.map.setOccupant(new Footprint(tile, 1), n.id);
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

  // ---- rules queries

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
    if (this.rules.ageIndex(def.age) > p.age) return `Needs ${this.rules.ages[this.rules.ageIndex(def.age)].name}`;
    for (const req of def.requires ?? []) {
      if (!this.buildingsOf(player).some((b) => b.def.id === req && b.complete)) {
        return `Needs a ${this.rules.buildings.get(req)?.name ?? req}`;
      }
    }
    if (!p.res.covers(this.rules.buildingCost(type))) return "Not enough resources";
    return null;
  }

  blockerUnit(type: string, player: number): string | null {
    const def = this.rules.units.get(type);
    if (!def) return "unknown unit";
    const p = this.players[player];
    if (this.rules.ageIndex(def.age) > p.age) return `Needs ${this.rules.ages[this.rules.ageIndex(def.age)].name}`;
    if (!p.res.covers(this.rules.unitCost(type))) return "Not enough resources";
    return null;
  }

  /** Distinct finished building types from this or earlier ages, not houses or the town center. */
  ageRequirementCount(player: number) {
    const p = this.players[player];
    const kinds = new Set<string>();
    for (const b of this.buildingsOf(player)) {
      if (b.complete && b.def.id !== "town_center" && b.def.id !== "house" && this.rules.ageIndex(b.def.age) <= p.age) kinds.add(b.def.id);
    }
    return kinds.size;
  }

  blockerForNextAge(player: number): string | null {
    const p = this.players[player];
    if (p.age + 1 >= this.rules.ages.length) return "Already in the last age";
    if (this.buildings.some((b) => b.alive && b.owner === player && b.researching !== null)) return "Already advancing";
    const next = this.rules.ages[p.age + 1];
    const need = next.requires_buildings ?? 0;
    const have = this.ageRequirementCount(player);
    if (have < need) return `Needs ${need} different buildings (${have} built)`;
    if (!p.res.covers(ResBag.of(next.cost))) return "Not enough resources";
    return null;
  }

  trainProgress(b: Building) {
    if (b.researching !== null) {
      const t = this.rules.ages[b.researching].research_time;
      return t ? Math.min(1, b.researchTimer / t) : 0;
    }
    const def = b.queue.length ? this.rules.units.get(b.queue[0]) : undefined;
    return def ? Math.min(1, b.queueTimer / def.train_time) : 0;
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
      u.order = { kind: "move", to: dest, attackMove: attackMove && !u.isVillager };
      u.resumeMove = null;
      const goal = dest.tile;
      u.path = this.pathfinder.find(u.pos, dest, (t) => t.equals(goal));
      u.pathTarget = dest;
      if (u.path.length) u.path[u.path.length - 1] = dest;
    });
  }

  stop(player: number, ids: number[]) {
    for (const u of this.own(ids, player)) { u.order = IDLE; u.path = []; u.resumeMove = null; }
  }

  attack(player: number, ids: number[], target: number) {
    const t = this.entity(target);
    if (!t || !this.isEnemy(player, t.owner)) return;
    for (const u of this.own(ids, player)) {
      u.order = { kind: "attack", id: t.id };
      u.resumeMove = null; u.path = []; u.repathTimer = 0;
    }
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
      u.lastGather = res; u.path = []; u.repathTimer = 0;
    }
  }

  build(player: number, ids: number[], target: number) {
    const b = this.building(target);
    if (!b || b.owner !== player) return;
    for (const u of this.own(ids, player)) {
      if (!u.isVillager) continue;
      u.order = { kind: "build", id: b.id };
      u.path = []; u.repathTimer = 0;
    }
  }

  /** The right click: attack an enemy, gather, build or farm your own building, or move. */
  smart(player: number, ids: number[], target: number | null, at: Vec2): SmartResult {
    const group = this.own(ids, player);
    if (!group.length) return "nothing";
    const e = target !== null ? this.entity(target) : null;
    if (!e) { this.move(player, ids, at); return "moved"; }
    if (this.isEnemy(player, e.owner)) { this.attack(player, ids, e.id); return "attacked"; }
    const villagers = group.filter((u) => u.isVillager).map((u) => u.id);
    const others = group.filter((u) => !u.isVillager).map((u) => u.id);
    let result: SmartResult = "moved";
    if (villagers.length) {
      if (e instanceof ResourceNode) { this.gather(player, villagers, e.id); result = "gathered"; }
      else if (e instanceof Building && e.owner === player) {
        if (!e.complete) { this.build(player, villagers, e.id); result = "built"; }
        else if (e.isFarm) { this.gather(player, villagers, e.id); result = "gathered"; }
        else {
          const carriers = villagers.filter((id) => {
            const u = this.unit(id);
            return !!u && u.carry > 0 && u.carryRes !== null && e.dropsOff(u.carryRes);
          });
          for (const id of carriers) { const u = this.unit(id)!; u.order = { kind: "return", resume: null }; u.path = []; }
          const rest = villagers.filter((id) => !carriers.includes(id));
          if (rest.length) this.move(player, rest, at);
          result = carriers.length ? "returned" : "moved";
        }
      } else this.move(player, villagers, at);
    }
    if (others.length) this.move(player, others, at);
    return result;
  }

  /** Places a building and sends the builders. Returns the new building's id, or why not. */
  place(player: number, type: string, origin: Tile, builders: number[]): { id: number } | { error: string } {
    const why = this.blockerBuilding(type, player);
    if (why) return { error: why };
    if (!this.canPlace(type, origin, player)) return { error: "Cannot build there" };
    this.players[player].res.spend(this.rules.buildingCost(type));
    const b = this.addBuilding(type, player, origin, false);
    this.build(player, builders, b.id);
    return { id: b.id };
  }

  train(player: number, buildingId: number, type: string): string | null {
    const b = this.building(buildingId);
    if (!b || b.owner !== player || !b.complete) return "No building";
    if (!b.def.trains?.includes(type)) return "Cannot train that here";
    const why = this.blockerUnit(type, player);
    if (why) return why;
    if (b.queue.length >= 5) return "Queue is full";
    this.players[player].res.spend(this.rules.unitCost(type));
    b.queue.push(type);
    return null;
  }

  cancel(player: number, buildingId: number) {
    const b = this.building(buildingId);
    if (!b || b.owner !== player) return;
    if (b.researching !== null) {
      this.players[player].res.add(ResBag.of(this.rules.ages[b.researching].cost));
      b.researching = null;
      b.researchTimer = 0;
    } else if (b.queue.length) {
      this.players[player].res.add(this.rules.unitCost(b.queue.pop()!));
      if (!b.queue.length) b.queueTimer = 0;
    }
  }

  advanceAge(player: number, buildingId: number): string | null {
    const b = this.building(buildingId);
    if (!b || b.owner !== player || !b.complete || b.def.id !== "town_center") return "Only a Town Center can advance";
    const why = this.blockerForNextAge(player);
    if (why) return why;
    const next = this.players[player].age + 1;
    this.players[player].res.spend(ResBag.of(this.rules.ages[next].cost));
    b.researching = next;
    b.researchTimer = 0;
    return null;
  }

  setRally(player: number, buildingId: number, to: Vec2) {
    const b = this.building(buildingId);
    if (b && b.owner === player) b.rally = to;
  }

  /** The Delete key: the owner destroys one of their own units or buildings. */
  destroy(player: number, id: number) {
    const e = this.entity(id);
    if (e && e.owner === player) this.kill(e, 0);
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
    this.updateMissiles(dt);
    this.separate();
    this.compact();
    this.refreshPopulation();
    if (this.tick % 5 === 0) for (const p of this.players) this.fog[p.id].update(this, p.id);
    if (this.tick % 20 === 0) this.checkDefeat();
  }

  refreshPopulation() {
    for (const p of this.players) { p.pop = 0; p.popCap = 0; }
    for (const u of this.units) if (u.alive && u.owner >= 0) this.players[u.owner].pop += u.def.pop;
    for (const b of this.buildings) if (b.alive && b.complete && b.owner >= 0) this.players[b.owner].popCap += b.def.pop_provided ?? 0;
    for (const p of this.players) p.popCap = Math.min(p.popCap, this.rules.economy.pop_max);
  }

  private compact() {
    if (this.units.some((u) => !u.alive)) this.units = this.units.filter((u) => u.alive);
    if (this.buildings.some((b) => !b.alive)) this.buildings = this.buildings.filter((b) => b.alive);
    if (this.nodes.some((n) => !n.alive)) this.nodes = this.nodes.filter((n) => n.alive);
  }

  private checkDefeat() {
    if (this.winner !== null) return;
    for (const p of this.players) {
      if (p.defeated) continue;
      const hasUnits = this.units.some((u) => u.alive && u.owner === p.id);
      const canTrain = this.buildings.some((b) => b.alive && b.owner === p.id && b.complete && (b.def.trains ?? []).length > 0);
      if (!hasUnits && !canTrain) {
        p.defeated = true;
        this.events.push({ kind: "message", player: -1, text: `${p.name} has been defeated` });
      }
    }
    const left = this.players.filter((p) => !p.defeated);
    if (left.length <= 1) {
      this.winner = left.length ? left[0].id : -1;
      this.events.push({ kind: "gameOver", winner: this.winner });
    }
  }

  // ---- buildings

  private updateBuilding(b: Building, dt: number) {
    if (!b.complete || b.owner < 0) return;
    const p = this.players[b.owner];
    if (b.researching !== null) {
      const age = b.researching;
      b.researchTimer += dt;
      if (b.researchTimer >= (this.rules.ages[age].research_time ?? 60)) {
        p.age = Math.max(p.age, age);
        b.researching = null;
        b.researchTimer = 0;
        this.events.push({ kind: "ageReached", player: p.id, age });
        this.events.push({ kind: "message", player: p.id, text: `${p.name} reached the ${this.rules.ages[age].name}` });
      }
    } else if (b.queue.length) {
      const type = b.queue[0];
      const def = this.rules.units.get(type)!;
      if (p.pop + def.pop > p.popCap) {
        if (!b.housingWarned) {
          b.housingWarned = true;
          this.events.push({ kind: "message", player: p.id, text: "Need more houses" });
        }
      } else {
        b.housingWarned = false;
        b.queueTimer += dt;
        if (b.queueTimer >= def.train_time) {
          b.queue.shift();
          b.queueTimer = 0;
          const u = this.spawnUnit(type, p.id, this.exitTile(b, b.rally).center);
          p.pop += def.pop;
          p.stats.trained++;
          this.events.push({ kind: "trained", id: u.id, owner: p.id });
          if (b.rally) {
            const node = this.node(this.map.occupantAt(b.rally.tile));
            if (u.isVillager && node) this.gather(p.id, [u.id], node.id);
            else this.move(p.id, [u.id], b.rally);
          }
        }
      }
    }
    if (b.def.attack !== undefined && b.def.range !== undefined) {
      b.cooldown -= dt;
      if (b.cooldown <= 0) {
        const t = this.nearestEnemyUnit(b.owner, b.center, b.def.range + b.def.size / 2);
        if (t) {
          this.fire(b.center, b.id, t, this.damage(b.def.attack, true, undefined, t));
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
      u.path = this.pathfinder.find(u.pos, goal, (t) => e.distance(t.center) <= reach);
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
    let budget = u.def.speed * dt;
    while (budget > 0 && u.path.length) {
      const next = u.path[0];
      if (!this.map.passable(next.tile) && this.map.occupantAt(next.tile) !== 0) {
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

  private updateUnit(u: Unit, dt: number) {
    u.cooldown -= dt;
    u.scanTimer -= dt;
    const o = u.order;
    switch (o.kind) {
      case "idle":
        if (!u.isVillager && u.scanTimer <= 0) {
          u.scanTimer = 0.5;
          const t = this.nearestEnemy(u.owner, u.pos, u.def.los);
          if (t) u.order = { kind: "attack", id: t.id };
        }
        break;

      case "move": {
        if (o.attackMove && u.scanTimer <= 0) {
          u.scanTimer = 0.5;
          const t = this.nearestEnemy(u.owner, u.pos, u.def.los);
          if (t) {
            u.resumeMove = o.to;
            u.order = { kind: "attack", id: t.id };
            u.path = [];
            return;
          }
        }
        if (!u.path.length) {
          if (u.pos.distance(o.to) > 0.15 && this.map.clearLine(u.pos, o.to)) u.path = [o.to];
          else { u.order = IDLE; return; }
        }
        if (this.followPath(u, dt)) u.order = IDLE;
        break;
      }

      case "gather": this.updateGather(u, o.id, dt); break;
      case "return": this.updateReturn(u, o.resume, dt); break;
      case "build": this.updateBuild(u, o.id, dt); break;

      case "attack": {
        const t = this.entity(o.id);
        if (!t || !this.isEnemy(u.owner, t.owner)) {
          if (u.resumeMove) {
            const m = u.resumeMove;
            u.resumeMove = null;
            this.move(u.owner, [u.id], m, true);
          } else { u.order = IDLE; u.scanTimer = 0; }
          return;
        }
        // Hitting a building while soldiers attack you is how armies die: turn to face them.
        if (t instanceof Building && u.scanTimer <= 0) {
          u.scanTimer = 0.5;
          const threat = this.nearestEnemyUnit(u.owner, u.pos, u.def.los);
          if (threat) { u.order = { kind: "attack", id: threat.id }; u.path = []; u.repathTimer = 0; return; }
        }
        const reach = isRanged(u.def) ? u.def.range : 0.9;
        const a = this.approach(u, t, reach, dt);
        if (a === "arrived") {
          this.face(u, t.center);
          u.busy = true;
          if (u.cooldown <= 0) {
            u.cooldown = u.def.attack_cooldown;
            const dmg = this.damage(u.def.attack, isRanged(u.def), u.def.bonus, t);
            if (isRanged(u.def)) this.fire(u.pos, u.id, t, dmg);
            else this.applyDamage(t, dmg, u.id);
          }
        } else if (a === "blocked") u.order = IDLE;
        break;
      }
    }
  }

  private gatherSource(u: Unit, id: number): { src: Entity; res: Res } | null {
    const n = this.node(id);
    if (n && n.amount > 0) return { src: n, res: n.res };
    const b = this.building(id);
    if (b && b.isFarm && b.complete && b.owner === u.owner && b.food > 0) return { src: b, res: Res.food };
    return null;
  }

  private updateGather(u: Unit, id: number, dt: number) {
    const source = this.gatherSource(u, id);
    if (!source) {
      // The node ran out or the farm is gone: find more of the same nearby.
      const n = u.lastGather !== null ? this.nearestNode(u.lastGather, u.pos, 10) : null;
      if (n) { u.order = { kind: "gather", id: n.id }; u.path = []; u.repathTimer = 0; }
      else if (u.carry > 0) u.order = { kind: "return", resume: null };
      else u.order = IDLE;
      return;
    }
    const { src, res } = source;
    if (u.carry > 0 && u.carryRes !== res) u.carry = 0;
    const capacity = this.rules.economy.carry;
    if (u.carry >= capacity) { u.order = { kind: "return", resume: id }; u.path = []; return; }
    const a = this.approach(u, src, 0.9, dt);
    if (a === "arrived") {
      this.face(u, src.center);
      u.busy = true;
      const rate = this.rules.gatherRate(res);
      if (src instanceof ResourceNode) {
        const take = Math.min(rate * dt, src.amount, capacity - u.carry);
        src.amount -= take;
        u.carry += take;
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
      u.lastGather = res;
    } else if (a === "blocked") {
      // Cannot reach this one (fenced in by trees): try another.
      const n = this.nearestNode(res, u.pos, 10, id);
      if (n) { u.order = { kind: "gather", id: n.id }; u.repathTimer = 0; } else u.order = IDLE;
    }
  }

  private updateReturn(u: Unit, resume: number | null, dt: number) {
    if (u.carry <= 0 || u.carryRes === null) {
      u.order = resume !== null && this.gatherSource(u, resume) ? { kind: "gather", id: resume } : IDLE;
      return;
    }
    const r = u.carryRes;
    const drop = this.nearestDropOff(r, u.owner, u.pos);
    if (!drop) {
      u.order = IDLE;
      this.events.push({ kind: "message", player: u.owner, text: `No place to drop off ${RES_KEY[r]}` });
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
        const n = this.nearestNode(r, drop.center, 10);
        u.order = n ? { kind: "gather", id: n.id } : IDLE;
      }
      u.path = [];
      u.repathTimer = 0;
    } else if (a === "blocked") u.order = IDLE;
  }

  private updateBuild(u: Unit, id: number, dt: number) {
    const b = this.building(id);
    if (!b || b.owner !== u.owner) { u.order = IDLE; return; }
    if (b.complete) { this.afterBuild(u, b); return; }
    const a = this.approach(u, b, 0.9, dt);
    if (a === "arrived") {
      this.face(u, b.center);
      u.busy = true;
      const step = dt / b.def.build_time;
      b.progress = Math.min(1, b.progress + step);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * step);
      if (b.progress >= 1) {
        b.complete = true;
        this.players[b.owner].stats.built++;
        this.events.push({ kind: "completed", id: b.id, owner: b.owner });
        this.afterBuild(u, b);
      }
    } else if (a === "blocked") u.order = IDLE;
  }

  /** After finishing a building: farm it, or gather next to a new drop-off. */
  private afterBuild(u: Unit, b: Building) {
    u.path = [];
    u.repathTimer = 0;
    if (b.isFarm) { u.order = { kind: "gather", id: b.id }; u.lastGather = Res.food; return; }
    if (b.def.drop_off && b.def.id !== "town_center") {
      const prefs = b.def.drop_off.map(resFromKey).filter((r): r is Res => r !== null);
      const ordered = (u.lastGather !== null && prefs.includes(u.lastGather) ? [u.lastGather] : []).concat(prefs);
      for (const r of ordered) {
        const n = this.nearestNode(r, b.center, 7);
        if (n) { u.order = { kind: "gather", id: n.id }; u.lastGather = r; return; }
      }
    }
    u.order = IDLE;
  }

  private removeNode(n: ResourceNode) {
    n.alive = false;
    n.amount = 0;
    this.map.setOccupant(new Footprint(n.tile, 1), 0);
    this.events.push({ kind: "died", id: n.id, owner: GAIA, at: n.center, wasBuilding: false });
  }

  // ---- combat

  damage(attack: number, ranged: boolean, bonus: Record<string, number> | undefined, target: Entity) {
    let armor = 0, cls = "building";
    if (target instanceof Unit) {
      armor = ranged ? target.def.pierce_armor : target.def.armor;
      cls = target.def.class;
    } else if (target instanceof Building) {
      armor = ranged ? target.def.pierce_armor ?? 3 : target.def.armor ?? 0;
    }
    return Math.max(this.rules.minDamage, attack - armor) + (bonus?.[cls] ?? 0);
  }

  private fire(from: Vec2, attackerId: number, t: Entity, damage: number) {
    const flight = Math.max(0.15, from.distance(t.center) / 12);
    this.missiles.push({ targetId: t.id, damage, attackerId, remaining: flight });
    this.events.push({ kind: "projectile", from, to: t.center, flight });
  }

  private updateMissiles(dt: number) {
    if (!this.missiles.length) return;
    const keep: Missile[] = [];
    for (const m of this.missiles) {
      m.remaining -= dt;
      if (m.remaining > 0) { keep.push(m); continue; }
      const t = this.entity(m.targetId);
      if (t) this.applyDamage(t, m.damage, m.attackerId);
    }
    this.missiles = keep;
  }

  applyDamage(t: Entity, amount: number, attackerId: number) {
    if (!t.alive || t.owner === GAIA) return;
    t.hp -= amount;
    this.events.push({ kind: "hit", at: t.center });
    if (t.owner >= 0 && this.alertTimer[t.owner] <= 0) {
      this.alertTimer[t.owner] = 10;
      this.events.push({ kind: "underAttack", player: t.owner, at: t.center });
    }
    // Idle soldiers hit back. Villagers keep working unless told otherwise.
    if (t instanceof Unit && !t.isVillager && t.order.kind === "idle") {
      const a = this.entity(attackerId);
      if (a && this.isEnemy(t.owner, a.owner)) t.order = { kind: "attack", id: a.id };
    }
    if (t.hp <= 0) this.kill(t, attackerId);
  }

  private kill(t: Entity, attackerId: number) {
    t.alive = false;
    t.hp = 0;
    if (t instanceof Building) this.map.setOccupant(t.footprint, 0);
    if (t.owner >= 0) this.players[t.owner].stats.lost++;
    const a = this.entity(attackerId);
    if (a && a.owner >= 0) this.players[a.owner].stats.kills++;
    this.events.push({ kind: "died", id: t.id, owner: t.owner, at: t.center, wasBuilding: t instanceof Building });
  }

  // ---- queries

  nearestEnemy(player: number, p: Vec2, r: number): Entity | null {
    let best: Entity | null = null, bestD = r;
    for (const u of this.units) {
      if (!u.alive || !this.isEnemy(player, u.owner)) continue;
      const d = u.pos.distance(p);
      if (d <= bestD) { bestD = d; best = u; }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (!b.alive || !this.isEnemy(player, b.owner)) continue;
      const d = b.distance(p);
      if (d <= bestD) { bestD = d; best = b; }
    }
    return best;
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

  nearestNode(r: Res, p: Vec2, radius: number, excluding: number | null = null): ResourceNode | null {
    let best: ResourceNode | null = null, bestD = radius;
    for (const n of this.nodes) {
      if (!n.alive || n.res !== r || n.id === excluding) continue;
      const d = n.center.distance(p);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  nearestDropOff(r: Res, owner: number, p: Vec2): Building | null {
    let best: Building | null = null, bestD = Infinity;
    for (const b of this.buildings) {
      if (!b.alive || !b.complete || b.owner !== owner || !b.dropsOff(r)) continue;
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
