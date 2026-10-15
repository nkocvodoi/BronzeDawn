// Plays many headless matches across the settings a player can pick, computers on every side, and checks
// what must never happen: a crash, a unit off the map or in the sea, resources below zero, more people than
// the limit, two buildings on one tile, a town standing idle with work left, a town that can pay for the
// next age and never goes; a saved game that plays on differently, or the same seed giving another game.
// Each finding names the match, its seed and the minute, so it can be played again.
//   npm run soak -- [matches] [minutes] [shard] [shards]      e.g. npm run soak -- 40 40 0 4
import { writeFileSync } from "node:fs";
import { AIController, Difficulty } from "../src/core/ai";
import { RULES } from "../src/core/data";
import { MAP_TYPES, MapType } from "../src/core/mapgen";
import { fingerprint } from "../src/core/net";
import { RES_ALL, Res, ResBag } from "../src/core/rules";
import { loadWorld, saveWorld } from "../src/core/save";
import { sailable, walkable } from "../src/core/grid";
import { World } from "../src/core/world";

const [n = "24", mins = "40", shard = "0", shards = "1"] = process.argv.slice(2).filter((a) => a !== "--");
const MINUTES = Number(mins), CHECK = Math.round(10 / World.dt); // every 10 s of game time

/** The match a number stands for: map, size, players, civilizations and levels all from it. */
export function config(i: number) {
  const rnd = (k: number) => { const x = Math.sin(i * 9973 + k * 7919) * 43758.5453; return x - Math.floor(x); };
  const mapType = MAP_TYPES[i % MAP_TYPES.length][0] as MapType;
  const players = [2, 2, 3, 4, 6, 8][Math.floor(rnd(1) * 6)];
  const size = players <= 2 ? [72, 96][Math.floor(rnd(2) * 2)] : players <= 4 ? 120 : 144;
  const civs = Array.from({ length: players }, (_, p) => RULES.civs[Math.floor(rnd(10 + p) * RULES.civs.length)].id);
  const levels = Array.from({ length: players }, (_, p) => (["hard", "normal", "easy", "hardest"] as Difficulty[])[Math.floor(rnd(30 + p) * 4)]);
  return { seed: 1000 + i, mapType, players, size, civs, levels };
}
type Config = ReturnType<typeof config>;

export function make(c: Config) {
  const w = new World(RULES, c.seed, c.civs.map((_, i) => `AI ${i + 1}`), c.size, true, { mapType: c.mapType, civs: c.civs });
  w.ais = c.levels.map((d, i) => new AIController(i, d));
  for (const ai of w.ais) ai.attach(w);
  return w;
}

interface Finding { match: number; seed: number; minute: number; kind: string; what: string }

function soak(i: number): { findings: Finding[]; summary: string } {
  const c = config(i);
  const findings: Finding[] = [];
  const once = new Set<string>();
  const note = (kind: string, what: string, w: World, key = kind + what) => {
    if (once.has(key)) return;
    once.add(key);
    findings.push({ match: i, seed: c.seed, minute: Math.round(w.time / 6) / 10, kind, what });
  };
  let w: World;
  try { w = make(c); } catch (e) { return { findings: [{ match: i, seed: c.seed, minute: 0, kind: "crash", what: `making the world: ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}` }], summary: "" }; }
  const idleSince = new Map<number, number>(); // player -> game time most of its villagers went idle
  const canAgeSince = new Map<number, number>();
  let saved: { file: string; tick: number } | null = null;
  const converted = new Map<number, number>(); // units won by conversion, which may go over the limit as in the original
  const limit = Math.floor((MINUTES * 60) / World.dt);
  try {
    while (w.winner === null && w.tick < limit) {
      w.step();
      // A transport converted brings its passengers with it.
      for (const e of w.events) if (e.kind === "converted") converted.set(e.to, (converted.get(e.to) ?? 0) + 1 + (w.unit(e.id)?.cargo.length ?? 0));
      w.events.length = 0;
      if (w.tick === Math.floor(8 * 60 / World.dt)) saved = { file: JSON.stringify(saveWorld(w)), tick: w.tick };
      if (w.tick % CHECK !== 0) continue;
      check(w, c, note, idleSince, canAgeSince, converted);
    }
  } catch (e) {
    note("crash", `${(e as Error).message} @ ${(e as Error).stack?.split("\n").slice(1, 4).map((s) => s.trim()).join(" | ")}`, w);
  }
  // A game saved at minute 8 and loaded again plays on as the one that was never saved.
  if (saved && findings.every((f) => f.kind !== "crash")) {
    try {
      const a = make(c), b = loadWorld(JSON.parse(saved.file), RULES);
      while (a.tick < saved.tick) { a.step(); a.events.length = 0; }
      for (let k = 0; k < Math.round(120 / World.dt); k++) { a.step(); b.step(); a.events.length = 0; b.events.length = 0; }
      if (fingerprint(a) !== fingerprint(b)) note("save", `a game saved at minute 8 and loaded plays on differently (fingerprints differ 2 minutes later)`, b);
    } catch (e) { note("save", `saving or loading failed: ${(e as Error).message}`, w); }
  }
  const p = w.players;
  const summary = `#${i} seed ${c.seed} ${c.mapType} ${c.size} ${c.players}p [${c.civs.map((x, k) => `${x}:${c.levels[k]}`).join(" ")}] -> ${w.winner === null ? "no winner" : `AI ${w.winner + 1}`} at ${Math.round(w.time / 60)} min; ages ${p.map((x) => x.age).join("")}`;
  return { findings, summary };
}

