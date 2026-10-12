import { describe, expect, it } from "vitest";
import { RULES } from "../src/core/data";
import { Tile } from "../src/core/geom";
import { Terrain } from "../src/core/grid";
import { isMapSpec, RandomMapSpec } from "../src/core/rmspec";
import { Res } from "../src/core/rules";
import { runMatch } from "../src/core/sim";
import { World } from "../src/core/world";

// Specs written for these tests, in the shape an art pack's maps take: none of them is anyone's map.
const obj = (kind: string, on: RandomMapSpec["objects"][number]["on"], layout: "single" | "loose" | "tight", count: number, groups: number,
  perPlayer: boolean, minDist = 0, maxDist = 0, away = false) =>
  ({ kind, on, layout, count, spread: 1, groups, area: 2, perPlayer, away, minDist, maxDist, scale: !perPlayer });
const objects = [
  obj("gold_mine", "land", "tight", 6, 1, true, 7, 12), obj("stone_mine", "land", "tight", 5, 1, true, 8, 13),
  obj("berry_bush", "land", "tight", 6, 1, true, 5, 9), obj("gazelle", "land", "loose", 4, 1, true, 8, 14),
  obj("lone_tree", "land", "single", 1, 3, true, 6, 10), obj("lion", "land", "single", 1, 2, false, 20, 0, true),
  obj("gold_mine", "land", "tight", 4, 2, false, 22, 0, true), obj("fish", "water", "single", 1, 8, false),
  obj("deep_fish", "deep", "single", 1, 6, false),
];
const patches: RandomMapSpec["patches"] = [
  { kind: "sand", share: 10, clumps: 5, on: "grass", spacing: 1 }, { kind: "woods", share: 12, clumps: 8, on: "grass", spacing: 3 },
  { kind: "palms", share: 15, clumps: 2, on: "sand", spacing: 3 },
];
const ISLANDS: RandomMapSpec = { name: "Test Isles", base: "water", land: 45, border: [10, 10, 10, 10], lands: "apart", spacing: 7, startRadius: 10, patches, objects, relief: [2, 0, false] };
const CONTINENT: RandomMapSpec = { name: "Test Continent", base: "water", land: 75, border: [6, 6, 6, 6], lands: "joined", spacing: 3, startRadius: 14, patches, objects };
const PLAINS: RandomMapSpec = { name: "Test Plains", base: "land", land: 100, border: [0, 0, 0, 0], lands: "apart", spacing: 2, startRadius: 14, patches, objects };
const COAST: RandomMapSpec = { ...PLAINS, name: "Test Coast", coast: true };

const make = (spec: RandomMapSpec, seed: number, players = 2, size = 72) =>
  new World(RULES, seed, ["A", "B", "C", "D"].slice(0, players), size, true, { mapSpec: spec });
const reach = (w: World, s: Tile) => w.map.reachable(new Tile(s.x + 2, s.y + 2), (id) => w.building(id) !== null);
const water = (w: World) => [...w.map.terrain].filter((t) => t === Terrain.water).length / w.map.terrain.length;

describe("random maps from a spec", () => {
  it("checks a spec from a file before using it", () => {
    expect(isMapSpec(ISLANDS)).toBe(true);
    expect(isMapSpec({ name: "x" })).toBe(false);
    expect(isMapSpec(null)).toBe(false);
    // Not a spec: the world makes its own map of the type asked for.
    const w = new World(RULES, 1, ["A", "B"], 72, true, { mapType: "inland", mapSpec: { name: "broken" } as never });
    expect(w.buildings.filter((b) => b.def.id === "town_center").length).toBe(2);
  });

  it("gives every player a base on land with the resources to start", () => {
    for (const spec of [ISLANDS, CONTINENT, PLAINS, COAST]) for (const seed of [1, 2, 3]) for (const players of [2, 4]) {
      const w = make(spec, seed, players);
      const why = `${spec.name} ${seed} ${players}p`;
      expect(w.buildings.filter((b) => b.def.id === "town_center").length, why).toBe(players);
      for (const p of w.players) {
        const s = w.startTiles[p.id];
        expect(w.map.terrainAt(s), why).not.toBe(Terrain.water);
        expect(w.unitsOf(p.id).filter((u) => !u.isAnimal).length, why).toBe(RULES.economy.start_villagers);
        for (const r of [Res.food, Res.wood, Res.gold, Res.stone]) expect(w.nearestNode(r, s.center, 24), `${why} ${r}`).not.toBeNull();
      }
    }
  });

  it("covers about the share of land it asks for", () => {
    for (const seed of [1, 2]) {
      expect(1 - water(make(ISLANDS, seed, 4))).toBeGreaterThan(0.3);
      expect(1 - water(make(ISLANDS, seed, 4))).toBeLessThan(0.6);
      expect(1 - water(make(CONTINENT, seed, 4))).toBeGreaterThan(0.6);
      expect(water(make(PLAINS, seed, 4))).toBe(0);
      expect(water(make(COAST, seed, 2))).toBeGreaterThan(0.08);
    }
  });

  it("parts the players by sea on islands, and joins them by land otherwise", () => {
    for (const seed of [1, 2, 3]) {
      const isles = make(ISLANDS, seed, 4);
      const seen = reach(isles, isles.startTiles[0]);
      for (const s of isles.startTiles.slice(1)) expect(seen[isles.map.index(new Tile(s.x + 2, s.y + 2))], `isles ${seed}`).toBeFalsy();
      for (const spec of [CONTINENT, PLAINS, COAST]) {
        const w = make(spec, seed, 4);
        const all = reach(w, w.startTiles[0]);
        for (const s of w.startTiles) expect(all[w.map.index(new Tile(s.x + 2, s.y + 2))], `${spec.name} ${seed}`).toBe(1);
      }
    }
  });

  it("puts fish in the water and the rest on land", () => {
    const w = make(ISLANDS, 4, 4);
    const fish = w.nodes.filter((n) => n.def.id === "fish" || n.def.id === "deep_fish");
    expect(fish.length).toBeGreaterThan(4);
    for (const n of fish) expect(w.map.terrainAt(n.tile)).toBe(Terrain.water);
    for (const n of w.nodes) if (["gold_mine", "stone_mine", "berry_bush", "tree", "lone_tree"].includes(n.def.id)) expect(w.map.terrainAt(n.tile)).not.toBe(Terrain.water);
    for (const u of w.units) if (u.isAnimal) expect(w.map.terrainAt(u.pos.tile)).not.toBe(Terrain.water);
  });

  it("makes the same map from the same seed", () => {
    const a = make(ISLANDS, 9, 3), b = make(ISLANDS, 9, 3);
    expect([...a.map.terrain]).toEqual([...b.map.terrain]);
    expect(a.nodes.map((n) => `${n.def.id}@${n.tile.x},${n.tile.y}`)).toEqual(b.nodes.map((n) => `${n.def.id}@${n.tile.x},${n.tile.y}`));
    expect([...make(ISLANDS, 10, 3).map.terrain]).not.toEqual([...a.map.terrain]);
  });

  it("plays a game to the end on one", () => {
    // Seed 1: Hard wins it on the original's rules as on the earlier ones. On this sea-ringed continent Hard
    // beats Easy on most seeds, not all (seed 5, Babylon against Minoan ships, now goes to Easy).
    const r = runMatch(RULES, 1, 75, ["hard", "easy"], "inland", { mapSpec: CONTINENT });
    expect(r.winner).toBe(0);
  }, 300_000);
});
