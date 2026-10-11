// How long the simulation takes as a big game grows: eight computers on a large map, the time each game
// minute costs, and the units then.   npm run bench -- [minutes] [map size]
import { AIController } from "../src/core/ai";
import { RULES } from "../src/core/data";
import { World } from "../src/core/world";

const [mins = "30", size = "144"] = process.argv.slice(2).filter((a) => a !== "--");
const names = Array.from({ length: 8 }, (_, i) => `AI ${i + 1}`);
const w = new World(RULES, 7, names, Number(size), true, { popLimit: 200 });
w.ais = names.map((_, i) => new AIController(i, "hardest"));
for (const ai of w.ais) ai.attach(w);
const perMin = Math.round(60 / World.dt);
for (let m = 1; m <= Number(mins); m++) {
  const t0 = performance.now();
  for (let i = 0; i < perMin; i++) { w.step(); w.events.length = 0; }
  const ms = performance.now() - t0;
  if (m % 2 === 0 || m === 1) console.log(`minute ${String(m).padStart(2)}: ${(ms / perMin).toFixed(2)} ms a step, ${w.units.length} units (${w.units.filter((u) => u.isSoldier).length} soldiers), ${w.buildings.length} buildings, ${w.nodes.length} resources`);
}
