import { DIRS16, Footprint, RNG, Tile, Vec2 } from "./geom";
import { Terrain, walkable } from "./grid";
import type { Host, RandomMapSpec } from "./rmspec";
import { AOE_MAP_IDS, AOE_MAPS, AoeMapGen, fillWorld } from "./aoemap";
import type { World } from "./world";

/**
 * Builds a skirmish map from the world's seed: lakes, forests, and a start for each
 * player with a town center, villagers, berries, a forest, gold and stone close by.
 */
/** The kinds of map, as the start screen offers them: the original's nine, made as it makes them (aoemap.ts). */
export type MapType = "inland" | "coastal" | "continental" | "mediterranean" | "large_islands" | "small_islands"
  | "highland" | "hill_country" | "narrows";
// Names only, as the original's start screen shows them. The one-line descriptions they had said more than was
// so: Inland, "all land", has lakes, a sea at some edges and, on many of the original's maps, rivers.
export const MAP_TYPES: [MapType, string][] = [
  ["inland", "Inland"], ["coastal", "Coastal"], ["continental", "Continental"], ["mediterranean", "Mediterranean"],
  ["large_islands", "Large Islands"], ["small_islands", "Small Islands"], ["highland", "Highland"],
  ["hill_country", "Hill Country"], ["narrows", "Narrows"],
];
/** One of the original's nine maps, made as the original makes it (aoemap.ts), from the world's seed. Ruins and
 *  Artifacts are Bronze Dawn's own afterwards: the original places them apart from the map generator. */
export function generateMap(w: World, type: MapType = "inland", withRelics = true) {
  const map = w.map;
  for (let i = 0; i < map.shade.length; i++) map.shade[i] = w.rng.int(0, 255);
  const gen = new AoeMapGen(AOE_MAPS[AOE_MAP_IDS[type]], map.width, w.players.length, w.seed >>> 0, w.teams).generate();
  const starts = fillWorld(w, gen);
  w.nodes = w.nodes.filter((x) => x.alive);
  if (withRelics) relics(w, starts);
  freeAnimals(w);
}

/** The animals the generator knows by name; anything else from a spec is a resource node. */
const ANIMALS = new Set(["gazelle", "elephant", "lion", "alligator"]);

/**
 * A map built from a RandomMapSpec (a player's pack may carry the original's): the base, then a land for
 * each player (or one for all) grown out from the starts to the share of the map it should cover, inside the
 * margins and apart from each other where they should be; patches of sand and woods; the bases; then every
 * object, near each player or across the map, on the ground it belongs on. Only the world's random numbers
 * are used, so a seed gives the same map on every machine.
 */
