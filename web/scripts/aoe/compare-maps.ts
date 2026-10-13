// A map from the original (a Rise of Rome save, .gmx) against Bronze Dawn's generator for the same kind and
// size of map and the same number of players: water, ground, hills, what lies where round each Town Center.
// Save a game right at the start (Single Player, Random Map), then:
//
//   npx tsx scripts/aoe/compare-maps.ts <save.gmx> <map type> [seeds] [maps.json]
//   npx tsx scripts/aoe/compare-maps.ts assets-local/saves/Inland-1.gmx inland
//
// Map types are Bronze Dawn's (inland, hill_country, small_islands...). maps.json, to try other map data, is
// data/aoe-maps.json by default. A row ends in "x" when Bronze Dawn's average is more than a quarter off.
// One saved game is one map: forests and deserts swing a lot from map to map (and one map in four has the
// original's "dry" ground, twice the desert and half the forest), so look at several saves before reading much
// into one row.
import { readFileSync } from "node:fs";
import { AOE_MAP_IDS, AOE_MAPS, AoeMapGen } from "../../src/core/aoemap";
import { readGmx } from "./gmx";

const AOE_UNITS: Record<number, string> = { 66: "gold", 102: "stone", 59: "berry", 65: "gazelle", 48: "elephant", 126: "lion", 1: "alligator", 53: "fish", 260: "fish", 263: "fish", 370: "fish", 109: "tc" };
const BD_UNITS: Record<string, string> = { gold_mine: "gold", stone_mine: "stone", berry_bush: "berry", gazelle: "gazelle", elephant: "elephant", lion: "lion", alligator: "alligator", fish: "fish", deep_fish: "fish", town_center: "tc" };
const FOREST = new Set([10, 19, 20]);
interface Map { W: number; terrain: ArrayLike<number>; elevation: ArrayLike<number>; objects: { kind: string; x: number; y: number }[] }
type Stats = Record<string, number>;

function stats(m: Map): Stats {
  const { W } = m, N = W * W, t = m.terrain, s: Stats = {};
  const share = (f: (v: number) => boolean) => { let c = 0; for (let i = 0; i < N; i++) if (f(t[i])) c++; return (100 * c) / N; };
  const water = (v: number) => v === 1 || v === 22;
  s["water %"] = share(water); s["deep water %"] = share((v) => v === 22); s["shallows %"] = share((v) => v === 4);
  s["beach %"] = share((v) => v === 2); s["desert %"] = share((v) => v === 6); s["forest %"] = share((v) => FOREST.has(v)); s["palms %"] = share((v) => v === 13);
  let hills = 0; for (let i = 0; i < N; i++) if (m.elevation[i] > 0) hills++;
  s["hills %"] = (100 * hills) / N;
  let edge = 0, edgeN = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (x < 3 || y < 3 || x >= W - 3 || y >= W - 3) { edgeN++; if (water(t[y * W + x])) edge++; }
  s["map edge that is water %"] = (100 * edge) / edgeN;
  const tcs = m.objects.filter((o) => o.kind === "tc");
  // All the Town Centers on one piece of land?
  const seen = new Uint8Array(N), first = Math.floor(tcs[0].y) * W + Math.floor(tcs[0].x), todo = [first];
  seen[first] = 1;
  while (todo.length) {
    const i = todo.pop()!, x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < W && !seen[j] && !water(t[j])) { seen[j] = 1; todo.push(j); }
    }
  }
  s["TCs joined by land (1 = yes)"] = tcs.every((c) => seen[Math.floor(c.y) * W + Math.floor(c.x)]) ? 1 : 0;
  for (const k of ["gold", "stone", "berry", "gazelle", "elephant", "lion", "alligator", "fish"]) s[`${k} on the map`] = m.objects.filter((o) => o.kind === k).length;
  // Round each Town Center, by the larger of dx and dy (the original's distances), on average.
  const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const per = (f: (c: { x: number; y: number }) => number) => tcs.reduce((a, c) => a + f(c), 0) / tcs.length;
  const near = (k: string, r: number) => per((c) => m.objects.filter((o) => o.kind === k && cheb(o, c) < r).length);
  s["gold within 20, per player"] = near("gold", 20); s["stone within 20"] = near("stone", 20);
  s["berries within 17"] = near("berry", 17); s["gazelles within 25"] = near("gazelle", 25);
  const forest = (r0: number, r1: number) => per((c) => {
    let n = 0;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (FOREST.has(t[y * W + x])) { const d = cheb({ x: x + 0.5, y: y + 0.5 }, c); if (d >= r0 && d < r1) n++; }
    return n;
  });
  s["forest tiles within 12"] = forest(0, 12); s["forest tiles 12 to 20"] = forest(12, 20);
  s["closest two TCs"] = Math.min(...tcs.flatMap((a, i) => tcs.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
  return s;
}

const [file, type, seedsArg = "8", mapsPath] = process.argv.slice(2).filter((a) => a !== "--");
if (!file || !(type in AOE_MAP_IDS)) {
  console.error(`usage: npx tsx scripts/aoe/compare-maps.ts <save.gmx> <${Object.keys(AOE_MAP_IDS).join("|")}> [seeds] [maps.json]`);
  process.exit(1);
}
if (mapsPath) JSON.parse(readFileSync(mapsPath, "utf8")).maps.forEach((m: object, i: number) => Object.assign(AOE_MAPS[i], m));
const save = readGmx(file);
// Animals are type 70; id 1 is the alligator only as one of them.
const real: Map = {
  W: save.W, terrain: save.terrain, elevation: save.elevation,
  objects: save.objects.filter((o) => AOE_UNITS[o.id] && (o.id !== 1 || o.type === 70) && (o.id === 109 ? o.owner > 0 : o.owner === 0))
    .map((o) => ({ kind: AOE_UNITS[o.id], x: o.x, y: o.y })),
};
const players = real.objects.filter((o) => o.kind === "tc").length;
const ours = Array.from({ length: Number(seedsArg) }, (_, i) => {
  const g = new AoeMapGen(AOE_MAPS[AOE_MAP_IDS[type]], save.W, players, i + 1).generate();
  return stats({
    W: save.W, terrain: g.terrain, elevation: g.elevation,
    objects: g.placed.filter((p) => BD_UNITS[p.unit] && (p.unit !== "town_center" || p.player > 0)).map((p) => ({ kind: BD_UNITS[p.unit], x: p.x, y: p.y })),
  });
});
const theirs = stats(real);
const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
console.log(`${type}, ${save.W} x ${save.W}, ${players} players: the original's map against ${ours.length} of Bronze Dawn's`);
console.log("".padEnd(30), "original".padStart(9), "  Bronze Dawn: mean (lowest-highest)");
for (const k of Object.keys(theirs)) {
  const vs = ours.map((s) => s[k]), mean = vs.reduce((a, b) => a + b, 0) / vs.length;
  const off = Math.abs(mean - theirs[k]) > Math.max(1.5, Math.abs(theirs[k]) * 0.25) ? "  x" : "";
  console.log(k.padEnd(30), f(theirs[k]).padStart(9), `  ${f(mean)} (${f(Math.min(...vs))}-${f(Math.max(...vs))})${off}`);
}
