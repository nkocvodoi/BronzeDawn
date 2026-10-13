// The original's random map generator (Age of Empires: The Rise of Rome), worked out from its program, run on its
// own numbers (data/aoe-maps.json, from empires.dat). It draws its random numbers from the same kind of generator
// as the original, in the same order where that order is known, and follows its steps one by one:
//
//   init:  lands (origins, margins, which players share a continent), terrain, objects, elevation, cliffs
//   run:   lands grow from their origins, then shallows, hills, cliffs, patches of ground, and the objects
//
// Bronze Dawn's map is then filled from the result: its terrains, trees on the forest tiles, the start of each
// player (Town Center and villagers come from the map's own list, as in the original) and everything else.
//
// What is not exact, and why, is said where it happens; replica/game/aoe1-mapgen.md has the whole of it.

import maps from "../../../data/aoe-maps.json";
import { Tile, Vec2 } from "./geom";
import { Terrain } from "./grid";
import type { World } from "./world";

/** The original's terrain ids, as its maps name them. */
export const T = { grass: 0, water: 1, beach: 2, shallows: 4, desert: 6, forest: 10, palm: 13, pine: 19, jungle: 20, deep: 22, temp: 16 } as const;

/** What may stand next to each terrain in a patch (the dat's "impassable" field): 16 is the cliff line. */
const IMPASSABLE: Record<number, number> = { 0: 16, 1: 15, 2: 14, 4: 255, 6: 14, 10: 16, 13: 14, 19: 16, 20: 16, 22: 15 };

/** Maps whose "shallows" setup (half of them: the lands put in zones apart, rivers left between, fords across)
 *  is left out for now: Inland. The one saved game of the original to compare with (replica/game/aoe1-mapgen.md
 *  §10) fell on a map without it, so the rivers have not been checked, and they cut every base off from its
 *  neighbours but for the fords. The rolls are still drawn, so the rest of the setup goes as before. */
const RIVERS_OFF = new Set<number>([]);

export interface AoeLand {
  landId: number; terrain: number; spacing: number; baseSize: number; zone: number; placement: number;
  baseX: number; baseY: number; proportion: number; byPlayer: number; startRadius: number; edgeFade: number; clumpiness: number;
}
export interface AoeTerrain { terrain: number; proportion: number; clumps: number; edgeSpacing: number; on: number; clumpiness: number }
export interface AoeObject {
  unit: string; id: number; host: number; placing: number; scale: number; perGroup: number; fluctuation: number; groups: number;
  area: number; player: number; land: number; min: number; max: number;
}
export interface AoeMap {
  id: number; borders: [number, number, number, number]; borderUsage: number; margin: number; baseTerrain: number;
  landCoverage: number; lands: AoeLand[]; terrains: AoeTerrain[]; objects: AoeObject[]; elevations: unknown[];
}

/** The original's sizes, in tiles: Tiny to Gigantic. */
export const AOE_SIZES: [string, number][] = [["Tiny", 72], ["Small", 96], ["Medium", 120], ["Large", 144], ["Huge", 200], ["Gigantic", 250]];

// ---- the random numbers: the C library's generator the original was built with

export class Lcg {
  state = 0;
  srand(seed: number) { this.state = seed >>> 0; }
  rand() {
    this.state = (Math.imul(this.state, 0x343fd) + 0x269ec3) >>> 0;
    return (this.state >>> 16) & 0x7fff;
  }
  /** `rand() * n / 32767`, cut toward zero as the original's integer division does: 0 to n, n only now and then. */
  R(n: number) { return Math.trunc((this.rand() * n) / 0x7fff); }
}

// ---- lists of tiles: one node per tile, in at most one list at a time, as the original keeps them

class Lists {
  readonly next: Int32Array;
  readonly prev: Int32Array;
  readonly prio: Float32Array;
  private heads = 0;
  constructor(readonly tiles: number, maxHeads: number) {
    this.next = new Int32Array(tiles + maxHeads).fill(-1);
    this.prev = new Int32Array(tiles + maxHeads).fill(-1);
    this.prio = new Float32Array(tiles + maxHeads);
  }
  /** A list head (a sentinel node after the tiles). */
  head() { return this.tiles + this.heads++; }
  clearLinks() { this.next.fill(-1); this.prev.fill(-1); }
  linked(n: number) { return this.next[n] >= 0 || this.prev[n] >= 0; }
  unlink(n: number) {
    const p = this.prev[n], q = this.next[n];
    if (p >= 0) this.next[p] = q;
    if (q >= 0) this.prev[q] = p;
    this.next[n] = this.prev[n] = -1;
  }
  /** Put n right after `after` (a head or a node), taking it out of any list first. */
  pushAfter(after: number, n: number) {
    if (this.linked(n)) this.unlink(n);
    const q = this.next[after];
    this.next[n] = q; this.prev[n] = after;
    if (q >= 0) this.prev[q] = n;
    this.next[after] = n;
  }
  pop(head: number): number {
    const n = this.next[head];
    if (n < 0) return -1;
    this.unlink(n);
    return n;
  }
  /** Lets go of a list: the nodes in it stay chained to each other, as in the original. */
  release(head: number) {
    const n = this.next[head];
    if (n >= 0) this.prev[n] = -1;
    this.next[head] = -1;
  }
  /** Ascending by priority; a new node goes before those with an equal one. */
  insertSorted(head: number, n: number, prio: number) {
    this.unlink(n);
    this.prio[n] = Math.fround(prio);
    let at = head;
    const p = this.prio[n];
    while (this.next[at] >= 0 && this.prio[this.next[at]] < p) at = this.next[at];
    this.pushAfter(at, n);
  }
}

interface Slot {
  tiles: number; terrain: number; x: number; y: number; baseSize: number; spacing: number; zone: number; clumpiness: number;
  xMin: number; yMin: number; xMax: number; yMax: number; usage: number; landId: number; player: number;
  startRadius: number; edgeFade: number;
}

/** A thing to put on the map, as the generator places it: where, whose. Bronze Dawn makes them afterwards.
 *  `id` is the original's unit, when the generator knows it; `gone`, one a later step took away again. */
export interface Placed { unit: string; player: number; x: number; y: number; group: number; id?: number; gone?: boolean; frame?: number }


/** What the original asks of a thing when it puts one down (data/aoe-maps.json, from empires.dat). */
interface AoeUnit {
  size: [number, number, number]; clearance: [number, number]; on: Set<number>;
  onTerrain: [number, number]; besideTerrain: [number, number]; hill: number; facing: number; building: number; buildOn: number; type: number;
}
const DATA = maps as unknown as {
  units?: Record<string, Omit<AoeUnit, "on"> & { on: number[] }>; terrainUnits?: Record<string, [number, number, number][]>;
};
const UNITS = new Map<number, AoeUnit>(Object.entries(DATA.units ?? {}).map(([k, u]) => [
  Number(k), { ...u, size: u.size.map(Math.fround) as AoeUnit["size"], clearance: u.clearance.map(Math.fround) as AoeUnit["clearance"], on: new Set(u.on) },
]));
/** Each terrain's own things: [unit id, density in thousandths, centred]. */
const TERRAIN_UNITS: [number, number, number][][] = Array.from({ length: 32 }, (_, t) => DATA.terrainUnits?.[t] ?? []);
const f32 = Math.fround;
/** The cliff pieces, by the sides a cell's cliff goes out of (+x, +y, -x, -y: 1, -1 or 0): unit, frame, the other
 *  unit and frame a straight piece may take instead, and where in the cell it stands (the original's table, built
 *  in its map's constructor from FUN_004efef0). */
const CLIFF_PIECES: [number[], [number, number, number, number, number, number]][] = [
  [[1, 0, 0, 0], [264, 16, -1, -1, 1.5, 1.5]], [[0, 1, 0, 0], [264, 18, -1, -1, 1.5, 1.5]],
  [[0, 0, 1, 0], [264, 17, -1, -1, 1.5, 1.5]], [[0, 0, 0, 1], [264, 19, -1, -1, 1.5, 1.5]],
  [[-1, 0, 0, 0], [266, 20, -1, -1, 1.5, 1.5]], [[0, -1, 0, 0], [265, 22, -1, -1, 1.5, 1.5]],
  [[0, 0, -1, 0], [266, 21, -1, -1, 1.5, 1.5]], [[0, 0, 0, -1], [265, 23, -1, -1, 1.5, 1.5]],
  [[-1, 1, 0, 0], [270, 0, -1, -1, 1.5, 2]], [[0, -1, -1, 0], [272, 9, -1, -1, 1, 2]],
  [[0, 0, 1, -1], [268, 6, -1, -1, 1, 1.5]], [[1, 0, 0, 1], [264, 3, -1, -1, 1.5, 1.5]],
  [[1, -1, 0, 0], [267, 12, -1, -1, 2, 1.5]], [[0, 1, 1, 0], [264, 15, -1, -1, 1.5, 1.5]],
  [[0, 0, -1, 1], [269, 14, -1, -1, 1.5, 1]], [[-1, 0, 0, -1], [271, 13, -1, -1, 2, 1]],
  [[1, 0, 1, 0], [264, 4, 264, 5, 1.5, 1.5]], [[0, 1, 0, 1], [264, 1, 264, 2, 1.5, 1.5]],
  [[-1, 0, -1, 0], [266, 11, 266, 10, 1.5, 1.5]], [[0, -1, 0, -1], [265, 8, 265, 7, 1.5, 1.5]],
];
const CLIFF_TABLE = new Map(CLIFF_PIECES.map(([f, e]) => [f.join(","), e]));
const cliffPiece = (f: number[]) => CLIFF_TABLE.get(f.join(","));

/** -1/32767 and -0.5, as the original keeps them (a float). */
const INV = f32(-1 / 32767), HALF = f32(-0.5), MILLI = f32(0.001);

export class AoeMapGen {
  readonly W: number;
  readonly H: number;
  readonly rng = new Lcg();
  /** The original's terrain id per tile. */
  readonly terrain: Uint8Array;
  readonly elevation: Uint8Array;
  readonly zone: Uint8Array;
  readonly placed: Placed[] = [];
  private slots: Slot[] = [];
  private lists: Lists;
  private landHeads: number[];
  private H0: number;
  private G: number;
  private baseTerrain: number;
  private borders: [number, number, number, number];
  private extraObjects: AoeObject[] = [];
  private objectLands: { x: number; y: number; landId: number; player: number }[] = [];

  /** `teams`: a team number per player, as World has them (allies share a number above 0). */
  constructor(readonly map: AoeMap, readonly size: number, readonly players: number, readonly seed: number, readonly teams: number[] = []) {
    this.W = this.H = size;
    const N = size * size;
    this.terrain = new Uint8Array(N);
    this.elevation = new Uint8Array(N);
    this.zone = new Uint8Array(N);
    this.lists = new Lists(N, 40);
    this.landHeads = Array.from({ length: 32 }, () => this.lists.head());
    this.H0 = this.lists.head();
    this.G = this.lists.head();
    this.baseTerrain = map.baseTerrain;
    this.borders = [...map.borders];
  }

