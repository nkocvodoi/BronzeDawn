// Every texture is pixel art drawn in code. No assets from anywhere.
// One art pixel is PX world units; textures scale with nearest-neighbour.
import { Texture } from "pixi.js";
import type { BuildingDef } from "../core/rules";
import { GridMap, Terrain } from "../core/grid";
import { HALF_H, HALF_W, fromIso } from "./iso";
import { bayer, darken, hash, lighten, mix, PixelCanvas, PX, RGB, rgb } from "./pixel";

export const PLAYER_COLORS = ["#2f6be6", "#d8322c", "#f0c530", "#3daf4a"];
export const playerColor = (id: number) => (id >= 0 ? PLAYER_COLORS[id % PLAYER_COLORS.length] : "#ffffff");
const playerRGB = (id: number): RGB => rgb(parseInt(playerColor(id).slice(1), 16));

/** A sprite picture. w, h are world units; ax, ay the anchor (y down, Pixi style). */
export interface Pic { texture: Texture; canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

const cache = new Map<string, Pic>();

function pic(key: string, w: number, h: number, ax: number, ay: number, draw: (p: PixelCanvas) => void): Pic {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new PixelCanvas(w, h);
  draw(p);
  const canvas = p.toCanvas();
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  const out = { texture, canvas, w: w * PX, h: h * PX, ax, ay };
  cache.set(key, out);
  return out;
}

// ---- palette

const C = {
  outline: rgb(0x1a120a),
  skin: rgb(0xd9a477), skinDark: rgb(0xa8764f),
  hair: rgb(0x3b2414),
  cloth: rgb(0xb59a6a), clothDark: rgb(0x8a7350),
  leather: rgb(0x5a3a20), leatherDark: rgb(0x3e2814),
  wood: rgb(0x8a5a2e), woodDark: rgb(0x5c3a1c),
  iron: rgb(0xaab0b8), ironDark: rgb(0x6c727a),
  gold: rgb(0xf2c531), goldDark: rgb(0xb3861a),
  stone: rgb(0xa9a49a), stoneDark: rgb(0x6f6a62),
  berry: rgb(0xc8243a), leaf: rgb(0x3e8a34), leafDark: rgb(0x245c22), leafLight: rgb(0x68b048),
  thatch: rgb(0xd0aa52), thatchDark: rgb(0x9a7630),
  mud: rgb(0xb88a5a), mudDark: rgb(0x8a6440),
  plaster: rgb(0xd8c8a2), plasterDark: rgb(0xa8967a),
  tile: rgb(0xa8503a), tileDark: rgb(0x7a3626),
  earth: rgb(0x8a6c48), earthDark: rgb(0x6a5236),
};

// ---- terrain

const GROUND: Record<Terrain, RGB[]> = {
  [Terrain.grass]: [rgb(0x5a8a38), rgb(0x5f903c), rgb(0x55843a), rgb(0x649540)],
  [Terrain.dirt]: [rgb(0x96764a), rgb(0x8a6c44), rgb(0xa2825a), rgb(0x7e623c)],
  [Terrain.sand]: [rgb(0xd2bc82), rgb(0xc8b278), rgb(0xdcc890), rgb(0xbea66c)],
  [Terrain.water]: [rgb(0x2a5c9a), rgb(0x2e64a4), rgb(0x265490), rgb(0x3470b0)],
};

/** The whole map as one pixel texture, 16 x 8 art pixels per half tile. Returns it with its screen origin. */
export function terrainTexture(map: GridMap): { texture: Texture; x: number; y: number; w: number; h: number } {
  const tw = HALF_W / PX, th = HALF_H / PX; // art pixels per half tile: 16 x 8
  const W = (map.width + map.height) * tw, H = (map.width + map.height) * th;
  const left = -map.height * HALF_W;
  const p = new PixelCanvas(W, H);
  const n = map.width;
  const terrainAt = (x: number, y: number): Terrain | null =>
    x < 0 || y < 0 || x >= n || y >= map.height ? null : (map.terrain[y * n + x] as Terrain);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const w = fromIso(left + (px + 0.5) * PX, (py + 0.5) * PX);
      const tx = Math.floor(w.x), ty = Math.floor(w.y);
      const t = terrainAt(tx, ty);
      if (t === null) continue;
      let use = t;
      // Dithered borders between different ground.
      const fx = w.x - tx, fy = w.y - ty;
      const edges: [number, number, number][] = [[-1, 0, fx], [1, 0, 1 - fx], [0, -1, fy], [0, 1, 1 - fy]];
      for (const [dx, dy, d] of edges) {
        const o = terrainAt(tx + dx, ty + dy);
        if (o === null || o === t || d > 0.3) continue;
        if (bayer(px, py) < 0.55 * (1 - d / 0.3)) { use = o; break; }
      }
      const pal = GROUND[use];
      const s = map.shade[ty * n + tx] / 255;
      // Soft 2x2 clusters plus a slow per-tile tint, so the ground reads as texture, not noise.
      let c = pal[Math.floor(hash(px >> 1, py >> 1, 7) * 1.6 + s * 2.4) % 4];
      if (use === Terrain.grass) {
        const r = hash(px >> 1, py, 3);
        if (r < 0.018 && (px & 1) === 0) { c = rgb(0x46722c); p.set(px, py - 1, rgb(0x46722c)); }  // a tuft
        else if (r < 0.022) c = rgb(0x7aa850);
        else if (r < 0.0228 && s > 0.6) c = rgb(0xe8d870);                                      // a flower
      } else if (use === Terrain.water) {
        // Short wave highlights in rows.
        if (hash(px >> 2, py, 11) < 0.12 && (py & 1) === 0) c = rgb(0x5a8ccc);
        const shore = edges.some(([dx, dy, d]) => d < 0.12 && terrainAt(tx + dx, ty + dy) === Terrain.sand);
        if (shore && bayer(px, py) < 0.5) c = rgb(0x8ab4d8);
      } else if (use === Terrain.sand || use === Terrain.dirt) {
        if (hash(px, py, 5) < 0.04) c = darken(c, 0.82);
      }
      p.set(px, py, c);
    }
  }
  const texture = p.toTexture();
  return { texture, x: left, y: 0, w: W * PX, h: H * PX };
}

