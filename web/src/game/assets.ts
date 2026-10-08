// Art and sound from files, when there are any. The game draws everything in code; a manifest in
// public/assets/ (published with the game) or assets-local/ (dev server only, never committed) can
// replace any piece of it. Whatever the manifest does not name keeps its code-drawn version, so
// assets can arrive one group at a time. See replica/assets-needed.md for the format and sizes.
//
// Every file in public/assets/ needs a line in its "credits": only freely licensed or own work there.

import { Rectangle, Texture } from "pixi.js";

/** A picture: the file, and the point that stands on the ground (a unit's feet, the bottom corner of a
 *  building's diamond), in the image's own pixels. `scale` is screen units per image pixel. */
export interface ImageSpec { file: string; anchor?: [number, number]; scale?: number }

/** One animation on a unit's sheet: the first row (direction 0), how many frames, how fast. Each further
 *  direction is the next row down. */
export interface AnimSpec { row: number; frames: number; fps?: number }

/** A unit's sprite sheet. Directions run clockwise from facing the viewer: S, SW, W, NW, N, NE, E, SE.
 *  With 5, the last three are the first ones mirrored, as the original did. Areas painted in shades of
 *  magenta (#FF00FF) take the player's colour. */
export interface UnitSheetSpec {
  file: string; frame: [number, number]; anchor: [number, number]; scale?: number; directions: 5 | 8;
  anims: Partial<Record<"idle" | "walk" | "work" | "attack", AnimSpec>>;
}

export interface Manifest {
  /** By unit id, or "villager:axe" for a villager with that tool in hand. */
  units?: Record<string, UnitSheetSpec>;
  /** By building id: one picture for all, or by architecture and age ("stone", "tool", "bronze", "iron"). */
  buildings?: Record<string, ImageSpec | Record<string, ImageSpec | Record<string, ImageSpec>>>;
  /** By resource id (tree, lone_tree, berry_bush, gold_mine, stone_mine, fish): one or several variants. */
  resources?: Record<string, ImageSpec | ImageSpec[]>;
  /** Ground tiles, each a 64 x 32 diamond: several variants per kind. */
  terrain?: Partial<Record<"grass" | "dirt" | "sand" | "water", string[]>>;
  /** Command icons by unit, building, tech or command id. */
  icons?: Record<string, string>;
  /** The four resource icons of the top bar. */
  resourceIcons?: Partial<Record<"wood" | "food" | "gold" | "stone", string>>;
  /** Mouse pointers by kind, with their hot spot. */
  cursors?: Record<string, { file: string; hot: [number, number] }>;
  /** Sound effects by name, with variants picked at random. */
  sfx?: Record<string, string[]>;
  /** Music tracks, played in turn. */
  music?: string[];
  /** Who made what, under which licence. Shown in the menu. */
  credits?: { what: string; author: string; license: string; url?: string }[];
}

// Set by vite.config.ts: which folders have a manifest. Tests and tools without Vite see neither.
declare const __PUBLIC_ASSETS__: boolean, __LOCAL_ASSETS__: boolean;
const has = (flag: () => boolean) => { try { return flag(); } catch { return false; } };
const ROOTS = [
  ...(has(() => __PUBLIC_ASSETS__) ? ["assets/"] : []),
  ...(has(() => __LOCAL_ASSETS__) ? ["assets-local/"] : []),
];

export class Assets {
  manifest: Manifest = {};
  /** Files by path, relative to their root, as loaded images. */
  private images = new Map<string, HTMLImageElement>();
  private textures = new Map<string, Texture>();
  private base = new Map<string, string>(); // file -> the root it came from
  private sounds = new Map<string, AudioBuffer>();
  private soundBytes = new Map<string, Promise<ArrayBuffer | null>>();
  private frames = new Map<string, { texture: Texture; canvas: HTMLCanvasElement }>();
  failures: string[] = [];

  get any() { return Object.keys(this.manifest).length > 0; }

