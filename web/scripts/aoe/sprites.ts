// Turns AoE graphics (empires.dat graphics + .drs SLPs) into Bronze Dawn sprite sheets and manifest entries.

import type { DatFile, DatGraphic } from "./dat";
import type { DrsFile } from "./drs";
import { encodePng } from "./png";
import { readSlp, type SlpFrame } from "./slp";

export type Palette = [number, number, number][];

export interface Library {
  dat: DatFile;
  palette: Palette;
  /** SLPs by id; Rise of Rome files replace the base game's. */
  slps: Map<number, Uint8Array>;
}

export function slpIndex(...archives: DrsFile[][]): Map<number, Uint8Array> {
  const m = new Map<number, Uint8Array>();
  for (const a of archives) for (const f of a) if (f.ext === "slp") m.set(f.id, f.data);
  return m;
}

const cache = new Map<string, SlpFrame[] | null>();
function frames(lib: Library, slp: number): SlpFrame[] | null {
  const key = `${slp}`;
  if (cache.has(key)) return cache.get(key)!;
  const data = lib.slps.get(slp);
  let out: SlpFrame[] | null = null;
  if (data) {
    try { out = readSlp(data); } catch { out = null; }
  }
  cache.set(key, out);
  return out;
}

/** A frame placed relative to its hotspot (the unit's feet / the building's centre on the ground). */
interface Placed { frame: SlpFrame; dx: number; dy: number }

/** One picture: the graphic's own SLP frame plus its deltas (building parts, smoke...). */
function layers(lib: Library, g: DatGraphic, frame: number, angle: number, depth = 0): Placed[] {
  const out: Placed[] = [];
  const own = g.slp;
  if (own >= 0) {
    const fs = frames(lib, own);
    if (fs) {
      const perAngle = Math.max(1, g.frameCount);
      const i = Math.min(fs.length - 1, angle * perAngle + (frame % perAngle));
      if (sane(fs[i])) out.push({ frame: fs[i], dx: 0, dy: 0 });
    }
  }
  if (depth < 3) {
    for (const d of g.deltas) {
      if (d.graphic < 0) continue;
      const sub = lib.dat.graphics[d.graphic];
      if (!sub) continue;
      if (d.displayAngle >= 0 && d.displayAngle !== angle) continue;
      const subAngle = Math.min(angle, Math.max(0, angleRows(sub) - 1));
      for (const p of layers(lib, sub, frame, subAngle, depth + 1)) {
        out.push({ frame: p.frame, dx: p.dx + d.offsetX, dy: p.dy + d.offsetY });
      }
    }
  }
  return out;
}

/** A few SLPs in the original carry placeholder frames with junk sizes or hotspots. */
const sane = (f: SlpFrame) =>
  f.width > 0 && f.height > 0 && f.width < 2048 && f.height < 2048 && Math.abs(f.hotspotX) < 2048 && Math.abs(f.hotspotY) < 2048;



/** Rows stored in the SLP: AoE keeps 5 of 8 directions and mirrors the other 3. */
export function angleRows(g: DatGraphic): number {
  if (g.angleCount <= 1) return 1;
  return g.mirroringMode ? Math.floor(g.angleCount / 2) + 1 : g.angleCount;
}

export interface Anim { name: string; graphic: DatGraphic }

export interface Sheet {
  png: Buffer;
  frame: [number, number];
  anchor: [number, number];
  directions: 5 | 8;
  anims: Record<string, { row: number; frames: number; fps: number }>;
}

