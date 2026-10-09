import { DIRS16, Footprint, RNG, Tile, Vec2 } from "./geom";
import { Terrain, walkable } from "./grid";
import type { World } from "./world";

/**
 * Builds a skirmish map from the world's seed: lakes, forests, and a start for each
 * player with a town center, villagers, berries, a forest, gold and stone close by.
 */
/** The kinds of map, as the start screen offers them. Inland is the land with lakes it always was. */
export type MapType = "inland" | "coastal" | "continental" | "mediterranean" | "large_islands" | "small_islands"
  | "highland" | "hill_country" | "narrows";
export const MAP_TYPES: [MapType, string][] = [
  ["inland", "Inland (lakes)"], ["coastal", "Coastal (sea on two sides)"],
  ["continental", "Continental (sea all around)"], ["mediterranean", "Mediterranean (a sea in the middle)"],
  ["large_islands", "Large Islands (an island each: transports needed)"], ["small_islands", "Small Islands (an island each, and more to settle)"],
  ["highland", "Highland (high ground, a sea on one side)"], ["hill_country", "Hill Country (hills and cliffs, small lakes)"],
  ["narrows", "Narrows (two shores, joined by narrow land bridges)"],
];
const islands = (t: MapType) => t === "large_islands" || t === "small_islands";
/** Maps with no sea, only lakes. */
const landOnly = (t: MapType) => t === "inland" || t === "hill_country";
/** How hilly each kind of map is: hills and cliffs per Small map, and whether the hills are broad and high. */
const RELIEF: Record<MapType, [number, number, boolean]> = {
  inland: [5, 3, false], coastal: [5, 3, false], continental: [5, 3, false], mediterranean: [5, 3, false],
  large_islands: [2, 0, false], small_islands: [2, 0, false],
  highland: [9, 4, true], hill_country: [11, 8, true], narrows: [4, 2, false],
};