// ---- resources

export function nodePic(type: string, variant: number): Pic {
  if (type === "tree") {
    const v = variant % 3;
    return pic(`tree${v}`, 24, 36, 0.5, 0.92, (p) => {
      p.shadow(12, 33, 8, 2.5);
      p.rect(11, 22, 3, 12, C.wood);
      p.rect(13, 22, 1, 12, C.woodDark);
      const leaf = (x: number, y: number) => {
        const l = hash(x, y, v) < 0.15;
        const light = x < 12 + (y - 14) * 0.3;
        return l ? C.leafLight : light ? C.leaf : C.leafDark;
      };
      if (v === 1) {
        // A conifer: stacked triangles.
        for (const [top, half, base] of [[2, 4, 12], [8, 6, 19], [14, 8, 26]]) p.poly([[12, top], [12 + half, base], [12 - half, base]], leaf);
      } else {
        const blobs = v === 0 ? [[8, 17, 6], [16, 17, 6], [12, 11, 7], [12, 19, 6]] : [[12, 8, 5], [9, 14, 6], [15, 15, 6], [12, 20, 5]];
        for (const [x, y, r] of blobs) p.ellipse(x, y, r, r * 0.9, leaf);
      }
      p.outline();
    });
  }
  if (type === "berry_bush") {
    return pic("berry", 18, 14, 0.5, 0.85, (p) => {
      p.shadow(9, 11.5, 7, 2);
      p.ellipse(9, 7.5, 7.5, 5, (x, y) => (hash(x, y, 2) < 0.2 ? C.leafLight : x < 8 ? C.leaf : C.leafDark));
      for (const [x, y] of [[5, 6], [8, 4], [11, 7], [13, 5], [7, 9], [10, 10], [4, 9]]) { p.set(x, y, C.berry); p.set(x + 1, y, darken(C.berry, 0.7)); }
      p.outline();
    });
  }
  const gold = type === "gold_mine";
  return pic(type, 24, 15, 0.5, 0.85, (p) => {
    p.shadow(12, 12.5, 10, 2.2);
    const base = gold ? rgb(0x8a7454) : C.stone, dark = gold ? rgb(0x5e4c34) : C.stoneDark;
    for (const [x, y, r] of [[6, 10, 5], [14, 9, 6], [10, 6, 5], [18, 11, 4]]) {
      p.poly([[x - r, y + 2], [x - r * 0.4, y - r * 0.8], [x + r * 0.6, y - r * 0.7], [x + r, y + 2]], (px, py) => (px < x ? base : dark));
    }
    if (gold) for (const [x, y] of [[7, 7], [13, 5], [15, 8], [10, 4], [19, 9]]) { p.set(x, y, C.gold); p.set(x + 1, y, C.goldDark); }
    else for (const [x, y] of [[6, 8], [13, 6], [17, 10]]) p.set(x, y, lighten(C.stone, 0.4));
    p.outline();
  });
}