  /** Reads the manifests and every picture they name. Missing or broken files are noted and skipped. */
  async load() {
    for (const root of ROOTS) {
      let m: Manifest | null = null;
      try {
        const r = await fetch(`${root}manifest.json`, { cache: "no-cache" });
        if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) m = await r.json();
      } catch { /* none here */ }
      if (!m) continue;
      for (const f of filesOf(m)) this.base.set(f, root);
      this.manifest = merge(this.manifest, m);
    }
    const pictures = [...this.base.keys()].filter((f) => /\.(png|webp|gif|jpe?g)$/i.test(f));
    await Promise.all(pictures.map((f) => this.loadImage(f)));
    if (this.failures.length) console.warn(`Assets not loaded: ${this.failures.join(", ")}`);
  }

  url(file: string) { return `${this.base.get(file) ?? "assets/"}${file}`; }

  private loadImage(file: string) {
    return new Promise<void>((done) => {
      const img = new Image();
      img.onload = () => { this.images.set(file, img); done(); };
      img.onerror = () => { this.failures.push(file); done(); };
      img.src = this.url(file);
    });
  }

  image(file: string | undefined) { return file ? this.images.get(file) ?? null : null; }

  private pixelCache = new Map<string, { data: Uint8ClampedArray; w: number; h: number }>();

  /** A picture's pixels, for sampling ground tiles. */
  pixels(file: string) {
    const hit = this.pixelCache.get(file);
    if (hit) return hit;
    const img = this.images.get(file);
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const out = { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
    this.pixelCache.set(file, out);
    return out;
  }

  texture(file: string): Texture | null {
    let t = this.textures.get(file);
    if (t) return t;
    const img = this.images.get(file);
    if (!img) return null;
    t = Texture.from(img);
    this.textures.set(file, t);
    return t;
  }

  /** A picture as a canvas, recoloured for a player if it has magenta areas. */
  canvasOf(file: string, owner: number | null, color?: [number, number, number]) {
    const key = `${file}#${owner ?? "-"}`;
    const hit = this.frames.get(key);
    if (hit) return hit;
    const img = this.images.get(file);
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    if (owner !== null && color) recolor(c, color);
    const out = { texture: Texture.from(c), canvas: c };
    this.frames.set(key, out);
    return out;
  }

  /** One frame cut from a sheet that has been recoloured for its owner. */
  frame(file: string, owner: number, color: [number, number, number], x: number, y: number, w: number, h: number) {
    const key = `${file}#${owner}@${x},${y}`;
    const hit = this.frames.get(key);
    if (hit) return hit;
    const sheet = this.canvasOf(file, owner, color);
    if (!sheet) return null;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(sheet.canvas, x, y, w, h, 0, 0, w, h);
    const texture = new Texture({ source: sheet.texture.source, frame: new Rectangle(x, y, w, h) });
    const out = { texture, canvas: c };
    this.frames.set(key, out);
    return out;
  }

  // ---- sound

  /** Starts fetching every sound file; call it early. Decoding waits for an AudioContext. */
  prefetchSounds() {
    for (const f of [...Object.values(this.manifest.sfx ?? {}).flat(), ...(this.manifest.music ?? [])]) {
      if (this.soundBytes.has(f)) continue;
      this.soundBytes.set(f, fetch(this.url(f)).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    }
  }

  /** Decodes the effects once the browser allows sound. */
  async decodeSounds(ctx: AudioContext) {
    this.prefetchSounds();
    await Promise.all(Object.values(this.manifest.sfx ?? {}).flat().map(async (f) => {
      if (this.sounds.has(f)) return;
      const bytes = await this.soundBytes.get(f);
      if (!bytes) { this.failures.push(f); return; }
      try { this.sounds.set(f, await ctx.decodeAudioData(bytes.slice(0))); } catch { this.failures.push(f); }
    }));
  }

  /** A random variant of a named effect, if one has been decoded. */
  sound(name: string): AudioBuffer | null {
    const list = (this.manifest.sfx?.[name] ?? []).map((f) => this.sounds.get(f)).filter((b): b is AudioBuffer => !!b);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  musicUrls() { return (this.manifest.music ?? []).map((f) => this.url(f)); }
}

/** Every file a manifest names. */
function filesOf(m: Manifest): string[] {
  const out: string[] = [];
  const img = (s: unknown) => {
    if (!s || typeof s !== "object") return;
    if ("file" in (s as ImageSpec) && typeof (s as ImageSpec).file === "string") out.push((s as ImageSpec).file);
    else for (const v of Object.values(s as Record<string, unknown>)) img(v);
  };
  for (const u of Object.values(m.units ?? {})) out.push(u.file);
  img(m.buildings);
  for (const r of Object.values(m.resources ?? {})) (Array.isArray(r) ? r : [r]).forEach((x) => out.push(x.file));
  for (const t of Object.values(m.terrain ?? {})) out.push(...(t ?? []));
  out.push(...Object.values(m.icons ?? {}), ...Object.values(m.resourceIcons ?? {}).filter((x): x is string => !!x));
  for (const c of Object.values(m.cursors ?? {})) out.push(c.file);
  out.push(...Object.values(m.sfx ?? {}).flat(), ...(m.music ?? []));
  return out;
}

/** The second manifest adds to the first, entry by entry. */
function merge(a: Manifest, b: Manifest): Manifest {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    if (Array.isArray(v)) out[k] = [...(Array.isArray(prev) ? prev : []), ...v];
    else if (v && typeof v === "object") out[k] = { ...(prev as object ?? {}), ...v };
    else out[k] = v;
  }
  return out as Manifest;
}

/** Paints the magenta areas of a picture in a player's colour, keeping their light and shade. */
function recolor(c: HTMLCanvasElement, color: [number, number, number]) {
  const g = c.getContext("2d")!;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    if (d[i + 3] === 0 || r < 40 || b < 40 || gr > Math.min(r, b) * 0.45 || Math.abs(r - b) > 60) continue;
    const k = (r + b) / 510; // how bright the magenta was
    d[i] = Math.min(255, color[0] * k * 1.25);
    d[i + 1] = Math.min(255, color[1] * k * 1.25);
    d[i + 2] = Math.min(255, color[2] * k * 1.25);
  }
  g.putImageData(img, 0, 0);
}

/** The one set of assets the game uses, filled in by load() before the game starts. */
export const ASSETS = new Assets();

/** The age keys used by building pictures, by age index. */
export const AGE_KEYS = ["stone", "tool", "bronze", "iron"];

/** Which of the eight directions a unit faces on screen, from its heading on the map. 0 is facing the
 *  viewer (south on screen), going clockwise: SW, W, NW, N, NE, E, SE. */
export function screenDirection(fx: number, fy: number): number {
  // The map's x and y axes run down-right and down-left on screen.
  const sx = fx - fy, sy = (fx + fy) * 0.5;
  // 0 heading straight down the screen, a quarter turn heading left (W), and so on clockwise.
  const a = Math.atan2(-sx, sy);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}
