import { describe, expect, it } from "vitest";
import { RULES } from "../src/core/data";
import { Tile, Vec2 } from "../src/core/geom";
import { Terrain } from "../src/core/grid";
import { Res } from "../src/core/rules";
import { scores } from "../src/core/score";
import { runMatch } from "../src/core/sim";
import { MapType, startTiles } from "../src/core/mapgen";
import { AIController } from "../src/core/ai";
import { Victory, World, WorldOptions } from "../src/core/world";
import { loadWorld, saveWorld } from "../src/core/save";
import { LockstepGuest, LockstepHost, MAX_LAG, TURN_TICKS } from "../src/core/net";
import { Command } from "../src/core/commands";
import { RNG } from "../src/core/geom";

/** An empty grass map, for tests that set up their own scene. */
const blank = (size = 24) => new World(RULES, 1, ["A", "B"], size, false);
const run = (w: World, seconds: number) => { for (let i = 0; i < Math.round(seconds / World.dt); i++) w.step(); };

describe("rules", () => {
  it("loads the shared rules file", () => {
    expect(RULES.ages.map((a) => a.id)).toEqual(["stone", "tool", "bronze", "iron"]);
    expect(RULES.units.get("villager")).toBeDefined();
    expect(RULES.buildings.get("town_center")?.pop_provided).toBe(4);
    expect(RULES.techs.size).toBeGreaterThan(50);
    expect(RULES.civs.length).toBe(17);
    expect(RULES.units.get("cavalry")?.bonus?.infantry).toBe(5);
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
    for (let i = 0; i < 4; i++) w.spawnUnit("villager", 0, new Tile(12 + i, 12).center);
    w.refreshPopulation();
    expect(w.players[0].popCap).toBe(4);
    w.players[0].res.set(Res.food, 500);
    w.train(0, tc.id, "villager");
    run(w, 30);
    expect(w.unitsOf(0).length).toBe(4);
    expect(w.events.some((e) => e.kind === "message" && e.text === "Need more houses")).toBe(true);
  });

  it("cannot train before its age", () => {
    const w = blank();
    const b = w.addBuilding("barracks", 0, new Tile(5, 5), true);
    w.players[0].res.set(Res.gold, 100);
    expect(w.train(0, b.id, "axeman")).toBe("Needs Tool Age");
    expect(w.train(0, b.id, "clubman")).toBeNull();
  });

  it("a villager who left a foundation can come back and finish it", () => {
    const w = blank();
    w.fog[0].revealAll();
    w.addBuilding("town_center", 0, new Tile(2, 2), true);
    const bush = w.addNode("berry_bush", new Tile(16, 4))!;
    const v = w.spawnUnit("villager", 0, new Tile(8, 8).center);
    const b = w.building((w.place(0, "house", new Tile(10, 10), [v.id]) as { id: number }).id)!;
    run(w, 8);
    const half = b.progress;
    expect(w.smart(0, [v.id], bush.id, bush.center)).toBe("gathered");
    run(w, 5);
    expect(b.progress).toBe(half);
    expect(w.smart(0, [v.id], b.id, b.center)).toBe("built");
    run(w, 20);
    expect(b.complete).toBe(true);
  });

  it("a builder goes on to an unfinished building nearby, also when its own is deleted; not one far away", () => {
    const w = blank(40);
    w.fog[0].revealAll();
    w.addBuilding("town_center", 0, new Tile(2, 2), true);
    w.players[0].res.set(Res.wood, 500);
    const v = w.spawnUnit("villager", 0, new Tile(8, 8).center);
    const first = w.building((w.place(0, "house", new Tile(10, 10), [v.id]) as { id: number }).id)!;
    const near = w.building((w.place(0, "house", new Tile(14, 10), []) as { id: number }).id)!;
    const far = w.building((w.place(0, "house", new Tile(34, 34), []) as { id: number }).id)!;
    run(w, 60);
    expect(first.complete).toBe(true);
    expect(near.complete).toBe(true);
    expect(far.progress).toBe(0);
    // Its foundation deleted under it: on to the next one close by.
    const a = w.building((w.place(0, "house", new Tile(10, 14), [v.id]) as { id: number }).id)!;
    const b = w.building((w.place(0, "house", new Tile(14, 14), []) as { id: number }).id)!;
    run(w, 3);
    w.destroy(0, a.id);
    run(w, 40);
    expect(b.complete).toBe(true);
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
    expect(w.players[0].popCap).toBe(8);
  });

  it("advances an age with two buildings and the food", () => {
    const w = blank();
    const tc = w.addBuilding("town_center", 0, new Tile(5, 5), true);
    w.players[0].res.set(Res.food, 600);
    expect(w.advanceAge(0, tc.id)).not.toBeNull();
    w.addBuilding("granary", 0, new Tile(12, 5), true);
    w.addBuilding("barracks", 0, new Tile(12, 10), true);
    expect(w.advanceAge(0, tc.id)).toBeNull();
    run(w, 121);
    expect(w.players[0].age).toBe(1);
  });
});

describe("combat", () => {
  it("uses the same damage formula as balance.py", () => {
    const w = blank();
    const cav = w.spawnUnit("cavalry", 0, new Vec2(3, 3));
    const club = w.spawnUnit("clubman", 1, new Vec2(4, 3));
    const sword = w.spawnUnit("short_swordsman", 1, new Vec2(5, 3));
    expect(w.damage(cav.def.attack, false, cav.def.bonus, club)).toBe(13);     // 8 + 5 against infantry
    expect(w.damage(cav.def.attack, false, cav.def.bonus, sword)).toBe(12);    // armor 1
    expect(w.damage(1, false, undefined, club)).toBe(1);                       // never below 1
    const house = w.addBuilding("house", 1, new Tile(10, 10), true);
    expect(w.damage(3, false, undefined, house)).toBeCloseTo(0.6);           // buildings take a fifth
  });

  it("fights to the death", () => {
    const w = blank();
    const a = w.spawnUnit("cavalry", 0, new Tile(5, 5).center);
    const s = w.spawnUnit("clubman", 1, new Tile(9, 5).center);
    run(w, 20);
    expect(s.alive).toBe(false);
    expect(a.alive).toBe(true);
    expect(w.players[0].stats.kills).toBe(1);
  });
});

