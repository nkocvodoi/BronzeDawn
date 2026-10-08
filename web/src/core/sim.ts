import { AIController, Difficulty } from "./ai";
import { RES_ALL, Rules } from "./rules";
import { World } from "./world";
import { walkable } from "./grid";

/**
 * Runs a whole match with no window: one AI per player, a fixed seed, a time limit.
 * This is the integration test. It must end with a winner and nothing broken.
 */
export interface SimReport { seed: number; winner: number | null; seconds: number; lines: string[]; problems: string[] }

export function clock(t: number) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function runMatch(rules: Rules, seed: number, minutes = 45, levels: Difficulty[] = ["normal", "normal"]): SimReport {
  const w = new World(rules, seed, levels.map((_, i) => `AI ${i + 1}`));
  w.ais = levels.map((d, i) => new AIController(i, d));
  const problems: string[] = [];
  const limit = Math.floor((minutes * 60) / World.dt);
  const ageAt = new Map<number, number>();
  while (w.winner === null && w.tick < limit) {
    w.step();
    for (const e of w.events) if (e.kind === "ageReached") ageAt.set(e.player, w.time);
    w.events.length = 0;
    if (w.tick % 1200 === 0) {
      for (const p of w.players) {
        if (RES_ALL.some((r) => p.res.get(r) < -0.001)) problems.push(`player ${p.id} went below zero at ${Math.floor(w.time)}s`);
      }
      for (const u of w.units) {
        if (!walkable(w.map.terrainAt(u.pos.tile))) problems.push(`unit ${u.id} is standing in water at ${Math.floor(w.time)}s`);
      }
    }
  }
  const lines = w.players.map((p) => {
    const us = w.unitsOf(p.id);
    const v = us.filter((u) => u.isVillager).length;
    const age = ageAt.has(p.id) ? `Tool Age at ${clock(ageAt.get(p.id)!)}` : "stayed in Stone Age";
    return `${p.name}: ${p.defeated ? "defeated" : "standing"}, ${v} villagers, ${us.length - v} soldiers, ` +
      `${w.buildingsOf(p.id).length} buildings, ${age}, gathered ${Math.floor(p.stats.gathered.total)}, ` +
      `trained ${p.stats.trained}, kills ${p.stats.kills}`;
  });
  if (w.winner === null) problems.push(`no winner after ${minutes} minutes`);
  return { seed, winner: w.winner, seconds: w.time, lines, problems };
}
