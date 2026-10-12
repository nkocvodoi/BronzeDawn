// Reads a Rise of Rome saved game (.gmx): the map's size, each tile's terrain and elevation, and the objects
// on it, for checking Bronze Dawn's random maps against the original's (scripts/aoe/compare-maps.ts).
//
// The file is one raw deflate stream. Inside, the map size is at 106 (twice, width then height). The tiles are
// 9-byte records, terrain then elevation first; they are found as the first run of width x height records that
// all look like tiles (terrain <= 24, elevation <= 7, the fifth byte a multiple of 32). Objects are records
// of: type (10 static, 20 moving, 30 resource, 70 living, 80 building...), owner (0 nature), unit id (u16),
// then x, y, z as floats at +23, +27, +31. They are found by that shape, so the odd stray match is possible:
// count by unit id and type, not one by one.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

export interface SaveObject { type: number; owner: number; id: number; x: number; y: number }
export interface SavedMap { W: number; terrain: Uint8Array; elevation: Uint8Array; objects: SaveObject[] }

export function readGmx(path: string): SavedMap {
  const b = inflateRawSync(readFileSync(path));
  const W = b.readUInt32LE(106);
  if (b.readUInt32LE(110) !== W || W < 40 || W > 256) throw new Error(`${path}: no map size where a Rise of Rome save has it`);
  const N = W * W;
  let at = -1;
  for (let i = 114; i < b.length - N * 9 && at < 0; i++) {
    let ok = true;
    for (let k = 0; k < N; k++) {
      const p = i + k * 9;
      if (b[p] > 24 || b[p + 1] > 7 || b[p + 4] % 32 !== 0) { ok = false; break; }
    }
    if (ok) at = i;
  }
  if (at < 0) throw new Error(`${path}: no tiles found`);
  const terrain = new Uint8Array(N), elevation = new Uint8Array(N);
  for (let k = 0; k < N; k++) { terrain[k] = b[at + k * 9]; elevation[k] = b[at + k * 9 + 1]; }
  const TYPES = new Set([10, 20, 25, 30, 40, 50, 60, 70, 80]);
  const objects: SaveObject[] = [];
  for (let r = at + N * 9; r < b.length - 40; r++) {
    if (!TYPES.has(b[r]) || b[r + 1] > 8) continue;
    const id = b.readUInt16LE(r + 2);
    if (id > 900) continue;
    const x = b.readFloatLE(r + 23), y = b.readFloatLE(r + 27), z = b.readFloatLE(r + 31);
    if (!(x > 0 && x < W && y > 0 && y < W && z >= 0 && z < 8)) continue;
    objects.push({ type: b[r], owner: b[r + 1], id, x, y });
  }
  return { W, terrain, elevation, objects };
}