describe("fixes from the logic review", () => {
  it("a move into a lake stops at the shore instead of walking into water", () => {
    const w = blank(30);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) w.map.terrain[w.map.index(new Tile(x, y))] = Terrain.water;
    const c = w.spawnUnit("clubman", 0, new Tile(3, 3).center);
    w.move(0, [c.id], new Vec2(15, 15));
    for (let i = 0; i < 600; i++) {
      w.step();
      expect(w.map.terrainAt(c.pos.tile)).not.toBe(Terrain.water);
    }
    expect(c.order.kind).toBe("idle");
    expect(c.pos.distance(new Vec2(15, 15))).toBeLessThan(9);
  });

  it("never walks through a building on the way", () => {
    const w = blank(30);
    w.fog[0].revealAll();
    const ring = [[10, 10], [12, 10], [14, 10], [10, 12], [14, 12], [10, 14], [12, 14], [14, 14]];
    for (const [x, y] of ring) w.addBuilding("house", 1, new Tile(x, y), true);
    const c = w.spawnUnit("clubman", 0, new Tile(3, 3).center);
    w.move(0, [c.id], new Vec2(13, 13));
    for (let i = 0; i < 400; i++) { w.step(); expect(w.map.solidAt(c.pos.tile)).toBe(false); }
  });

  it("the AI only places buildings on ground it has explored", () => {
    const w = new World(RULES, 3, ["A", "B"]);
    w.ais = [new AIController(0, "normal"), new AIController(1, "normal")];
    w.ais.forEach((a) => a.attach(w));
    let placed = 0;
    for (let i = 0; i < 20 * 600; i++) {
      const before = w.buildings.length;
      w.step();
      for (const b of w.buildings.slice(before)) {
        placed++;
        for (const t of b.footprint.tiles()) expect(w.fog[b.owner].isExplored(t)).toBe(true);
      }
    }
    expect(placed).toBeGreaterThan(10);
  });

  it("farms are walked over and take one farmer each", () => {
    const w = blank();
    w.addBuilding("town_center", 0, new Tile(2, 2), true);
    const farm = w.addBuilding("farm", 0, new Tile(8, 8), true);
    expect(w.map.passable(new Tile(8, 8))).toBe(true);
    const a = w.spawnUnit("villager", 0, new Tile(7, 8).center);
    const b = w.spawnUnit("villager", 0, new Tile(7, 9).center);
    w.gather(0, [a.id, b.id], farm.id);
    run(w, 10);
    const working = [a, b].filter((u) => u.order.kind === "gather" && u.order.id === farm.id);
    expect(working.length).toBe(1);
  });

  it("a spent farm is gone, unless reseeding is on and there is the wood", () => {
    for (const [reseed, wood] of [[false, 500], [true, 500], [true, 0]] as const) {
      const w = blank();
      w.addBuilding("town_center", 0, new Tile(2, 2), true);
      const farm = w.addBuilding("farm", 0, new Tile(6, 6), true);
      farm.food = 3;
      w.players[0].res.set(Res.wood, wood);
      w.setAutoReseed(0, reseed);
      const v = w.spawnUnit("villager", 0, new Tile(5, 6).center);
      w.gather(0, [v.id], farm.id);
      run(w, 30);
      const sown = reseed && wood > 0;
      expect(farm.alive).toBe(sown);
      expect(w.players[0].res.wood).toBe(sown ? wood - 75 : wood);
      if (sown) expect(v.order.kind === "gather" || v.order.kind === "return").toBe(true);
    }
  });

  it("villagers repair a damaged building, paying as they go, and stop when it is whole or money runs out", () => {
    const w = blank();
    const house = w.addBuilding("house", 0, new Tile(6, 6), true);
    house.hp = house.maxHp / 2;
    w.players[0].res.set(Res.wood, 100);
    const v = w.spawnUnit("villager", 0, new Tile(5, 6).center);
    expect(w.smart(0, [v.id], house.id, house.center)).toBe("repaired");
    run(w, 60);
    expect(house.hp).toBe(house.maxHp);
    expect(v.order.kind).toBe("idle");
    // Half the bar back costs a quarter of the price: 30 wood x 0.5 x 0.5.
    expect(w.players[0].res.wood).toBeCloseTo(100 - 7.5, 1);

    house.hp = house.maxHp / 2;
    w.players[0].res.set(Res.wood, 2);
    w.repair(0, [v.id], house.id);
    run(w, 60);
    expect(house.hp).toBeLessThan(house.maxHp);
    expect(w.players[0].res.wood).toBeGreaterThanOrEqual(0);
    expect(v.order.kind).toBe("idle");
  });

  it("a whole building is not repaired: villagers sent to it just walk there", () => {
    const w = blank();
    const house = w.addBuilding("house", 0, new Tile(6, 6), true);
    const v = w.spawnUnit("villager", 0, new Tile(2, 2).center);
    expect(w.smart(0, [v.id], house.id, house.center)).toBe("moved");
  });

  it("standing ground, a soldier holds its spot: it strikes what comes in reach and does not chase", () => {
    const w = blank();
    const archer = w.spawnUnit("bowman", 0, new Tile(5, 5).center);
    w.setStandGround(0, [archer.id], true);
    const far = w.spawnUnit("clubman", 1, new Tile(5, 11).center); // in sight, out of range
    w.setStandGround(1, [far.id], true);
    run(w, 5);
    expect(archer.pos.distance(new Tile(5, 5).center)).toBeLessThan(0.01);
    expect(far.hp).toBe(far.maxHp);
    const near = w.spawnUnit("clubman", 1, new Tile(5, 8).center); // in range
    w.setStandGround(1, [near.id], true);
    run(w, 5);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(archer.pos.distance(new Tile(5, 5).center)).toBeLessThan(0.01);
    // Without the stance the same archer goes after the far one.
    w.applyDamage(near, 999, archer.id);
    w.setStandGround(0, [archer.id], false);
    run(w, 6);
    expect(archer.pos.distance(new Tile(5, 5).center)).toBeGreaterThan(0.5);
  });

  it("attack ground: stone throwers keep hitting a spot; a heavy catapult's stones knock down trees", () => {
    const w = blank();
    w.players[0].age = 3;
    const bow = w.spawnUnit("bowman", 0, new Tile(3, 3).center);
    w.attackGround(0, [bow.id], new Tile(9, 9).center);
    expect(bow.order.kind).toBe("idle"); // only stone throwers have it
    const cat = w.spawnUnit("heavy_catapult", 0, new Tile(3, 12).center);
    const tree = w.addNode("tree", new Tile(12, 12))!;
    const wood = w.players[0].res.wood;
    w.attackGround(0, [cat.id], tree.center);
    expect(cat.order.kind).toBe("attackGround");
    run(w, 40);
    expect(cat.order.kind).toBe("attackGround"); // it keeps going until told otherwise
    expect(tree.alive).toBe(false);
    expect(w.players[0].res.wood).toBe(wood); // cleared, not cut: no wood
  });

  it("waypoints: Shift + right-click points are walked in order", () => {
    const w = blank();
    const u = w.spawnUnit("clubman", 0, new Tile(2, 2).center);
    w.waypoint(0, [u.id], new Tile(10, 2).center);   // not walking yet: goes now
    w.waypoint(0, [u.id], new Tile(10, 10).center);  // walking: queued
    w.waypoint(0, [u.id], new Tile(2, 10).center);
    expect(u.waypoints.length).toBe(2);
    let reachedCorner = false;
    for (let i = 0; i < 60 / World.dt; i++) { w.step(); if (u.pos.distance(new Tile(10, 10).center) < 0.5) reachedCorner = true; }
    expect(reachedCorner).toBe(true);
    expect(u.pos.distance(new Tile(2, 10).center)).toBeLessThan(0.5);
    expect(u.order.kind).toBe("idle");
    // A plain move forgets the rest of the way.
    w.waypoint(0, [u.id], new Tile(10, 10).center);
    w.waypoint(0, [u.id], new Tile(2, 2).center);
    w.move(0, [u.id], new Tile(5, 10).center);
    expect(u.waypoints.length).toBe(0);
  });

  it("with the original's rule, farms block the way and are worked from their edge", () => {
    const w = new World(RULES, 1, ["A", "B"], 24, false, { farmsBlock: true });
    w.addBuilding("granary", 0, new Tile(2, 8), true);
    const farm = w.addBuilding("farm", 0, new Tile(8, 8), true);
    expect(w.map.passable(new Tile(9, 9))).toBe(false);
    const v = w.spawnUnit("villager", 0, new Tile(7, 9).center);
    w.gather(0, [v.id], farm.id);
    run(w, 40);
    expect(w.players[0].stats.gathered.food).toBeGreaterThan(0);
    expect(w.map.passable(v.pos.tile)).toBe(true); // never stood on the farm
  });

  it("deleting a foundation refunds what was not built", () => {
    const w = blank();
    w.fog[0].revealAll();
    const v = w.spawnUnit("villager", 0, new Tile(3, 3).center);
    const wood = w.players[0].res.wood;
    const r = w.place(0, "barracks", new Tile(8, 8), [v.id]) as { id: number };
    w.destroy(0, r.id);
    expect(w.players[0].res.wood).toBe(wood - 125 + 62);   // half of the unbuilt part, as in the original
  });

  it("soldiers stop retrying an enemy they cannot reach", () => {
    const w = blank(30);
    for (let y = 0; y < 30; y++) for (let x = 14; x < 17; x++) w.map.terrain[w.map.index(new Tile(x, y))] = Terrain.water;
    const c = w.spawnUnit("clubman", 0, new Tile(12, 12).center);
    w.spawnUnit("villager", 1, new Tile(18, 12).center);
    let searches = 0;
    const find = w.pathfinder.find.bind(w.pathfinder);
    w.pathfinder.find = (...args) => { searches++; return find(...args); };
    run(w, 20);
    expect(c.alive).toBe(true);
    expect(searches).toBeLessThan(10);
  });
});

