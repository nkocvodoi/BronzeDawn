// How often each fantasy race wins against the peoples of Rise of Rome, computer against computer. Every
// pair is played on several seeds, the race on either side in turn, so the start position evens out. A game
// that runs out of time counts half. The aim (replica/game/fantasy-races.md, 5.3): 40 to 60% for each race.
//   npm run sim:races -- [seeds] [level] [map] [minutes] [race]     e.g. npm run sim:races -- 6 hard inland 45 elf
import { DIFFICULTIES, Difficulty } from "../src/core/ai";
import { RULES } from "../src/core/data";
import type { MapType } from "../src/core/mapgen";
import { runMatch } from "../src/core/sim";

const [n = "6", level = "hard", map = "inland", mins = "45", only = ""] = process.argv.slice(2).filter((a) => a !== "--");
const lv = (DIFFICULTIES.includes(level as Difficulty) ? level : "hard") as Difficulty;
// A people of Rise of Rome can be named too, to see where an ordinary civilization lands.
const races = only ? [only] : RULES.civs.filter((c) => c.fantasy).map((c) => c.id);
const peoples = RULES.civs.filter((c) => !c.fantasy).map((c) => c.id);

for (const race of races) {
  let won = 0, lost = 0, drawn = 0;
  const worst: [string, number][] = [];
  for (const other of peoples) {
    let score = 0;
    for (let seed = 1; seed <= Number(n); seed++) {
      const side = seed % 2; // the race plays first on odd seeds, second on even ones
      const civs = side === 0 ? [race, other] : [other, race];
      const w = runMatch(RULES, seed, Number(mins), [lv, lv], map as MapType, { civs }).winner;
      if (w === null) { drawn++; score += 0.5; } else if (w === side) { won++; score++; } else lost++;
    }
    worst.push([other, score / Number(n)]);
  }
  const games = won + lost + drawn;
  const rate = (won + drawn / 2) / games;
  worst.sort((a, b) => a[1] - b[1]);
  const show = (xs: [string, number][]) => xs.map(([c, r]) => `${c} ${Math.round(r * 100)}%`).join(", ");
  console.log(`${race.padEnd(12)} ${Math.round(rate * 100)}% (won ${won}, lost ${lost}, out of time ${drawn}, of ${games}) · ${lv}, ${map}, ${mins} min`);
  console.log(`  hardest: ${show(worst.slice(0, 3))} · easiest: ${show(worst.slice(-3).reverse())}`);
}
