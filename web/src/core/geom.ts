// Geometry in tile units, and the seeded RNG.
// The simulation only uses + - * / and sqrt, which every browser computes the same way,
// so the same seed and the same commands give the same game everywhere.

export class Vec2 {
  constructor(readonly x: number, readonly y: number) {}
  add(o: Vec2) { return new Vec2(this.x + o.x, this.y + o.y); }
  sub(o: Vec2) { return new Vec2(this.x - o.x, this.y - o.y); }
  mul(k: number) { return new Vec2(this.x * k, this.y * k); }
  get length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  distance(o: Vec2) { const dx = this.x - o.x, dy = this.y - o.y; return Math.sqrt(dx * dx + dy * dy); }
  get tile() { return new Tile(Math.floor(this.x), Math.floor(this.y)); }
  lerp(o: Vec2, t: number) { return new Vec2(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t); }
  equals(o: Vec2) { return this.x === o.x && this.y === o.y; }
}

export class Tile {
  constructor(readonly x: number, readonly y: number) {}
  get center() { return new Vec2(this.x + 0.5, this.y + 0.5); }
  add(o: Tile) { return new Tile(this.x + o.x, this.y + o.y); }
  equals(o: Tile) { return this.x === o.x && this.y === o.y; }
}

/** What a building or a resource covers. */
export class Footprint {
  constructor(readonly origin: Tile, readonly size: number) {}
  get minX() { return this.origin.x; }
  get minY() { return this.origin.y; }
  get maxX() { return this.origin.x + this.size; }
  get maxY() { return this.origin.y + this.size; }
  get center() { return new Vec2(this.minX + this.size / 2, this.minY + this.size / 2); }

  tiles(): Tile[] {
    const out: Tile[] = [];
    for (let dy = 0; dy < this.size; dy++) for (let dx = 0; dx < this.size; dx++) out.push(new Tile(this.origin.x + dx, this.origin.y + dy));
    return out;
  }

  contains(t: Tile) {
    return t.x >= this.origin.x && t.y >= this.origin.y && t.x < this.origin.x + this.size && t.y < this.origin.y + this.size;
  }

  /** Distance from a point to the nearest edge, 0 inside. */
  distance(p: Vec2) {
    const dx = Math.max(this.minX - p.x, 0, p.x - this.maxX);
    const dy = Math.max(this.minY - p.y, 0, p.y - this.maxY);
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/** 16 compass directions as exact constants, so nothing depends on Math.cos. */
export const DIRS16: Vec2[] = [
  [1, 0], [0.9238795325, 0.3826834324], [0.7071067812, 0.7071067812], [0.3826834324, 0.9238795325],
  [0, 1], [-0.3826834324, 0.9238795325], [-0.7071067812, 0.7071067812], [-0.9238795325, 0.3826834324],
  [-1, 0], [-0.9238795325, -0.3826834324], [-0.7071067812, -0.7071067812], [-0.3826834324, -0.9238795325],
  [0, -1], [0.3826834324, -0.9238795325], [0.7071067812, -0.7071067812], [0.9238795325, -0.3826834324],
].map(([x, y]) => new Vec2(x, y));

/** xoshiro128** seeded by splitmix32 from the match seed. Integer math only. */
export class RNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // splitmix32 to fill the state from one number
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s0 = next(); this.s1 = next(); this.s2 = next(); this.s3 = next();
  }

  /** xoshiro128** */
  nextU32(): number {
    const r = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 ^= this.s0; this.s3 ^= this.s1; this.s1 ^= this.s2; this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    this.s0 >>>= 0; this.s1 >>>= 0; this.s2 >>>= 0; this.s3 >>>= 0;
    return r;
  }

  /** 0 ..< 1 */
  unit() { return this.nextU32() / 4294967296; }
  /** lo ... hi inclusive */
  int(lo: number, hi: number) { return lo + (this.nextU32() % (hi - lo + 1)); }
  chance(p: number) { return this.unit() < p; }
}

function rotl(x: number, k: number) { return ((x << k) | (x >>> (32 - k))) >>> 0; }
