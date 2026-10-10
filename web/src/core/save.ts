// Saving and loading a game: the whole simulation, written out as it stands and read back, so that a
// loaded game goes on exactly as the saved one would have (the test plays both on and compares them).
//
// The world is a graph of objects: units point at their defs, the map is shared, players hold their
// mods. It is written as a table of objects, each referred to by its number, so shared objects stay
// shared and nothing is copied twice. Anything that belongs to the rules (a unit's def, a tech, a civ)
// is not copied at all but written as its path in the rules, and found there again on loading: a save
// holds the game, not the rulebook.
import { AIController } from "./ai";
import { Building, IDLE, Player, PlayerStats, ResourceNode, Unit } from "./entities";
import { Fog } from "./fog";
import { Footprint, RNG, Tile, Vec2 } from "./geom";
import { GridMap } from "./grid";
import { Pathfinder } from "./path";
import { ResBag, Rules } from "./rules";
import { Mods } from "./stats";
import { World } from "./world";

/** Bumped whenever the shape of the saved world changes; older saves are refused rather than misread. */
export const SAVE_FORMAT = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor = { prototype: any; name: string };
const CLASSES: Record<string, Ctor> = {
  World, Unit, Building, ResourceNode, Player, PlayerStats, AIController, Vec2, Tile, Footprint, RNG, ResBag, GridMap, Fog, Mods,
};
/** Class by prototype: a built game shortens class names, so the names cannot be trusted, the keys above can. */
const CLASS_OF = new Map<object, string>(Object.entries(CLASSES).map(([k, C]) => [C.prototype, k]));
const TYPED = { Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array };
/** Objects the code shares as constants, kept by name so a loaded unit's order is the same IDLE again. */
const CONSTANTS: Record<string, object> = { IDLE };
const CONSTANT_OF = new Map<object, string>(Object.entries(CONSTANTS).map(([k, v]) => [v, k]));
/** Fields rebuilt on loading instead of saved: the pathfinder is only scratch space. */
const SKIP: Record<string, string[]> = { World: ["pathfinder"] };

/** What a save file holds: the world, and whatever the interface wants to keep beside it. */
export interface SaveFile { format: number; saved: string; time: number; world: unknown; ui?: unknown }

/** Every object reachable from the rules, by its path, both ways. */
function rulesIndex(rules: Rules) {
  const toPath = new Map<object, string>(), toObj = new Map<string, object>();
  const walk = (v: unknown, path: string) => {
    if (v === null || typeof v !== "object" || toPath.has(v)) return;
    toPath.set(v, path); toObj.set(path, v);
    if (v instanceof Map) for (const [k, x] of v) walk(x, `${path}/${String(k)}`);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}/${i}`));
    else for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], `${path}/${k}`);
  };
  walk(rules, "");
  return { toPath, toObj };
}

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** The world as plain JSON data. `ui` is kept beside it as it is. */
export function saveWorld(w: World, ui?: unknown): SaveFile {
  const { toPath } = rulesIndex(w.rules);
  const ids = new Map<object, number>();
  const table: unknown[] = [];
  const enc = (v: unknown): unknown => {
    if (v === undefined) return { u: 1 };
    if (typeof v === "number") return Number.isFinite(v) ? v : { n: String(v) };
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "function") throw new Error("save: a function cannot be saved");
    if (typeof v !== "object") throw new Error(`save: cannot save a ${typeof v}`);
    const r = toPath.get(v);
    if (r !== undefined) return { r };
    const k = CONSTANT_OF.get(v);
    if (k !== undefined) return { k };
    const seen = ids.get(v);
    if (seen !== undefined) return { $: seen };
    const id = table.length;
    ids.set(v, id);
    table.push(null);
    let out: unknown;
    if (ArrayBuffer.isView(v)) {
      const name = Object.keys(TYPED).find((k) => v instanceof TYPED[k as keyof typeof TYPED]);
      if (!name) throw new Error("save: cannot save this kind of array");
      out = { t: name, b: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    } else if (Array.isArray(v)) out = { a: v.map(enc) };
    else if (v instanceof Map) out = { m: [...v].map(([k, x]) => [enc(k), enc(x)]) };
    else if (v instanceof Set) out = { s: [...v].map(enc) };
    else {
      const proto = Object.getPrototypeOf(v);
      const name = proto === Object.prototype ? "" : CLASS_OF.get(proto);
      if (name === undefined) throw new Error(`save: no way to load a ${proto?.constructor?.name ?? "thing"}`);
      const skip = SKIP[name] ?? [];
      const f: Record<string, unknown> = {};
      for (const k of Object.keys(v)) if (!skip.includes(k)) f[k] = enc((v as Record<string, unknown>)[k]);
      out = name ? { c: name, f } : { f };
    }
    table[id] = out;
    return { $: id };
  };
  const root = enc(w);
  return { format: SAVE_FORMAT, saved: new Date().toISOString(), time: w.time, world: { root, table }, ui };
}

/** A world back from a save, with these rules. */
export function loadWorld(file: SaveFile, rules: Rules): World {
  if (file.format !== SAVE_FORMAT) throw new Error(`This save is from another version of the game (format ${file.format}, this one reads ${SAVE_FORMAT})`);
  const { toObj } = rulesIndex(rules);
  const { root, table } = file.world as { root: unknown; table: Record<string, unknown>[] };
  const made: unknown[] = new Array(table.length);
  // First every object, empty, so references can point at any of them; then their contents.
  table.forEach((e, i) => {
    if ("t" in e) {
      const T = TYPED[e.t as keyof typeof TYPED];
      const bytes = unb64(e.b as string);
      made[i] = new T(bytes.buffer, bytes.byteOffset, bytes.byteLength / T.BYTES_PER_ELEMENT);
    } else if ("a" in e) made[i] = [];
    else if ("m" in e) made[i] = new Map();
    else if ("s" in e) made[i] = new Set();
    else if ("c" in e) {
      const C = CLASSES[e.c as string];
      if (!C) throw new Error(`save: unknown kind of object ${e.c}`);
      made[i] = Object.create(C.prototype);
    } else made[i] = {};
  });
  const dec = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    if ("$" in o) return made[o.$ as number];
    if ("r" in o) {
      const x = toObj.get(o.r as string);
      if (!x) throw new Error(`This save refers to ${o.r}, which these rules do not have`);
      return x;
    }
    if ("k" in o) {
      const x = CONSTANTS[o.k as string];
      if (!x) throw new Error(`save: unknown constant ${o.k}`);
      return x;
    }
    if ("u" in o) return undefined;
    if ("n" in o) return Number(o.n);
    throw new Error("save: unreadable value");
  };
  table.forEach((e, i) => {
    const m = made[i];
    if ("a" in e) (m as unknown[]).push(...(e.a as unknown[]).map(dec));
    else if ("m" in e) for (const [k, x] of e.m as [unknown, unknown][]) (m as Map<unknown, unknown>).set(dec(k), dec(x));
    else if ("s" in e) for (const x of e.s as unknown[]) (m as Set<unknown>).add(dec(x));
    else if ("f" in e) for (const [k, x] of Object.entries(e.f as Record<string, unknown>)) (m as Record<string, unknown>)[k] = dec(x);
  });
  const w = dec(root) as World;
  if (!(w instanceof World)) throw new Error("save: this is not a saved game");
  const pf = new Pathfinder(w.map);
  pf.maxExpanded = Math.max(9000, w.map.width * w.map.height);
  (w as unknown as { pathfinder: Pathfinder }).pathfinder = pf;
  return w;
}