export function generateFromSpec(w: World, spec: RandomMapSpec, withRelics = true) {
  const map = w.map, n = map.width, N = n * map.height;
  const scale = N / (72 * 72);
  for (let i = 0; i < map.shade.length; i++) map.shade[i] = w.rng.int(0, 255);
  const starts = startTiles(w.players.length, n, w.seed);
  w.startTiles = starts;
  const near = (t: Tile, d: number) => starts.some((s) => t.center.distance(s.center) < d);

  // The base, and the lands grown over it.
  map.terrain.fill(spec.base === "water" ? Terrain.water : Terrain.grass);
  // The margins waver, as a coast does, a few tiles either side of their width.
  const edge = (b: number) => {
    const m = Math.round((Math.max(0, Math.min(45, b)) / 100) * n);
    return m ? coastline(w, n, Math.max(1, m - 3), m + 3) : new Array<number>(n).fill(0);
  };
  const [sw, nw, ne, se] = spec.border.map(edge);
  const inside = (x: number, y: number) => x >= nw[y] && x < n - se[y] && y >= ne[x] && y < n - sw[x];
  if (spec.base === "water") {
    const owner = new Int16Array(N).fill(-1);   // which land holds a tile
    const blocked = new Uint16Array(N);         // tiles within spacing of a land, by how many lands (apart only)
    const seeds = spec.lands === "shared" ? [new Tile(n >> 1, n >> 1)] : starts;
    const total = Math.round((Math.max(1, Math.min(100, spec.land)) / 100) * N);
    const quota = Math.ceil(total / seeds.length);
    const got = seeds.map(() => 0);
    const front: number[][] = seeds.map(() => []);
    const apart = spec.lands === "apart", gap = Math.max(1, spec.spacing);
    const claim = (i: number, land: number) => {
      owner[i] = land; got[land]++;
      map.terrain[i] = Terrain.grass;
      const x = i % n, y = (i - x) / n;
      if (apart) for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
        const a = x + dx, b = y + dy;
        if (a >= 0 && b >= 0 && a < n && b < n) blocked[b * n + a] |= 1 << Math.min(15, land);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = x + dx, b = y + dy;
        if (a >= 0 && b >= 0 && a < n && b < n && owner[b * n + a] < 0) front[land].push(b * n + a);
      }
    };
    const free = (i: number, land: number) => {
      if (owner[i] >= 0) return false;
      const x = i % n, y = (i - x) / n;
      if (!inside(x, y)) return false;
      return !apart || (blocked[i] & ~(1 << Math.min(15, land))) === 0;
    };
    // Every base stands on its own ground first, whatever the margins say.
    seeds.forEach((s, land) => {
      const r = spec.lands === "shared" ? 3 : Math.max(5, Math.min(7, spec.startRadius));
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = s.x + dx, y = s.y + dy, i = y * n + x;
        if (x >= 0 && y >= 0 && x < n && y < n && dx * dx + dy * dy <= r * r && owner[i] < 0) claim(i, land);
      }
    });
    if (spec.lands === "shared") for (const s of starts) blob(w, s, Math.max(4, spec.startRadius), (t) => { const i = map.index(t); if (owner[i] < 0) claim(i, 0); });
    // Then a tile at a time for each land in turn, from anywhere on its edge: the edge grows ragged, as land does.
    let busy = true;
    while (busy) {
      busy = false;
      for (let land = 0; land < seeds.length; land++) {
        const f = front[land];
        if (got[land] >= quota) continue;
        while (f.length) {
          const k = w.rng.int(0, f.length - 1), i = f[k];
          f[k] = f[f.length - 1]; f.pop();
          if (free(i, land)) { claim(i, land); busy = true; break; }
        }
      }
    }
  }
  if (spec.coast) {
    // Sea along two opposite sides, as on the Coastal map, so that every base has a coast whichever
    // corners the players get; the bases are cleared to land afterwards.
    const alongX = w.rng.chance(0.5), lo = Math.round(n * 0.07), hi = Math.round(n * 0.14);
    const a = coastline(w, n, lo, hi), b = coastline(w, n, lo, hi);
    for (let i = 0; i < n; i++) for (let d = 0; d < n; d++) {
      if (d >= a[i] && d < n - b[i]) continue;
      map.terrain[alongX ? i * n + d : d * n + i] = Terrain.water;
    }
  }

  // Patches: sand, and woods to be planted once the bases stand. Each a share of the ground it grows on,
  // in its number of clumps, kept clear of the starts.
  const woods = new Uint8Array(N);
  for (const p of spec.patches) {
    const on = p.on === "sand" ? Terrain.sand : Terrain.grass;
    let ground = 0;
    for (let i = 0; i < N; i++) if (map.terrain[i] === on) ground++;
    const clumps = Math.max(1, Math.round(p.clumps * Math.max(1, scale)));
    const each = Math.ceil(((p.share / 100) * ground) / clumps);
    const keep = Math.min(10, Math.max(6, spec.startRadius - 4));
    for (let c = 0; c < clumps; c++) {
      let seed = -1;
      for (let tries = 0; tries < 40 && seed < 0; tries++) {
        const i = w.rng.int(0, N - 1), t = new Tile(i % n, Math.floor(i / n));
        if (map.terrain[i] === on && !woods[i] && !near(t, keep + 2)) seed = i;
      }
      if (seed < 0) continue;
      const f = [seed];
      for (let done = 0; done < each && f.length;) {
        const k = w.rng.int(0, f.length - 1), i = f[k];
        f[k] = f[f.length - 1]; f.pop();
        const x = i % n, y = (i - x) / n;
        if (map.terrain[i] !== on || woods[i] || near(new Tile(x, y), keep)) continue;
        if (p.kind === "sand" || p.kind === "palms") map.terrain[i] = Terrain.sand;
        if (p.kind !== "sand") woods[i] = 1;
        done++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = x + dx, b = y + dy;
          if (a >= 0 && b >= 0 && a < n && b < n) f.push(b * n + a);
        }
      }
    }
  }

  // The shore, then the bases, then the woods.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (map.terrain[y * n + x] === Terrain.water) continue;
    const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.inside(new Tile(x + dx, y + dy)) && map.terrainAt(new Tile(x + dx, y + dy)) === Terrain.water);
    if (wet) map.terrain[y * n + x] = Terrain.sand;
  }
  starts.forEach((s, pid) => {
    for (let y = s.y - 8; y <= s.y + 8; y++) for (let x = s.x - 8; x <= s.x + 8; x++) {
      const t = new Tile(x, y);
      if (!map.inside(t)) continue;
      const d = t.center.distance(s.center);
      if (d <= 8 && map.terrain[y * n + x] !== Terrain.water) map.terrain[y * n + x] = d <= 3.2 ? Terrain.dirt : Terrain.grass;
      if (d <= 5) map.terrain[y * n + x] = d <= 3.2 ? Terrain.dirt : Terrain.grass;
    }
    w.addBuilding("town_center", pid, new Tile(s.x - 1, s.y - 1), true);
    const spots = [[2, 0], [2, 1], [-2, 1], [0, 2], [1, -2], [-1, 2]];
    for (let i = 0; i < w.rules.economy.start_villagers; i++) {
      const [dx, dy] = spots[i % spots.length];
      w.spawnUnit("villager", pid, new Tile(s.x + dx, s.y + dy).center);
    }
  });
  for (let i = 0; i < N; i++) if (woods[i] && w.rng.chance(0.93)) w.addNode("tree", new Tile(i % n, Math.floor(i / n)));

  // The objects, each on the ground it belongs on.
  const fits = (t: Tile, on: Host) => {
    if (!map.inside(t) || map.occupantAt(t) !== 0) return false;
    const ter = map.terrainAt(t);
    const wetBeside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.terrainAt(new Tile(t.x + dx, t.y + dy)) === Terrain.water);
    const dryBeside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const o = new Tile(t.x + dx, t.y + dy); return map.inside(o) && map.terrainAt(o) !== Terrain.water; });
    if (on === "land") return ter !== Terrain.water && map.passable(t) && roomy(w, t);
    if (on === "beach") return ter === Terrain.sand && wetBeside && map.passable(t);
    if (on === "deep") return ter === Terrain.water && map.openWater(t, 1);
    return ter === Terrain.water && dryBeside; // water by the shore, and the shallows
  };
  const put = (o: RandomMapSpec["objects"][number], at: Tile) => {
    const count = Math.max(1, o.count + (o.spread ? w.rng.int(-o.spread, o.spread) : 0));
    if (ANIMALS.has(o.kind)) { herd(w, o.kind, at, o.layout === "single" ? 1 : count); return; }
    const kind = o.kind === "fish" && o.on === "deep" ? "deep_fish" : o.kind;
    if (o.layout === "tight") { cluster(w, kind, at, count); return; }
    if (o.layout === "single" || count === 1) { w.addNode(kind, at); return; }
    // Loose: the group spread over its area, each where it fits.
    const r = Math.max(1, o.area);
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const t = new Tile(at.x + w.rng.int(-r, r), at.y + w.rng.int(-r, r));
        if (fits(t, o.on) && w.addNode(kind, t)) break;
      }
    }
  };
  const ring = (c: Tile, min: number, max: number) => {
    const d = w.rng.int(Math.max(0, min), Math.max(min, max));
    return c.center.add(DIRS16[w.rng.int(0, 15)].mul(d)).tile;
  };
  for (const o of spec.objects) {
    const groups = Math.max(0, Math.round(o.groups * (o.scale ? scale : 1)));
    if (o.perPlayer) {
      for (const s of starts) for (let g = 0; g < groups; g++) {
        for (let tries = 0; tries < 30; tries++) {
          const t = ring(s, o.minDist, o.maxDist || o.minDist + 8);
          if (fits(t, o.on)) { put(o, t); break; }
        }
      }
    } else {
      for (let g = 0; g < groups; g++) {
        for (let tries = 0; tries < 30; tries++) {
          const t = new Tile(w.rng.int(1, n - 2), w.rng.int(1, n - 2));
          if (o.away && near(t, o.minDist)) continue;
          if (fits(t, o.on)) { put(o, t); break; }
        }
      }
    }
  }

  // A way by land between the bases, unless the sea is meant to part them; then relief, relics, and freedom
  // for any animal the woods closed in.
  const parted = spec.lands === "apart" && spec.base === "water" && spec.land < 100;
  if (!parted) connect(w, starts);
  w.nodes = w.nodes.filter((x) => x.alive);
  const [hilly, cliffy, high] = spec.relief ?? [5, 3, false];
  hills(w, starts, hilly, high);
  if (cliffy) cliffs(w, starts, cliffy);
  if (map.terrain.some((t) => t === Terrain.water)) openToSea(w, starts);
  w.nodes = w.nodes.filter((x) => x.alive);
  if (withRelics) relics(w, starts);
  freeAnimals(w);
}

