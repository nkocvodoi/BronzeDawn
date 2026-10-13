// A map from the original (a Rise of Rome save, .gmx) against Bronze Dawn's generator for the same kind and
// size of map and the same number of players: water, ground, hills, what lies where round each Town Center.
// Save a game right at the start (Single Player, Random Map), then:
//
//   npx tsx scripts/aoe/compare-maps.ts <map type> <save.gmx>... [--seeds 8] [--maps maps.json]
//   npx tsx scripts/aoe/compare-maps.ts inland assets-local/saves/Inland-1.gmx assets-local/saves/Inland-2.gmx
//
// Map types are Bronze Dawn's (inland, hill_country, small_islands...). Each save gets --seeds of Bronze Dawn's
// maps at its size and players. --maps, to try other map data, is data/aoe-maps.json by default. A row ends in
// "x" when the two means are more than a quarter apart and the two ranges do not even meet. One saved game is one
// map: forests and deserts swing a lot from map to map (and one map in four has the original's "dry" ground,
// twice the desert and half the forest), so give it several saves of each kind.
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

const argv = process.argv.slice(2).filter((a) => a !== "--");
const opt = (name: string, dflt: string) => { const i = argv.indexOf(name); if (i < 0) return dflt; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const seeds = Number(opt("--seeds", "8")), mapsPath = opt("--maps", "");
const [type, ...files] = argv;
if (!files.length || !(type in AOE_MAP_IDS)) {
  console.error(`usage: npx tsx scripts/aoe/compare-maps.ts <${Object.keys(AOE_MAP_IDS).join("|")}> <save.gmx>... [--seeds 8] [--maps maps.json]`);
  process.exit(1);
}
if (mapsPath) JSON.parse(readFileSync(mapsPath, "utf8")).maps.forEach((m: object, i: number) => Object.assign(AOE_MAPS[i], m));
const theirs: Stats[] = [], ours: Stats[] = [];
const sizes: string[] = [];
for (const file of files) {
  const save = readGmx(file);
  // Animals are type 70; id 1 is the alligator only as one of them.
  const real: Map = {
    W: save.W, terrain: save.terrain, elevation: save.elevation,
    objects: save.objects.filter((o) => AOE_UNITS[o.id] && (o.id !== 1 || o.type === 70) && (o.id === 109 ? o.owner > 0 : o.owner === 0))
      .map((o) => ({ kind: AOE_UNITS[o.id], x: o.x, y: o.y })),
  };
  const players = real.objects.filter((o) => o.kind === "tc").length;
  sizes.push(`${save.W}x${save.W}, ${players} players`);
  theirs.push(stats(real));
  // As many of ours for each save, at its size and with its players.
  for (let i = 0; i < seeds; i++) {
    const g = new AoeMapGen(AOE_MAPS[AOE_MAP_IDS[type]], save.W, players, theirs.length * 1000 + i + 1).generate();
    ours.push(stats({
      W: save.W, terrain: g.terrain, elevation: g.elevation,
      objects: g.placed.filter((p) => BD_UNITS[p.unit] && (p.unit !== "town_center" || p.player > 0)).map((p) => ({ kind: BD_UNITS[p.unit], x: p.x, y: p.y })),
    }));
  }
}
const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const sum = (xs: Stats[], k: string) => { const vs = xs.map((s) => s[k]); return { mean: vs.reduce((a, b) => a + b, 0) / vs.length, lo: Math.min(...vs), hi: Math.max(...vs) }; };
console.log(`${type}: ${files.length} of the original's maps (${sizes.join("; ")}) against ${ours.length} of Bronze Dawn's`);
console.log("".padEnd(30), "original: mean (lowest-highest)".padEnd(34), "Bronze Dawn: mean (lowest-highest)");
// "x": the means are more than a quarter apart and the two ranges do not even meet.
for (const k of Object.keys(theirs[0])) {
  const a = sum(theirs, k), b = sum(ours, k);
  const off = Math.abs(b.mean - a.mean) > Math.max(1.5, Math.abs(a.mean) * 0.25) && (b.lo > a.hi || b.hi < a.lo) ? "  x" : "";
  console.log(k.padEnd(30), `${f(a.mean)} (${f(a.lo)}-${f(a.hi)})`.padEnd(34), `${f(b.mean)} (${f(b.lo)}-${f(b.hi)})${off}`);
}