  /** The whole generator: init, then run, each from the seed. */
  generate() {
    const r = this.rng;
    r.srand(this.seed);
    this.landInit();
    this.terrainInit();
    this.objectInit();
    this.elevationInit();
    // The cliff module, three maps in four, and only when the map has cliffs at all (not Small Islands).
    if (r.rand() > 0x1fff) this.planCliffs();
    const cliffs = this.cliffPlan !== null;
    r.srand(this.seed);
    r.rand(); // "map started"
    this.runLands(); r.rand();
    if (this.shallowsOn) { this.runShallows(); r.rand(); }
    this.runElevation(); r.rand();
    if (cliffs) { this.runCliffs(); r.rand(); }
    this.runTerrain(); r.rand();
    this.runObjects(); r.rand();
    for (let i = 0; i < this.terrain.length; i++) if (this.terrain[i] === T.temp) this.terrain[i] = T.grass;
    return this;
  }

  private at(x: number, y: number) { return y * this.W + x; }

  // ---- lands, init

  private shallowsOn = false;

  private landInit() {
    const m = this.map, r = this.rng, W = this.W, H = this.H, id = m.id;
    let margin = m.margin;
    if ((id === 5 || id === 8) && W < 100) margin = W >= 80 ? 25 : 20;
    this.fillSlots(margin);
    this.teamOrder();
    const each = (f: (s: Slot) => void) => this.slots.forEach(f);
    if (id < 5) {
      if (r.rand() < 0x3fff) { this.borders[0] = -1; each((s) => { s.xMin = -1; }); }
      if (r.rand() < 0x3fff) { this.borders[1] = -1; each((s) => { s.yMin = -1; }); }
      if (r.rand() < 0x3fff) { this.borders[2] = 0; each((s) => { s.xMax = W; }); }
      if (r.rand() < 0x3fff) { this.borders[3] = 0; each((s) => { s.yMax = H; }); }
    }
    if (id === 8) {
      if (r.rand() < 0x3fff) each((s) => { s.xMax = W; s.xMin = -1; });
      else each((s) => { s.yMax = H; s.yMin = -1; });
    }
    if ((id >= 2 && id <= 6) || id === 8) {
      if (r.rand() < 0x3fff) {
        const even = r.rand() < 0x3fff, odd = r.rand() < 0x3fff;
        if (!RIVERS_OFF.has(id)) {
          this.slots.forEach((s, i) => { if (i % 2 === 0) s.zone = even ? 0 : i; else s.zone = odd ? 1 : i; });
          this.shallowsOn = true;
          this.shallowPoints = this.slots.map((s) => ({ x: s.x, y: s.y }));
        }
        r.rand(); // "shallows initialization"
      } else if (id === 4) { each((s) => { s.zone = 0; }); this.baseTerrain = T.grass; }
      else if (id >= 5) each((s) => { s.zone = 0; });
    }
    if (id === 5 || id === 8) {
      let b = 20;
      if (W < 100) {
        b = W >= 80 ? 15 : 10;
        each((s) => {
          if (s.xMin > 0) s.xMin = b;
          if (s.yMin > 0) s.yMin = b;
          if (s.xMax < W) s.xMax = W - b;
          if (s.yMax < H) s.yMax = H - b;
        });
      }
      const t = Math.trunc((W - 2 * b) * (H - 2 * b) * 0.8);
      each((s) => { s.tiles = Math.trunc(t / this.slots.length); });
    }
    r.rand(); // "land initialization"
  }

  private fillSlots(margin: number) {
    const m = this.map, W = this.W, H = this.H;
    const total = Math.trunc((m.landCoverage * H * W) / 100);
    const [b1, b2, b3, b4] = this.borders;
    const base = (l: AoeLand, zone: number, tiles: number): Slot => ({
      tiles, terrain: l.terrain, x: 0, y: 0, baseSize: l.baseSize, spacing: l.spacing, zone, clumpiness: l.clumpiness,
      xMin: b1, yMin: b2, xMax: W - b3, yMax: H - b4, usage: m.borderUsage,
      landId: l.landId, player: 0, startRadius: l.startRadius, edgeFade: l.edgeFade,
    });
    for (const l of m.lands) {
      if (l.byPlayer === 0) {
        const s = base(l, l.zone, Math.trunc((l.proportion * total) / 100));
        this.slots.push(s);
        this.origins(this.slots.length - 1, margin, 1, l);
      } else {
        const start = this.slots.length;
        for (let j = 0; j < this.players; j++) {
          const s = base(l, l.byPlayer === 1 ? l.zone : j, Math.trunc((l.proportion * total) / (this.players * 100)));
          s.player = j + 1;
          this.slots.push(s);
        }
        this.origins(start, margin, this.players, l);
      }
    }
  }

  /** Allies' lands next to each other (the end of FUN_0046f6e0): the lands' origins handed out again, each team
   *  taking the free origins nearest the first free one. No random numbers. With no allies nothing moves. */
  private teamOrder() {
    const S0 = this.slots, n = S0.length, tm = this.teams;
    const ally = (p: number, q: number) => p !== q && p < this.players && q < this.players && (tm[p] ?? 0) > 0 && tm[p] === tm[q];
    // Every origin's list of all the others, nearest first (a bubble sort, so ties keep their order).
    const S = S0.map((a) => {
      const D = S0.map((b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2), s = S0.map((_, j) => j);
      for (let sw = true; sw;) {
        sw = false;
        for (let j = 1; j < n; j++) if (D[j] < D[j - 1]) { [D[j], D[j - 1]] = [D[j - 1], D[j]]; [s[j], s[j - 1]] = [s[j - 1], s[j]]; sw = true; }
      }
      return s;
    });
    const team = new Array<number>(n).fill(-1), size: number[] = [];
    let teams = 0;
    for (let p = 0; p < n; p++) if (team[p] === -1) {
      team[p] = teams; size[teams] = 1;
      for (let q = 0; q < n; q++) if (ally(p, q)) { team[q] = teams; size[teams]++; }
      teams++;
    }
    if (teams === n) return; // every land its own team: each keeps its own origin
    // owner[origin] = team. A team that finds no free origin near enough takes one from another team, which
    // moves its own to free ones (as the original does; with the teams Bronze Dawn allows it always ends).
    const owner = new Array<number>(n).fill(-1);
    let lf = -1, v = -1;
    for (let t = 0; t < teams; t++) {
      let s = owner.indexOf(-1); if (s < 0) s = n;
      let w = size[t], placed = 0;
      for (let guard = 0; placed < size[t] && guard < 1000; guard++) {
        let e = 0;
        for (; e < w; e++) if (owner[S[s][e]] === -1) { owner[S[s][e]] = t; break; }
        if (e < w) { placed++; continue; }
        if (w < n) w++;
        for (let k = n - 1; k >= 0; k--) if (owner[S[s][k]] === -1) { lf = S[s][k]; break; }
        let u = -1;
        for (let k = 0; k < n; k++) {
          const c = owner[S[lf][k]];
          if (c !== t && c >= 0) {
            u = c; v = S[lf][k];
            for (let k2 = 0; k2 < w; k2++) if (owner[S[s][k2]] === u) { v = S[s][k2]; break; }
            break;
          }
        }
        if (u < 0) return;
        owner[lf] = u; owner[v] = -1;
        for (let k = n - 1; k >= 0; k--) {
          const pos = S[u][k]; // indexed by the team's number, as in the original
          if (owner[pos] === u) for (let k2 = 0; k2 < n; k2++) {
            const p2 = S[lf][k2];
            if (owner[p2] === -1 && p2 !== v) { owner[pos] = -1; owner[p2] = u; break; }
          }
        }
      }
    }
    const from = new Array<number>(n).fill(-1);
    for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) if (from[q] === -1 && team[q] === owner[p]) { from[q] = p; break; }
    if (from.some((f) => f < 0)) return;
    const xy = S0.map((s) => [s.x, s.y]);
    S0.forEach((s, c) => { [s.x, s.y] = xy[from[c]]; });
  }

  /** Where each land starts (FUN_0046f300): random spots off the edge, away from the middle and from each other. */
  private origins(start: number, m: number, cnt: number, land: AoeLand) {
    const r = this.rng, W = this.W, H = this.H;
    r.rand(); // "calc land start"
    let d = (W - 2 * m) / Math.sqrt(cnt);
    if (cnt > 3) d *= Math.fround(cnt < 7 ? 0.9 : 0.8);
    const dSq = Math.fround(d * d);
    const hw = Math.trunc(W / 2), hh = Math.trunc(H / 2);
    let minX = Math.trunc(hw - d * 0.9), minY = Math.trunc(hh - d * 0.9), maxX = Math.trunc(hw + d * 0.9), maxY = Math.trunc(hh + d * 0.9);
    if (minX <= m) minX = m + 1;
    if (minY <= m) minY = m + 1;
    if (maxX >= W - m - 1) maxX = W - m - 2;
    if (maxY >= H - m - 1) maxY = H - m - 2;
    const S = this.slots;
    if (land.placement === 0) {
      for (let s = start; s < start + cnt; s++) { S[s].x = r.R(W - 2 * m) + m; S[s].y = r.R(H - 2 * m) + m; }
    } else if (land.placement === 1) {
      for (let s = start; s < start + cnt; s++) { S[s].x = land.baseX; S[s].y = land.baseY; }
    } else if (land.placement === 2) {
      for (let s = start; s < start + cnt; s++) {
        // The original tries for ever; a map it could not finish is not worth hanging the game for.
        for (let tries = 0; tries < 100000; tries++) {
          const x = r.R(W - 2 * m) + m, y = r.R(H - 2 * m) + m;
          if (minX < x && x < maxX && minY < y && y < maxY) continue;
          let near = false;
          for (let t = start; t < s; t++) {
            if (Math.fround((x - S[t].x) ** 2 + (y - S[t].y) ** 2) <= dSq) {
              // As the original does: a try too near the land just placed moves that land there.
              if (t === s - 1) { S[t].x = x; S[t].y = y; }
              near = true;
              break;
            }
          }
          if (near) continue;
          S[s].x = x; S[s].y = y;
          break;
        }
      }
    }
  }

  // ---- lands, run

  private runLands() {
    const n = this.slots.length;
    this.lists.clearLinks();
    this.zone.fill(n);
    this.terrain.fill(this.baseTerrain);
    this.grow();
    this.cleanup(this.baseTerrain);
  }

