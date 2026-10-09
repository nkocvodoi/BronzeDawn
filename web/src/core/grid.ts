import { Footprint, Tile, Vec2 } from "./geom";

export enum Terrain { grass, sand, water, dirt }
export const walkable = (t: Terrain) => t !== Terrain.water;

/** The tile grid shared by pathfinding, placement and fog of war. */
export class GridMap {
  readonly terrain: Uint8Array;
  /** Entity id of the building or resource on each tile, 0 for none. */
  readonly occupant: Int32Array;
  /** 1 where an occupant blocks movement. Farms occupy tiles but are walked over. */
  readonly solid: Uint8Array;
  /** Per-tile number for drawing variety. No effect on rules. */
  readonly shade: Uint8Array;
  /** Who is moving: boats go on water and land units on land. The world sets it around each boat's
   *  turn and puts it back; every passability question below answers for it. */
  naval = false;

  constructor(readonly width: number, readonly height: number) {
    this.terrain = new Uint8Array(width * height);
    this.occupant = new Int32Array(width * height);
    this.solid = new Uint8Array(width * height);
    this.shade = new Uint8Array(width * height);
  }

  inside(t: Tile) { return t.x >= 0 && t.y >= 0 && t.x < this.width && t.y < this.height; }
  index(t: Tile) { return t.y * this.width + t.x; }
  terrainAt(t: Tile): Terrain { return this.inside(t) ? this.terrain[this.index(t)] : Terrain.water; }
  occupantAt(t: Tile) { return this.inside(t) ? this.occupant[this.index(t)] : 0; }

  passableXY(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const i = y * this.width + x;
    return (this.terrain[i] === Terrain.water) === this.naval && this.solid[i] === 0;
  }

  /** Water no boat can leave: every neighbour is water too (for deep-sea fish). */
  openWater(t: Tile, r = 1) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.terrainAt(new Tile(t.x + dx, t.y + dy)) !== Terrain.water) return false;
    return true;
  }

  /** Land that touches water on a side: where a dock may stand. */
  coastal(t: Tile) {
    return this.terrainAt(t) !== Terrain.water && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const o = new Tile(t.x + dx, t.y + dy);
      return this.inside(o) && this.terrainAt(o) === Terrain.water;
    });
  }

  passable(t: Tile) { return this.passableXY(t.x, t.y); }

  setOccupant(fp: Footprint, id: number, solid = id !== 0) {
    for (const t of fp.tiles()) {
      if (!this.inside(t)) continue;
      this.occupant[this.index(t)] = id;
      this.solid[this.index(t)] = solid ? 1 : 0;
    }
  }

  solidAt(t: Tile) { return this.inside(t) && this.solid[this.index(t)] === 1; }

  /** True when a straight walk from a to b crosses only passable tiles. */
  clearLine(a: Vec2, b: Vec2) {
    const d = b.sub(a);
    const steps = Math.ceil(Math.max(Math.abs(d.x), Math.abs(d.y)) * 3);
    if (steps === 0) return true;
    const len = Math.max(d.length, 0.0001);
    const sx = (-d.y / len) * 0.3, sy = (d.x / len) * 0.3;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const px = a.x + d.x * k, py = a.y + d.y * k;
      if (!this.passableXY(Math.floor(px), Math.floor(py))) return false;
      if (!this.passableXY(Math.floor(px + sx), Math.floor(py + sy))) return false;
      if (!this.passableXY(Math.floor(px - sx), Math.floor(py - sy))) return false;
    }
    return true;
  }

  /** The nearest passable tile to t, searching outward in rings. */
  nearestPassable(t: Tile, maxRadius = 12): Tile | null {
    if (this.passable(t)) return t;
    for (let r = 1; r <= maxRadius; r++) {
      let best: Tile | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.passableXY(t.x + dx, t.y + dy)) {
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = new Tile(t.x + dx, t.y + dy); }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Tiles reachable on foot from start, 4-connected. Occupants block unless `ignoring` says not. */
  reachable(start: Tile, ignoring: (id: number) => boolean = () => false): Uint8Array {
    const seen = new Uint8Array(this.width * this.height);
    if (!this.inside(start)) return seen;
    const stack = [start];
    seen[this.index(start)] = 1;
    while (stack.length) {
      const t = stack.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = new Tile(t.x + dx, t.y + dy);
        if (!this.inside(n)) continue;
        const i = this.index(n);
        if (seen[i] || this.terrain[i] === Terrain.water) continue;
        if (this.solid[i] !== 0 && !ignoring(this.occupant[i])) continue;
        seen[i] = 1;
        stack.push(n);
      }
    }
    return seen;
  }
}
