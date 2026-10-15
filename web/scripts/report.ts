// Reads a bug report (.bdreport, made with F8 in the game): what was going on, the latest messages and
// errors, the panels; writes the picture of the map beside it; then opens the game in it and plays two
// minutes on without a browser, to see whether it breaks again.
//   npm run report -- path/to/bronze-dawn-bug-....bdreport [seconds]
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { RULES } from "../src/core/data";
import { loadWorld } from "../src/core/save";
import { World } from "../src/core/world";
import type { Report } from "../src/game/report";

const [path, secs = "120"] = process.argv.slice(2).filter((a) => a !== "--");
if (!path) { console.log("npm run report -- <file.bdreport> [seconds]"); process.exit(1); }
const raw = readFileSync(path);
const r = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8")) as Report;
if (r.kind !== "bdreport") { console.log("not a bug report"); process.exit(1); }
console.log(`made ${r.made} · ${r.screen.width}x${r.screen.height} @${r.screen.ratio} · ${r.agent}`);
console.log(`page ${r.url}`);
if (r.game) console.log("game", JSON.stringify(r.game, null, 1));
for (const [k, v] of Object.entries(r.panels)) if (v) console.log(`--- ${k}\n${v}`);
const bad = r.log.filter((l) => l.kind !== "message");
console.log(`--- log: ${r.log.length} lines, ${bad.length} errors or warnings`);
for (const l of r.log.slice(-40)) console.log(`${String(l.at).padStart(7)} s ${l.kind.padEnd(7)} ${l.text.split("\n")[0]}`);
for (const l of bad.slice(-5)) console.log(`\n${l.kind} at ${l.at} s:\n${l.text}`);
console.log(`--- settings ${JSON.stringify(r.settings)}`);
if (r.picture) {
  const out = path.replace(/\.bdreport$/, "") + ".png";
  writeFileSync(out, Buffer.from(r.picture.split(",")[1], "base64"));
  console.log(`picture -> ${out}`);
}
if (r.save) {
  const w = loadWorld(r.save, RULES);
  console.log(`--- the game, opened at ${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}: playing ${secs} s on`);
  try {
    for (let i = 0; i < Number(secs) / World.dt && w.winner === null; i++) { w.step(); w.events.length = 0; }
    console.log(`played on to ${Math.floor(w.time / 60)} min with no error`);
  } catch (e) { console.log(`it breaks: ${(e as Error).stack}`); }
}
