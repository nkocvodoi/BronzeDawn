// Two browsers play one game online, through the real WebRTC connection and the real buttons: the host
// invites, the friend answers, the host starts, each gives orders, and both worlds must stay the same.
//   npm run build && npm run smoke:online
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
  const path = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  let body;
  try { body = await readFile(path); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  res.end(body);
}).listen(0);
const port = server.address().port;

const executablePath = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Local addresses in the codes, not mDNS names, so two browsers on this machine find each other.
const browser = await chromium.launch({ executablePath, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-features=WebRtcHideLocalIpsWithMdns"] });
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"}  ${what}`); if (!ok) failed++; };
const errors = [];
const open = async (who) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("bd-mouselock", "off"); } catch {} });
  page.on("pageerror", (e) => errors.push(`${who}: ${e}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${who}: ${m.text()}`); });
  await page.goto(`http://localhost:${port}/?seed=7`);
  await page.waitForFunction(() => window.game);
  return page;
};
const host = await open("host"), guest = await open("guest");

await host.click("#online-open");
await host.click("#host-btn");
await host.click("#invite-btn");
await host.waitForSelector("#invite-code");
const invitation = await host.inputValue("#invite-code");
check(invitation.startsWith("BD1-") && invitation.length < 4000, `the host gets an invitation code (${invitation.length} characters)`);

await guest.click("#online-open");
await guest.click("#join-btn");
await guest.selectOption("#guest-civ", "egyptian");
await guest.fill("#invite-in", invitation);
await guest.click("#answer-btn");
await guest.waitForSelector("#answer-code");
const answer = await guest.inputValue("#answer-code");
check(answer.startsWith("BD1-"), "the friend gets an answer code");

await host.fill("#answer-in", answer);
await host.click("#accept-btn");
await host.waitForFunction(() => document.querySelector("#overlay")?.textContent?.includes("Friend 1: connected"), null, { timeout: 15000 });
check(true, "the two browsers connect");
await host.waitForFunction(() => document.querySelector("#overlay")?.textContent?.includes("Egyptian"), null, { timeout: 5000 }).catch(() => {});
check((await host.textContent("#overlay")).includes("Egyptian"), "the host sees the friend's civilization");

await host.click("#online-setup");
await host.selectOption("#opponents", "1");
await host.click("[data-start=normal]");
await guest.waitForFunction(() => window.game.started, null, { timeout: 10000 });
const who = await guest.evaluate(() => ({ me: game.me, n: game.world.players.length, civ: game.world.players[game.me].civ?.id }));
check(who.me === 1 && who.n === 3 && who.civ === "egyptian", "the friend plays as Player 2, an Egyptian, with a computer as the third player");

// Each side trains a villager at its Town Center.
for (const page of [host, guest]) {
  await page.evaluate(() => { const tc = game.world.buildingsOf(game.me).find((b) => b.def.id === "town_center"); game.selection = [tc.id]; });
  await page.keyboard.press("c");
}
await host.waitForTimeout(4000);
const at = await Promise.all([host, guest].map((p) => p.evaluate(() => ({ turn: game.net.turn, tick: game.world.tick, q: [0, 1].map((i) => game.world.buildingsOf(i).find((b) => b.def.id === "town_center").queue.length + game.world.unitsOf(i).filter((u) => u.isVillager).length) }))));
check(at[0].q[0] === 4 && at[0].q[1] === 4, `on the host, both players' villagers were ordered (${at[0].q.join(", ")})`);
check(at[1].q[0] === 4 && at[1].q[1] === 4, `and the same on the friend's machine (${at[1].q.join(", ")})`);

// Pause both, and compare the worlds at the same turn.
await host.keyboard.press("F3");
await host.waitForTimeout(1500);
const sum = (p) => p.evaluate(() => ({ tick: game.world.tick, units: game.world.units.map((u) => `${u.id}:${u.pos.x.toFixed(3)},${u.pos.y.toFixed(3)}`).join(";"), res: game.world.players.map((x) => x.res.values.join()).join("|") }));
const [a, b] = [await sum(host), await sum(guest)];
check(a.tick > 40 && a.tick === b.tick, `the host's pause stops both at the same step (${a.tick}, ${b.tick})`);
check(a.units === b.units && a.res === b.res, "both machines have the same world");
check(await host.evaluate(() => game.net.desync === null), "no disagreement found between the two");

// Play on at 3x for a while, the computer and both players busy, then compare again.
await host.keyboard.press("F3");
await host.keyboard.press("+"); await host.keyboard.press("+"); await host.keyboard.press("+");
check((await guest.evaluate(() => game.speed)) === 3, "the host's speed reaches the friend");
for (const page of [host, guest]) await page.evaluate(() => {
  const vs = game.world.unitsOf(game.me).filter((u) => u.isVillager).map((u) => u.id);
  const bush = game.world.nearestNode(0, game.world.startTiles[game.me].center, 16);
  if (bush) { game.selection = vs; game.issue({ k: "smart", ids: vs, target: bush.id, x: bush.center.x, y: bush.center.y }); }
});
await host.waitForTimeout(20000);
await host.keyboard.press("F3");
await host.waitForTimeout(1500);
const [c, d] = [await sum(host), await sum(guest)];
check(c.tick > a.tick + 600 && c.tick === d.tick && c.units === d.units && c.res === d.res, `after ${Math.round((c.tick - a.tick) / 20)} more game seconds, still the same world (step ${c.tick})`);
check(await host.evaluate(() => game.net.desync === null), "and still no disagreement");

// The friend leaves: the host is told, and goes on.
await guest.close();
await host.waitForFunction(() => document.querySelector("#messages")?.textContent?.includes("has left the game"), null, { timeout: 20000 }).catch(() => {});
check((await host.textContent("#messages")).includes("Player 2 has left the game"), "when the friend leaves, the host is told");
await host.keyboard.press("F3");
const before = await host.evaluate(() => game.world.tick);
await host.waitForTimeout(1500);
check((await host.evaluate(() => game.world.tick)) > before + 10, "and the host's game goes on without them");

check(errors.length === 0, `no errors in the console${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
