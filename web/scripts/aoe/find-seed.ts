// Finds the seed the original made a saved game's map with, then says how much of Bronze Dawn's map from that seed
// is the original's, step by step. The original's seed is a rand(), so 0 to 32767; its land origins (where the
// Town Centers stand) come before anything else, so trying every seed until they match finds it, and finds only it.
//
//   npx tsx scripts/aoe/find-seed.ts <map type> <save.gmx>... [--seed n] [--teams 0,0,1,1]
//   npx tsx scripts/aoe/find-seed.ts coastal assets-local/saves/Coastal-1.gmx
//
// A game played with allies has its lands handed out again so that allies are neighbours (the end of
// FUN_0046f6e0): when the save's Town Centers stand on the right origins but not each on its own player's, the
// teams that put them there are looked for too (a team number per player, as World takes them).
//
// Then, for that seed, the share of tiles alike for land and water (the lands), shallows, elevation (the hills),
// forest and desert (the patches), every tile; and how many of the save's things stand on the same spot as ours:
// the cliff pieces, each terrain's own things (trees, tufts, rocks), and the map's own (Town Centers, mines,
// berries, fish, trees, animals). Villagers of the computer players, animals and birds may have moved before the
// game was saved: they are counted apart (replica/game/aoe1-mapgen.md, §10).
import { AOE_MAP_IDS, AOE_MAPS, AoeMapGen, type Placed } from "../../src/core/aoemap";
import maps from "../../../data/aoe-maps.json";
import { readGmx, type SavedMap } from "./gmx";

const args = process.argv.slice(2).filter((a) => a !== "--");
const opt = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const fixedSeed = opt("--seed"), fixedTeams = opt("--teams");
const [type, ...files] = args;
if (!files.length || !(type in AOE_MAP_IDS)) {
  console.error(`usage: npx tsx scripts/aoe/find-seed.ts <${Object.keys(AOE_MAP_IDS).join("|")}> <save.gmx>... [--seed n] [--teams 0,0,1,1]`);
  process.exit(1);
}
const MAP = AOE_MAPS[AOE_MAP_IDS[type]];

// Stop each try right after the lands are placed (and their team reorder): the rest is not needed to know the seed.
class Placed1 extends Error {}
const gen = AoeMapGen.prototype as unknown as { landInit(): void; slots: { player: number; x: number; y: number }[] };
const landInit = gen.landInit;
function origins(W: number, players: number, seed: number, teams: number[]) {
  let out: { x: number; y: number }[] = [];
  gen.landInit = function (this: typeof gen) { landInit.call(this); out = this.slots.filter((l) => l.player > 0).map((l) => ({ x: l.x, y: l.y })); throw new Placed1(); };
  try { new AoeMapGen(MAP, W, players, seed, teams).generate(); } catch (e) { if (!(e instanceof Placed1)) throw e; }
  gen.landInit = landInit;
  return out;
}
// A Town Center stands on its land's origin, the tile just above and left of it.
const onOrigin = (t: { x: number; y: number }, o: { x: number; y: number }) => Math.abs(Math.floor(t.x) + 1 - o.x) <= 1 && Math.abs(Math.floor(t.y) + 1 - o.y) <= 1;

/** All team numberings of n players up to renaming: each player on a team of its own (0) or with others. */
function teamings(n: number): number[][] {
  const out: number[][] = [];
  const rec = (i: number, t: number[], next: number) => {
    if (i === n) { out.push([...t]); return; }
    for (let k = 1; k <= next; k++) { t[i] = k; rec(i + 1, t, Math.max(next, k + 1)); }
  };
  rec(0, [], 1);
  // A team of one is the same as none.
  return out.map((t) => t.map((k) => (t.filter((x) => x === k).length > 1 ? k : 0)));
}

const UNIT_IDS = new Set(Object.keys((maps as unknown as { units: object }).units).map(Number));
const TERRAIN_UNIT_IDS = new Set(Object.values((maps as unknown as { terrainUnits: Record<string, number[][]> }).terrainUnits).flat().map((u) => u[0]));
const MOVING = new Set([65, 48, 126, 1, 95, 96]);
const WATER = new Set([1, 22]), FOREST = new Set([10, 13, 19, 20]);

function report(file: string, s: SavedMap, seed: number, teams: number[], players: number) {
  const W = s.W, N = W * W;
  const g = new AoeMapGen(MAP, W, players, seed, teams).generate();
  let wet = 0, sh = 0, elev = 0, forest = 0, desert = 0, same = 0;
  for (let i = 0; i < N; i++) {
    const a = s.terrain[i], b = g.terrain[i];
    if (WATER.has(a) === WATER.has(b)) wet++;
    if ((a === 4) === (b === 4)) sh++;
    if (s.elevation[i] === g.elevation[i]) elev++;
    if (FOREST.has(a) === FOREST.has(b)) forest++;
    if ((a === 6) === (b === 6)) desert++;
    if (a === b) same++;
  }
  const key = (o: { id?: number; x: number; y: number }) => `${o.id}@${o.x},${o.y}`;
  const saved = new Set(s.objects.map(key));
  const ours = g.placed.filter((p) => !p.gone && p.id !== undefined && UNIT_IDS.has(p.id));
  const count = (f: (p: Placed) => boolean) => { const l = ours.filter(f); return `${l.filter((p) => saved.has(key(p))).length}/${l.length}`; };
  const cliff = (p: Placed) => p.unit === "cliff", tu = (p: Placed) => p.unit !== "cliff" && TERRAIN_UNIT_IDS.has(p.id!) && p.group === 0;
  const own = (p: Placed) => !cliff(p) && !tu(p) && !MOVING.has(p.id!) && !(p.id === 83 && p.player !== 1);
  const moving = (p: Placed) => !cliff(p) && !tu(p) && !own(p);
  const pc = (v: number) => `${((100 * v) / N).toFixed(1)}%`;
  console.log(`${file}: seed ${seed}${teams.some((t) => t > 0) ? `, teams ${teams.join(",")}` : ""}; tiles alike: land/water ${pc(wet)}, shallows ${pc(sh)}, ` +
    `elevation ${pc(elev)}, forest ${pc(forest)}, desert ${pc(desert)}, every tile ${pc(same)}; things on the save's spot: ` +
    `cliff pieces ${count(cliff)}, terrains' own ${count(tu)}, the map's own ${count(own)}, ` +
    `gold ${count((p) => p.id === 66)}; may have moved: ${count(moving)}`);
}

for (const file of files) {
  const s = readGmx(file), W = s.W;
  const tcs = s.objects.filter((o) => o.id === 109 && o.owner > 0).sort((a, b) => a.owner - b.owner);
  const players = tcs.length;
  let seeds: number[] = [];
  if (fixedSeed !== undefined) seeds = [Number(fixedSeed)];
  else for (let seed = 0; seed < 32768; seed++) {
    const o = origins(W, players, seed, []);
    if (tcs.every((t) => o.some((q) => onOrigin(t, q)))) seeds.push(seed);
  }
  if (seeds.length !== 1) { console.log(`${file}: ${seeds.length ? `seeds ${seeds.join(", ")} all fit` : "no seed fits"}`); continue; }
  // Each player on its own origin, or with which teams.
  let teams = fixedTeams ? fixedTeams.split(",").map(Number) : new Array(players).fill(0);
  if (!fixedTeams) {
    const fits = (t: number[]) => { const o = origins(W, players, seeds[0], t); return tcs.every((tc) => onOrigin(tc, o[tc.owner - 1])); };
    if (!fits(teams)) teams = teamings(players).find(fits) ?? teams;
  }
  report(file, s, seeds[0], teams, players);
}