/** Bronze Dawn sheet: each animation takes one row per direction (S, SW, W, NW, N), columns are frames. */
export function unitSheet(lib: Library, anims: Anim[]): Sheet | null {
  const picked = anims.filter((a) => a.graphic);
  if (!picked.length) return null;
  const rowsOf = (g: DatGraphic) => Math.min(5, angleRows(g));
  // Bounding box around the hotspot over every frame.
  let left = 0, top = 0, right = 1, bottom = 1;
  const cells: { anim: number; dir: number; col: number; parts: Placed[] }[] = [];
  picked.forEach((a, ai) => {
    const g = a.graphic;
    const n = Math.max(1, g.frameCount);
    for (let dir = 0; dir < 5; dir++) {
      const angle = Math.min(dir, rowsOf(g) - 1);
      for (let col = 0; col < n; col++) {
        const parts = layers(lib, g, col, angle);
        cells.push({ anim: ai, dir, col, parts });
        for (const p of parts) {
          left = Math.max(left, p.frame.hotspotX - p.dx);
          top = Math.max(top, p.frame.hotspotY - p.dy);
          right = Math.max(right, p.frame.width - p.frame.hotspotX + p.dx);
          bottom = Math.max(bottom, p.frame.height - p.frame.hotspotY + p.dy);
        }
      }
    }
  });
  const fw = left + right;
  const fh = top + bottom;
  const cols = Math.max(...picked.map((a) => Math.max(1, a.graphic.frameCount)));
  const rows = picked.length * 5;
  const W = fw * cols;
  const H = fh * rows;
  const rgba = new Uint8Array(W * H * 4);
  for (const c of cells) {
    const ox = c.col * fw + left;
    const oy = (c.anim * 5 + c.dir) * fh + top;
    for (const p of c.parts) blit(lib.palette, rgba, W, p.frame, ox + p.dx - p.frame.hotspotX, oy + p.dy - p.frame.hotspotY);
  }
  const animsOut: Sheet["anims"] = {};
  picked.forEach((a, i) => {
    const g = a.graphic;
    const frames = Math.max(1, g.frameCount);
    const dur = g.frameDuration > 0 ? g.frameDuration : 0.1;
    animsOut[a.name] = { row: i * 5, frames, fps: Number((1 / dur).toFixed(2)) };
  });
  return { png: encodePng(W, H, rgba), frame: [fw, fh], anchor: [left, top], directions: 5, anims: animsOut };
}

/** A still picture (building, resource, tree variant, icon). Returns the PNG and the hotspot. */
export function still(lib: Library, g: DatGraphic, opts: { frame?: number; angle?: number } = {}): { png: Buffer; anchor: [number, number]; size: [number, number] } | null {
  const parts = layers(lib, g, opts.frame ?? 0, opts.angle ?? 0);
  if (!parts.length) return null;
  let left = 0, top = 0, right = 1, bottom = 1;
  for (const p of parts) {
    left = Math.max(left, p.frame.hotspotX - p.dx);
    top = Math.max(top, p.frame.hotspotY - p.dy);
    right = Math.max(right, p.frame.width - p.frame.hotspotX + p.dx);
    bottom = Math.max(bottom, p.frame.height - p.frame.hotspotY + p.dy);
  }
  const W = left + right;
  const H = top + bottom;
  const rgba = new Uint8Array(W * H * 4);
  for (const p of parts) blit(lib.palette, rgba, W, p.frame, left + p.dx - p.frame.hotspotX, top + p.dy - p.frame.hotspotY);
  return { png: encodePng(W, H, rgba), anchor: [left, top], size: [W, H] };
}

/** A raw SLP frame (icons, terrain tiles), no hotspot handling. */
export function slpFrame(lib: Library, slp: number, frame: number): Buffer | null {
  const fs = frames(lib, slp);
  if (!fs || !fs[frame]) return null;
  const f = fs[frame];
  const rgba = new Uint8Array(f.width * f.height * 4);
  blit(lib.palette, rgba, f.width, f, 0, 0);
  return encodePng(f.width, f.height, rgba);
}

export function slpFrameCount(lib: Library, slp: number): number {
  return frames(lib, slp)?.length ?? 0;
}

/**
 * Draw a frame. Player-colour pixels become shades of magenta, which Bronze Dawn repaints in each player's
 * colour; shadows become translucent black.
 */
function blit(pal: Palette, rgba: Uint8Array, W: number, f: SlpFrame, x0: number, y0: number): void {
  const H = rgba.length / 4 / W;
  for (let y = 0; y < f.height; y++) {
    const ty = y0 + y;
    if (ty < 0 || ty >= H) continue;
    for (let x = 0; x < f.width; x++) {
      const tx = x0 + x;
      if (tx < 0 || tx >= W) continue;
      const k = y * f.width + x;
      const o = (ty * W + tx) * 4;
      const c = f.pixels[k];
      if (f.player[k] >= 0) {
        const [r, g, b] = pal[(c + 16) & 0xff];
        const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const m = Math.max(48, Math.min(255, Math.round(48 + l * 0.85)));
        rgba[o] = m; rgba[o + 1] = 0; rgba[o + 2] = m; rgba[o + 3] = 255;
      } else if (c >= 0) {
        const [r, g, b] = pal[c];
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
      } else if (f.shadow[k] && rgba[o + 3] === 0) {
        rgba[o + 3] = 96;
      }
    }
  }
}
