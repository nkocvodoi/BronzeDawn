// Mouse pointers that tell you what a right-click will do, drawn here in pixel art:
// a sword over an enemy, an axe over trees, a pick over mines, a basket over food,
// a hammer over a foundation and a staff for priests.
import { ASSETS } from "./assets";

export type CursorKind = "arrow" | "sword" | "axe" | "pick" | "basket" | "hammer" | "staff";

const SIZE = 32;
const OUTLINE = "#140c06";

type Px = (x: number, y: number, c: string) => void;

/** Draws on a 32 x 32 grid: every shape is laid down in black one pixel wider first, so it reads on any ground. */
function sprite(draw: (px: Px, pass: 0 | 1) => void): string {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!;
  for (const pass of [0, 1] as const) {
    const px: Px = (x, y, col) => {
      if (pass === 0) { g.fillStyle = OUTLINE; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
      else { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    };
    draw(px, pass);
  }
  return c.toDataURL();
}

function line(px: Px, x0: number, y0: number, x1: number, y1: number, col: string | ((t: number) => string), w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const c = typeof col === "string" ? col : col(t);
    for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) px(x + a, y + b, c);
  }
}

function fill(px: Px, pts: [number, number][], col: (x: number, y: number) => string) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) px(x, y, col(x, y));
  }
}

const BRONZE = (t: number) => (t < 0.3 ? "#f3d27a" : t < 0.7 ? "#c99a3c" : "#8a6122");
const STEEL = (t: number) => (t < 0.5 ? "#e8ecef" : "#a9b1b8");
const WOOD = "#8a5a2b", WOOD_D = "#5e3a18";

const DRAW: Record<CursorKind, { hot: [number, number]; draw: (px: Px) => void }> = {
  arrow: { hot: [2, 2], draw: (px) => {
    fill(px, [[2, 2], [2, 21], [7, 16], [11, 25], [14, 24], [10, 15], [17, 15]], (x, y) => ((x + y) < 16 ? "#f6dc8c" : (x - y) > -4 ? "#c99a3c" : "#a77a2c"));
  } },
  sword: { hot: [2, 2], draw: (px) => {
    line(px, 3, 3, 19, 19, STEEL, 2);                 // blade
    line(px, 4, 3, 19, 18, "#ffffff", 1);             // edge catching the light
    line(px, 15, 23, 23, 15, BRONZE, 2);              // guard
    line(px, 20, 20, 26, 26, WOOD, 2);                // grip
    px(27, 27, "#c99a3c"); px(28, 28, "#c99a3c");     // pommel
  } },
  axe: { hot: [6, 4], draw: (px) => {
    line(px, 23, 28, 10, 4, (t) => (t < 0.5 ? WOOD : WOOD_D), 2);
    // A bearded blade on one side of the haft, its edge curved.
    fill(px, [[11, 7], [6, 2], [2, 4], [1, 9], [3, 14], [7, 15], [13, 11]], (x, y) => (x < 4 ? "#ffffff" : x + y < 14 ? "#d9dde0" : "#8e979e"));
  } },
  pick: { hot: [4, 9], draw: (px) => {
    line(px, 24, 27, 13, 9, WOOD, 2);
    line(px, 3, 10, 13, 5, STEEL, 2);
    line(px, 13, 5, 23, 4, STEEL, 2);
    px(3, 11, "#ffffff"); px(24, 4, "#ffffff");
  } },
  basket: { hot: [14, 14], draw: (px) => {
    for (let y = 0; y < 8; y++) line(px, 6 + y * 0.4, 14 + y, 23 - y * 0.4, 14 + y, (t) => ((Math.floor(t * 8) + y) % 2 ? "#c8964a" : "#9c6b2a"));
    line(px, 6, 13, 23, 13, "#e0b066");
    line(px, 9, 13, 11, 6, WOOD_D); line(px, 11, 6, 18, 6, WOOD_D); line(px, 18, 6, 20, 13, WOOD_D);
    px(11, 11, "#c4293a"); px(13, 10, "#e03a4c"); px(16, 11, "#c4293a"); px(14, 12, "#e03a4c");
  } },
  hammer: { hot: [8, 6], draw: (px) => {
    line(px, 23, 27, 11, 10, WOOD, 2);
    // A mallet: a long block of wood across the handle, with a bronze band.
    fill(px, [[3, 10], [14, 2], [18, 7], [7, 15]], (x, y) => (Math.abs((x - 10.5) * 0.8 - (y - 8.5) * 0.6) < 1.2 ? "#c99a3c" : (x + y) < 17 ? "#b07a42" : "#7a4f24"));
  } },
  staff: { hot: [10, 3], draw: (px) => {
    line(px, 10, 8, 22, 28, WOOD, 2);
    for (let a = 0; a < 16; a++) { const r = a / 16 * Math.PI * 2; px(10 + Math.cos(r) * 4, 5 + Math.sin(r) * 4, "#f3d27a"); }
    px(10, 5, "#ffffff");
  } },
};

let art: Record<CursorKind, { url: string; hot: [number, number] }> | null = null;
let cache: Record<CursorKind, string> | null = null;

/** Each pointer as an image and its hot spot, drawn once; a file from the assets replaces any of them. */
export function cursorArt() {
  if (art) return art;
  art = {} as Record<CursorKind, { url: string; hot: [number, number] }>;
  const files = ASSETS.manifest.cursors ?? {};
  for (const k of Object.keys(DRAW) as CursorKind[]) {
    const f = files[k];
    art[k] = f && ASSETS.image(f.file) ? { url: ASSETS.url(f.file), hot: f.hot } : { url: sprite((px) => DRAW[k].draw(px)), hot: DRAW[k].hot };
  }
  return art;
}

/** CSS cursor values for each kind. */
export function cursors(): Record<CursorKind, string> {
  if (cache) return cache;
  const out = {} as Record<CursorKind, string>;
  for (const [k, a] of Object.entries(cursorArt()) as [CursorKind, { url: string; hot: [number, number] }][]) {
    out[k] = `url(${a.url}) ${a.hot[0]} ${a.hot[1]}, ${k === "arrow" ? "default" : "pointer"}`;
  }
  cache = out;
  return out;
}
