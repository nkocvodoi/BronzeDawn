// Every texture is drawn in code. No assets from anywhere.
// The drawing uses y-up coordinates (origin bottom-left), the same numbers as the Mac build.
import { Texture } from "pixi.js";
import type { BuildingDef } from "../core/rules";
import { GridMap, Terrain } from "../core/grid";
import { Tile } from "../core/geom";
import { HALF_H, HALF_W, iso } from "./iso";

export const PLAYER_COLORS = ["#3373eb", "#db3833", "#f2c733", "#40b34d"];
export const playerColor = (id: number) => (id >= 0 ? PLAYER_COLORS[id % PLAYER_COLORS.length] : "#ffffff");

export interface Pic { texture: Texture; w: number; h: number; ax: number; ay: number }

type Ctx = CanvasRenderingContext2D;
const SCALE = 2;

function rgb(r: number, g: number, b: number, a = 1) {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return rgb(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k));
}

const cache = new Map<string, Pic>();

/** A canvas with y pointing up, drawn at 2x for sharp sprites. anchor is in y-up fractions. */
function pic(key: string, w: number, h: number, anchorX: number, anchorYUp: number, draw: (c: Ctx) => void): Pic {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * SCALE);
  canvas.height = Math.ceil(h * SCALE);
  const c = canvas.getContext("2d")!;
  c.translate(0, canvas.height);
  c.scale(SCALE, -SCALE);
  draw(c);
  const p: Pic = { texture: Texture.from(canvas), w, h, ax: anchorX, ay: 1 - anchorYUp };
  cache.set(key, p);
  return p;
}

function ellipse(c: Ctx, x: number, y: number, w: number, h: number) {
  c.beginPath();
  c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  c.fill();
}

function poly(c: Ctx, pts: [number, number][], fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.fill();
}

function line(c: Ctx, pts: [number, number][], color: string, width: number) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
  c.stroke();
}

function shadow(c: Ctx, x: number, y: number, w: number, h: number) {
  c.fillStyle = rgb(0, 0, 0, 0.28);
  ellipse(c, x, y, w, h);
}

// ---- terrain

/** The map as chunks of canvas, each 1024 x 1024 points. Returns each chunk with its screen origin. */
export function terrainChunks(map: GridMap): { texture: Texture; x: number; y: number; size: number }[] {
  const W = (map.width + map.height) * HALF_W, H = (map.width + map.height) * HALF_H;
  const left = -map.height * HALF_W;
  const size = 1024;
  const out: { texture: Texture; x: number; y: number; size: number }[] = [];
  for (let cy = 0; cy < H; cy += size) {
    for (let cx = 0; cx < W; cx += size) {
      const canvas = document.createElement("canvas");
      canvas.width = size * SCALE;
      canvas.height = size * SCALE;
      const c = canvas.getContext("2d")!;
      c.scale(SCALE, SCALE);
      c.translate(-(left + cx), -cy);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const center = iso(new Tile(x, y).center);
          if (center.x + HALF_W < left + cx || center.x - HALF_W > left + cx + size) continue;
          if (center.y + HALF_H < cy || center.y - HALF_H > cy + size) continue;
          drawTile(c, map, x, y, center.x, center.y);
        }
      }
      out.push({ texture: Texture.from(canvas), x: left + cx, y: cy, size });
    }
  }
  return out;
}

function drawTile(c: Ctx, map: GridMap, x: number, y: number, cx: number, cy: number) {
  const i = y * map.width + x;
  const s = map.shade[i] / 255;
  const t = map.terrain[i] as Terrain;
  let color: string;
  switch (t) {
    case Terrain.grass: color = rgb(0.34 + s * 0.06, 0.52 + s * 0.08, 0.22 + s * 0.04); break;
    case Terrain.dirt: color = rgb(0.55 + s * 0.05, 0.45 + s * 0.05, 0.28); break;
    case Terrain.sand: color = rgb(0.80 + s * 0.04, 0.72 + s * 0.04, 0.48); break;
    default: color = rgb(0.16, 0.36 + s * 0.06, 0.62 + s * 0.06);
  }
  const e = 0.7; // overlap so neighbours leave no seams
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(cx, cy - HALF_H - e);
  c.lineTo(cx + HALF_W + e, cy);
  c.lineTo(cx, cy + HALF_H + e);
  c.lineTo(cx - HALF_W - e, cy);
  c.closePath();
  c.fill();
  if (t === Terrain.grass && s > 0.55) {
    c.fillStyle = rgb(0.28, 0.44, 0.17, 0.9);
    for (let k = 0; k < 3; k++) {
      const dx = ((Math.floor(s * 1000) + k * 37) % 30) - 15;
      const dy = ((Math.floor(s * 777) + k * 23) % 12) - 6;
      c.fillRect(cx + dx, cy + dy, 2, 3);
    }
  } else if (t === Terrain.water && s > 0.7) {
    c.strokeStyle = rgb(0.55, 0.72, 0.9, 0.5);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - 8, cy);
    c.lineTo(cx + 6, cy - 2);
    c.stroke();
  }
}