describe("the original's rules", () => {
  const tool = (w: World, p = 0) => { w.players[p].age = 1; };

  it("techs change stats: Toolworking adds 2 attack to melee soldiers", () => {
    const w = blank();
    const sp = w.addBuilding("storage_pit", 0, new Tile(3, 3), true);
    tool(w);
    w.players[0].res.set(Res.food, 1000);
    expect(w.unitStats(0, "clubman").attack).toBe(3);
    expect(w.research(0, sp.id, "toolworking")).toBeNull();
    run(w, 31);
    expect(w.unitStats(0, "clubman").attack).toBe(5);
    expect(w.unitStats(0, "bowman").attack).toBe(3);   // not a melee unit
  });

  it("an upgrade turns existing units into the new type", () => {
    const w = blank();
    const b = w.addBuilding("barracks", 0, new Tile(3, 3), true);
    w.players[0].age = 2;
    w.players[0].mods.research(RULES.techs.get("battle_axe")!);
    w.players[0].mods.research(RULES.techs.get("short_sword")!);
    const sw = w.spawnUnit("short_swordsman", 0, new Tile(10, 10).center);
    w.players[0].res.set(Res.food, 1000); w.players[0].res.set(Res.gold, 1000);
    expect(w.research(0, b.id, "broad_sword")).toBeNull();
    run(w, 81);
    expect(sw.def.id).toBe("broad_swordsman");
    expect(w.unitShown("short_swordsman", 0)).toBe(false);
  });

  it("ages need two different buildings from the list, and cost what the original did", () => {
    const w = blank();
    const tc = w.addBuilding("town_center", 0, new Tile(3, 3), true);
    tool(w);
    w.players[0].res.set(Res.food, 2000);
    w.addBuilding("market", 0, new Tile(10, 3), true);
    expect(w.blockerForNextAge(0)).toContain("Needs 2 different buildings");
    w.addBuilding("stable", 0, new Tile(10, 8), true);
    expect(w.advanceAge(0, tc.id)).toBeNull();
    expect(w.players[0].res.food).toBe(1200);
    run(w, 141);
    expect(w.players[0].age).toBe(2);
  });

  it("farms need a Market and the Tool Age", () => {
    const w = blank();
    w.fog[0].revealAll();
    w.addBuilding("granary", 0, new Tile(3, 3), true);
    expect(w.blockerBuilding("farm", 0)).toBe("Needs Tool Age");
    tool(w);
    expect(w.blockerBuilding("farm", 0)).toBe("Needs a Market");
  });

  it("a villager's kill leaves meat, which goes to a Storage Pit, not a Granary", () => {
    const w = blank();
    w.addBuilding("granary", 0, new Tile(2, 2), true);
    const pit = w.addBuilding("storage_pit", 0, new Tile(2, 9), true);
    const g = w.spawnAnimal("gazelle", new Tile(9, 6).center)!;
    const v = w.spawnUnit("villager", 0, new Tile(7, 6).center);
    w.attack(0, [v.id], g.id);
    run(w, 60);
    expect(g.alive).toBe(false);
    expect(w.players[0].stats.gathered.food).toBeGreaterThan(9);
    expect(pit.dropsOff(Res.food, "meat")).toBe(true);
  });

  it("a soldier's kill leaves no meat", () => {
    const w = blank();
    const g = w.spawnAnimal("gazelle", new Tile(9, 6).center)!;
    const c = w.spawnUnit("clubman", 0, new Tile(8, 6).center);
    w.attack(0, [c.id], g.id);
    run(w, 20);
    expect(g.alive).toBe(false);
    expect(w.nodes.filter((n) => n.def.id.startsWith("carcass")).length).toBe(0);
  });

  it("lions attack villagers who wander close", () => {
    const w = blank();
    w.spawnAnimal("lion", new Tile(8, 8).center);
    const v = w.spawnUnit("villager", 0, new Tile(10, 8).center);
    run(w, 5);
    expect(v.hp).toBeLessThan(v.maxHp);
  });

  it("priests convert after a few chants, and their faith must recover", () => {
    const w = blank();
    w.players[0].age = 2;
    const pr = w.spawnUnit("priest", 0, new Tile(5, 5).center);
    const enemy = w.spawnUnit("axeman", 1, new Tile(12, 5).center);
    w.convert(0, [pr.id], enemy.id);
    for (let i = 0; i < 20 * 60 && enemy.owner === 1; i++) w.step();
    expect(enemy.owner).toBe(0);
    expect(pr.faith).toBeLessThan(100);
  });

  it("siege stones splash and moving units can dodge them", () => {
    const w = blank(40);
    w.players[0].age = 2;
    const st = w.spawnUnit("stone_thrower", 0, new Tile(5, 20).center);
    const a = w.spawnUnit("clubman", 1, new Tile(13, 20).center);
    const b = w.spawnUnit("clubman", 1, new Tile(13, 20).center.add(new Vec2(0.3, 0)));
    w.attack(0, [st.id], a.id);
    run(w, 3);
    expect(a.hp < a.maxHp || !a.alive).toBe(true);
    expect(b.hp < b.maxHp || !b.alive).toBe(true);        // the splash hit the neighbour
  });

  it("walls are laid as a row of foundations along a drag", () => {
    const w = blank();
    w.fog[0].revealAll();
    tool(w);
    w.players[0].mods.research(RULES.techs.get("small_wall_tech")!);
    const v = w.spawnUnit("villager", 0, new Tile(3, 3).center);
    const r = w.placeWall(0, "small_wall", new Tile(6, 6), new Tile(12, 6), [v.id]);
    expect("placed" in r && r.placed).toBe(7);
    expect(w.players[0].res.stone).toBe(150 - 35);
    run(w, 80);
    expect(w.buildings.filter((b) => b.def.id === "small_wall" && b.complete).length).toBe(7);
  });

  it("up to eight players: each has its own start and town, and allies are not enemies", () => {
    const names = ["You", "E1", "E2", "E3", "E4", "E5", "E6", "E7"];
    const w = new World(RULES, 4, names, 120, true, { teams: [0, 1, 1, 1, 2, 2, 2, 2] });
    const tcs = w.players.map((p) => w.buildingsOf(p.id).find((b) => b.def.id === "town_center")!);
    expect(tcs.every(Boolean)).toBe(true);
    for (let i = 0; i < tcs.length; i++) for (let j = i + 1; j < tcs.length; j++) expect(tcs[i].center.distance(tcs[j].center)).toBeGreaterThan(20);
    expect(w.isEnemy(1, 2)).toBe(false); // same team
    expect(w.isEnemy(1, 4)).toBe(true);
    expect(w.isEnemy(0, 1)).toBe(true);  // team 0 is on its own
    expect(w.isEnemy(0, 0)).toBe(false);
  });

  it("starts are dealt by the seed: you are not always in the same corner, and two players face each other", () => {
    const mine = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const [a, b] = startTiles(2, 72, seed);
      mine.add(`${a.x},${a.y}`);
      expect(a.x + b.x).toBe(14 + 57); // opposite corners of one diagonal
      expect(a.y + b.y).toBe(14 + 57);
      expect(startTiles(2, 72, seed)).toEqual([a, b]); // the same seed, the same starts
    }
    expect(mine.size).toBe(4);
    const eight = startTiles(8, 120, 3).map((t) => `${t.x},${t.y}`);
    expect(new Set(eight).size).toBe(8);
  });

  it("map types: every one but the land maps has a sea, deep fish for boats, and every base on land", () => {
    for (const mapType of ["coastal", "continental", "mediterranean", "highland", "narrows"] as const) {
      for (const seed of [1, 2]) {
        const w = new World(RULES, seed, ["A", "B"], 72, true, { mapType });
        const water = w.map.terrain.filter((t) => t === Terrain.water).length;
        expect(water, mapType).toBeGreaterThan(72 * 72 * 0.08);
        expect(w.nodes.filter((n) => n.def.id === "deep_fish").length, mapType).toBeGreaterThan(4);
        for (const p of w.players) expect(w.buildingsOf(p.id).some((b) => b.def.id === "town_center"), mapType).toBe(true);
      }
    }
    const inland = new World(RULES, 1, ["A", "B"], 72, true);
    expect(inland.nodes.some((n) => n.def.id === "deep_fish")).toBe(false);
  });

  it("Highland and Hill Country are hillier than Inland, Hill Country has the most cliffs, and every map links its bases by land", () => {
    const share = (mapType: MapType, f: (w: World) => number) => [1, 2, 3].reduce((a, seed) => a + f(new World(RULES, seed, ["A", "B", "C", "D"], 96, true, { mapType })), 0);
    const high = (w: World) => w.map.elevation.filter((e) => e >= 2).length;
    const cliffs = (w: World) => w.map.terrain.filter((t) => t === Terrain.cliff).length;
    expect(share("highland", high)).toBeGreaterThan(share("inland", high) * 1.5);
    expect(share("hill_country", high)).toBeGreaterThan(share("inland", high) * 1.5);
    expect(share("hill_country", cliffs)).toBeGreaterThan(share("inland", cliffs));
    for (const mapType of ["highland", "hill_country", "narrows"] as const) {
      for (const seed of [1, 2, 3]) {
        const w = new World(RULES, seed, ["A", "B", "C", "D"], 96, true, { mapType });
        const s0 = w.startTiles[0];
        const seen = w.map.reachable(new Tile(s0.x + 2, s0.y + 2), (id) => w.building(id) !== null);
        for (const s of w.startTiles) expect(seen[w.map.index(new Tile(s.x + 2, s.y + 2))], `${mapType} ${seed}`).toBe(1);
      }
    }
  });

  it("a Gigantic map holds eight players", () => {
    const w = new World(RULES, 5, ["A", "B", "C", "D", "E", "F", "G", "H"], 200, true);
    expect(w.buildings.filter((b) => b.def.id === "town_center").length).toBe(8);
    expect(w.nodes.length).toBeGreaterThan(3000);
  });

  it("a Dock stands at the shore; its fishing boats sail, fish out at sea and bring the food back", () => {
    const w = blank(30);
    for (let y = 0; y < 30; y++) for (let x = 14; x < 30; x++) w.map.terrain[y * 30 + x] = Terrain.water;
    expect(w.canPlace("dock", new Tile(10, 5))).toBe(false); // on land
    expect(w.canPlace("dock", new Tile(20, 5))).toBe(false); // out at sea
    expect(w.canPlace("dock", new Tile(14, 5))).toBe(true);  // in the water by the shore
    const dock = w.addBuilding("dock", 0, new Tile(14, 5), true);
    w.addBuilding("town_center", 0, new Tile(3, 3), true);
    const fish = w.addNode("deep_fish", new Tile(22, 6))!;
    w.players[0].res.set(Res.wood, 200);
    w.train(0, dock.id, "fishing_boat");
    run(w, 25);
    const boat = w.unitsOf(0).find((u) => u.def.id === "fishing_boat")!;
    expect(boat).toBeDefined();
    expect(w.map.terrainAt(boat.pos.tile)).toBe(Terrain.water);
    const food = w.players[0].res.food;
    w.smart(0, [boat.id], fish.id, fish.center);
    run(w, 90);
    expect(w.players[0].res.food).toBeGreaterThan(food);
    expect(w.map.terrainAt(boat.pos.tile)).toBe(Terrain.water); // never on land
    // Villagers cannot reach deep fish, and a Dock counts for the Tool Age.
    const v = w.spawnUnit("villager", 0, new Tile(12, 6).center);
    w.gather(0, [v.id], fish.id);
    expect(v.order.kind).toBe("idle");
    w.addBuilding("granary", 0, new Tile(3, 10), true);
    w.players[0].res.set(Res.food, 600);
    expect(w.blockerForNextAge(0)).toBeNull();
  });

  it("war ships: they sink boats, archers on the shore shoot them, swordsmen on the shore leave them be", () => {
    const w = blank(30);
    for (let y = 0; y < 30; y++) for (let x = 14; x < 30; x++) w.map.terrain[y * 30 + x] = Terrain.water;
    const galley = w.spawnUnit("war_galley", 0, new Tile(18, 10).center);
    const boat = w.spawnUnit("fishing_boat", 1, new Tile(20, 12).center);
    run(w, 30);
    expect(boat.alive).toBe(false);
    const club = w.spawnUnit("clubman", 1, new Tile(12, 10).center);
    const bow = w.spawnUnit("bowman", 1, new Tile(12, 14).center);
    galley.pos = new Tile(15, 12).center; galley.order = { kind: "idle" };
    run(w, 3);
    expect(club.order.kind).toBe("idle"); // cannot reach it
    expect(bow.order.kind).toBe("attack");
    expect(w.map.terrainAt(galley.pos.tile)).toBe(Terrain.water);
  });

  it("catapult ships bombard the ground; ship bonuses and tech trees", () => {
    const w = blank(30);
    for (let y = 0; y < 30; y++) for (let x = 14; x < 30; x++) w.map.terrain[y * 30 + x] = Terrain.water;
    w.players[0].age = 3;
    const cat = w.spawnUnit("catapult_trireme", 0, new Tile(18, 10).center);
    expect(w.canAttackGround(cat)).toBe(true);
    w.attackGround(0, [cat.id], new Tile(10, 10).center);
    expect(cat.order.kind).toBe("attackGround");
    const c = new World(RULES, 1, ["A", "B", "C", "D"], 24, false, { civs: ["minoan", "greek", "yamato", "babylonian"] });
    expect(c.unitCost(0, "scout_ship").wood).toBe(Math.round(135 * 0.7));
    expect(c.unitStats(1, "war_galley").speed).toBeCloseTo(1.8 * 1.3);
    expect(c.unitStats(2, "trireme").hp).toBe(Math.round(200 * 1.3));
    expect(c.blockerTech("trireme_tech", 3)).toContain("Not available"); // no Trireme for Babylon
    expect(RULES.units.get("trireme")!.convert_resist).toBe(2);
  });

  it("fishing boats: five for each finished Dock, counting those in training", () => {
    const w = blank(30);
    for (let y = 0; y < 30; y++) for (let x = 14; x < 30; x++) w.map.terrain[y * 30 + x] = Terrain.water;
    w.addBuilding("town_center", 0, new Tile(3, 3), true);
    const dock = w.addBuilding("dock", 0, new Tile(14, 5), true);
    w.players[0].res.set(Res.wood, 2000);
    for (let i = 0; i < 3; i++) w.spawnUnit("fishing_boat", 0, new Tile(18, 6).center);
    expect(w.train(0, dock.id, "fishing_boat")).toBeNull();
    expect(w.train(0, dock.id, "fishing_boat")).toBeNull();
    expect(w.train(0, dock.id, "fishing_boat")).toContain("fishing boats a Dock"); // 3 afloat + 2 queued
    // A second Dock, once finished, makes room for five more; one still building does not.
    const second = w.addBuilding("dock", 0, new Tile(14, 15), false);
    expect(w.blockerUnit("fishing_boat", 0)).not.toBeNull();
    second.complete = true;
    expect(w.blockerUnit("fishing_boat", 0)).toBeNull();
  });

  it("transports: units go aboard, cross the water and are put ashore; a sunk transport takes them down", () => {
    const w = blank(40);
    for (let y = 0; y < 40; y++) for (let x = 12; x < 26; x++) w.map.terrain[y * 40 + x] = Terrain.water; // a strait
    const t = w.spawnUnit("light_transport", 0, new Tile(12, 10).center);
    const men = [0, 1, 2, 3, 4, 5].map((i) => w.spawnUnit("clubman", 0, new Tile(9, 8 + i).center));
    expect(w.smart(0, men.map((u) => u.id), t.id, t.center)).toBe("boarded");
    run(w, 15);
    expect(t.cargo.length).toBe(5); // room for five
    expect(men.filter((u) => u.aboard === t.id).length).toBe(5);
    expect(w.smart(0, [t.id], null, new Tile(30, 12).center)).toBe("unloaded");
    run(w, 30);
    expect(t.cargo.length).toBe(0);
    const landed = men.filter((u) => u.aboard === null && u.pos.x > 25);
    expect(landed.length).toBe(5);
    for (const u of landed) expect(w.map.terrainAt(u.pos.tile)).not.toBe(Terrain.water);
    // Back aboard, then sunk.
    t.pos = new Tile(25, 12).center;
    w.board(0, landed.map((u) => u.id), t.id);
    run(w, 10);
    const riders = landed.filter((u) => u.aboard === t.id);
    expect(riders.length).toBeGreaterThan(0);
    w.applyDamage(t, 1e6, -1);
    expect(riders.every((u) => !u.alive)).toBe(true);
  });

  it("on an island map the AI builds a Dock on its own shore and a transport within fifteen minutes", () => {
    for (const mapType of ["small_islands", "large_islands"] as const) {
      for (const seed of [1, 2]) {
        const w = new World(RULES, seed, ["A", "B"], 72, true, { mapType });
        w.ais = [new AIController(0, "hard"), new AIController(1, "normal")];
        for (const ai of w.ais) ai.attach(w);
        // A transport may well be sunk by then: what counts is that each built one.
        const built = new Set<number>();
        for (let i = 0; i < (15 * 60) / World.dt; i++) {
          w.step();
          for (const e of w.events) if (e.kind === "trained" && w.unit(e.id)?.isTransport) built.add(e.owner);
          w.events.length = 0;
        }
        for (const p of w.players) {
          expect(w.buildingsOf(p.id).some((b) => b.def.on_water && b.complete), `${mapType} ${seed} player ${p.id} Dock`).toBe(true);
          expect(built.has(p.id), `${mapType} ${seed} player ${p.id} transport`).toBe(true);
        }
      }
    }
  }, 120_000);

  it("a transport in a strait puts its passengers on the land pointed at, not the island across", () => {
    const w = blank(30);
    // Island A (x < 14), a strait one tile wide, island B (x > 14); open sea all along the bottom. The
    // transport stops in the strait, beside both islands (before the fix one rider stepped onto B).
    for (let y = 0; y < 30; y++) w.map.terrain[w.map.index(new Tile(14, y))] = Terrain.water;
    for (let y = 22; y < 30; y++) for (let x = 0; x < 30; x++) w.map.terrain[w.map.index(new Tile(x, y))] = Terrain.water;
    const boat = w.spawnUnit("light_transport", 0, new Tile(14, 24).center);
    const riders = [0, 1, 2].map((i) => w.spawnUnit("clubman", 0, new Tile(17 + i, 10).center));
    for (const r of riders) { r.aboard = boat.id; boat.cargo.push(r.id); }
    // Pointing at island A, from a strait whose nearer shore is island B's.
    w.unload(0, [boat.id], new Vec2(13.2, 8.5));
    run(w, 30);
    expect(boat.cargo.length).toBe(0);
    for (const r of riders) expect(r.pos.x, `rider at ${r.pos.x.toFixed(1)}`).toBeLessThan(14);
  });

  it("island maps: every base on its own island, no way across but by sea", () => {
    for (const mapType of ["large_islands", "small_islands"] as const) {
      const w = new World(RULES, 3, ["A", "B"], 72, true, { mapType });
      const [a, b] = w.players.map((p) => w.buildingsOf(p.id).find((x) => x.def.id === "town_center")!);
      const seen = w.map.reachable(new Tile(a.footprint.origin.x - 1, a.footprint.origin.y - 1), () => true);
      const to = new Tile(b.footprint.origin.x - 1, b.footprint.origin.y - 1);
      expect(seen[w.map.index(to)], mapType).toBeFalsy();
      expect(w.nodes.some((n) => n.def.id === "deep_fish"), mapType).toBe(true);
    }
  });

  it("trade: a trade boat sails to another player's Dock and brings gold home, more the further it goes", () => {
    const w = blank(60);
    for (let y = 0; y < 60; y++) for (let x = 6; x < 60; x++) w.map.terrain[y * 60 + x] = Terrain.water;
    const mine = w.addBuilding("dock", 0, new Tile(6, 4), true);
    const theirs = w.addBuilding("dock", 1, new Tile(6, 44), true);
    const boat = w.spawnUnit("trade_boat", 0, new Tile(10, 8).center);
    expect(w.smart(0, [boat.id], theirs.id, theirs.center)).toBe("traded");
    const trip = w.tradeGold(theirs, mine);
    expect(trip).toBeGreaterThan(30);
    run(w, 70);
    expect(w.players[0].res.gold).toBeGreaterThanOrEqual(trip);
    expect(w.players[0].res.gold % trip).toBe(0);
    expect(boat.order.kind).toBe("trade"); // and off again
    expect(w.tradeGold(mine, w.addBuilding("dock", 1, new Tile(6, 12), true))).toBeLessThan(trip);
  });

  it("the last team standing wins", () => {
    const w = new World(RULES, 4, ["A", "B", "C"], 72, true, { teams: [0, 1, 1] });
    for (const e of [...w.unitsOf(0), ...w.buildingsOf(0)]) w.applyDamage(e, 1e6, -1);
    run(w, 2);
    expect(w.winner).toBe(1); // B and C won together
    const ffa = new World(RULES, 4, ["A", "B", "C"], 72, true);
    for (const e of [...ffa.unitsOf(0), ...ffa.buildingsOf(0)]) ffa.applyDamage(e, 1e6, -1);
    run(ffa, 2);
    expect(ffa.winner).toBeNull(); // B and C still fight each other
  });

  it("the original's score: kills, razing, generalship, villagers, techs, firsts and elimination", () => {
    const w = new World(RULES, 4, ["A", "B"], 72, true);
    const [a, b] = w.players;
    a.stats.kills = 10; a.stats.casualties = 4; a.stats.razed = 3; a.stats.researched = 5;
    a.stats.gathered.set(Res.gold, 1000);
    w.firstTo[2] = 0;
    b.defeated = true;
    const [sa, sb] = scores(w);
    // 10/2 + 3 + (10 - 4), and the most army: neither has soldiers or towers, so nobody gets it.
    expect(sa.military).toBe(5 + 3 + 6);
    expect(sa.technology).toBe(5 * 2 + 50 + 25); // most techs, first to Bronze
    expect(sa.economy).toBe(10 + 3 + Math.floor((w.fog[0].exploredShare * 100) / 3)); // gold/100, 3 villagers, no single leader in villagers
    expect(sb.other).toBe(-100);
    expect(sa.total).toBe(sa.military + sa.economy + sa.religion + sa.technology + sa.other);
  });

  it("the Timeline: a score point every 30 seconds, ages and defeats marked, one last point at the end", () => {
    const w = new World(RULES, 4, ["A", "B"], 72, true);
    run(w, 95);
    expect(w.history.map((h) => h.t)).toEqual([30, 60, 90].map((t) => expect.closeTo(t, 5)));
    expect(w.history[0].totals.length).toBe(2);
    for (const e of [...w.unitsOf(1), ...w.buildingsOf(1)]) w.applyDamage(e, 1e6, -1);
    run(w, 2);
    expect(w.milestones.some((m) => m.kind === "defeated" && m.player === 1)).toBe(true);
    const n = w.history.length;
    run(w, 60);
    expect(w.history.length).toBe(n); // closed when the game ended
  });

  it("martyrdom: a priest gives its life to convert at once, but not another priest", () => {
    const w = blank();
    const pr = w.spawnUnit("priest", 0, new Tile(5, 5).center);
    const foe = w.spawnUnit("clubman", 1, new Tile(7, 5).center);
    const foePriest = w.spawnUnit("priest", 1, new Tile(5, 8).center);
    expect(w.sacrifice(0, pr.id, foe.id)).toBe(false); // not researched
    w.players[0].mods.research(RULES.techs.get("martyrdom")!);
    expect(w.sacrifice(0, pr.id, foePriest.id)).toBe(false);
    expect(w.sacrifice(0, pr.id, foe.id)).toBe(true);
    run(w, 3);
    expect(foe.owner).toBe(0);
    expect(pr.alive).toBe(false);
  });

  it("civilization bonuses apply: Shang villagers cost 30% less", () => {
    const w = new World(RULES, 1, ["A", "B"], 24, false, { civs: ["shang", "greek"] });
    expect(w.unitCost(0, "villager").food).toBe(35);
    expect(w.unitCost(1, "villager").food).toBe(50);
    const persian = new World(RULES, 1, ["A"], 24, false, { civs: ["persian"] });
    expect(persian.blockerBuilding("academy", 0)).toContain("Not available");
  });

  it("Lac Viet: faster foraging and military, armored archers, and the techs it lacks", () => {
    const w = new World(RULES, 1, ["A", "B"], 24, false, { civs: ["lac_viet", "greek"] });
    const [lv, gr] = [w.players[0].mods, w.players[1].mods];
    expect(lv.gather(Res.food, "forage")).toBeCloseTo(1.15);
    expect(lv.gather(Res.food, "hunt")).toBe(1);
    expect(w.unitStats(0, "bowman").train_time).toBeCloseTo(w.unitStats(1, "bowman").train_time * 0.8);
    expect(w.unitStats(0, "villager").train_time).toBe(w.unitStats(1, "villager").train_time);
    expect(w.unitStats(0, "chariot_archer").armor).toBe(w.unitStats(1, "chariot_archer").armor + 2);
    expect(w.unitStats(0, "ballista").armor).toBe(w.unitStats(1, "ballista").armor + 2);
    const house = RULES.buildings.get("house")!;
    expect(lv.building(house).build_time).toBeCloseTo(gr.building(house).build_time / 1.5);
    for (const id of ["phalanx_tech", "legion_tech", "siegecraft", "engineering", "monotheism"])
      expect(w.blockerTech(id, 0)).toContain("Not available");
    expect(w.blockerUnit("camel_rider", 0)).toContain("Not available");
    expect(w.blockerTech("phalanx_tech", 1)).not.toContain("Not available");
  });

  it("each civilization lacks what its tech tree lacks", () => {
    const w = new World(RULES, 1, ["A", "B", "C"], 24, false, { civs: ["egyptian", "greek", "roman"] });
    expect(w.blockerUnit("cavalry", 0)).toContain("Not available");      // no Cavalry for the Egyptians
    expect(w.blockerTech("heavy_cavalry_tech", 1)).not.toContain("Not available"); // the Greeks keep it
    expect(w.blockerBuilding("guard_tower", 2)).toContain("Not available"); // the Romans stop at Sentry Tower
    expect(w.blockerTech("guard_tower_tech", 2)).toContain("Not available");
    for (const c of RULES.civs) expect(c.disabled.length).toBeGreaterThan(10);
  });

  it("time left: the item in progress, the whole queue, and a foundation at its builders' pace", () => {
    const w = blank();
    const tc = w.addBuilding("town_center", 0, new Tile(2, 2), true);
    w.players[0].res.set(Res.food, 500);
    w.train(0, tc.id, "villager");
    w.train(0, tc.id, "villager");
    const t = RULES.units.get("villager")!.train_time;
    expect(w.queueTimeLeft(tc)).toEqual({ current: t, total: 2 * t });
    run(w, 5);
    expect(w.queueTimeLeft(tc).current).toBeCloseTo(t - 5, 0);
    expect(w.queueTimeLeft(tc).total).toBeCloseTo(2 * t - 5, 0);

    const house = w.addBuilding("house", 0, new Tile(10, 10), false);
    expect(w.buildTimeLeft(house)).toBeNull(); // nobody on it
    const a = w.spawnUnit("villager", 0, new Tile(9, 10).center), b = w.spawnUnit("villager", 0, new Tile(9, 11).center);
    w.build(0, [a.id, b.id], house.id);
    run(w, 2);
    const full = RULES.buildings.get("house")!.build_time;
    expect(w.buildTimeLeft(house)!).toBeLessThan(full / 2); // two builders: half the time
  });

  it("a Wonder that stands long enough wins", () => {
    const w = blank();
    w.players[0].age = 3;
    w.addBuilding("town_center", 1, new Tile(18, 18), true);
    const wonder = w.addBuilding("wonder", 0, new Tile(3, 3), false);
    wonder.progress = 0.999;
    const v = w.spawnUnit("villager", 0, new Tile(9, 5).center);
    w.build(0, [v.id], wonder.id);
    run(w, 20);
    expect(wonder.complete).toBe(true);
    run(w, (RULES.economy.wonder_seconds ?? 900) + 2);
    expect(w.winner).toBe(0);
  });
});

