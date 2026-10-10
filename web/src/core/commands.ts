// A player's orders as plain data. Played alone, the interface runs each at once; played online, it is
// sent to every machine and run on all of them on the same turn, which keeps their worlds the same.
// Positions travel as numbers, ids as numbers: nothing in a command points into one machine's memory.
import { Vec2, Tile } from "./geom";
import { Res } from "./rules";
import type { SmartResult, Stance, World } from "./world";

export type Command =
  | { k: "move"; ids: number[]; x: number; y: number; attackMove?: boolean }
  | { k: "waypoint"; ids: number[]; x: number; y: number }
  | { k: "smart"; ids: number[]; target: number | null; x: number; y: number }
  | { k: "rally"; building: number; x: number; y: number }
  | { k: "place"; type: string; x: number; y: number; builders: number[] }
  | { k: "wall"; type: string; ax: number; ay: number; bx: number; by: number; builders: number[] }
  | { k: "train"; building: number; type: string }
  | { k: "research"; building: number; tech: string }
  | { k: "age"; building: number }
  | { k: "cancel"; building: number }
  | { k: "destroy"; ids: number[] }
  | { k: "stop"; ids: number[] }
  | { k: "standGround"; ids: number[]; on: boolean }
  | { k: "unload"; ids: number[] }
  | { k: "attackGround"; ids: number[]; x: number; y: number }
  | { k: "repair"; ids: number[]; target: number }
  | { k: "sacrifice"; priest: number; target: number }
  | { k: "stance"; to: number; stance: Stance }
  | { k: "tribute"; to: number; res: Res; amount: number };

/** What running a command said: a reason it could not be done, the result of a right-click, or nothing. */
export type CommandResult = string | null | SmartResult | { id: number } | { error: string } | { placed: number } | boolean | void;

/** Runs one of a player's commands in a world. */
export function runCommand(w: World, player: number, c: Command): CommandResult {
  const at = (x: number, y: number) => new Vec2(x, y);
  switch (c.k) {
    case "move": return w.move(player, c.ids, at(c.x, c.y), c.attackMove === true);
    case "waypoint": return w.waypoint(player, c.ids, at(c.x, c.y));
    case "smart": return w.smart(player, c.ids, c.target, at(c.x, c.y));
    case "rally": return w.setRally(player, c.building, at(c.x, c.y));
    case "place": return w.place(player, c.type, new Tile(c.x, c.y), c.builders);
    case "wall": return w.placeWall(player, c.type, new Tile(c.ax, c.ay), new Tile(c.bx, c.by), c.builders);
    case "train": return w.train(player, c.building, c.type);
    case "research": return w.research(player, c.building, c.tech);
    case "age": return w.advanceAge(player, c.building);
    case "cancel": return w.cancel(player, c.building);
    case "destroy": for (const id of c.ids) w.destroy(player, id); return;
    case "stop": return w.stop(player, c.ids);
    case "standGround": return w.setStandGround(player, c.ids, c.on);
    case "unload": {
      for (const id of c.ids) { const t = w.unit(id); if (t) w.unload(player, [t.id], t.pos); }
      return;
    }
    case "attackGround": return w.attackGround(player, c.ids, at(c.x, c.y));
    case "repair": return w.repair(player, c.ids, c.target);
    case "sacrifice": return w.sacrifice(player, c.priest, c.target);
    case "stance": return w.setStance(player, c.to, c.stance);
    case "tribute": return w.tribute(player, c.to, c.res, c.amount);
  }
}

/** Whether something is a well-formed command, for what arrives over the network. */
export function isCommand(x: unknown): x is Command {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  const num = (k: string) => typeof c[k] === "number" && Number.isFinite(c[k]);
  const ids = (k: string) => Array.isArray(c[k]) && (c[k] as unknown[]).length <= 200 && (c[k] as unknown[]).every((v) => typeof v === "number" && Number.isInteger(v));
  const str = (k: string) => typeof c[k] === "string" && (c[k] as string).length < 64;
  switch (c.k) {
    case "move": case "waypoint": case "attackGround": return ids("ids") && num("x") && num("y");
    case "smart": return ids("ids") && (c.target === null || num("target")) && num("x") && num("y");
    case "rally": return num("building") && num("x") && num("y");
    case "place": return str("type") && num("x") && num("y") && ids("builders");
    case "wall": return str("type") && num("ax") && num("ay") && num("bx") && num("by") && ids("builders");
    case "train": return num("building") && str("type");
    case "research": return num("building") && str("tech");
    case "age": case "cancel": return num("building");
    case "destroy": case "stop": case "unload": return ids("ids");
    case "standGround": return ids("ids") && typeof c.on === "boolean";
    case "repair": return ids("ids") && num("target");
    case "sacrifice": return num("priest") && num("target");
    case "stance": return num("to") && (c.stance === "ally" || c.stance === "neutral" || c.stance === "enemy");
    case "tribute": return num("to") && num("res") && num("amount") && (c.amount as number) > 0 && (c.amount as number) <= 10000;
    default: return false;
  }
}
