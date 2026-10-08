import { describe, expect, it } from "vitest";
import { RULES } from "../src/core/data";
import { Tile, Vec2 } from "../src/core/geom";
import { Terrain } from "../src/core/grid";
import { Res } from "../src/core/rules";
import { runMatch } from "../src/core/sim";
import { World } from "../src/core/world";

/** An empty grass map, for tests that set up their own scene. */
const blank = (size = 24) => new World(RULES, 1, ["A", "B"], size, false);
const run = (w: World, seconds: number) => { for (let i = 0; i < Math.round(seconds / World.dt); i++) w.step(); };

describe("rules", () => {
  it("loads the shared rules file", () => {
    expect(RULES.ages.length).toBe(2);
    expect(RULES.units.get("villager")).toBeDefined();
    expect(RULES.buildings.get("town_center")?.size).toBe(3);
    expect(RULES.units.get("axeman")?.bonus?.cavalry).toBe(4);
  });
});

describe("pathfinding", () => {
  it("goes around a wall of water", () => {
    const w = blank();
    for (let y = 2; y < 20; y++) w.map.terrain[w.map.index(new Tile(10, y))] = Terrain.water;
    const goal = new Tile(15, 10);
    const path = w.pathfinder.find(new Vec2(5.5, 10.5), new Vec2(15.5, 10.5), (t) => t.equals(goal));
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1].tile.equals(goal)).toBe(true);
    let prev = new Vec2(5.5, 10.5);
    for (const p of path) { expect(w.map.clearLine(prev, p)).toBe(true); prev = p; }
  });

  it("walks to the closest tile when the goal cannot be reached", () => {
    const w = blank();
    for (let y = 0; y < 24; y++) w.map.terrain[w.map.index(new Tile(12, y))] = Terrain.water;
    const goal = new Tile(20, 3);
    const path = w.pathfinder.find(new Vec2(3.5, 3.5), new Vec2(20.5, 3.5), (t) => t.equals(goal));
    expect(path[path.length - 1].tile.x).toBe(11);
  });
});

describe("economy", () => {
  it("gathers and deposits at the town center", () => {
    const w = blank();
    w.addBuilding("town_center", 0, new Tile(5, 5), true);
    const tree = w.addNode("tree", new Tile(12, 6))!;
    const v = w.spawnUnit("villager", 0, new Tile(9, 6).center);
    const before = w.players[0].res.wood;
    w.gather(0, [v.id], tree.id);
    run(w, 90);
    expect(w.players[0].res.wood).toBeGreaterThan(before + 15);
    expect(tree.amount).toBeLessThan(75);
  });

  it("moves on to the next node when one runs out", () => {
    const w = blank();
    w.addBuilding("town_center", 0, new Tile(5, 5), true);
    const a = w.addNode("berry_bush", new Tile(10, 6))!;
    const b = w.addNode("berry_bush", new Tile(11, 6))!;
    a.amount = 3;
    const v = w.spawnUnit("villager", 0, new Tile(9, 7).center);
    w.gather(0, [v.id], a.id);
    run(w, 40);
    expect(a.alive).toBe(false);
    expect(b.amount).toBeLessThan(150);
  });

  it("walks through a crowd of gatherers to drop off", () => {
    const w = blank();
    w.addBuilding("town_center", 0, new Tile(10, 10), true);
    const bush = w.addNode("berry_bush", new Tile(6, 11))!;
    for (let i = 0; i < 5; i++) w.gather(0, [w.spawnUnit("villager", 0, new Tile(7, 11).center).id], bush.id);
    run(w, 60);
    expect(w.players[0].stats.gathered.food).toBeGreaterThan(40);
  });
});

