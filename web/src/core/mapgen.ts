import { DIRS16, Footprint, Tile, Vec2 } from "./geom";
import { Terrain } from "./grid";
import type { World } from "./world";

/**
 * Builds a skirmish map from the world's seed: lakes, forests, and a start for each
 * player with a town center, villagers, berries, a forest, gold and stone close by.
 */
export function generateMap(w: World) {
  const map = w.map;
  const n = map.width;
  for (let i = 0; i < map.shade.length; i++) map.shade[i] = w.rng.int(0, 255);

  const starts = startTiles(w.players.length, n);
  w.startTiles = starts;
  const farFromStarts = (t: Tile, d: number) => starts.every((s) => t.center.distance(s.center) >= d);

  // Lakes, away from the bases.
  for (let k = 0; k < 3; k++) {
    let c = new Tile(0, 0);
    for (let tries = 0; tries < 30; tries++) {
      c = new Tile(w.rng.int(8, n - 9), w.rng.int(8, n - 9));
      if (farFromStarts(c, 18)) break;
    }
    const r = w.rng.int(3, 6);
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
    forest(w, at(5, 10), 3.2, 0.85);
    forest(w, at(8, 12), 2.2, 0.8);
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

  // The rest of the map.
  for (let k = 0; k < 16; k++) {
    const c = new Tile(w.rng.int(2, n - 3), w.rng.int(2, n - 3));
    if (farFromStarts(c, 11)) forest(w, c, w.rng.int(2, 4), 0.75);
  }
  for (let k = 0; k < 70; k++) {
    const c = new Tile(w.rng.int(1, n - 2), w.rng.int(1, n - 2));
    if (farFromStarts(c, 8)) w.addNode("lone_tree", c);
  }
  // Wild animals across the map: gazelles and elephants to hunt, lions to fear, alligators by the water.
  for (let k = 0; k < 6; k++) {
    const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
    if (farFromStarts(c, 16)) herd(w, "gazelle", c, w.rng.int(3, 6));
  }
  for (let k = 0; k < 3; k++) {
    const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
    if (farFromStarts(c, 16)) herd(w, "elephant", c, w.rng.int(1, 2));
  }
  for (let k = 0; k < 3; k++) {
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
      else if (gators < 4 && w.rng.chance(0.01) && farFromStarts(t, 18)) {
        const land = map.nearestPassable(t, 2);
        if (land) { herd(w, "alligator", land, 1); gators++; }
      }
    }
  }
  for (const kind of ["gold_mine", "gold_mine", "stone_mine", "stone_mine", "berry_bush", "berry_bush", "berry_bush"]) {
    for (let tries = 0; tries < 30; tries++) {
      const c = new Tile(w.rng.int(6, n - 7), w.rng.int(6, n - 7));
      if (farFromStarts(c, 15)) { cluster(w, kind, c, kind === "berry_bush" ? 5 : 4); break; }
    }
  }

  connect(w, starts);
  w.nodes = w.nodes.filter((x) => x.alive);
}

export function startTiles(count: number, n: number): Tile[] {
  const corners = [new Tile(14, n - 15), new Tile(n - 15, 14), new Tile(14, 14), new Tile(n - 15, n - 15)];
  return corners.slice(0, Math.max(1, Math.min(count, corners.length)));
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
          if (w.map.terrainAt(t) === Terrain.water) w.map.terrain[w.map.index(t)] = Terrain.sand;
        }
      }
    }
  }
}
