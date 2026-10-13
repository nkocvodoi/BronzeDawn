// The original's nine random maps, as the numbers its generator reads, for data/aoe-maps.json: the margins,
// the lands, the patches of ground and the objects of each, as they are in empires.dat. Numbers only, like
// rules.json: no picture, sound or text of the game.
//
//   npx tsx scripts/aoe/rms-data.ts assets-local/aoe-data/empires-ror.json ../data/aoe-maps.json
//
// Unit ids are turned into Bronze Dawn's names where it has the thing; the rest keep the original's id with a
// name of their own, so the generator draws its random numbers for them all the same.

import { readFileSync, writeFileSync } from "node:fs";
import type { DatMap } from "./dat";

/** The original's units on its maps, by id: Bronze Dawn's name for each, or "-" for those it has no use for. */
const UNITS: Record<number, string> = {
  109: "town_center", 83: "villager", 66: "gold_mine", 102: "stone_mine", 59: "berry_bush", 65: "gazelle",
  48: "elephant", 126: "lion", 1: "alligator", 53: "fish", 260: "fish", 263: "fish", 370: "deep_fish",
  // Lone trees (Tree90..Tree94 and the like): one tile of wood each.
  56: "lone_tree", 195: "lone_tree", 365: "lone_tree", 366: "lone_tree", 367: "lone_tree",
  // Pigeons: nothing in Bronze Dawn, kept so that a map draws its numbers as the original does.
  95: "-", 96: "-", 303: "-",
};

const [datPath, outPath] = process.argv.slice(2);
if (!datPath || !outPath) {
  console.error("usage: npx tsx scripts/aoe/rms-data.ts <empires-ror.json> <aoe-maps.json>");
  process.exit(1);
}
const dat = JSON.parse(readFileSync(datPath, "utf8")) as {
  randomMaps: DatMap[]; terrainRestrictions: number[][]; civs: { units: ({ name: string; terrainRestriction: number } | null)[] }[];
};
const name = (id: number) => UNITS[id] ?? `aoe_${id}_${(dat.civs[0].units[id] ?? dat.civs[1].units[id])?.name ?? "unknown"}`.toLowerCase();
// The generator takes a map by its place in the file, not by the id each record carries: the map type indexes
// the table it loaded in file order, and the same number picks the type's own rules (6 adds the central sea,
// 7 the extra hills). So Mediterranean is the 7th record (whose id says 2), not the record with id 6.
const maps = dat.randomMaps.slice(0, 9).map((m, index) => ({
  id: index,
  datId: m.id,
  // b1..b4 as the generator names them: the x and y margins at the low and the high side.
  borders: [m.borders.southWest, m.borders.northWest, m.borders.northEast, m.borders.southEast],
  borderUsage: m.borders.usage,
  // "waterShape" in the data is how far in from the edge the lands' origins must be.
  margin: m.waterShape,
  baseTerrain: m.baseTerrain,
  landCoverage: m.landCoverage,
  lands: m.lands.map((l) => ({
    landId: l.landId, terrain: l.terrain, spacing: l.landSpacing, baseSize: l.baseSize, zone: l.zone,
    placement: l.placementType, baseX: l.baseX, baseY: l.baseY, proportion: l.landProportion, byPlayer: l.byPlayerFlag,
    startRadius: l.startAreaRadius, edgeFade: l.terrainEdgeFade, clumpiness: l.clumpiness,
  })),
  terrains: m.terrains.map((t) => ({
    terrain: t.terrain, proportion: t.proportion, clumps: t.clumpCount, edgeSpacing: t.edgeSpacing,
    on: t.placementTerrain, clumpiness: t.clumpiness,
  })),
  objects: m.units.map((u) => ({
    unit: name(u.unit), host: u.hostTerrain, placing: u.groupPlacing, scale: u.scaleFlag, perGroup: u.objectsPerGroup,
    fluctuation: u.fluctuation, groups: u.groupsPerPlayer, area: u.groupArea, player: u.playerId, land: u.setPlaceForAllPlayers,
    min: u.minDistanceToPlayers, max: u.maxDistanceToPlayers,
  })),
  elevations: m.elevations,
}));
// The ground each thing may be put on, from its terrain restriction (a table of terrain -> allowed). Mines and
// berries go on grass or desert only, animals not on beaches, the alligator and villagers on beaches and
// shallows too: on an island, what would sit on its beach rim goes further in.
const standOn: Record<string, number[]> = {};
for (const [id, nm] of Object.entries(UNITS)) {
  const u = dat.civs[0].units[Number(id)] ?? dat.civs[1].units[Number(id)];
  if (nm === "-" || !u || standOn[nm]) continue;
  standOn[nm] = (dat.terrainRestrictions[u.terrainRestriction] ?? []).map((v, t) => (v > 0 ? t : -1)).filter((t) => t >= 0);
}
writeFileSync(outPath, JSON.stringify({
  source: "Age of Empires: The Rise of Rome, empires.dat, random maps 0 to 8 (numbers only)",
  standOn,
  maps,
}, null, 1) + "\n");
console.log(`${maps.length} maps -> ${outPath}`);