/** Last of all, when every wood is grown: an animal walled in by trees (woods grown around it after it was
 *  placed, or a clearing that seemed open) is moved, with its herd, to the nearest open pasture. */
function freeAnimals(w: World) {
  const map = w.map, size = map.width * map.height;
  // Pieces of ground one can walk across, trees and buildings in the way, and how big each is.
  const piece = new Int32Array(size).fill(-1), sizes: number[] = [];
  for (let i = 0; i < size; i++) {
    const t0 = new Tile(i % map.width, Math.floor(i / map.width));
    if (piece[i] >= 0 || !map.passable(t0)) continue;
    const id = sizes.length, stack = [t0];
    piece[i] = id;
    let n = 0;
    while (stack.length) {
      const t = stack.pop()!;
      n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = new Tile(t.x + dx, t.y + dy);
        if (!map.inside(q) || piece[map.index(q)] >= 0 || !map.passable(q)) continue;
        piece[map.index(q)] = id;
        stack.push(q);
      }
    }
    sizes.push(n);
  }
  // Most of the 5 x 5 around it land (trees or not): not a strip drawn like an islet.
  const landAround = (t: Tile) => { let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (map.terrainAt(new Tile(t.x + dx, t.y + dy)) !== Terrain.water) n++; return n; };
  const room = (t: Tile) => { const p = map.inside(t) ? piece[map.index(t)] : -1; return p >= 0 ? sizes[p] : 0; };
  const pasture = (from: Tile): Tile | null => {
    // Open pasture if there is any near; else any ground with room to roam.
    for (const open of [true, false]) for (let d = 1; d <= 30; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const t = new Tile(from.x + dx, from.y + dy);
      if (open ? room(t) >= 200 && w.openLand(t) : room(t) >= 80 && landAround(t) >= 15) return t;
    }
    return null;
  };
  const moved = new Map<number, Tile | null>(); // a herd's new pasture
  for (const u of w.units) {
    if (!u.isAnimal || u.def.id === "alligator" || room(u.pos.tile) >= 80) continue;
    const key = u.herd || -u.id;
    if (!moved.has(key)) moved.set(key, pasture(u.pos.tile));
    const to = moved.get(key);
    if (!to) continue;
    // Beside the others, but only on the open ground: a gap of one tile between trees is beside it too.
    const near = map.nearestPassable(new Tile(to.x + (u.id % 3) - 1, to.y + ((u.id >> 2) % 3) - 1), 2);
    const spot = near && room(near) >= 80 && landAround(near) >= 15 ? near : to; // not out on the shore's edge either
    u.pos = spot.center; u.prevPos = u.pos;
    if (u.herd) w.herdGoals.set(u.herd, to.center);
  }
}

