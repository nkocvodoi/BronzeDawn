// The original's random maps, read as Bronze Dawn's RandomMapSpec: how much land, how it is shared out,
// what ground and what things go where. export-aoe.ts writes them into the manifest it makes; this file
// also runs on its own, to add them to a manifest already made:
//
//   npm run aoe-maps -- assets-local/aoe-data/empires-ror.json assets-local/aoe-data/strings.json assets-local/manifest.json
//
// Like everything the importer writes, the result stays on the machine that owns the game: in assets-local/
// or a player's own art pack, never in the repository or the published site.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Host, RandomMapSpec } from "../../src/core/rmspec";
import type { DatMap } from "./dat";

/** The original's terrain ids, as far as a spec needs them. */
const TERRAIN = { grass: 0, water: 1, beach: 2, shallows: 4, desert: 6, forest: 10, palms: 13, pines: 19, jungle: 20, deep: 22 };

/** The original's objects, as Bronze Dawn's nodes and animals. Missing: the bases (placed by the game
 *  itself), birds, and anything else with nothing to stand for it. */
const OBJECT: Record<number, string> = {
  1: "alligator", 48: "elephant", 53: "fish", 56: "lone_tree", 59: "berry_bush", 65: "gazelle", 66: "gold_mine",
  102: "stone_mine", 126: "lion", 195: "lone_tree", 260: "fish", 263: "fish", 365: "lone_tree", 366: "lone_tree",
  367: "lone_tree", 370: "deep_fish",
};
const ANIMALS = new Set(["alligator", "elephant", "gazelle", "lion"]);

/** Hills and cliffs per Small map, by name, as Bronze Dawn's own maps of the same kind have them: the
 *  original's elevation lists are empty. */
const relief = (name: string): [number, number, boolean] =>
  /hill/i.test(name) ? [11, 8, true] : /highland/i.test(name) ? [9, 4, true] : /island/i.test(name) ? [2, 0, false] : [5, 3, false];

const host = (terrain: number, kind: string): Host => {
  if (terrain === TERRAIN.deep) return "deep";
  if (terrain === TERRAIN.water) return "water";
  if (terrain === TERRAIN.beach) return "beach";
  if (terrain === TERRAIN.shallows) return ANIMALS.has(kind) ? "beach" : "shallows";
  return "land";
};

/** One of the original's maps as a spec. `name` is its name from the string table. */
export function mapSpec(m: DatMap, name: string): RandomMapSpec {
  const land = m.lands[0] ?? {};
  const full = m.landCoverage >= 100;
  const patches: RandomMapSpec["patches"] = [];
  for (const t of m.terrains) {
    const kind = t.terrain === TERRAIN.desert ? "sand"
      : t.terrain === TERRAIN.palms ? "palms"
      : [TERRAIN.forest, TERRAIN.pines, TERRAIN.jungle].includes(t.terrain) ? "woods" : null;
    if (!kind) continue; // deep water: Bronze Dawn has one kind of water
    patches.push({ kind, share: t.proportion, clumps: t.clumpCount, on: t.placementTerrain === TERRAIN.desert ? "sand" : "grass", spacing: t.edgeSpacing });
  }
  const objects: RandomMapSpec["objects"] = [];
  for (const u of m.units) {
    let kind = OBJECT[u.unit];
    if (!kind) continue;
    const on = host(u.hostTerrain, kind);
    if (kind === "fish" && on === "deep") kind = "deep_fish";
    objects.push({
      kind, on, layout: u.groupPlacing === 2 ? "tight" : u.groupPlacing === 1 ? "loose" : "single",
      count: u.objectsPerGroup, spread: u.fluctuation, groups: u.groupsPerPlayer, area: u.groupArea,
      perPlayer: u.setPlaceForAllPlayers > 0, away: u.setPlaceForAllPlayers === -2,
      minDist: u.minDistanceToPlayers, maxDist: u.maxDistanceToPlayers, scale: u.scaleFlag === 1,
    });
  }
  const b = m.borders;
  return {
    name,
    // A map whose lands cover all of it is land, whatever it starts as.
    base: full ? "land" : m.baseTerrain === TERRAIN.water ? "water" : "land",
    land: m.landCoverage,
    border: full ? [0, 0, 0, 0] : [b.southWest, b.northWest, b.northEast, b.southEast],
    lands: land.byPlayerFlag === 2 ? "apart" : land.byPlayerFlag === 1 ? "joined" : "shared",
    spacing: land.landSpacing ?? 0,
    startRadius: land.startAreaRadius ?? 12,
    patches, objects,
    // The one land map meant to have a sea is the Coastal map.
    coast: full && /coast/i.test(name) ? true : undefined,
    relief: relief(name),
  };
}

/** The maps the original offers, in the order of their ids: 0 to 8 (the one numbered 9 is not offered,
 *  and the string where its name would be is a map size's). */
export function mapSpecs(maps: DatMap[], str: (id: number) => string): RandomMapSpec[] {
  return maps.filter((m) => m.id >= 0 && m.id <= 8).sort((a, b) => a.id - b.id).map((m) => ({ m, name: str(10602 + m.id) })).filter((x) => x.name).map((x) => mapSpec(x.m, x.name));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [datPath, stringsPath, manifestPath] = process.argv.slice(2);
  if (!datPath || !stringsPath || !manifestPath) {
    console.error("usage: npm run aoe-maps -- <empires-ror.json> <strings.json> <manifest.json>");
    process.exit(1);
  }
  const dat = JSON.parse(readFileSync(datPath, "utf8")) as { randomMaps: DatMap[] };
  const strings = JSON.parse(readFileSync(stringsPath, "utf8")) as Record<string, string>;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^﻿/, ""));
  manifest.maps = mapSpecs(dat.randomMaps, (id) => strings[String(id)] ?? "");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`${manifest.maps.length} maps written to ${manifestPath}: ${manifest.maps.map((m: RandomMapSpec) => m.name).join(", ")}`);
}
