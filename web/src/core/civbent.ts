// What a civilization is good at, read from its bonuses in rules.json, for the computer to play to it: the
// Yamato's cheap cavalry, the Assyrians' quick archers, the Phoenicians' cheap elephants, a navy for the
// Minoans. Nothing here is per civ by name; a new civ or new numbers are read the same way.
import type { CivDef, Effect, Rules, UnitDef } from "./rules";
import { unitMatches } from "./stats";

export interface CivBent {
  /** How much the civ's bonuses help each unit: 0 for none, 0.3 for about a third more for the same cost. */
  unit: Map<string, number>;
  /** The best of what each building trains, of what the civ can have. */
  building: Map<string, number>;
}

/** How far one effect makes a unit better, as a share of what it was. */
function gain(e: Extract<Effect, { type: "stat" }>, u: UnitDef): number {
  const v = e.value;
  switch (e.stat) {
    case "hp": return e.op === "mul" ? v - 1 : e.op === "add" ? v / Math.max(1, u.hp) : v / Math.max(1, u.hp) - 1;
    case "attack": return e.op === "mul" ? v - 1 : e.op === "add" ? v / Math.max(1, u.attack) : 0;
    case "armor": case "pierce_armor": return e.op === "add" ? 0.08 * v : 0;
    // Firing sooner is more blows for the same unit; a time set outright may be slower than its own.
    case "attack_cooldown": return e.op === "mul" ? 1 / v - 1 : e.op === "set" ? u.attack_cooldown / v - 1 : 0;
    case "speed": return 0.5 * (e.op === "mul" ? v - 1 : e.op === "add" ? v / Math.max(0.1, u.speed) : 0);
    case "range": return u.range > 0 && e.op === "add" ? (0.5 * v) / u.range : 0;
    case "cost": return e.op === "mul" ? 1 / v - 1 : 0;
    case "train_time": return e.op === "mul" ? 0.3 * (1 / v - 1) : 0;
    default: return 0; // line of sight and the like: nice, not a reason to build an army of them
  }
}

/** `fullTree`: the full tech tree setting is on, so nothing is out of the civ's reach. */
export function civBent(rules: Rules, civ: CivDef | null, fullTree = false): CivBent {
  const unit = new Map<string, number>();
  const building = new Map<string, number>();
  if (!civ) return { unit, building };
  const off = new Set(fullTree ? [] : civ.disabled);
  for (const u of rules.units.values()) {
    if (off.has(u.id) || u.tags?.includes("animal")) continue;
    let g = 0;
    for (const e of civ.effects) if (e.type === "stat" && unitMatches(e.target, u)) g += gain(e, u);
    if (g !== 0) unit.set(u.id, Math.round(g * 1000) / 1000);
  }
  for (const b of rules.buildings.values()) {
    const trains = (b.trains ?? []).filter((t) => !off.has(t) && rules.units.has(t) && t !== "villager");
    if (!trains.length) continue;
    // Of a warship's dock, only what fights counts.
    const fights = trains.filter((t) => (rules.units.get(t)!.attack ?? 0) > 0);
    const best = Math.max(0, ...fights.map((t) => unit.get(t) ?? 0));
    if (best > 0) building.set(b.id, best);
  }
  return { unit, building };
}
