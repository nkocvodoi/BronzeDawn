// Every texture is pixel art drawn in code. No assets from anywhere.
// One art pixel is PX world units; textures scale with nearest-neighbour.
// Light comes from the upper left: left faces are lit, right faces in shade, 1px dark outlines.
import { Texture } from "pixi.js";
import type { BuildingDef } from "../core/rules";
import { GridMap, Terrain } from "../core/grid";
import { HALF_H, HALF_W, fromIso } from "./iso";
import { bayer, darken, hash, lighten, mix, PixelCanvas, PX, RGB, rgb } from "./pixel";
import { AGE_KEYS, ASSETS, ImageSpec } from "./assets";

export const PLAYER_COLORS = ["#2f6be6", "#d8322c", "#f0c530", "#3daf4a", "#33b5c4", "#9a4ad8", "#888888", "#e87a28"];
export const playerColor = (id: number) => (id >= 0 ? PLAYER_COLORS[id % PLAYER_COLORS.length] : "#ffffff");
const playerRGB = (id: number): RGB => rgb(parseInt(playerColor(id).slice(1), 16));

/** A sprite picture. w, h are world units; ax, ay the anchor (y down, Pixi style). A picture from an
 *  asset file says so, and whether it is a mirrored direction of its sheet. */
export interface Pic { texture: Texture; canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number; asset?: boolean; flip?: boolean }

/** The five building styles. */
export type Arch = "egyptian" | "greek" | "babylonian" | "asian" | "roman";
export const ARCHES: Arch[] = ["egyptian", "greek", "babylonian", "asian", "roman"];

const cache = new Map<string, Pic>();

/** A picture from an asset file, recoloured for its owner, anchored where it stands on the ground. */
function assetPic(key: string, spec: ImageSpec, owner: number | null, defaultAnchorY = 1): Pic | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = ASSETS.canvasOf(spec.file, owner, owner === null ? undefined : [...playerRGB(owner)] as [number, number, number]);
  if (!c) return null;
  const w = c.canvas.width, h = c.canvas.height, k = spec.scale ?? 1;
  const [ax, ay] = spec.anchor ?? [w / 2, h * defaultAnchorY];
  const out: Pic = { texture: c.texture, canvas: c.canvas, w: w * k, h: h * k, ax: ax / w, ay: ay / h, asset: true };
  cache.set(key, out);
  return out;
}

function finish(p: PixelCanvas, ax: number, ay: number): Pic {
  const canvas = p.toCanvas();
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return { texture, canvas, w: p.w * PX, h: p.h * PX, ax, ay };
}

function pic(key: string, w: number, h: number, ax: number, ay: number, draw: (p: PixelCanvas) => void): Pic {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new PixelCanvas(w, h);
  draw(p);
  const out = finish(p, ax, ay);
  cache.set(key, out);
  return out;
}

/** Like pic, but drawn on a tall canvas and cropped to the first used row. Anchor stays at the bottom. */
function tallPic(key: string, w: number, h: number, ax: number, draw: (p: PixelCanvas) => void): Pic {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new PixelCanvas(w, h);
  draw(p);
  let top = 0;
  find: for (; top < h - 1; top++) for (let x = 0; x < w; x++) if (p.alphaAt(x, top)) break find;
  top = Math.max(0, top - 1);
  const q = new PixelCanvas(w, h - top);
  q.data.set(p.data.subarray(top * w * 4));
  const out = finish(q, ax, 1);
  cache.set(key, out);
  return out;
}

// ---- palette

const C = {
  outline: rgb(0x1a120a),
  skin: rgb(0xd9a477), skinDark: rgb(0xa8764f),
  hair: rgb(0x3b2414),
  cloth: rgb(0xb59a6a), clothDark: rgb(0x8a7350),
  robe: rgb(0xece4d0), robeDark: rgb(0xb8ac94),
  leather: rgb(0x6a4424), leatherDark: rgb(0x462c16),
  wood: rgb(0x8a5a2e), woodDark: rgb(0x5c3a1c), woodLight: rgb(0xb88650),
  iron: rgb(0xb4bac2), ironDark: rgb(0x6c727a), ironLight: rgb(0xe2e6ea),
  bronze: rgb(0xc8903e), bronzeDark: rgb(0x8a5a22), bronzeLight: rgb(0xf0c070),
  gold: rgb(0xf2c531), goldDark: rgb(0xb3861a),
  stone: rgb(0xa9a49a), stoneDark: rgb(0x6f6a62),
  berry: rgb(0xc8243a), leaf: rgb(0x3e8a34), leafDark: rgb(0x245c22), leafLight: rgb(0x68b048),
  thatch: rgb(0xd0aa52), thatchDark: rgb(0x9a7630),
  mud: rgb(0xb88a5a), mudDark: rgb(0x8a6440),
  plaster: rgb(0xd8c8a2), plasterDark: rgb(0xa8967a),
  tile: rgb(0xa8503a), tileDark: rgb(0x7a3626),
  earth: rgb(0x8a6c48), earthDark: rgb(0x6a5236),
  red: rgb(0xb8282a), white: rgb(0xf0ece0), ivory: rgb(0xf4ecd4),
  glow: rgb(0xfff2a0),
  dark: rgb(0x2a1a0e),
};

const md = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---- terrain

const GROUND: Record<Terrain, RGB[]> = {
  [Terrain.grass]: [rgb(0x5a8a38), rgb(0x5f903c), rgb(0x55843a), rgb(0x649540)],
  [Terrain.dirt]: [rgb(0x96764a), rgb(0x8a6c44), rgb(0xa2825a), rgb(0x7e623c)],
  [Terrain.sand]: [rgb(0xd2bc82), rgb(0xc8b278), rgb(0xdcc890), rgb(0xbea66c)],
  [Terrain.water]: [rgb(0x22489a), rgb(0x2650a4), rgb(0x1e4290), rgb(0x2c5aae)],
};

/** Smooth value noise in 0..1: random heights on a grid of `size`, blended between. */
function vnoise(x: number, y: number, size: number, salt: number) {
  const gx = x / size, gy = y / size, x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, salt), b = hash(x0 + 1, y0, salt), c = hash(x0, y0 + 1, salt), d = hash(x0 + 1, y0 + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// The original's grass is busy: lighter and darker swathes, yellow-green flecks, and worn patches of
// bare earth here and there. These are the colours for that, and for the dark floor under a forest.
const GRASS_DARK = rgb(0x4a7a2a), GRASS_LIGHT = rgb(0x74a240), GRASS_YELLOW = rgb(0x9cab44), GRASS_FLECK = rgb(0xb8b456);
const WORN = [rgb(0x9a7a56), rgb(0x8c6e4c), rgb(0xa88a64)];
const FOREST_FLOOR = rgb(0x34521e);

/** The whole map as one pixel texture, 16 x 8 art pixels per half tile. Returns it with its screen origin.
 *  `forest` marks tiles under trees (1) and next to them (2), whose ground is drawn darker. */
export function terrainTexture(map: GridMap, forest?: Uint8Array): { texture: Texture; x: number; y: number; w: number; h: number } {
  const tw = HALF_W / PX, th = HALF_H / PX; // art pixels per half tile: 16 x 8
  const W = (map.width + map.height) * tw, H = (map.width + map.height) * th;
  const left = -map.height * HALF_W;
  const p = new PixelCanvas(W, H);
  const n = map.width;
  const terrainAt = (x: number, y: number): Terrain | null =>
    x < 0 || y < 0 || x >= n || y >= map.height ? null : (map.terrain[y * n + x] as Terrain);
  const named = ASSETS.manifest.terrain ?? {};
  const tileFiles: Partial<Record<Terrain, string[]>> = {};
  for (const [t, key] of [[Terrain.grass, "grass"], [Terrain.dirt, "dirt"], [Terrain.sand, "sand"], [Terrain.water, "water"]] as const) {
    const list = (named[key] ?? []).filter((f) => ASSETS.image(f));
    if (list.length) tileFiles[t] = list;
  }
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
        if (o === Terrain.water || t === Terrain.water) continue; // a coastline is a crisp line, with foam on it
        if (bayer(px, py) < 0.55 * (1 - d / 0.3)) { use = o; break; }
      }
      // The coast follows a smooth, slightly wavering curve between tile centres, not the tile edges.
      // Only the picture changes: which tiles are water stays as the map says.
      const wet = (x: number, y: number) => ((terrainAt(x, y) ?? t) === Terrain.water ? 1 : 0);
      const gx = w.x - 0.5, gy = w.y - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), ux = gx - x0, uy = gy - y0;
      const a00 = wet(x0, y0), a10 = wet(x0 + 1, y0), a01 = wet(x0, y0 + 1), a11 = wet(x0 + 1, y0 + 1);
      let water = -1;
      if (a00 + a10 + a01 + a11 > 0 && a00 + a10 + a01 + a11 < 4) {
        water = (a00 * (1 - ux) + a10 * ux) * (1 - uy) + (a01 * (1 - ux) + a11 * ux) * uy + (vnoise(w.x, w.y, 0.7, 51) - 0.5) * 0.3;
        use = water >= 0.5 ? Terrain.water : t === Terrain.water ? Terrain.sand : use;
      }
      const pal = GROUND[use];
      const s = map.shade[ty * n + tx] / 255;
      // Soft 2x2 clusters plus a slow per-tile tint, so the ground reads as texture, not noise.
      let c = pal[Math.floor(hash(px >> 1, py >> 1, 7) * 1.6 + s * 2.4) % 4];
      if (use === Terrain.grass) {
        // Broad swathes of light and dark across several tiles, then finer mottling inside them.
        const broad = vnoise(w.x, w.y, 5, 21), fine = vnoise(px, py * 2, 6, 22);
        c = mix(GRASS_DARK, GRASS_LIGHT, Math.min(1, Math.max(0, broad * 0.75 + fine * 0.45 - 0.1)));
        if (broad > 0.62) c = mix(c, GRASS_YELLOW, (broad - 0.62) * 1.4);           // sun-dried patches
        const r = hash(px, py, 3);
        if (r < 0.06) c = mix(c, GRASS_FLECK, 0.55);                                  // yellow flecks
        else if (r < 0.1) c = darken(c, 0.78);                                       // dark flecks
        else if (r < 0.104 && (px & 1) === 0) { c = rgb(0x3e6a24); p.set(px, py - 1, rgb(0x3e6a24)); } // a tuft
        // Worn patches of bare earth, ragged at the edge.
        const worn = vnoise(w.x, w.y, 2.2, 23) * 0.7 + vnoise(w.x, w.y, 0.9, 24) * 0.3;
        if (worn > 0.78 || (worn > 0.73 && bayer(px, py) < (worn - 0.73) / 0.05)) c = WORN[Math.floor(hash(px >> 1, py, 25) * 3)];
        // The dark floor of a forest, fading out at its edge.
        const f = forest?.[ty * n + tx] ?? 0;
        if (f === 1) c = mix(c, FOREST_FLOOR, 0.7);
        else if (f === 2 && bayer(px, py) < 0.45) c = mix(c, FOREST_FLOOR, 0.5);
      } else if (use === Terrain.water) {
        // Short wave strokes in rows, drifting in broad lighter and darker bands.
        c = mix(c, rgb(0x16357a), vnoise(w.x, w.y, 4, 31) * 0.5);
        if (hash(px >> 2, py, 11) < 0.1 && (py & 1) === 0) c = rgb(0x4a78c0);
        // White foam along the shore, in short broken dashes, as the original's beaches have.
        if (water >= 0 && water < 0.58 && hash(px >> 2, py >> 1, 12) < 0.7) c = rgb(0xeef2f6);
        else if (water >= 0 && water < 0.7 && bayer(px, py) < 0.5) c = rgb(0x5a86c4);
      } else if (use === Terrain.sand || use === Terrain.dirt) {
        c = mix(c, darken(c, 0.82), vnoise(w.x, w.y, 2.5, 41) * 0.6);
        if (hash(px, py, 5) < 0.05) c = darken(c, 0.8);
        else if (hash(px, py, 6) < 0.03) c = lighten(c, 0.15);
      }
      // Ground tiles from files, if any: each a 64 x 32 diamond, a variant picked per tile. The coast's
      // foam and the forest floor still go on top.
      const tiles = tileFiles[use];
      if (tiles) {
        const img = ASSETS.pixels(tiles[Math.floor(hash(tx, ty, 61) * tiles.length)]);
        if (img) {
          const ix = Math.min(img.w - 1, Math.floor(((fx - fy + 1) / 2) * img.w)), iy = Math.min(img.h - 1, Math.floor(((fx + fy) / 2) * img.h));
          const i = (iy * img.w + ix) * 4;
          if (img.data[i + 3] > 0) {
            const foam = use === Terrain.water && c[0] > 200;
            c = foam ? c : [img.data[i], img.data[i + 1], img.data[i + 2]];
            const f = use === Terrain.grass ? forest?.[ty * n + tx] ?? 0 : 0;
            if (f === 1) c = mix(c, FOREST_FLOOR, 0.5);
          }
        }
      }
      p.set(px, py, c);
    }
  }
  const texture = p.toTexture();
  return { texture, x: left, y: 0, w: W * PX, h: H * PX, canvas: p } as ReturnType<typeof terrainTexture> & { canvas: PixelCanvas };
}

/** The map ground cut into pieces no bigger than 2048 pixels, which every GPU accepts. Large maps need it. */
export function terrainChunks(map: GridMap, forest?: Uint8Array): { texture: Texture; x: number; y: number; w: number; h: number }[] {
  const whole = terrainTexture(map, forest) as ReturnType<typeof terrainTexture> & { canvas: PixelCanvas };
  const src = whole.canvas;
  if (src.w <= 2048 && src.h <= 2048) return [whole];
  whole.texture.destroy(true);
  const out: { texture: Texture; x: number; y: number; w: number; h: number }[] = [];
  const size = 2048;
  for (let cy = 0; cy < src.h; cy += size) {
    for (let cx = 0; cx < src.w; cx += size) {
      const cw = Math.min(size, src.w - cx), ch = Math.min(size, src.h - cy);
      const piece = new PixelCanvas(cw, ch);
      for (let y = 0; y < ch; y++) {
        const from = ((cy + y) * src.w + cx) * 4;
        piece.data.set(src.data.subarray(from, from + cw * 4), y * cw * 4);
      }
      out.push({ texture: piece.toTexture(), x: whole.x + cx * PX, y: whole.y + cy * PX, w: cw * PX, h: ch * PX });
    }
  }
  return out;
}

// =====================================================================================
// ---- units

export type Facing = "front" | "back";
export type Pose = "idle" | "walk" | "work";
/** What a villager has in hand, from the job it is doing. */
export type Tool = "none" | "axe" | "pick" | "basket" | "hoe" | "hammer" | "spear" | "net";

/** `dir` (0-7, clockwise from facing the viewer) and `t` (seconds) are for sprite sheets from files. */
export interface UnitLook { type: string; owner: number; facing: Facing; pose: Pose; frame: number; tool: Tool; carry: number | null; dir?: number; t?: number }

