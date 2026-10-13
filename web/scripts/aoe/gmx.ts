// Reads a Rise of Rome saved game (.gmx): the map's size, each tile's terrain and elevation, and the objects
// on it, for checking Bronze Dawn's random maps against the original's (scripts/aoe/compare-maps.ts).
//
// The file is one raw deflate stream. Inside, the map size is at 106 (twice, width then height). The tiles are
// 9-byte records, row by row, each starting with where the tile is drawn: x as a short, (x + y) * 32, which no
// other run of the file repeats width x height times; terrain and elevation are bytes 5 and 6. Objects are records
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
  // A tile's record starts with where it is drawn, x as a short: (x + y) * 32, which nothing else in the file
  // repeats 20 736 times. Terrain and elevation are the record's sixth and seventh bytes.
  let at = -1;
  for (let i = 114; i + N * 9 <= b.length && at < 0; i++) {
    let ok = true;
    for (let k = 0; k < N && ok; k++) { const x = k % W; if (b.readInt16LE(i + k * 9) !== (x + (k - x) / W) * 32) ok = false; }
    if (ok) at = i;
  }
  if (at < 0) throw new Error(`${path}: no tiles found`);
  const terrain = new Uint8Array(N), elevation = new Uint8Array(N);
  for (let k = 0; k < N; k++) { terrain[k] = b[at + k * 9 + 5]; elevation[k] = b[at + k * 9 + 6]; }
  const TYPES = new Set([10, 20, 25, 30, 40, 50, 60, 70, 80]);
  const objects: SaveObject[] = [];
  for (let r = at + N * 9; r < b.length - 40; r++) {
    if (!TYPES.has(b[r]) || b[r + 1] > 8) continue;
    const id = b.readUInt16LE(r + 2);
    if (id > 900) continue;
    const x = b.readFloatLE(r + 23), y = b.readFloatLE(r + 27), z = b.readFloatLE(r + 31);
    // Stray matches have tiny numbers here (1e-36 and the like); nothing real stands within 1e-5 of the edge.
    if (!(x > 1e-5 && x < W && y > 1e-5 && y < W && z >= 0 && z < 8)) continue;
    objects.push({ type: b[r], owner: b[r + 1], id, x, y });
  }
  return { W, terrain, elevation, objects };
}