describe("production", () => {
  it("spends on queue and spawns when done", () => {
    const w = blank();
    const tc = w.addBuilding("town_center", 0, new Tile(5, 5), true);
    w.refreshPopulation();
    const food = w.players[0].res.food;
    expect(w.train(0, tc.id, "villager")).toBeNull();
    expect(w.players[0].res.food).toBe(food - 50);
    run(w, 21);
    expect(w.unitsOf(0).length).toBe(1);
  });

  it("waits for housing", () => {
    const w = blank();
    const tc = w.addBuilding("town_center", 0, new Tile(5, 5), true);
    for (let i = 0; i < 5; i++) w.spawnUnit("villager", 0, new Tile(12 + i, 12).center);
    w.refreshPopulation();
    expect(w.players[0].popCap).toBe(5);
    w.players[0].res.set(Res.food, 500);
    w.train(0, tc.id, "villager");
    run(w, 30);
    expect(w.unitsOf(0).length).toBe(5);
    expect(w.events.some((e) => e.kind === "message" && e.text === "Need more houses")).toBe(true);
  });

  it("cannot train before its age", () => {
    const w = blank();
    const b = w.addBuilding("barracks", 0, new Tile(5, 5), true);
    w.players[0].res.set(Res.gold, 100);
    expect(w.train(0, b.id, "axeman")).toBe("Needs Tool Age");
    expect(w.train(0, b.id, "clubman")).toBeNull();
  });

  it("checks placement and builds a house", () => {
    const w = blank();
    w.addBuilding("town_center", 0, new Tile(5, 5), true);
    w.fog[0].revealAll();
    const v = w.spawnUnit("villager", 0, new Tile(10, 10).center);
    expect("id" in w.place(0, "house", new Tile(6, 6), [v.id])).toBe(false);
    expect("id" in w.place(0, "farm", new Tile(12, 12), [v.id])).toBe(false);
    const r = w.place(0, "house", new Tile(12, 12), [v.id]);
    expect("id" in r).toBe(true);
    run(w, 25);
    expect(w.building((r as { id: number }).id)!.complete).toBe(true);
    w.refreshPopulation();
    expect(w.players[0].popCap).toBe(9);
  });

  it("advances an age with two buildings and the food", () => {
    const w = blank();
    const tc = w.addBuilding("town_center", 0, new Tile(5, 5), true);
    w.players[0].res.set(Res.food, 600);
    expect(w.advanceAge(0, tc.id)).not.toBeNull();
    w.addBuilding("granary", 0, new Tile(12, 5), true);
    w.addBuilding("barracks", 0, new Tile(12, 10), true);
    expect(w.advanceAge(0, tc.id)).toBeNull();
    run(w, 61);
    expect(w.players[0].age).toBe(1);
  });
});

describe("combat", () => {
  it("uses the same damage formula as balance.py", () => {
    const w = blank();
    const axe = w.spawnUnit("axeman", 0, new Vec2(3, 3));
    const scout = w.spawnUnit("scout", 1, new Vec2(4, 3));
    const bow = w.spawnUnit("bowman", 0, new Vec2(5, 3));
    expect(w.damage(axe.def.attack, false, axe.def.bonus, scout)).toBe(9);
    expect(w.damage(bow.def.attack, true, bow.def.bonus, scout)).toBe(3);
  });

  it("fights to the death", () => {
    const w = blank();
    const a = w.spawnUnit("axeman", 0, new Tile(5, 5).center);
    const s = w.spawnUnit("scout", 1, new Tile(9, 5).center);
    run(w, 20);
    expect(s.alive).toBe(false);
    expect(a.alive).toBe(true);
    expect(w.players[0].stats.kills).toBe(1);
  });
});

describe("maps and matches", () => {
  it("makes a fair, connected map", () => {
    const w = new World(RULES, 7);
    expect(w.buildings.length).toBe(2);
    for (const p of w.players) {
      expect(w.unitsOf(p.id).length).toBe(RULES.economy.start_villagers);
      for (const r of [Res.food, Res.wood, Res.gold, Res.stone]) {
        expect(w.nearestNode(r, w.startTiles[p.id].center, 16)).not.toBeNull();
      }
    }
    const s0 = w.startTiles[0], s1 = w.startTiles[1];
    const seen = w.map.reachable(new Tile(s0.x + 2, s0.y + 2), (id) => w.building(id) !== null);
    expect(seen[w.map.index(new Tile(s1.x + 2, s1.y + 2))]).toBe(1);
  });

  it("plays the same game from the same seed", () => {
    expect(runMatch(RULES, 11, 6).lines).toEqual(runMatch(RULES, 11, 6).lines);
  });

  it("ends a headless match with the stronger AI winning", () => {
    for (const seed of [1, 2]) {
      const r = runMatch(RULES, seed, 45, ["hard", "easy"]);
      expect(r.winner, r.lines.join("\n")).toBe(0);
      expect(r.problems).toEqual([]);
    }
  }, 60_000);
});
