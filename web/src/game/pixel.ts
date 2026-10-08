// A tiny pixel painter: hard-edged shapes on a 1x canvas, an automatic dark outline,
// and textures that scale with nearest-neighbour so every art pixel stays square.
import { Texture } from "pixi.js";

export type RGB = readonly [number, number, number];

/** One art pixel is this many world units on screen at zoom 1. */
export const PX = 2;

export const rgb = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const darken = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
export const lighten = (c: RGB, k: number): RGB => mix(c, [255, 255, 255], k);

/** Deterministic noise in 0..1 for (x, y, salt). Same picture every time. */
export function hash(x: number, y: number, salt = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 4x4 Bayer matrix, for ordered dithering. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export class PixelCanvas {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGB, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a;
  }

  get(x: number, y: number): RGB | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return this.data[i + 3] ? [this.data[i], this.data[i + 1], this.data[i + 2]] : null;
  }

  alphaAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Calls fn for every pixel inside a convex polygon (pixel centres, hard edges). */
  scan(pts: readonly (readonly [number, number])[], fn: (x: number, y: number) => void) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((cy < ay) === (cy < by)) continue;
        const x = ax + ((cy - ay) / (by - ay)) * (bx - ax);
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
      if (lo > hi) continue;
      for (let x = Math.max(0, Math.round(lo)); x < Math.min(this.w, Math.round(hi)); x++) fn(x, y);
    }
  }

  /** Filled convex polygon with hard edges. `c` can vary the colour per pixel. */
  poly(pts: readonly (readonly [number, number])[], c: RGB | ((x: number, y: number) => RGB)) {
    this.scan(pts, (x, y) => this.set(x, y, typeof c === "function" ? c(x, y) : c));
  }

  /** Makes every pixel inside a convex polygon transparent. */
  erase(pts: readonly (readonly [number, number])[]) {
    this.scan(pts, (x, y) => { this.data[(y * this.w + x) * 4 + 3] = 0; });
  }

  /** A thick line: a run of square dots. */
  thick(x0: number, y0: number, x1: number, y1: number, c: RGB, w = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.rect(Math.round(x0 + ((x1 - x0) * i) / n - (w - 1) / 2), Math.round(y0 + ((y1 - y0) * i) / n - (w - 1) / 2), w, w, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB | ((x: number, y: number) => RGB)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof c === "function" ? c(x, y) : c);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }

  /** Soft drop shadow: a dithered dark ellipse that only fills empty pixels. */
  shadow(cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1 && !this.alphaAt(x, y) && bayer(x, y) < 0.75 - d * 0.4) this.set(x, y, [0, 0, 0], 110);
      }
    }
  }

  /** A one-pixel dark outline around everything drawn so far (shadows excluded).
   *  With `soft` above 0, the outline takes in a little of the colour it borders, which reads less harsh. */
  outline(c: RGB = [24, 16, 10], soft = 0) {
    const solid = (x: number, y: number) => this.alphaAt(x, y) === 255;
    const add: [number, number, RGB][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        let n: RGB | null = null;
        for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (solid(x + dx, y + dy)) { n = this.get(x + dx, y + dy); break; }
        if (n) add.push([x, y, soft ? mix(c, n, soft) : c]);
      }
    }
    for (const [x, y, k] of add) this.set(x, y, k);
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext("2d")!.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return canvas;
  }

  toTexture(): Texture {
    const t = Texture.from(this.toCanvas());
    t.source.scaleMode = "nearest";
    return t;
  }
}