// ---- resources

export function nodePic(type: string, variant: number): Pic {
  if (type === "tree") {
    const v = variant % 3;
    return pic(`tree${v}`, 44, 64, 0.5, 0.12, (c) => {
      shadow(c, 8, 3, 30, 10);
      c.fillStyle = rgb(0.40, 0.27, 0.15);
      c.fillRect(19, 6, 6, 22);
      const g = [[0.16, 0.42, 0.18], [0.20, 0.48, 0.16], [0.13, 0.38, 0.22]][v];
      const blobs = v === 2 ? [[22, 26, 13], [22, 38, 11], [22, 50, 8]] : [[14, 32, 11], [30, 32, 11], [22, 42, 14]];
      blobs.forEach(([x, y, r], i) => {
        const k = 0.8 + i * 0.12;
        c.fillStyle = rgb(g[0] * k, g[1] * k, g[2] * k);
        ellipse(c, x - r, y - r * 0.85, r * 2, r * 1.7);
      });
      c.fillStyle = rgb(1, 1, 1, 0.12);
      ellipse(c, 16, 44, 10, 7);
    });
  }
  if (type === "berry_bush") {
    return pic("berry", 40, 30, 0.5, 0.25, (c) => {
      shadow(c, 6, 2, 28, 9);
      c.fillStyle = rgb(0.18, 0.45, 0.20); ellipse(c, 5, 6, 30, 20);
      c.fillStyle = rgb(0.24, 0.55, 0.24); ellipse(c, 10, 12, 18, 12);
      c.fillStyle = rgb(0.85, 0.12, 0.22);
      for (const [x, y] of [[10, 12], [16, 18], [24, 14], [28, 20], [19, 10], [13, 20]]) ellipse(c, x, y, 4, 4);
    });
  }
  const gold = type === "gold_mine";
  return pic(type, 46, 32, 0.5, 0.25, (c) => {
    shadow(c, 4, 2, 38, 10);
    const base = gold ? rgb(0.55, 0.45, 0.30) : rgb(0.50, 0.50, 0.52);
    const light = gold ? rgb(0.98, 0.80, 0.25) : rgb(0.78, 0.78, 0.80);
    for (const [x, y, r] of [[8, 6, 11], [20, 5, 13], [14, 13, 10], [28, 10, 9]]) {
      rock(c, x, y, r, base);
      rock(c, x + 2, y + r * 0.45, r * 0.55, light);
    }
  });
}

function rock(c: Ctx, x: number, y: number, r: number, fill: string) {
  poly(c, [[x, y], [x + r, y], [x + r * 1.1, y + r * 0.6], [x + r * 0.5, y + r], [x - r * 0.1, y + r * 0.55]], fill);
}

// ---- units

