// Headless AI against AI with the rules written by `npm run import-aoe` (web/assets-local/rules.json).
//   npx tsx scripts/aoe/sim-aoe.ts [seed] [ai1] [ai2] [minutes] [rules.json]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DIFFICULTIES, type Difficulty } from "../../src/core/ai";
import { Rules, type RulesFile } from "../../src/core/rules";
import { clock, runMatch } from "../../src/core/sim";

const [seed = "1", a = "hard", b = "easy", mins = "45", file = resolve(import.meta.dirname, "../../assets-local/rules.json")] = process.argv.slice(2).filter((x) => x !== "--");
const lv = (x: string) => (DIFFICULTIES.includes(x as Difficulty) ? (x as Difficulty) : "normal");
const rules = new Rules(JSON.parse(readFileSync(file, "utf8")) as RulesFile);
const t0 = Date.now();
const r = runMatch(rules, Number(seed), Number(mins), [lv(a), lv(b)]);
console.log(`seed ${seed}, ${a} vs ${b}: ${r.winner === null ? "no winner" : `AI ${r.winner + 1} wins`} at ${clock(r.seconds)} (${Date.now() - t0} ms)`);
r.lines.forEach((l) => console.log("  " + l));
r.problems.forEach((p) => console.log("  problem: " + p));
process.exit(r.problems.length ? 1 : 0);