describe("game settings and other victories", () => {
  /** Two players with a Town Center each, so nobody is out, and the victory setting given. */
  const pair = (victory: Victory, names = ["A", "B"], teams: number[] = []) => {
    const w = new World(RULES, 1, names, 24, false, { victory, teams });
    names.forEach((_, i) => w.addBuilding("town_center", i, new Tile(2 + i * 5, 2 + (i % 2) * 15), true));
    return w;
  };

  it("the start screen's settings: age, resources, population limit and an explored map", () => {
    const w = new World(RULES, 5, ["A", "B"], 72, true, { startAge: 2, resources: "high", popLimit: 100, revealMap: true });
    for (const p of w.players) {
      expect(p.age).toBe(2);
      expect(p.res.food).toBe(RULES.economy.start_levels!.high.food);
      expect(w.fog[p.id].exploredShare).toBe(1);
      // Explored, but what is out of sight is still hidden.
      const far = w.startTiles[1 - p.id];
      expect(w.fog[p.id].isVisible(far)).toBe(false);
    }
    expect(w.popMax).toBe(100);
    for (let i = 0; i < 30; i++) w.addBuilding("house", 0, new Tile(2 + (i % 10) * 2, 30 + Math.floor(i / 10) * 2), true);
    w.refreshPopulation();
    expect(w.players[0].popCap).toBe(100);
    // Bronze Age buildings may be placed at once.
    expect(w.blockerBuilding("market", 0)).not.toBe("Needs Bronze Age");
  });

  it("score victory: the first side to reach the target wins", () => {
    const w = pair({ kind: "score", target: 300 });
    run(w, 2);
    expect(w.winner).toBeNull();
    w.players[1].stats.researched = 140; // 280 points, and the bonus for the most techs
    run(w, 2);
    expect(w.winner).toBe(1);
  });

  it("time limit: the best score when the clock runs out wins; a team counts its average", () => {
    const w = pair({ kind: "time", target: 30 }, ["A", "B", "C"], [0, 1, 1]);
    w.players[0].stats.researched = 40; // A alone: 80 + 50
    w.players[1].stats.researched = 39; // B and C: (78 + 0) / 2
    run(w, 25);
    expect(w.winner).toBeNull();
    run(w, 6);
    expect(w.winner).toBe(0);
  });

  it("conquest only: a Wonder that stands wins nothing", () => {
    const w = pair({ kind: "conquest" });
    w.players[0].age = 3;
    const wonder = w.addBuilding("wonder", 0, new Tile(12, 8), false);
    wonder.progress = 0.999;
    w.build(0, [w.spawnUnit("villager", 0, new Tile(11, 9).center).id], wonder.id);
    run(w, 20);
    expect(wonder.complete).toBe(true);
    expect(w.players[0].wonderAt).toBeNull();
    run(w, (RULES.economy.wonder_seconds ?? 900) + 2);
    expect(w.winner).toBeNull();
  });
});

