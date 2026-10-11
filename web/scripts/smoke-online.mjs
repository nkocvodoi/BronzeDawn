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

await host.click("#mm-multi");
await host.click("#host-btn");
// The usual way: a six-digit room code, matched by PeerJS's public service. Without internet (or if the
// service is down) the test says so and connects with the long codes instead, which need no server.
const room = await host.waitForSelector(".room-code", { timeout: 15000 }).then(() => host.textContent(".room-code"), () => null);
await guest.click("#mm-multi");
await guest.click("#join-btn");
await guest.selectOption("#guest-civ", "egyptian");
if (room) {
  const code = room.replace(/\D/g, "");
  check(code.length === 6, `the host gets a six-digit room code (${room.trim()})`);
  await guest.type("#room-in", code); // typed key by key, as a player does
  check(!(await guest.evaluate(() => game.started)), "typing the room code does not start a game");
  await guest.click("#join-room");
  check(await guest.isVisible(".join-state"), "joining shows a panel that says what is happening");
} else {
  console.log("note  the public matching service could not be reached: connecting with long codes instead");
  await host.click("#online-leave");
  await host.click("#mm-multi");
  await host.click("#host-btn");
  await host.click("#long-codes");
  await host.click("#invite-btn");
  await host.waitForSelector("#invite-code");
  const invitation = await host.inputValue("#invite-code");
  check(invitation.startsWith("BD1-") && invitation.length < 4000, `the host gets an invitation code (${invitation.length} characters)`);
  await guest.click("#long-join");
  await guest.selectOption("#guest-civ", "egyptian");
  await guest.fill("#invite-in", invitation);
  await guest.click("#answer-btn");
  await guest.waitForSelector("#answer-code");
  const answer = await guest.inputValue("#answer-code");
  check(answer.startsWith("BD1-"), "the friend gets an answer code");
  await host.fill("#answer-in", answer);
  await host.click("#accept-btn");
}
// The lobby: eight seats, the friend in the second.
await host.waitForFunction(() => document.querySelector(".seats")?.textContent?.includes("Not ready"), null, { timeout: 25000 });
check(true, "the two browsers connect, and the friend takes a seat in the host's lobby");
await guest.waitForSelector(".lobby", { timeout: 5000 });
check((await guest.$$(".seats tr")).length === 9, "the friend sees the lobby too: eight seats");
await guest.fill("#my-name", "Friend");
await guest.press("#my-name", "Enter");
await host.waitForFunction(() => document.querySelector(".seats")?.textContent?.includes("Friend"), null, { timeout: 5000 }).catch(() => {});
const seats = await host.textContent(".seats");
check(seats.includes("Friend") && seats.includes("Egyptian"), "the host sees the friend's name and civilization");
await guest.fill("#chat-in", "hello from the friend");
await guest.press("#chat-in", "Enter");
await host.waitForFunction(() => document.querySelector("#lobby-chat")?.textContent?.includes("hello from the friend"), null, { timeout: 5000 }).catch(() => {});
check((await host.textContent("#lobby-chat")).includes("Friend: hello from the friend"), "chat in the lobby reaches the host");
check(await host.isDisabled("#lobby-start"), "the host cannot start before the friend is ready");
// The other seats: a computer in the third, the fourth closed (none at all is a choice too).
await host.selectOption("#seat-2", "computer:normal");
await host.selectOption("#seat-3", "closed");
await guest.waitForFunction(() => document.querySelector(".seats")?.textContent?.includes("Computer (Moderate)"), null, { timeout: 5000 }).catch(() => {});
check((await guest.textContent(".seats")).includes("Computer (Moderate)"), "the host's seats reach the friend");
await guest.check("#my-ready");
await host.waitForFunction(() => !document.querySelector("#lobby-start")?.disabled, null, { timeout: 5000 }).catch(() => {});
check(!(await host.isDisabled("#lobby-start")), "once the friend is ready, the host can start");
await host.click("#lobby-start");
await guest.waitForFunction(() => window.game.started, null, { timeout: 10000 });
const who = await guest.evaluate(() => ({ me: game.me, n: game.world.players.length, civ: game.world.players[game.me].civ?.id, name: game.world.players[game.me].name, ais: game.world.ais.length }));
check(who.me === 1 && who.n === 3 && who.civ === "egyptian" && who.name === "Friend" && who.ais === 1, "the friend plays as Friend, an Egyptian, with a computer as the third player");

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