// ---- units

export type Facing = "front" | "back";
export type Pose = "idle" | "walk" | "work";
/** What a villager has in hand, from the job it is doing. */
export type Tool = "none" | "axe" | "pick" | "basket" | "hoe" | "hammer";

export interface UnitLook { type: string; owner: number; facing: Facing; pose: Pose; frame: number; tool: Tool; carry: number | null }

const CARRY_COLORS: [RGB, RGB][] = [[rgb(0xc8243a), rgb(0x6aa040)], [C.wood, C.woodDark], [C.gold, C.goldDark], [C.stone, C.stoneDark]];

export function unitPic(look: UnitLook): Pic {
  const { type, owner, facing, pose, frame, tool, carry } = look;
  const key = `u-${type}-${owner}-${facing}-${pose}-${frame}-${tool}-${carry}`;
  if (type === "scout") return pic(key, 30, 28, 0.5, 0.9, (p) => drawRider(p, look));
  return pic(key, 22, 28, 0.5, 0.9, (p) => {
    const pc = playerRGB(owner);
    const villager = type === "villager";
    const cx = 11;
    p.shadow(cx, 25.5, 6, 2);
    // Legs: a stride when walking.
    const lift = pose === "walk" ? [[0, 0], [1, 0], [0, 0], [0, 1]][frame % 4] : [0, 0];
    p.rect(cx - 3, 19, 2, 6 - lift[0], C.leather);
    p.rect(cx + 1, 19, 2, 6 - lift[1], C.leatherDark);
    // Bundle on the back when carrying, drawn first so the body covers part of it.
    if (carry !== null && facing === "front") drawBundle(p, cx - 7, 11, carry);
    // Body.
    const tunic = villager ? C.cloth : pc;
    const tunicDark = villager ? C.clothDark : darken(pc, 0.7);
    p.rect(cx - 4, 11, 8, 9, tunic);
    p.rect(cx + 2, 11, 2, 9, tunicDark);
    p.rect(cx - 4, 17, 8, 1, villager ? pc : C.leatherDark); // belt, or a sash in the player's colour
    if (type === "axeman") p.rect(cx - 4, 11, 8, 2, C.iron);   // a bronze-age scale collar
    // Arms swing opposite to the legs.
    const swing = pose === "walk" ? [0, 1, 0, -1][frame % 4] : 0;
    p.rect(cx - 5, 12 + swing, 1, 5, villager ? C.skin : tunicDark);
    p.rect(cx + 4, 12 - swing, 1, 5, villager ? C.skinDark : tunicDark);
    // Head.
    p.rect(cx - 2, 5, 5, 6, C.skin);
    p.rect(cx + 2, 5, 1, 6, C.skinDark);
    if (facing === "front") {
      p.rect(cx - 2, 4, 5, 2, C.hair);
      p.set(cx - 1, 7, C.outline); p.set(cx + 1, 7, C.outline);
    } else {
      p.rect(cx - 2, 4, 5, 6, C.hair);
      if (carry !== null) drawBundle(p, cx - 3, 11, carry);
    }
    if (type === "clubman" || type === "axeman") p.rect(cx - 3, 3, 7, 2, type === "axeman" ? C.iron : C.leather); // cap
    if (villager) p.rect(cx - 3, 3, 7, 1, pc); // a coloured headband
    drawGear(p, cx, look);
    p.outline();
  });
}