/** Every base can walk to the sea: where woods wall it in, a way is cut through them to the nearest shore
 *  a Dock can stand by, with a little room at its end for its builder. (On an island the Dock is the only
 *  way out.) */
function openToSea(w: World, starts: Tile[]) {
  const map = w.map, size = map.width * map.height;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // Beside the open sea: a Dock could be built next to this tile (a pond's bank is not enough).
  const shore = (t: Tile) => {
    if (!dirs.some(([dx, dy]) => map.terrainAt(new Tile(t.x + dx, t.y + dy)) === Terrain.water)) return false;
    for (let y = t.y - 3; y <= t.y + 1; y++) for (let x = t.x - 3; x <= t.x + 1; x++) if (w.canPlace("dock", new Tile(x, y))) return true;
    return false;
  };
  for (const s of starts) {
    const from = map.nearestPassable(s, 4) ?? s;
    const seen = map.reachable(from, (id) => w.building(id) !== null);
    let open = false;
    for (let i = 0; i < size && !open; i++) if (seen[i] && shore(new Tile(i % map.width, Math.floor(i / map.width)))) open = true;
    if (open) continue;
    // The nearest shore over land, through the trees, and the way there.
    const back = new Int32Array(size).fill(-1);
    const start = map.index(from);
    back[start] = start;
    const queue = [from];
    let end: Tile | null = null;
    for (let q = 0; q < queue.length && !end; q++) {
      const t = queue[q];
      for (const [dx, dy] of dirs) {
        const n = new Tile(t.x + dx, t.y + dy);
        if (!map.inside(n) || back[map.index(n)] >= 0 || !walkable(map.terrainAt(n))) continue;
        const o = map.occupantAt(n);
        if (o && !w.treeAt(n) && w.building(o) === null) continue;
        back[map.index(n)] = map.index(t);
        if (shore(n)) { end = n; break; }
        queue.push(n);
      }
    }
    if (!end) continue; // walled by cliffs: nothing to cut
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) w.clearTree(new Tile(end.x + dx, end.y + dy));
    for (let i = map.index(end); i !== start; i = back[i]) w.clearTree(new Tile(i % map.width, Math.floor(i / map.width)));
  }
}