describe("playing online, in lockstep", () => {
  /** A pair of links that deliver in order, each message some steps late (a network's lag, made up). */
  const pipe = (rng: RNG, maxLate: number) => {
    let clock = 0;
    const make = () => {
      const queue: { at: number; msg: unknown }[] = [];
      let handler: ((m: unknown) => void) | null = null, last = 0;
      return {
        link: { send: (m: unknown) => { last = Math.max(last, clock + rng.int(0, maxLate)); queue.push({ at: last, msg: JSON.parse(JSON.stringify(m)) }); }, onMessage: (h: (m: unknown) => void) => { handler = h; } },
        deliver: () => { while (queue.length && queue[0].at <= clock) handler?.(queue.shift()!.msg); },
      };
    };
    const a = make(), b = make();
    // a.link is one end's sender; it delivers to whoever listens on b's side, and the other way round.
    const end1 = { send: a.link.send, onMessage: b.link.onMessage };
    const end2 = { send: b.link.send, onMessage: a.link.onMessage };
    return { end1, end2, tick: () => { clock++; a.deliver(); b.deliver(); } };
  };
  const makeWorld = () => {
    const w = new World(RULES, 8, ["Host", "Guest 1", "Guest 2", "Computer"], 96, true, { teams: [1, 1, 2, 2] });
    w.ais = [new AIController(3, "normal")];
    for (const ai of w.ais) ai.attach(w);
    return w;
  };
  /** A made-up player: now and then trains a villager, sends idle villagers to work, or moves a few about. */
  const play = (w: World, me: number, rng: RNG, issue: (c: Command) => void) => {
    const mine = w.unitsOf(me);
    const tc = w.buildingsOf(me).find((b) => b.def.id === "town_center");
    const roll = rng.int(0, 9);
    if (roll === 0 && tc) issue({ k: "train", building: tc.id, type: "villager" });
    else if (roll <= 3) {
      const idle = mine.filter((u) => u.isVillager && u.order.kind === "idle").map((u) => u.id);
      const node = w.nearestNode(rng.int(0, 1) ? Res.food : Res.wood, w.startTiles[me].center, 20);
      if (idle.length && node) issue({ k: "smart", ids: idle, target: node.id, x: node.center.x, y: node.center.y });
    } else if (roll === 4 && mine.length) {
      const u = mine[rng.int(0, mine.length - 1)];
      issue({ k: "move", ids: [u.id], x: u.pos.x + rng.int(-3, 3), y: u.pos.y + rng.int(-3, 3) });
    } else if (roll === 5 && tc && w.players[me].res.wood >= 30) {
      issue({ k: "place", type: "house", x: tc.footprint.origin.x + rng.int(-8, 8), y: tc.footprint.origin.y + rng.int(-8, 8), builders: mine.filter((u) => u.isVillager).slice(0, 1).map((u) => u.id) });
    }
  };

  it("three machines, commands from each and a computer, a laggy network: the worlds stay the same", () => {
    const rng = new RNG(99);
    const host = new LockstepHost(makeWorld(), 0);
    const pipes = [pipe(rng, 6), pipe(rng, 3)];
    const guests = pipes.map((p, i) => { host.addGuest(i + 1, p.end1); return new LockstepGuest(makeWorld(), i + 1, p.end2); });
    const peers = [host, ...guests];
    let ran = 0;
    host.onCommand = () => { ran++; };
    for (let step = 0; step < 1500; step++) {
      for (const p of pipes) p.tick();
      for (const p of peers) if (rng.int(0, 3) === 0) play(p.world, p.me, rng, (c) => p.issue(c));
      for (const p of peers) p.advance(p === host ? 1 : 3);
    }
    // Let the guests catch up with the host, then compare all three.
    for (let i = 0; i < 100; i++) { for (const p of pipes) p.tick(); for (const g of guests) g.advance(50); }
    expect(host.turn).toBeGreaterThan(1000);
    for (const g of guests) expect(g.turn).toBe(host.turn);
    expect(ran).toBeGreaterThan(100);
    const state = (w: World) => JSON.stringify(saveWorld(w).world);
    for (const g of guests) expect(state(g.world)).toBe(state(host.world));
    expect(host.desync).toBeNull();
    for (const id of [0, 1, 2]) expect(host.world.unitsOf(id).filter((u) => u.isVillager).length).toBeGreaterThan(RULES.economy.start_villagers);
  }, 120_000);

  it("orders wait no longer than they must: the host's at once, a guest's one round trip", () => {
    // A network that takes three steps each way; each machine plays one step per step, the guest catching up.
    const late = 3;
    const pipeAt = () => {
      const q: { at: number; m: unknown }[] = []; let h: ((m: unknown) => void) | null = null;
      return { send: (m: unknown) => q.push({ at: now + late, m: JSON.parse(JSON.stringify(m)) }), on: (f: (m: unknown) => void) => { h = f; }, flush: () => { while (q.length && q[0].at <= now) h?.(q.shift()!.m); } };
    };
    let now = 0;
    const toGuest = pipeAt(), toHost = pipeAt();
    const host = new LockstepHost(new World(RULES, 3, ["H", "G"], 40, true), 0);
    host.addGuest(1, { send: toGuest.send, onMessage: toHost.on });
    const guest = new LockstepGuest(new World(RULES, 3, ["H", "G"], 40, true), 1, { send: toHost.send, onMessage: toGuest.on });
    const ran: Record<string, number> = {};
    host.onCommand = (p) => { ran[`host${p}`] ??= now; };
    guest.onCommand = (p) => { ran[`guest${p}`] ??= now; };
    let hostAt = 0, guestAt = 0;
    for (let i = 0; i < 200; i++) {
      now++; toGuest.flush(); toHost.flush();
      if (i === 100) { hostAt = now; host.issue({ k: "stop", ids: [host.world.unitsOf(0)[0].id] }); }
      if (i === 140) { guestAt = now; guest.issue({ k: "stop", ids: [guest.world.unitsOf(1)[0].id] }); }
      host.stepTick();
      const behind = Math.max(0, guest.buffered - 1) * TURN_TICKS;
      for (let n = 0; n < 1 + behind && guest.stepTick(); n++) { /* catch up */ }
    }
    expect(ran.host0 - hostAt).toBeLessThanOrEqual(TURN_TICKS); // the host sees its own order within a turn
    expect(ran.guest1 - guestAt).toBeLessThanOrEqual(2 * late + 2 * TURN_TICKS); // a guest: a round trip, a turn or two
  });

  it("the host waits for a guest that falls behind, and finds out when the worlds come apart", () => {
    const rng = new RNG(5);
    const host = new LockstepHost(makeWorld(), 0);
    const p = pipe(rng, 0);
    host.addGuest(1, p.end1);
    const guest = new LockstepGuest(makeWorld(), 1, p.end2);
    // The guest does not play: the host stops MAX_LAG turns on.
    for (let i = 0; i < 40; i++) { p.tick(); host.advance(1); }
    expect(host.turn).toBe(MAX_LAG);
    // Now one world is changed behind the game's back.
    guest.world.players[1].res.set(Res.gold, guest.world.players[1].res.gold + 500);
    for (let i = 0; i < 400; i++) { p.tick(); host.advance(1); guest.advance(5); }
    expect(host.desync).not.toBeNull();
    expect(guest.desync).toBe(host.desync);
  });
});

