import { DIRS16, Footprint, RNG, Tile, Vec2 } from "./geom";
import { Terrain, walkable } from "./grid";
import type { Host, RandomMapSpec } from "./rmspec";
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
    herd(w, "gazelle", at(3, 9), w.rng.int(4, 6));
    herd(w, "gazelle", at(14, 13), w.rng.int(4, 5));
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
  // Each on land with room to roam. A spot too near a base, or out at sea, has none (as ever: the map's
  // share of animals goes with its land); one on a sandbank is tried again elsewhere.
  const wild = (kind: string, count: number, away: number, size: () => number) => {
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
        const t = farFromStarts(c, away) ? map.nearestPassable(c, 3) : null;
        if (!t) break;
        // On a narrow strip of a big island: the open land nearest it, if near.
        const at = roomy(w, t) ? (w.openLand(t) ? t : openNear(w, t, 10)) : null;
        if (at) { herd(w, kind, at, size()); break; }
      }
    }
  };
  wild("gazelle", Math.round(6 * scale), 16, () => w.rng.int(4, 7)); // herds of 4 to 7, as in the original
  wild("elephant", Math.round(3 * scale), 16, () => w.rng.int(1, 2));
  wild("lion", Math.round(3 * scale), 20, () => w.rng.int(1, 2));
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
      if (!farFromStarts(c, 15)) continue;
      // As the animals: by the nearest land, if any (far out at sea, none: the map's share goes with its
      // land); on a sandbank, elsewhere.
      const t = map.nearestPassable(c, 3);
      if (!t) break;
      if (roomy(w, t)) { cluster(w, kind, t, kind === "berry_bush" ? 5 : 4); break; }
    }
  }

  if (islands(type)) islandWoods(w, starts);

  // Land paths between the bases, except where the sea is meant to part them.
  if (!islands(type)) connect(w, starts);
  if (!landOnly(type)) deepFish(w, starts);
  w.nodes = w.nodes.filter((x) => x.alive);
  const [hilly, cliffy, high] = RELIEF[type];
  hills(w, starts, hilly, high);
  if (cliffy) cliffs(w, starts, cliffy);
  if (!landOnly(type)) openToSea(w, starts);
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

/** An island holds only its own wood, where a land map shares all its woods: the woods placed around a base
 *  left an island about 3,000, gone before its boats were built. Woods go round the island's edge, away
 *  from the town, until it holds about `ISLAND_WOOD`. */
const ISLAND_WOOD = 10000;
function islandWoods(w: World, starts: Tile[]) {
  const map = w.map;
  for (const s of starts) {
    // The island under the base: every land tile joined to it, trees and all.
    const land = new Uint8Array(map.width * map.height), stack = [s];
    land[map.index(s)] = 1;
    while (stack.length) {
      const t = stack.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = new Tile(t.x + dx, t.y + dy);
        if (!map.inside(o) || land[map.index(o)] || map.terrainAt(o) === Terrain.water) continue;
        land[map.index(o)] = 1;
        stack.push(o);
      }
    }
    const wood = () => w.nodes.reduce((a, n) => a + (n.alive && n.def.resource === "wood" && land[map.index(n.tile)] ? n.amount : 0), 0);
    for (let tries = 0; tries < 60 && wood() < ISLAND_WOOD; tries++) {
      const c = s.center.add(DIRS16[w.rng.int(0, 15)].mul(w.rng.int(12, 18))).tile;
      if (!map.inside(c) || !land[map.index(c)]) continue;
      forest(w, c, 2 + w.rng.int(0, 15) / 10, 0.92);
    }
  }
  // The islands nobody starts on are there to be settled: each grows woods of its own, about 18 wood a
  // tile of ground (an islet of 100 tiles, some 1,800), with room left on its shore for a Storage Pit.
  const seen = new Uint8Array(map.width * map.height);
  for (const s of starts) { const r = map.reachable(s, () => true); for (let i = 0; i < r.length; i++) if (r[i]) seen[i] = 1; }
  for (let i = 0; i < seen.length; i++) {
    const t0 = new Tile(i % map.width, Math.floor(i / map.width));
    if (seen[i] || map.terrainAt(t0) === Terrain.water) continue;
    const isle: Tile[] = [], stack = [t0];
    seen[i] = 1;
    while (stack.length) {
      const t = stack.pop()!;
      isle.push(t);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = new Tile(t.x + dx, t.y + dy);
        if (!map.inside(o) || seen[map.index(o)] || map.terrainAt(o) === Terrain.water) continue;
        seen[map.index(o)] = 1;
        stack.push(o);
      }
    }
    if (isle.length < 40) continue;
    const on = new Set(isle.map((t) => map.index(t)));
    const wood = () => w.nodes.reduce((a, n) => a + (n.alive && n.def.resource === "wood" && on.has(map.index(n.tile)) ? n.amount : 0), 0);
    for (let tries = 0; tries < 20 && wood() < isle.length * 18; tries++) {
      const c = isle[w.rng.int(0, isle.length - 1)];
      if (map.coastal(c)) continue;
      forest(w, c, 1.5 + w.rng.int(0, 10) / 10, 0.85);
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
    // Each base's island is big enough for a town and a ring of woods around it (see islandWoods).
    for (const s of w.startTiles) {
      blob(w, s, n * (big ? 0.28 : 0.24), land);
      for (let k = 0; k < 3; k++) blob(w, new Tile(s.x + w.rng.int(-6, 6), s.y + w.rng.int(-6, 6)), n * (big ? 0.16 : 0.13), land);
    }
    const scale = (n * n) / (72 * 72);
    for (let k = 0; k < Math.round((big ? 1 : 4) * scale); k++) {
      for (let tries = 0; tries < 30; tries++) {
        const c = new Tile(w.rng.int(8, n - 9), w.rng.int(8, n - 9));
        if (w.startTiles.every((s) => s.center.distance(c.center) > n * 0.35)) { blob(w, c, n * (big ? 0.07 : 0.085), land); break; }
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

/** The nearest open land to a tile, within r, on land with room to roam; nearest first, ring by ring. */
function openNear(w: World, t: Tile, r: number): Tile | null {
  for (let d = 1; d <= r; d++) {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const c = new Tile(t.x + dx, t.y + dy);
      if (w.map.inside(c) && w.map.passable(c) && roomy(w, c) && w.openLand(c)) return c;
    }
  }
  return null;
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

function forest(w: World, c: Tile, r: number, density: number) {
  blob(w, c, r, (t) => { if (w.rng.chance(density)) w.addNode("tree", t); });
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
