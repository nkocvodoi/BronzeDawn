// The original's nine random maps, as the numbers its generator reads, for data/aoe-maps.json: the margins,
// the lands, the patches of ground and the objects of each, as they are in empires.dat. Numbers only, like
// rules.json: no picture, sound or text of the game.
//
//   npx tsx scripts/aoe/rms-data.ts assets-local/aoe-data/empires-ror.json ../data/aoe-maps.json
//
// Unit ids are turned into Bronze Dawn's names where it has the thing; the rest keep the original's id with a
// name of their own, so the generator draws its random numbers for them all the same.

import { readFileSync, writeFileSync } from "node:fs";
import type { DatGraphic, DatMap, DatTerrain } from "./dat";

interface DatUnit {
  name: string; type: number; terrainRestriction: number; collisionSize: number[]; clearanceSize: number[];
  placementTerrain: number[]; placementSideTerrain: number[]; hillMode: number; standingGraphic: number; canBeBuiltOn: number;
  moving?: { runningGraphic: number };
}

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
  randomMaps: DatMap[]; terrainRestrictions: number[][]; civs: { units: (DatUnit | null)[] }[];
  map: { terrains: DatTerrain[] }; graphics: DatGraphic[];
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
    unit: name(u.unit), id: u.unit, host: u.hostTerrain, placing: u.groupPlacing, scale: u.scaleFlag, perGroup: u.objectsPerGroup,
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
// Each terrain's own things, as the generator puts them on a tile it sets (rocks in the water, tufts on the
// grass, the trees of a forest): [unit id, density, centred]. Density is in thousandths of a chance per tile,
// a thing more for each whole thousand. Only those nature (player 0) has, with a density: the others draw nothing.
const gaia = dat.civs[0].units as (DatUnit | null)[];
const terrainUnits: Record<number, [number, number, number][]> = {};
dat.map.terrains.forEach((t, i) => {
  const list = t.units.filter((u) => u.unit >= 0 && gaia[u.unit] && u.density > 0).map((u) => [u.unit, u.density, u.centering] as [number, number, number]);
  if (list.length) terrainUnits[i] = list;
});
// What the generator asks of each of those things and of the map's own when it puts one down: its size on the
// ground ([x, y] collision, height; clearance), the terrains it may stand on, the terrain it must be on or have
// beside it, whether it needs flat ground (1: no steep slope, 2: flat), and whether making it draws one random
// number more for a facing (a moving thing whose standing picture has several angles: genie type 30 and up,
// sequence flag 2).
// With the cliff pieces (264 to 272), which the cliffs put down before the objects.
const ids = new Set<number>([...Object.values(terrainUnits).flat().map((u) => u[0]), ...dat.randomMaps.slice(0, 9).flatMap((m) => m.units.map((u) => u.unit)), 264, 265, 266, 267, 268, 269, 270, 271, 272]);
const units: Record<number, object> = {};
for (const id of [...ids].sort((a, b) => a - b)) {
  const u = gaia[id] ?? (dat.civs[1].units[id] as DatUnit | null);
  if (!u) continue;
  const g = dat.graphics[u.standingGraphic];
  units[id] = {
    size: u.collisionSize, clearance: u.clearanceSize,
    on: (dat.terrainRestrictions[u.terrainRestriction] ?? []).map((v, t) => (v > 0 ? t : -1)).filter((t) => t >= 0),
    onTerrain: u.placementTerrain, besideTerrain: u.placementSideTerrain, hill: u.hillMode,
    facing: u.type >= 30 && g && g.angleCount > 1 ? 1 : 0, type: u.type,
    // A standing picture of several frames: one random number for the frame it starts on.
    frames: g ? g.frameCount : 1, sequence: g ? g.sequenceType : 0,
    // A running picture, which a moving thing draws for when made.
    run: (u.moving?.runningGraphic ?? -1) >= 0 ? 1 : 0,
    // A building is made finished, which draws one more (genie type 80); whether it may stand on things that
    // can be built over.
    building: u.type === 80 ? 1 : 0, buildOn: u.canBeBuiltOn,
  };
}
writeFileSync(outPath, JSON.stringify({
  source: "Age of Empires: The Rise of Rome, empires.dat, random maps 0 to 8 (numbers only)",
  standOn,
  terrainUnits,
  units,
  maps,
}, null, 1) + "\n");
console.log(`${maps.length} maps -> ${outPath}`);