function drawBundle(p: PixelCanvas, x: number, y: number, carry: number) {
  const [a, b] = CARRY_COLORS[carry];
  if (carry === 1) {
    for (let i = 0; i < 3; i++) { p.rect(x, y + i * 2, 6, 2, i % 2 ? b : a); p.set(x, y + i * 2, lighten(a, 0.3)); }
  } else {
    p.rect(x, y, 5, 6, carry === 0 ? rgb(0xa07840) : a);
    p.rect(x + 3, y, 2, 6, darken(carry === 0 ? rgb(0xa07840) : a, 0.75));
    if (carry === 0) { p.set(x + 1, y - 1, a); p.set(x + 2, y - 1, b); p.set(x + 3, y - 1, a); }
  }
}

/** Tools and weapons, swung over three work frames: raised, mid, struck. */
function drawGear(p: PixelCanvas, cx: number, look: UnitLook) {
  const { type, pose, frame, tool } = look;
  const hx = cx + 5, work = pose === "work";
  const stage = work ? frame % 3 : 1;
  const tipY = [2, 9, 16][stage], tipX = [hx + 1, hx + 5, hx + 3][stage];
  const handle = (len: number) => { p.line(hx, 15, tipX, tipY + (16 - tipY) * (1 - len), C.wood); };
  switch (type) {
    case "villager":
      switch (tool) {
        case "axe": handle(1); p.rect(tipX - 1, tipY, 3, 3, C.iron); break;
        case "pick": handle(1); p.line(tipX - 2, tipY + 1, tipX + 2, tipY - 1, C.ironDark); break;
        case "hoe": handle(1); p.rect(tipX, tipY, 2, 2, C.ironDark); break;
        case "hammer": handle(0.9); p.rect(tipX - 1, tipY - 1, 3, 2, C.ironDark); break;
        case "basket": {
          const by = work ? 14 + (frame % 2) : 15;
          p.rect(cx - 3, by, 7, 4, rgb(0xa07840)); p.rect(cx - 3, by, 7, 1, rgb(0x7a5a2c));
          if (work) p.set(cx, by - 1, C.berry);
          break;
        }
        default: break;
      }
      break;
    case "clubman":
      p.line(hx, 15, tipX, tipY, C.woodDark); p.line(hx + 1, 15, tipX + 1, tipY, C.wood);
      p.rect(tipX - 1, tipY - 1, 3, 3, C.woodDark);
      break;
    case "axeman":
      handle(1); p.rect(tipX - 1, tipY - 1, 2, 4, C.iron); p.set(tipX + 1, tipY, C.ironDark);
      break;
    case "bowman": {
      // The bow, drawn at full draw when shooting.
      const bx = hx + (work && stage === 0 ? 1 : 0);
      for (let i = -5; i <= 5; i++) p.set(bx + Math.round(2.2 - (i * i) / 12), 13 + i, C.woodDark);
      p.line(bx - (work && stage === 0 ? 2 : 0), 8, bx - (work && stage === 0 ? 2 : 0), 18, rgb(0xe8e0c8));
      p.rect(cx - 6, 9, 2, 6, C.leather); // quiver
      break;
    }
    default: break;
  }
}

function drawRider(p: PixelCanvas, look: UnitLook) {
  const pc = playerRGB(look.owner);
  const horse = rgb(0x7a4e2a), horseDark = rgb(0x52321a);
  p.shadow(15, 25.5, 12, 2.2);
  const gait = look.pose === "walk" ? look.frame % 4 : 0;
  const legs = [[5, 0], [9, 1], [19, 0], [23, 1]];
  legs.forEach(([x, phase]) => {
    const up = (gait + phase * 2) % 4 === 1 ? 2 : 0;
    p.rect(x, 18, 2, 7 - up, (x < 12) === (look.facing === "front") ? horse : horseDark);
  });
  p.ellipse(14, 16, 11, 4.5, (x) => (x < 14 ? horse : horseDark));
  // Neck and head, toward screen right.
  p.poly([[21, 15], [24, 8], [27, 8], [27, 12], [24, 16]], horse);
  p.rect(25, 7, 4, 4, horse);
  p.set(28, 10, horseDark);
  p.rect(22, 6, 2, 3, C.hair); // mane
  p.rect(2, 14, 2, 6, C.hair);  // tail
  // Rider.
  p.rect(12, 6, 6, 8, pc);
  p.rect(16, 6, 2, 8, darken(pc, 0.7));
  p.rect(13, 1, 4, 5, C.skin);
  p.rect(13, 0, 4, look.facing === "front" ? 2 : 5, C.hair);
  // A spear, couched when charging.
  const strike = look.pose === "work" && look.frame % 3 === 2;
  p.line(10, strike ? 10 : 2, strike ? 29 : 22, strike ? 10 : 12, C.wood);
  p.set(strike ? 29 : 22, strike ? 10 : 12, C.iron);
  p.outline();
}