export function unitPic(type: string, owner: number): Pic {
  const pc = playerColor(owner);
  const horse = type === "scout";
  const w = horse ? 52 : 34, h = horse ? 50 : 44;
  return pic(`u-${type}-${owner}`, w, h, 0.5, 0.1, (c) => {
    const cx = w / 2;
    shadow(c, cx - (horse ? 20 : 11), 1, horse ? 40 : 22, 8);
    let baseY = 5;
    if (horse) {
      c.fillStyle = rgb(0.45, 0.30, 0.18);
      for (const lx of [cx - 14, cx - 9, cx + 7, cx + 12]) c.fillRect(lx, 4, 3, 12);
      ellipse(c, cx - 18, 12, 34, 14);
      c.fillRect(cx + 10, 18, 6, 12);
      ellipse(c, cx + 10, 26, 13, 7);
      c.fillStyle = rgb(0.25, 0.16, 0.10);
      c.fillRect(cx - 21, 14, 4, 9);
      baseY = 18;
    } else {
      c.fillStyle = rgb(0.35, 0.24, 0.15);
      c.fillRect(cx - 5, 4, 4, 11);
      c.fillRect(cx + 1, 4, 4, 11);
    }
    // Villagers wear undyed cloth with a coloured sash, soldiers wear the player colour.
    const villager = type === "villager";
    c.fillStyle = villager ? rgb(0.70, 0.58, 0.40) : shade(pc, 0.95);
    c.beginPath();
    c.roundRect(cx - 7, baseY + 9, 14, 15, 4);
    c.fill();
    c.fillStyle = villager ? pc : shade(pc, 0.65);
    c.fillRect(cx - 7, baseY + 14, 14, 3);
    c.fillStyle = rgb(0.88, 0.70, 0.52); ellipse(c, cx - 5, baseY + 23, 10, 10);
    c.fillStyle = rgb(0.28, 0.18, 0.10); ellipse(c, cx - 5, baseY + 29, 10, 5);
    switch (type) {
      case "villager":
        line(c, [[cx + 8, baseY + 8], [cx + 12, baseY + 24]], rgb(0.45, 0.32, 0.18), 2);
        c.fillStyle = rgb(0.6, 0.6, 0.62); c.fillRect(cx + 9, baseY + 22, 7, 3);
        break;
      case "clubman":
        line(c, [[cx + 8, baseY + 12], [cx + 14, baseY + 30]], rgb(0.42, 0.28, 0.14), 4);
        break;
      case "axeman":
        line(c, [[cx + 8, baseY + 10], [cx + 12, baseY + 32]], rgb(0.42, 0.28, 0.14), 2.5);
        c.fillStyle = rgb(0.70, 0.72, 0.76); ellipse(c, cx + 10, baseY + 25, 9, 9);
        break;
      case "bowman": {
        c.strokeStyle = rgb(0.50, 0.34, 0.16); c.lineWidth = 2;
        c.beginPath(); c.arc(cx + 6, baseY + 18, 11, -1.2, 1.2); c.stroke();
        const a = [cx + 6 + 11 * Math.cos(-1.2), baseY + 18 + 11 * Math.sin(-1.2)] as [number, number];
        const b = [cx + 6 + 11 * Math.cos(1.2), baseY + 18 + 11 * Math.sin(1.2)] as [number, number];
        line(c, [a, b], rgb(0.9, 0.9, 0.85), 0.8);
        break;
      }
      case "scout":
        line(c, [[cx - 2, baseY + 12], [cx + 18, baseY + 30]], rgb(0.55, 0.40, 0.20), 2);
        c.fillStyle = rgb(0.72, 0.74, 0.78); c.fillRect(cx + 16, baseY + 28, 4, 5);
        break;
    }
  });
}

// ---- buildings