// Chat in the game: Enter opens a box, Enter sends; the line reaches the other side with who said it.
await guest.keyboard.press("Enter");
await guest.keyboard.type("gg <b>well played</b>");
await guest.keyboard.press("Enter");
await host.waitForFunction(() => document.querySelector("#messages")?.textContent?.includes("well played"), null, { timeout: 5000 }).catch(() => {});
check(await host.evaluate(() => [...document.querySelectorAll("#messages .chat")].some((d) => d.textContent === "Friend: gg <b>well played</b>" && !d.querySelector("b b"))), "chat in the game reaches the host, as plain text");
await host.keyboard.press("Enter");
await host.keyboard.type("hello back");
await host.keyboard.press("Enter");
await guest.waitForFunction(() => document.querySelector("#messages")?.textContent?.includes("hello back"), null, { timeout: 5000 }).catch(() => {});
check((await guest.textContent("#messages")).includes(": hello back"), "and the host's reaches the friend");
check(!(await host.$("#game-chat-in")), "the chat box closes once a line is sent");

// The friend's connection breaks: a computer plays for them, and they come back into the game as it is now.
await host.keyboard.press("F3"); // resumed
await guest.evaluate(() => game.online.peer.close());
await host.waitForFunction(() => game.world.ais.some((ai) => ai.player === 1), null, { timeout: 20000 }).catch(() => {});
check(await host.evaluate(() => game.world.ais.some((ai) => ai.player === 1)), "when the friend's connection breaks, a computer plays for them");
await guest.waitForSelector("#rejoin-btn", { timeout: 10000 }).catch(() => {});
check(!!(await guest.$("#rejoin-btn")), "the friend is told, and offered to rejoin");
await guest.click("#rejoin-btn");
await host.waitForFunction(() => !game.world.ais.some((ai) => ai.player === 1), null, { timeout: 30000 }).catch(() => {});
await guest.waitForFunction(() => game.started && game.net && game.world.ais.every((ai) => ai.player !== 1), null, { timeout: 30000 }).catch(() => {});
check(await guest.evaluate(() => game.started && game.me === 1 && !game.world.ais.some((ai) => ai.player === 1)), "the friend is back in the game, playing for themselves");
check((await host.textContent("#messages")).includes("Friend is back in the game"), "and the host is told");
await guest.evaluate(() => { const vs = game.world.unitsOf(game.me).filter((u) => u.isVillager).map((u) => u.id); const v = game.world.unit(vs[0]); game.issue({ k: "move", ids: vs, x: v.pos.x + 3, y: v.pos.y + 2 }); });
await host.waitForTimeout(6000);
await host.keyboard.press("F3"); // paused
await host.waitForTimeout(2000);
const [e, f] = [await sum(host), await sum(guest)];
check(e.tick === f.tick && e.units === f.units && e.res === f.res && e.tick > d.tick, `after coming back, the same world on both (step ${e.tick})`);
check(await host.evaluate(() => game.net.desync === null), "and no disagreement");

// The friend leaves: the host is told, a computer takes over their people, and the game goes on.
await guest.close();
await host.waitForFunction(() => document.querySelector("#messages")?.textContent?.includes("has left the game"), null, { timeout: 20000 }).catch(() => {});
check((await host.textContent("#messages")).includes("Friend has left the game"), "when the friend leaves, the host is told");
await host.keyboard.press("F3");
const before = await host.evaluate(() => game.world.tick);
await host.waitForTimeout(1500);
check((await host.evaluate(() => game.world.tick)) > before + 10, "and the host's game goes on without them");
check(await host.evaluate(() => game.world.ais.some((ai) => ai.player === 1)), "a computer plays for the friend now");
check((await host.textContent("#messages")).includes("Friend has left: a computer plays for them now"), "and the host is told so");

check(errors.length === 0, `no errors in the console${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