// ---- buildings

/** Stone Age buildings are mud and thatch; from the Tool Age on, plaster and fired tile. */
export function buildingPic(def: BuildingDef, owner: number, age = 0, stage = 3, farmLeft = 1): Pic {
  const s = def.size;
  const W = s * 32, D = s * 16;
  const wallBy: Record<string, number> = { farm: 0, watch_tower: 30, town_center: 18, house: 9 };
  const wall = wallBy[def.id] ?? 12;
  const roof = def.id === "farm" ? 0 : def.id === "watch_tower" ? 7 : 10;
  const H = D + wall + roof + 12;
  const style = age >= 1 ? 1 : 0;
  const farmStage = def.id === "farm" ? (farmLeft > 0.66 ? 2 : farmLeft > 0.33 ? 1 : 0) : 0;
  return pic(`b-${def.id}-${owner}-${style}-${stage}-${farmStage}`, W, H, 0.5, 1, (p) => {
    const pc = playerRGB(owner);
    const y0 = H - D;
    const top: [number, number] = [W / 2, y0], right: [number, number] = [W, y0 + D / 2];
    const bottom: [number, number] = [W / 2, y0 + D], left: [number, number] = [0, y0 + D / 2];
    const inset = (k: number) => [left, bottom, right, top].map(([x, y]) => [W / 2 + (x - W / 2) * k, y0 + D / 2 + (y - y0 - D / 2) * k] as [number, number]);
    const ground = (x: number, y: number) => (hash(x, y, 9) < 0.2 ? C.earthDark : C.earth);

    if (def.id === "farm") {
      p.poly([left, bottom, right, top], (x, y) => (hash(x, y, 4) < 0.15 ? C.earthDark : rgb(0x7c5a34)));
      // Furrows with crops that thin out as the farm is used up.
      const crop = [rgb(0x9aa040), rgb(0x8cb048), rgb(0x6aa83c)][farmStage];
      for (let i = 1; i < 8; i++) {
        const k = i / 8;
        const ax = left[0] + (top[0] - left[0]) * k, ay = left[1] + (top[1] - left[1]) * k;
        const bx = bottom[0] + (right[0] - bottom[0]) * k, by = bottom[1] + (right[1] - bottom[1]) * k;
        p.line(ax, ay, bx, by, rgb(0x5e4226));
        for (let j = 1; j < 10; j++) {
          if (hash(i, j, 21) > 0.45 + farmStage * 0.25) continue;
          const t = j / 10;
          p.set(ax + (bx - ax) * t, ay + (by - ay) * t - 1, crop);
        }
      }
      p.rect(W / 2 - 1, y0 + D / 2 - 8, 1, 8, C.woodDark);
      p.rect(W / 2, y0 + D / 2 - 8, 4, 3, pc);
      return;
    }

    // Foundation.
    p.poly([left, bottom, right, top], ground);
    if (def.id === "house" && style === 0 && stage >= 2) { drawHut(p, W / 2, y0 + D / 2, W * 0.34, wall, pc); return; }
    const k = def.id === "watch_tower" ? 0.6 : 0.84;
    const [l, bt, r, tp] = inset(k);
    const up = (pt: [number, number], h: number): [number, number] => [pt[0], pt[1] - h];
    if (stage === 0) {
      // Just staked out.
      for (const pt of [l, bt, r, tp]) p.rect(pt[0] - 1, pt[1] - 4, 1, 4, C.woodDark);
      p.outline();
      return;
    }
    const wallH = stage === 1 ? Math.round(wall * 0.45) : wall;
    const stone = def.id === "watch_tower";
    const wl = stone ? C.stone : style ? C.plaster : C.mud;
    const wd = stone ? C.stoneDark : style ? C.plasterDark : C.mudDark;
    const wallTex = (base: RGB) => (x: number, y: number) => {
      if (stone) return (y % 4 === 0 || (x + (y >> 2) * 3) % 7 === 0) ? darken(base, 0.8) : base;
      if (!style && y % 3 === 0 && hash(x, y, 1) < 0.6) return darken(base, 0.88);
      return hash(x, y, 2) < 0.08 ? darken(base, 0.9) : base;
    };
    p.poly([l, bt, up(bt, wallH), up(l, wallH)], wallTex(wd));
    p.poly([bt, r, up(r, wallH), up(bt, wallH)], wallTex(wl));
    if (stage === 1) {
      // Scaffolding over the half-built walls.
      for (const pt of [l, bt, r]) p.rect(pt[0] - 1, pt[1] - wall, 1, wall, C.wood);
      p.line(l[0], l[1] - wall + 2, bt[0], bt[1] - wall + 2, C.woodDark);
      p.line(bt[0], bt[1] - wall + 2, r[0], r[1] - wall + 2, C.woodDark);
      p.outline();
      return;
    }
    // Door, on the right-hand wall near the front corner.
    const dx = bt[0] + 4, dy = bt[1] - 2;
    const dh = Math.min(wall - 2, 7);
    p.poly([[dx, dy - 1], [dx + 4, dy - 3], [dx + 4, dy - 3 - dh], [dx, dy - 1 - dh]], rgb(0x3a2412));
    // Emblems so the military buildings read apart at a glance.
    const ex = Math.round((bt[0] + r[0]) / 2) + 3, ey = Math.round((bt[1] + r[1]) / 2 - wall * 0.55);
    if (def.id === "barracks") { p.line(ex - 3, ey - 3, ex + 3, ey + 3, C.woodDark); p.line(ex + 3, ey - 3, ex - 3, ey + 3, C.woodDark); }
    if (def.id === "archery_range") { p.ellipse(ex, ey, 3.5, 3.5, rgb(0xf0e8d0)); p.ellipse(ex, ey, 2, 2, C.berry); }
    if (def.id === "stable") { p.rect(ex - 3, ey - 2, 6, 1, C.woodDark); p.rect(ex - 3, ey + 1, 6, 1, C.woodDark); p.rect(l[0] + 3, l[1] - 5, 6, 4, C.thatch); }
    if (def.id === "granary") p.ellipse(r[0] - 7, r[1] - 1, 4, 2.5, C.thatch);
    if (def.id === "storage_pit") for (let i = 0; i < 3; i++) p.rect(l[0] + 2 + i * 3, l[1] - 6 + i, 2, 6, C.wood);
    // Roof.
    const peak: [number, number] = [W / 2, y0 + D / 2 - wall - roof];
    const ul = up(l, wall), ub = up(bt, wall), ur = up(r, wall), ut = up(tp, wall);
    const roofBase = stone ? C.stoneDark : style ? C.tile : C.thatch;
    const roofTex = (k2: number) => (x: number, y: number) => {
      const b = darken(roofBase, k2);
      if (style || stone) return (y % 3 === 0) ? darken(b, 0.85) : b;
      return hash(x, y >> 1, 6) < 0.25 ? darken(b, 0.82) : b;
    };
    if (stone) {
      // A flat top with crenellations.
      p.poly([ul, ub, ur, ut], roofTex(1.05));
      for (const [a, b] of [[ul, ub], [ub, ur]] as [[number, number], [number, number]][]) {
        for (let t = 0; t <= 1; t += 0.34) p.rect(a[0] + (b[0] - a[0]) * t - 1, a[1] + (b[1] - a[1]) * t - 3, 2, 3, C.stone);
      }
    } else {
      p.poly([ut, ul, peak], roofTex(0.9));
      p.poly([ur, ut, peak], roofTex(1.05));
      p.poly([ul, ub, peak], roofTex(0.75));
      p.poly([ub, ur, peak], roofTex(1));
    }
    // Banner in the player's colour.
    const fx = stone ? W / 2 : peak[0], fy = stone ? ut[1] - 1 : peak[1];
    p.rect(fx, fy - 10, 1, 10, C.woodDark);
    p.rect(fx + 1, fy - 10, 5, 3, pc);
    p.rect(fx + 1, fy - 7, 4, 1, darken(pc, 0.7));
    // A coloured trim along the eaves of the big buildings.
    if (["town_center", "barracks", "archery_range", "stable"].includes(def.id)) {
      p.line(ul[0], ul[1], ub[0], ub[1], pc);
      p.line(ub[0], ub[1], ur[0], ur[1], darken(pc, 0.8));
    }
    p.outline();
  });
}