describe("saving and loading", () => {
  /** A whole match's state, for comparing two worlds: the saved form of everything in it. */
  const state = (w: World) => JSON.stringify(saveWorld(w).world);

  for (const [name, mapType, opts] of [
    ["inland, two AIs", "inland", {}],
    ["islands, with relics, hills and a time limit", "small_islands", { victory: { kind: "time", target: 3600 } }],
  ] as [string, MapType, Partial<WorldOptions>][]) {
    it(`a loaded game goes on exactly as the saved one: ${name}`, () => {
      const w = new World(RULES, 4, ["A", "B", "C"], 72, true, { mapType, teams: [0, 1, 1], ...opts });
      w.ais = [new AIController(0, "hard"), new AIController(1, "normal"), new AIController(2, "easy")];
      for (const ai of w.ais) ai.attach(w);
      run(w, 9 * 60);
      // Through text, as a save file goes to disk and comes back.
      const back = loadWorld(JSON.parse(JSON.stringify(saveWorld(w))), RULES);
      expect(state(back)).toBe(state(w));
      run(w, 6 * 60);
      run(back, 6 * 60);
      expect(back.time).toBe(w.time);
      expect(state(back)).toBe(state(w));
      expect(back.units.length).toBeGreaterThan(20);
    }, 120_000);
  }

  it("refuses a save from another version, and a save that names what these rules lack", () => {
    const w = new World(RULES, 1, ["A", "B"], 24, false);
    w.spawnUnit("villager", 0, new Tile(3, 3).center);
    const f = saveWorld(w);
    expect(() => loadWorld({ ...f, format: 999 }, RULES)).toThrow(/another version/);
    const broken = JSON.parse(JSON.stringify(f).replace('"r":"/units/villager"', '"r":"/units/no_such_unit"'));
    expect(() => loadWorld(broken, RULES)).toThrow(/no_such_unit/);
  });
});