/** Rolling hills, 0 to 3 high, rising no more than a step from one tile to the next. Bases, shores and
 *  water stay low. Like the Ruins they have their own random numbers, so the rest of a seed stays put. */
function hills(w: World, starts: Tile[], perSmallMap: number, high = false) {
  const map = w.map, n = map.width;
  const rng = new RNG((w.seed * 48271 + 7) >>> 0);
  const e = map.elevation;
  for (let k = 0; k < Math.round(perSmallMap * (n * n) / (72 * 72)); k++) {
    const c = new Tile(rng.int(4, n - 5), rng.int(4, n - 5));
    if (!starts.every((s) => s.center.distance(c.center) >= 16)) continue;
    const r = high ? rng.int(7, 13) : rng.int(5, 10), top = high ? rng.int(2, 3) : rng.int(1, 3);
    blob(w, c, r, (t) => {
      const h = Math.min(top, Math.ceil(top * (1 - t.center.distance(c.center) / r) * 1.6));
      const i = map.index(t);
      if (h > e[i]) e[i] = h;
    });
  }
  for (let i = 0; i < e.length; i++) {
    const t = new Tile(i % n, Math.floor(i / n));
    const ground = map.terrain[i];
    if (ground === Terrain.water || ground === Terrain.shallows || ground === Terrain.sand) e[i] = 0;
    else if (starts.some((s) => s.center.distance(t.center) < 10)) e[i] = 0;
  }
  // No tile more than a step above its neighbours: slopes, not walls (the walls are the cliffs).
  for (let changed = true; changed;) {
    changed = false;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      let low = e[i];
      if (x > 0) low = Math.min(low, e[i - 1] + 1);
      if (x < n - 1) low = Math.min(low, e[i + 1] + 1);
      if (y > 0) low = Math.min(low, e[i - n] + 1);
      if (y < n - 1) low = Math.min(low, e[i + n] + 1);
      if (low < e[i]) { e[i] = low; changed = true; }
    }
  }
}

/** A few short cliffs along the brows of the hills, as the Rise of Rome's maps have. A cliff that
 *  would cut one base off from another is not kept. */