function check(w: World, c: Config, note: (k: string, s: string, w: World, key?: string) => void, idleSince: Map<number, number>, canAgeSince: Map<number, number>, converted: Map<number, number>) {
  const W = w.map.width, H = w.map.height;
  for (const u of w.units) {
    if (!u.alive) continue;
    const { x, y } = u.pos;
    if (!Number.isFinite(x) || !Number.isFinite(y)) { note("unit", `${u.def.id} of player ${u.owner} has no place (NaN)`, w, `nan${u.def.id}`); continue; }
    if (x < 0 || y < 0 || x > W || y > H) note("unit", `${u.def.id} of player ${u.owner} off the map at ${x.toFixed(1)},${y.toFixed(1)}`, w, `off${u.def.id}`);
    if (u.hp > u.maxHp + 1e-6 || !(u.hp > 0)) note("unit", `${u.def.id} alive with ${u.hp}/${u.maxHp} hit points`, w, `hp${u.def.id}`);
    if (u.aboard === null && !u.isRelic) {
      const g = w.map.terrainAt(u.pos.tile);
      if (u.isBoat ? !sailable(g) : !walkable(g)) note("unit", `${u.def.id} of player ${u.owner} ${u.isBoat ? "on land" : "in the water"} at ${x.toFixed(1)},${y.toFixed(1)}`, w, `place${u.def.id}${u.owner}`);
    }
    if (u.aboard !== null && !w.unit(u.aboard)) note("unit", `${u.def.id} aboard a transport that is gone`, w, `aboard${u.def.id}`);
  }
  // Two buildings on one tile.
  const at = new Map<number, number>();
  for (const b of w.buildings) {
    if (!b.alive) continue;
    for (const t of b.footprint.tiles()) {
      const k = t.y * W + t.x, other = at.get(k);
      if (other !== undefined && other !== b.id) note("building", `${b.def.id} (player ${b.owner}) and ${w.building(other)?.def.id} (player ${w.building(other)?.owner}) on one tile ${t.x},${t.y}`, w, `overlap${Math.min(b.id, other)}`);
      at.set(k, b.id);
    }
  }
  for (const p of w.players) {
    if (p.defeated) continue;
    for (const r of RES_ALL) {
      const v = p.res.get(r);
      if (!(v >= -1e-6) || !Number.isFinite(v)) note("resources", `player ${p.id} has ${v} ${Res[r]}`, w, `res${p.id}${r}`);
    }
    if (p.pop - w.popMax > (converted.get(p.id) ?? 0) + 1e-6) note("population", `player ${p.id} has ${p.pop} people, the limit is ${w.popMax} (${converted.get(p.id) ?? 0} won by conversion)`, w, `pop${p.id}`);
    // Most of a town idle for three minutes while there is still something on the map to gather.
    const vs = w.unitsOf(p.id).filter((u) => u.isVillager);
    const idle = vs.filter((u) => u.order.kind === "idle").length;
    const left = w.nodes.some((nd) => nd.alive && nd.amount > 0);
    if (vs.length >= 6 && idle / vs.length > 0.5 && left) {
      const since = idleSince.get(p.id) ?? w.time;
      idleSince.set(p.id, since);
      if (w.time - since >= 180) note("stall", `player ${p.id} (${c.civs[p.id]}, ${c.levels[p.id]}): ${idle} of ${vs.length} villagers idle for 3 minutes with resources left on the map`, w, `idle${p.id}`);
    } else idleSince.delete(p.id);
    // Able to pay for the next age, with the buildings it needs, for ten minutes, and not going.
    const ai = w.ais.find((a) => a.player === p.id) as unknown as { level?: { maxAge: number } } | undefined;
    const next = w.rules.ages[p.age + 1];
    const can = next && p.age < (ai?.level?.maxAge ?? 3) && p.res.covers(ResBag.of(next.cost ?? {})) && w.blockerForNextAge(p.id) === null
      && !w.buildingsOf(p.id).some((b) => b.researching !== null && b.def.id === "town_center");
    if (can) {
      const since = canAgeSince.get(p.id) ?? w.time;
      canAgeSince.set(p.id, since);
      if (w.time - since >= 600) note("stall", `player ${p.id} (${c.civs[p.id]}, ${c.levels[p.id]}) could go to the ${next.name} for 10 minutes and did not`, w, `age${p.id}`);
    } else canAgeSince.delete(p.id);
  }
}

// The same seed twice: the same game (an online game depends on it). A few matches, five minutes each.
function sameTwice(i: number): Finding | null {
  const c = config(i), a = make(c), b = make(c);
  const end = Math.round(300 / World.dt);
  for (let k = 0; k < end; k++) { a.step(); b.step(); a.events.length = 0; b.events.length = 0; }
  return fingerprint(a) === fingerprint(b) ? null : { match: i, seed: c.seed, minute: 5, kind: "determinism", what: "the same seed played twice gave two different games" };
}

if (process.argv[1]?.endsWith("soak.ts")) main();

function main() {
const all: Finding[] = [];
const lines: string[] = [];
const t0 = Date.now();
for (let i = Number(shard); i < Number(n); i += Number(shards)) {
  const r = soak(i);
  all.push(...r.findings);
  lines.push(r.summary);
  if (i % 8 === Number(shard)) { const d = sameTwice(i); if (d) all.push(d); }
  console.log(`${r.summary}${r.findings.length ? `  ** ${r.findings.length} finding(s)` : ""}`);
  for (const f of r.findings) console.log(`   [${f.kind}] min ${f.minute}: ${f.what}`);
}
writeFileSync(`soak-${shard}.json`, JSON.stringify({ findings: all, matches: lines, seconds: Math.round((Date.now() - t0) / 1000) }, null, 1));
console.log(`\n${lines.length} matches, ${all.length} findings, ${Math.round((Date.now() - t0) / 1000)} s`);
}