/** A Stone Age round hut: mud walls and a thatched cone. */
function drawHut(p: PixelCanvas, cx: number, cy: number, rx: number, wall: number, pc: RGB) {
  const ry = rx / 2;
  const mud = (x: number, y: number) => {
    const shade = x < cx - rx * 0.3 ? 0.82 : x > cx + rx * 0.4 ? 1.05 : 0.95;
    return darken(y % 3 === 0 && hash(x, y, 1) < 0.5 ? C.mudDark : C.mud, shade);
  };
  for (let y = Math.floor(cy - wall); y <= cy; y++) p.ellipse(cx, y, rx, ry, mud);
  p.poly([[cx + 1, cy + ry - 1], [cx + 5, cy + ry - 2], [cx + 5, cy + ry - 9], [cx + 1, cy + ry - 8]], rgb(0x3a2412)); // door
  const top = cy - wall;
  const thatch = (x: number, y: number) => {
    const k = x < cx - 2 ? 0.8 : x > cx + 3 ? 1.08 : 0.95;
    return darken(hash(x, y >> 1, 6) < 0.25 ? C.thatchDark : C.thatch, k);
  };
  p.ellipse(cx, top + 1, rx + 2, ry + 1, thatch);
  p.poly([[cx - rx - 2, top + 1], [cx, top - 16], [cx + rx + 2, top + 1]], thatch);
  p.line(cx - rx - 1, top + 2, cx + rx + 1, top + 2, C.thatchDark);
  p.rect(cx, top - 24, 1, 9, C.woodDark);
  p.rect(cx + 1, top - 24, 5, 3, pc);
  p.outline();
}

