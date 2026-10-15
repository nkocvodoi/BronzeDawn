// Hints for a new player: the army building that suits what the civilization is good at, and the techs that
// make its units better, lit a little brighter on the command buttons until they are built or researched.
// The Hittites' archers point to the Archery Range and the bow upgrades, the Romans' swordsmen to the
// Barracks and the swords. Read from the civilization's bonuses the way the computer reads them
// (civbent.ts), so a new civilization needs nothing here.
import { civBent } from "./civbent";
import type { UnitDef } from "./rules";
import { unitMatches } from "./stats";
import type { World } from "./world";

/** A unit the civilization makes at least this much better (a fifth) is one of its strengths. */
const GOOD = 0.2;
/** The army buildings hinted: the civilization's two best (the Hittites' Siege Workshop and Archery Range). */
const BUILDINGS = 2;

/** Ids of the buildings to build and techs to research that the hints light up, for one player now. */
export function hints(w: World, player: number): Set<string> {
  const p = w.players[player], out = new Set<string>();
  const bent = civBent(w.rules, p.civ ?? null, w.fullTechTree);
  // Soldiers on land only: villagers, fishing boats and war ships are not what a new player's army is.
  const gain = (u: UnitDef) => (u.tags?.includes("military") && !u.tags.includes("boat") ? bent.unit.get(u.id) ?? 0 : 0);
  const score = new Map<string, number>();
  for (const b of w.rules.buildings.values()) {
    const best = Math.max(0, ...(b.trains ?? []).map((t) => w.rules.units.get(t)).filter((u): u is UnitDef => !!u).map(gain));
    if (best >= GOOD) score.set(b.id, best);
  }
  const picked = [...score].sort((a, b) => b[1] - a[1]).slice(0, BUILDINGS).map(([id]) => id);
  const have = new Set(w.buildingsOf(player).map((b) => b.def.id));
  for (const id of picked) if (!have.has(id)) out.add(id);
  // Its units' own upgrades and the techs aimed at them.
  const units = [...w.rules.units.values()].filter((u) => picked.includes(u.trained_at) && gain(u) >= GOOD);
  const ids = new Set(units.map((u) => u.id));
  for (const t of w.rules.techs.values()) {
    if (p.mods.has(t.id) || p.mods.disabled.has(t.id) || (t.civ && t.civ !== p.civ?.id)) continue;
    if (t.effects.some((e) => (e.type === "upgrade" && ids.has(e.from)) || (e.type === "stat" && units.some((u) => unitMatches(e.target, u))))) out.add(t.id);
  }
  return out;
}
