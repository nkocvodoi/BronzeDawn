// Hints for a new player: the army building that suits what the civilization is good at, and the techs that
// make its units better, lit a little brighter on the command buttons until they are built or researched.
// The Hittites' archers point to the Archery Range and the bow upgrades, the Romans' swordsmen to the
// Barracks and the swords. Read from the civilization's bonuses the way the computer reads them
// (civbent.ts), so a new civilization needs nothing here.
//
// Every civilization gets some: one whose army bonus is small (the Greeks' quicker Academy infantry) is
// pointed at it all the same, and one with no army bonus at all (the Shang's cheap villagers) at the army
// building whose line of upgrades it has most of.
import { civBent } from "./civbent";
import { Terrain } from "./grid";
import type { UnitDef } from "./rules";
import { unitMatches } from "./stats";
import type { World } from "./world";

/** A unit the civilization makes at least this much better (a fifth) is one of its strengths. */
const GOOD = 0.2;
/** The army buildings hinted: the civilization's two best (the Hittites' Siege Workshop and Archery Range). */
const BUILDINGS = 2;
/** With only small bonuses, a building counts if its best is at least this share of the civ's best. */
const NEAR_BEST = 0.6;

/** Why the hints light what they do: the civilization's strengths, or (none in its army) the line it has
 *  most of. */
export type HintReason = "strength" | "line";

/** Whether most of the map is sea, so war ships are part of the army (islands, a sea in the middle). */
const seaMaps = new WeakMap<World, boolean>();
function seaMap(w: World) {
  let v = seaMaps.get(w);
  if (v === undefined) {
    let wet = 0;
    for (const t of w.map.terrain) if (t === Terrain.water) wet++;
    v = wet / w.map.terrain.length > 0.3;
    seaMaps.set(w, v);
  }
  return v;
}

/** Ids of the buildings to build and techs to research that the hints light up, for one player now, and why. */
export function hintsWhy(w: World, player: number): { ids: Set<string>; reason: HintReason } {
  const p = w.players[player], out = new Set<string>();
  const bent = civBent(w.rules, p.civ ?? null, w.fullTechTree);
  const off = new Set(w.fullTechTree ? [] : p.civ?.disabled ?? []);
  // Soldiers only: villagers and fishing boats are not what a new player's army is; war ships only where
  // the map is mostly sea.
  const sea = seaMap(w);
  const soldier = (u: UnitDef) => !!u.tags?.includes("military") && (sea || !u.tags.includes("boat")) && !off.has(u.id) && (!u.civ || u.civ === p.civ?.id);
  const gain = (u: UnitDef) => (soldier(u) ? bent.unit.get(u.id) ?? 0 : 0);
  const trains = (id: string) => (w.rules.buildings.get(id)?.trains ?? []).map((t) => w.rules.units.get(t)).filter((u): u is UnitDef => !!u);
  const score = new Map<string, number>();
  for (const b of w.rules.buildings.values()) {
    const best = Math.max(0, ...trains(b.id).map(gain));
    if (best > 0) score.set(b.id, best);
  }
  const top = Math.max(0, ...score.values());
  let reason: HintReason = "strength";
  let picked: string[], units: UnitDef[];
  if (top > 0) {
    // A strength of a fifth or more, or, where all are small, those near the civ's best.
    const strong = Math.min(GOOD, top * NEAR_BEST);
    picked = [...score].filter(([, s]) => s >= strong).sort((a, b) => b[1] - a[1]).slice(0, BUILDINGS).map(([id]) => id);
    units = [...w.rules.units.values()].filter((u) => picked.includes(u.trained_at) && gain(u) >= strong);
  } else {
    // Nothing in its army is better than anyone's: the land army building with the most of its line left
    // to the civ (units and their upgrades), so the hints still say where to put the gold.
    reason = "line";
    const land = (id: string) => trains(id).filter((u) => soldier(u) && !u.tags?.includes("boat"));
    const line = (id: string) => land(id).length
      + [...w.rules.techs.values()].filter((t) => !off.has(t.id) && t.effects.some((e) => e.type === "upgrade" && land(id).some((u) => u.id === e.from))).length;
    const best = [...w.rules.buildings.values()].map((b) => [b.id, line(b.id)] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
    picked = best ? [best[0]] : [];
    units = best ? land(best[0]) : [];
  }
  const have = new Set(w.buildingsOf(player).map((b) => b.def.id));
  for (const id of picked) if (!have.has(id)) out.add(id);
  // Its units' own upgrades and the techs aimed at them.
  const ids = new Set(units.map((u) => u.id));
  for (const t of w.rules.techs.values()) {
    if (p.mods.has(t.id) || p.mods.disabled.has(t.id) || (t.civ && t.civ !== p.civ?.id)) continue;
    if (t.effects.some((e) => (e.type === "upgrade" && ids.has(e.from)) || (e.type === "stat" && units.some((u) => unitMatches(e.target, u))))) out.add(t.id);
  }
  return { ids: out, reason };
}

/** Ids of the buildings to build and techs to research that the hints light up, for one player now. */
export function hints(w: World, player: number): Set<string> {
  return hintsWhy(w, player).ids;
}