export function generateMap(w: World, type: MapType = "inland", withRelics = true) {
  const map = w.map;
  const n = map.width;
  // Everything spread over the map grows with its area; a Small map (72 x 72) is the baseline.
  const scale = (map.width * map.height) / (72 * 72);
  for (let i = 0; i < map.shade.length; i++) map.shade[i] = w.rng.int(0, 255);

  const starts = startTiles(w.players.length, n, w.seed);
  w.startTiles = starts;
  const farFromStarts = (t: Tile, d: number) => starts.every((s) => t.center.distance(s.center) >= d);

  // The sea, for every map but the land ones. Inland draws no random numbers here, so its maps stay as they were.
  if (!landOnly(type)) sea(w, type);

  // Lakes, away from the bases: Hill Country has a few small ones among its hills.
  for (let k = 0; k < Math.round((type === "inland" ? 3 : type === "hill_country" ? 2 : 1) * scale); k++) {
    let c = new Tile(0, 0);
    for (let tries = 0; tries < 30; tries++) {
      c = new Tile(w.rng.int(8, n - 9), w.rng.int(8, n - 9));
      if (farFromStarts(c, 18)) break;
    }
    const r = type === "hill_country" ? w.rng.int(2, 4) : w.rng.int(3, 6);
    blob(w, c, r, (t) => { map.terrain[map.index(t)] = Terrain.water; });
  }
  // Shore.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (map.terrain[y * n + x] === Terrain.water) continue;
      const t = new Tile(x, y);
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const o = new Tile(x + dx, y + dy);
        return map.inside(o) && map.terrainAt(o) === Terrain.water;
      });
      if (wet) map.terrain[map.index(t)] = Terrain.sand;
    }
  }

  // Bases.
  starts.forEach((s, pid) => {
    for (let y = s.y - 8; y <= s.y + 8; y++) {
      for (let x = s.x - 8; x <= s.x + 8; x++) {
        const t = new Tile(x, y);
        if (!map.inside(t)) continue;
        const d = t.center.distance(s.center);
        if (d <= 8) map.terrain[y * n + x] = d <= 3.2 ? Terrain.dirt : Terrain.grass;
      }
    }
    w.addBuilding("town_center", pid, new Tile(s.x - 1, s.y - 1), true);
    const spots = [[2, 0], [2, 1], [-2, 1], [0, 2], [1, -2], [-1, 2]];
    for (let i = 0; i < w.rules.economy.start_villagers; i++) {
      const [dx, dy] = spots[i % spots.length];
      w.spawnUnit("villager", pid, new Tile(s.x + dx, s.y + dy).center);
    }
  });

  for (const s of starts) {
    const a = w.rng.int(0, 15);
    const at = (step: number, dist: number) => s.center.add(DIRS16[(a + step) % 16].mul(dist)).tile;
    cluster(w, "berry_bush", at(0, 6), 6);
    // A thick wood near every base, as in the original: trees standing shoulder to shoulder.
    forest(w, at(5, 11), 4.2, 0.95);
    forest(w, at(8, 13), 2.8, 0.92);
    cluster(w, "gold_mine", at(10, 9), 5);
    cluster(w, "stone_mine", at(12, 10), 4);
    for (let k = 0; k < 6; k++) {
      const t = s.center.add(DIRS16[w.rng.int(0, 15)].mul(w.rng.int(6, 9))).tile;
      w.addNode("lone_tree", t);
    }
    // Something to hunt near every base, as in the original's Stone Age.
    herd(w, "gazelle", at(3, 9), w.rng.int(3, 5));
    herd(w, "gazelle", at(14, 13), w.rng.int(3, 4));
    herd(w, "elephant", at(7, 14), 1);
  }

  // The rest of the map: fewer, bigger and denser woods than scattered copses, and lone trees between.
  for (let k = 0; k < Math.round(11 * scale); k++) {
    const c = new Tile(w.rng.int(2, n - 3), w.rng.int(2, n - 3));
    if (farFromStarts(c, 12)) forest(w, c, w.rng.int(3, 6), 0.93);
  }
  for (let k = 0; k < Math.round(45 * scale); k++) {
    const c = new Tile(w.rng.int(1, n - 2), w.rng.int(1, n - 2));
    if (farFromStarts(c, 8)) w.addNode("lone_tree", c);
  }
  // Wild animals across the map: gazelles and elephants to hunt, lions to fear, alligators by the water.
  for (let k = 0; k < Math.round(6 * scale); k++) {
    const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
    if (farFromStarts(c, 16)) herd(w, "gazelle", c, w.rng.int(3, 6));
  }
  for (let k = 0; k < Math.round(3 * scale); k++) {
    const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
    if (farFromStarts(c, 16)) herd(w, "elephant", c, w.rng.int(1, 2));
  }
  for (let k = 0; k < Math.round(3 * scale); k++) {
    const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
    if (farFromStarts(c, 20)) herd(w, "lion", c, w.rng.int(1, 2));
  }
  // Shore fish, and alligators, along the lakes.
  let gators = 0;
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const t = new Tile(x, y);
      if (map.terrainAt(t) !== Terrain.water) continue;
      const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.terrainAt(new Tile(x + dx, y + dy)) !== Terrain.water);
      if (!shore) continue;
      if (w.rng.chance(0.07)) w.addNode("fish", t);
      else if (gators < Math.round(4 * scale) && w.rng.chance(0.01) && farFromStarts(t, 18)) {
        const land = map.nearestPassable(t, 2);
        if (land) { herd(w, "alligator", land, 1); gators++; }
      }
    }
  }
  const extras = ["gold_mine", "gold_mine", "stone_mine", "stone_mine", "berry_bush", "berry_bush", "berry_bush"];
  for (const kind of Array.from({ length: Math.round(scale) }, () => extras).flat()) {
    for (let tries = 0; tries < 30; tries++) {
      const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
      if (farFromStarts(c, 15)) { cluster(w, kind, c, kind === "berry_bush" ? 5 : 4); break; }
    }
  }

  // Land paths between the bases, except where the sea is meant to part them.
  if (!islands(type)) connect(w, starts);
  if (!landOnly(type)) deepFish(w, starts);
  w.nodes = w.nodes.filter((x) => x.alive);
  const [hilly, cliffy, high] = RELIEF[type];
  hills(w, starts, hilly, high);
  if (cliffy) cliffs(w, starts, cliffy);
  if (withRelics) relics(w, starts);
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