export function buildingPic(def: BuildingDef, owner: number): Pic {
  const s = def.size;
  const W = s * HALF_W * 2, D = s * HALF_H * 2;
  const wall = def.id === "farm" ? 0 : def.id === "watch_tower" ? 58 : def.id === "town_center" ? 34 : def.id === "house" ? 18 : 24;
  const roofH = def.id === "farm" ? 0 : def.id === "watch_tower" ? 14 : 20;
  const h = D + wall + roofH + 22;
  const pc = playerColor(owner);
  return pic(`b-${def.id}-${owner}`, W, h, 0.5, 0, (c) => {
    const left: [number, number] = [0, D / 2], bottom: [number, number] = [W / 2, 0];
    const right: [number, number] = [W, D / 2], top: [number, number] = [W / 2, D];
    const inset = (k: number) => [left, bottom, right, top].map(([x, y]) => [W / 2 + (x - W / 2) * k, D / 2 + (y - D / 2) * k] as [number, number]);
    if (def.id === "farm") {
      poly(c, [left, bottom, right, top], rgb(0.50, 0.36, 0.20));
      c.strokeStyle = rgb(0.38, 0.26, 0.14); c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 1; i < 8; i++) {
        const k = i / 8;
        c.moveTo(left[0] + (top[0] - left[0]) * k, left[1] + (top[1] - left[1]) * k);
        c.lineTo(bottom[0] + (right[0] - bottom[0]) * k, bottom[1] + (right[1] - bottom[1]) * k);
      }
      c.stroke();
      c.fillStyle = rgb(0.45, 0.65, 0.22);
      for (let i = 0; i < 18; i++) {
        ellipse(c, W * 0.25 + (((i * 37) % 50) / 50) * W * 0.5, D * 0.3 + (((i * 53) % 40) / 40) * D * 0.4, 3, 3);
      }
      c.fillStyle = pc;
      c.fillRect(W / 2 - 1, D / 2, 2, 14);
      c.fillRect(W / 2 + 1, D / 2 + 9, 8, 5);
      return;
    }
    poly(c, [left, bottom, right, top], rgb(0.45, 0.38, 0.28));
    const [l, bt, r, tp] = inset(def.id === "watch_tower" ? 0.62 : 0.84);
    const up = (p: [number, number], dh: number): [number, number] => [p[0], p[1] + dh];
    const stone = def.id === "watch_tower";
    poly(c, [l, bt, up(bt, wall), up(l, wall)], stone ? rgb(0.52, 0.50, 0.48) : rgb(0.62, 0.48, 0.32));
    poly(c, [bt, r, up(r, wall), up(bt, wall)], stone ? rgb(0.72, 0.70, 0.66) : rgb(0.80, 0.66, 0.46));
    // Door.
    const dw = Math.min(12, W * 0.12), dh = Math.min(wall * 0.6, 16);
    poly(c, [[bt[0] + dw * 0.4, bt[1] + 1 + dw * 0.2], [bt[0] + dw * 1.4, bt[1] + dw * 0.7],
      [bt[0] + dw * 1.4, bt[1] + dw * 0.7 + dh], [bt[0] + dw * 0.4, bt[1] + 1 + dw * 0.2 + dh]], rgb(0.25, 0.16, 0.10));
    // An emblem on the right wall so the military buildings read apart at a glance.
    const em: [number, number] = [(bt[0] + r[0]) / 2, (bt[1] + r[1]) / 2 + wall * 0.55];
    if (def.id === "barracks") {
      line(c, [[em[0] - 7, em[1] - 7], [em[0] + 7, em[1] + 7]], rgb(0.35, 0.22, 0.12), 3);
      line(c, [[em[0] + 7, em[1] - 7], [em[0] - 7, em[1] + 7]], rgb(0.35, 0.22, 0.12), 3);
    } else if (def.id === "archery_range") {
      for (const [rad, col] of [[9, rgb(0.9, 0.9, 0.85)], [6, rgb(0.8, 0.15, 0.15)], [3, rgb(0.9, 0.9, 0.85)]] as [number, string][]) {
        c.fillStyle = col; ellipse(c, em[0] - rad, em[1] - rad, rad * 2, rad * 2);
      }
    } else if (def.id === "stable") {
      c.strokeStyle = rgb(0.35, 0.22, 0.12); c.lineWidth = 3;
      c.beginPath(); c.arc(em[0], em[1], 7, Math.PI + 0.3, -0.3); c.stroke();
      c.fillStyle = rgb(0.85, 0.72, 0.35); c.fillRect(l[0] + 6, l[1] + 1, 14, 8);
    }
    // Roof: thatch for most, the player's colour on the big ones.
    const big = ["town_center", "barracks", "archery_range", "stable", "watch_tower"].includes(def.id);
    const roof = big ? pc : "#c7a34d";
    const peak: [number, number] = [W / 2, D / 2 + wall + roofH];
    const ul = up(l, wall), ub = up(bt, wall), ur = up(r, wall), ut = up(tp, wall);
    poly(c, [ul, ub, peak], shade(roof, big ? 0.66 : 0.78));
    poly(c, [ub, ur, peak], shade(roof, big ? 0.85 : 1));
    poly(c, [ur, ut, peak], shade(roof, big ? 0.95 : 1.1));
    poly(c, [ut, ul, peak], shade(roof, big ? 0.76 : 0.9));
    if (["house", "granary", "storage_pit"].includes(def.id)) line(c, [up(ul, 1), up(ub, 1), up(ur, 1)], pc, 3);
    if (def.id === "granary") { c.fillStyle = rgb(0.85, 0.75, 0.40); ellipse(c, r[0] - 18, r[1] - 4, 14, 9); }
    if (def.id === "storage_pit") {
      c.fillStyle = rgb(0.50, 0.34, 0.18);
      for (let i = 0; i < 3; i++) c.fillRect(l[0] + 4 + i * 5, l[1] - 6 + i, 4, 10);
    }
    // Flag.
    c.fillStyle = rgb(0.3, 0.22, 0.14); c.fillRect(peak[0] - 1, peak[1] - 2, 2, 20);
    c.fillStyle = shade(pc, 1.05); c.fillRect(peak[0] + 1, peak[1] + 10, 11, 7);
  });
}
