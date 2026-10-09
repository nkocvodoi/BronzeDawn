import { describe, expect, it } from "vitest";
import { RULES } from "../src/core/data";
import { Tile, Vec2 } from "../src/core/geom";
import { Terrain } from "../src/core/grid";
import { Res } from "../src/core/rules";
import { scores } from "../src/core/score";
import { runMatch } from "../src/core/sim";
import { startTiles } from "../src/core/mapgen";
import { AIController } from "../src/core/ai";
import { World } from "../src/core/world";

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
  }, 180_000);
});
