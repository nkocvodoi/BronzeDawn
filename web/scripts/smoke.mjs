// Plays the first minutes in a real browser with real mouse and keyboard input.
//   npm run build && npm run smoke            (uses the Chrome installed on this machine)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = fileURLToPath(new URL("../dist/", import.meta.url)); // a real path on Windows too
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
const browser = await chromium.launch({ executablePath, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// Pointer lock would swallow the test's mouse: keep the mouse free, as a player can in the menu.
await page.addInitScript(() => { try { localStorage.setItem("bd-mouselock", "off"); } catch {} });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"}  ${what}`); if (!ok) failed++; };
const g = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
/** Screen position of an entity, after centring the camera on it. */
const at = async (id) => g((id) => { const e = game.world.entity(id); game.look(e.center); return game.screenOf(e.center); }, id);

await page.goto(`http://localhost:${port}/?seed=5`);
await page.waitForFunction(() => window.game);
check(await page.isVisible("#overlay [data-start]"), "start screen offers the difficulty choice");

check((await page.$$eval("#map-type option", (o) => o.length)) === 9, "the start screen offers nine kinds of map");
check((await page.$$eval("#map-size option", (o) => o.map((x) => x.textContent))).some((t) => t.startsWith("Gigantic")), "and five sizes, up to Gigantic");
await page.selectOption("#opponents", "3");
check((await page.textContent("#players-info")).includes("4 players"), "the start screen counts the players chosen");
await page.selectOption("#opponents", "1");
await page.selectOption("#civ", "greek");   // a fixed civilization: some change costs
await page.selectOption("#start-speed", "1.5");
check((await page.textContent("#civ-info")).includes("Academy units"), "choosing a civilization shows its bonuses");
await page.click("[data-start=normal]");
await page.click("#diplomacy-btn");
const diplomacy = await page.textContent("#overlay");
check(diplomacy.includes("Greek") && diplomacy.includes("Academy units") && diplomacy.includes("Enemy"), "Diplomacy lists your civilization with its bonuses, and the enemy's");
await page.keyboard.press("Escape");
check((await g(() => game.speed)) === 1.5, "the start screen sets the game speed");
check(await g(() => game.started && game.world.ais.length === 1), "clicking Normal starts the game against one AI");
check(await g(() => game.world.units.filter((u) => u.isRelic).length === 10), "the map has five Ruins and five Artifacts");
// The ground is drawn piece by piece: every piece has ground in it, and together they cover the map's diamond
// (half the picture). A piece once came out empty and the rest shifted, leaving black where the map was seen.
const ground = await g(() => game.terrain.children.map((c) => {
  const cv = c.texture.source.resource, d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let filled = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) filled++;
  return { filled, area: cv.width * cv.height };
}));
const share = ground.reduce((a, x) => a + x.filled, 0) / ground.reduce((a, x) => a + x.area, 0);
check(ground.length > 1 && ground.every((x) => x.filled > 0) && share > 0.45 && share < 0.55, `the ground is drawn in ${ground.length} pieces that cover the map (${(share * 100).toFixed(1)}% of the picture)`);

check(await page.evaluate(() => document.body.classList.contains("playing")), "the panels slide in when the game starts");
check((await page.textContent("#scores")).includes("Population") && /You \(Greek\): 3\/4/.test(await page.textContent("#scores")), "the list above the minimap shows each player's population");
await page.keyboard.press("F4");
check((await page.textContent("#scores")).includes("Score"), "F4 switches it to scores");
await page.keyboard.press("F4");
check(await page.isHidden("#scores"), "and F4 again hides it");
await page.keyboard.press("F4");
// The town center starts selected: C trains a villager, as in the original.
const food = await g(() => game.world.players[0].res.food);
await page.keyboard.press("c");
check(await g(() => game.world.buildingsOf(0).find((b) => b.def.id === "town_center").queue.length === 1), "C on the town center queues a villager");
check((await g(() => game.world.players[0].res.food)) === food - 50, "training cost 50 food");
await wait(400);
check(/\d+:\d\d left/.test(await page.textContent("#progress-text")) && await page.isVisible("#progress"), "the progress bar says how long the villager has left");

// Click a villager to select it. The game holds still while the test aims at moving villagers, as a
// player could pause to; at the larger default zoom a walking villager otherwise slips from under the click.
await g(() => { game.paused = true; });
const v = await g(() => game.world.unitsOf(0).find((u) => u.isVillager).id);
let p = await at(v);
await page.mouse.click(p.x, p.y - 14);
check(await g((v) => game.selection.length === 1 && game.selection[0] === v, v), "clicking a villager selects it");

// Right click berries: it goes to gather.
const berry = await g((v) => game.world.nearestNode(0, game.world.unit(v).pos, 20).id, v);
p = await at(berry);
await page.mouse.click(p.x, p.y - 8, { button: "right" });
check(await g((v) => game.world.unit(v).order.kind === "gather", v), "right clicking berries orders a gather");
check((await g(() => game.flashes)) > 0, "the berry bush flashes to show the order");
await page.waitForFunction(() => game.flashes === 0, null, { timeout: 3000 }).catch(() => {});
check((await g(() => game.flashes)) === 0, "the flash ends after a moment");

// B opens the build menu, E then places a house, as in the original; a left click on open grass places it.
await page.mouse.click(p.x, p.y - 8); // reselect nothing in particular
await page.mouse.click(1, 1);         // top bar: no-op
p = await at(v);
await page.mouse.click(p.x, p.y - 14);
check((await page.$$("#commands button:not(.empty)")).length === 4, "a villager's panel shows Build, Repair, Stop and Delete");
check((await page.$$("#commands button")).length === 12, "the command grid has the original's two rows of six");
await page.keyboard.press("b");
// The menu is redrawn on the next frame, which a software-rendered browser can take a while to reach.
await page.waitForFunction(() => document.querySelector("#commands button:not(.empty)")?.getAttribute("aria-label") === "House", null, { timeout: 3000 }).catch(() => {});
const buildIcons = await page.$$eval("#commands button:not(.empty)", (bs) => bs.map((b) => b.getAttribute("aria-label")));
check(buildIcons[0] === "House" && buildIcons[1] === "Barracks" && !buildIcons.includes("Market"), "B opens the build menu: House first, then Barracks, and only what the Stone Age allows");
await page.keyboard.press("e");
const spot = await g((v) => {
  const u = game.world.unit(v);
  for (let r = 3; r < 10; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const t = { x: Math.floor(u.pos.x) + dx, y: Math.floor(u.pos.y) + dy };
    const T = u.pos.tile.constructor;
    if (game.world.canPlace("house", new T(t.x, t.y), 0)) { const c = new u.pos.constructor(t.x + 1, t.y + 1); game.look(c); return game.screenOf(c); }
  }
}, v);
const houses = await g(() => game.world.buildingsOf(0).filter((b) => b.def.id === "house").length);
await page.mouse.move(spot.x, spot.y);
await page.mouse.click(spot.x, spot.y);
check((await g(() => game.world.buildingsOf(0).filter((b) => b.def.id === "house").length)) === houses + 1, "B, E, then a click places a house");
// Villagers bunch up at the bush, so the click may pick a neighbour: check whoever is selected.
check(await g(() => game.world.unit(game.selection[0])?.order.kind === "build"), "the selected villager goes to build it");

// Leave the half-built house for a tree, then right-click its foundation: the villager goes back and finishes it.
await g(() => { game.paused = false; }); // the builder needs time to walk away
const builder = await g(() => game.selection[0]);
const house = await g((b) => game.world.buildingsOf(0).find((x) => x.def.id === "house" && !x.complete).id, builder);
await g(([b, h]) => { const w = game.world, u = w.unit(b); w.gather(0, [b], w.nearestNode(1, u.pos, 30).id); game.selection = [b]; }, [builder, house]);
await wait(500);
p = await g((h) => { const b = game.world.building(h); game.look(b.center); const fp = b.footprint; return game.screenOf(new b.center.constructor(fp.maxX - 0.3, fp.maxY - 0.3)); }, house);
await page.mouse.click(p.x, p.y, { button: "right" });
check(await g(([b, h]) => { const o = game.world.unit(b).order; return o.kind === "build" && o.id === h; }, [builder, house]), "right-clicking a half-built house sends the villager back to finish it");

// Drag a box around the start villagers.
const box = await g(() => {
  const us = game.world.unitsOf(0);
  game.look(us[0].pos);
  const pts = us.map((u) => game.screenOf(u.pos));
  return { x0: Math.min(...pts.map((q) => q.x)) - 30, y0: Math.min(...pts.map((q) => q.y)) - 40, x1: Math.max(...pts.map((q) => q.x)) + 30, y1: Math.max(...pts.map((q) => q.y)) + 20, n: us.length };
});
await page.mouse.move(box.x0, box.y0);
await page.mouse.down();
await page.mouse.move(box.x1, box.y1, { steps: 5 });
await page.mouse.up();
check((await g(() => game.selection.length)) === box.n, `drag selects all ${box.n} villagers`);

// Arrow keys scroll, H comes home, ? opens help and pauses.
const cam0 = await g(() => game.screenOf(game.world.startTiles[0].center).x);
await page.keyboard.down("ArrowRight"); await wait(300); await page.keyboard.up("ArrowRight");
check((await g(() => game.screenOf(game.world.startTiles[0].center).x)) < cam0 - 50, "arrow keys scroll the map");
await page.keyboard.press("h");
check(await g(() => game.world.building(game.selection[0])?.def.id === "town_center"), "H selects the town center");
await page.keyboard.press("?");
check(await page.isVisible("#overlay .help") && (await g(() => game.paused)), "? shows the controls and pauses");
await page.keyboard.press("Escape");
check(!(await page.isVisible("#overlay")) && !(await g(() => game.paused)), "Esc closes it and resumes");

// Time passes and the economy runs.
const t0 = await g(() => game.world.time);
await wait(3000);
check((await g(() => game.world.time)) > t0 + 2, "the simulation runs in real time");
const mm = await page.locator("#minimap").boundingBox();
await page.mouse.click(mm.x + mm.width * 0.75, mm.y + mm.height * 0.5);
check((await g(() => game.screenOf(game.world.startTiles[1].center).x)) < 1000, "clicking the minimap moves the camera");

// + speeds the game up as in the original: at 2x, game time runs about twice as fast as real time.
await page.keyboard.press("+");
check((await g(() => game.speed)) === 2, "+ raises the game speed to 2x");
const g0 = await g(() => game.world.time), r0 = Date.now();
await wait(2000);
const ratio = ((await g(() => game.world.time)) - g0) / ((Date.now() - r0) / 1000);
check(ratio > 1.6, `game time runs ${ratio.toFixed(1)}x real time at 2x`);
await page.click("#menu-btn");
check(await page.isVisible("#overlay .menu") && (await g(() => game.paused)), "Menu opens the game menu and pauses");
await page.click("#speed");
check((await g(() => game.speed)) === 3 && (await page.textContent("#speed")) === "Game speed 3x", "the speed in the menu steps to 3x");
const reseedOn = () => g(() => game.world.players.every((p) => p.autoReseed));
check(await reseedOn(), "farms sow themselves again by default, for both players");
await page.click("#reseed-btn");
check(!(await reseedOn()) && (await page.getAttribute("#reseed-btn", "class")).includes("off"), "the menu turns reseeding off");
await page.click("#reseed-btn");
check(await reseedOn(), "and on again");
await page.click("#timeline-btn");
check(await page.isVisible("#timeline") && (await page.textContent("#timeline-read")).includes("You"), "the menu shows the Timeline so far");
await page.keyboard.press("Escape");
await page.keyboard.press("-");
check((await g(() => game.speed)) === 2, "- lowers it again");

// Stand Ground with its original key, D, on a soldier.
const soldier = await g(() => {
  const w = game.world, v = w.unitsOf(0).find((u) => u.isVillager);
  const u = w.spawnUnit("clubman", 0, v.pos);
  game.selection = [u.id];
  return u.id;
});
await wait(300);
await page.keyboard.press("d");
check(await g((id) => game.world.unit(id).standGround, soldier), "D sets a soldier to stand ground");
await page.keyboard.press("d");
check(await g((id) => !game.world.unit(id).standGround, soldier), "D again lets it chase");
const sp = await at(soldier);
await page.keyboard.down("Shift");
await page.mouse.click(sp.x + 120, sp.y + 10, { button: "right" });
await page.mouse.click(sp.x + 120, sp.y + 90, { button: "right" });
await page.keyboard.up("Shift");
check(await g((id) => { const u = game.world.unit(id); return u.order.kind === "move" && u.waypoints.length === 1; }, soldier), "Shift + right-click lays a waypoint after the first point");

const pair = await g(() => { const vs = game.world.unitsOf(0).filter((u) => u.isVillager).slice(0, 2).map((u) => u.id); game.selection = vs; return vs; });
await page.keyboard.press("Tab");
check(await g((p) => game.selection[0] === p[1] && game.selection[1] === p[0], pair), "Tab brings the next unit of the selection forward");

await page.screenshot({ path: process.env.SHOT ?? "smoke.png" });

// Watch mode: a new map with every player a computer; you only look.
await g(() => game.restart());
await page.waitForSelector("#watch");
await page.check("#watch");
await page.click("[data-start=normal]");
await wait(300);
check(await g(() => game.watching && game.world.ais.length === game.world.players.length && game.revealMap), "watch mode: every player is a computer and the map is shown");
await g(() => { game.selection = [game.world.buildingsOf(0)[0].id]; });
await wait(200);
check((await page.$$("#commands button:not(.empty)")).length === 0, "watching, there are no orders to give");
await page.keyboard.press("v");
check(await g(() => !game.revealMap && game.me === 0), "V follows one player");

// The original's game settings: a later age, a bigger stockpile, another population limit, an explored
// map and a time limit, all taken from the start screen.
await g(() => game.restart());
await page.waitForSelector("#victory");
await page.uncheck("#watch");
await page.selectOption("#victory", "time-30");
await page.selectOption("#start-age", "2");
await page.selectOption("#resources", "high");
await page.selectOption("#pop-limit", "100");
await page.check("#reveal");
await page.click("[data-start=normal]");
await wait(300);
const set = await g(() => ({ age: game.world.players[0].age, food: game.world.players[0].res.food, pop: game.world.popMax,
  explored: game.world.fog[0].exploredShare, v: game.world.victory }));
check(set.age === 2 && set.food >= 900 && set.pop === 100 && set.explored === 1, "the start screen sets the age, resources, population limit and an explored map");
check(set.v.kind === "time" && /Time left 29:\d\d|Time left 30:00/.test(await page.textContent("#clock")), "a time limit counts down in the top bar");

check(errors.length === 0, `no errors in the console${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
server.close();
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
