// Three browsers play one game online; then the host leaves. A friend takes the host's place, the other
// comes back in to them, and their two worlds must stay the same. Then that friend leaves too, and the
// last plays on alone.
//   npm run build && npm run smoke:host-leaves
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
  await page.goto(`http://localhost:${port}/?seed=5`);
  await page.waitForFunction(() => window.game);
  return page;
};
const host = await open("host"), a = await open("A"), b = await open("B");

// The host opens a room; both friends join and are ready; the host starts.
await host.click("#mm-multi"); await host.click("#host-btn");
await host.waitForSelector(".room-code", { timeout: 20000 });
const code = (await host.textContent(".room-code")).replace(/\D/g, "");
for (const [page, name] of [[a, "Ana"], [b, "Bao"]]) {
  await page.click("#mm-multi"); await page.click("#join-btn");
  await page.fill("#room-in", code); await page.click("#join-room");
  await page.waitForSelector(".lobby", { timeout: 30000 });
  await page.fill("#my-name", name); await page.press("#my-name", "Enter");
  await page.check("#my-ready");
}
await host.waitForFunction(() => !document.querySelector("#lobby-start")?.disabled, null, { timeout: 10000 }).catch(() => {});
await host.click("#lobby-start");
for (const p of [a, b]) await p.waitForFunction(() => window.game.started, null, { timeout: 15000 });
const who = await Promise.all([a, b].map((p) => p.evaluate(() => game.me)));
check(who[0] === 1 && who[1] === 2, `three players in one game (friends are players ${who})`);

// Everyone sends villagers to work, and the game runs a while.
for (const p of [host, a, b]) await p.evaluate(() => {
  const vs = game.world.unitsOf(game.me).filter((u) => u.isVillager).map((u) => u.id);
  const bush = game.world.nearestNode(0, game.world.startTiles[game.me].center, 16);
  if (bush) game.issue({ k: "smart", ids: vs, target: bush.id, x: bush.center.x, y: bush.center.y });
});
await host.waitForTimeout(5000);

// The host leaves. Each friend is asked, and says the host has gone.
await host.close();
for (const p of [a, b]) {
  await p.waitForSelector("#host-gone-btn", { timeout: 30000 }).catch(() => {});
  check(!!(await p.$("#host-gone-btn")), `${p === a ? "the first" : "the other"} friend is asked whether to play on without the host`);
}
const says = await a.textContent("#overlay");
check(says.includes("you host the game in its place"), "the first friend is told they would host");
await a.click("#host-gone-btn");
await b.click("#host-gone-btn");
await a.waitForFunction(() => game.net && game.net.constructor.name !== "LockstepGuest" && game.world.host === 1, null, { timeout: 30000 }).catch(() => {});
check(await a.evaluate(() => game.world.host === 1 && !!game.net), "the first friend takes the host's place");
await b.waitForFunction(() => game.started && game.net && game.world.host === 1, null, { timeout: 45000 }).catch(() => {});
check(await b.evaluate(() => game.started && game.me === 2 && game.world.host === 1), "the other friend comes back in to them");
check(await a.evaluate(() => game.world.ais.some((ai) => ai.player === 0) && !game.world.ais.some((ai) => ai.player === 2)), "a computer plays for the old host, and not for the friend who came back");
check(await b.evaluate(() => game.world.ais.some((ai) => ai.player === 0) && !game.world.ais.some((ai) => ai.player === 2)), "the same on the friend's machine");

// They play on together: orders from both, then the new host pauses and the worlds are compared.
for (const p of [a, b]) await p.evaluate(() => {
  const vs = game.world.unitsOf(game.me).filter((u) => u.isVillager).map((u) => u.id);
  const tree = game.world.nearestNode(1, game.world.startTiles[game.me].center, 20);
  if (tree) game.issue({ k: "smart", ids: vs.slice(0, 2), target: tree.id, x: tree.center.x, y: tree.center.y });
});
await a.waitForTimeout(8000);
await a.keyboard.press("F3");
await a.waitForTimeout(2500);
const sum = (p) => p.evaluate(() => ({ tick: game.world.tick, units: game.world.units.map((u) => `${u.id}:${u.pos.x.toFixed(3)},${u.pos.y.toFixed(3)}`).join(";"), res: game.world.players.map((x) => x.res.values.join()).join("|") }));
const [x, y] = [await sum(a), await sum(b)];
check(x.tick === y.tick && x.units === y.units && x.res === y.res, `with the new host, the same world on both (step ${x.tick}, ${y.tick})`);
check(await a.evaluate(() => game.net.desync === null), "and no disagreement");
await a.keyboard.press("F3");

// The new host leaves too: the last friend plays on alone, a computer playing for the others.
await a.close();
await b.waitForSelector("#host-gone-btn", { timeout: 30000 }).catch(() => {});
check((await b.textContent("#overlay")).includes("playing on alone"), "the last friend is told they would play on alone");
await b.click("#host-gone-btn");
await b.waitForFunction(() => game.started && !game.net, null, { timeout: 30000 }).catch(() => {});
check(await b.evaluate(() => game.started && !game.net && game.world.ais.some((ai) => ai.player === 1)), "when the new host leaves too, the last friend plays on alone");
const t0 = await b.evaluate(() => game.world.tick);
await b.waitForTimeout(1500);
check((await b.evaluate(() => game.world.tick)) > t0 + 10, "and the game goes on");

check(errors.length === 0, `no errors in the console${errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
