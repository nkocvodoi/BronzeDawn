// Does playing to its civilization make the computer stronger? Each seed is played three times with the
// same two civilizations on the same map: neither playing to its civ (the baseline), then player 1 doing
// so, then player 2. A side that plays to its civ is counted against the baseline: a loss turned into a
// win, a win turned into a loss, or the same. Civilizations with nothing to play to (only economy
// bonuses) are left out: for them both games are the same.
//   npm run sim:civ -- [seeds] [level] [map] [minutes]       e.g. npm run sim:civ -- 20 hard inland 45
import { DIFFICULTIES, Difficulty } from "../src/core/ai";
import { civBent } from "../src/core/civbent";
import { RULES } from "../src/core/data";
import type { MapType } from "../src/core/mapgen";
import { runMatch } from "../src/core/sim";

const [n = "12", level = "hard", map = "inland", mins = "45"] = process.argv.slice(2).filter((a) => a !== "--");
const lv = (DIFFICULTIES.includes(level as Difficulty) ? level : "hard") as Difficulty;
const civs = RULES.civs.map((c) => c.id);
const hasBent = (id: string) => civBent(RULES, RULES.civs.find((c) => c.id === id)!).building.size > 0;
let better = 0, worse = 0, same = 0;
const byCiv = new Map<string, [number, number, number]>(); // better, worse, same
const result = (w: number | null, side: number) => (w === null ? "none" : w === side ? "win" : "loss");
for (let seed = 1; seed <= Number(n); seed++) {
  const pair = [civs[(seed * 7) % civs.length], civs[(seed * 7 + 5) % civs.length]];
  const play = (aware: boolean[]) => runMatch(RULES, seed, Number(mins), [lv, lv], map as MapType, { civs: pair }, aware).winner;
  const base = play([false, false]);
  for (const side of [0, 1]) {
    if (!hasBent(pair[side])) continue;
    const was = result(base, side), now = result(play([side === 0, side === 1]), side);
    const e = byCiv.get(pair[side]) ?? [0, 0, 0];
    const k = was === now ? 2 : now === "win" || (now === "none" && was === "loss") ? 0 : 1;
    e[k]++;
    [() => better++, () => worse++, () => same++][k]();
    byCiv.set(pair[side], e);
    console.log(`seed ${seed} ${pair.join(" vs ")}: ${pair[side]} ${was} -> ${now}`);
  }
}
console.log(`\n${lv}, ${map}, ${mins} min: playing to the civ turned ${better} games its way, ${worse} the other way, ${same} the same`);
for (const [c, [b, w, s]] of [...byCiv].sort()) console.log(`  ${c.padEnd(13)} better ${b}, worse ${w}, same ${s}`);