function cliffs(w: World, starts: Tile[], perSmallMap: number) {
  const map = w.map, n = map.width;
  const rng = new RNG((w.seed * 69621 + 3) >>> 0);
  const free = (t: Tile) => map.inside(t) && map.elevationAt(t) >= 1 && walkable(map.terrainAt(t)) && map.terrainAt(t) !== Terrain.shallows
    && map.occupantAt(t) === 0 && starts.every((s) => s.center.distance(t.center) >= 14);
  const brow = (t: Tile) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.elevationAt(new Tile(t.x + dx, t.y + dy)) < map.elevationAt(t));
  const connected = () => {
    if (starts.length < 2) return true;
    const seen = map.reachable(new Tile(starts[0].x + 2, starts[0].y + 2), (id) => w.building(id) !== null);
    return starts.every((s) => seen[map.index(new Tile(s.x + 2, s.y + 2))] === 1);
  };
  for (let k = 0; k < Math.round(perSmallMap * (n * n) / (72 * 72)); k++) {
    for (let tries = 0; tries < 40; tries++) {
      const start = new Tile(rng.int(4, n - 5), rng.int(4, n - 5));
      if (!free(start) || !brow(start)) continue;
      // Along the brow: the line runs across the slope, so it faces down the hill.
      const downX = map.elevationAt(new Tile(start.x + 1, start.y)) < map.elevationAt(start) || map.elevationAt(new Tile(start.x - 1, start.y)) < map.elevationAt(start);
      const [dx, dy] = downX ? [0, 1] : [1, 0];
      const ridge: Tile[] = [];
      for (let i = -rng.int(1, 3); i <= rng.int(2, 4); i++) {
        const t = new Tile(start.x + dx * i, start.y + dy * i);
        if (free(t)) ridge.push(t);
      }
      if (ridge.length < 3) continue;
      const before = ridge.map((t) => map.terrain[map.index(t)]);
      for (const t of ridge) map.terrain[map.index(t)] = Terrain.cliff;
      if (connected()) break;
      ridge.forEach((t, i) => { map.terrain[map.index(t)] = before[i]; });
    }
  }
}

/** Ruins and Artifacts out on the open land, away from every base and from each other. They have their
 *  own random numbers, so turning them off leaves the rest of a seed's map as it was. */
function relics(w: World, starts: Tile[]) {
  const cfg = w.rules.economy.relics;
  if (!cfg) return;
  const map = w.map, n = map.width;
  const rng = new RNG((w.seed * 104729 + 31) >>> 0);
  const placed: Tile[] = [];
  const kinds = [...Array<"ruins">(cfg.ruins).fill("ruins"), ...Array<"artifact">(cfg.artifacts).fill("artifact")];
  for (const kind of kinds) {
    for (let tries = 0; tries < 300; tries++) {
      const t = new Tile(rng.int(4, n - 5), rng.int(4, n - 5));
      const room = tries < 200 ? 6 : 3; // a crowded map takes them closer together rather than not at all
      if (!map.passable(t) || map.occupantAt(t) !== 0) continue;
      if (!starts.every((s) => s.center.distance(t.center) >= Math.max(16, n * 0.25))) continue;
      if (!placed.every((o) => o.center.distance(t.center) >= room)) continue;
      placed.push(t);
      w.spawnRelic(kind, t.center);
      break;
    }
  }
}

/** A depth from the edge for each tile along it: a slow random walk between lo and hi. */
function coastline(w: World, len: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  let d = w.rng.int(lo, hi);
  for (let i = 0; i < len; i++) {
    if (w.rng.chance(0.35)) d = Math.min(hi, Math.max(lo, d + w.rng.int(-1, 1)));
    out.push(d);
  }
  return out;
}

/** Where each player starts: the corners first, then the middle of each edge, up to eight. Who gets
 *  which comes from the seed, as in the original, so you cannot tell where the others are: two players
 *  get one diagonal or the other, either way round; more get the corners, then the edges, shuffled.
 *  The shuffle has its own random numbers, so the land of a seed stays the same. */
export function startTiles(count: number, n: number, seed = 0): Tile[] {
  const mid = Math.floor(n / 2);
  const corners = [new Tile(14, n - 15), new Tile(n - 15, 14), new Tile(14, 14), new Tile(n - 15, n - 15)];
  const edges = [new Tile(14, mid), new Tile(n - 15, mid), new Tile(mid, 14), new Tile(mid, n - 15)];
  const rng = new RNG((seed * 7919 + 17) >>> 0);
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) { const j = rng.int(0, i); [xs[i], xs[j]] = [xs[j], xs[i]]; }
    return xs;
  };
  const k = Math.max(1, Math.min(count, corners.length + edges.length));
  if (k === 2) return shuffle(rng.int(0, 1) ? [corners[0], corners[1]] : [corners[2], corners[3]]);
  return [...shuffle(corners), ...shuffle(edges)].slice(0, k);
}