/** A unit's frame from its sprite sheet, if the assets have one: by its tool first ("villager:axe"). */
function assetUnitPic(look: UnitLook): Pic | null {
  const units = ASSETS.manifest.units;
  if (!units) return null;
  const spec = (look.tool !== "none" ? units[`${look.type}:${look.tool}`] : undefined) ?? units[look.type];
  if (!spec) return null;
  const a = spec.anims;
  const anim = look.pose === "work" ? a.work ?? a.attack ?? a.idle : look.pose === "walk" ? a.walk ?? a.idle : a.idle ?? a.walk;
  if (!anim) return null;
  let dir = look.dir ?? 0, flip = false;
  if (spec.directions === 5 && dir > 4) { dir = 8 - dir; flip = true; } // NE, E, SE are NW, W, SW mirrored
  const f = Math.floor((look.t ?? 0) * (anim.fps ?? 10)) % Math.max(1, anim.frames);
  const [fw, fh] = spec.frame, x = f * fw, y = (anim.row + dir) * fh;
  const key = `ua-${spec.file}-${look.owner}-${x}-${y}-${flip}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const fr = ASSETS.frame(spec.file, look.owner, [...playerRGB(look.owner)] as [number, number, number], x, y, fw, fh);
  if (!fr) return null;
  const k = spec.scale ?? 1;
  const out: Pic = { texture: fr.texture, canvas: fr.canvas, w: fw * k, h: fh * k, ax: spec.anchor[0] / fw, ay: spec.anchor[1] / fh, asset: true, flip };
  cache.set(key, out);
  return out;
}

const CARRY_COLORS: [RGB, RGB][] = [[rgb(0xc8243a), rgb(0x6aa040)], [C.wood, C.woodDark], [C.gold, C.goldDark], [C.stone, C.stoneDark]];

type Helm = "none" | "band" | "cap" | "leather" | "bronze" | "cheek" | "crest" | "corinth" | "plume" | "transverse" | "roman" | "pointed" | "turban" | "hood";
type Armor = "none" | "leather" | "scale" | "bronze" | "iron" | "lorica";
type Shield = "none" | "small" | "round" | "aspis" | "oval" | "scutum";
type Weapon = "none" | "club" | "axe" | "short" | "broad" | "long" | "gladius" | "scimitar" | "spear" | "lance" | "javelin" | "sling" | "bow" | "longbow" | "composite" | "staff";

/** What a figure wears and carries. */
interface Kit { helm: Helm; armor: Armor; shield: Shield; weapon: Weapon; cape?: boolean; greaves?: boolean; robe?: boolean; quiver?: boolean; beard?: boolean; plume?: RGB }

const K = (helm: Helm, armor: Armor, shield: Shield, weapon: Weapon, more: Partial<Kit> = {}): Kit => ({ helm, armor, shield, weapon, ...more });

const KITS: Record<string, Kit> = {
  villager: K("band", "none", "none", "none"),
  clubman: K("none", "none", "none", "club", { beard: true }),
  axeman: K("leather", "leather", "none", "axe"),
  slinger: K("band", "none", "none", "sling"),
  short_swordsman: K("bronze", "leather", "small", "short"),
  broad_swordsman: K("cheek", "scale", "round", "broad", { greaves: true }),
  long_swordsman: K("crest", "bronze", "oval", "long", { greaves: true, cape: true }),
  legion: K("roman", "lorica", "scutum", "gladius", { greaves: true, cape: true, plume: C.red }),
  hoplite: K("corinth", "bronze", "aspis", "spear", { greaves: true, plume: C.red }),
  phalanx: K("plume", "iron", "aspis", "spear", { greaves: true }),
  centurion: K("transverse", "iron", "aspis", "spear", { greaves: true, cape: true, plume: C.red }),
  bowman: K("none", "none", "none", "bow", { quiver: true }),
  improved_bowman: K("cap", "leather", "none", "longbow", { quiver: true }),
  composite_bowman: K("pointed", "scale", "none", "composite", { quiver: true }),
  priest: K("hood", "none", "none", "staff", { robe: true }),
  // Riders.
  scout: K("band", "none", "none", "javelin"),
  cavalry: K("bronze", "leather", "round", "short"),
  heavy_cavalry: K("crest", "bronze", "round", "broad", { cape: true }),
  cataphract: K("pointed", "scale", "none", "lance"),
  horse_archer: K("band", "leather", "none", "composite", { quiver: true }),
  heavy_horse_archer: K("pointed", "scale", "none", "composite", { quiver: true }),
  camel_rider: K("turban", "none", "none", "scimitar"),
  chariot_driver: K("bronze", "leather", "none", "none"),
  chariot_archer: K("cap", "leather", "none", "bow", { quiver: true }),
  mahout: K("turban", "none", "none", "javelin"),
  elephant_archer: K("turban", "leather", "none", "composite", { quiver: true }),
};

const RIDERS = new Set(["scout", "cavalry", "heavy_cavalry", "cataphract", "horse_archer", "heavy_horse_archer"]);
const CHARIOTS = new Set(["chariot", "scythe_chariot", "chariot_archer"]);
const ELEPHANTS = new Set(["war_elephant", "armored_elephant", "elephant_archer", "elephant"]);
const SIEGE = new Set(["stone_thrower", "catapult", "heavy_catapult", "ballista", "helepolis"]);

export function unitPic(look: UnitLook): Pic {
  const fromFile = assetUnitPic(look);
  if (fromFile) return fromFile;
  const { type, owner, facing, pose, frame, tool, carry } = look;
  const key = `u-${type}-${owner}-${facing}-${pose}-${frame}-${tool}-${carry}`;
  if (RIDERS.has(type)) return pic(key, 34, 37, 16 / 34, 34 / 37, (p) => drawRider(p, look));
  if (type === "camel_rider") return pic(key, 34, 42, 16 / 34, 39 / 42, (p) => drawCamelRider(p, look));
  if (CHARIOTS.has(type)) return pic(key, 50, 36, 22 / 50, 32 / 36, (p) => drawChariot(p, look));
  if (ELEPHANTS.has(type)) {
    const tall = type === "elephant_archer";
    const H = tall ? 54 : 46, fy = H - 4;
    return pic(key, 46, H, 21 / 46, fy / H, (p) => drawWarElephant(p, look, fy));
  }
  if (type === "helepolis") return pic(key, 38, 54, 19 / 38, 50 / 54, (p) => drawHelepolis(p, look));
  if (SIEGE.has(type)) return pic(key, 40, 34, 20 / 40, 30 / 34, (p) => drawSiege(p, look));
  if (type === "gazelle") return pic(key, 24, 22, 12 / 24, 19 / 22, (p) => drawGazelle(p, look, false));
  if (type === "lion") return pic(key, 30, 24, 14 / 30, 21 / 24, (p) => drawLion(p, look, false));
  if (type === "alligator") return pic(key, 36, 18, 17 / 36, 14 / 18, (p) => drawAlligator(p, look, false));
  const kit = KITS[type] ?? KITS.clubman;
  return pic(key, 26, 28, 11 / 26, 25 / 28, (p) => {
    const cx = 11, fy = 25;
    p.shadow(cx, fy + 0.5, 6, 2);
    drawPerson(p, kit, look, cx, fy - 14, false);
    p.outline(C.outline, 0.25);
    if (kit.robe && pose === "work") drawGlow(p, cx, fy - 17, frame % 3);
  });
}

/** A standing or seated figure. ty is the top of the torso; the head sits above it, the legs below. */
function drawPerson(p: PixelCanvas, kit: Kit, look: UnitLook, cx: number, ty: number, seated: boolean, noLegs = false) {
  const pc = playerRGB(look.owner), pcD = darken(pc, 0.68), pcL = lighten(pc, 0.3);
  const back = look.facing === "back";
  const walk = look.pose === "walk" && !seated;
  const f4 = look.frame % 4;
  const fy = ty + 14;
  if (walk && (f4 === 1 || f4 === 3)) ty -= 1;
  const villager = look.type === "villager";
  const tunic = kit.robe ? C.robe : villager ? C.cloth : pc;
  const tunicD = kit.robe ? C.robeDark : villager ? C.clothDark : pcD;
  const top = ty - 6;
  const armored = kit.armor !== "none" && kit.armor !== "leather";

  // Bundle on the back when carrying, drawn first so the body covers part of it.
  if (look.carry !== null && !back) drawBundle(p, cx - 7, ty, look.carry);
  if (kit.quiver && !back) { p.rect(cx - 6, ty - 1, 2, 8, C.leather); p.set(cx - 6, ty - 2, C.white); p.set(cx - 5, ty - 2, C.red); }
  if (kit.cape && !back) p.rect(cx - 5, ty, 10, 10, pcD);

  // Legs.
  if (seated) {
    if (!noLegs) {
      p.rect(cx - 1, ty + 6, 4, 2, villager ? C.leather : tunicD);
      p.rect(cx + 1, ty + 8, 2, 3, kit.greaves || armored ? C.bronze : C.skin);
      p.rect(cx + 1, ty + 11, 3, 1, C.leatherDark);
    }
  } else if (kit.robe) {
    const sway = walk ? [0, 1, 0, -1][f4] : 0;
    p.poly([[cx - 4, ty + 6], [cx + 4, ty + 6], [cx + 5 + sway, fy], [cx - 5 + sway, fy]], (x) => (x >= cx + 2 + sway ? tunicD : tunic));
    p.rect(cx - 3 + sway, fy - 1, 2, 1, C.leatherDark); p.rect(cx + 1 + sway, fy - 1, 2, 1, C.leatherDark);
    p.rect(cx - 1, ty, 2, fy - ty - 1, pc); // a stole in the player's colour
  } else {
    const st = walk ? [[-1, 1, 0, 0], [0, 0, 0, 1], [1, -1, 0, 0], [0, 0, 1, 0]][f4] : [0, 0, 0, 0];
    const leg = (x: number, lift: number, dark: boolean) => {
      const len = fy - (ty + 8) - lift;
      const skin = villager ? (dark ? C.leatherDark : C.leather) : dark ? C.skinDark : C.skin;
      p.rect(x, ty + 8, 2, len, skin);
      if (kit.greaves) p.rect(x, fy - 4 - lift, 2, 3, dark ? C.bronzeDark : C.bronze);
      p.rect(x, fy - 1 - lift, 2, 1, C.leatherDark);
    };
    leg(cx - 3 + st[0], st[2], false);
    leg(cx + 1 + st[1], st[3], true);
  }

  // Torso and skirt.
  const tl = seated ? 7 : 9;
  p.rect(cx - 4, ty, 8, tl, tunic);
  p.rect(cx + 2, ty, 2, tl, tunicD);
  if (kit.robe) p.rect(cx - 1, ty, 2, tl, pc);
  switch (kit.armor) {
    case "leather":
      p.rect(cx - 3, ty, 6, 5, C.leather); p.rect(cx + 2, ty, 1, 5, C.leatherDark);
      p.set(cx - 1, ty + 1, C.leatherDark); p.set(cx - 1, ty + 3, C.leatherDark);
      break;
    case "scale":
      for (let y = ty; y < ty + 5; y++) for (let x = cx - 3; x < cx + 4; x++) {
        const base = x >= cx + 2 ? C.bronzeDark : C.bronze;
        p.set(x, y, (x + y) & 1 ? base : darken(base, 0.78));
      }
      break;
    case "bronze":
      p.rect(cx - 4, ty, 8, 6, C.bronze); p.rect(cx - 4, ty, 1, 6, C.bronzeLight); p.rect(cx + 2, ty, 2, 6, C.bronzeDark);
      p.set(cx - 2, ty + 2, C.bronzeDark); p.set(cx + 1, ty + 2, C.bronzeDark); p.set(cx - 1, ty + 4, C.bronzeDark);
      break;
    case "iron":
      p.rect(cx - 4, ty, 8, 6, C.iron); p.rect(cx - 4, ty, 1, 6, C.ironLight); p.rect(cx + 2, ty, 2, 6, C.ironDark);
      p.rect(cx - 5, ty, 2, 2, C.ironDark); p.rect(cx + 3, ty, 2, 2, C.ironDark);
      break;
    case "lorica":
      for (let i = 0; i < 6; i++) { p.rect(cx - 4, ty + i, 8, 1, i % 2 ? C.ironDark : C.iron); p.rect(cx + 2, ty + i, 2, 1, i % 2 ? darken(C.ironDark, 0.85) : C.ironDark); }
      p.rect(cx - 5, ty, 2, 2, C.iron); p.rect(cx + 3, ty, 2, 2, C.ironDark);
      break;
    default: break;
  }
  if (armored && !seated) for (let x = cx - 3; x < cx + 4; x += 3) p.rect(x, ty + 7, 1, 2, C.leatherDark); // pteruges
  p.rect(cx - 4, ty + 6, 8, 1, villager ? pc : C.leatherDark); // belt, or a sash in the player's colour
  if (!villager && !kit.robe && kit.armor !== "none") { p.rect(cx - 5, ty, 2, 3, pc); p.rect(cx + 3, ty, 2, 3, pcD); } // sleeves

  if (kit.cape && back) { p.rect(cx - 4, ty, 8, 10, pcD); p.rect(cx - 4, ty, 2, 10, pc); p.rect(cx, ty + 2, 1, 7, darken(pcD, 0.8)); }
  if (kit.quiver && back) { p.rect(cx - 1, ty - 2, 2, 8, C.leather); p.set(cx - 1, ty - 3, C.white); p.set(cx, ty - 3, C.red); }

  // Head.
  p.rect(cx - 2, top, 5, 6, C.skin);
  p.rect(cx + 2, top, 1, 6, C.skinDark);
  if (!back) {
    p.rect(cx - 2, top - 1, 5, 2, C.hair);
    p.set(cx - 1, top + 2, C.outline); p.set(cx + 1, top + 2, C.outline);
    if (kit.beard) { p.rect(cx - 2, top + 4, 5, 2, C.hair); p.set(cx, top + 4, C.skinDark); }
  } else {
    p.rect(cx - 2, top - 1, 5, 6, C.hair);
    if (look.carry !== null) drawBundle(p, cx - 3, ty, look.carry);
  }
  drawHelm(p, kit, back, cx, top, pc, pcL);

  // Free (left) arm.
  const swing = walk ? [0, 1, 0, -1][f4] : 0;
  const skinArm = kit.robe ? C.robe : C.skin;
  if (!isBow(kit.weapon) && !(kit.robe && look.pose === "work")) p.rect(cx - 5, ty + 1 + swing, 1, 5, skinArm);
  drawGear(p, kit, look, cx, ty, swing);
  if (kit.shield !== "none") drawShield(p, kit.shield, back, cx, ty, pc, look);
}

const isBow = (w: Weapon) => w === "bow" || w === "longbow" || w === "composite";

function drawHelm(p: PixelCanvas, kit: Kit, back: boolean, cx: number, top: number, pc: RGB, pcL: RGB) {
  const plume = kit.plume ?? pc;
  const dome = (c: RGB, l: RGB, d: RGB) => {
    p.rect(cx - 3, top - 2, 7, 3, c); p.rect(cx - 2, top - 3, 5, 1, c);
    p.set(cx - 2, top - 2, l); p.set(cx - 1, top - 3, l); p.rect(cx + 2, top - 2, 2, 3, d);
    p.rect(cx - 3, top, 7, 1, d);
  };
  switch (kit.helm) {
    case "band": p.rect(cx - 3, top, 7, 1, pc); break;
    case "cap": p.rect(cx - 3, top - 2, 7, 2, C.leather); p.rect(cx - 2, top - 3, 4, 1, C.leather); p.set(cx - 2, top - 2, lighten(C.leather, 0.2)); break;
    case "leather":
      p.rect(cx - 3, top - 2, 7, 2, C.leather); p.rect(cx - 2, top - 3, 5, 1, C.leather);
      p.rect(cx - 3, top, 1, 4, C.leather); p.rect(cx + 3, top, 1, 4, C.leatherDark);
      break;
    case "bronze": dome(C.bronze, C.bronzeLight, C.bronzeDark); break;
    case "cheek":
      dome(C.bronze, C.bronzeLight, C.bronzeDark);
      p.rect(cx - 3, top + 1, 1, 3, C.bronze); p.rect(cx + 3, top + 1, 1, 3, C.bronzeDark);
      if (!back) p.rect(cx - 2, top + 1, 1, 2, C.bronze);
      break;
    case "crest":
      dome(C.bronze, C.bronzeLight, C.bronzeDark);
      p.rect(cx - 3, top + 1, 1, 3, C.bronze);
      p.rect(cx - 2, top - 5, 5, 2, plume); p.set(cx + 3, top - 4, plume); p.set(cx - 3, top - 4, darken(plume, 0.7));
      break;
    case "corinth":
      p.rect(cx - 3, top - 2, 7, 6, C.bronze); p.rect(cx - 2, top - 3, 5, 1, C.bronze);
      p.rect(cx - 3, top - 2, 1, 5, C.bronzeLight); p.rect(cx + 2, top - 2, 2, 6, C.bronzeDark);
      p.rect(cx - 3, top + 4, 2, 1, C.bronze);
      if (!back) { p.rect(cx - 2, top + 1, 4, 1, C.dark); p.rect(cx - 1, top + 2, 2, 2, C.dark); p.set(cx - 1, top + 1, C.bronze); }
      p.rect(cx - 3, top - 5, 7, 2, plume); p.rect(cx - 4, top - 4, 1, 3, darken(plume, 0.7)); p.set(cx + 4, top - 4, plume);
      break;
    case "plume":
      dome(C.iron, C.ironLight, C.ironDark);
      p.rect(cx - 3, top + 1, 1, 3, C.iron); p.rect(cx + 3, top + 1, 1, 3, C.ironDark);
      p.rect(cx - 1, top - 6, 3, 3, plume); p.rect(cx - 3, top - 5, 2, 2, plume); p.set(cx + 2, top - 5, darken(plume, 0.7)); p.set(cx - 1, top - 6, pcL);
      break;
    case "transverse":
      dome(C.iron, C.ironLight, C.ironDark);
      p.rect(cx - 3, top + 1, 1, 3, C.iron);
      p.rect(cx - 5, top - 5, 11, 2, plume); p.rect(cx - 4, top - 6, 9, 1, lighten(plume, 0.25)); p.rect(cx + 2, top - 5, 4, 2, darken(plume, 0.75));
      break;
    case "roman":
      dome(C.iron, C.ironLight, C.ironDark);
      p.rect(cx - 3, top + 1, 1, 3, C.iron); p.rect(cx + 3, top, 1, 3, C.ironDark); // cheek and neck guard
      p.rect(cx - 1, top - 5, 3, 2, plume); p.set(cx + 2, top - 4, darken(plume, 0.7));
      break;
    case "pointed":
      p.set(cx, top - 5, C.iron); p.rect(cx - 1, top - 4, 3, 1, C.iron); p.rect(cx - 2, top - 3, 5, 1, C.iron); p.rect(cx - 3, top - 2, 7, 2, C.iron);
      p.set(cx - 1, top - 3, C.ironLight); p.rect(cx + 2, top - 2, 2, 2, C.ironDark);
      p.rect(cx - 3, top, 1, 4, C.ironDark); p.rect(cx + 3, top, 1, 4, C.ironDark);
      break;
    case "turban":
      p.rect(cx - 3, top - 3, 7, 3, C.white); p.rect(cx - 2, top - 4, 5, 1, C.white); p.rect(cx + 2, top - 3, 2, 3, C.robeDark);
      p.rect(cx - 3, top - 1, 7, 1, pc); p.set(cx - 1, top - 3, C.robeDark);
      break;
    case "hood":
      p.rect(cx - 3, top - 2, 7, 3, C.robe); p.rect(cx - 3, top, 1, 6, C.robe); p.rect(cx + 3, top, 1, 6, C.robeDark);
      p.rect(cx + 1, top - 2, 3, 3, C.robeDark);
      if (back) p.rect(cx - 2, top - 1, 5, 6, C.robe);
      break;
    default: break;
  }
}

function drawBundle(p: PixelCanvas, x: number, y: number, carry: number) {
  const [a, b] = CARRY_COLORS[carry] ?? CARRY_COLORS[0];
  if (carry === 1) {
    for (let i = 0; i < 3; i++) { p.rect(x, y + i * 2, 6, 2, i % 2 ? b : a); p.set(x, y + i * 2, lighten(a, 0.3)); }
  } else {
    const sack = carry === 0 ? rgb(0xa07840) : a;
    p.rect(x, y, 5, 6, sack);
    p.rect(x + 3, y, 2, 6, darken(sack, 0.75));
    if (carry === 0) { p.set(x + 1, y - 1, a); p.set(x + 2, y - 1, b); p.set(x + 3, y - 1, a); }
    if (carry === 2) p.set(x + 1, y + 1, rgb(0xfff4b0));
  }
}

/** A straight piece along a direction from a hand: t0..t1 pixels. */
function shaft(p: PixelCanvas, hx: number, hy: number, ang: number, t0: number, t1: number, c: RGB, wide = false) {
  const dx = Math.cos((ang * Math.PI) / 180), dy = Math.sin((ang * Math.PI) / 180);
  const n = Math.ceil(Math.abs(t1 - t0) * 1.5);
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const x = Math.round(hx + dx * t), y = Math.round(hy + dy * t);
    p.set(x, y, c);
    if (wide) { if (Math.abs(dx) > Math.abs(dy)) p.set(x, y + 1, darken(c, 0.8)); else p.set(x + 1, y, darken(c, 0.8)); }
  }
}
/** A point along a direction from a hand, offset sideways by s. */
function along(hx: number, hy: number, ang: number, t: number, s = 0): [number, number] {
  const dx = Math.cos((ang * Math.PI) / 180), dy = Math.sin((ang * Math.PI) / 180);
  return [Math.round(hx + dx * t - dy * s), Math.round(hy + dy * t + dx * s)];
}

/** Hand position and weapon angle for a swing over three work frames: raised, mid, struck. */
function swingPose(look: UnitLook, cx: number, ty: number, swing: number, low = false): [number, number, number] {
  if (look.pose === "work") {
    const st = look.frame % 3;
    if (low) return ([[cx + 4, ty, -110], [cx + 6, ty + 3, -20], [cx + 6, ty + 6, 60]] as const)[st].slice() as [number, number, number];
    return ([[cx + 3, ty - 2, -125], [cx + 6, ty + 1, -50], [cx + 6, ty + 5, 25]] as const)[st].slice() as [number, number, number];
  }
  return [cx + 5, ty + 5 + swing, -70];
}

/** Weapons and tools in the right hand. */
function drawGear(p: PixelCanvas, kit: Kit, look: UnitLook, cx: number, ty: number, swing: number) {
  const work = look.pose === "work", st = look.frame % 3;
  const arm = (hx: number, hy: number) => p.line(cx + 4, ty + 1, hx, hy, kit.robe ? C.robeDark : C.skinDark);
  let weapon: Weapon | Tool = kit.weapon;
  if (look.type === "villager") weapon = look.tool === "spear" ? "javelin" : look.tool;
  switch (weapon) {
    case "club": {
      const [hx, hy, a] = swingPose(look, cx, ty, swing); arm(hx, hy);
      shaft(p, hx, hy, a, -1, 6, C.wood, true);
      const [x, y] = along(hx, hy, a, 6); p.rect(x - 1, y - 1, 3, 3, C.woodDark); p.set(x - 1, y - 1, C.woodLight);
      break;
    }
    case "axe": {
      const [hx, hy, a] = swingPose(look, cx, ty, swing); arm(hx, hy);
      shaft(p, hx, hy, a, -1, 8, C.wood);
      for (let t = 6; t <= 8; t++) for (let s = 1; s <= 3; s++) { const [x, y] = along(hx, hy, a, t, s); p.set(x, y, s === 3 ? C.ironLight : C.iron); }
      break;
    }
    case "pick": {
      const [hx, hy, a] = swingPose(look, cx, ty, swing); arm(hx, hy);
      shaft(p, hx, hy, a, -1, 7, C.wood);
      for (let s = -3; s <= 3; s++) { const [x, y] = along(hx, hy, a, 7 - Math.abs(s) * 0.3, s); p.set(x, y, C.ironDark); }
      break;
    }
    case "hoe": {
      const [hx, hy, a] = swingPose(look, cx, ty, swing, true); arm(hx, hy);
      shaft(p, hx, hy, a, -1, 8, C.wood);
      for (let s = 0; s <= 2; s++) { const [x, y] = along(hx, hy, a, 8, s); p.set(x, y, C.ironDark); }
      break;
    }
    case "hammer": {
      const [hx, hy, a] = swingPose(look, cx, ty, swing); arm(hx, hy);
      shaft(p, hx, hy, a, -1, 5, C.wood);
      for (let s = -1; s <= 1; s++) for (let t = 5; t <= 6; t++) { const [x, y] = along(hx, hy, a, t, s); p.set(x, y, C.ironDark); }
      break;
    }
    case "basket": {
      const by = work ? ty + 3 + (look.frame % 2) : ty + 4;
      p.rect(cx - 3, by, 7, 4, rgb(0xa07840)); p.rect(cx - 3, by, 7, 1, rgb(0x7a5a2c)); p.rect(cx - 3, by + 2, 7, 1, rgb(0x8a6834));
      if (work) p.set(cx, by - 1, C.berry);
      arm(cx + 3, by);
      break;
    }
    case "net": {
      const mesh = (x0: number, y0: number, w: number, h: number) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 2 === 0 && Math.abs(x - w / 2) / w + Math.abs(y - h / 2) / h < 0.6) p.set(x0 + x, y0 + y, rgb(0xd8ccb0));
      };
      if (!work) { arm(cx + 5, ty + 6); mesh(cx + 4, ty + 6, 4, 4); }
      else if (st === 0) { arm(cx + 3, ty - 2); mesh(cx + 1, ty - 5, 4, 4); }
      else if (st === 1) { arm(cx + 7, ty); mesh(cx + 7, ty - 3, 7, 6); }
      else { arm(cx + 7, ty + 4); mesh(cx + 8, ty + 8, 7, 5); p.line(cx + 7, ty + 4, cx + 9, ty + 8, rgb(0xd8ccb0)); }
      break;
    }
    case "short": case "broad": case "long": case "gladius": case "scimitar": {
      const [hx, hy, a] = swingPose(look, cx, ty, swing); arm(hx, hy);
      const len = weapon === "long" ? 10 : weapon === "broad" ? 8 : weapon === "scimitar" ? 8 : 6;
      const blade = weapon === "short" ? C.bronzeLight : C.iron;
      if (weapon === "scimitar") {
        for (let t = 2; t <= len; t++) { const [x, y] = along(hx, hy, a, t, ((t - 2) * (t - 2)) / 14); p.set(x, y, C.ironLight); }
      } else shaft(p, hx, hy, a, 2, len, blade, weapon === "broad" || weapon === "gladius");
      for (let s = -1; s <= 1; s++) { const [x, y] = along(hx, hy, a, 1, s); p.set(x, y, C.bronzeDark); }
      const [px0, py0] = along(hx, hy, a, -1); p.set(px0, py0, C.goldDark);
      break;
    }
    case "spear": case "javelin": case "lance": {
      const reach = weapon === "lance" ? 13 : weapon === "javelin" ? 7 : 10;
      let hx = cx + 5, hy = ty + 5 + swing, a = -88;
      if (work) {
        hx = cx + [1, 3, 5][st]; hy = ty + [1, 2, 3][st]; a = [-12, -6, 4][st];
        if (weapon === "lance") { hx = cx + [2, 3, 4][st]; hy = ty + 3; a = [-25, -8, 2][st]; }
      } else if (weapon === "lance") { a = -60; hy = ty + 5; }
      arm(hx, hy);
      shaft(p, hx, hy, a, -5, reach, C.wood);
      shaft(p, hx, hy, a, reach - 1, reach + 1.5, C.iron);
      const [x, y] = along(hx, hy, a, reach - 1, 1); p.set(x, y, C.ironDark);
      if (weapon === "lance") { const [fx, fy] = along(hx, hy, a, reach - 3, -1); p.set(fx, fy, playerRGB(look.owner)); }
      break;
    }
    case "staff": {
      if (work) {
        p.line(cx + 4, ty + 1, cx + 6, ty - 4, C.robeDark); p.line(cx - 5, ty + 1, cx - 6, ty - 4, C.robe);
        p.rect(cx - 7, ty - 5, 2, 1, C.skin); p.rect(cx + 6, ty - 5, 1, 1, C.skin);
        p.line(cx + 6, ty + 6, cx + 6, ty - 9, C.wood);
        p.rect(cx + 5, ty - 11, 3, 2, C.gold); p.set(cx + 6, ty - 12, C.gold);
      } else {
        arm(cx + 5, ty + 4 + swing);
        p.line(cx + 6, ty + 13, cx + 6, ty - 6, C.wood);
        p.rect(cx + 5, ty - 8, 3, 2, C.gold); p.set(cx + 6, ty - 9, C.gold); p.set(cx + 6, ty - 7, C.goldDark);
      }
      break;
    }
    case "sling": {
      p.rect(cx - 3, ty + 7, 2, 2, C.leatherDark); // stone pouch
      let hx = cx + 5, hy = ty + 6 + swing; let ex = hx, ey = hy + 3, stone = true;
      if (work) {
        [hx, hy, ex, ey] = ([[cx + 3, ty - 3, cx - 1, ty - 6], [cx + 4, ty - 4, cx + 8, ty - 7], [cx + 7, ty + 1, cx + 9, ty + 5]] as const)[st].slice() as [number, number, number, number];
        stone = st < 2;
      }
      arm(hx, hy);
      p.line(hx, hy, ex, ey, rgb(0xd8ccb0));
      if (stone) p.rect(ex, ey, 2, 2, C.stone);
      break;
    }
    case "bow": case "longbow": case "composite": {
      const half = weapon === "longbow" ? 7 : 5;
      const bowC = weapon === "composite" ? rgb(0x4a2a14) : C.woodDark;
      const string = rgb(0xe8e0c8);
      let bx: number, by: number, pull: number;
      if (!work) { bx = cx + 6; by = ty + 5 + swing; pull = bx; arm(cx + 5, by); }
      else { bx = cx + 7; by = ty + 2; pull = [cx + 3, cx, bx][st]; arm(bx, by); }
      for (let i = -half; i <= half; i++) {
        let off = Math.round(1.8 * (1 - (i * i) / (half * half)));
        if (weapon === "composite" && Math.abs(i) >= half - 1) off += 1;
        p.set(bx + off, by + i, bowC);
      }
      if (weapon === "composite") { p.set(bx + 2, by, C.ivory); p.set(bx + 2, by - 1, C.ivory); }
      p.line(bx, by - half, pull, by, string); p.line(pull, by, bx, by + half, string);
      if (work && st < 2) {
        p.line(cx - 4, ty + 1, pull, by, C.skin); // the drawing arm
        p.line(pull, by, bx + 4, by, C.woodLight); p.set(bx + 5, by, C.iron); p.set(pull - 1, by, C.white);
      } else if (work) p.line(cx - 4, ty + 1, cx - 3, ty - 1, C.skin);
      else p.rect(cx - 5, ty + 1 + swing, 1, 5, C.skin);
      break;
    }
    default: {
      // Empty hand: the arm hangs and swings.
      p.rect(cx + 4, ty + 1 - swing, 1, 5, villagerArm(look, kit));
      break;
    }
  }
}

const villagerArm = (look: UnitLook, kit: Kit) => (kit.robe ? C.robeDark : look.type === "villager" ? C.skinDark : C.skinDark);

function drawShield(p: PixelCanvas, kind: Shield, back: boolean, cx: number, ty: number, pc: RGB, look: UnitLook) {
  const up = look.pose === "work" && look.frame % 3 === 2 ? -1 : 0;
  const face = back ? darken(pc, 0.6) : pc, faceL = back ? darken(pc, 0.75) : lighten(pc, 0.3);
  const disc = (x: number, y: number, r: number, rim: RGB) => {
    p.ellipse(x, y, r + 0.6, r + 0.9, rim);
    p.ellipse(x, y, r - 0.4, r - 0.1, (px, py) => (px < x - 0.5 && py < y ? faceL : face));
  };
  switch (kind) {
    case "small": disc(cx - 5, ty + 5 + up, 2.2, C.leather); p.set(cx - 5, ty + 5 + up, C.bronze); break;
    case "round": disc(cx - 5, ty + 5 + up, 3, C.bronze); p.set(cx - 5, ty + 5 + up, C.bronzeLight); break;
    case "aspis": {
      const x = cx - 4, y = ty + 5 + up;
      disc(x, y, 4.2, C.bronze);
      if (!back) { p.set(x - 1, y - 1, C.white); p.set(x, y, C.white); p.set(x + 1, y + 1, C.white); p.set(x - 1, y + 1, C.white); p.set(x + 1, y - 1, C.white); }
      break;
    }
    case "oval": {
      const x = cx - 5, y = ty + 5 + up;
      p.ellipse(x, y, 3.1, 5.1, C.bronzeDark); p.ellipse(x, y, 2.2, 4.2, (px, py) => (px < x - 0.5 && py < y ? faceL : face));
      p.rect(x - 1, y - 1, 1, 3, C.bronze);
      break;
    }
    case "scutum": {
      const x0 = cx - 8, y0 = ty - 1 + up;
      p.rect(x0, y0, 6, 13, C.goldDark);
      p.rect(x0 + 1, y0 + 1, 4, 11, face); p.rect(x0 + 1, y0 + 1, 1, 11, faceL); p.rect(x0 + 4, y0 + 1, 1, 11, darken(face, 0.8));
      if (!back) { p.rect(x0 + 2, y0 + 5, 2, 2, C.gold); p.line(x0 + 1, y0 + 2, x0 + 4, y0 + 4, C.gold); p.line(x0 + 1, y0 + 10, x0 + 4, y0 + 8, C.gold); }
      break;
    }
    default: break;
  }
}

/** A priest's glow: soft rings of light around the raised hands, growing over the three frames. */
function drawGlow(p: PixelCanvas, x: number, y: number, st: number) {
  const r = 3 + st * 2;
  for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
    const d = Math.sqrt(i * i + (j * 1.2) * (j * 1.2));
    if (Math.abs(d - r) < 0.8 && bayer(x + i, y + j) < 0.6 && !p.alphaAt(x + i, y + j)) p.set(x + i, y + j, C.glow, 200);
  }
  for (const [i, j] of [[-6, -4], [6, -6], [0, -9]]) if (bayer(i + st, j) < 0.7) p.set(x + i, y + j + st, rgb(0xffffff), 230);
}

// ---- mounts

function drawHorse(p: PixelCanvas, ox: number, fy: number, look: UnitLook, coat: RGB, barding: "none" | "cloth" | "scale", pc: RGB) {
  const coatD = darken(coat, 0.72), coatL = lighten(coat, 0.14), mane = darken(coat, 0.45);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const bob = gait === 1 || gait === 3 ? -1 : 0;
  const by = fy - 11 + bob;
  const cyc = [[-2, 0], [0, 2], [2, 0], [1, 1]];
  const leg = (x: number, phase: number, far: boolean) => {
    const [dx, lift] = gait < 0 ? [0, 0] : cyc[(gait + phase) % 4];
    const c = far ? coatD : coat;
    p.line(x, by + 2, x + dx, fy - 1 - lift, c); p.line(x + 1, by + 2, x + 1 + dx, fy - 1 - lift, darken(c, 0.9));
    p.rect(x + dx, fy - 1 - lift, 2, 1, C.dark);
  };
  leg(ox - 7, 1, true); leg(ox + 6, 3, true);
  // Tail.
  p.line(ox - 9, by - 2, ox - 11, by + 3 + (gait >= 0 ? gait % 2 : 0), mane); p.line(ox - 10, by - 2, ox - 12, by + 4, mane);
  p.ellipse(ox, by, 9.5, 4.6, (x, y) => (y < by - 2 ? coatL : y > by + 2 ? coatD : x > ox + 4 ? coatD : coat));
  leg(ox - 5, 0, false); leg(ox + 8, 2, false);
  // Neck and head, toward screen right.
  const hb = gait === 0 ? 1 : 0;
  p.poly([[ox + 4, by - 1], [ox + 8, by - 8 + hb], [ox + 12, by - 8 + hb], [ox + 10, by + 2]], (x) => (x < ox + 8 ? coat : coatD));
  p.poly([[ox + 9, by - 10 + hb], [ox + 13, by - 10 + hb], [ox + 16, by - 5 + hb], [ox + 15, by - 3 + hb], [ox + 12, by - 5 + hb]], coat);
  p.set(ox + 15, by - 4 + hb, C.dark);
  p.set(ox + 10, by - 11 + hb, coatD); p.set(ox + 11, by - 11 + hb, coat);
  p.set(ox + 12, by - 8 + hb, C.dark);
  p.line(ox + 5, by - 3, ox + 9, by - 10 + hb, mane); p.line(ox + 6, by - 3, ox + 10, by - 10 + hb, mane);
  if (barding === "cloth") {
    p.poly([[ox - 5, by - 4], [ox + 4, by - 4], [ox + 5, by + 3], [ox - 6, by + 3]], (x) => (x > ox + 1 ? darken(pc, 0.7) : pc));
    p.line(ox - 6, by + 3, ox + 5, by + 3, C.gold);
  } else if (barding === "scale") {
    p.ellipse(ox, by, 9, 4.3, (x, y) => { const b = y > by + 1 || x > ox + 4 ? C.ironDark : C.iron; return (x + y) % 2 ? b : darken(b, 0.8); });
    p.poly([[ox + 9, by - 10 + hb], [ox + 13, by - 10 + hb], [ox + 15, by - 6 + hb], [ox + 12, by - 6 + hb]], C.iron);
    p.poly([[ox + 4, by - 1], [ox + 8, by - 8 + hb], [ox + 10, by - 8 + hb], [ox + 8, by]], C.ironDark);
    p.line(ox - 8, by + 4, ox + 8, by + 4, pc);
  }
  p.rect(ox - 3, by - 5, 6, 2, C.leatherDark); // saddle
}

function drawRider(p: PixelCanvas, look: UnitLook) {
  const pc = playerRGB(look.owner);
  const ox = 16, fy = 34;
  const t = look.type;
  p.shadow(ox, fy + 0.5, 13, 2.4);
  const coat = t === "scout" || t === "horse_archer" ? rgb(0xa8743c) : t === "cataphract" ? rgb(0x3a2c24) : rgb(0x6a4226);
  drawHorse(p, ox, fy, look, coat, t === "cataphract" || t === "heavy_horse_archer" ? "scale" : t === "scout" ? "none" : "cloth", pc);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const ty = fy - 21 + (gait === 1 || gait === 3 ? -1 : 0);
  drawPerson(p, KITS[t], look, ox - 3, ty, true);
  p.outline(C.outline, 0.25);
}

function drawCamelRider(p: PixelCanvas, look: UnitLook) {
  const pc = playerRGB(look.owner);
  const ox = 15, fy = 39;
  const coat = rgb(0xc8a066), coatD = darken(coat, 0.75), coatL = lighten(coat, 0.15);
  p.shadow(ox, fy + 0.5, 12, 2.3);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const by = fy - 15;
  const cyc = [[-2, 0], [0, 2], [2, 0], [1, 1]];
  const leg = (x: number, phase: number, far: boolean) => {
    const [dx, lift] = gait < 0 ? [0, 0] : cyc[(gait + phase) % 4];
    const c = far ? coatD : coat;
    p.line(x, by + 2, x + dx, fy - 1 - lift, c); p.line(x + 1, by + 2, x + 1 + dx, fy - 1 - lift, c);
    p.rect(x + dx - 1, fy - 1 - lift, 3, 1, darken(coat, 0.5));
  };
  leg(ox - 7, 1, true); leg(ox + 5, 3, true);
  p.line(ox - 9, by - 1, ox - 10, by + 5, coatD);
  p.ellipse(ox, by, 9, 4.2, (x, y) => (y < by - 1 ? coatL : x > ox + 4 || y > by + 2 ? coatD : coat));
  p.ellipse(ox - 1, by - 4, 5, 4, (x) => (x < ox - 2 ? coatL : coat)); // hump
  leg(ox - 5, 0, false); leg(ox + 7, 2, false);
  // Long curved neck and a small head.
  p.poly([[ox + 5, by - 1], [ox + 9, by + 1], [ox + 12, by - 7], [ox + 10, by - 9]], coat);
  p.poly([[ox + 10, by - 9], [ox + 12, by - 7], [ox + 13, by - 12], [ox + 11, by - 13]], coat);
  p.rect(ox + 11, by - 15, 4, 3, coat); p.rect(ox + 15, by - 14, 2, 2, coatD);
  p.set(ox + 13, by - 14, C.dark); p.set(ox + 11, by - 16, coatD);
  p.poly([[ox - 6, by - 5], [ox + 3, by - 5], [ox + 4, by + 2], [ox - 7, by + 2]], (x) => (x > ox ? darken(pc, 0.7) : pc));
  p.line(ox - 7, by + 2, ox + 4, by + 2, C.gold);
  drawPerson(p, KITS.camel_rider, look, ox - 1, by - 15, true);
  p.outline(C.outline, 0.25);
}

function drawWheel(p: PixelCanvas, x: number, y: number, r: number, spin: number, rim: RGB, spoke: RGB, blades = false) {
  p.ellipse(x, y, r * 0.55 + 0.4, r + 0.4, rim);
  p.ellipse(x, y, r * 0.55 - 0.7, r - 1, darken(rim, 0.55));
  for (let i = 0; i < 3; i++) {
    const a = spin * 0.5 + (i * Math.PI) / 3;
    p.line(Math.round(x - Math.cos(a) * r * 0.45), Math.round(y - Math.sin(a) * (r - 1)), Math.round(x + Math.cos(a) * r * 0.45), Math.round(y + Math.sin(a) * (r - 1)), spoke);
  }
  p.set(x, y, C.ironDark);
  if (blades) { p.line(x, y, x - 6, y + 1, C.iron); p.line(x - 6, y + 1, x - 8, y - 1, C.ironLight); p.line(x, y, x + 2, y + 1, C.iron); }
}

function drawChariot(p: PixelCanvas, look: UnitLook) {
  const pc = playerRGB(look.owner), pcD = darken(pc, 0.68);
  const fy = 32, t = look.type;
  p.shadow(24, fy + 0.5, 20, 2.5);
  const spin = look.pose === "walk" ? look.frame % 4 : 0;
  // Two horses: the far one first, a little up and back.
  drawHorse(p, 30, fy - 3, look, rgb(0x5a3a22), "none", pc);
  drawHorse(p, 32, fy, look, rgb(0x9a6a38), t === "scythe_chariot" ? "cloth" : "none", pc);
  // Pole from the car to the yoke.
  p.line(15, fy - 8, 34, fy - 13, C.woodDark);
  // Crew stands in the car, drawn before its front panel.
  if (t === "chariot_archer") drawPerson(p, KITS.chariot_archer, look, 11, fy - 25, true, true);
  else drawPerson(p, KITS.chariot_driver, { ...look, pose: look.pose === "work" ? "idle" : look.pose }, 11, fy - 25, true, true);
  if (t !== "chariot_archer") {
    // The driver lashes out with a spear when attacking.
    const st = look.pose === "work" ? look.frame % 3 : -1;
    const a = st < 0 ? -80 : [-30, -10, 5][st];
    shaft(p, 15, fy - 20, a, -4, 9, C.wood); shaft(p, 15, fy - 20, a, 9, 11, C.iron);
  }
  // The car.
  p.poly([[5, fy - 16], [17, fy - 16], [18, fy - 7], [4, fy - 7]], (x, y) => (y < fy - 14 ? C.bronze : x > 13 ? pcD : pc));
  p.line(5, fy - 16, 17, fy - 16, C.goldDark);
  p.rect(7, fy - 13, 6, 1, lighten(pc, 0.3));
  drawWheel(p, 10, fy - 5, 6, spin, C.woodDark, C.wood, t === "scythe_chariot");
  p.outline(C.outline, 0.25);
}

function drawElephant(p: PixelCanvas, ox: number, fy: number, look: UnitLook, wild: boolean, armor: boolean) {
  const g = wild ? rgb(0x8c8a84) : rgb(0x84827e), gD = darken(g, 0.72), gL = lighten(g, 0.16);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const by = fy - 16;
  const lift = (ph: number) => (gait < 0 ? 0 : [0, 2, 0, 0][(gait + ph) % 4]);
  const shift = (ph: number) => (gait < 0 ? 0 : [-1, 0, 1, 0][(gait + ph) % 4]);
  const leg = (x: number, ph: number, far: boolean) => {
    const c = far ? gD : g;
    p.rect(x + shift(ph), by + 4, 4, fy - by - 4 - lift(ph), c);
    p.rect(x + shift(ph) + 3, by + 4, 1, fy - by - 4 - lift(ph), darken(c, 0.85));
    p.rect(x + shift(ph), fy - 1 - lift(ph), 4, 1, C.ivory);
  };
  leg(ox - 10, 1, true); leg(ox + 5, 3, true);
  p.line(ox - 13, by - 3, ox - 15, by + 6, gD); p.rect(ox - 16, by + 6, 2, 2, C.dark); // tail
  p.ellipse(ox, by, 13.5, 9.5, (x, y) => (y < by - 5 && x < ox + 6 ? gL : y > by + 4 || x > ox + 8 ? gD : g));
  for (const [x, y] of [[ox - 4, by + 2], [ox + 2, by - 3], [ox - 8, by - 2]]) p.set(x, y, gD);
  leg(ox - 7, 0, false); leg(ox + 8, 2, false);
  // Head, ear, trunk and tusks.
  const st = look.pose === "work" ? look.frame % 3 : -1;
  const hx = ox + 13, hy = by - 4 - (st === 1 ? 1 : 0);
  p.ellipse(hx, hy, 6, 6.5, (x, y) => (y < hy - 3 ? gL : x > hx + 3 ? gD : g));
  if (st < 0 || st === 2) {
    const sw = gait >= 0 ? [0, 1, 0, -1][gait] : 0;
    p.thick(hx + 4, hy + 2, hx + 5 + sw, hy + 10, g, 3);
    p.thick(hx + 5 + sw, hy + 10, hx + 7 + sw, hy + 14, g, 2);
    p.set(hx + 8 + sw, hy + 14, gD);
  } else {
    p.thick(hx + 4, hy + 1, hx + 9, hy - 6, g, 3);
    p.thick(hx + 9, hy - 6, hx + 8, hy - 11, g, 2);
  }
  p.line(hx + 3, hy + 4, hx + 7, hy + 6, C.ivory); p.set(hx + 8, hy + 5, C.ivory);
  if (armor) { p.line(hx + 7, hy + 6, hx + 10, hy + 6, C.ironLight); p.set(hx + 10, hy + 5, C.ironLight); }
  p.ellipse(hx - 3, hy + 1, 3.6, 5.6, (x) => (x < hx - 4 ? g : gD));
  p.line(hx - 6, hy - 3, hx - 6, hy + 5, gL);
  p.set(hx + 2, hy - 2, C.dark);
  if (armor) {
    p.poly([[hx - 2, hy - 6], [hx + 4, hy - 6], [hx + 6, hy + 1], [hx + 1, hy + 2]], (x, y) => ((x + y) % 2 ? C.iron : C.ironDark));
  }
}

function drawWarElephant(p: PixelCanvas, look: UnitLook, fy: number) {
  const t = look.type, wild = t === "elephant";
  const ox = 19;
  p.shadow(ox + 2, fy + 0.5, 17, 3);
  if (look.owner < 0 || wild) { drawElephant(p, ox, fy, look, true, false); p.outline(C.outline, 0.25); return; }
  const pc = playerRGB(look.owner), pcD = darken(pc, 0.68);
  const armor = t === "armored_elephant";
  drawElephant(p, ox, fy, look, false, armor);
  const by = fy - 16;
  if (armor) p.ellipse(ox, by - 1, 12, 7, (x, y) => { const b = y > by + 2 || x > ox + 6 ? C.ironDark : C.iron; return (x + 2 * y) % 3 ? b : darken(b, 0.8); });
  // Saddle cloth in the player's colour with a gold fringe.
  p.poly([[ox - 7, by - 9], [ox + 4, by - 9], [ox + 6, by + 1], [ox - 9, by + 1]], (x) => (x > ox + 1 ? pcD : pc));
  for (let x = ox - 9; x <= ox + 6; x += 2) p.set(x, by + 2, C.gold);
  p.line(ox - 7, by - 9, ox + 4, by - 9, C.gold);
  if (t === "elephant_archer") {
    // A howdah with an archer in it.
    drawPerson(p, KITS.elephant_archer, look, ox - 1, by - 20, true, true);
    p.rect(ox - 8, by - 15, 15, 6, C.wood); p.rect(ox - 8, by - 15, 15, 1, C.woodLight); p.rect(ox + 3, by - 14, 4, 5, C.woodDark);
    p.rect(ox - 6, by - 13, 3, 3, pc); p.rect(ox - 1, by - 13, 3, 3, pc);
    p.rect(ox - 8, by - 21, 1, 6, C.woodDark); p.rect(ox + 6, by - 21, 1, 6, C.woodDark);
  } else {
    drawPerson(p, KITS.mahout, look, ox + 7, by - 17, true);
  }
  p.outline(C.outline, 0.25);
}

// ---- siege

function drawSiege(p: PixelCanvas, look: UnitLook) {
  const pc = playerRGB(look.owner);
  const t = look.type, fy = 30;
  const spin = look.pose === "walk" ? look.frame % 4 : 0;
  const st = look.pose === "work" ? look.frame % 3 : -1;
  p.shadow(20, fy + 0.5, 16, 2.6);
  const heavy = t === "heavy_catapult";
  const wood = heavy ? rgb(0x7a4c26) : C.wood, woodD = darken(wood, 0.68), woodL = lighten(wood, 0.2);
  const wr = t === "stone_thrower" ? 3.5 : heavy ? 5.5 : 4.5;
  // Far wheels, then the frame, then near wheels.
  drawWheel(p, 12, fy - wr - 3, wr, spin, woodD, wood);
  drawWheel(p, 29, fy - wr - 3, wr, spin, woodD, wood);
  if (t === "ballista") {
    p.poly([[7, fy - 12], [32, fy - 12], [31, fy - 7], [8, fy - 7]], (x, y) => (y < fy - 10 ? woodL : wood));
    // Stock, tilted up toward the front, with the torsion frame.
    p.thick(8, fy - 15, 32, fy - 19, woodD, 2);
    p.rect(26, fy - 24, 4, 11, woodD); p.rect(27, fy - 23, 2, 9, rgb(0x5a4a3a));
    p.rect(26, fy - 25, 4, 1, C.ironDark); p.rect(26, fy - 13, 4, 1, C.ironDark);
    const back = st < 0 || st === 0 ? 10 : st === 1 ? 15 : 24;
    const tipBack = st === 2 ? 25 : 21;
    p.line(28, fy - 24, tipBack, fy - 29, wood); p.line(28, fy - 14, tipBack, fy - 9, wood);
    p.line(tipBack, fy - 29, back, fy - 17, rgb(0xe8e0c8)); p.line(tipBack, fy - 9, back, fy - 17, rgb(0xe8e0c8));
    if (st !== 2) { p.line(back, fy - 18, 35, fy - 20, C.woodLight); p.rect(35, fy - 21, 2, 2, C.iron); }
    p.rect(9, fy - 9, 5, 2, pc);
  } else {
    // Catapults: a frame, an A-frame with a padded stop bar, and a throwing arm with a cup.
    const big = heavy ? 1.2 : t === "stone_thrower" ? 0.8 : 1;
    p.poly([[6, fy - 12], [34, fy - 12], [33, fy - 7], [7, fy - 7]], (x, y) => (y < fy - 10 ? woodL : wood));
    const ax = 27, top = Math.round(fy - 12 - 12 * big);
    p.line(23, fy - 12, ax, top, woodD); p.line(31, fy - 12, ax, top, woodD); p.line(24, fy - 11, ax + 1, top, wood);
    p.rect(ax - 2, top - 1, 5, 2, heavy ? C.ironDark : C.leather);
    const pivot: [number, number] = [18, fy - 12];
    const ang = st < 0 || st === 0 ? 192 : st === 1 ? 250 : 296;
    const len = Math.round(14 * big);
    const end = along(pivot[0], pivot[1], ang, len);
    p.thick(pivot[0], pivot[1], end[0], end[1], woodD, 2);
    p.ellipse(end[0], end[1], 2.2, 1.6, C.leatherDark);
    if (st <= 0) p.ellipse(end[0], end[1] - 1, 1.6, 1.6, C.stone);
    p.rect(pivot[0] - 2, pivot[1] - 2, 4, 4, rgb(0x5a4a3a)); // twisted rope skein
    p.set(pivot[0] - 1, pivot[1] - 1, rgb(0x8a7a5a));
    if (heavy) { p.rect(6, fy - 12, 28, 1, C.ironDark); p.rect(33, fy - 13, 1, 6, C.ironDark); }
    // A banner in the player's colour on a post at the back.
    p.rect(7, fy - 22, 1, 10, woodD); p.rect(8, fy - 22, 4, 3, pc); p.rect(8, fy - 19, 3, 1, darken(pc, 0.7));
  }
  drawWheel(p, 10, fy - wr, wr, spin, wood, woodL);
  drawWheel(p, 27, fy - wr, wr, spin, wood, woodL);
  p.outline(C.outline, 0.25);
}

function drawHelepolis(p: PixelCanvas, look: UnitLook) {
  const pc = playerRGB(look.owner), pcD = darken(pc, 0.68);
  const fy = 50;
  const spin = look.pose === "walk" ? look.frame % 4 : 0;
  const st = look.pose === "work" ? look.frame % 3 : -1;
  p.shadow(19, fy + 0.5, 16, 2.8);
  const wood = rgb(0x8a5a2e), woodD = rgb(0x5c3a1c), woodL = rgb(0xb07a44);
  drawWheel(p, 10, fy - 6, 4.5, spin, woodD, wood);
  drawWheel(p, 30, fy - 6, 4.5, spin, woodD, wood);
  // The tower: a lit front face and a shaded side, tapering a little.
  p.poly([[5, fy - 6], [24, fy - 6], [22, fy - 44], [8, fy - 44]], (x, y) => ((y % 6 === 0) ? woodD : x % 4 === 0 ? darken(woodL, 0.85) : woodL));
  p.poly([[24, fy - 6], [34, fy - 10], [31, fy - 46], [22, fy - 44]], (x, y) => ((y + Math.floor((x - 24) / 2)) % 6 === 0 ? darken(woodD, 0.8) : wood));
  // Hides hung on the front, in the player's colour.
  p.poly([[7, fy - 12], [22, fy - 12], [21, fy - 20], [8, fy - 20]], pc);
  p.line(7, fy - 12, 22, fy - 12, pcD);
  // Two firing ports with bolts.
  for (const y of [fy - 28, fy - 38]) {
    p.rect(12, y, 6, 4, C.dark);
    if (st !== 2) { p.line(13, y + 2, 26, y + 2, C.woodLight); p.rect(26, y + 1, 2, 2, C.iron); }
  }
  p.rect(7, fy - 47, 16, 3, woodD); p.rect(22, fy - 48, 9, 3, darken(woodD, 0.8));
  p.rect(14, fy - 53, 1, 6, woodD); p.rect(15, fy - 53, 5, 3, pc);
  drawWheel(p, 8, fy - 4, 4.5, spin, wood, woodL);
  drawWheel(p, 26, fy - 4, 4.5, spin, wood, woodL);
  p.outline(C.outline, 0.25);
}

// ---- animals

function drawGazelle(p: PixelCanvas, look: UnitLook, dead: boolean) {
  const k = dead ? 0.7 : 1;
  const coat = darken(rgb(0xc89a5a), k), coatD = darken(coat, 0.75), belly = darken(rgb(0xf0e4cc), k);
  const fy = 19, ox = 11;
  if (dead) {
    p.shadow(ox, fy, 9, 2);
    p.ellipse(ox, fy - 3, 7, 2.6, (x, y) => (y > fy - 3 ? belly : coat));
    p.line(ox - 4, fy - 2, ox - 8, fy, coatD); p.line(ox + 2, fy - 2, ox + 6, fy, coatD); p.line(ox - 2, fy - 2, ox - 5, fy + 1, coatD);
    p.rect(ox + 7, fy - 5, 3, 2, coat); p.line(ox + 8, fy - 6, ox + 11, fy - 8, C.dark);
    p.set(ox - 1, fy - 3, darken(C.berry, 0.6)); p.set(ox, fy - 3, darken(C.berry, 0.6));
    p.outline(C.outline, 0.25);
    return;
  }
  p.shadow(ox, fy + 0.5, 7, 1.8);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const by = fy - 9 - (gait === 1 ? 2 : gait === 3 ? 1 : 0);
  const legs: [number, number][] = gait < 0 ? [[-4, 0], [-2, 0], [3, 0], [5, 0]] : ([[[-6, 0], [-5, 0], [6, 0], [7, 0]], [[-3, 2], [-2, 2], [2, 2], [3, 2]], [[-5, 0], [-4, 0], [4, 0], [5, 0]], [[-2, 1], [-1, 1], [1, 1], [2, 1]]] as [number, number][][])[gait];
  legs.forEach(([dx, lift], i) => p.line(ox + (i < 2 ? -3 : 3), by + 2, ox + dx, fy - 1 - lift, i % 2 ? coatD : coat));
  p.ellipse(ox, by, 6, 3, (x, y) => (y > by + 1 ? belly : x > ox + 3 ? coatD : coat));
  p.line(ox - 5, by, ox + 5, by, darken(coat, 0.55));
  const graze = look.pose === "work";
  const hx = ox + 7, hy = graze ? fy - 3 : by - 5;
  p.line(ox + 4, by - 1, hx, hy + 1, coat); p.line(ox + 5, by - 1, hx + 1, hy + 1, coat);
  p.rect(hx, hy, 3, 2, coat); p.set(hx + 3, hy + 1, coatD); p.set(hx + 1, hy, C.dark);
  p.line(hx, hy - 1, hx - 1, hy - 4, rgb(0x4a3a2a)); p.set(hx - 2, hy - 5, rgb(0x4a3a2a)); p.set(hx + 2, hy, coatD);
  p.set(ox - 6, by - 1, C.white);
  p.outline(C.outline, 0.25);
}

function drawLion(p: PixelCanvas, look: UnitLook, dead: boolean) {
  const k = dead ? 0.7 : 1;
  const coat = darken(rgb(0xc8903e), k), coatD = darken(coat, 0.72), mane = darken(rgb(0x6a3a18), k);
  const fy = 21, ox = 13;
  if (dead) {
    p.shadow(ox, fy, 11, 2);
    p.ellipse(ox, fy - 3, 9, 3, (x, y) => (y > fy - 2 ? coatD : coat));
    p.ellipse(ox + 9, fy - 4, 4, 3.5, mane); p.rect(ox + 10, fy - 4, 3, 2, coat);
    p.line(ox - 5, fy - 1, ox - 9, fy + 1, coatD); p.line(ox + 3, fy - 1, ox + 6, fy + 1, coatD);
    p.line(ox - 9, fy - 4, ox - 13, fy - 2, coatD);
    p.outline(C.outline, 0.25);
    return;
  }
  p.shadow(ox, fy + 0.5, 10, 2);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const st = look.pose === "work" ? look.frame % 3 : -1;
  const by = fy - 8 - (st === 1 ? 2 : 0);
  const legs = gait < 0 ? [[-6, 0], [-4, 0], [5, 0], [7, 0]] : [[[-8, 0], [-6, 0], [7, 0], [8, 0]], [[-5, 2], [-4, 1], [4, 2], [5, 1]], [[-6, 0], [-5, 0], [6, 0], [7, 0]], [[-4, 1], [-3, 2], [3, 1], [4, 2]]][gait];
  if (st >= 1) { legs[2] = [9, 4]; legs[3] = [10, 3]; }
  legs.forEach(([dx, lift], i) => p.thick(ox + (i < 2 ? -6 : 5), by + 2, ox + dx, fy - 1 - lift, i % 2 ? coatD : coat, 2));
  p.line(ox - 9, by - 1, ox - 13, by - 4, coat); p.rect(ox - 14, by - 6, 2, 2, mane);
  p.ellipse(ox, by, 9, 3.6, (x, y) => (y < by - 1 ? lighten(coat, 0.12) : x > ox + 5 || y > by + 1 ? coatD : coat));
  const hx = ox + 9, hy = by - 2 - (st === 1 ? 1 : 0);
  p.ellipse(hx, hy, 4.5, 4.6, (x) => (x < hx ? mane : darken(mane, 0.85)));
  p.rect(hx + 1, hy - 1, 4, 3, coat); p.set(hx + 5, hy, C.dark); p.set(hx + 3, hy - 1, C.dark);
  if (st >= 1) { p.rect(hx + 2, hy + 2, 3, 1, C.berry); p.set(hx + 4, hy + 3, C.ivory); }
  p.outline(C.outline, 0.25);
}

function drawAlligator(p: PixelCanvas, look: UnitLook, dead: boolean) {
  const k = dead ? 0.7 : 1;
  const g = darken(rgb(0x4e6a34), k), gD = darken(g, 0.7), belly = darken(rgb(0x9aa462), k);
  const fy = 14, ox = 17;
  p.shadow(ox, fy, 15, 1.8);
  const gait = look.pose === "walk" ? look.frame % 4 : -1;
  const sway = gait < 0 ? 0 : [0, 1, 0, -1][gait];
  const st = look.pose === "work" ? look.frame % 3 : -1;
  if (dead) {
    p.poly([[2, fy - 3], [ox + 14, fy - 3], [ox + 14, fy], [2, fy - 1]], (x, y) => (y < fy - 2 ? belly : g));
    p.line(ox - 4, fy - 1, ox - 6, fy, gD); p.line(ox + 4, fy - 1, ox + 6, fy, gD);
    p.outline(C.outline, 0.25);
    return;
  }
  for (const [x, ph] of [[ox - 6, 0], [ox + 5, 1]] as [number, number][]) {
    const off = gait < 0 ? 0 : (gait + ph * 2) % 4 < 2 ? 1 : -1;
    p.line(x, fy - 3, x + off - 1, fy - 1, gD); p.line(x + 1, fy - 3, x + off + 2, fy - 1, gD);
  }
  // Tail tapering to the left.
  p.poly([[1, fy - 4 + sway], [ox - 8, fy - 6], [ox - 8, fy - 2], [1, fy - 3 + sway]], g);
  p.poly([[ox - 9, fy - 7], [ox + 8, fy - 7], [ox + 9, fy - 2], [ox - 9, fy - 2]], (x, y) => (y > fy - 4 ? belly : g));
  for (let x = ox - 12; x < ox + 8; x += 2) p.set(x, x < ox - 8 ? fy - 5 + sway : fy - 8, gD);
  // Head and jaws.
  const open = st >= 1 ? (st === 1 ? 3 : 2) : 0;
  p.poly([[ox + 8, fy - 7 - open], [ox + 17, fy - 5 - open], [ox + 17, fy - 4 - open], [ox + 8, fy - 4]], g);
  p.poly([[ox + 8, fy - 4], [ox + 17, fy - 3], [ox + 17, fy - 2], [ox + 8, fy - 2]], belly);
  if (open) { p.line(ox + 10, fy - 4, ox + 16, fy - 3 - open, C.berry); p.set(ox + 13, fy - 4 - open, C.ivory); p.set(ox + 15, fy - 3, C.ivory); }
  p.set(ox + 10, fy - 8 - open, gD); p.set(ox + 10, fy - 7 - open, rgb(0xd8c040));
  p.outline(C.outline, 0.25);
}

// =====================================================================================
// ---- resources and other map objects

export function nodePic(type: string, variant: number): Pic {
  const files = ASSETS.manifest.resources?.[type];
  if (files) {
    const list = Array.isArray(files) ? files : [files];
    const spec = list[Math.abs(Math.floor(variant)) % list.length];
    const fromFile = spec && assetPic(`na-${spec.file}`, spec, null, 0.92);
    if (fromFile) return fromFile;
  }
  if (type === "tree" || type === "palm") {
    const v = type === "palm" ? 4 : variant % 4;
    return pic(`tree${v}`, 26, 38, 0.5, 0.92, (p) => drawTree(p, v, 13, 35, 1));
  }
  if (type === "lone_tree") return pic("lone_tree", 44, 58, 0.5, 54 / 58, (p) => drawTree(p, 5, 22, 54, 1.7));
  if (type === "berry_bush") {
    return pic("berry", 20, 15, 0.5, 0.85, (p) => {
      p.shadow(10, 12.5, 8, 2);
      for (const [x, y, r] of [[6, 8, 4.5], [13, 8, 4.5], [10, 6, 5]] as [number, number, number][]) {
        p.ellipse(x, y, r, r * 0.85, (px, py) => (hash(px, py, 2) < 0.2 ? C.leafLight : px + py < x + y - 1 ? C.leaf : C.leafDark));
      }
      for (const [x, y] of [[5, 6], [8, 4], [11, 7], [14, 5], [7, 9], [10, 10], [4, 9], [15, 9], [12, 4]]) { p.set(x, y, C.berry); p.set(x + 1, y, darken(C.berry, 0.7)); p.set(x, y - 1, rgb(0xf06070)); }
      p.outline(C.outline, 0.3);
    });
  }
  if (type === "fish") return pic(`fish${variant % 2}`, 26, 14, 0.5, 0.6, (p) => drawFish(p, variant % 2));
  if (type.startsWith("carcass_")) {
    const animal = type.slice(8);
    const dead: UnitLook = { type: animal, owner: -1, facing: "front", pose: "idle", frame: 0, tool: "none", carry: null };
    if (animal === "elephant") {
      return pic(type, 46, 30, 0.5, 0.75, (p) => {
        const g = rgb(0x5e5c58), gD = darken(g, 0.75);
        p.shadow(23, 23, 18, 3);
        p.ellipse(21, 17, 15, 7, (x, y) => (y < 14 ? lighten(g, 0.1) : y > 19 ? gD : g));
        for (const x of [12, 17, 26, 31]) p.rect(x, 22, 4, 4, gD);
        p.ellipse(36, 15, 5, 5, g); p.ellipse(33, 15, 3, 4.5, gD);
        p.thick(40, 17, 43, 23, g, 2); p.line(38, 19, 42, 20, C.ivory);
        p.outline(C.outline, 0.25);
      });
    }
    if (animal === "lion") return pic(type, 30, 24, 0.5, 21 / 24, (p) => drawLion(p, dead, true));
    if (animal === "alligator") return pic(type, 36, 18, 0.5, 14 / 18, (p) => drawAlligator(p, dead, true));
    return pic(type, 24, 22, 0.5, 19 / 22, (p) => drawGazelle(p, dead, true));
  }
  const gold = type === "gold_mine";
  return pic(type, 28, 18, 0.5, 0.85, (p) => {
    p.shadow(14, 15, 12, 2.4);
    const base = gold ? rgb(0x8a7454) : C.stone, light = lighten(base, 0.18), dark = gold ? rgb(0x5e4c34) : C.stoneDark;
    const rocks: [number, number, number][] = [[7, 12, 5], [16, 11, 6], [11, 8, 5.5], [21, 13, 4.2], [12, 14, 4]];
    for (const [x, y, r] of rocks) {
      p.poly([[x - r, y + 2], [x - r * 0.5, y - r * 0.8], [x + r * 0.5, y - r * 0.9], [x + r, y + 2]], (px, py) => (py < y - r * 0.4 ? light : px < x ? base : dark));
      p.line(x - r * 0.4, y - r * 0.2, x + r * 0.2, y + 1, darken(dark, 0.9));
    }
    if (gold) for (const [x, y] of [[8, 9], [14, 6], [17, 9], [11, 5], [21, 11], [13, 12]]) { p.set(x, y, C.gold); p.set(x + 1, y, C.goldDark); p.set(x, y - 1, rgb(0xfff4b0)); }
    else for (const [x, y] of [[6, 10], [14, 7], [19, 11], [10, 12]]) { p.set(x, y, lighten(C.stone, 0.45)); p.set(x + 1, y + 1, C.stoneDark); }
    p.outline(C.outline, 0.25);
  });
}

/** Trees: 0 round broadleaf, 1 conifer, 2 tall poplar-ish, 3 oak, 4 palm, 5 the big lone tree. */
function drawTree(p: PixelCanvas, v: number, cx: number, base: number, k: number) {
  p.shadow(cx + 1, base - 1, 8 * k, 2.4 * k);
  const leaf = (x: number, y: number, ccx: number, ccy: number) => {
    const n = hash(x, y, v + 7);
    const lit = (x - ccx) + (y - ccy) * 1.2 < -1;
    if (n < 0.1) return lit ? lighten(C.leafLight, 0.15) : C.leaf;
    return lit ? (n < 0.45 ? C.leafLight : C.leaf) : n < 0.25 ? C.leaf : C.leafDark;
  };
  const trunk = (x: number, top: number, w: number) => { p.rect(x, top, w, base - 2 - top, C.wood); p.rect(x + w - 1, top, 1, base - 2 - top, C.woodDark); };
  if (v === 4) {
    // Palm: a leaning ringed trunk and drooping fronds.
    for (let y = base - 3, i = 0; y > base - 26; y--, i++) {
      const x = cx + Math.round(Math.sin(i / 9) * 3);
      p.rect(x, y, 2, 1, i % 3 === 0 ? C.woodDark : rgb(0x9a7046));
    }
    const tx = cx + 3, ty = base - 27;
    for (const [dx, dy] of [[-10, 4], [-7, -3], [0, -6], [7, -3], [10, 4], [-4, 7], [5, 7]]) {
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = Math.round(tx + dx * t), y = Math.round(ty + dy * t + Math.abs(dx) * 0.5 * t * t);
        p.set(x, y, t < 0.5 ? C.leaf : C.leafDark); p.set(x, y + 1, C.leafDark);
        if (i % 2) p.set(x, y - 1, C.leafLight);
      }
    }
    p.rect(tx - 1, ty, 3, 2, rgb(0x6a4a24));
    p.outline(C.outline, 0.3);
    return;
  }
  if (v === 1) {
    trunk(cx - 1, base - 10, 3);
    for (const [top, half, bot] of [[2, 4, 13], [8, 6, 20], [14, 8, 28]]) {
      const ccx = cx, ccy = (top + bot) / 2;
      p.poly([[cx, top], [cx + half + 1, bot], [cx - half - 1, bot]], (x, y) => leaf(x, y, ccx, ccy));
      p.line(cx - half, bot - 1, cx + half, bot - 1, C.leafDark);
    }
    p.outline(C.outline, 0.3);
    return;
  }
  const blobs: [number, number, number][] = v === 0 ? [[-4, 18, 6], [4, 18, 6], [0, 11, 7], [0, 20, 6]]
    : v === 2 ? [[0, 8, 4.5], [-2, 14, 5], [2, 18, 5], [0, 23, 4.5]]
    : v === 3 ? [[-6, 17, 5.5], [6, 16, 6], [-2, 10, 6], [3, 9, 5], [0, 19, 6]]
    : [[-11, 22, 9], [11, 21, 9], [-5, 12, 10], [6, 10, 9], [0, 22, 10], [0, 5, 7]];
  trunk(cx - Math.round(1.5 * k), base - Math.round(16 * k), Math.round(3 * k));
  if (v === 5) { p.line(cx - 1, base - 18, cx - 8, base - 28, C.woodDark); p.line(cx + 2, base - 20, cx + 8, base - 30, C.woodDark); }
  const yk = v === 5 ? 1 : 1;
  for (const [dx, dy, r] of blobs) {
    const bx = cx + dx, by = (v === 5 ? 2 : 0) + dy * yk;
    p.ellipse(bx, by, r, r * 0.88, (x, y) => leaf(x, y, bx, by));
  }
  p.outline(C.outline, 0.3);
}

function drawFish(p: PixelCanvas, v: number) {
  const ring = rgb(0x8ab8e0), deep = rgb(0x1e4a7e), fish = rgb(0x3a6a8a);
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    if (md(a, 8) > 4) continue; // dashed ripple
    p.set(Math.round(13 + Math.cos(t) * 11), Math.round(7 + Math.sin(t) * 4.5), ring, 190);
  }
  const dir = v ? -1 : 1;
  p.ellipse(13, 7, 5.5, 2.2, deep);
  p.ellipse(13 + dir, 6.6, 4, 1.3, fish);
  p.poly([[13 - 5 * dir, 7], [13 - 9 * dir, 4], [13 - 9 * dir, 10]], deep);
  p.set(13 + 3 * dir, 6, rgb(0xd0e8f8));
  p.line(13, 5, 13 - 2 * dir, 4, deep);
  p.set(5, 4, rgb(0xffffff)); p.set(20, 10, rgb(0xffffff));
}

// ---- projectiles

/** Anchored at the centre, pointing right; the renderer rotates it. */
export function projectilePic(kind: "arrow" | "stone" | "bolt" | "spear"): Pic {
  switch (kind) {
    case "stone":
      return pic("pj-stone", 6, 6, 0.5, 0.5, (p) => {
        p.ellipse(3, 3, 2.2, 2, (x, y) => (x + y < 5 ? lighten(C.stone, 0.2) : C.stoneDark));
        p.outline(C.outline, 0.2);
      });
    case "bolt":
      return pic("pj-bolt", 16, 5, 0.5, 0.5, (p) => {
        p.rect(2, 2, 11, 1, C.woodDark); p.rect(3, 1, 9, 1, C.wood);
        p.rect(12, 1, 2, 3, C.iron); p.set(14, 2, C.ironLight);
        p.rect(1, 0, 2, 1, C.white); p.rect(1, 4, 2, 1, C.white);
      });
    case "spear":
      return pic("pj-spear", 18, 3, 0.5, 0.5, (p) => {
        p.rect(0, 1, 15, 1, C.wood); p.rect(15, 0, 2, 3, C.iron); p.set(17, 1, C.ironLight);
      });
    default:
      return pic("pj-arrow", 11, 3, 0.5, 0.5, (p) => {
        p.rect(1, 1, 8, 1, C.woodLight); p.set(9, 1, C.iron); p.set(10, 1, C.ironDark); p.set(8, 0, C.ironDark); p.set(8, 2, C.ironDark);
        p.set(0, 0, C.white); p.set(1, 0, C.white); p.set(0, 2, C.white); p.set(1, 2, C.white);
      });
  }
}

// =====================================================================================
// ---- buildings
//
// Buildings are drawn in footprint tile coordinates (u along map x, v along map y, z up in art px),
// projected 2:1 isometric. The canvas bottom is the footprint's bottom vertex.

type Pt = [number, number];
type P3 = [number, number, number];
type Pattern = (a: number, h: number, x: number, y: number) => number | RGB;
interface Mat { c: RGB; pat: Pattern }
const M = (c: number | RGB, pat: Pattern = () => 1): Mat => ({ c: typeof c === "number" ? rgb(c) : c, pat });
/** Left faces are lit, right faces in shade, tops brightest. */
const FACE_K = [1, 0.74, 1.1];
function tex(m: Mat, a: number, h: number, x: number, y: number, f: number): RGB {
  const r = m.pat(a, h, x, y);
  const c = typeof r === "number" ? darken(m.c, r) : r;
  return darken(c, FACE_K[f]);
}

const PAT = {
  mud: (_a: number, h: number, x: number, y: number) => (md(h, 3) === 0 && hash(x >> 1, y, 1) < 0.5 ? 0.9 : hash(x, y, 2) < 0.07 ? 0.9 : 1),
  plaster: (_a: number, h: number, x: number, y: number) => (h < 1 ? 0.86 : hash(x, y, 3) < 0.05 ? 0.94 : 1),
  brick: (a: number, h: number) => {
    const r = Math.floor(h / 3);
    return md(h, 3) === 0 || md(a + (r & 1) * 3, 6) === 0 ? 0.8 : 0.96 + hash(Math.floor((a + (r & 1) * 3) / 6), r, 4) * 0.08;
  },
  blocks: (a: number, h: number) => {
    const r = Math.floor(h / 4);
    return md(h, 4) === 0 || md(a + (r & 1) * 4, 8) === 0 ? 0.8 : 0.94 + hash(Math.floor((a + (r & 1) * 4) / 8), r, 5) * 0.1;
  },
  big: (a: number, h: number) => {
    const r = Math.floor(h / 5);
    return md(h, 5) === 0 || md(a + (r & 1) * 5, 10) === 0 ? 0.78 : 0.93 + hash(Math.floor((a + (r & 1) * 5) / 10), r, 9) * 0.12;
  },
  marble: (a: number, h: number) => (md(h, 6) === 0 || md(a + (Math.floor(h / 6) & 1) * 8, 16) === 0 ? 0.9 : 1),
  planks: (a: number, _h: number, x: number, y: number) => (md(a, 3) === 0 ? 0.8 : hash(x, y >> 1, 6) < 0.15 ? 0.9 : 1),
  logs: (_a: number, h: number) => (md(h, 3) === 0 ? 0.72 : md(h, 3) === 1 ? 1.08 : 0.95),
  rubble: (a: number, h: number, x: number, y: number) => {
    const r = Math.floor(h / 3);
    return md(h, 3) === 0 || md(a + r * 2, 5) === 0 ? 0.74 : 0.9 + hash(Math.floor((a + r * 2) / 5), r, 12) * 0.2 - (hash(x, y, 13) < 0.06 ? 0.1 : 0);
  },
};
/** Timber posts every 8 px over plaster infill. */
const timber = (post: RGB, fill: RGB): Pattern => (a, h) => (md(a, 8) < 2 || md(h, 10) === 9 ? post : h < 1 ? darken(fill, 0.85) : fill);
/** Glazed brick with a few yellow rosettes. */
const glazed = (a: number, h: number): number | RGB => (md(h, 6) === 3 && md(a, 8) === 4 ? rgb(0xf0c84a) : PAT.brick(a, h));

type RoofKind = "thatch" | "hip" | "gable" | "flat" | "curved";
interface RMat { c: RGB; kind: "thatch" | "tile" | "flat" }
interface BKit {
  wall: Mat; base: Mat; top: Mat; roof: RoofKind; rmat: RMat; trim: RGB; band: Mat | null; col: Mat | null; cap: RGB;
  batter: number; arches: boolean; crenel: boolean; plinth: boolean; door: RGB; glaze: Mat | null; dome: boolean; tiers: boolean;
}

const kitCache = new Map<string, BKit>();
function kitFor(arch: Arch, age: number): BKit {
  const a = clamp(Math.round(age), 0, 3);
  const key = `${arch}${a}`;
  const hit = kitCache.get(key);
  if (hit) return hit;
  const base: BKit = {
    wall: M(C.mud, PAT.mud), base: M(0x8a8478, PAT.blocks), top: M(C.mud), roof: "thatch", rmat: { c: C.thatch, kind: "thatch" }, trim: C.woodDark,
    band: null, col: null, cap: C.wood, batter: 0, arches: false, crenel: false, plinth: false, door: rgb(0x3a2412), glaze: null, dome: false, tiers: false,
  };
  let k: BKit;
  if (a === 0) {
    const mud = { egyptian: 0xc8a468, greek: 0xa88c66, babylonian: 0xb47c52, asian: 0x8e6e4c, roman: 0xa48464 }[arch];
    const th = { egyptian: 0xd8bc6a, greek: 0xc8a454, babylonian: 0xd0aa5a, asian: 0xb09a58, roman: 0xc4a058 }[arch];
    k = { ...base, wall: M(mud, arch === "asian" ? PAT.planks : PAT.mud), top: M(mud), rmat: { c: rgb(th), kind: "thatch" } };
  } else if (arch === "egyptian") {
    const sand = M(0xdcc08a, a === 1 ? PAT.plaster : PAT.big);
    k = { ...base, wall: sand, top: M(0xe4cc98), base: M(0xc0a470, PAT.blocks), roof: "flat", rmat: { c: rgb(0xe4cc98), kind: "flat" }, trim: rgb(0x2f6aa8),
      band: a >= 2 ? M(0x2f6aa8, (x) => (md(x, 4) < 2 ? rgb(0x2f6aa8) : rgb(0xb84030))) : null,
      col: a >= 2 ? M(0xe0c890) : M(0x9a7046), cap: a >= 2 ? rgb(0x4a9a6a) : rgb(0x5a8a34), batter: a >= 2 ? 2 : 0, plinth: a >= 2, door: rgb(0x2a1a0e) };
  } else if (arch === "greek") {
    const wall = a === 1 ? M(0xece4d0, PAT.plaster) : M(0xeae6dc, PAT.marble);
    k = { ...base, wall, top: M(0xf2eee6), base: M(0xd8d2c4, PAT.blocks), roof: "gable", rmat: { c: rgb(0xb85a38), kind: "tile" }, trim: a >= 2 ? rgb(0x3a5aa0) : rgb(0x8a4a2a),
      col: a === 1 ? M(0xe0d8c4) : M(0xf4f0e8), cap: rgb(0xf4f0e8), plinth: a >= 2, door: rgb(0x3a2412) };
  } else if (arch === "babylonian") {
    const wall = a === 1 ? M(0xc0905c, PAT.brick) : M(0xb07450, PAT.brick);
    k = { ...base, wall, top: M(0xc8a070), base: M(0x9a6a44, PAT.brick), roof: "flat", rmat: { c: rgb(0xc8a070), kind: "flat" }, trim: rgb(0x2a5ea8),
      band: a >= 2 ? M(0x2e64b0, glazed) : null, glaze: a >= 2 ? M(0x2e64b0, glazed) : null, crenel: true, plinth: a >= 2, tiers: a >= 3, door: rgb(0x1e2a4a), col: a >= 3 ? M(0x2e64b0) : null, cap: C.gold };
  } else if (arch === "asian") {
    const post = a === 1 ? C.woodDark : rgb(0xa8302a);
    k = { ...base, wall: M(0xdcd0b4, timber(post, rgb(0xdcd0b4))), top: M(0x8a8478), base: M(0x8a8478, PAT.blocks), roof: "curved",
      rmat: { c: a === 1 ? rgb(0x6a6058) : rgb(0x4e5a5e), kind: "tile" }, trim: a >= 2 ? rgb(0xa8302a) : C.woodDark,
      col: M(post), cap: a >= 3 ? C.gold : post, plinth: a >= 2, tiers: a >= 3, door: rgb(0x5a1a14) };
  } else {
    const wall = a === 1 ? M(0xe0c8a0, PAT.plaster) : M(0xdccfb0, PAT.blocks);
    k = { ...base, wall, top: M(0xe6dcc4), base: M(0xc8bca0, PAT.blocks), roof: a === 1 ? "hip" : "gable", rmat: { c: rgb(0xb04a30), kind: "tile" },
      trim: rgb(0x8a2a20), col: M(0xf0ece2), cap: rgb(0xf0ece2), arches: a >= 2, plinth: a >= 2, dome: a >= 3, door: rgb(0x3a2412) };
  }
  kitCache.set(key, k);
  return k;
}

function roofTex(r: RMat, x: number, y: number, slope: number, k: number): RGB {
  const row = Math.floor(y - slope * x);
  let c = r.c;
  if (r.kind === "thatch") {
    const n = hash(x, Math.floor(row / 2), 6);
    c = n < 0.22 ? darken(c, 0.8) : n > 0.9 ? lighten(c, 0.14) : c;
    if (md(row, 4) === 0) c = darken(c, 0.88);
  } else if (r.kind === "tile") {
    const rr = Math.floor(row / 3);
    const seam = md(x + rr * 2, 4) === 0;
    c = md(row, 3) === 0 ? darken(c, 0.72) : seam ? darken(c, 0.84) : md(row, 3) === 1 ? lighten(c, 0.1) : c;
  } else if (hash(x, y, 8) < 0.06) c = darken(c, 0.92);
  return darken(c, k);
}

interface BOpts { z?: number; top?: Mat | null; bt?: number; upper?: boolean; record?: boolean }

/** A painter for one building picture. */
class Bld {
  readonly sc: number;
  readonly y0: number;
  readonly rough: boolean;
  readonly done: boolean;
  readonly frames: [number, number, number, number, number][] = [];
  constructor(readonly p: PixelCanvas, readonly n: number, size: number, readonly kit: BKit, readonly pc: RGB, readonly stage: number, readonly age: number, readonly arch: Arch) {
    this.sc = size / n;
    this.y0 = p.h - size * 16;
    this.rough = stage === 1;
    this.done = stage >= 2;
  }
  pt(u: number, v: number, z = 0): Pt { return [this.p.w / 2 + (u - v) * 16 * this.sc, this.y0 + (u + v) * 8 * this.sc - z * this.sc]; }
  pts(q: P3[]): Pt[] { return q.map(([u, v, z]) => this.pt(u, v, z)); }

  /** A wall quad; its first two points are the bottom edge, used to course the texture. */
  quad(q: P3[], m: Mat, f: number) {
    const s = this.pts(q);
    const [b0, b1] = s;
    const dx = b1[0] - b0[0];
    const slope = Math.abs(dx) < 0.01 ? 0 : (b1[1] - b0[1]) / dx;
    this.p.poly(s, (x, y) => tex(m, x, Math.floor(b0[1] + (x + 0.5 - b0[0]) * slope - y), x, y, f));
  }

  box(u0: number, v0: number, u1: number, v1: number, h: number, m: Mat, o: BOpts = {}) {
    const z = o.z ?? 0;
    const full = h;
    if (this.rough) { if (o.upper) return; h = Math.max(3, Math.round(h * 0.45)); }
    const b = (o.bt ?? 0) / 16 / this.sc;
    this.quad([[u0, v1, z], [u1, v1, z], [u1 - b, v1 - b, z + h], [u0 + b, v1 - b, z + h]], m, 0);
    this.quad([[u1, v1, z], [u1, v0, z], [u1 - b, v0 + b, z + h], [u1 - b, v1 - b, z + h]], m, 1);
    const top = this.pts([[u0 + b, v0 + b, z + h], [u1 - b, v0 + b, z + h], [u1 - b, v1 - b, z + h], [u0 + b, v1 - b, z + h]]);
    if (this.rough) {
      // Half-built: look into the shell.
      this.p.poly(top, (x, y) => (hash(x, y, 14) < 0.2 ? darken(C.earthDark, 0.8) : C.earthDark));
      const rim = lighten(m.c, 0.1);
      for (let i = 0; i < 4; i++) this.p.line(top[i][0], top[i][1], top[(i + 1) % 4][0], top[(i + 1) % 4][1], rim);
    } else if (o.top !== null) {
      const tm = o.top ?? m;
      this.p.poly(top, (x, y) => tex(tm, x, y * 2, x, y, 2));
      this.p.line(top[3][0], top[3][1], top[2][0], top[2][1], lighten(tm.c, 0.25));
    }
    if (o.record !== false && z <= 4 && !o.upper) this.frames.push([u0, v0, u1, v1, full + z]);
  }

  hip(u0: number, v0: number, u1: number, v1: number, z: number, rh: number, r: RMat, o = 0.12) {
    if (this.rough) return;
    const U0 = u0 - o, V0 = v0 - o, U1 = u1 + o, V1 = v1 + o, zr = z + rh;
    const A: P3 = [U0, V0, z], B: P3 = [U1, V0, z], Cn: P3 = [U1, V1, z], D: P3 = [U0, V1, z];
    let r0: P3, r1: P3;
    const faces: [P3[], number, number][] = [];
    if (U1 - U0 >= V1 - V0) {
      const m = (V0 + V1) / 2, d = (V1 - V0) / 2;
      r0 = [U0 + d, m, zr]; r1 = [U1 - d, m, zr];
      faces.push([[A, B, r1, r0], 0.86, 0.5], [[A, D, r0], 1.14, -0.5], [[D, Cn, r1, r0], 1, 0.5], [[B, Cn, r1], 0.72, -0.5]);
    } else {
      const m = (U0 + U1) / 2, d = (U1 - U0) / 2;
      r0 = [m, V0 + d, zr]; r1 = [m, V1 - d, zr];
      faces.push([[A, B, r0], 0.86, 0.5], [[A, D, r1, r0], 1.14, -0.5], [[D, Cn, r1], 1, 0.5], [[B, Cn, r1, r0], 0.72, -0.5]);
    }
    for (const [q, k, slope] of faces) this.p.poly(this.pts(q), (x, y) => roofTex(r, x, y, slope, k));
    const [dl, cn, br] = this.pts([D, Cn, B]);
    this.p.line(dl[0], dl[1], cn[0], cn[1], darken(r.c, 0.6));
    this.p.line(cn[0], cn[1], br[0], br[1], darken(r.c, 0.5));
    const [a, b] = this.pts([r0, r1]);
    this.p.line(a[0], a[1], b[0], b[1], lighten(r.c, 0.2));
  }

  /** A gable roof. Ridge along "v" puts the gable (pediment) on the lit left face. */
  gable(u0: number, v0: number, u1: number, v1: number, z: number, rh: number, r: RMat, axis: "u" | "v", ped: Mat, o = 0.1) {
    if (this.rough) return;
    const U0 = u0 - o, V0 = v0 - o, U1 = u1 + o, V1 = v1 + o, zr = z + rh;
    if (axis === "v") {
      const m = (u0 + u1) / 2;
      this.p.poly(this.pts([[U0, V0, z], [U0, V1, z], [m, V1, zr], [m, V0, zr]]), (x, y) => roofTex(r, x, y, -0.5, 1.12));
      this.quad([[u0, v1, z], [u1, v1, z], [m, v1, zr - 1]], ped, 0);
      if (this.age >= 2) this.p.poly(this.pts([[u0 + 0.25, v1, z + 1], [u1 - 0.25, v1, z + 1], [m, v1, zr - 3]]), darken(this.kit.trim, 1));
      this.p.poly(this.pts([[U1, V1, z], [U1, V0, z], [m, V0, zr], [m, V1, zr]]), (x, y) => roofTex(r, x, y, -0.5, 0.74));
      const [a, b, c] = this.pts([[U0, V1, z], [m, V1, zr], [U1, V1, z]]);
      this.p.line(a[0], a[1], b[0], b[1], darken(r.c, 0.7)); this.p.line(b[0], b[1], c[0], c[1], darken(r.c, 0.55));
      if (this.age >= 3) { this.p.rect(b[0] - 1, b[1] - 2, 2, 2, C.gold); this.p.set(a[0], a[1] - 1, C.gold); }
    } else {
      const m = (v0 + v1) / 2;
      this.p.poly(this.pts([[U0, V0, z], [U1, V0, z], [U1, m, zr], [U0, m, zr]]), (x, y) => roofTex(r, x, y, 0.5, 0.86));
      this.p.poly(this.pts([[U0, V1, z], [U1, V1, z], [U1, m, zr], [U0, m, zr]]), (x, y) => roofTex(r, x, y, 0.5, 1));
      this.quad([[u1, v1, z], [u1, v0, z], [u1, m, zr - 1]], ped, 1);
      const [a, b, c] = this.pts([[U1, V1, z], [U1, m, zr], [U1, V0, z]]);
      this.p.line(a[0], a[1], b[0], b[1], darken(r.c, 0.5)); this.p.line(b[0], b[1], c[0], c[1], darken(r.c, 0.5));
      const [d] = this.pts([[U0, m, zr]]);
      this.p.line(d[0], d[1], b[0], b[1], lighten(r.c, 0.2));
      const [e, f] = this.pts([[U0, V1, z], [U1, V1, z]]);
      this.p.line(e[0], e[1], f[0], f[1], darken(r.c, 0.6));
    }
  }

  /** A flat roof with a parapet, crenellated if the style wants it. */
  flat(u0: number, v0: number, u1: number, v1: number, z: number, m: Mat, ph = 2, cren = this.kit.crenel) {
    if (this.rough) return;
    const t = 0.1 / this.sc;
    this.p.poly(this.pts([[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]]), (x, y) => tex(this.kit.top, x, y, x, y, 2));
    if (ph <= 0) return;
    const o: BOpts = { z, record: false };
    this.box(u0, v0, u1, v0 + t, ph, m, o);
    this.box(u0, v0, u0 + t, v1, ph, m, o);
    if (cren) {
      const step = 0.25 / this.sc;
      for (let u = u0; u < u1 - 0.05; u += step) this.box(u, v1 - t, Math.min(u1, u + step * 0.55), v1, ph + 2, m, o);
      for (let v = v1 - step * 0.55; v > v0 - 0.01; v -= step) this.box(u1 - t, Math.max(v0, v), u1, v + step * 0.55, ph + 2, m, o);
    }
    this.box(u0, v1 - t, u1, v1, ph, m, o);
    this.box(u1 - t, v0, u1, v1, ph, m, o);
  }

  /** Curved roof with upturned eaves: a flat, wide lower hip under a steep upper hip. */
  curved(u0: number, v0: number, u1: number, v1: number, z: number, rh: number, r: RMat, o = 0.28) {
    if (this.rough) return;
    const d = Math.min(u1 - u0, v1 - v0) / 2;
    const lo = rh * 0.42;
    this.hip(u0, v0, u1, v1, z, lo * (d + o) / Math.max(0.01, d + o - 0.12), r, o);
    const zi = z + lo * (o / (d + o));
    this.hip(u0 + 0.12, v0 + 0.12, u1 - 0.12, v1 - 0.12, zi, rh - (zi - z), r, 0);
    const lift = darken(r.c, 0.6);
    for (const [u, v, sx] of [[u0 - o, v1 + o, -1], [u1 + o, v0 - o, 1], [u1 + o, v1 + o, 0]] as [number, number, number][]) {
      const [x, y] = this.pt(u, v, z);
      if (sx === 0) { this.p.set(x - 1, y - 1, lift); this.p.set(x, y - 1, lift); continue; }
      this.p.set(x + sx, y - 1, lift); this.p.set(x + 2 * sx, y - 2, lift); this.p.set(x + 2 * sx, y - 3, lighten(r.c, 0.2));
    }
  }

  roof(u0: number, v0: number, u1: number, v1: number, z: number, rh?: number, axis?: "u" | "v", kind = this.kit.roof) {
    const k = this.kit, d = Math.min(u1 - u0, v1 - v0) * this.sc;
    const ax = axis ?? (u1 - u0 >= v1 - v0 ? "u" : "v");
    switch (kind) {
      case "thatch": this.hip(u0, v0, u1, v1, z, rh ?? d * 7 + 4, k.rmat, 0.16); break;
      case "hip": this.hip(u0, v0, u1, v1, z, rh ?? d * 5 + 2, k.rmat, 0.12); break;
      case "gable": this.gable(u0, v0, u1, v1, z, rh ?? d * 4 + 3, k.rmat, ax, k.wall); break;
      case "curved": this.curved(u0, v0, u1, v1, z, rh ?? d * 6 + 4, k.rmat); break;
      default: this.flat(u0, v0, u1, v1, z, k.wall, 2); break;
    }
  }

  /** An opening on a face: side L is the face at v = fixed (centred on u = c), R the face at u = fixed. */
  opening(side: "L" | "R", c: number, fixed: number, z: number, w: number, h: number, col: RGB, round = false) {
    if (this.rough) return;
    const P = (t: number, zz: number): P3 => (side === "L" ? [t, fixed, zz] : [fixed, t, zz]);
    const a = c - w / 2, b = c + w / 2;
    this.p.poly(this.pts([P(a, z), P(b, z), P(b, z + h), P(a, z + h)]), col);
    if (round) this.p.poly(this.pts([P(a + w * 0.2, z + h), P(b - w * 0.2, z + h), P(b - w * 0.3, z + h + 1.6), P(a + w * 0.3, z + h + 1.6)]), col);
  }

  door(side: "L" | "R", c: number, fixed: number, z: number, h: number, w = 0.32) {
    const k = this.kit;
    this.opening(side, c, fixed, z, w + 0.1, h + 1, k.trim, k.arches || this.arch === "babylonian");
    this.opening(side, c, fixed, z, w, h, k.door, k.arches || this.arch === "babylonian");
  }

  windows(side: "L" | "R", a: number, b: number, fixed: number, z: number, n: number, h = 3) {
    for (let i = 0; i < n; i++) this.opening(side, a + ((i + 0.5) * (b - a)) / n, fixed, z, 0.12, h, rgb(0x2a1e14), this.kit.arches);
  }

  arcade(side: "L" | "R", a: number, b: number, fixed: number, z: number, h: number, n: number) {
    for (let i = 0; i < n; i++) this.opening(side, a + ((i + 0.5) * (b - a)) / n, fixed, z, ((b - a) / n) * 0.5, h, rgb(0x3a2c20), true);
  }

  /** A row of columns along the face line v = fixed (side L) or u = fixed (side R). */
  columns(side: "L" | "R", a: number, b: number, fixed: number, z: number, h: number, n: number, m: Mat, cap: RGB, w = 2) {
    if (this.rough) return;
    for (let i = 0; i < n; i++) {
      const t = a + ((i + 0.5) * (b - a)) / n;
      const [x, y] = side === "L" ? this.pt(t, fixed, z) : this.pt(fixed, t, z);
      const X = Math.round(x) - 1, Y = Math.round(y), H = Math.round(h * this.sc);
      this.p.rect(X, Y - H, w, H, m.c);
      this.p.rect(X + w - 1, Y - H, 1, H, darken(m.c, 0.72));
      if (w > 2) this.p.rect(X, Y - H, 1, H, lighten(m.c, 0.2));
      this.p.rect(X - 1, Y - 1, w + 2, 1, darken(m.c, 0.85));
      this.p.rect(X - 1, Y - H, w + 2, 2, cap);
      this.p.set(X + w, Y - H + 1, darken(cap, 0.7));
    }
  }

  /** A pole with a pennant in the player's colour. */
  flag(u: number, v: number, z: number, h = 10) {
    if (this.rough) return;
    const [x, y] = this.pt(u, v, z);
    const X = Math.round(x), Y = Math.round(y);
    this.p.rect(X, Y - h, 1, h, C.woodDark);
    this.p.rect(X + 1, Y - h, 5, 3, this.pc);
    this.p.rect(X + 1, Y - h + 3, 3, 1, darken(this.pc, 0.7));
    this.p.set(X + 5, Y - h + 2, darken(this.pc, 0.7));
  }

  /** A line along the top edge of a face, used for eave trims in the player's colour. */
  trim(side: "L" | "R", a: number, b: number, fixed: number, z: number, c: RGB, w = 1) {
    if (this.rough) return;
    for (let i = 0; i < w; i++) {
      const [p0, p1] = side === "L" ? this.pts([[a, fixed, z - i], [b, fixed, z - i]]) : this.pts([[fixed, a, z - i], [fixed, b, z - i]]);
      this.p.line(p0[0], p0[1], p1[0], p1[1], i ? darken(c, 0.8) : c);
    }
  }

  /** A band of a second material on both front faces of a box. */
  band(u0: number, v0: number, u1: number, v1: number, z: number, h: number, m: Mat) {
    if (this.rough) return;
    this.quad([[u0, v1, z], [u1, v1, z], [u1, v1, z + h], [u0, v1, z + h]], m, 0);
    this.quad([[u1, v1, z], [u1, v0, z], [u1, v0, z + h], [u1, v1, z + h]], m, 1);
  }

  cyl(u: number, v: number, z: number, R: number, h: number, m: Mat, top: Mat | null = null) {
    const full = h;
    if (this.rough) h = Math.max(3, Math.round(h * 0.45));
    const [cx, cy] = this.pt(u, v, z);
    const rx = R * 22.6 * this.sc, ry = rx / 2, H = h * this.sc;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      if (Math.abs(nx) > 1) continue;
      const off = ry * Math.sqrt(1 - nx * nx);
      const yb = cy + off, yt = cy - H + off;
      const k = 1.08 - 0.42 * ((nx + 1) / 2) - (nx < -0.75 ? 0.08 : 0);
      for (let y = Math.floor(yt); y < yb; y++) {
        const a = Math.round(Math.asin(nx) * rx * 1.4);
        this.p.set(x, y, darken(tex(m, a, Math.floor(yb - y), x, y, 0), k));
      }
    }
    const tm = this.rough ? M(C.earthDark) : top;
    if (tm) this.p.ellipse(cx, cy - H, rx, ry, (x, y) => tex(tm, x, y, x, y, 2));
    if (this.rough) this.p.ellipse(cx, cy - H, rx - 1.5, ry - 1, darken(C.earthDark, 0.8));
    if (!this.rough) {} else this.frames.push([u - R, v - R, u + R, v + R, full]);
  }

  cone(u: number, v: number, z: number, R: number, h: number, r: RMat) {
    if (this.rough) return;
    const [cx, cy] = this.pt(u, v, z);
    const rx = R * 22.6 * this.sc, ry = rx / 2, H = h * this.sc, ay = cy - H;
    for (let y = Math.floor(ay); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = x + 0.5 - cx, yy = y + 0.5;
        const inTri = yy >= ay && yy <= cy && Math.abs(dx) <= rx * ((yy - ay) / (cy - ay));
        const inEll = yy > cy && (dx / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1;
        if (!inTri && !inEll) continue;
        const nx = dx / rx;
        const k = 1.12 - 0.45 * ((nx + 1) / 2);
        const spoke = Math.floor((dx / Math.max(1, yy - ay)) * 9);
        this.p.set(x, y, roofTex(r, spoke * 3, y, 0, k));
      }
    }
    this.p.ellipse(cx, cy + 0.5, rx, 1, darken(r.c, 0.6));
    this.p.set(cx, ay, darken(r.c, 0.7));
  }

  dome(u: number, v: number, z: number, R: number, c: RGB, ribs = true) {
    if (this.rough) return;
    const [cx, cy] = this.pt(u, v, z);
    const rx = R * 22.6 * this.sc, ry = rx / 2, hz = rx * 0.85;
    const dark = darken(c, 0.55), light = lighten(c, 0.3);
    for (let y = Math.floor(cy - hz); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / (y + 0.5 < cy ? hz : ry);
        if (dx * dx + dy * dy > 1) continue;
        const up = y + 0.5 < cy ? -dy : 0;
        const lum = clamp(0.62 - 0.5 * dx + 0.3 * up, 0, 1);
        const band = Math.floor(lum * 4 + bayer(x, y) * 0.9) / 4;
        let col = band < 0.25 ? dark : band < 0.5 ? darken(c, 0.78) : band < 0.75 ? c : light;
        if (ribs && y + 0.5 < cy) {
          const w = Math.sqrt(Math.max(0.0001, 1 - dy * dy));
          const ang = Math.asin(clamp(dx / w, -1, 1));
          if (Math.abs(md(ang * 4, 1) - 0.5) > 0.42) col = darken(col, 0.82);
        }
        this.p.set(x, y, col);
      }
    }
    this.p.rect(cx - 1, cy - hz - 3, 2, 3, C.gold);
    this.p.set(cx - 1, cy - hz - 4, C.gold);
  }

  /** Scaffolding over every recorded wall box: poles, planks and a brace. */
  scaffold() {
    const wood = rgb(0xc89a62), woodD = rgb(0x7a5530);
    for (const [u0, v0, u1, v1, h] of this.frames) {
      const o = 0.1 / this.sc, top = h + 3;
      const runs: [P3, P3][] = [[[u0 - o, v1 + o, 0], [u1 + o, v1 + o, 0]], [[u1 + o, v1 + o, 0], [u1 + o, v0 - o, 0]]];
      for (const [a, b] of runs) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * this.sc;
        const n = Math.max(2, Math.round(len / 0.55));
        const at = (t: number, z: number): Pt => this.pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z);
        for (let i = 0; i <= n; i++) {
          const [x0, y0] = at(i / n, 0), [, y1] = at(i / n, top);
          this.p.line(x0, y0, x0, y1, woodD);
        }
        for (const z of [Math.round(h * 0.5), h]) {
          const [x0, y0] = at(0, z), [x1, y1] = at(1, z);
          this.p.line(x0, y0, x1, y1, wood);
          this.p.line(x0, y0 + 1, x1, y1 + 1, woodD);
        }
        const [bx0, by0] = at(0, 0), [bx1, by1] = at(1 / n, h * 0.5);
        this.p.line(bx0, by0, bx1, by1, wood);
      }
    }
  }
}

// ---- props

function propCrate(b: Bld, u: number, v: number, s = 0.22) {
  b.box(u, v, u + s, v + s, 4, M(C.woodLight, PAT.planks), { record: false });
}
function propLogs(b: Bld, u: number, v: number) {
  if (b.rough) return;
  for (let i = 0; i < 3; i++) {
    const [x, y] = b.pt(u + i * 0.05, v, i === 2 ? 3 : 0);
    const X = Math.round(x) + (i === 2 ? 2 : i * 4) - 4, Y = Math.round(y) - 2;
    b.p.rect(X, Y, 8, 3, C.wood); b.p.rect(X, Y + 2, 8, 1, C.woodDark); b.p.ellipse(X + 7.5, Y + 1.5, 1.5, 1.5, rgb(0xd0a060));
  }
}
function propStones(b: Bld, u: number, v: number, gold = false) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  const base = gold ? C.gold : C.stone, dark = gold ? C.goldDark : C.stoneDark;
  for (const [dx, dy, w] of [[-4, -2, 4], [0, -2, 4], [-2, -4, 4], [3, -1, 3]]) {
    b.p.rect(x + dx, y + dy, w, 2, base); b.p.rect(x + dx, y + dy + 2, w, 1, dark); b.p.set(x + dx, y + dy, lighten(base, 0.3));
  }
}
function propHay(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  b.p.ellipse(x, y - 2, 3.5, 2.6, (px, py) => (py < y - 3 ? lighten(C.thatch, 0.15) : px > x + 1 ? C.thatchDark : C.thatch));
  b.p.line(x - 3, y - 2, x + 3, y - 2, C.thatchDark);
}
function propTarget(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  b.p.line(x - 2, y, x - 1, y - 6, C.woodDark); b.p.line(x + 2, y, x + 1, y - 6, C.woodDark);
  b.p.ellipse(x, y - 8, 3.5, 4, C.thatch); b.p.ellipse(x, y - 8, 2.4, 2.8, C.white); b.p.ellipse(x, y - 8, 1.3, 1.5, C.red);
  b.p.line(x + 1, y - 9, x + 4, y - 11, C.woodLight);
}
function propDummy(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  b.p.rect(x, y - 12, 1, 12, C.woodDark); b.p.rect(x - 3, y - 9, 7, 1, C.wood);
  b.p.ellipse(x + 0.5, y - 7, 2, 3, C.thatch); b.p.ellipse(x + 0.5, y - 12, 1.5, 1.5, C.thatchDark);
}
function propRack(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  b.p.rect(x - 5, y - 5, 10, 1, C.woodDark); b.p.rect(x - 5, y - 5, 1, 5, C.woodDark); b.p.rect(x + 4, y - 5, 1, 5, C.woodDark);
  for (let i = -3; i <= 3; i += 2) { b.p.line(x + i, y, x + i + 1, y - 12, C.wood); b.p.set(x + i + 1, y - 13, C.iron); }
  b.p.ellipse(x - 6, y - 3, 2, 2.5, b.pc); b.p.ellipse(x + 6, y - 3, 2, 2.5, b.pc);
}
function propPalm(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  for (let i = 0; i < 16; i++) b.p.rect(x + Math.round(Math.sin(i / 7) * 2), y - i, 2, 1, i % 3 ? rgb(0x9a7046) : C.woodDark);
  const tx = x + 2, ty = y - 17;
  for (const [dx, dy] of [[-7, 3], [-5, -3], [0, -5], [5, -3], [7, 3], [-2, 5], [3, 5]]) {
    for (let i = 0; i <= 7; i++) { const t = i / 7; b.p.set(Math.round(tx + dx * t), Math.round(ty + dy * t + Math.abs(dx) * 0.4 * t * t), t < 0.5 ? C.leafLight : C.leaf); }
  }
}
function propObelisk(b: Bld, u: number, v: number, h = 22) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  const X = Math.round(x), Y = Math.round(y), H = Math.round(h * b.sc);
  b.p.rect(X - 3, Y - 2, 6, 2, darken(rgb(0xd8b878), 0.8));
  b.p.poly([[X - 2, Y - 2], [X + 2, Y - 2], [X + 1.5, Y - H], [X - 1.5, Y - H]], (px) => (px < X ? rgb(0xe4c88a) : rgb(0xb0925e)));
  b.p.poly([[X - 1.5, Y - H], [X + 1.5, Y - H], [X, Y - H - 3]], C.gold);
  for (let i = 4; i < H - 3; i += 3) b.p.set(X - 1, Y - i, rgb(0x9a7a4a));
}
function propStatue(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  const X = Math.round(x), Y = Math.round(y);
  b.p.rect(X - 3, Y - 4, 6, 4, rgb(0xc8c2b4)); b.p.rect(X + 1, Y - 4, 2, 4, rgb(0x98928a));
  b.p.rect(X - 1, Y - 11, 3, 7, rgb(0xd8d2c4)); b.p.rect(X - 1, Y - 13, 2, 2, rgb(0xd8d2c4)); b.p.line(X + 2, Y - 10, X + 3, Y - 14, rgb(0xd8d2c4));
}
function propFire(b: Bld, u: number, v: number) {
  if (b.rough) return;
  const [x, y] = b.pt(u, v, 0);
  b.p.ellipse(x, y - 1, 3.5, 1.8, C.stoneDark);
  b.p.rect(x - 1, y - 4, 3, 3, rgb(0xe8902a)); b.p.set(x, y - 5, rgb(0xf8d040)); b.p.set(x, y - 3, rgb(0xfff0a0));
}
function propFence(b: Bld, a: P3, c: P3, tall = 5) {
  if (b.rough) return;
  const [x0, y0] = b.pt(a[0], a[1], 0), [x1, y1] = b.pt(c[0], c[1], 0);
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; b.p.rect(Math.round(x), Math.round(y) - tall, 1, tall, C.woodDark); }
  b.p.line(x0, y0 - tall + 1, x1, y1 - tall + 1, C.wood); b.p.line(x0, y0 - 2, x1, y1 - 2, C.wood);
}
function propPalisade(b: Bld, a: P3, c: P3, h = 8) {
  if (b.rough) return;
  const [x0, y0] = b.pt(a[0], a[1], 0), [x1, y1] = b.pt(c[0], c[1], 0);
  const n = Math.round(Math.abs(x1 - x0) / 2);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    b.p.rect(x, y - h, 2, h, i % 2 ? C.woodDark : C.wood); b.p.set(x, y - h - 1, C.woodDark);
  }
}
function propStall(b: Bld, u: number, v: number, w: number, goods: number) {
  if (b.rough) { b.box(u, v, u + w, v + w * 0.7, 3, M(C.woodLight, PAT.planks)); return; }
  const pc = b.pc, white = C.white;
  b.box(u + 0.05, v + 0.05, u + w - 0.05, v + w * 0.7 - 0.05, 4, M(C.woodLight, PAT.planks), { record: false });
  const goodsC = [C.berry, rgb(0xe0a030), rgb(0x6aa040), rgb(0xa86a3a)][goods % 4];
  for (let i = 0; i < 3; i++) { const [x, y] = b.pt(u + 0.15 + i * 0.15, v + 0.25, 4); b.p.rect(x, y - 2, 2, 2, goodsC); b.p.set(x, y - 2, lighten(goodsC, 0.3)); }
  for (const [pu, pv] of [[u, v + w * 0.7], [u + w, v + w * 0.7], [u + w, v]]) { const [x, y] = b.pt(pu, pv, 0); b.p.rect(x, y - 11, 1, 11, C.woodDark); }
  const q = b.pts([[u - 0.05, v - 0.05, 12], [u + w + 0.05, v - 0.05, 12], [u + w + 0.08, v + w * 0.7 + 0.1, 8], [u - 0.05, v + w * 0.7 + 0.1, 8]]);
  b.p.poly(q, (x) => (md(x, 6) < 3 ? pc : white));
  b.p.line(q[3][0], q[3][1], q[2][0], q[2][1], darken(pc, 0.6));
}

/** A Stone Age round hut: mud walls under a thatched cone. */
function hut(b: Bld, u: number, v: number, R: number, wall: number, roof: number) {
  b.cyl(u, v, 0, R, wall, b.kit.wall);
  if (!b.done) return;
  const [x, y] = b.pt(u, v, 0);
  const ry = R * 11.3 * b.sc;
  b.p.poly([[x + 1, y + ry - 1], [x + 5, y + ry - 2], [x + 5, y + ry - 9], [x + 1, y + ry - 8]], rgb(0x3a2412));
  b.cone(u, v, wall, R + 0.12, roof, b.kit.rmat);
}

/** A rectangular building in the current style: walls, details and a roof. */
function hall(b: Bld, u0: number, v0: number, u1: number, v1: number, h: number,
  o: { rh?: number; roof?: RoofKind; axis?: "u" | "v"; door?: "L" | "R" | null; win?: boolean; trim?: boolean; portico?: boolean; z?: number; mat?: Mat; upper?: boolean } = {}) {
  const k = b.kit;
  let z = o.z ?? 0;
  if (k.plinth && z === 0) { b.box(u0 - 0.08, v0 - 0.08, u1 + 0.08, v1 + 0.08, 2, k.base, { record: false }); z = 2; }
  const pv = o.portico && k.col ? v1 + 0.32 : v1;
  b.box(u0, v0, u1, v1, h, o.mat ?? k.wall, { z, bt: k.batter, upper: o.upper });
  if (!b.done) return;
  const bt = k.batter / 16 / b.sc;
  if (k.band) b.band(u0 + bt * 0.3, v0, u1 - bt * 0.3, v1 - bt * 0.3, z + h - 4, 2, k.band);
  if (k.arches && h >= 10) { b.arcade("L", u0 + 0.1, u1 - 0.1, v1, z + 1, h * 0.45, Math.max(2, Math.round((u1 - u0) * 2))); b.arcade("R", v0 + 0.1, v1 - 0.1, u1, z + 1, h * 0.45, Math.max(2, Math.round((v1 - v0) * 2))); }
  if (o.door !== null) {
    const side = o.door ?? "L";
    if (side === "L") b.door("L", (u0 + u1) / 2, v1 - bt, z, Math.min(h - 3, 9));
    else b.door("R", (v0 + v1) / 2, u1 - bt, z, Math.min(h - 3, 9));
  }
  if (o.win !== false && b.age >= 1 && h >= 10) {
    if (!k.arches) b.windows("R", v0 + 0.15, v1 - 0.15, u1 - bt, z + h - 6, Math.max(1, Math.round((v1 - v0) * 1.5)));
  }
  const zt = z + h;
  const U0 = u0 + bt, V0 = v0 + bt, U1 = u1 - bt, V1 = v1 - bt;
  if (o.portico && k.col) {
    const n = Math.max(3, Math.round((u1 - u0) * 2.5));
    b.box(u0, v1, u1, pv, 1, k.base, { z: z, record: false });
    b.columns("L", u0 + 0.05, u1 - 0.05, pv - 0.05, z + 1, h - 3, n, k.col, k.cap);
    b.box(u0, v1, u1, pv, 3, k.wall, { z: zt - 3, record: false, upper: true });
    b.trim("L", u0, u1, pv, zt - 2, b.pc);
  }
  const rk = o.roof ?? k.roof;
  if (rk === "flat") b.flat(U0, V0, U1, pv === v1 ? V1 : pv, zt, k.wall, 2);
  else b.roof(U0, V0, U1, pv, zt, o.rh, o.axis, rk);
  if (o.trim !== false && rk !== "flat" && b.age >= 1) {
    b.trim("L", U0 - 0.1, U1 + 0.1, pv + 0.1, zt, darken(b.pc, 1));
  }
}

/** A square tower with a cap in the current style. */
function towerTop(b: Bld, u0: number, v0: number, u1: number, v1: number, z: number) {
  const k = b.kit;
  if (k.roof === "flat" || b.age === 0 && b.arch === "babylonian") b.flat(u0, v0, u1, v1, z, k.wall, 2, true);
  else if (k.roof === "curved") b.curved(u0, v0, u1, v1, z, 12, k.rmat, 0.22);
  else b.hip(u0, v0, u1, v1, z, k.roof === "thatch" ? 12 : 10, k.rmat, 0.1);
}

const NOMINAL: Record<string, number> = {
  town_center: 3, house: 2, granary: 3, storage_pit: 3, barracks: 3, archery_range: 3, stable: 3, market: 3, farm: 3,
  government_center: 3, temple: 3, academy: 3, siege_workshop: 3, wonder: 5, watch_tower: 2, sentry_tower: 2, guard_tower: 2, ballista_tower: 2, dock: 3,
};
/** Art px above the footprint diamond needed by each building. */
const HEADROOM: Record<string, number> = { wonder: 120, town_center: 70, temple: 80, guard_tower: 80, ballista_tower: 90, sentry_tower: 70, watch_tower: 64, government_center: 64 };

const PLANS: Record<string, (b: Bld) => void> = {
  house(b) {
    if (b.age === 0) {
      hut(b, 1, 1, 0.5, 9, 15);
      b.flag(1, 1, 24, 8);
      propLogs(b, 1.65, 0.45);
      return;
    }
    hall(b, 0.35, 0.35, 1.6, 1.6, 11, { axis: "v" });
    if (!b.done) return;
    if (b.arch === "egyptian") {
      // A reed shade on the roof.
      const z = 13 + (b.kit.plinth ? 2 : 0);
      for (const [u, v] of [[0.5, 0.5], [1.0, 0.5], [0.5, 1.0], [1.0, 1.0]]) { const [x, y] = b.pt(u, v, z); b.p.rect(x, y - 6, 1, 6, C.woodDark); }
      b.p.poly(b.pts([[0.45, 0.45, z + 6], [1.05, 0.45, z + 6], [1.05, 1.05, z + 6], [0.45, 1.05, z + 6]]), (x) => (md(x, 4) < 2 ? b.pc : C.white));
      if (b.age >= 2) propPalm(b, 1.8, 0.25);
    }
    if (b.arch === "babylonian" && b.age >= 2) b.dome(0.75, 0.75, 13 + 2, 0.22, rgb(0x2e64b0), false);
  },

  town_center(b) {
    const k = b.kit;
    if (b.age === 0) {
      hut(b, 1.0, 1.0, 0.75, 14, 24);
      hut(b, 2.3, 0.75, 0.4, 9, 13);
      hut(b, 0.75, 2.3, 0.4, 9, 13);
      propFire(b, 2.1, 2.1);
      if (b.done) {
        const [x, y] = b.pt(2.55, 1.6, 0);
        b.p.rect(x, y - 22, 2, 22, C.woodDark); b.p.rect(x - 1, y - 18, 4, 2, C.red); b.p.rect(x - 1, y - 13, 4, 2, C.thatch);
        b.p.rect(x + 2, y - 22, 6, 4, b.pc); b.p.rect(x + 2, y - 18, 4, 1, darken(b.pc, 0.7));
      }
      b.flag(1.0, 1.0, 38, 10);
      return;
    }
    // A keep at the back, a hall in front.
    const grand = b.age >= 3;
    if (b.arch === "babylonian" && k.tiers) {
      b.box(0.5, 0.5, 2.5, 2.5, 14, k.wall);
      if (b.done) {
        b.band(0.5, 0.5, 2.5, 2.5, 10, 2, k.glaze!);
        b.flat(0.5, 0.5, 2.5, 2.5, 14, k.wall, 2, true);
        b.box(0.8, 0.8, 2.0, 2.0, 12, k.glaze!, { z: 14, upper: true });
        b.flat(0.8, 0.8, 2.0, 2.0, 26, k.wall, 2, true);
        b.door("L", 1.5, 2.5, 0, 9, 0.4);
        b.flag(1.4, 1.4, 28, 12);
      }
      return;
    }
    hall(b, 0.45, 0.45, 1.65, 1.65, grand ? 30 : 24, { door: null, win: true, axis: "v", upper: true });
    hall(b, 0.45, 1.65, 2.55, 2.55, 15, { axis: "u", portico: grand && b.arch !== "asian" });
    hall(b, 1.65, 0.45, 2.55, 1.65, 15, { door: "R", axis: "v" });
    if (!b.done) return;
    const zt = (k.plinth ? 2 : 0) + (grand ? 30 : 24);
    if (k.dome) b.dome(1.05, 1.05, zt + 1, 0.42, k.rmat.c);
    b.flag(1.05, 1.05, zt + (k.roof === "flat" ? 4 : 14), 12);
    b.flag(2.55, 1.65, 17, 9);
    if (b.arch === "egyptian" && b.age >= 2) { propObelisk(b, 0.25, 2.8, 20); propObelisk(b, 2.8, 0.3, 20); }
    if (b.arch === "egyptian") propPalm(b, 2.85, 2.6);
  },

  granary(b) {
    const k = b.kit;
    const silo = (u: number, v: number, R: number, h: number) => {
      b.cyl(u, v, 0, R, h, k.wall);
      if (!b.done) return;
      if (k.roof === "flat") b.dome(u, v, h, R, k.top.c, false);
      else if (k.roof === "curved") { b.cone(u, v, h, R + 0.1, 9, k.rmat); }
      else b.cone(u, v, h, R + 0.08, k.roof === "thatch" ? 12 : 8, k.rmat);
    };
    if (b.age === 0) {
      for (const [u, v] of [[0.85, 0.85], [2.1, 0.9], [0.9, 2.1], [2.1, 2.1]]) {
        if (b.done) for (const [du, dv] of [[-0.25, 0.25], [0.25, 0.25], [0.25, -0.25]]) { const [x, y] = b.pt(u + du, v + dv); b.p.rect(x, y - 4, 1, 4, C.woodDark); }
        b.cyl(u, v, 4, 0.36, 8, k.wall);
        if (b.done) b.cone(u, v, 12, 0.44, 11, k.rmat);
      }
      return;
    }
    silo(1.0, 0.75, 0.42, 16);
    silo(2.25, 0.85, 0.42, 16);
    hall(b, 0.35, 1.35, 1.75, 2.6, 12, { axis: "u" });
    silo(2.25, 2.15, 0.42, 16);
    if (b.done) { propCrate(b, 1.95, 1.4); propCrate(b, 1.95, 1.65); propHay(b, 2.7, 1.5); }
  },

  storage_pit(b) {
    const k = b.kit;
    if (b.age === 0) {
      if (b.done) {
        b.p.poly(b.pts([[0.9, 0.9, 0], [2.0, 0.9, 0], [2.0, 2.0, 0], [0.9, 2.0, 0]]), (x, y) => (hash(x, y, 3) < 0.2 ? darken(C.earthDark, 0.6) : darken(C.earthDark, 0.75)));
      }
      for (const [u, v] of [[0.4, 0.4], [1.4, 0.4], [0.4, 1.2], [1.4, 1.2]]) { if (b.done) { const [x, y] = b.pt(u, v); b.p.rect(x, y - 9, 1, 9, C.woodDark); } }
      if (b.done) b.hip(0.4, 0.4, 1.4, 1.2, 9, 6, k.rmat, 0.1);
      else b.box(0.4, 0.4, 1.4, 1.2, 4, k.wall);
      propLogs(b, 2.3, 0.7); propStones(b, 0.8, 2.4); propStones(b, 2.2, 2.0, true);
      propPalisade(b, [0.1, 2.9, 0], [2.9, 2.9, 0], 6); propPalisade(b, [2.9, 2.9, 0], [2.9, 0.1, 0], 6);
      return;
    }
    hall(b, 0.35, 0.35, 1.55, 1.55, 11, { axis: "v" });
    propLogs(b, 2.25, 0.75); propStones(b, 0.7, 2.25); propStones(b, 2.1, 1.9, true);
    propCrate(b, 1.8, 0.4); propCrate(b, 0.4, 1.8); propCrate(b, 0.62, 1.8);
    const lw: Mat = k.roof === "curved" ? M(C.woodLight, PAT.planks) : k.wall;
    b.box(0.1, 2.8, 2.9, 2.92, 4, lw, { record: false });
    b.box(2.8, 0.1, 2.92, 2.8, 4, lw, { record: false });
  },

  barracks(b) {
    const k = b.kit;
    if (b.age === 0) {
      b.box(0.4, 0.5, 2.6, 1.5, 9, M(C.wood, PAT.logs));
      if (b.done) { b.hip(0.4, 0.5, 2.6, 1.5, 9, 12, k.rmat, 0.15); b.door("L", 1.5, 1.5, 0, 6); }
      propRack(b, 1.0, 2.2); propDummy(b, 2.2, 2.2);
      propPalisade(b, [0.1, 2.9, 0], [2.9, 2.9, 0], 7);
      b.flag(1.5, 1.0, 21, 10);
      return;
    }
    hall(b, 0.4, 0.45, 2.6, 1.6, 16, { axis: "u", portico: b.age >= 3 && (b.arch === "greek" || b.arch === "roman") });
    hall(b, 0.4, 1.6, 1.3, 2.6, 12, { axis: "v", door: "R" });
    propRack(b, 1.85, 2.45); propDummy(b, 2.55, 2.0);
    if (!b.done) return;
    for (const u of [0.8, 1.6, 2.3]) { const [x, y] = b.pt(u, b.age >= 3 && (b.arch === "greek" || b.arch === "roman") ? 1.92 : 1.6, 10); b.p.ellipse(x, y, 2, 2.4, b.pc); b.p.set(x, y, C.bronze); }
    b.flag(2.6, 0.45, (k.plinth ? 2 : 0) + 16, 10);
  },

  archery_range(b) {
    const k = b.kit;
    if (b.age === 0) {
      for (const [u, v] of [[0.4, 0.4], [1.3, 0.4], [0.4, 2.6], [1.3, 2.6]]) { if (b.done) { const [x, y] = b.pt(u, v); b.p.rect(x, y - 10, 1, 10, C.woodDark); } }
      if (b.done) b.hip(0.4, 0.4, 1.3, 2.6, 10, 8, k.rmat, 0.12); else b.box(0.4, 0.4, 1.3, 2.6, 4, k.wall);
    } else hall(b, 0.4, 0.4, 1.35, 2.6, 13, { axis: "v", door: "R" });
    propFence(b, [1.6, 0.15, 0], [2.85, 0.15, 0], 4);
    propTarget(b, 2.4, 0.8); propTarget(b, 2.45, 1.7);
    propFence(b, [2.85, 0.15, 0], [2.85, 2.85, 0], 4);
    propHay(b, 1.75, 2.6);
    b.flag(0.4, 2.6, (k.plinth ? 2 : 0) + 13, 10);
  },

  stable(b) {
    const k = b.kit;
    const h = b.age === 0 ? 9 : 13;
    if (b.age === 0) {
      b.box(0.4, 0.4, 2.6, 1.4, h, M(C.wood, PAT.logs));
      if (b.done) b.hip(0.4, 0.4, 2.6, 1.4, h, 10, k.rmat, 0.15);
    } else hall(b, 0.4, 0.4, 2.6, 1.4, h, { axis: "u", door: null, win: false });
    if (b.done) {
      const z = b.age > 0 && k.plinth ? 2 : 0;
      for (let i = 0; i < 4; i++) {
        const u = 0.6 + i * 0.55;
        b.opening("L", u, 1.4, z, 0.32, 7, rgb(0x2a1a0e), k.arches);
        if (i % 2 === 0) { const [x, y] = b.pt(u, 1.4, z + 5); b.p.rect(x - 1, y - 1, 3, 3, rgb(0x7a4e2a)); b.p.set(x + 2, y + 1, rgb(0x52321a)); b.p.set(x - 1, y - 2, rgb(0x3b2414)); }
      }
    }
    propHay(b, 0.75, 1.9); propHay(b, 1.1, 1.95);
    propFence(b, [0.25, 2.8, 0], [2.8, 2.8, 0]);
    propFence(b, [2.8, 2.8, 0], [2.8, 1.6, 0]);
    if (b.done) { const [x, y] = b.pt(2.0, 2.2); b.p.rect(x - 4, y - 2, 8, 2, C.woodDark); b.p.rect(x - 3, y - 2, 6, 1, rgb(0x5a8ccc)); }
    b.flag(2.6, 0.4, h + 2, 10);
  },

  market(b) {
    if (b.age === 0) hut(b, 1.0, 1.0, 0.5, 9, 14);
    else hall(b, 0.45, 0.45, 1.6, 1.6, 13, { axis: "v" });
    propStall(b, 2.0, 0.55, 0.7, 0);
    propStall(b, 0.55, 2.0, 0.7, 1);
    propStall(b, 1.95, 1.95, 0.7, 2);
    if (b.done) { const [x, y] = b.pt(1.75, 1.8); b.p.ellipse(x, y - 2, 2, 2.5, rgb(0xb0603a)); b.p.ellipse(x + 4, y - 1, 1.6, 2, rgb(0xc87a4a)); }
    b.flag(1.0, 1.0, b.age === 0 ? 23 : 15 + (b.kit.plinth ? 2 : 0) + (b.kit.roof === "flat" ? 0 : 10), 10);
  },

  farm() { /* drawn separately */ },

  government_center(b) {
    const k = b.kit;
    if (b.age === 0) {
      b.box(0.5, 0.5, 2.5, 2.0, 12, M(C.wood, PAT.logs));
      if (b.done) { b.hip(0.5, 0.5, 2.5, 2.0, 12, 16, k.rmat, 0.15); b.door("L", 1.5, 2.0, 0, 8); }
      for (const u of [0.6, 2.4]) if (b.done) { const [x, y] = b.pt(u, 2.6); b.p.rect(x, y - 16, 2, 16, C.woodDark); b.p.rect(x - 1, y - 14, 4, 2, C.red); b.p.rect(x + 2, y - 16, 5, 3, b.pc); }
      return;
    }
    hall(b, 0.5, 0.4, 2.5, 2.1, 20, { axis: "v", portico: true, door: "L" });
    if (!b.done) return;
    const zt = (k.plinth ? 2 : 0) + 20;
    if (k.dome) b.dome(1.5, 1.2, zt + 1, 0.6, k.rmat.c);
    if (k.tiers && k.roof === "flat") { b.box(0.9, 0.7, 2.1, 1.7, 9, k.glaze ?? k.wall, { z: zt, upper: true }); b.flat(0.9, 0.7, 2.1, 1.7, zt + 9, k.wall, 2, true); }
    if (k.tiers && k.roof === "curved") { b.box(1.0, 0.8, 2.0, 1.7, 8, k.wall, { z: zt + 4, upper: true }); b.curved(1.0, 0.8, 2.0, 1.7, zt + 12, 10, k.rmat, 0.2); }
    propStatue(b, 0.3, 2.85); propStatue(b, 2.75, 2.85);
    b.flag(2.5, 0.4, zt + 2, 12);
    if (b.arch === "egyptian") { propObelisk(b, 0.25, 2.55, 18); propObelisk(b, 2.8, 2.55, 18); }
  },

  temple(b) {
    const k = b.kit;
    const z0 = k.plinth ? 2 : 0;
    if (b.age === 0) {
      if (b.done) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const [x, y] = b.pt(1.5 + Math.cos(a) * 1.05, 1.5 + Math.sin(a) * 1.05);
          b.p.rect(x - 1, y - 11, 3, 11, C.stone); b.p.rect(x + 1, y - 11, 1, 11, C.stoneDark); b.p.rect(x - 1, y - 11, 3, 1, lighten(C.stone, 0.2));
        }
        b.box(1.3, 1.3, 1.7, 1.7, 4, M(C.stone, PAT.rubble));
        propFire(b, 1.55, 1.55);
      } else b.box(1.2, 1.2, 1.8, 1.8, 4, M(C.stone, PAT.rubble));
      return;
    }
    if (b.age === 1) {
      b.box(0.5, 0.5, 2.5, 2.5, 3, k.base);
      hall(b, 0.85, 0.75, 2.15, 2.25, 14, { z: 3, axis: "v", portico: true });
      b.flag(2.15, 0.75, 20, 10);
      return;
    }
    switch (b.arch) {
      case "egyptian": {
        hall(b, 0.6, 0.4, 2.4, 1.6, 16, { door: null });
        // The pylon: two battered towers flanking a gate, with flag masts.
        b.box(0.3, 1.7, 1.25, 2.45, 26, k.wall, { bt: 4 });
        b.box(1.25, 1.8, 1.85, 2.35, 18, k.wall, { bt: 1 });
        b.box(1.85, 1.7, 2.8, 2.45, 26, k.wall, { bt: 4 });
        if (!b.done) return;
        b.door("L", 1.55, 2.35, 0, 12, 0.32);
        for (const [a, c] of [[0.3, 1.25], [1.85, 2.8]]) { b.trim("L", a + 0.25, c - 0.25, 2.2, 24, rgb(0x2f6aa8)); b.trim("L", a + 0.25, c - 0.25, 2.2, 22, rgb(0xb84030)); }
        b.flag(0.55, 2.5, 0, 34); b.flag(2.55, 2.5, 0, 34);
        propObelisk(b, 0.75, 2.85, 22); propObelisk(b, 2.35, 2.85, 22);
        return;
      }
      case "babylonian": {
        const g = k.glaze ?? k.wall;
        b.box(0.3, 0.3, 2.7, 2.7, 12, k.wall);
        if (!b.done) return;
        b.flat(0.3, 0.3, 2.7, 2.7, 12, k.wall, 2, true);
        b.box(0.7, 0.7, 2.3, 2.3, 11, k.wall, { z: 12 });
        b.band(0.7, 0.7, 2.3, 2.3, 18, 3, g);
        b.flat(0.7, 0.7, 2.3, 2.3, 23, k.wall, 2, true);
        b.box(1.1, 1.1, 1.9, 1.9, 10, g, { z: 23 });
        b.flat(1.1, 1.1, 1.9, 1.9, 33, g, 2, true);
        // Stairs up the front.
        b.quad([[1.3, 2.7, 0], [1.7, 2.7, 0], [1.7, 2.3, 12], [1.3, 2.3, 12]], M(0xd8b07a, (_a, h) => (md(h, 2) ? 1 : 0.75)), 0);
        b.door("L", 1.5, 1.9, 23, 6, 0.24);
        b.flag(1.5, 1.5, 35, 12);
        return;
      }
      case "asian": {
        b.box(0.4, 0.4, 2.6, 2.6, 3, k.base);
        b.box(0.75, 0.75, 2.25, 2.25, 11, k.wall, { z: 3 });
        if (!b.done) return;
        b.door("L", 1.5, 2.25, 3, 8);
        b.curved(0.75, 0.75, 2.25, 2.25, 14, 10, k.rmat, 0.35);
        b.box(1.0, 1.0, 2.0, 2.0, 8, k.wall, { z: 18 });
        b.curved(1.0, 1.0, 2.0, 2.0, 26, 9, k.rmat, 0.3);
        b.box(1.2, 1.2, 1.8, 1.8, 7, k.wall, { z: 31 });
        b.curved(1.2, 1.2, 1.8, 1.8, 38, 9, k.rmat, 0.25);
        const [x, y] = b.pt(1.5, 1.5, 47);
        b.p.rect(x - 1, y - 7, 1, 8, C.gold); b.p.rect(x - 2, y - 4, 3, 1, C.goldDark); b.p.rect(x - 2, y - 2, 3, 1, C.goldDark);
        b.flag(2.6, 2.6, 3, 12);
        return;
      }
      case "roman": {
        if (b.age >= 3) {
          b.box(0.3, 0.3, 2.7, 2.7, 2, k.base);
          b.cyl(1.35, 1.35, 2, 0.95, 18, M(0xdccfb0, (a, h) => (md(h, 9) > 2 && md(h, 9) < 8 && md(a, 8) > 2 && md(a, 8) < 6 ? rgb(0x4a3a2a) : PAT.blocks(a, h))));
          if (!b.done) return;
          b.dome(1.35, 1.35, 20, 0.95, rgb(0xb04a30));
          b.box(0.9, 2.2, 2.2, 2.75, 1, k.base, { z: 2, record: false });
          b.columns("L", 0.95, 2.15, 2.7, 3, 14, 5, k.col!, k.cap);
          b.gable(0.9, 2.1, 2.2, 2.75, 17, 7, k.rmat, "v", k.wall);
          b.flag(2.6, 0.5, 2, 14);
          return;
        }
        break;
      }
      default: break;
    }
    // Greek (and Roman Bronze Age): a peripteral temple on a stepped base.
    b.box(0.25, 0.25, 2.75, 2.75, 2, k.base, { record: false });
    b.box(0.35, 0.35, 2.65, 2.65, 2, k.base, { z: 2 });
    const n = 6, H = 18, z = 4;
    if (!b.done) { b.box(0.8, 0.6, 2.2, 2.4, 14, k.wall, { z }); return; }
    b.columns("R", 0.55, 2.45, 0.5, z, H, n, k.col!, k.cap);
    b.columns("L", 0.55, 2.45, 0.5, z, H, n, k.col!, k.cap);
    b.box(0.8, 0.7, 2.2, 2.3, H, darken(k.wall.c, 1) ? M(darken(k.wall.c, 0.85), k.wall.pat) : k.wall, { z });
    b.door("L", 1.5, 2.3, z, 9, 0.4);
    b.columns("L", 0.55, 2.45, 2.5, z, H, n, k.col!, k.cap);
    b.columns("R", 0.55, 2.3, 2.5, z, H, n - 1, k.col!, k.cap);
    b.box(0.45, 0.45, 2.55, 2.55, 3, k.wall, { z: z + H - 3, record: false, top: null });
    b.trim("L", 0.45, 2.55, 2.55, z + H - 1, b.age >= 3 ? b.pc : k.trim);
    b.trim("R", 0.45, 2.55, 2.55, z + H - 1, b.age >= 3 ? darken(b.pc, 0.8) : darken(k.trim, 0.8));
    b.gable(0.45, 0.45, 2.55, 2.55, z + H, 11, k.rmat, "v", k.wall);
    b.flag(2.5, 0.5, z + H + 6, 10);
    void z0;
  },

  academy(b) {
    const k = b.kit;
    if (b.age === 0) {
      hut(b, 1.0, 1.0, 0.5, 9, 13);
      propDummy(b, 2.2, 1.4); propDummy(b, 2.4, 2.2); propRack(b, 1.4, 2.4);
      return;
    }
    hall(b, 0.4, 0.4, 2.6, 1.3, 14, { axis: "u", portico: true, door: "L" });
    hall(b, 0.4, 1.7, 1.2, 2.6, 12, { axis: "v", door: "R" });
    propStatue(b, 2.05, 2.15);
    propDummy(b, 2.6, 1.9); propDummy(b, 1.6, 2.6);
    b.flag(2.6, 0.4, (k.plinth ? 2 : 0) + 16, 10);
  },

  siege_workshop(b) {
    const k = b.kit;
    const wood = b.age <= 1 ? M(C.wood, PAT.planks) : k.wall;
    hall(b, 0.4, 0.4, 2.3, 2.1, 17, { axis: "v", door: null, mat: wood });
    if (b.done) {
      const z = k.plinth ? 2 : 0;
      b.opening("L", 1.35, 2.1, z, 0.9, 12, darken(C.dark, 1), false);
      b.opening("L", 1.35, 2.1, z + 12, 1.0, 1, C.woodDark, false);
      const [x, y] = b.pt(1.35, 2.1, z);
      b.p.line(x - 6, y - 2, x + 4, y - 9, C.wood); // a beam half out of the door
    }
    propLogs(b, 2.55, 0.6); propLogs(b, 2.6, 1.0);
    if (b.done) {
      const [x, y] = b.pt(2.6, 2.3);
      b.p.ellipse(x, y - 5, 2.5, 5, C.woodDark); b.p.ellipse(x, y - 5, 1.3, 3.6, rgb(0x3a2412)); b.p.line(x, y - 9, x, y - 1, C.wood);
      const [x2, y2] = b.pt(1.9, 2.75);
      b.p.thick(x2 - 8, y2 - 2, x2 + 6, y2 - 6, C.wood, 2); b.p.ellipse(x2 + 7, y2 - 7, 2, 1.4, C.leatherDark);
    }
    b.flag(2.3, 0.4, (k.plinth ? 2 : 0) + 17 + 12, 10);
  },

  watch_tower(b) {
    const k = b.kit;
    const z = 22;
    if (b.rough) { b.box(0.6, 0.6, 1.4, 1.4, 22, M(C.wood, PAT.planks)); return; }
    for (const [u, v] of [[0.6, 0.6], [1.4, 0.6], [0.6, 1.4], [1.4, 1.4]]) { const [x, y] = b.pt(u, v); b.p.rect(x - 1, y - z, 2, z, u + v > 2.5 ? C.woodDark : C.wood); }
    const [l0, l1] = b.pts([[0.6, 1.4, 2], [1.4, 1.4, z - 2]]); b.p.line(l0[0], l0[1], l1[0], l1[1], C.woodDark);
    const [r0, r1] = b.pts([[1.4, 1.4, 2], [1.4, 0.6, z - 2]]); b.p.line(r0[0], r0[1], r1[0], r1[1], darken(C.woodDark, 0.8));
    b.box(0.5, 0.5, 1.5, 1.5, 3, M(C.woodLight, PAT.planks), { z, record: false });
    b.box(0.6, 0.6, 1.4, 1.4, 7, b.age === 0 ? M(C.wood, PAT.logs) : k.roof === "curved" ? k.wall : M(C.woodLight, PAT.planks), { z: z + 3, record: false });
    b.windows("L", 0.7, 1.3, 1.4, z + 6, 2, 3);
    towerTop(b, 0.6, 0.6, 1.4, 1.4, z + 10);
    b.flag(1.0, 1.0, z + 10 + (k.roof === "flat" ? 3 : 10), 9);
  },

  sentry_tower(b) {
    const k = b.kit;
    const stone = b.age === 0 ? M(C.stone, PAT.rubble) : k.roof === "curved" ? k.base : k.wall;
    b.box(0.5, 0.5, 1.5, 1.5, 18, stone, { bt: 1 });
    if (!b.done) return;
    b.box(0.5, 0.5, 1.5, 1.5, 12, k.roof === "curved" ? k.wall : M(C.woodLight, PAT.planks), { z: 18, record: false });
    b.windows("L", 0.65, 1.35, 1.5, 22, 2, 4); b.windows("R", 0.65, 1.35, 1.5, 22, 2, 4);
    towerTop(b, 0.5, 0.5, 1.5, 1.5, 30);
    b.flag(1.0, 1.0, 30 + (k.roof === "flat" ? 4 : 11), 10);
  },

  guard_tower(b) {
    const k = b.kit;
    const stone = k.roof === "curved" ? k.base : b.age === 0 ? M(C.stone, PAT.rubble) : k.wall;
    b.box(0.45, 0.45, 1.55, 1.55, 36, stone, { bt: 2 });
    if (!b.done) return;
    if (k.band) b.band(0.5, 0.5, 1.5, 1.5, 28, 2, k.band);
    b.windows("L", 0.7, 1.3, 1.45, 14, 2, 4); b.windows("R", 0.7, 1.3, 1.45, 24, 2, 4);
    b.box(0.4, 0.4, 1.6, 1.6, 3, stone, { z: 36, record: false });
    if (k.roof === "flat" || k.roof === "gable" && b.arch === "greek" && b.age < 2) b.flat(0.4, 0.4, 1.6, 1.6, 39, stone, 2, true);
    else towerTop(b, 0.4, 0.4, 1.6, 1.6, 39);
    b.flag(1.0, 1.0, 39 + (k.roof === "flat" ? 4 : 12), 11);
  },

  ballista_tower(b) {
    const k = b.kit;
    const stone = k.roof === "curved" ? k.base : b.age === 0 ? M(C.stone, PAT.rubble) : k.wall;
    b.box(0.45, 0.45, 1.55, 1.55, 42, stone, { bt: 2 });
    if (!b.done) return;
    if (k.band) b.band(0.5, 0.5, 1.5, 1.5, 30, 2, k.band);
    b.windows("L", 0.7, 1.3, 1.45, 16, 2, 4); b.windows("R", 0.7, 1.3, 1.45, 28, 2, 4);
    b.box(0.35, 0.35, 1.65, 1.65, 4, stone, { z: 42, record: false });
    b.flat(0.35, 0.35, 1.65, 1.65, 46, stone, 2, true);
    // The bolt thrower on top.
    const [x, y] = b.pt(1.0, 1.0, 48);
    const X = Math.round(x), Y = Math.round(y);
    b.p.rect(X - 6, Y - 3, 13, 2, C.woodDark); b.p.rect(X + 4, Y - 7, 3, 8, C.woodDark); b.p.rect(X + 5, Y - 6, 1, 6, rgb(0x5a4a3a));
    b.p.line(X + 5, Y - 7, X, Y - 11, C.wood); b.p.line(X + 5, Y + 1, X, Y + 3, C.wood);
    b.p.line(X, Y - 11, X - 4, Y - 3, rgb(0xe8e0c8)); b.p.line(X, Y + 3, X - 4, Y - 3, rgb(0xe8e0c8));
    b.p.line(X - 4, Y - 4, X + 10, Y - 4, C.woodLight); b.p.rect(X + 10, Y - 5, 2, 2, C.iron);
    b.flag(0.5, 0.5, 48, 12);
  },

  wonder(b) {
    const k = b.kit;
    switch (b.arch) {
      case "egyptian": {
        if (!b.done) { b.box(0.5, 0.5, 4.5, 4.5, 14, M(0xd8b878, PAT.big)); return; }
        const A: P3 = [0.45, 0.45, 0], B: P3 = [4.55, 0.45, 0], Cn: P3 = [4.55, 4.55, 0], D: P3 = [0.45, 4.55, 0], T: P3 = [2.5, 2.5, 78];
        const sand = rgb(0xdcc08a);
        const stepped = (k2: number, slope: number) => (x: number, y: number) => {
          const row = Math.floor(y - slope * x * 0.1);
          let c = darken(sand, k2);
          if (md(row, 4) === 0) c = darken(c, 0.82);
          if (hash(x >> 2, row >> 2, 21) < 0.08) c = darken(c, 0.93);
          return c;
        };
        b.p.poly(b.pts([A, B, T]), stepped(0.86, 0)); b.p.poly(b.pts([A, D, T]), stepped(1.14, 0));
        b.p.poly(b.pts([D, Cn, T]), stepped(1, 0)); b.p.poly(b.pts([B, Cn, T]), stepped(0.72, 0));
        const [tx, ty] = b.pt(2.5, 2.5, 78);
        b.p.poly([[tx, ty], [tx - 8, ty + 10], [tx, ty + 14], [tx + 8, ty + 10]], (x) => (x < tx ? C.gold : C.goldDark));
        b.door("L", 2.5, 4.55, 0, 10, 0.35);
        b.box(2.0, 4.6, 3.0, 4.95, 8, M(0xd8b878, PAT.big), { record: false });
        b.door("L", 2.5, 4.95, 0, 6, 0.3);
        propObelisk(b, 0.4, 4.85, 30); propObelisk(b, 4.85, 0.4, 30);
        propPalm(b, 4.85, 4.0); propPalm(b, 4.0, 4.88);
        b.flag(1.5, 4.85, 0, 26); b.flag(4.85, 1.5, 0, 26);
        return;
      }
      case "babylonian": {
        const g = k.glaze ?? M(0x2e64b0, glazed);
        b.box(0.4, 0.4, 4.6, 4.6, 16, k.wall);
        if (!b.done) return;
        b.flat(0.4, 0.4, 4.6, 4.6, 16, k.wall, 2, true);
        b.band(0.4, 0.4, 4.6, 4.6, 10, 3, g);
        b.box(0.9, 0.9, 4.1, 4.1, 15, k.wall, { z: 16 });
        b.band(0.9, 0.9, 4.1, 4.1, 25, 3, g);
        b.flat(0.9, 0.9, 4.1, 4.1, 31, k.wall, 2, true);
        b.box(1.4, 1.4, 3.6, 3.6, 14, k.wall, { z: 31 });
        b.flat(1.4, 1.4, 3.6, 3.6, 45, k.wall, 2, true);
        b.box(1.9, 1.9, 3.1, 3.1, 14, g, { z: 45 });
        b.flat(1.9, 1.9, 3.1, 3.1, 59, g, 2, true);
        b.door("L", 2.5, 3.1, 45, 8, 0.3);
        const step = M(0xd8b07a, (_a, h) => (md(h, 2) ? 1 : 0.75));
        b.quad([[2.25, 4.6, 0], [2.75, 4.6, 0], [2.75, 4.1, 16], [2.25, 4.1, 16]], step, 0);
        b.quad([[2.25, 4.1, 16], [2.75, 4.1, 16], [2.75, 3.6, 31], [2.25, 3.6, 31]], step, 0);
        b.quad([[2.25, 3.6, 31], [2.75, 3.6, 31], [2.75, 3.1, 45], [2.25, 3.1, 45]], step, 0);
        const [x, y] = b.pt(2.5, 2.5, 61);
        b.p.rect(x - 4, y - 3, 2, 4, C.gold); b.p.rect(x + 2, y - 3, 2, 4, C.gold);
        b.flag(1.9, 1.9, 61, 14); b.flag(4.6, 4.6, 0, 20); b.flag(0.4, 4.6, 0, 20); b.flag(4.6, 0.4, 0, 20);
        return;
      }
      case "asian": {
        b.box(0.5, 0.5, 4.5, 4.5, 5, k.base);
        b.box(1.1, 1.1, 3.9, 3.9, 12, k.wall, { z: 5 });
        if (!b.done) return;
        const tiers: [number, number][] = [[1.1, 12], [1.45, 10], [1.75, 9], [2.0, 8], [2.2, 7]];
        let z = 5;
        tiers.forEach(([a, h], i) => {
          const c = 5 - a;
          if (i > 0) b.box(a, a, c, c, h, k.wall, { z, record: false });
          else b.door("L", 2.5, 3.9, 5, 9, 0.5);
          z += h;
          b.curved(a, a, c, c, z, 10, k.rmat, 0.4 - i * 0.03);
          z += 5;
        });
        const [x, y] = b.pt(2.5, 2.5, z + 4);
        b.p.rect(x - 1, y - 14, 2, 15, C.gold);
        for (let i = 0; i < 4; i++) b.p.rect(x - 2, y - 12 + i * 3, 4, 1, C.goldDark);
        b.flag(0.5, 4.5, 5, 22); b.flag(4.5, 0.5, 5, 22); b.flag(4.5, 4.5, 5, 22);
        return;
      }
      case "roman": {
        const arc = M(0xdccfb0, (a, h) => {
          const lv = md(h, 13);
          if (lv === 0 || lv === 12) return 0.75;
          const ka = md(a, 8);
          return lv > 2 && lv < 11 && ka > 1 && ka < 6 && !(lv === 10 && (ka === 2 || ka === 5)) ? rgb(0x3a2e24) : PAT.blocks(a, h);
        });
        b.box(0.3, 0.3, 4.7, 4.7, 2, k.base, { record: false });
        b.cyl(2.5, 2.5, 2, 2.05, 40, arc, null);
        if (!b.done) return;
        // Look down into the arena: a ring of seats around the sand.
        const [cx, cy] = b.pt(2.5, 2.5, 42);
        const rx = 2.05 * 22.6, ry = rx / 2;
        b.p.ellipse(cx, cy, rx, ry, rgb(0xd0c4a4));
        b.p.ellipse(cx, cy, rx - 3, ry - 1.5, (x, y) => (md(Math.floor(Math.hypot((x - cx) / 2, y - cy)), 2) ? rgb(0xa89c80) : rgb(0x8a7e66)));
        b.p.ellipse(cx, cy + 2, rx * 0.55, ry * 0.5, rgb(0xd8c08a));
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(a) * (rx - 1)), y = Math.round(cy + Math.sin(a) * (ry - 0.5));
          if (Math.sin(a) > -0.2) { b.p.rect(x, y - 6, 1, 6, C.woodDark); b.p.rect(x + 1, y - 6, 3, 2, b.pc); }
        }
        b.door("L", 2.5, 4.62, 2, 12, 0.5);
        propStatue(b, 0.4, 4.8); propStatue(b, 4.8, 0.4);
        return;
      }
      default: {
        // Greek: a great temple on a three-step base.
        for (let i = 0; i < 3; i++) b.box(0.2 + i * 0.12, 0.2 + i * 0.12, 4.8 - i * 0.12, 4.8 - i * 0.12, 2, k.base, { z: i * 2, record: i === 0 });
        const z = 6, H = 30;
        if (!b.done) { b.box(1.0, 0.8, 4.0, 4.2, 20, k.wall, { z }); return; }
        b.columns("R", 0.65, 4.35, 0.6, z, H, 9, k.col!, k.cap, 3);
        b.columns("L", 0.65, 4.35, 0.6, z, H, 9, k.col!, k.cap, 3);
        b.box(1.1, 0.9, 3.9, 4.1, H, M(0xd8d2c6, PAT.marble), { z });
        b.door("L", 2.5, 4.1, z, 14, 0.5);
        b.columns("L", 0.65, 4.35, 4.4, z, H, 9, k.col!, k.cap, 3);
        b.columns("R", 0.65, 4.25, 4.4, z, H, 8, k.col!, k.cap, 3);
        b.box(0.5, 0.5, 4.5, 4.5, 5, k.wall, { z: z + H - 1, record: false });
        b.band(0.5, 0.5, 4.5, 4.5, z + H, 2, M(b.pc, (a) => (md(a, 6) < 2 ? C.white : b.pc)));
        b.gable(0.5, 0.5, 4.5, 4.5, z + H + 4, 16, k.rmat, "v", k.wall);
        b.flag(4.5, 0.5, z + H + 6, 14); b.flag(0.5, 4.5, z + H + 6, 14);
        propStatue(b, 0.25, 4.85); propStatue(b, 4.85, 0.25);
        return;
      }
    }
  },
};

/** Ground under a building: packed earth with a ragged dithered edge. */
function apron(p: PixelCanvas, W: number, y0: number, D: number, k = 0.97) {
  const cx = W / 2, cy = y0 + D / 2;
  const pts: Pt[] = [[cx - (W / 2) * k, cy], [cx, cy + (D / 2) * k], [cx + (W / 2) * k, cy], [cx, cy - (D / 2) * k]];
  p.poly(pts, (x, y) => {
    const e = Math.abs(x + 0.5 - cx) / (W / 2) + Math.abs(y + 0.5 - cy) / (D / 2);
    const c = hash(x, y, 9) < 0.2 ? C.earthDark : hash(x, y, 10) < 0.1 ? lighten(C.earth, 0.12) : C.earth;
    return e > 0.86 && bayer(x, y) < (e - 0.86) * 7 ? rgb(0x6a7a3a) : c;
  });
}

function drawFarm(p: PixelCanvas, s: number, stage: number, farmStage: number, pc: RGB) {
  const W = s * 32, D = s * 16, y0 = p.h - D;
  const cx = W / 2, cy = y0 + D / 2;
  const P = (u: number, v: number): Pt => [cx + (u - v) * 16, y0 + (u + v) * 8];
  const field = [P(0.06, 0.06), P(s - 0.06, 0.06), P(s - 0.06, s - 0.06), P(0.06, s - 0.06)];
  const soil = stage === 0 ? C.earth : rgb(0x7c5a34);
  p.poly(field, (x, y) => (hash(x, y, 4) < 0.15 ? C.earthDark : soil));
  void cy;
  if (stage === 0) {
    for (const [u, v] of [[0.1, 0.1], [s - 0.1, 0.1], [s - 0.1, s - 0.1], [0.1, s - 0.1]]) { const [x, y] = P(u, v); p.rect(x, y - 4, 1, 4, C.woodDark); }
    return;
  }
  const rows = s * 4;
  const crop = [rgb(0xb8a040), rgb(0x9ab448), rgb(0x6aa83c)][farmStage];
  const ripe = farmStage === 2 ? rgb(0xd8c050) : crop;
  for (let i = 1; i < rows; i++) {
    const v = (i / rows) * s;
    const [ax, ay] = P(0.15, v), [bx, by] = P(s - 0.15, v);
    p.line(ax, ay, bx, by, rgb(0x5e4226));
    if (stage < 2) continue;
    const n = s * 7;
    for (let j = 1; j < n; j++) {
      const keep = stage === 2 ? hash(i, j, 22) < 0.5 : hash(i, j, 21) < 0.3 + farmStage * 0.3;
      if (!keep) continue;
      const t = j / n;
      const x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
      if (stage === 2) { p.set(x, y - 1, rgb(0x6aa83c)); continue; }
      p.set(x, y - 1, crop); p.set(x, y - 2, crop); p.set(x, y - 3, ripe); p.set(x + 1, y - 1, darken(crop, 0.75));
    }
  }
  const [fx, fy] = P(0.25, 0.25);
  p.rect(fx, fy - 9, 1, 9, C.woodDark);
  p.rect(fx + 1, fy - 9, 4, 3, pc);
}

/** A finished building's picture from the assets: for its architecture and age, falling back to an earlier
 *  age, then the Greek style, then a picture shared by all. Foundations keep the drawn stages. */
function assetBuildingSpec(id: string, age: number, arch: Arch): ImageSpec | null {
  const b = ASSETS.manifest.buildings?.[id];
  if (!b) return null;
  if (typeof (b as ImageSpec).file === "string") return b as ImageSpec;
  for (const style of [arch, "greek", "default"]) {
    const byStyle = (b as Record<string, ImageSpec | Record<string, ImageSpec>>)[style];
    if (!byStyle) continue;
    if (typeof (byStyle as ImageSpec).file === "string") return byStyle as ImageSpec;
    for (let a = age; a >= 0; a--) {
      const s = (byStyle as Record<string, ImageSpec>)[AGE_KEYS[a]];
      if (s) return s;
    }
  }
  return null;
}

export function buildingPic(def: BuildingDef, owner: number, age = 0, stage = 3, farmLeft = 1, arch: Arch = "greek"): Pic {
  if (stage >= 3) {
    const spec = assetBuildingSpec(def.id, Math.round(age), arch);
    const fromFile = spec && assetPic(`ba-${spec.file}-${owner}`, spec, owner);
    if (fromFile) return fromFile;
  }
  const s = def.size;
  const W = s * 32, D = s * 16;
  const a = clamp(Math.round(age), 0, 3), st = clamp(Math.round(stage), 0, 3);
  if (def.id === "farm") {
    const farmStage = farmLeft > 0.66 ? 2 : farmLeft > 0.33 ? 1 : 0;
    return pic(`b-farm-${s}-${owner}-${st}-${farmStage}`, W, D + 12, 0.5, 1, (p) => drawFarm(p, s, st, farmStage, playerRGB(owner)));
  }
  const n = NOMINAL[def.id] ?? s;
  const head = Math.round((HEADROOM[def.id] ?? 56) * (s / n));
  const ar = def.id === "wonder" ? arch : arch;
  const kitAge = def.id === "wonder" ? Math.max(a, 2) : a;
  return tallPic(`b-${def.id}-${s}-${owner}-${ar}-${a}-${st}`, W, D + head, 0.5, (p) => {
    const b = new Bld(p, n, s, kitFor(ar, kitAge), playerRGB(owner), st, kitAge, ar);
    apron(p, W, p.h - D, D);
    if (st === 0) { drawFoundation(b, def.id); p.outline(C.outline, 0.3); return; }
    (PLANS[def.id] ?? PLANS.house)(b);
    if (st < 3) b.scaffold();
    p.outline(C.outline, 0.3);
  });
}

/** Stage 0: the plot is levelled and staked out, with material piled up. */
function drawFoundation(b: Bld, id: string) {
  const n = b.n;
  const m = id === "wonder" ? 0.4 : n <= 2 ? 0.3 : 0.4;
  const u0 = m, v0 = m, u1 = n - m, v1 = n - m;
  b.p.poly(b.pts([[u0, v0, 0], [u1, v0, 0], [u1, v1, 0], [u0, v1, 0]]), (x, y) => (hash(x, y, 15) < 0.25 ? darken(C.earth, 0.85) : lighten(C.earth, 0.08)));
  const corners: P3[] = [[u0, v0, 0], [u1, v0, 0], [u1, v1, 0], [u0, v1, 0]];
  const sp = b.pts(corners.map(([u, v]) => [u, v, 2] as P3));
  for (let i = 0; i < 4; i++) b.p.line(sp[i][0], sp[i][1], sp[(i + 1) % 4][0], sp[(i + 1) % 4][1], rgb(0xe0d0a0));
  for (const [x, y] of b.pts(corners)) b.p.rect(x - 1, y - 5, 2, 5, C.woodDark);
  const mid = (u0 + u1) / 2;
  for (const [x, y] of b.pts([[mid, v1, 0], [u1, mid, 0]])) b.p.rect(x, y - 4, 1, 4, C.woodDark);
  if (b.age >= 2 || id.endsWith("tower") || id === "wonder") propStones(b, n * 0.55, n * 0.45);
  else propLogs(b, n * 0.55, n * 0.45);
}

// ---- walls

/** A wall tile that joins its neighbours: mask bits 1 = wall at x-1, 2 = x+1, 4 = y-1, 8 = y+1. */
export function wallPic(tier: 0 | 1 | 2, owner: number, mask: number, stage: number): Pic {
  const t = clamp(tier, 0, 2) as 0 | 1 | 2, st = clamp(Math.round(stage), 0, 3);
  const key = `w-${t}-${owner}-${mask & 15}-${st}`;
  const hmax = [9, 14, 20][t];
  return pic(key, 32, 16 + hmax + 8, 0.5, 1, (p) => {
    const pc = playerRGB(owner);
    const mat = [M(0x9a9286, PAT.rubble), M(0xb0aa9c, PAT.blocks), M(0xa8a294, PAT.big)][t];
    const th = [0.15, 0.19, 0.25][t];
    const H = st === 1 ? Math.round(hmax * 0.5) : hmax;
    const W = 32, y0 = p.h - 16;
    const P = (u: number, v: number, z = 0): Pt => [W / 2 + (u - v) * 16, y0 + (u + v) * 8 - z];
    const quad = (q: P3[], f: number, target = p) => {
      const s = q.map(([u, v, z]) => P(u, v, z));
      const slope = (s[1][1] - s[0][1]) / ((s[1][0] - s[0][0]) || 1);
      target.poly(s, (x, y) => tex(mat, x, Math.floor(s[0][1] + (x + 0.5 - s[0][0]) * slope - y), x, y, f));
    };
    const box = (u0: number, v0: number, u1: number, v1: number, h: number, z = 0, target = p) => {
      quad([[u0, v1, z], [u1, v1, z], [u1, v1, z + h], [u0, v1, z + h]], 0, target);
      quad([[u1, v1, z], [u1, v0, z], [u1, v0, z + h], [u1, v1, z + h]], 1, target);
      const top = [P(u0, v0, z + h), P(u1, v0, z + h), P(u1, v1, z + h), P(u0, v1, z + h)];
      target.poly(top, st === 1 ? darken(mat.c, 0.7) : lighten(mat.c, 0.1));
    };
    const a = 0.5 - th, b = 0.5 + th;
    // Segments toward each neighbour, back ones first.
    const segs: [number, number, number, number][] = [];
    if (mask & 1) segs.push([0, a, 0.5, b]);
    if (mask & 4) segs.push([a, 0, b, 0.5]);
    const front: [number, number, number, number][] = [];
    if (mask & 2) front.push([0.5, a, 1, b]);
    if (mask & 8) front.push([a, 0.5, b, 1]);
    if (st === 0) {
      for (const [u0, v0, u1, v1] of [...segs, [a, a, b, b] as [number, number, number, number], ...front]) {
        p.poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], (x, y) => (hash(x, y, 16) < 0.3 ? C.earthDark : darken(C.earth, 0.9)));
      }
      for (const [u, v] of [[0.5, 0.5], ...(mask & 2 ? [[0.95, 0.5]] : []), ...(mask & 8 ? [[0.5, 0.95]] : [])]) { const [x, y] = P(u, v); p.rect(x, y - 4, 1, 4, C.woodDark); }
      p.outline(C.outline, 0.3);
      return;
    }
    const straight = mask === 3 || mask === 12;
    const post = !straight && t > 0 ? 0.05 : 0;
    for (const s of segs) box(s[0], s[1], s[2], s[3], H);
    box(a - post, a - post, b + post, b + post, H + (post ? 3 : 0));
    for (const s of front) box(s[0], s[1], s[2], s[3], H);
    if (st === 3) {
      // Merlons on a fixed grid so neighbouring tiles line up.
      const m = (u0: number, v0: number, u1: number, v1: number) => box(u0, v0, u1, v1, t === 0 ? 1 : 3, H);
      if (t > 0) {
        for (const s of [...segs, ...front]) {
          const alongU = s[3] - s[1] < s[2] - s[0];
          for (let k = 0.0625; k < 1; k += 0.25) {
            if (alongU && k >= s[0] && k + 0.12 <= s[2]) m(k, b - 0.08, k + 0.12, b);
            if (!alongU && k >= s[1] && k + 0.12 <= s[3]) m(b - 0.08, k, b, k + 0.12);
          }
        }
      }
      if (t === 2) {
        for (const s of [...segs, ...front]) {
          const alongU = s[3] - s[1] < s[2] - s[0];
          if (alongU) quad([[s[0], b, H - 5], [s[2], b, H - 5], [s[2], b, H - 4], [s[0], b, H - 4]], 0);
          else quad([[b, s[3], H - 5], [b, s[1], H - 5], [b, s[1], H - 4], [b, s[3], H - 4]], 1);
        }
        for (const s of [...segs, ...front]) {
          const alongU = s[3] - s[1] < s[2] - s[0];
          const q: Pt[] = alongU ? [P(s[0], b, H - 5), P(s[2], b, H - 5)] : [P(b, s[3], H - 5), P(b, s[1], H - 5)];
          p.line(q[0][0], q[0][1], q[1][0], q[1][1], pc);
        }
      }
      if (t > 0 && !straight) { const [x, y] = P(0.5, 0.5, H + 3 + (t === 2 ? 3 : 0)); if (t === 2) { p.rect(x, y - 8, 1, 8, C.woodDark); p.rect(x + 1, y - 8, 4, 3, pc); } }
    }
    if (st < 3) {
      const [x0, y0p] = P(b + 0.08, b + 0.08), [, y1] = P(b + 0.08, b + 0.08, hmax + 2);
      p.line(x0, y0p, x0, y1, C.woodDark);
      if (st === 2) { const [x1, y2] = P(0.95, b + 0.08, hmax * 0.6); p.line(x0, y1 + hmax * 0.4, x1, y2, C.woodLight); }
    }
    // Outline, but not across the joins: a ghost of each connected segment past the tile edge
    // keeps the outline open there, so a line of walls reads as one.
    const ghost = new PixelCanvas(p.w, p.h);
    if (mask & 1) box(-0.4, a, 0.02, b, hmax + 4, -1, ghost);
    if (mask & 4) box(a, -0.4, b, 0.02, hmax + 4, -1, ghost);
    if (mask & 2) box(0.98, a, 1.4, b, hmax + 4, -1, ghost);
    if (mask & 8) box(a, 0.98, b, 1.4, hmax + 4, -1, ghost);
    const solid = (x: number, y: number) => p.alphaAt(x, y) === 255;
    const add: [number, number, RGB][] = [];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      if (p.alphaAt(x, y) || ghost.alphaAt(x, y)) continue;
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (solid(x + dx, y + dy)) { add.push([x, y, mix(C.outline, p.get(x + dx, y + dy)!, 0.3)]); break; }
    }
    for (const [x, y, c] of add) p.set(x, y, c);
  });
}

// ---- icons

const UNIT_IDS = new Set([...Object.keys(KITS), ...RIDERS, ...CHARIOTS, ...ELEPHANTS, ...SIEGE, "gazelle", "lion", "alligator", "camel_rider"]);

const iconCache = new Map<string, HTMLCanvasElement>();

/** Box-filter shrink of a canvas into a PixelCanvas region, keeping pixels mostly opaque. */
function shrinkInto(dst: PixelCanvas, src: HTMLCanvasElement, x0: number, y0: number, w: number, h: number) {
  const sw = src.width, sh = src.height;
  const data = src.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  const f = Math.max(sw / w, sh / h, 1);
  const ow = Math.round(sw / f), oh = Math.round(sh / f);
  const ox = x0 + Math.floor((w - ow) / 2), oy = y0 + (h - oh);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    let r = 0, g = 0, bl = 0, n = 0, total = 0;
    for (let sy = Math.floor(y * f); sy < Math.min(sh, Math.floor((y + 1) * f)); sy++) {
      for (let sx = Math.floor(x * f); sx < Math.min(sw, Math.floor((x + 1) * f)); sx++) {
        total++;
        const i = (sy * sw + sx) * 4;
        if (data[i + 3] < 200) continue;
        r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++;
      }
    }
    if (n && n / total >= 0.4) dst.set(ox + x, oy + y, [r / n, g / n, bl / n]);
  }
}

function iconFrame(p: PixelCanvas, bg: RGB) {
  p.rect(0, 0, 24, 24, darken(bg, 0.5));
  p.rect(1, 1, 22, 22, bg);
  for (let y = 1; y < 23; y++) for (let x = 1; x < 23; x++) if (bayer(x, y) < (y / 24) * 0.5) p.set(x, y, darken(bg, 0.85));
  p.rect(1, 1, 22, 1, lighten(bg, 0.3)); p.rect(1, 1, 1, 22, lighten(bg, 0.2));
  p.rect(1, 22, 22, 1, darken(bg, 0.6)); p.rect(22, 1, 1, 22, darken(bg, 0.6));
}

/** Generic technology pictures. */
function techGlyph(p: PixelCanvas, g: string) {
  const L = (x0: number, y0: number, x1: number, y1: number, c: RGB) => p.line(x0, y0, x1, y1, c);
  switch (g) {
    case "delete": // the red cross of the original's delete button
      for (let i = 0; i < 13; i++) { p.rect(5 + i, 5 + i, 2, 2, C.red); p.rect(17 - i, 5 + i, 2, 2, C.red); }
      L(5, 6, 17, 18, lighten(C.red, 0.35)); break;
    case "stop": p.poly([[8, 4], [16, 4], [20, 8], [20, 16], [16, 20], [8, 20], [4, 16], [4, 8]], C.red); p.rect(7, 11, 10, 3, C.white); break;
    case "next": p.poly([[5, 9], [13, 9], [13, 5], [20, 12], [13, 19], [13, 15], [5, 15]], C.gold); L(6, 10, 12, 10, lighten(C.gold, 0.4)); break;
    case "back": p.poly([[19, 9], [11, 9], [11, 5], [4, 12], [11, 19], [11, 15], [19, 15]], C.gold); L(12, 10, 18, 10, lighten(C.gold, 0.4)); break;
    case "sword": L(6, 18, 17, 5, C.ironLight); L(7, 18, 18, 6, C.iron); L(5, 14, 10, 19, C.bronze); L(4, 19, 6, 21, C.woodDark); break;
    case "shield": p.ellipse(12, 12, 7, 8, C.bronze); p.ellipse(12, 12, 5.5, 6.5, (x, y) => (x + y < 23 ? lighten(C.red, 0.2) : C.red)); p.ellipse(12, 12, 1.5, 1.5, C.bronzeLight); break;
    case "armor":
      p.poly([[6, 6], [18, 6], [17, 19], [7, 19]], (x) => (x < 12 ? C.iron : C.ironDark)); p.rect(4, 6, 3, 4, C.iron); p.rect(17, 6, 3, 4, C.ironDark);
      for (let y = 9; y < 19; y += 3) p.rect(7, y, 10, 1, darken(C.ironDark, 0.8));
      p.rect(10, 5, 4, 2, darken(C.ironDark, 0.6));
      break;
    case "bow": for (let i = -8; i <= 8; i++) p.set(9 + Math.round(5 * (1 - (i * i) / 64)), 12 + i, C.woodDark); L(9, 4, 9, 20, C.white); L(6, 12, 19, 12, C.woodLight); p.set(20, 12, C.iron); break;
    case "hammer": L(7, 19, 15, 8, C.wood); L(8, 19, 16, 8, C.woodDark); p.poly([[11, 5], [17, 3], [20, 8], [14, 10]], C.ironDark); p.set(17, 4, C.ironLight); break;
    case "wheel": p.ellipse(12, 12, 8, 8, C.woodDark); p.ellipse(12, 12, 6.2, 6.2, rgb(0x3a2a1a)); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; L(12 - Math.cos(a) * 6, 12 - Math.sin(a) * 6, 12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, C.wood); } p.ellipse(12, 12, 1.6, 1.6, C.ironDark); break;
    case "coin": p.ellipse(12, 12, 7, 7, C.goldDark); p.ellipse(11.5, 11.5, 6, 6, C.gold); p.rect(10, 8, 3, 8, C.goldDark); p.set(9, 9, rgb(0xfff4b0)); break;
    case "plough": L(5, 17, 19, 9, C.wood); L(5, 18, 19, 10, C.woodDark); p.poly([[3, 16], [8, 15], [6, 20]], C.ironDark); L(15, 11, 13, 5, C.wood); for (let x = 4; x < 21; x += 3) p.set(x, 21, C.leaf); break;
    case "tower": p.rect(8, 7, 8, 14, C.stone); p.rect(13, 7, 3, 14, C.stoneDark); for (let x = 7; x < 17; x += 3) p.rect(x, 4, 2, 3, C.stone); p.rect(11, 15, 2, 6, C.dark); p.rect(10, 9, 1, 3, C.dark); break;
    case "wall": for (let y = 8; y < 20; y += 3) for (let x = 3 + ((y / 3) & 1) * 2; x < 21; x += 4) { p.rect(x, y, 3, 2, C.stone); p.set(x + 2, y + 1, C.stoneDark); } for (let x = 3; x < 21; x += 4) p.rect(x, 5, 2, 3, C.stone); break;
    case "temple": p.poly([[3, 9], [12, 3], [21, 9]], C.tile); p.rect(4, 9, 16, 2, C.white); for (let x = 5; x < 20; x += 3) p.rect(x, 11, 2, 7, x < 12 ? C.white : C.robeDark); p.rect(3, 18, 18, 2, C.robeDark); break;
    case "age": p.ellipse(12, 13, 8, 8, C.goldDark); p.ellipse(12, 13, 6, 6, C.gold); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; p.set(Math.round(12 + Math.cos(a) * 9.5), Math.round(13 + Math.sin(a) * 9.5), C.glow); } p.poly([[9, 16], [12, 8], [15, 16]], C.bronzeDark); break;
    default: p.rect(5, 5, 14, 15, C.ivory); p.rect(5, 5, 14, 2, C.thatchDark); p.rect(5, 18, 14, 2, C.thatchDark); for (let y = 9; y < 17; y += 2) L(7, y, 16 - (y % 3), y, C.woodDark); break;
  }
}

const TECH_WORDS: [RegExp, string][] = [
  [/^delete$/, "delete"], [/^stop$/, "stop"], [/^next$/, "next"], [/^back$/, "back"],
  [/^build$/, "hammer"], [/^attack_move$/, "sword"],
  [/^(stone|tool|bronze|iron)_age$|^age_|advance|ascend/, "age"],
  [/coin|gold|bank|market|trade|currency|tax|mint/, "coin"],
  [/shield/, "shield"],
  [/armor|armour|mail|leather|scale|plate|chain/, "armor"],
  [/bow|arrow|archer|ballist/, "bow"],
  [/sword|weapon|tool_?work|metal|iron|bronze|smith|forg/, "sword"],
  [/wheel|engineer|cart|trans|axle/, "wheel"],
  [/plow|plough|farm|irrigat|domestic|husband|harvest|crop/, "plough"],
  [/tower|watch|sentry|guard/, "tower"],
  [/wall|fortif|masonry|architect|stone|construct/, "wall"],
  [/temple|relig|priest|mystic|astrolog|polythe|monothe|afterlife|medicine|fanatic|jihad|martyr|faith/, "temple"],
  [/wood|carpent|artisan|craft|build|siege|catapult|alchemy/, "hammer"],
];

/** A 24x24 art-px button icon for a unit, building or technology id. */
export function iconPic(id: string): HTMLCanvasElement {
  const hit = iconCache.get(id);
  if (hit) return hit;
  const file = ASSETS.manifest.icons?.[id];
  const fromFile = file ? ASSETS.canvasOf(file, null) : null;
  if (fromFile) { iconCache.set(id, fromFile.canvas); return fromFile.canvas; }
  const p = new PixelCanvas(24, 24);
  if (UNIT_IDS.has(id)) {
    iconFrame(p, rgb(0x3a4a5e));
    const u = unitPic({ type: id, owner: 0, facing: "front", pose: "idle", frame: 0, tool: "none", carry: null });
    if (u.canvas.width <= 26 && u.canvas.height <= 28) {
      // Infantry: show head and shoulders at full size.
      const data = u.canvas.getContext("2d")!.getImageData(0, 0, u.canvas.width, u.canvas.height).data;
      const ox = Math.round(12 - u.ax * u.canvas.width);
      for (let y = 0; y < 21; y++) for (let x = 0; x < u.canvas.width; x++) {
        const i = (y * u.canvas.width + x) * 4;
        if (data[i + 3] === 255 && x + ox >= 2 && x + ox < 22) p.set(x + ox, y + 2, [data[i], data[i + 1], data[i + 2]]);
      }
    } else shrinkInto(p, u.canvas, 2, 2, 20, 20);
  } else if (NOMINAL[id] !== undefined || id.endsWith("_wall") || id === "fortification") {
    iconFrame(p, rgb(0x5a4a34));
    const src = id.endsWith("_wall") || id === "fortification"
      ? wallPic(id === "small_wall" ? 0 : id === "medium_wall" ? 1 : 2, 0, 3, 3).canvas
      : buildingPic({ id, size: NOMINAL[id] } as BuildingDef, 0, 2, 3, 1, "greek").canvas;
    shrinkInto(p, src, 2, 2, 20, 20);
  } else {
    iconFrame(p, rgb(0x3e5a38));
    techGlyph(p, TECH_WORDS.find(([re]) => re.test(id))?.[1] ?? "scroll");
  }
  const q = new PixelCanvas(24, 24);
  q.data.set(p.data);
  const out = q.toCanvas();
  iconCache.set(id, out);
  return out;
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
  // In the order of the game's resources: food, wood, gold, stone. A file replaces any of them.
  const files = ASSETS.manifest.resourceIcons ?? {};
  return draws.map((d, i) => {
    const file = files[(["food", "wood", "gold", "stone"] as const)[i]];
    if (file && ASSETS.image(file)) return ASSETS.url(file);
    const p = new PixelCanvas(16, 16); d(p); p.outline(); return p.toCanvas().toDataURL();
  });
}

/** Planks of dark wood for the bottom panel, as in the original's interface. Tileable. */
export function woodTexture(): string {
  const p = new PixelCanvas(64, 32);
  for (let y = 0; y < 32; y++) {
    const plank = y >> 3, seam = (y & 7) === 0;
    for (let x = 0; x < 64; x++) {
      const grain = hash(x >> 3, y, 41 + plank) * 0.5 + Math.sin((x + plank * 17) * 0.35 + y * 0.9) * 0.18;
      let c = mix(rgb(0x4a2e18), rgb(0x6e4626), 0.4 + grain * 0.5);
      if (seam) c = rgb(0x24150a);
      if (((x + plank * 23) & 31) === 0) c = rgb(0x2a190c); // board ends
      p.set(x, y, c);
    }
  }
  return p.toCanvas().toDataURL();
}

/** Small icons for the status box: attack, melee armor, pierce armor, range, hit points, faith, carry, line of sight. */
export function statIcons(): Record<string, string> {
  const draw: Record<string, (p: PixelCanvas) => void> = {
    attack: (p) => { p.line(2, 11, 10, 3, C.iron); p.line(3, 11, 11, 3, C.ironDark); p.line(2, 8, 5, 11, C.bronze); },
    armor: (p) => { p.poly([[3, 2], [10, 2], [10, 7], [6.5, 11], [3, 7]], (x) => (x < 7 ? C.iron : C.ironDark)); },
    pierce: (p) => { p.poly([[3, 2], [10, 2], [10, 7], [6.5, 11], [3, 7]], (x) => (x < 7 ? C.bronze : C.bronzeDark)); p.line(1, 1, 7, 7, C.white); },
    range: (p) => { for (let i = -5; i <= 5; i++) p.set(4 + Math.round(3 * (1 - (i * i) / 25)), 6 + i, C.woodDark); p.line(4, 1, 4, 11, C.white); p.line(3, 6, 11, 6, C.wood); },
    hp: (p) => { p.ellipse(4.5, 5, 2.5, 2.5, C.red); p.ellipse(8.5, 5, 2.5, 2.5, C.red); p.poly([[2, 6], [11, 6], [6.5, 11]], C.red); },
    faith: (p) => { p.ellipse(6.5, 6.5, 4.5, 4.5, C.glow); p.ellipse(6.5, 6.5, 2.5, 2.5, C.gold); },
    carry: (p) => { p.rect(3, 4, 7, 7, rgb(0xa07840)); p.rect(3, 4, 7, 2, rgb(0x7a5a2c)); },
    los: (p) => { p.ellipse(6.5, 6.5, 5, 3, C.white); p.ellipse(6.5, 6.5, 2, 2, rgb(0x3a6ab0)); },
  };
  const out: Record<string, string> = {};
  for (const [k, d] of Object.entries(draw)) { const p = new PixelCanvas(13, 13); d(p); p.outline(); out[k] = p.toCanvas().toDataURL(); }
  return out;
}

/** The size of one tile of the carved interface stone, in art pixels. It is drawn at 2 screen units a pixel. */
export const RELIEF_W = 200, RELIEF_H = 63;

/** Carved stone for the top bar and bottom panel, in the colour and motifs of each architecture:
 *  invented glyph columns for the Egyptians, a key band and fluting for the Greeks, glazed brick and
 *  rosettes for Babylon, lacquered panels with cloud scrolls for the Asian peoples, framed marble for
 *  Rome. Every motif is drawn here; it tiles left to right. */
export function reliefTexture(arch: string, plain = false): string {
  const W = RELIEF_W, H = RELIEF_H;
  const p = new PixelCanvas(W, H);
  const tones: Record<string, [number, number]> = {
    egyptian: [0xe2cca4, 0xb4966a], greek: [0xe8e4da, 0xb2ac9e], babylonian: [0xcfa874, 0x94693e],
    asian: [0x9a4632, 0x5a2216], roman: [0xd2cec6, 0x8c8880],
  };
  const [lightHex, darkHex] = tones[arch] ?? tones.egyptian;
  const light = rgb(lightHex), dark = rgb(darkHex);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = hash(x >> 2, y >> 2, 51) * 0.35 + hash(x, y, 52) * 0.25 + hash(x >> 4, y >> 3, 53) * 0.4;
    p.set(x, y, mix(dark, light, 0.45 + n * 0.55));
  }
  // A carved line: a shadowed groove with its lit lower edge, as light falls from the top left.
  // Shallow, so the carving reads as relief behind the buttons rather than a pattern on top of them.
  const shade = darken(dark, 0.8), lit = lighten(light, 0.22);
  const groove = (x0: number, y0: number, x1: number, y1: number) => { p.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, lit); p.line(x0, y0, x1, y1, shade); };
  const ring = (cx: number, cy: number, r: number) => {
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2, x = Math.round(cx + Math.cos(t) * r), y = Math.round(cy + Math.sin(t) * r);
      p.set(x + 1, y + 1, lit); p.set(x, y, shade);
    }
  };
  // Every style has a carved border along the top and bottom. The top bar's stone stops there.
  groove(0, 1, W - 1, 1); groove(0, H - 3, W - 1, H - 3);
  if (plain) return p.toCanvas().toDataURL();
  if (arch === "greek") {
    // A key band along the top and the bottom, and fluted pilasters.
    for (const by of [4, H - 11]) {
      for (let x = 0; x < W; x += 10) {
        groove(x, by + 6, x, by); groove(x, by, x + 7, by); groove(x + 7, by, x + 7, by + 4);
        groove(x + 7, by + 4, x + 3, by + 4); groove(x + 3, by + 4, x + 3, by + 2); groove(x, by + 6, x + 10, by + 6);
      }
    }
    for (const px of [40, 140]) for (let k = 0; k < 4; k++) groove(px + k * 4, 14, px + k * 4, H - 15);
  } else if (arch === "babylonian") {
    // Courses of brick, with a row of rosettes through the middle.
    for (let y = 4; y < H - 3; y += 8) {
      groove(0, y, W - 1, y);
      for (let x = (y / 8) % 2 ? 0 : 10; x < W; x += 20) groove(x, y, x, Math.min(y + 8, H - 4));
    }
    for (let x = 20; x < W; x += 40) {
      ring(x, 32, 7); ring(x, 32, 2);
      for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; groove(x + Math.cos(t) * 3, 32 + Math.sin(t) * 3, x + Math.cos(t) * 6, 32 + Math.sin(t) * 6); }
    }
  } else if (arch === "asian") {
    // Lacquered panels in raised frames, each with a cloud scroll.
    for (let x = 0; x < W; x += 50) {
      groove(x + 3, 6, x + 46, 6); groove(x + 3, 6, x + 3, H - 8); groove(x + 46, 6, x + 46, H - 8); groove(x + 3, H - 8, x + 46, H - 8);
      for (let a = 0; a < 60; a++) {
        const t = a / 60 * Math.PI * 3.2, r = 2 + a * 0.22;
        p.set(Math.round(x + 25 + Math.cos(t) * r), Math.round(30 + Math.sin(t) * r * 0.7), shade);
      }
    }
  } else if (arch === "roman") {
    // Marble in recessed frames, with a chain of leaves between them.
    for (let x = 0; x < W; x += 100) {
      for (const [x0, x1] of [[x + 6, x + 44], [x + 56, x + 94]]) {
        groove(x0, 8, x1, 8); groove(x0, 8, x0, H - 10); groove(x1, 8, x1, H - 10); groove(x0, H - 10, x1, H - 10);
        groove(x0 + 4, 12, x1 - 4, 12); groove(x0 + 4, H - 14, x1 - 4, H - 14);
      }
      for (let y = 10; y < H - 10; y += 6) { groove(x + 48, y, x + 51, y + 3); groove(x + 52, y, x + 49, y + 3); }
    }
  } else {
    // Egyptian: a few columns of invented signs between ruled lines, as on a temple wall, with plain
    // dressed stone between the groups.
    let seed = 0;
    groove(0, 5, W - 1, 5); groove(0, H - 7, W - 1, H - 7);
    for (let x = 0; x < W; x += 20) {
      if (x % 100 >= 40) continue;
      groove(x, 5, x, H - 6); groove(x + 20, 5, x + 20, H - 6);
      for (let y = 8; y + 12 < H - 4; y += 13) {
        const cx = x + 10, cy = y + 5, kind = Math.floor(hash(x, y, 60 + seed++) * 6);
        if (kind === 0) ring(cx, cy, 4);                                                   // a sun
        else if (kind === 1) { for (let k = -4; k < 4; k += 2) { groove(cx + k, cy - 1, cx + k + 1, cy + 1); } } // water
        else if (kind === 2) { groove(cx - 4, cy + 4, cx, cy - 4); groove(cx, cy - 4, cx + 4, cy + 4); groove(cx - 4, cy + 4, cx + 4, cy + 4); } // a hill
        else if (kind === 3) { groove(cx, cy - 5, cx, cy + 5); ring(cx, cy - 3, 2); }      // a staff
        else if (kind === 4) { groove(cx - 4, cy, cx + 4, cy); groove(cx - 4, cy - 3, cx - 4, cy + 3); groove(cx + 4, cy - 3, cx + 4, cy + 3); } // a frame
        else { ring(cx, cy + 1, 3); groove(cx - 4, cy - 4, cx + 4, cy - 4); }               // a bowl
      }
    }
  }
  return p.toCanvas().toDataURL();
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
