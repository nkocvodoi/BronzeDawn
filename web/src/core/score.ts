// The original's score, in its five parts (F-Score in replica/game/aoe1-research.md). It is shown during
// the game and at its end, and can decide a game. Tribute is not in the game yet, so its points are not either.
import type { World } from "./world";

export interface Score { military: number; economy: number; religion: number; technology: number; other: number; total: number }

/** The single leader of a count gets the bonus; a tie, or nobody above 0, gets nothing. */
function leader(values: number[]): number {
  let best = -1, top = 0, tie = false;
  values.forEach((v, i) => {
    if (v > top) { top = v; best = i; tie = false; } else if (v === top && v > 0) tie = true;
  });
  return tie ? -1 : best;
}

export function scores(w: World): Score[] {
  const ps = w.players;
  const units = (id: number) => w.units.filter((u) => u.alive && u.owner === id);
  const buildings = (id: number) => w.buildings.filter((b) => b.alive && b.owner === id && b.complete);
  const army = ps.map((p) => units(p.id).filter((u) => u.isSoldier).length
    + buildings(p.id).filter((b) => b.def.tags?.includes("tower")).length);
  const villagers = ps.map((p) => units(p.id).filter((u) => u.isVillager).length);
  // Villagers, and the trade, transport and fishing boats, count for the economy, as in the original.
  const workers = ps.map((p) => units(p.id).filter((u) => u.isVillager || (u.isBoat && !u.isSoldier)).length);
  const explored = ps.map((p) => Math.floor((w.fog[p.id].exploredShare * 100) / 3));
  const conversions = ps.map((p) => p.stats.converted);
  const techs = ps.map((p) => p.stats.researched);
  // Ruins and Artifacts: 10 points each, and 50 more for holding every one on the map.
  const relics = w.units.filter((u) => u.alive && u.isRelic);
  const held = ps.map((p) => relics.filter((r) => r.owner === p.id).length);
  const most = { army: leader(army), villagers: leader(villagers), explored: leader(explored), conversions: leader(conversions), techs: leader(techs) };

  return ps.map((p, i) => {
    const s = p.stats;
    const military = Math.floor(s.kills / 2) + s.razed + Math.max(0, s.kills - s.casualties) + (most.army === i ? 25 : 0);
    const economy = Math.floor(s.gathered.gold / 100) + workers[i] + (most.villagers === i ? 25 : 0)
      + explored[i] + (most.explored === i ? 25 : 0);
    const religion = conversions[i] * 2 + (most.conversions === i ? 25 : 0)
      + buildings(p.id).filter((b) => b.def.id === "temple").length * 3
      + held[i] * 10 + (relics.length > 0 && held[i] === relics.length ? 50 : 0);
    const technology = techs[i] * 2 + (most.techs === i ? 50 : 0) + (w.firstTo[2] === i ? 25 : 0) + (w.firstTo[3] === i ? 25 : 0);
    const other = (p.defeated ? -100 : 0) + buildings(p.id).filter((b) => b.def.id === "wonder").length * 100;
    return { military, economy, religion, technology, other, total: military + economy + religion + technology + other };
  });
}
