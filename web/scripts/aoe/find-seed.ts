// Finds the seed the original made a saved game's map with, then says how much of Bronze Dawn's map from that seed
// is tile for tile the same. The original's seed is a rand(), so 0 to 32767; its land origins (where the Town
// Centers stand) come before anything Bronze Dawn does not do bit for bit, so trying every seed until they match
// finds it, and finds only it.
//
//   npx tsx scripts/aoe/find-seed.ts <map type> <save.gmx>...
//   npx tsx scripts/aoe/find-seed.ts coastal assets-local/saves/Coastal-1.gmx
//
// Then, for that seed: the share of tiles alike for land and water (the lands), elevation (the hills), forest and
// desert (the patches), and the gold mines on the same tile (the objects). Where a share drops, Bronze Dawn's
// random numbers have parted from the original's (replica/game/aoe1-mapgen.md, §8 and §10).
import { AOE_MAP_IDS, AOE_MAPS, AoeMapGen } from "../../src/core/aoemap";
import { readGmx } from "./gmx";

const [type, ...files] = process.argv.slice(2).filter((a) => a !== "--");
if (!files.length || !(type in AOE_MAP_IDS)) {
  console.error(`usage: npx tsx scripts/aoe/find-seed.ts <${Object.keys(AOE_MAP_IDS).join("|")}> <save.gmx>...`);
  process.exit(1);
}

// Stop each try right after the lands are placed: the rest is not needed to know the seed.
class Placed extends Error {}
const gen = AoeMapGen.prototype as unknown as { landInit(): void; slots: { player: number; x: number; y: number }[] };
const landInit = gen.landInit;
let origins: { x: number; y: number }[] = [];

const WATER = new Set([1, 22]), FOREST = new Set([10, 13, 19, 20]);
for (const file of files) {
  const s = readGmx(file), W = s.W, N = W * W;
  const tcs = s.objects.filter((o) => o.id === 109 && o.owner > 0);
  gen.landInit = function (this: typeof gen) {
    landInit.call(this);
    origins = this.slots.filter((l) => l.player > 0).map((l) => ({ x: l.x, y: l.y }));
    throw new Placed();
  };
  const seeds: number[] = [];
  for (let seed = 0; seed < 32768; seed++) {
    try { new AoeMapGen(AOE_MAPS[AOE_MAP_IDS[type]], W, tcs.length, seed).generate(); } catch (e) { if (!(e instanceof Placed)) throw e; }
    // A Town Center stands on its land's origin, the tile just above and left of it.
    if (tcs.every((t) => origins.some((o) => Math.abs(Math.floor(t.x) + 1 - o.x) <= 1 && Math.abs(Math.floor(t.y) + 1 - o.y) <= 1))) seeds.push(seed);
  }
  gen.landInit = landInit;
  if (seeds.length !== 1) { console.log(`${file}: ${seeds.length ? `seeds ${seeds.join(", ")} all fit` : "no seed fits"}`); continue; }
  const g = new AoeMapGen(AOE_MAPS[AOE_MAP_IDS[type]], W, tcs.length, seeds[0]).generate();
  let wet = 0, elev = 0, forest = 0, desert = 0, same = 0;
  for (let i = 0; i < N; i++) {
    const a = s.terrain[i], b = g.terrain[i];
    if (WATER.has(a) === WATER.has(b)) wet++;
    if (s.elevation[i] === g.elevation[i]) elev++;
    if (FOREST.has(a) === FOREST.has(b)) forest++;
    if ((a === 6) === (b === 6)) desert++;
    if (a === b) same++;
  }
  const at = (x: number, y: number) => `${Math.floor(x)},${Math.floor(y)}`;
  const gold = new Set(s.objects.filter((o) => o.id === 66 && o.owner === 0).map((o) => at(o.x, o.y)));
  const goldSame = g.placed.filter((p) => p.unit === "gold_mine" && gold.has(at(p.x, p.y))).length;
  const pc = (v: number) => `${((100 * v) / N).toFixed(1)}%`;
  console.log(`${file}: seed ${seeds[0]}; alike: land/water ${pc(wet)}, elevation ${pc(elev)}, forest ${pc(forest)}, desert ${pc(desert)}, ` +
    `every tile ${pc(same)}; gold mines on the same tile ${goldSame} of ${gold.size}`);
}