describe("the five AI levels", () => {
  it("Hardest starts with 2,000 more of each resource; the others start even", () => {
    for (const d of ["easiest", "easy", "normal", "hard", "hardest"] as const) {
      const w = new World(RULES, 1, ["A", "B"], 24, false);
      new AIController(1, d).attach(w);
      const extra = d === "hardest" ? 2000 : 0;
      expect(w.players[1].res.food, d).toBe(RULES.economy.start.food + extra);
      expect(w.players[1].res.stone, d).toBe(RULES.economy.start.stone + extra);
    }
  });

  it("Easiest stops at the Tool Age", () => {
    const r = runMatch(RULES, 2, 25, ["easiest", "easiest"]);
    for (const line of r.lines) expect(line).not.toMatch(/Bronze Age|Iron Age/);
  }, 120_000);
});

describe("diplomacy and tribute", () => {
  it("teams start allied, the rest as enemies; units leave the neutral alone and fight enemies", () => {
    const w = new World(RULES, 1, ["A", "B", "C"], 30, false, { teams: [1, 1, 0] });
    expect(w.allied(0, 1)).toBe(true);
    expect(w.isEnemy(0, 2)).toBe(true);
    const guard = w.spawnUnit("clubman", 0, new Tile(10, 10).center);
    const stranger = w.spawnUnit("clubman", 2, new Tile(12, 10).center);
    w.setStance(0, 2, "neutral");
    w.setStance(2, 0, "neutral");
    run(w, 5);
    expect(stranger.hp).toBe(stranger.maxHp);
    expect(guard.hp).toBe(guard.maxHp);
    w.setStance(0, 2, "enemy");
    run(w, 5);
    expect(stranger.hp).toBeLessThan(stranger.maxHp); // A's clubman goes for C's now
    expect(guard.hp).toBe(guard.maxHp); // and C, still neutral, does not strike back
  });

  it("an alliance needs both sides, and allies standing alone win together", () => {
    const w = new World(RULES, 1, ["A", "B", "C"], 30, false);
    for (const i of [0, 1, 2]) w.addBuilding("town_center", i, new Tile(2 + i * 9, 2), true);
    w.setStance(0, 1, "ally");
    expect(w.allied(0, 1)).toBe(false);
    w.setStance(1, 0, "ally");
    expect(w.allied(0, 1)).toBe(true);
    for (const b of w.buildingsOf(2)) w.destroy(2, b.id);
    run(w, 2);
    expect(w.winner === 0 || w.winner === 1).toBe(true);
  });

  it("tribute costs a quarter more, nothing with Coinage, and counts for the score", () => {
    const w = new World(RULES, 1, ["A", "B"], 24, false);
    w.players[0].res.set(Res.gold, 500);
    expect(w.tribute(0, 1, Res.gold, 100)).toBeNull();
    expect(w.players[0].res.gold).toBe(375);
    expect(w.players[1].res.gold).toBe(100);
    w.players[0].mods.research(RULES.techs.get("coinage")!);
    expect(w.tribute(0, 1, Res.gold, 300)).toBeNull();
    expect(w.players[0].res.gold).toBe(75);
    expect(w.tribute(0, 1, Res.gold, 100)).toBe("Not enough resources");
    expect(w.players[0].stats.tributed).toBe(400);
    expect(scores(w)[0].economy).toBeGreaterThanOrEqual(Math.floor(400 / 60));
  });

  it("a computer answers: an enemy back at once, an ally only when neutral and paid enough", () => {
    const w = new World(RULES, 1, ["You", "Computer"], 24, false);
    w.ais = [new AIController(1, "normal")];
    w.setStance(0, 1, "neutral");
    w.players[0].res.set(Res.food, 10000);
    w.tribute(0, 1, Res.food, 3000);
    expect(w.stance[1][0]).toBe("enemy"); // a hostile computer never turns
    w.stance[1][0] = "neutral";
    for (let i = 0; i < 26; i++) w.tribute(0, 1, Res.food, 100);
    expect(w.stance[1][0]).toBe("ally");
    w.setStance(0, 1, "enemy");
    expect(w.stance[1][0]).toBe("enemy");
  });
});