// ---- HUD art

/** Small pixel icons for the resource bar, as data URLs. */
export function resourceIcons(): string[] {
  const draws: ((p: PixelCanvas) => void)[] = [
    (p) => { p.ellipse(8, 7, 5, 4, rgb(0xc0503a)); p.ellipse(7, 6, 3, 2, rgb(0xe07a5a)); p.rect(11, 10, 3, 2, rgb(0xf0e8d0)); p.rect(13, 9, 2, 4, rgb(0xf0e8d0)); },
    (p) => { for (let i = 0; i < 3; i++) { p.rect(2, 4 + i * 3, 12, 3, i % 2 ? C.woodDark : C.wood); p.ellipse(13, 5.5 + i * 3, 1.5, 1.5, rgb(0xd0a060)); } },
    (p) => { p.poly([[2, 13], [5, 6], [11, 5], [14, 13]], C.goldDark); p.poly([[4, 12], [6, 7], [10, 7], [12, 12]], C.gold); p.set(7, 8, rgb(0xfff4b0)); },
    (p) => { p.poly([[2, 13], [3, 6], [9, 4], [14, 7], [14, 13]], C.stoneDark); p.poly([[4, 11], [5, 7], [9, 6], [12, 8], [12, 11]], C.stone); },
  ];
  return draws.map((d) => { const p = new PixelCanvas(16, 16); d(p); p.outline(); return p.toCanvas().toDataURL(); });
}

/** A tileable stone texture for the panels. */
export function stoneTexture(): string {
  const p = new PixelCanvas(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const n = hash(x >> 1, y >> 1, 31) * 0.6 + hash(x, y, 32) * 0.4;
      const crack = ((x + y * 3) % 23 === 0 && hash(x, y, 33) < 0.5) || ((x * 2 - y) % 29 === 0 && hash(x, y, 34) < 0.4);
      p.set(x, y, crack ? rgb(0x2a241c) : mix(rgb(0x3e362a), rgb(0x5a5040), n));
    }
  }
  return p.toCanvas().toDataURL();
}