  /** The lands grow, a tile at a time each in turn, from a square round their origin (FUN_00471140). */
  private grow() {
    const W = this.W, H = this.H, S = this.slots, n = S.length, L = this.lists, r = this.rng;
    const heads = S.map((_, i) => this.landHeads[i]);
    const cnt = new Array<number>(Math.max(n, 256)).fill(0);
    S.forEach((s, i) => {
      cnt[i] = 0;
      const rr = s.baseSize;
      const x0 = Math.max(0, s.x - rr), y0 = Math.max(0, s.y - rr), x1 = Math.min(W - 1, s.x + rr), y1 = Math.min(H - 1, s.y + rr);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.terrain[this.at(x, y)] = s.terrain; this.zone[this.at(x, y)] = s.zone; }
      // As the original does, the count is kept by zone, not by land.
      cnt[s.zone] = (y1 - y0 + 1) * (x1 - x0 + 1);
      const push = (x: number, y: number) => L.insertSorted(heads[i], this.at(x, y), 0);
      if (x0 > 0) for (let y = y0; y <= y1; y++) push(x0 - 1, y);
      if (y0 > 0) for (let x = x0; x <= x1; x++) push(x, y0 - 1);
      if (x1 < W - 1) for (let y = y0; y <= y1; y++) push(x1 + 1, y);
      if (y1 < H - 1) for (let x = x0; x <= x1; x++) push(x, y1 + 1);
    });
    let active = true;
    while (active) {
      active = false;
      for (let i = 0; i < n; i++) {
        const s = S[i];
        if (cnt[i] >= s.tiles) continue;
        const node = L.pop(heads[i]);
        if (node < 0) continue;
        active = true;
        const x = node % W, y = (node - x) / W;
        const ch = this.borderChance(s, x, y);
        if (r.R(100) < ch) { this.zone[node] = 0xff; continue; }
        const k = this.spacingCheck(s, x, y);
        if (this.zone[node] === n && k > 0) {
          this.terrain[node] = s.terrain;
          this.zone[node] = s.zone;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || this.zone[this.at(nx, ny)] !== n) continue;
            L.insertSorted(heads[i], this.at(nx, ny), r.R(100) - k * s.clumpiness + 250);
          }
          cnt[i]++;
        }
      }
    }
    // One-tile gaps between a land's own tiles are filled.
    S.forEach((s, i) => {
      for (let node = L.pop(heads[i]); node >= 0; node = L.pop(heads[i])) {
        const x = node % W, y = (node - x) / W, z = (a: number, b: number) => this.zone[this.at(a, b)] === s.zone;
        if ((x >= 1 && x < W - 1 && z(x - 1, y) && z(x + 1, y)) || (y >= 1 && y < H - 1 && z(x, y - 1) && z(x, y + 1))) this.terrain[node] = s.terrain;
      }
    });
  }

  /** How likely, out of 100, a tile near the map's margins is left out of a land (FUN_004710a0). */
  private borderChance(s: Slot, x: number, y: number) {
    const u = s.usage;
    if (!u) return 0;
    const W = this.W, A = s.xMin, B = s.yMin, C = s.xMax, D = s.yMax;
    const ex = Math.max(A - x, x - C), e2 = Math.max(2 * A - x, x + W - 2 * C);
    const ey = e2 > 0 ? Math.max(B + e2 - y, e2 - D + y) : Math.max(B - y, y - D);
    const ch = (Math.max(ex, 0) + Math.max(ey, 0)) * u;
    return ch >= 100 ? 101 : ch;
  }

  /** 0 when another land is within its spacing; else how many of its own tiles are in the 5 x 5 round it. */
  private spacingCheck(s: Slot, x: number, y: number) {
    const W = this.W, H = this.H, n = this.slots.length, sp = s.spacing;
    if (this.zone[this.at(x, y)] !== n) return 0;
    let c = 0;
    for (let dy = -sp; dy <= sp; dy++) for (let dx = -sp; dx <= sp; dx++) {
      const a = x + dx, b = y + dy;
      if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const v = this.zone[this.at(a, b)];
      if (v === s.zone) { if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) c++; }
      else if (v < n) return 0;
    }
    return c & 0xff;
  }

  /** Tiles pinched between tiles of `base` become `base`, until nothing changes (FUN_00446930). */
  protected cleanup(base: number) {
    const W = this.W, H = this.H, t = this.terrain;
    const is = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && t[this.at(x, y)] === base;
    let changed = true;
    while (changed) {
      changed = false;
      for (const pass of [0, 1]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (t[this.at(x, y)] === base) continue;
        const U = is(x, y - 1), D = is(x, y + 1), L = is(x - 1, y), R = is(x + 1, y);
        const UL = is(x - 1, y - 1), UR = is(x + 1, y - 1), DL = is(x - 1, y + 1), DR = is(x + 1, y + 1);
        let chg = false;
        if (pass === 0) chg = (U && D) || (L && R);
        else {
          chg = UL && ((UR && !U) || (R && !UR) || (DL && !L) || (D && !DL) || (DR && !D && !R));
          if (!chg && UR) chg = (UL && !U) || (L && !UL) || (DR && !R) || (D && !DR) || (DL && !L && !D);
          if (!chg && DR) chg = (UR && !R) || (U && !UR) || (DL && !D) || (L && !DL) || (UL && !L && !U);
          if (!chg && DL) chg = (UL && !L) || (U && !UL) || (DR && !D) || (R && !DR) || (UR && !R && !U);
        }
        // A tile set this way gets its new terrain's own things, as every tile the game sets does (FUN_00449010).
        if (chg) { t[this.at(x, y)] = base; this.terrainUnits(x, y, false); changed = true; }
      }
    }
  }

  // ---- a terrain's own things, and whether a thing may stand somewhere

  /** The things a tile's terrain brings (FUN_00448600 when a tile is set; FUN_004481b0, `all`, when the objects
   *  step goes over the whole map): for each, a spot (random, or the middle of the tile), then a roll against its
   *  density, then the thing if it fits. Each roll is drawn whether or not anything comes of it. */
  private terrainUnits(x: number, y: number, all: boolean) {
    const r = this.rng;
    let fx = f32(0), fy = f32(0);
    for (const [id, density, centred] of TERRAIN_UNITS[this.terrain[this.at(x, y)]]) {
      for (let k = density; k > 0; k -= 1000) {
        if (centred === 0) { fx = f32(x - r.rand() * INV); fy = f32(y - r.rand() * INV); }
        else if (centred === 1 || !all) { fx = f32(x - HALF); fy = f32(y - HALF); }
        const roll = k < 1000 ? Math.trunc((r.rand() * 1000) / 0x7fff) < k : true;
        if (roll && this.canPlace(id, fx, fy, true, false) === 0) this.create(id, "-", 0, fx, fy);
      }
    }
  }

  /** Whether a thing of unit `id` may be put at (fx, fy): 0 if so (the original's FUN_00443700, its arguments
   *  as the generator passes them: the ground's slope looked at, nothing explored asked for). `clearance`: the
   *  thing's clearance for its size, else its footprint; `others`: as the lands' own objects do, test against
   *  things that stand on the ground even when this one does not. */
  canPlace(id: number, fx: number, fy: number, clearance: boolean, others: boolean): number {
    const u = UNITS.get(id);
    if (!u) return 7;
    const W = this.W, H = this.H, t = this.terrain;
    const sx = clearance ? u.clearance[0] : u.size[0], sy = clearance ? u.clearance[1] : u.size[1];
    const L = f32(fx - sx), R = f32(fx + sx - MILLI), T = f32(fy - sy), B = f32(fy + sy - MILLI);
    if (L < 0 || W <= R || T < 0 || H <= B) return 7;
    const tx0 = Math.trunc(L), tx1 = Math.trunc(R), ty0 = Math.trunc(T), ty1 = Math.trunc(B);
    let bx0 = tx0, bx1 = tx1, by0 = ty0, by1 = ty1;
    const [p0, p1] = u.onTerrain;
    if (p0 >= 0 || p1 >= 0) {
      const cx = Math.trunc(fx), cy = Math.trunc(fy), c = t[this.at(cx, cy)];
      if (c !== p0 && c !== p1) return 1;
      bx0 = bx1 = cx; by0 = by1 = cy;
    }
    const [s0, s1] = u.besideTerrain;
    if (s0 >= 0 || s1 >= 0) {
      // The row above, the column to the right, the row below, the column to the left: no corners.
      let near = false;
      const see = (a: number, b: number) => { const v = t[this.at(a, b)]; if (v === s0 || v === s1) near = true; };
      if (by0 - 1 >= 0) for (let a = bx0; a <= bx1; a++) see(a, by0 - 1);
      if (bx1 + 1 < W) for (let b = by0; b <= by1; b++) see(bx1 + 1, b);
      if (by1 + 1 < H) for (let a = bx1; a >= bx0; a--) see(a, by1 + 1);
      if (bx0 - 1 >= 0) for (let b = by1; b >= by0; b--) see(bx0 - 1, b);
      if (!near) return 1;
    }
    for (let a = tx0; a <= tx1; a++) for (let b = ty0; b <= ty1; b++) {
      if (!u.on.has(t[this.at(a, b)])) return 2;
      const s = this.shapeAt(a, b);
      if (u.hill === 1 && s !== 0 && s !== 5 && s !== 6 && s !== 7 && s !== 8) return 3;
      if (u.hill === 2 && s !== 0) return 3;
    }
    if (sx <= 0 && sy <= 0) return 0;
    if (!others && u.size[2] <= 0) return 0;
    const x0 = Math.max(0, Math.trunc(f32(fx - 3))), x1 = Math.min(W - 1, Math.trunc(f32(fx + 3)));
    const y0 = Math.max(0, Math.trunc(f32(fy - 3))), y1 = Math.min(H - 1, Math.trunc(f32(fy + 3)));
    for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) for (const p of this.grid.get(this.at(a, b)) ?? []) {
      if (p.gone) continue;
      const m = p.id === undefined ? undefined : UNITS.get(p.id);
      if (!m || m.size[0] <= 0 || m.size[1] <= 0) continue;
      // A land's own things pass over what can be built on (the trees of a forest, tufts), when they cannot be.
      if (others && m.buildOn === 1 && u.buildOn === 0) continue;
      if ((m.size[2] > 0) !== (u.size[2] > 0)) continue;
      // Worked out on the FPU's stack, so not rounded to a float.
      if (Math.abs(p.x - fx) < m.size[0] + sx && Math.abs(p.y - fy) < m.size[1] + sy) return 6;
    }
    return 0;
  }

  /** Each tile's slope from the elevation round it (FUN_004493a0): 0 flat, 5 to 8 one side up, 13 to 16 two
   *  sides, 1 to 4 and 9 to 12 a corner. */
  private slopes() {
    const W = this.W, H = this.H, e = this.elevation, out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = e[this.at(x, y)], up = h + 1, dn = h - 1;
      const at = (a: number, b: number, ok: boolean) => (ok ? e[this.at(a, b)] : h);
      const NE = at(x + 1, y - 1, y > 0 && x < W - 1), N = at(x, y - 1, y > 0), E = at(x + 1, y, x < W - 1);
      const SW = at(x - 1, y + 1, x > 0 && y < H - 1), Wv = at(x - 1, y, x > 0), S = at(x, y + 1, y < H - 1);
      const NW = at(x - 1, y - 1, y > 0 && x > 0), SE = at(x + 1, y + 1, y < H - 1 && x < W - 1);
      let s = 0;
      if (N === up && E === up) s = 14;
      else if (Wv === up && S === up) s = 13;
      else if (N === up && Wv === up) s = 16;
      else if (E === up && S === up) s = 15;
      else if (N === up) s = 6;
      else if (E === up) s = 8;
      else if (Wv === up) s = 5;
      else if (S === up) s = 7;
      else if (NE === up) s = Wv === dn && S === dn ? 2 : 10;
      else if (SW === up) s = N === dn && E === dn ? 1 : 9;
      else if (NW === up) s = E === dn && S === dn ? 3 : 11;
      else if (SE === up) s = N === dn && Wv === dn ? 4 : 12;
      out[this.at(x, y)] = s;
    }
    return out;
  }

  /** The slope of a tile (the original's tile shape): 0 flat. Worked out from the elevation once it is set. */
  private shapes: Uint8Array | null = null;
  private shapeAt(x: number, y: number) { return this.shapes ? this.shapes[this.at(x, y)] : 0; }

  /** Makes a thing. As in the original, every thing made leaves the random numbers where it found them (one
   *  drawn, then the generator set to it), and a moving thing with several facings draws one more for its own.
   *  A unit (genie type 70: villagers, animals) draws one more before all that and one after: the saves show
   *  both (the stone and gold round each Town Center come out only so), the code read so far does not say where. */
  private create(id: number, unit: string, player: number, fx: number, fy: number) {
    if (UNITS.get(id)?.type === 70) this.rng.rand();
    const p: Placed = { unit, player, x: fx, y: fy, group: this.groupId, id };
    this.placed.push(p);
    const k = this.at(Math.trunc(fx), Math.trunc(fy));
    (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(p);
    this.rng.srand(this.rng.rand());
    if (UNITS.get(id)?.facing) this.rng.rand();
    if (UNITS.get(id)?.type === 70) this.rng.rand();
    return p;
  }

  // ---- start zones: kept free of patches and hills, a ring round each land with a start radius

  /** {x, y, radius, fade} round the lands that have a start radius, from the lands as they stand now. */
  private startZones() {
    const out: { x: number; y: number; r: number; w: number }[] = [];
    let k = 0;
    for (const l of this.map.lands) {
      if (l.startRadius < 0) continue;
      const n = l.byPlayer === 0 ? 1 : this.players;
      for (let j = 0; j < n; j++, k++) { const s = this.slots[k]; if (s) out.push({ x: s.x, y: s.y, r: l.startRadius, w: l.edgeFade }); }
    }
    return out;
  }

  /** How strongly each tile is kept free, 0 to 101 (FUN_004746e0, FUN_00470700). */
  private avoidMap(zones: { x: number; y: number; r: number; w: number }[]) {
    const W = this.W, H = this.H, out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0;
      for (const z of zones) { const d = Math.trunc(Math.sqrt((x - z.x) ** 2 + (y - z.y) ** 2)); if (z.r - d > 0) s += z.w * (z.r - d); }
      out[this.at(x, y)] = s > 100 ? 101 : s;
    }
    return out;
  }

  // ---- patches of other ground (desert, forests, deep water): module FUN_00474270

  private patches: { count: number; terrain: number; clumps: number; spacing: number; on: number; clumpiness: number; mode: number }[] = [];
  private terrainZones: { x: number; y: number; r: number; w: number }[] = [];

  protected terrainInit() {
    const m = this.map, r = this.rng;
    const landTiles = Math.trunc((this.W * this.H * m.landCoverage) / 100);
    this.patches = m.terrains.map((t) => ({
      count: Math.trunc(t.proportion * landTiles * Math.fround(0.0099999998)), terrain: t.terrain, clumps: t.clumps,
      spacing: t.edgeSpacing, on: t.on, clumpiness: t.clumpiness, mode: 1,
    }));
    this.terrainZones = this.startZones();
    const f = Math.fround(landTiles * Math.fround(0.00005));
    for (const e of this.patches) if (e.terrain !== T.desert && f > 1) e.clumps = Math.trunc(e.clumps * f);
    if (r.rand() < 0x1fff) {
      // One map in four: more palms and desert, half the forests.
      for (const e of this.patches) {
        if (e.terrain === T.palm) { e.count *= 3; e.clumps *= 3; e.mode = 2; }
        else if (e.terrain === T.jungle || e.terrain === T.pine) { e.count = Math.trunc(e.count / 2); e.clumps = Math.trunc(e.clumps / 2); }
        else if (e.terrain === T.forest) { e.count = Math.trunc(e.count / 2); e.clumps = Math.trunc(e.clumps / 2); e.mode = 2; }
        else if (e.terrain === T.desert) { e.count *= 2; e.mode = 0; }
      }
    } else for (const e of this.patches) {
      if (e.terrain === T.desert) e.mode = 0;
      else if (e.terrain === T.forest || e.terrain === T.palm) e.mode = 2;
    }
    r.rand(); // "terrain initialization"
  }

  protected runTerrain() {
    const N = this.W * this.H;
    const L = new Lists(N, 101);
    const heads = Array.from({ length: 99 }, () => L.head()), cand = L.head();
    const avoid = this.avoidMap(this.terrainZones);
    // Connected stretches of grass and of anything else, as they are before the patches go down.
    const zones = this.components((t) => t !== T.grass);
    for (const e of this.patches) this.growPatch(e, L, heads, cand, avoid, zones);
    this.beaches();
  }

  /** `1 +` the tiles of terrain t in the 5 x 5 round (x, y), or 0 when the ground within `spacing` is not all
   *  terrain `on` (or what may border it, or t itself) (FUN_00474520). */
  private patchCheck(t: number, x: number, y: number, spacing: number, on: number) {
    const W = this.W, H = this.H;
    if (spacing > 0) for (let b = Math.max(0, y - spacing); b <= Math.min(H - 1, y + spacing); b++)
      for (let a = Math.max(0, x - spacing); a <= Math.min(W - 1, x + spacing); a++) {
        const v = this.terrain[this.at(a, b)];
        if (v !== on && v !== IMPASSABLE[on] && v !== t) return 0;
      }
    let c = 1;
    for (let b = Math.max(0, y - 2); b <= Math.min(H - 1, y + 2); b++)
      for (let a = Math.max(0, x - 2); a <= Math.min(W - 1, x + 2); a++) if (this.terrain[this.at(a, b)] === t) c++;
    return c & 0xff;
  }

  /** Every tile in a list in index order, then random tiles moved to its front (FUN_004747f0, FUN_00470810).
   *  `linkHead` false is the elevation's version, which never sets the head: see the spec. */
  private randomList(L: Lists, head: number, picks: number, linkHead: boolean) {
    const N = this.W * this.H;
    L.next[head] = linkHead ? 0 : -1; L.prev[head] = -1;
    for (let i = 0; i < N; i++) { L.next[i] = i + 1 < N ? i + 1 : -1; L.prev[i] = i === 0 ? head : i - 1; }
    for (let k = 0; k < picks; k++) {
      const x = this.rng.R(this.W - 1), y = this.rng.R(this.H - 1);
      L.pushAfter(head, this.at(x, y));
    }
  }

  private unlinkSquare(L: Lists, x: number, y: number, r: number, yBug = false) {
    const W = this.W, H = this.H;
    const x1 = Math.min(W - 1, x + r), y1 = yBug ? Math.min(x + r, W - 1) : Math.min(H - 1, y + r);
    for (let b = Math.max(0, y - r); b <= y1; b++) for (let a = Math.max(0, x - r); a <= x1; a++) L.unlink(this.at(a, b));
  }

  private growPatch(e: { count: number; terrain: number; clumps: number; spacing: number; on: number; clumpiness: number; mode: number },
    L: Lists, lists: number[], cand: number, avoid: Uint8Array, zones: Int32Array) {
    const W = this.W, H = this.H, r = this.rng, T0 = e.terrain, P = e.on, C = Math.min(e.clumps, 98);
    const zid = this.terrainZones.map((z) => zones[this.at(z.x, z.y)]), covered = zid.map(() => false);
    let coveredN = 0;
    for (const h of lists) { L.next[h] = L.prev[h] = -1; }
    this.randomList(L, cand, (W * H) >> 3, true);
    const excl = C > 0 ? Math.max(2, Math.trunc(Math.sqrt(e.count / C)) * 2) : 2;
    let placed = 0, seeded = 0;
    const seed = (x: number, y: number) => {
      this.unlinkSquare(L, x, y, excl);
      this.terrain[this.at(x, y)] = T0;
      const list = lists[Math.min(seeded, 98)];
      if (x > 0) L.insertSorted(list, this.at(x - 1, y), 0);
      if (y > 0) L.insertSorted(list, this.at(x, y - 1), 0);
      if (x < W - 1) L.insertSorted(list, this.at(x + 1, y), 0);
      if (y < H - 1) L.insertSorted(list, this.at(x, y + 1), 0);
      placed++; seeded++;
    };
    while (seeded < C) {
      const n = L.pop(cand);
      if (n < 0) break;
      const x = n % W, y = (n - x) / W;
      if (this.terrain[n] === P && this.patchCheck(T0, x, y, e.spacing, P) && (e.mode === 0 || avoid[n] === 0)) {
        seed(x, y);
        if (e.mode === 2) { const z = zones[n]; zid.forEach((k, i) => { if (k === z && !covered[i]) { covered[i] = true; coveredN++; } }); }
      }
    }
    if (e.mode === 2) while (coveredN < zid.length) {
      // One clump on every start's own stretch of land.
      const n = L.pop(cand);
      if (n < 0) break;
      const x = n % W, y = (n - x) / W;
      if (this.terrain[n] !== P || !this.patchCheck(T0, x, y, e.spacing, P) || avoid[n] >= 30) continue;
      const k = zid.findIndex((z, i) => z === zones[n] && !covered[i]);
      if (k < 0) continue;
      covered[k] = true; coveredN++;
      seed(x, y);
    }
    let done = false;
    while (!done) {
      done = true;
      for (let i = 0; i < seeded; i++) {
        if (placed >= e.count) continue;
        const n = L.pop(lists[Math.min(i, 98)]);
        if (n < 0) continue;
        done = false;
        const x = n % W, y = (n - x) / W;
        if (e.mode !== 0 && avoid[n] > r.R(100)) continue;
        const cnt = this.patchCheck(T0, x, y, e.spacing, P);
        if (this.terrain[n] !== P || !cnt) continue;
        const pr = 250 - e.clumpiness * cnt + (e.mode !== 0 ? avoid[n] : 0);
        this.terrain[n] = T0;
        for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (a < 0 || b < 0 || a >= W || b >= H || this.terrain[this.at(a, b)] !== P) continue;
          L.insertSorted(lists[Math.min(i, 98)], this.at(a, b), Math.fround(r.R(100) + pr));
        }
        placed++;
      }
    }
    // Gaps of one tile across a patch are filled; the original only ever fills them across, not up and down.
    for (let i = 0; i < C; i++) for (let n = L.pop(lists[i]); n >= 0; n = L.pop(lists[i])) {
      const x = n % W;
      if (x > 0 && x < W - 1 && this.terrain[n - 1] === T0 && this.terrain[n + 1] === T0) this.terrain[n] = T0;
    }
    for (const h of lists) L.release(h);
  }

  /** Any land tile next to water (corners too) becomes beach (FUN_00474380). */
  private beaches() {
    const W = this.W, H = this.H, wet = (t: number) => t === T.water || t === T.shallows || t === T.deep;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.at(x, y);
      if (wet(this.terrain[i])) continue;
      let near = false;
      for (let b = y - 1; b <= y + 1 && !near; b++) for (let a = x - 1; a <= x + 1; a++) {
        if ((a !== x || b !== y) && a >= 0 && b >= 0 && a < W && b < H && wet(this.terrain[this.at(a, b)])) { near = true; break; }
      }
      if (near) this.terrain[i] = T.beach;
    }
  }

  /** 4-connected stretches of tiles alike by `test`, numbered row by row, wrapping after 254 (FUN_00523a60). */
  private components(test: (t: number) => boolean) {
    const W = this.W, H = this.H, N = W * H, out = new Int32Array(N).fill(-1), stack: number[] = [];
    let id = 0;
    for (let i = 0; i < N; i++) {
      if (out[i] >= 0) continue;
      const p = test(this.terrain[i]);
      out[i] = id; stack.push(i);
      while (stack.length) {
        const c = stack.pop()!, x = c % W, y = (c - x) / W;
        for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const k = b * W + a;
          if (out[k] < 0 && test(this.terrain[k]) === p) { out[k] = id; stack.push(k); }
        }
      }
      id = id >= 254 ? 0 : id + 1;
    }
    return out;
  }

  // ---- hills: module FUN_00470380 (empires.dat's own elevation lists are read and never used)

  private layers: { count: number; height: number; clumps: number; spacing: number; base: number }[] = [];
  private elevationZones: { x: number; y: number; r: number; w: number }[] = [];

  protected elevationInit() {
    const r = this.rng, landTiles = Math.trunc((this.H * this.map.landCoverage * this.W) / 100);
    this.layers = [
      { count: Math.trunc((landTiles * 10) / 100), height: 1, clumps: 10, spacing: 2, base: 0 },
      { count: Math.trunc((landTiles * 8) / 100), height: 2, clumps: 8, spacing: 1, base: 1 },
      { count: Math.trunc((landTiles * 6) / 100), height: 3, clumps: 6, spacing: 1, base: 2 },
      { count: Math.trunc((landTiles * 4) / 100), height: 4, clumps: 4, spacing: 1, base: 3 },
    ];
    // Built from the lands as they are now: on the Mediterranean the sea has gone in first, as in the original.
    this.elevationZones = this.startZones();
    let f = Math.fround((70 - r.rand() * Math.fround(-0.0018311106)) * Math.fround(0.0099999998));
    if (this.map.id === 7) f = Math.fround(f * 5); // Hill Country
    for (const l of this.layers) l.count = Math.trunc(l.count * f);
    r.rand(); // "elevation initialization"
  }

  protected runElevation() {
    const W = this.W, H = this.H, N = W * H, L = new Lists(N, 12), r = this.rng;
    const heads = Array.from({ length: 10 }, () => L.head()), cand = L.head();
    this.elevation.fill(this.layers[0]?.base ?? 0);
    const avoid = this.avoidMap(this.elevationZones);
    const P = T.grass, e = this.elevation;
    for (const ly of this.layers) {
      const C = Math.min(ly.clumps, 10), B = ly.base, Hh = ly.height, S = ly.spacing;
      for (const h of heads) L.next[h] = L.prev[h] = -1;
      this.randomList(L, cand, Math.trunc((W * H) / 16), false);
      const excl = Math.max(2, Math.trunc(Math.trunc(Math.sqrt(ly.count / C)) / 2));
      const flat = (x: number, y: number) => {
        for (let b = Math.max(0, y - S); b <= Math.min(H - 1, y + S); b++) for (let a = Math.max(0, x - S); a <= Math.min(W - 1, x + S); a++) {
          const i = this.at(a, b);
          if (this.terrain[i] !== P || e[i] < B) return false;
        }
        return true;
      };
      const near = (x: number, y: number) => {
        if (S > 0 && !flat(x, y)) return 0;
        let c = 0;
        for (let b = Math.max(0, y - 2); b <= Math.min(H - 1, y + 2); b++) for (let a = Math.max(0, x - 2); a <= Math.min(W - 1, x + 2); a++) if (e[this.at(a, b)] === Hh) c++;
        return c;
      };
      let placed = 0, i = 0;
      while (i < C) {
        const n = L.pop(cand);
        if (n < 0) break;
        const x = n % W, y = (n - x) / W;
        if (avoid[n] !== 0 || !flat(x, y)) continue;
        this.unlinkSquare(L, x, y, excl, true);
        e[n] = Hh;
        if (x > 0) L.insertSorted(heads[i], this.at(x - 1, y), 0);
        if (y > 0) L.insertSorted(heads[i], this.at(x, y - 1), 0);
        if (x < W - 1) L.insertSorted(heads[i], this.at(x + 1, y), 0);
        if (y < H - 1) L.insertSorted(heads[i], this.at(x, y + 1), 0);
        placed++; i++;
      }
      let done = false;
      while (!done) {
        done = true;
        for (let k = 0; k < C; k++) {
          if (placed >= ly.count) continue;
          const n = L.pop(heads[k]);
          if (n < 0) continue;
          done = false;
          const x = n % W, y = (n - x) / W;
          if (r.R(100) < avoid[n]) { avoid[n] = 101; continue; }
          const cnt = near(x, y);
          if (e[n] !== B || !cnt) continue;
          const pr = 250 - 15 * cnt;
          e[n] = Hh;
          for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (a < 0 || b < 0 || a >= W || b >= H || e[this.at(a, b)] !== B) continue;
            L.insertSorted(heads[k], this.at(a, b), Math.fround(r.R(100) + pr));
          }
          placed++;
        }
      }
      for (const h of heads) L.release(h);
      this.smooth();
    }
  }

  /** Slopes: pits filled and no step of more than one, only ever raising tiles (FUN_00446360). */
  private smooth() {
    const W = this.W, H = this.H, e = this.elevation;
    const up = (x: number, y: number, v: number) => x >= 0 && y >= 0 && x < W && y < H && e[this.at(x, y)] > v;
    for (;;) {
      for (let changed = true; changed;) {
        changed = false;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const v = e[this.at(x, y)];
          if ((up(x, y - 1, v) && up(x, y + 1, v)) || (up(x + 1, y, v) && up(x - 1, y, v))) { e[this.at(x, y)] = v + 1; changed = true; }
        }
      }
      let b = false, c = false;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = e[this.at(x, y)];
        const N = up(x, y - 1, v), S = up(x, y + 1, v), Wf = up(x - 1, y, v), E = up(x + 1, y, v);
        const NW = up(x - 1, y - 1, v), NE = up(x + 1, y - 1, v), SW = up(x - 1, y + 1, v), SE = up(x + 1, y + 1, v);
        const bad = (NW && ((NE && !N) || (E && !NE) || (SW && !Wf) || (S && !SW) || (SE && !S && !E)))
          || (NE && ((SE && !E) || (S && !SE) || (NW && !N) || (Wf && !NW) || (SW && !Wf && !S)))
          || (SE && ((SW && !S) || (Wf && !SW) || (NE && !E) || (N && !NE) || (NW && !N && !Wf)))
          || (SW && ((NW && !Wf) || (N && !NW) || (SE && !S) || (E && !SE) || (NE && !E && !N)));
        if (bad) { e[this.at(x, y)] = v + 1; b = true; }
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = e[this.at(x, y)];
        let high = false;
        for (let bb = y - 1; bb <= y + 1 && !high; bb++) for (let a = x - 1; a <= x + 1; a++) if ((a !== x || bb !== y) && up(a, bb, v + 1)) { high = true; break; }
        if (high) { e[this.at(x, y)] = v + 1; c = true; }
      }
      if (!b && !c) return;
    }
  }

  // ---- shallows: module FUN_00472b10, a way through the water between every two lands

  private shallowPoints: { x: number; y: number }[] = [];

  protected runShallows() {
    const W = this.W, H = this.H, r = this.rng, pts = [...this.shallowPoints];
    const L = new Lists(W * H, 3);
    const wet = (t: number) => t === T.water || t === T.deep || t === T.shallows;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) this.shallowPath(L, pts[i], pts[j]);
    const n = pts.length + 2;
    for (let k = 0; k < 2; k++) {
      let x: number, y: number;
      do { x = r.R(W - 1); y = r.R(H - 1); } while (wet(this.terrain[this.at(x, y)]));
      pts[n - 1] = { x, y };
      do { x = r.R(W - 1); y = r.R(H - 1); } while (wet(this.terrain[this.at(x, y)]));
      pts[n - 2] = { x, y };
      this.shallowPath(L, pts[n - 1], pts[n - 2]);
    }
  }

  private shallowPath(L: Lists, a: { x: number; y: number }, b: { x: number; y: number }) {
    const W = this.W, H = this.H, r = this.rng;
    const grid = this.astar(L, a, b);
    if (!grid) return;
    const local = this.pathHead(L);
    const water = (t: number) => t === T.water || t === T.deep;
    let cx = b.x, cy = b.y;
    for (;;) {
      const code = grid[this.at(cx, cy)];
      const step: Record<number, [number, number]> = { 6: [0, 1], 7: [0, -1], 8: [1, 1], 4: [1, 0], 9: [1, -1], 10: [-1, 1], 5: [-1, 0], 11: [-1, -1] };
      const d = step[code];
      const nx = d ? cx + d[0] : -1, ny = d ? cy + d[1] : -1;
      if (!d || nx < 0 || ny < 0 || nx >= W || ny >= H) {
        for (let n = L.pop(local); n >= 0; n = L.pop(local)) this.terrain[n] = T.shallows;
        L.release(local);
        return;
      }
      // The tile stepped onto is the one looked at: so the start is, the target never (asm 472e4c).
      if (water(this.terrain[this.at(nx, ny)])) {
        const x0 = Math.max(0, nx - r.R(2) - 1), y0 = Math.max(0, ny - r.R(2) - 1);
        const x1 = Math.min(W - 1, r.R(2) + 1 + nx), y1 = Math.min(H - 1, r.R(3) + 1 + ny);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (water(this.terrain[this.at(x, y)])) L.insertSorted(local, this.at(x, y), 0);
      } else {
        for (const [x, y] of [[nx - 1, ny], [nx + 1, ny], [nx, ny - 1], [nx, ny + 1]]) {
          if (x >= 0 && y >= 0 && x < W && y < H && water(this.terrain[this.at(x, y)])) L.insertSorted(local, this.at(x, y), 0);
        }
      }
      grid[this.at(cx, cy)] = 0xff;
      cx = nx; cy = ny;
    }
  }

  private pathHeads = new WeakMap<Lists, [number, number]>();
  private pathHead(L: Lists) { return this.pathHeadsOf(L)[1]; }
  private pathHeadsOf(L: Lists) {
    let h = this.pathHeads.get(L);
    if (!h) { h = [L.head(), L.head()]; this.pathHeads.set(L, h); }
    return h;
  }

  /** The cheapest way from a to b over the ground, as the original searches it (FUN_0046d700): grass and beach 1,
   *  shallows 2, water 7, deep water 14; anything else is no way. Returns the grid of where each tile was reached from. */
  private astar(L: Lists, a: { x: number; y: number }, b: { x: number; y: number }): Uint8Array | null {
    const W = this.W, H = this.H, grid = new Uint8Array(W * H), open = this.pathHeadsOf(L)[0];
    const COST: Record<number, number> = { [T.grass]: 1, [T.water]: 7, [T.beach]: 1, [T.shallows]: 2, [T.deep]: 14 };
    const cost = (x: number, y: number) => COST[this.terrain[this.at(x, y)]] ?? 0;
    L.clearLinks();
    L.next[open] = L.prev[open] = -1;
    grid[this.at(a.x, a.y)] = 3;
    grid[this.at(b.x, b.y)] = 2;
    if (cost(b.x, b.y) <= 0) return null;
    const gOf = new Float32Array(W * H);
    let x = a.x, y = a.y, g = 0;
    const tx = b.x, ty = b.y;
    let d = Math.fround(Math.sqrt((x - tx) ** 2 + (y - ty) ** 2));
    let found = false;
    const visit = (nx: number, ny: number, code: number, gg: number, prio: number): boolean | "found" => {
      const i = this.at(nx, ny);
      if (grid[i] === 0) {
        if (cost(nx, ny) <= 0) { grid[i] = 1; return false; }
        grid[i] = code; gOf[i] = Math.fround(gg); L.insertSorted(open, i, Math.fround(prio));
        return true;
      }
      if (grid[i] === 2) { grid[i] = code; return "found"; }
      return grid[i] !== 1;
    };
    const diag = (nx: number, ny: number, code: number, both: boolean, gg: number, prio: number): boolean | "found" => {
      const i = this.at(nx, ny);
      if (grid[i] === 0) {
        if (cost(nx, ny) <= 0) { grid[i] = 1; return false; }
        if (both) { grid[i] = code; gOf[i] = Math.fround(gg); L.insertSorted(open, i, Math.fround(prio)); }
        return false;
      }
      if (grid[i] === 2) { grid[i] = code; return "found"; }
      return false;
    };
    while (d !== 0 && !found) {
      let bS = false, bN = false, bW = false, bE = false;
      const res = (v: boolean | "found") => { if (v === "found") found = true; return v === true; };
      if (y < H - 1) { const s = y < ty ? 1 : -1, gg = Math.fround(g + cost(x, y + 1)); bS = res(visit(x, y + 1, 7, gg, gg + (d - s))); }
      if (!found && y > 0) { const s = ty < y ? 1 : -1, gg = Math.fround(g + cost(x, y - 1)); bN = res(visit(x, y - 1, 6, gg, gg + (d - s))); }
      if (!found && x > 0) {
        const s = tx < x ? 1 : -1, dW = Math.fround(d - s), gg = Math.fround(g + cost(x - 1, y));
        bW = res(visit(x - 1, y, 4, gg, gg + dW));
        if (!found && y > 0) { const g2 = Math.fround(g + Math.fround(1.36) * cost(x - 1, y - 1)); res(diag(x - 1, y - 1, 8, bN && bW, g2, g2 + (dW - (ty < y ? Math.fround(0.41) : -Math.fround(0.41))))); }
        if (!found && y < H - 1) { const g2 = Math.fround(g + Math.fround(1.36) * cost(x - 1, y + 1)); res(diag(x - 1, y + 1, 9, bS && bW, g2, g2 + (dW - (y < ty ? Math.fround(0.41) : -Math.fround(0.41))))); }
      }
      if (!found && x < W - 1) {
        const s = x < tx ? 1 : -1;
        d = Math.fround(d - s);
        const gg = Math.fround(g + cost(x + 1, y));
        bE = res(visit(x + 1, y, 5, gg, gg + d));
        if (!found && y > 0) { const g2 = Math.fround(g + Math.fround(1.36) * cost(x + 1, y - 1)); res(diag(x + 1, y - 1, 10, bN && bE, g2, g2 + (d - (ty < y ? Math.fround(0.4) : -Math.fround(0.4))))); }
        if (!found && y < H - 1) { const g2 = Math.fround(g + Math.fround(1.36) * cost(x + 1, y + 1)); res(diag(x + 1, y + 1, 11, bS && bE, g2, g2 + (d - (y < ty ? Math.fround(0.4) : -Math.fround(0.4))))); }
      }
      if (found) break;
      const n = L.pop(open);
      if (n < 0) return null;
      x = n % W; y = (n - x) / W; g = gOf[n];
      d = Math.fround(Math.sqrt((x - tx) ** 2 + (y - ty) ** 2));
    }
    return grid;
  }

  // ---- cliffs: module FUN_0046e080, walks over flat ground in steps of 3 tiles

  private cliffPlan: { count: number; base: number; half: number } | null = null;
  /** The tiles the cliff lines run over (the original's terrain 16, grass again at the end). */
  readonly cliff = new Set<number>();

  private planCliffs() {
    const W = this.W, id = this.map.id;
    let [count, len] = W < 73 ? [1, 8] : W < 97 ? [4, 10] : W < 121 ? [6, 10] : W < 145 ? [8, 10] : W < 201 ? [9, 10] : [10, 10];
    if (id === 0) { count = 0; len = 0; }
    else if (id === 1) count -= 5;
    else if (id === 2) count -= 3;
    else if (id === 3 || id === 4) len += 2;
    else if (id === 7) { count += 3; len += 4; }
    if (len < 3) len = 3;
    const half = len - 3 >= 1 ? Math.trunc((len - 3) / 2) : 0, base = len - half;
    this.cliffPlan = base > 0 && count > 0 ? { count, base, half } : null;
  }

  protected runCliffs() {
    const plan = this.cliffPlan;
    if (!plan) return;
    const W = this.W, H = this.H, MW = Math.trunc(W / 3), MH = Math.trunc(H / 3), r = this.rng;
    const L = new Lists(W * H, 104), G = L.head(), buckets = Array.from({ length: 101 }, () => L.head()), P = L.head();
    const grid = new Uint8Array(MW * MH).fill(1);
    const cell = (cx: number, cy: number) => cy * W + cx; // the module's nodes are the map's tiles, used as cells
    const g = (cx: number, cy: number) => grid[cy * MW + cx];
    const clearCells = (cx: number, cy: number, rr: number) => {
      const x1 = Math.min(MW - 1, cx + rr), y1 = x1 > MH - 1 ? Math.min(MH - 1, cy + rr) : cy + rr;
      for (let y = Math.max(0, cy - rr); y <= Math.min(y1, MH - 1); y++) for (let x = Math.max(0, cx - rr); x <= x1; x++) if (grid[y * MW + x]) { grid[y * MW + x] = 0; L.unlink(cell(x, y)); }
    };
    for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
      let uniform = true, water = false, lev = -1;
      for (let y = 3 * cy; y < 3 * cy + 3; y++) for (let x = 3 * cx; x < 3 * cx + 3; x++) {
        const t = this.terrain[this.at(x, y)];
        if (t === T.grass || t === T.desert) { const e = this.elevation[this.at(x, y)]; if (lev < 0) lev = e; else if (e !== lev) uniform = false; }
        else { uniform = false; if (t === T.water || t === T.shallows || t === T.deep) water = true; }
      }
      if (uniform) { if (g(cx, cy) !== 0) { grid[cy * MW + cx] = lev + 1; L.insertSorted(G, cell(cx, cy), 0); } }
      else { if (water) clearCells(cx, cy, 2); grid[cy * MW + cx] = 0; }
    }
    for (const z of this.terrainZones) clearCells(Math.trunc(z.x / 3), Math.trunc(z.y / 3), Math.trunc(z.r / 3) + 2);
    for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
      if (!g(cx, cy)) continue;
      const nb = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < MW && b < MH);
      if (nb.every(([a, b]) => g(a, b) === 0)) { grid[cy * MW + cx] = 0; L.unlink(cell(cx, cy)); }
    }
    // Shuffled: twice, every cell to one of 100 buckets at random, then the buckets taken two at a time.
    for (let pass = 0; pass < 2; pass++) {
      for (let n = L.next[G]; n >= 0; n = L.next[G]) { const k = r.R(100); if (k < 100) L.pushAfter(buckets[k], n); else L.unlink(n); }
      for (let m = 0; m < 50; m++) {
        const A = buckets[2 * m], B = buckets[2 * m + 1];
        for (;;) {
          if (L.next[A] >= 0) L.pushAfter(G, L.next[A]);
          else if (L.next[B] < 0) break;
          if (L.next[B] >= 0) L.pushAfter(G, L.next[B]);
        }
      }
    }
    r.rand(); // drawn and not used
    const steps: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let c = 0; c < plan.count; c++) {
      const len = Math.trunc((r.rand() * plan.half * 2) / 0x7fff) + plan.base - plan.half;
      if (L.next[G] < 0 || len < 3) continue;
      let n = -1;
      do { n = L.pop(G); } while (n >= 0 && grid[(Math.trunc(n / W)) * MW + (n % W)] === 0);
      if (n < 0) break;
      let cx = n % W, cy = Math.trunc(n / W);
      const lev = g(cx, cy);
      L.next[P] = L.prev[P] = -1;
      L.insertSorted(P, n, 0);
      grid[cy * MW + cx] = 0;
      let dir = r.R(4), first = true;
      const step = (d0: number) => {
        let d = d0;
        if (d > 3) d -= 3 * Math.floor((d - 1) / 3);
        if (d < 0) d += 3 * Math.floor((2 - d) / 3);
        const [dx, dy] = steps[d] ?? [0, 0];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || g(nx, ny) !== lev) return false;
        cx = nx; cy = ny;
        return true;
      };
      for (let i = 0; i < len; i++) {
        const k = r.R(100);
        if (k < 18) dir = dir < 1 ? 3 : dir - 1;
        else if (k < 36) dir = dir < 3 ? dir + 1 : 0;
        if (!(step(dir) || step(dir + 1) || step(dir - 1) || (first && step(dir - 2)))) break;
        first = false;
        L.insertSorted(P, cell(cx, cy), 0);
        grid[cy * MW + cx] = 0;
      }
      // Drawn from the last cell back to the first: a line of tiles through the middle of each 3 x 3 cell.
      let prev = -1;
      for (let m = L.pop(P); m >= 0; m = L.pop(P)) {
        const mx = m % W, my = Math.trunc(m / W);
        if (prev < 0) prev = m;
        this.cliffLine(3 * (prev % W) + 1, 3 * Math.trunc(prev / W) + 1, 3 * mx + 1, 3 * my + 1);
        // The pieces of cliff, one per cell, as the walk along the line goes from cell to cell (FUN_004f0ab0). The
        // walk forgets where it was only when a cliff starts (its first, empty stretch): not read in the code (the
        // map's 4f0c70 is not decompiled), but the only way the saves' pieces all come out.
        if (prev === m) this.cliffLast = null;
        this.cliffStep(prev % W, Math.trunc(prev / W));
        this.cliffStep(mx, my);
        clearCells(mx, my, 2);
        prev = m;
      }
    }
  }

  // ---- the pieces of cliff (the map's own cliff tool: FUN_004f0ab0, 004f0490, 004f0170, 004f0300)

  /** The piece in each 3 x 3 cell: which of its four sides (+x, +y, -x, -y) the cliff goes out of, and how
   *  (1 or -1, the side that is high), and the thing that stands for it. */
  private cliffCells = new Map<number, { f: number[]; p: Placed }>();
  private cliffLast: { cx: number; cy: number; dir: number } | null = null;

  /** The line walk reaching cell (cx, cy): from the cell it was in, each of the two gets the side between them. */
  private cliffStep(cx: number, cy: number) {
    if (cx * 3 + 2 >= this.W || cy * 3 + 2 >= this.H || cx < 0 || cy < 0) return;
    const last = this.cliffLast;
    if (last && last.cx === cx && last.cy === cy) return;
    if (!last) { this.cliffLast = { cx, cy, dir: -1 }; return; }
    const dir = last.cx < cx ? 0 : cx < last.cx ? 2 : cy <= last.cy ? 3 : 1;
    const v = this.cliffSide(last.cx, last.cy, dir, 0, last.dir);
    const back = dir + 2 > 3 ? dir - 2 : dir + 2;
    this.cliffLast = { cx, cy, dir: back };
    this.cliffSide(cx, cy, back, v, -1);
  }

  /** Gives a cell's piece a side `dir` (`v` 0: whichever of 1 and -1 makes a piece), keeping at most one other
   *  side (`keep`, or the two it had when it had two), and puts the piece down again (FUN_004f0490). */
  private cliffSide(cx: number, cy: number, dir: number, v: number, keep: number): number {
    const k = cy * this.W + cx, had = this.cliffCells.get(k), f = had ? [...had.f] : [0, 0, 0, 0];
    if (f[dir] !== 0) { if (v === 0) return f[dir]; if (v === f[dir]) return v; }
    if (had) this.cliffRemove(k);
    if (keep === dir) keep = -1;
    let a = -1, av = 0, b = -1, bv = 0;
    if (keep < 0) {
      if (f.filter((x, i) => x !== 0 && i !== dir).length === 2) for (let i = 0; i < 4; i++) if (f[i] !== 0 && i !== dir) {
        if (a < 0) { a = i; av = f[i]; } else { b = i; bv = f[i]; }
        f[i] = 0;
      }
    } else for (let i = 0; i < 4; i++) if (i !== keep) { this.cliffDrop(cx, cy, i); f[i] = 0; }
    const ok = () => cliffPiece(f) !== undefined;
    const tryKeep = () => {
      if (a >= 0) { f[a] = av; if (ok()) { av = 0; return true; } f[a] = 0; }
      if (b >= 0) { f[b] = bv; if (ok()) { bv = 0; return true; } f[b] = 0; }
      return false;
    };
    if (v === 0) {
      v = 1; f[dir] = 1;
      if (!tryKeep() && !ok()) {
        v = -1; f[dir] = -1;
        if (!tryKeep() && !ok()) for (let i = 0; i < 4; i++) if (i !== dir && f[i] !== 0) { this.cliffDrop(cx, cy, i); f[i] = 0; }
      }
      if (av !== 0) this.cliffDrop(cx, cy, a);
      if (bv !== 0) this.cliffDrop(cx, cy, b);
    } else {
      f[dir] = v;
      if (a >= 0) { f[a] = av; if (!ok()) { f[a] = 0; this.cliffDrop(cx, cy, a); } }
      if (b >= 0) { f[b] = bv; if (!ok()) { f[b] = 0; this.cliffDrop(cx, cy, b); } }
      if (!ok()) for (let i = 0; i < 4; i++) if (i !== dir && f[i] !== 0) { this.cliffDrop(cx, cy, i); f[i] = 0; }
    }
    this.cliffPut(cx, cy, f);
    return v;
  }

  /** The neighbour across side `dir` loses its side facing this cell, and is put down again (FUN_004f0300). */
  private cliffDrop(cx: number, cy: number, dir: number) {
    const nx = cx + (dir === 0 ? 1 : dir === 2 ? -1 : 0), ny = cy + (dir === 1 ? 1 : dir === 3 ? -1 : 0);
    // The original bounds the cell by the map's size in tiles.
    if (dir === 0 && nx >= this.W) return;
    if (dir === 1 && ny >= this.H) return;
    if (nx < 0 || ny < 0) return;
    const k = ny * this.W + nx, had = this.cliffCells.get(k);
    if (!had) return;
    this.cliffRemove(k);
    const f = [...had.f];
    f[dir + 2 > 3 ? dir - 2 : dir + 2] = 0;
    this.cliffPut(nx, ny, f);
  }

  private cliffRemove(k: number) {
    const had = this.cliffCells.get(k);
    if (!had) return;
    had.p.gone = true;
    this.cliffCells.delete(k);
  }

  /** The piece for these sides, if there is one: one of two for a straight piece (a random number), then the thing
   *  itself (FUN_004f0170). */
  private cliffPut(cx: number, cy: number, f: number[]) {
    const e = cliffPiece(f);
    if (!e) return;
    let [unit, frame] = [e[0], e[1]];
    if (e[2] >= 0 && this.rng.rand() * 2 > 0x7fff) [unit, frame] = [e[2], e[3]];
    if (unit < 0) return;
    const p = this.create(unit, "cliff", 0, f32(cx * 3 + e[4]), f32(cy * 3 + e[5]));
    p.frame = frame;
    this.cliffCells.set(cy * this.W + cx, { f: [...f], p });
  }

  /** A line of single tiles from (x0, y0) to (x1, y1) (the original's own sample points are not worked out). */
  private cliffLine(x0: number, y0: number, x1: number, y1: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / Math.max(1, n)), y = Math.round(y0 + ((y1 - y0) * k) / Math.max(1, n));
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
      const i = this.at(x, y);
      this.terrain[i] = T.temp;
      this.cliff.add(i);
    }
  }

  // ---- objects

  private objectInit() {
    const m = this.map, r = this.rng, W = this.W, H = this.H;
    r.rand(); // drawn and not used
    this.objectLands = this.slots.map((s) => ({ x: s.x, y: s.y, landId: s.landId, player: s.player }));
    if (m.id === 6) {
      // Mediterranean: a sea in the middle, as a land of water ahead of the others.
      const q = Math.trunc(W / 6);
      this.slots.unshift({
        tiles: Math.trunc((W - 2 * q) * (H - 2 * q) * 0.7), terrain: T.water, x: Math.trunc(W / 2), y: Math.trunc(H / 2), baseSize: 2,
        spacing: 7, zone: this.slots.length, clumpiness: 10, xMin: q, yMin: q, xMax: W - q, yMax: H - q, usage: 10, landId: -100, player: 0,
        startRadius: -1, edgeFade: 0,
      });
    }
    if (m.id < 2) {
      let k = r.R(4) + 1;
      if (k + this.players > 10) k = 10 - this.players;
      const n = this.slots.length;
      for (const s of this.slots) s.tiles -= Math.trunc(((H + W) * k) / n);
      const [b1, b2, b3, b4] = this.borders;
      for (let j = 0; j < k; j++) {
        let x = 0, y = 0, ok = false;
        for (let tries = 0; tries < 1000 && !ok; tries++) {
          x = r.R(W - 16) + 8; y = r.R(H - 16) + 8;
          ok = this.slots.slice(0, n).every((s) => (s.x - x) ** 2 + (s.y - y) ** 2 >= 400);
        }
        if (!ok) { k = j; }
        this.slots.push({
          tiles: Math.trunc((W + H) * 1.25), terrain: T.grass, x, y, baseSize: 3, spacing: 7, zone: n + j, clumpiness: 10,
          xMin: b1, yMin: b2, xMax: W - b3, yMax: H - b4, usage: m.borderUsage,
          landId: 1000 + j, player: 0, startRadius: -1, edgeFade: 0,
        });
        // A mine on every extra island: stone or gold.
        const stone = r.rand() < 0x3fff;
        this.extraObjects.push({ unit: stone ? "stone_mine" : "gold_mine", id: stone ? 102 : 66, host: -1, placing: 2, scale: 0, perGroup: 8,
          fluctuation: 0, groups: 1, area: 4, player: 0, land: 1000 + j, min: 0, max: 26 });
        if (!ok) { this.slots.pop(); this.extraObjects.pop(); break; }
        this.objectLands.push({ x, y, landId: 1000 + j, player: 0 });
      }
    }
    r.rand(); // "object initialization"
  }

  /** How far apart groups of one entry are kept (not in the data: the original sets it here). */
  private spacingOf(o: AoeObject) {
    const kind = o.unit;
    if (o.land >= 0) return ["berry_bush", "gazelle", "gold_mine", "stone_mine"].includes(kind) ? 12 : 1;
    if (o.land === -2) return ["berry_bush", "gold_mine", "stone_mine"].includes(kind) ? Math.trunc(this.W / 6) : kind === "gazelle" ? Math.trunc(this.W / 8) : 1;
    return 1;
  }

  private runObjects() {
    const W = this.W, H = this.H;
    // First every tile's own things, row by row (FUN_00449110 over the whole map): the trees of a forest, the
    // tufts and rocks of grass and desert, the rocks along a beach, a shallows' ripple.
    this.shapes = this.slopes();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.terrainUnits(x, y, true);
    this.lists.clearLinks();
    const lands = this.objectLands;
    for (const o of [...this.map.objects, ...this.extraObjects]) {
      const e = { ...o, groups: o.scale ? Math.max(1, Math.trunc((W * H * o.groups) / (144 * 144))) : o.groups };
      const spacing = this.spacingOf(o);
      if (e.land === -1 || e.land === -2) this.placeAnywhere(e, spacing, e.land === -2 ? lands : [], Math.max(e.player, 0));
      else if (e.land >= 0) lands.forEach((l) => {
        if (l.landId !== e.land) return;
        this.placeOnLand(e, spacing, l.x, l.y, lands, e.player >= 0 ? e.player : l.player);
      });
    }
  }

  private mask!: Uint8Array;
  private maskSquare(x: number, y: number, r: number, v: number) {
    for (let b = Math.max(0, y - r); b <= Math.min(this.H - 1, y + r); b++)
      for (let a = Math.max(0, x - r); a <= Math.min(this.W - 1, x + r); a++) this.mask[this.at(a, b)] = v;
  }

  /** The tiles in a box (or the whole map) row by row, then a quarter of them drawn at random to the front. */
  private candidates(head: number, cx: number, cy: number, r: number) {
    const L = this.lists, W = this.W, H = this.H, R = this.rng;
    L.next[head] = L.prev[head] = -1;
    let x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1;
    if (!(cx < 0 || cy < 0 || r < 0)) { x0 = Math.max(0, cx - r); x1 = Math.min(W - 1, cx + r); y0 = Math.max(0, cy - r); y1 = Math.min(H - 1, cy + r); }
    let last = head;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const n = this.at(x, y);
      if (this.mask[n]) { L.pushAfter(last, n); last = n; }
    }
    const a = x1 - x0 - 1, b = y1 - y0 - 1;
    if (a > 1 && b > 1) for (let k = Math.trunc((a * b) / 4); k > 0; k--) {
      const x = R.R(a) + x0, y = R.R(b) + y0;
      const n = this.at(x, y);
      if (this.mask[n]) L.pushAfter(head, n);
    }
  }

  private clearSpacing(x: number, y: number, r: number) {
    for (let b = Math.max(0, y - r); b <= Math.min(this.H - 1, y + r); b++)
      for (let a = Math.max(0, x - r); a <= Math.min(this.W - 1, x + r); a++) this.lists.unlink(this.at(a, b));
  }

  private grid = new Map<number, Placed[]>();
  /** Where a thing on tile (x, y) stands: the middle of the tile if its footprint is not a whole number of
   *  tiles across (a mine, a Town Center, a villager), its corner if it is. */
  private position(id: number, x: number, y: number): [number, number] {
    const r = UNITS.get(id)?.size ?? [0.5, 0.5, 0];
    return [r[0] - Math.trunc(r[0]) > 0 ? f32(x + 0.5) : x, r[1] - Math.trunc(r[1]) > 0 ? f32(y + 0.5) : y];
  }

  /** Moves a spot so that the thing's footprint lies on the map, and on whole tiles where it nearly does
   *  (FUN_00443e90, as a tight group puts each of its things). */
  private snap(id: number, fx: number, fy: number): [number, number] {
    const r = UNITS.get(id)?.size ?? [0.5, 0.5, 0];
    const one = (v: number, rad: number, max: number) => {
      let lo = f32(v - rad), hi = f32(v + rad);
      if (lo < 0) { v = f32(v - lo); lo = f32(v - rad); hi = f32(v + rad); }
      const top = f32(max - 0.00001);
      if (hi >= top) { v = f32(v + (top - hi)); lo = f32(v - rad); hi = f32(v + rad); }
      const fl = f32(lo - Math.floor(lo)), gr = f32(1 - f32(hi - Math.floor(hi)));
      if (gr + fl >= 1) v = fl > gr ? f32(v + (1 - fl)) : f32(v - (1 - gr));
      return v;
    };
    return [one(fx, r[0], this.W), one(fy, r[1], this.H)];
  }

  private groupId = 0;
  private group(e: AoeObject, x: number, y: number, player: number) {
    this.groupId++;
    if (e.placing === 1) this.looseGroup(e, x, y, player);
    else if (e.placing === 2) this.tightGroup(e, x, y, player);
    else { const [fx, fy] = this.position(e.id, x, y); this.make(e, player, fx, fy); }
  }

  /** Makes one of an entry's things. A building comes finished, which draws once more (FUN_004ae500). */
  private make(e: AoeObject, player: number, fx: number, fy: number) {
    this.create(e.id, e.unit, player, fx, fy);
    if (UNITS.get(e.id)?.building) this.rng.srand(this.rng.rand());
  }

  private count(e: AoeObject) {
    const c = e.perGroup + (Math.trunc((this.rng.rand() * e.fluctuation * 2) / 0x7fff) - e.fluctuation);
    return Math.max(1, c);
  }

  /** A group spread over a box round its first thing (FUN_004725b0). */
  private looseGroup(e: AoeObject, cx: number, cy: number, player: number) {
    const L = this.lists, G = this.G;
    this.candidates(G, cx, cy, e.area);
    let left = this.count(e);
    for (let n = L.pop(G); n >= 0 && left > 0; n = L.pop(G)) {
      const x = n % this.W, y = (n - x) / this.W;
      if (e.host >= 0 && this.terrain[n] !== e.host) continue;
      const [fx, fy] = this.position(e.id, x, y);
      if (this.canPlace(e.id, fx, fy, true, false) === 0) { this.make(e, player, fx, fy); left--; }
    }
    L.release(G);
  }

  /** A group grown tile by tile from its first thing, the next tile drawn at random (FUN_00472780). */
  private tightGroup(e: AoeObject, cx: number, cy: number, player: number) {
    const L = this.lists, G = this.G, W = this.W, H = this.H, a = e.area;
    L.next[G] = L.prev[G] = -1;
    L.pushAfter(G, this.at(cx, cy));
    const x0 = Math.max(0, cx - a), x1 = Math.min(W - 1, cx + a), y0 = Math.max(0, cy - a), y1 = Math.min(H - 1, cy + a);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.mask[this.at(x, y)] = 1;
    let left = this.count(e);
    for (let n = L.pop(G); n >= 0 && left > 0; n = L.pop(G)) {
      const x = n % W, y = (n - x) / W;
      const [px, py] = this.position(e.id, x, y);
      const [fx, fy] = this.snap(e.id, px, py);
      if (this.canPlace(e.id, fx, fy, true, false) !== 0) continue;
      this.make(e, player, fx, fy);
      left--;
      this.mask[n] = 0;
      if (x > x0 && this.mask[this.at(x - 1, y)]) L.insertSorted(G, this.at(x - 1, y), this.rng.rand());
      if (x < x1 && this.mask[this.at(x + 1, y)]) L.insertSorted(G, this.at(x + 1, y), this.rng.rand());
      if (y > y0 && this.mask[this.at(x, y - 1)]) L.insertSorted(G, this.at(x, y - 1), this.rng.rand());
      if (y < y1 && this.mask[this.at(x, y + 1)]) L.insertSorted(G, this.at(x, y + 1), this.rng.rand());
    }
    L.release(G);
  }

  /** Anywhere on the map, or anywhere but near the lands' origins (FUN_00472040, FUN_00471e00). */
  private placeAnywhere(e: AoeObject, spacing: number, awayFrom: { x: number; y: number }[], player: number) {
    const L = this.lists, H0 = this.H0;
    this.mask = new Uint8Array(this.W * this.H).fill(1);
    for (const l of awayFrom) this.maskSquare(l.x, l.y, e.min, 0);
    this.candidates(H0, -1, -1, -1);
    let left = e.groups;
    for (let n = L.pop(H0); n >= 0 && left > 0; n = L.pop(H0)) {
      const x = n % this.W, y = (n - x) / this.W;
      if (e.host >= 0 && this.terrain[n] !== e.host) continue;
      const [fx, fy] = this.position(e.id, x, y);
      if (this.canPlace(e.id, fx, fy, true, false) !== 0) continue;
      this.clearSpacing(x, y, spacing);
      this.group(e, x, y, player);
      left--;
    }
    L.release(H0);
  }

  /** Round a land's origin, between `min` and `max` tiles out, on ground reachable from it (FUN_00472250). */
  private placeOnLand(e: AoeObject, spacing: number, X: number, Y: number, lands: { x: number; y: number }[], player: number) {
    const L = this.lists, H0 = this.H0, W = this.W, H = this.H;
    const x0 = Math.max(0, X - e.min), x1 = Math.min(W - 1, X + e.min), y0 = Math.max(0, Y - e.min), y1 = Math.min(H - 1, Y + e.min);
    this.mask = new Uint8Array(W * H).fill(1);
    for (const l of lands) this.maskSquare(l.x, l.y, e.min, 0);
    this.candidates(H0, X, Y, e.max);
    if (!UNITS.has(e.id)) return;
    const zones = this.zones(e.id), z0 = zones[this.at(X, Y)];
    let left = e.groups;
    for (let n = L.pop(H0); n >= 0 && left > 0; n = L.pop(H0)) {
      const x = n % W, y = (n - x) / W;
      if (zones[n] !== z0 || (e.host >= 0 && this.terrain[n] !== e.host)) continue;
      if (!(x <= x0 || x >= x1 || y <= y0 || y >= y1)) continue;
      const [fx, fy] = this.position(e.id, x, y);
      if (this.canPlace(e.id, fx, fy, true, true) === 0) { this.clearSpacing(x, y, spacing); this.group(e, x, y, player); left--; }
      else if (e.placing === 0 && L.next[H0] < 0) this.make(e, player, fx, fy); // the last tile: put there all the same
    }
    L.release(H0);
  }

  /** Connected stretches of the ground a thing may stand on, and of what it may not (FUN_00524550): a thing on a
   *  land must be reachable from its origin. One map per kind of ground, made the first time it is asked for,
   *  numbered row by row and wrapping after 254. */
  private zoneMaps = new Map<string, Int32Array>();
  private zones(id: number): Int32Array {
    const on = UNITS.get(id)!.on, key = [...on].sort((a, b) => a - b).join(",");
    const had = this.zoneMaps.get(key);
    if (had) return had;
    const W = this.W, H = this.H, N = W * H, out = new Int32Array(N).fill(-1);
    const pass = (i: number) => on.has(this.terrain[i]);
    let zid = 0;
    const stack: number[] = [];
    for (let i = 0; i < N; i++) {
      if (out[i] >= 0) continue;
      const p = pass(i);
      out[i] = zid; stack.push(i);
      while (stack.length) {
        const c = stack.pop()!, x = c % W, y = (c - x) / W;
        for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const k = b * W + a;
          if (out[k] < 0 && pass(k) === p) { out[k] = zid; stack.push(k); }
        }
      }
      zid = zid >= 254 ? 0 : zid + 1;
    }
    this.zoneMaps.set(key, out);
    return out;
  }

  /** The land each player starts on: its origin. */
  startOf(player: number) {
    const s = this.slots.find((x) => x.player === player + 1);
    return s ? { x: s.x, y: s.y } : null;
  }
}

