import { Vec2 } from "../core/geom";

/** Isometric 2:1. A tile is a diamond 64 wide and 32 tall. Screen y points down. */
export const HALF_W = 32;
export const HALF_H = 16;

export const iso = (p: Vec2) => ({ x: (p.x - p.y) * HALF_W, y: (p.x + p.y) * HALF_H });

export function fromIso(x: number, y: number): Vec2 {
  const a = x / HALF_W; // x - y
  const b = y / HALF_H; // x + y
  return new Vec2((a + b) / 2, (b - a) / 2);
}

/** Draw order: further down the screen is in front. */
export const depth = (p: Vec2) => p.x + p.y;
