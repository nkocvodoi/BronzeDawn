import { Tile, Vec2 } from "./geom";
import { GridMap } from "./grid";

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
];

/** Binary min-heap of (f, index). */
class Heap {
  private f: number[] = [];
  private i: number[] = [];
  get size() { return this.f.length; }

  push(f: number, i: number) {
    this.f.push(f); this.i.push(i);
    let c = this.f.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.f[p] <= this.f[c]) break;
      this.swap(p, c); c = p;
    }
  }

  pop(): number {
    const top = this.i[0];
    const lf = this.f.pop()!, li = this.i.pop()!;
    if (this.f.length) {
      this.f[0] = lf; this.i[0] = li;
      let p = 0;
      for (;;) {
        const l = 2 * p + 1, r = l + 1;
        let m = p;
        if (l < this.f.length && this.f[l] < this.f[m]) m = l;
        if (r < this.f.length && this.f[r] < this.f[m]) m = r;
        if (m === p) break;
        this.swap(p, m); p = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
    [this.i[a], this.i[b]] = [this.i[b], this.i[a]];
  }
}

/**
 * A* on the tile grid, 8 directions, no cutting corners past blocked tiles.
 * When the goal cannot be reached it returns the path to the closest tile found,
 * so a unit ordered onto a lake walks to the shore.
 */
export class Pathfinder {
  private g: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private gen = 0;
  maxExpanded = 9000;

  constructor(private map: GridMap) {
    const n = map.width * map.height;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  find(from: Vec2, toward: Vec2, isGoal: (t: Tile) => boolean): Vec2[] {
    const map = this.map, w = map.width;
    let start = from.tile;
    if (!map.passable(start)) { const near = map.nearestPassable(start, 3); if (near) start = near; }
    if (!map.inside(start)) return [];
    if (isGoal(start)) return [];

    const gen = ++this.gen;
    const tx = toward.x, ty = toward.y;
    const h = (x: number, y: number) => {
      const dx = Math.abs(x + 0.5 - tx), dy = Math.abs(y + 0.5 - ty);
      return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
    };

    const heap = new Heap();
    const si = start.y * w + start.x;
    this.g[si] = 0; this.parent[si] = -1; this.stamp[si] = gen;
    heap.push(h(start.x, start.y), si);
    let best = si, bestH = h(start.x, start.y), found = -1, expanded = 0;

    while (heap.size) {
      const ci = heap.pop();
      if (this.closed[ci] === gen) continue;
      this.closed[ci] = gen;
      const cx = ci % w, cy = (ci - cx) / w;
      if (isGoal(new Tile(cx, cy))) { found = ci; break; }
      const hc = h(cx, cy);
      if (hc < bestH) { bestH = hc; best = ci; }
      if (++expanded > this.maxExpanded) break;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!map.passableXY(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (!map.passableXY(cx + dx, cy) || !map.passableXY(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (this.closed[ni] === gen) continue;
        const g = this.g[ci] + cost;
        if (this.stamp[ni] !== gen || g < this.g[ni]) {
          this.stamp[ni] = gen; this.g[ni] = g; this.parent[ni] = ci;
          heap.push(g + h(nx, ny), ni);
        }
      }
    }

    let node = found >= 0 ? found : best;
    const tiles: Vec2[] = [];
    while (node >= 0 && node !== si) {
      tiles.push(new Vec2((node % w) + 0.5, Math.floor(node / w) + 0.5));
      node = this.parent[node];
    }
    tiles.reverse();
    return this.smooth(from, tiles);
  }

  /** Drops waypoints that a straight line can skip. */
  private smooth(from: Vec2, pts: Vec2[]): Vec2[] {
    if (pts.length <= 2) return pts;
    const out: Vec2[] = [];
    let anchor = from, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.map.clearLine(anchor, pts[j])) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }
}
