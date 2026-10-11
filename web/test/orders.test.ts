// Orders: what every command does, and what a command from another machine may not do. Online, the
// commands are all that travels between the players, so each is checked as it arrives (isCommand), and a
// command can only move what belongs to the player who gave it, whatever ids it names.
import { describe, expect, it } from "vitest";
import { Command, isCommand, runCommand } from "../src/core/commands";
import { RULES } from "../src/core/data";
import { Tile } from "../src/core/geom";
import { Res } from "../src/core/rules";
import { saveWorld } from "../src/core/save";
import { World } from "../src/core/world";

const blank = (size = 32) => new World(RULES, 1, ["A", "B"], size, false);
const run = (w: World, seconds: number) => { for (let i = 0; i < Math.round(seconds / World.dt); i++) w.step(); };
const state = (w: World) => JSON.stringify(saveWorld(w).world);

/** A world with something of each kind for both players. */
function town() {
  const w = blank();
  for (const p of w.players) for (const r of [Res.wood, Res.food, Res.gold, Res.stone]) p.res.set(r, 2000);
  for (const f of w.fog) f.revealAll(); // a site must have been seen to be built on
  const tc0 = w.addBuilding("town_center", 0, new Tile(3, 3), true);
  const tc1 = w.addBuilding("town_center", 1, new Tile(24, 24), true);
  const v0 = w.spawnUnit("villager", 0, new Tile(8, 8).center);
  const v1 = w.spawnUnit("villager", 1, new Tile(22, 22).center);
  const c0 = w.spawnUnit("clubman", 0, new Tile(9, 8).center);
  const c1 = w.spawnUnit("clubman", 1, new Tile(21, 22).center);
  const tree = w.addNode("tree", new Tile(12, 12))!;
  return { w, tc0, tc1, v0, v1, c0, c1, tree };
}