describe("ruins and artifacts", () => {
  /** A blank map with a Town Center each, so nobody is out. */
  const field = (victory: Victory = { kind: "standard" }) => {
    const w = new World(RULES, 1, ["A", "B"], 40, false, { victory });
    w.addBuilding("town_center", 0, new Tile(2, 2), true);
    w.addBuilding("town_center", 1, new Tile(34, 34), true);
    return w;
  };

  it("a map gets five of each, away from the bases, and the rest of the map is as it was", () => {
    const w = new World(RULES, 9, ["A", "B"], 72, true);
    const relics = w.units.filter((u) => u.isRelic);
    expect(relics.filter((r) => r.def.id === "ruins").length).toBe(5);
    expect(relics.filter((r) => r.def.id === "artifact").length).toBe(5);
    for (const r of relics) for (const s of w.startTiles) expect(r.pos.distance(s.center)).toBeGreaterThanOrEqual(16);
    const plain = new World(RULES, 9, ["A", "B"], 72, true, { relics: false });
    expect(plain.units.some((u) => u.isRelic)).toBe(false);
    expect(plain.nodes.map((n) => n.tile.x * 1000 + n.tile.y)).toEqual(w.nodes.map((n) => n.tile.x * 1000 + n.tile.y));
  });

  it("a Ruin goes to whoever comes near, and stays while the holder has someone there", () => {
    const w = field();
    const ruin = w.spawnRelic("ruins", new Tile(20, 20).center);
    const a = w.spawnUnit("clubman", 0, new Tile(20, 22).center);
    run(w, 1);
    expect(ruin.owner).toBe(0);
    const b = w.spawnUnit("clubman", 1, new Tile(21, 18).center);
    w.stop(1, [b.id]);
    run(w, 1);
    expect(ruin.owner).toBe(0); // A is still beside it
    w.move(0, [a.id], new Tile(10, 10).center);
    run(w, 8);
    expect(ruin.owner).toBe(1);
    // Nobody can attack, convert or delete it.
    expect(w.hostile(0, ruin)).toBe(false);
    w.destroy(1, ruin.id);
    expect(ruin.alive).toBe(true);
  });

  it("an Artifact walks where its holder sends it, and an enemy beside it takes it", () => {
    const w = field();
    const art = w.spawnRelic("artifact", new Tile(20, 20).center);
    w.spawnUnit("villager", 0, new Tile(20, 21).center);
    run(w, 1);
    expect(art.owner).toBe(0);
    w.move(0, [art.id], new Tile(10, 20).center);
    run(w, 20);
    expect(art.pos.distance(new Tile(10, 20).center)).toBeLessThan(1);
    w.spawnUnit("clubman", 1, new Tile(11, 20).center);
    run(w, 1);
    expect(art.owner).toBe(1);
  });

  it("holding every Ruin for the Wonder's time wins, but not when only conquest counts", () => {
    for (const victory of [{ kind: "standard" }, { kind: "conquest" }] as Victory[]) {
      const w = field(victory);
      for (let i = 0; i < 3; i++) w.spawnRelic("ruins", new Tile(15 + i * 4, 20).center);
      for (let i = 0; i < 3; i++) w.spawnUnit("scout", 1, new Tile(15 + i * 4, 21).center);
      run(w, 2);
      expect(w.relicHold.ruins?.player).toBe(1);
      // The score: 10 a Ruin, and 50 for all of them.
      expect(scores(w)[1].religion).toBe(30 + 50);
      run(w, (RULES.economy.wonder_seconds ?? 900) + 2);
      expect(w.winner).toBe(victory.kind === "standard" ? 1 : null);
    }
  });

  it("an Artifact in a transport that sinks washes up on the shore", () => {
    const w = field();
    for (let y = 0; y < 40; y++) for (let x = 12; x < 28; x++) w.map.terrain[w.map.index(new Tile(x, y))] = Terrain.water;
    const boat = w.spawnUnit("light_transport", 0, new Tile(20, 20).center);
    const art = w.spawnRelic("artifact", new Tile(11, 20).center);
    art.owner = 0;
    art.aboard = boat.id; boat.cargo.push(art.id);
    w.spawnUnit("war_galley", 1, new Tile(22, 20).center);
    run(w, 60);
    expect(boat.alive).toBe(false);
    expect(art.alive).toBe(true);
    expect(art.aboard).toBeNull();
    expect(w.map.terrainAt(art.pos.tile)).not.toBe(Terrain.water);
  });
});

describe("hills, cliffs and shallows", () => {
  it("from higher ground, about a quarter of the hits do three times the damage", () => {
    const hits = (attackerHigh: boolean) => {
      const w = blank(30);
      if (attackerHigh) for (let y = 0; y < 30; y++) for (let x = 0; x < 8; x++) w.map.elevation[w.map.index(new Tile(x, y))] = 2;
      const archer = w.spawnUnit("bowman", 0, new Tile(6, 10).center);
      const target = w.spawnUnit("hoplite", 1, new Tile(9, 10).center);
      target.hp = target.maxHp = 100000;
      w.setStandGround(0, [archer.id], true);
      w.setStandGround(1, [target.id], true);
      w.attack(0, [archer.id], target.id);
      run(w, 300);
      return 100000 - target.hp;
    };
    const flat = hits(false), high = hits(true);
    // Triple damage a quarter of the time is 1.5 times as much in all.
    expect(high / flat).toBeGreaterThan(1.3);
    expect(high / flat).toBeLessThan(1.7);
  });

  it("land units wade through shallows and boats sail over them; nobody crosses a cliff", () => {
    const w = blank(30);
    for (let y = 0; y < 30; y++) {
      w.map.terrain[w.map.index(new Tile(10, y))] = Terrain.cliff;
      for (let x = 18; x < 30; x++) w.map.terrain[w.map.index(new Tile(x, y))] = x < 22 ? Terrain.shallows : Terrain.water;
    }
    const c = w.spawnUnit("clubman", 0, new Tile(15, 5).center);
    w.move(0, [c.id], new Tile(20, 5).center);
    run(w, 10);
    expect(c.pos.distance(new Tile(20, 5).center)).toBeLessThan(1); // into the shallows
    w.move(0, [c.id], new Tile(5, 5).center);
    run(w, 15);
    expect(c.pos.x).toBeGreaterThan(11); // the cliff is in the way all along
    const boat = w.spawnUnit("fishing_boat", 0, new Tile(25, 5).center);
    w.move(0, [boat.id], new Tile(19, 8).center);
    run(w, 15);
    expect(boat.pos.distance(new Tile(19, 8).center)).toBeLessThan(1);
    // No building on the shallows.
    expect(w.canPlace("house", new Tile(18, 12), 0)).toBe(false);
  });

  it("maps have hills that rise a step at a time, flat bases, and cliffs that cut no base off", () => {
    for (const seed of [2, 9, 13]) {
      const w = new World(RULES, seed, ["A", "B", "C", "D"], 96, true);
      const m = w.map, n = m.width;
      expect(m.elevation.some((e) => e >= 2)).toBe(true);
      for (let y = 0; y < n; y++) for (let x = 0; x + 1 < n; x++) expect(Math.abs(m.elevation[y * n + x] - m.elevation[y * n + x + 1])).toBeLessThanOrEqual(1);
      for (const s of w.startTiles) expect(m.elevationAt(s)).toBe(0);
      const seen = m.reachable(new Tile(w.startTiles[0].x + 2, w.startTiles[0].y + 2), (id) => w.building(id) !== null);
      for (const s of w.startTiles) expect(seen[m.index(new Tile(s.x + 2, s.y + 2))]).toBe(1);
    }
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

  it("ends headless matches with the stronger AI winning nearly all of them", () => {
    // One map can favour the weaker side (its civilization, where the woods fall), so this asks for
    // most of six, not every one: both the old and the denser-forest maps win about 9 in 10.
    const losses: string[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = runMatch(RULES, seed, 75, ["hard", "easy"]);
      if (r.winner !== 0) losses.push(`seed ${seed}:\n${r.lines.join("\n")}`);
      expect(r.problems).toEqual([]);
    }
    expect(losses.length, losses.join("\n\n")).toBeLessThanOrEqual(1);
    // Six full matches: three minutes is not enough once games run past forty minutes, or on a slower CI machine.
  }, 600_000);
});