/** A few animals of one kind standing near a point, none on a sandbank. Gazelles keep together as a herd. */
function herd(w: World, kind: string, c: Tile, count: number) {
  const id = kind === "gazelle" ? w.newHerd(c.center) : 0;
  for (let i = 0; i < count; i++) {
    // Beside the others, on open land: a few tries, wider each time.
    for (let tries = 0; tries < 10; tries++) {
      const r = 1 + (tries >> 1);
      const t = w.map.nearestPassable(new Tile(c.x + w.rng.int(-r, r), c.y + w.rng.int(-r, r)), 3);
      if (!t || !roomy(w, t) || !w.openLand(t)) continue;
      const u = w.spawnAnimal(kind, t.center.add(new Vec2(w.rng.unit() * 0.4 - 0.2, w.rng.unit() * 0.4 - 0.2)));
      if (u) u.herd = id;
      break;
    }
  }
}

/** Land enough for wild animals to live on: this many tiles joined by land at least. */
const ROOMY = 80;
/** Each map's pieces of land, numbered, with their sizes: worked out once, when the animals are placed. */
const LAND = new WeakMap<World, { piece: Int32Array; size: number[] }>();

/** Whether a tile is on a piece of land with room to roam (not a sandbank out at sea). */
function roomy(w: World, t: Tile) {
  const map = w.map;
  let land = LAND.get(w);
  if (!land) {
    const piece = new Int32Array(map.width * map.height).fill(-1), size: number[] = [];
    for (let i = 0; i < piece.length; i++) {
      if (piece[i] >= 0 || !walkable(map.terrain[i])) continue;
      const id = size.length, stack = [i];
      piece[i] = id;
      let n = 0;
      while (stack.length) {
        const j = stack.pop()!, x = j % map.width, y = Math.floor(j / map.width);
        n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          const k = ny * map.width + nx;
          if (piece[k] < 0 && walkable(map.terrain[k])) { piece[k] = id; stack.push(k); }
        }
      }
      size.push(n);
    }
    land = { piece, size };
    LAND.set(w, land);
  }
  const p = land.piece[map.index(t)];
  return p >= 0 && land.size[p] >= ROOMY;
}

function blob(w: World, c: Tile, r: number, body: (t: Tile) => void) {
  const ri = Math.ceil(r) + 1;
  for (let y = c.y - ri; y <= c.y + ri; y++) {
    for (let x = c.x - ri; x <= c.x + ri; x++) {
      const t = new Tile(x, y);
      if (!w.map.inside(t)) continue;
      const wobble = 0.75 + (w.map.shade[w.map.index(t)] / 255) * 0.5;
      if (t.center.distance(c.center) <= r * wobble) body(t);
    }
  }
}

function cluster(w: World, kind: string, c: Tile, count: number) {
  let placed = 0;
  for (let ring = 0; placed < count && ring <= 3; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring || placed >= count) continue;
        const t = new Tile(c.x + dx, c.y + dy);
        if (w.map.inside(t) && roomy(w, t) && w.addNode(kind, t)) placed++; // none spilling onto a sandbank
      }
    }
  }
}

/** Makes sure every base can walk to every other: carves a path through trees and water if not. */
function connect(w: World, starts: Tile[]) {
  if (starts.length < 2) return;
  const from = new Tile(starts[0].x + 2, starts[0].y + 2);
  for (const s of starts.slice(1)) {
    const seen = w.map.reachable(from, (id) => w.building(id) !== null);
    const to = new Tile(s.x + 2, s.y + 2);
    if (w.map.inside(to) && seen[w.map.index(to)]) continue;
    const a = from.center, b = to.center;
    const steps = Math.floor(a.distance(b) * 2);
    for (let i = 0; i <= steps; i++) {
      const p = a.lerp(b, i / steps).tile;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const t = new Tile(p.x + dx, p.y + dy);
          if (!w.map.inside(t)) continue;
          const node = w.node(w.map.occupantAt(t));
          if (node) { node.alive = false; w.map.setOccupant(new Footprint(t, 1), 0); }
          // A way across the water is a ford: shallows that land units wade and boats still sail.
          if (w.map.terrainAt(t) === Terrain.water) w.map.terrain[w.map.index(t)] = Terrain.shallows;
        }
      }
    }
  }
}
