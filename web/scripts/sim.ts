// Headless AI against AI.   npm run sim -- [seed] [ai1] [ai2] [minutes]
import { DIFFICULTIES, Difficulty } from "../src/core/ai";
import { RULES } from "../src/core/data";
import { clock, runMatch } from "../src/core/sim";

const [seedArg, a = "hard", b = "easy", mins = "45"] = process.argv.slice(2).filter((a) => a !== "--");
const seeds = seedArg ? [Number(seedArg)] : [1, 2, 3, 4];
const lv = (x: string) => (DIFFICULTIES.includes(x as Difficulty) ? (x as Difficulty) : "normal");
let bad = 0;
for (const seed of seeds) {
  const t0 = Date.now();
  const r = runMatch(RULES, seed, Number(mins), [lv(a), lv(b)]);
  console.log(`seed ${seed}, ${a} vs ${b}: ${r.winner === null ? "no winner" : `AI ${r.winner + 1} wins`} at ${clock(r.seconds)} (${Date.now() - t0} ms)`);
  r.lines.forEach((l) => console.log("  " + l));
  r.problems.forEach((p) => console.log("  problem: " + p));
  bad += r.problems.length;
}
process.exit(bad ? 1 : 0);