/** The original's maps, by Bronze Dawn's name for each. */
export const AOE_MAP_IDS: Record<string, number> = {
  small_islands: 0, large_islands: 1, coastal: 2, inland: 3, highland: 4, continental: 5, mediterranean: 6, hill_country: 7, narrows: 8,
};
export const AOE_MAPS = (maps as unknown as { maps: AoeMap[] }).maps;

/** The original's terrain as Bronze Dawn's: one kind of water, sand for desert and beach, trees on the forests. */
function ground(t: number): Terrain {
  if (t === T.water || t === T.deep) return Terrain.water;
  if (t === T.shallows) return Terrain.shallows;
  if (t === T.desert || t === T.beach || t === T.palm) return Terrain.sand;
  return Terrain.grass;
}

/** Fills Bronze Dawn's world from a finished map: ground, hills, cliffs, then everything placed, in its order. */
export function fillWorld(w: World, gen: AoeMapGen) {
  const map = w.map, N = gen.W * gen.H;
  for (let i = 0; i < N; i++) {
    map.terrain[i] = gen.cliff.has(i) ? Terrain.cliff : ground(gen.terrain[i]);
    map.elevation[i] = gen.elevation[i];
  }
  const herds = new Map<number, number>();
  const starts: Tile[] = w.players.map(() => new Tile(0, 0));
  for (const p of gen.placed) {
    const at = new Vec2(p.x, p.y), tile = new Tile(Math.floor(p.x), Math.floor(p.y));
    // The original's players are 1 to n, 0 being nature's; Bronze Dawn's are 0 to n-1.
    const owner = p.player - 1;
    switch (p.unit) {
      case "town_center":
        if (owner >= 0 && owner < w.players.length) {
          const origin = new Tile(Math.round(p.x - 1.5), Math.round(p.y - 1.5));
          w.addBuilding("town_center", owner, origin, true);
          starts[owner] = new Tile(origin.x + 1, origin.y + 1);
        }
        break;
      case "villager":
        if (owner >= 0 && owner < w.players.length) w.spawnUnit("villager", owner, at);
        break;
      case "tree": case "lone_tree": case "berry_bush": case "gold_mine": case "stone_mine": case "fish": case "deep_fish":
        w.addNode(p.unit === "fish" && gen.terrain[gen.W * tile.y + tile.x] === T.deep ? "deep_fish" : p.unit, tile);
        break;
      case "gazelle": case "elephant": case "lion": case "alligator": {
        const u = w.spawnAnimal(p.unit, at);
        if (u && p.unit === "gazelle") {
          let id = herds.get(p.group);
          if (id === undefined) { id = w.newHerd(at); herds.set(p.group, id); }
          u.herd = id;
        }
        break;
      }
      default: break; // pigeons and the like: nothing in Bronze Dawn
    }
  }
  widenCliffs(w, gen);
  w.startTiles = starts;
  return starts;
}