describe("commands as they arrive over the network", () => {
  const good: Command[] = [
    { k: "move", ids: [1, 2], x: 3, y: 4 }, { k: "move", ids: [1], x: 3, y: 4, attackMove: true },
    { k: "waypoint", ids: [1], x: 3, y: 4 }, { k: "attackGround", ids: [1], x: 3, y: 4 },
    { k: "smart", ids: [1], target: null, x: 1, y: 2 }, { k: "smart", ids: [1], target: 7, x: 1, y: 2 },
    { k: "rally", building: 3, x: 1, y: 2 }, { k: "place", type: "house", x: 1, y: 2, builders: [1] },
    { k: "wall", type: "small_wall", ax: 1, ay: 2, bx: 5, by: 2, builders: [] },
    { k: "train", building: 3, type: "villager" }, { k: "research", building: 3, tech: "wheel" },
    { k: "age", building: 3 }, { k: "cancel", building: 3 }, { k: "destroy", ids: [1] }, { k: "stop", ids: [1] },
    { k: "standGround", ids: [1], on: true }, { k: "unload", ids: [1] }, { k: "repair", ids: [1], target: 3 },
    { k: "sacrifice", priest: 1, target: 2 }, { k: "stance", to: 1, stance: "ally" },
    { k: "tribute", to: 1, res: Res.gold, amount: 100 }, { k: "takeover", player: 1 }, { k: "rejoin", player: 1 },
  ];

  it("takes every kind of command, well formed", () => {
    for (const c of good) expect(isCommand(c), JSON.stringify(c)).toBe(true);
    // And through text, as they travel.
    for (const c of good) expect(isCommand(JSON.parse(JSON.stringify(c)))).toBe(true);
  });

  it("refuses what is not a command, or not a well-formed one", () => {
    const bad: unknown[] = [
      null, undefined, 3, "move", [], {}, { k: "fly", ids: [1] },
      { k: "move", ids: "1", x: 1, y: 1 }, { k: "move", ids: [1.5], x: 1, y: 1 }, { k: "move", ids: [1], x: "1", y: 1 },
      { k: "move", ids: [1], x: NaN, y: 1 }, { k: "move", ids: [1], x: Infinity, y: 1 }, { k: "move", ids: [1], y: 1 },
      { k: "move", ids: Array.from({ length: 201 }, (_, i) => i), x: 1, y: 1 },
      { k: "smart", ids: [1], target: "7", x: 1, y: 1 }, { k: "place", type: 7, x: 1, y: 1, builders: [] },
      { k: "place", type: "x".repeat(80), x: 1, y: 1, builders: [] }, { k: "train", building: 3 },
      { k: "standGround", ids: [1], on: "yes" }, { k: "stance", to: 1, stance: "friend" },
      { k: "tribute", to: 1, res: 3, amount: 0 }, { k: "tribute", to: 1, res: 3, amount: -100 },
      { k: "tribute", to: 1, res: 3, amount: 1e9 }, { k: "takeover" }, { k: "rejoin", player: "1" },
      // Numbers out of their range: a player that cannot be, a resource there is not, an id in pieces.
      { k: "tribute", to: 1, res: 99, amount: 100 }, { k: "tribute", to: 8, res: 3, amount: 100 },
      { k: "stance", to: -1, stance: "ally" }, { k: "stance", to: 1.5, stance: "ally" }, { k: "takeover", player: 99 },
      { k: "train", building: 3.5, type: "villager" }, { k: "smart", ids: [1], target: -2, x: 1, y: 1 },
    ];
    for (const c of bad) expect(isCommand(c), JSON.stringify(c)).toBe(false);
  });

  it("each command does what it says", () => {
    const { w, tc0, v0, c0, tree } = town();
    runCommand(w, 0, { k: "move", ids: [c0.id], x: 14, y: 8 });
    runCommand(w, 0, { k: "smart", ids: [v0.id], target: tree.id, x: tree.center.x, y: tree.center.y });
    runCommand(w, 0, { k: "train", building: tc0.id, type: "villager" });
    runCommand(w, 0, { k: "rally", building: tc0.id, x: 10, y: 3 });
    expect(c0.order.kind).toBe("move");
    expect(v0.order.kind).toBe("gather");
    expect(tc0.queue.length).toBe(1);
    expect(tc0.rally?.x).toBe(10);
    runCommand(w, 0, { k: "cancel", building: tc0.id });
    expect(tc0.queue.length).toBe(0);
    runCommand(w, 0, { k: "standGround", ids: [c0.id], on: true });
    expect(c0.standGround).toBe(true);
    runCommand(w, 0, { k: "stop", ids: [c0.id, v0.id] });
    expect(c0.order.kind).toBe("idle");
    expect(v0.order.kind).toBe("idle");
    const placed = runCommand(w, 0, { k: "place", type: "house", x: 10, y: 10, builders: [v0.id] }) as { id?: number };
    expect(placed.id).toBeGreaterThan(0);
    expect(v0.order.kind).toBe("build");
    runCommand(w, 0, { k: "stance", to: 1, stance: "neutral" });
    expect(w.stance[0][1]).toBe("neutral");
    const gold = w.players[1].res.gold;
    runCommand(w, 0, { k: "tribute", to: 1, res: Res.gold, amount: 100 });
    expect(w.players[1].res.gold).toBe(gold + 100);
    runCommand(w, 0, { k: "destroy", ids: [c0.id] });
    run(w, 1);
    expect(c0.alive).toBe(false);
  });

  it("moves only what belongs to the player who gave the command, whatever ids it names", () => {
    const { w, tc1, v1, c1, c0 } = town();
    const before = state(w);
    const theirs = [v1.id, c1.id];
    // Player 0 names player 1's units and buildings in every command there is.
    const meddling: Command[] = [
      { k: "move", ids: theirs, x: 2, y: 2 }, { k: "waypoint", ids: theirs, x: 2, y: 2 },
      { k: "attackGround", ids: theirs, x: 2, y: 2 }, { k: "smart", ids: theirs, target: c0.id, x: 2, y: 2 },
      { k: "rally", building: tc1.id, x: 2, y: 2 }, { k: "train", building: tc1.id, type: "villager" },
      { k: "research", building: tc1.id, tech: "wheel" }, { k: "age", building: tc1.id }, { k: "cancel", building: tc1.id },
      { k: "destroy", ids: [...theirs, tc1.id] }, { k: "stop", ids: theirs }, { k: "standGround", ids: theirs, on: true },
      { k: "unload", ids: theirs }, { k: "repair", ids: theirs, target: tc1.id },
      { k: "place", type: "house", x: 18, y: 18, builders: theirs },
      { k: "takeover", player: 0 }, { k: "rejoin", player: 0 },
    ];
    for (const c of meddling) runCommand(w, 0, c);
    // A house of player 0's own may stand now, with no one to build it; nothing of player 1's changed.
    for (const id of theirs) expect(w.unit(id)?.order.kind, `unit ${id}`).toBe("idle");
    expect(tc1.queue.length).toBe(0);
    expect(tc1.rally).toBeNull();
    expect(w.players[1].res.wood).toBe(2000);
    expect(w.unit(c1.id)?.standGround).toBe(false);
    expect(w.ais.length).toBe(0);
    run(w, 2);
    expect(v1.alive && c1.alive && tc1.alive).toBe(true);
    void before;
  });

  it("ids of nothing, players and resources that are not there, a place off the map: nothing breaks", () => {
    const { w, tc0, c0, v0 } = town();
    const odd: Command[] = [
      { k: "move", ids: [99999], x: 5, y: 5 }, { k: "smart", ids: [c0.id], target: 99999, x: 5, y: 5 },
      { k: "move", ids: [c0.id], x: 1e7, y: -1e7 }, { k: "attackGround", ids: [c0.id], x: -50, y: 9999 },
      { k: "rally", building: 99999, x: 1, y: 1 }, { k: "train", building: tc0.id, type: "dragon" },
      { k: "research", building: tc0.id, tech: "magic" }, { k: "place", type: "castle", x: 5, y: 5, builders: [] },
      { k: "place", type: "house", x: -20, y: 900, builders: [v0.id] },
      { k: "wall", type: "small_wall", ax: -5, ay: -5, bx: 9999, by: 9999, builders: [] },
      { k: "stance", to: 99, stance: "ally" }, { k: "stance", to: -1, stance: "enemy" }, { k: "stance", to: 0, stance: "ally" },
      { k: "tribute", to: 99, res: Res.gold, amount: 100 }, { k: "tribute", to: 1, res: 99 as Res, amount: 100 },
      { k: "tribute", to: 0, res: Res.gold, amount: 100 }, { k: "sacrifice", priest: 99999, target: 99998 },
      { k: "takeover", player: 99 }, { k: "rejoin", player: -3 },
    ];
    for (const c of odd) expect(() => runCommand(w, 0, c), JSON.stringify(c)).not.toThrow();
    expect(() => run(w, 5)).not.toThrow();
    // The unit sent off the map is still on it; resources are numbers still; no player was added.
    expect(w.map.inside(c0.pos.tile)).toBe(true);
    for (const p of w.players) for (const v of p.res.values) expect(Number.isFinite(v)).toBe(true);
    expect(w.players[0].res.gold).toBe(2000);
    expect(w.players.length).toBe(2);
    expect(w.stance.length).toBe(2);
    for (const row of w.stance) expect(row.length).toBe(2);
  });
});