/** Floods the sea of a map type. Bases are cleared to land afterwards, so none starts in the water. */
function sea(w: World, type: MapType) {
  const map = w.map, n = map.width;
  const wet = (x: number, y: number) => { map.terrain[y * n + x] = Terrain.water; };
  if (type === "coastal") {
    // Two opposite sides, so that whichever corners the players get, each has a coast.
    const alongX = w.rng.chance(0.5);
    const a = coastline(w, n, 5, 10), b = coastline(w, n, 5, 10);
    for (let i = 0; i < n; i++) for (let d = 0; d < n; d++) {
      if (d < a[i]) alongX ? wet(d, i) : wet(i, d);
      if (d < b[i]) alongX ? wet(n - 1 - d, i) : wet(i, n - 1 - d);
    }
  } else if (type === "continental") {
    const sides = [coastline(w, n, 4, 8), coastline(w, n, 4, 8), coastline(w, n, 4, 8), coastline(w, n, 4, 8)];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (x < sides[0][y] || n - 1 - x < sides[1][y] || y < sides[2][x] || n - 1 - y < sides[3][x]) wet(x, y);
    }
  } else if (islands(type)) {
    // All sea, then an island for every base, and on Small Islands a few more out in the water.
    map.terrain.fill(Terrain.water);
    const big = type === "large_islands";
    const land = (t: Tile) => { map.terrain[map.index(t)] = Terrain.grass; };
    for (const s of w.startTiles) {
      blob(w, s, n * (big ? 0.25 : 0.2), land);
      for (let k = 0; k < 3; k++) blob(w, new Tile(s.x + w.rng.int(-6, 6), s.y + w.rng.int(-6, 6)), n * (big ? 0.14 : 0.11), land);
    }
    const scale = (n * n) / (72 * 72);
    for (let k = 0; k < Math.round((big ? 1 : 4) * scale); k++) {
      for (let tries = 0; tries < 30; tries++) {
        const c = new Tile(w.rng.int(8, n - 9), w.rng.int(8, n - 9));
        if (w.startTiles.every((s) => s.center.distance(c.center) > n * 0.35)) { blob(w, c, n * 0.07, land); break; }
      }
    }
  } else if (type === "highland") {
    // One side is sea; the rest is high ground (its hills come later).
    const side = w.rng.int(0, 3), depth = coastline(w, n, 6, 12);
    for (let i = 0; i < n; i++) for (let d = 0; d < depth[i]; d++) {
      if (side === 0) wet(d, i); else if (side === 1) wet(n - 1 - d, i); else if (side === 2) wet(i, d); else wet(i, n - 1 - d);
    }
  } else if (type === "narrows") {
    // A wavering sea across the middle between the first two bases, with two narrow land bridges over it.
    const [a, b] = [w.startTiles[0], w.startTiles[1] ?? new Tile(n - 1 - w.startTiles[0].x, n - 1 - w.startTiles[0].y)];
    // The band runs across the line between the two bases: along the other diagonal, or straight across.
    const ux = b.x - a.x, uy = b.y - a.y, len = Math.hypot(ux, uy) || 1;
    const half = Math.max(3, Math.round(n * 0.07));
    const wobble = coastline(w, 2 * n, 0, 3);
    const mid = new Vec2(n / 2, n / 2);
    const across = (x: number, y: number) => ((x + 0.5 - mid.x) * ux + (y + 0.5 - mid.y) * uy) / len; // distance from the middle line
    const along = (x: number, y: number) => ((x + 0.5 - mid.x) * -uy + (y + 0.5 - mid.y) * ux) / len;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = Math.max(0, Math.min(2 * n - 1, Math.round(along(x, y) + n)));
      if (Math.abs(across(x, y)) <= half + wobble[k]) wet(x, y);
    }
    // Two bridges, a third of the way in from either end of the band, three tiles wide.
    const span = n * 0.25;
    for (const at of [-span, span]) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (Math.abs(along(x, y) - at) <= 1.5 && Math.abs(across(x, y)) <= half + 4) map.terrain[y * n + x] = Terrain.grass;
      }
    }
  } else {
    // A sea in the middle, made of a few overlapping rounds so its shore is not a circle.
    const mid = Math.floor(n / 2), r = n * 0.24;
    blob(w, new Tile(mid, mid), r, (t) => wet(t.x, t.y));
    for (let k = 0; k < 5; k++) {
      const c = new Tile(mid + w.rng.int(-Math.round(r * 0.6), Math.round(r * 0.6)), mid + w.rng.int(-Math.round(r * 0.6), Math.round(r * 0.6)));
      blob(w, c, r * (0.45 + w.rng.int(0, 20) / 100), (t) => wet(t.x, t.y));
    }
  }
}

/** Fish out at sea for boats: a few within reach of every base's coast, and more across the water. */
function deepFish(w: World, starts: Tile[]) {
  const map = w.map, n = map.width;
  const open: Tile[] = [];
  for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
    const t = new Tile(x, y);
    if (map.openWater(t, 1) && map.occupantAt(t) === 0) open.push(t);
  }
  if (!open.length) return;
  for (const s of starts) {
    const near = open.filter((t) => t.center.distance(s.center) < 22);
    for (let k = 0; k < 4 && near.length; k++) w.addNode("deep_fish", near.splice(w.rng.int(0, near.length - 1), 1)[0]);
  }
  for (let k = 0; k < Math.round(open.length / 90); k++) w.addNode("deep_fish", open[w.rng.int(0, open.length - 1)]);
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

/** A few animals of one kind standing near a point. */
function herd(w: World, kind: string, c: Tile, count: number) {
  for (let i = 0; i < count; i++) {
    const t = w.map.nearestPassable(new Tile(c.x + w.rng.int(-1, 1), c.y + w.rng.int(-1, 1)), 3);
    if (t) w.spawnAnimal(kind, t.center.add(new Vec2(w.rng.unit() * 0.4 - 0.2, w.rng.unit() * 0.4 - 0.2)));
  }
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

function forest(w: World, c: Tile, r: number, density: number) {
  blob(w, c, r, (t) => { if (w.rng.chance(density)) w.addNode("tree", t); });
}

function cluster(w: World, kind: string, c: Tile, count: number) {
  let placed = 0;
  for (let ring = 0; placed < count && ring <= 3; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring || placed >= count) continue;
        if (w.addNode(kind, new Tile(c.x + dx, c.y + dy))) placed++;
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