/** The generator draws a cliff as a line one tile wide, but a piece of the original's cliff art is about three
 *  tiles across: people stood on its rock on either side. So each cliff tile also takes the land on all sides
 *  of it, once everything is placed: never water, nor a tile with a building, a tree, a mine or anyone on it, nor
 *  one next to a building (a Town Center is not walled in). */
function widenCliffs(w: World, gen: AoeMapGen) {
  const map = w.map, W = gen.W, H = gen.H;
  const taken = new Set<number>();
  for (const u of w.units) taken.add(Math.floor(u.pos.y) * W + Math.floor(u.pos.x));
  const nearBuilding = new Set<number>();
  for (const b of w.buildings) {
    const f = b.footprint;
    for (let y = f.minY - 1; y <= f.maxY + 1; y++) for (let x = f.minX - 1; x <= f.maxX + 1; x++) nearBuilding.add(y * W + x);
  }
  const add: number[] = [];
  for (const i of gen.cliff) {
    const cx = i % W, cy = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy, j = y * W + x;
      if (x < 0 || y < 0 || x >= W || y >= H || map.terrain[j] === Terrain.cliff) continue;
      const t = map.terrain[j];
      if (t !== Terrain.grass && t !== Terrain.sand && t !== Terrain.dirt) continue;
      if (taken.has(j) || nearBuilding.has(j) || map.occupant[j] !== 0) continue;
      add.push(j);
    }
  }
  for (const j of add) { map.terrain[j] = Terrain.cliff; map.cliffRim[j] = 1; }
}