describe("orders in the game", () => {
  it("a priest heals a hurt unit of its own", () => {
    const { w } = town();
    w.players[0].age = 2;
    const priest = w.spawnUnit("priest", 0, new Tile(8, 12).center);
    const hurt = w.spawnUnit("clubman", 0, new Tile(10, 12).center);
    hurt.hp = 10;
    expect(w.smart(0, [priest.id], hurt.id, hurt.pos)).toBe("healed");
    run(w, 20);
    expect(hurt.hp).toBeGreaterThan(20);
  });

  it("cancelling training gives the cost back", () => {
    const { w, tc0 } = town();
    const food = w.players[0].res.food;
    expect(w.train(0, tc0.id, "villager")).toBeNull();
    expect(w.players[0].res.food).toBeLessThan(food);
    w.cancel(0, tc0.id);
    expect(w.players[0].res.food).toBe(food);
    expect(tc0.queue.length).toBe(0);
  });

  it("research costs its price, takes its time, and is then known", () => {
    const { w } = town();
    w.players[0].age = 1;
    const pit = w.addBuilding("storage_pit", 0, new Tile(10, 3), true);
    expect(w.techsAt(pit, 0).map((t) => t.id)).toContain("toolworking");
    const before = [...w.players[0].res.values];
    expect(w.research(0, pit.id, "toolworking")).toBeNull();
    expect(w.players[0].res.values.some((v, i) => v < before[i])).toBe(true);
    expect(w.research(0, pit.id, "toolworking")).not.toBeNull(); // not twice
    expect(w.players[0].mods.has("toolworking")).toBe(false);
    run(w, 200);
    expect(w.players[0].mods.has("toolworking")).toBe(true);
    expect(w.techsAt(pit, 0).map((t) => t.id)).not.toContain("toolworking");
  });

  it("a wall dragged out is laid tile by tile, and built", () => {
    const { w, v0 } = town();
    w.players[0].age = 1;
    expect(w.placeWall(0, "small_wall", new Tile(8, 16), new Tile(13, 16), [v0.id])).toEqual({ error: "Research Small Wall" });
    const granary = w.addBuilding("granary", 0, new Tile(14, 3), true);
    expect(w.research(0, granary.id, "small_wall_tech")).toBeNull();
    run(w, 120);
    const r = w.placeWall(0, "small_wall", new Tile(8, 16), new Tile(13, 16), [v0.id]) as { placed?: number };
    expect(r.placed).toBe(6);
    expect(w.buildingsOf(0).filter((b) => b.isWall).length).toBe(6);
    run(w, 120);
    expect(w.buildingsOf(0).filter((b) => b.isWall && b.complete).length).toBe(6);
  });

  it("a right-click on your own building: a load is dropped off there, a damage repaired", () => {
    const { w, tc0, v0 } = town();
    v0.carry = 8; v0.carryRes = Res.wood;
    const wood = w.players[0].res.wood;
    expect(w.smart(0, [v0.id], tc0.id, tc0.center)).toBe("returned");
    run(w, 10);
    expect(w.players[0].res.wood).toBeGreaterThan(wood);
    tc0.hp = tc0.maxHp / 2;
    expect(w.smart(0, [v0.id], tc0.id, tc0.center)).toBe("repaired");
    run(w, 20);
    expect(tc0.hp).toBeGreaterThan(tc0.maxHp / 2);
  });
});
