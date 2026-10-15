// Every screen of the game at four screen sizes, photographed and checked: a page that scrolls sideways, a
// panel past the edge of the screen, text cut off, buttons on top of each other, console errors. The pictures
// and what was found go to ui-shots/ (index.html to look through them, report.json).
//   npm run build && npm run ui-shots
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = fileURLToPath(new URL("../dist/", import.meta.url)), out = fileURLToPath(new URL("../ui-shots/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
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

const SIZES = [["phone", 390, 844], ["phone-sideways", 844, 390], ["laptop", 1366, 768], ["full-hd", 1920, 1080], ["4k", 3840, 2160]];

/** What is wrong with the layout as it stands. */
const inspect = () => {
  const found = [];
  const vw = innerWidth, vh = innerHeight;
  if (document.documentElement.scrollWidth > vw + 1) found.push(`the page scrolls sideways (${document.documentElement.scrollWidth} px wide on ${vw})`);
  const card = document.querySelector("#overlay:not([hidden]) .card");
  if (card) {
    const r = card.getBoundingClientRect();
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) found.push(`the panel goes past the screen (${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)})`);
  }
  // Shown at all: not hidden, and not scrolled out of a box that clips it (a list scrolled under its footer).
  const visible = (el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!(r.width > 0 && r.height > 0) || s.visibility === "hidden" || s.display === "none") return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowY === "visible" && ps.overflowX === "visible") continue;
      const pr = p.getBoundingClientRect();
      if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1 || r.right <= pr.left + 1 || r.left >= pr.right - 1) return false;
    }
    return true;
  };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} "${(el.innerText || "").trim().slice(0, 40)}"`;
  // Text cut off: a box narrower than what is in it, not scrolling.
  for (const el of document.querySelectorAll("#overlay:not([hidden]) *, #status *, #topbar *, #commands *, #hud *")) {
    if (!visible(el) || el.tagName === "CANVAS" || el.tagName === "IMG") continue;
    const s = getComputedStyle(el);
    const clips = (s.overflowX === "hidden" || s.overflowX === "clip") && el.scrollWidth > el.clientWidth + 2;
    if (clips && (el.innerText || "").trim()) found.push(`text cut off${s.textOverflow === "ellipsis" ? " (with …)" : ""}: ${name(el)} (${el.scrollWidth} in ${el.clientWidth} px)`);
  }
  // Buttons on top of each other.
  // Each button's rectangle as shown: cut to every box that clips it.
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    let { left, top, right, bottom } = r;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowY === "visible" && ps.overflowX === "visible") continue;
      const pr = p.getBoundingClientRect();
      left = Math.max(left, pr.left); top = Math.max(top, pr.top); right = Math.min(right, pr.right); bottom = Math.min(bottom, pr.bottom);
    }
    return { left, top, right, bottom };
  };
  const buttons = [...document.querySelectorAll("#overlay:not([hidden]) button, #topbar button")].filter(visible).map((b) => [b, shown(b)]);
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
    const [a, ra] = buttons[i], [b, rb] = buttons[j];
    if (a.contains(b) || b.contains(a)) continue;
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 2 && h > 2) found.push(`buttons on top of each other: ${name(a)} and ${name(b)}`);
  }
  // Buttons out of the screen (can't be pressed), outside a panel that scrolls.
  for (const [b, r] of buttons) if ((r.right > vw + 1 || r.left < -1) && !b.closest(".card")) found.push(`a button off the screen: ${name(b)}`);
  return found;
};

const report = [];
for (const [size, width, height] of SIZES) {
  mkdirSync(join(out, size), { recursive: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => { try { localStorage.setItem("bd-mouselock", "off"); } catch {} });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const shot = async (screen) => {
    await page.waitForTimeout(350);
    const found = await page.evaluate(inspect);
    if (errors.length) found.push(...errors.splice(0).map((e) => `console: ${e.slice(0, 200)}`));
    await page.screenshot({ path: join(out, size, `${screen}.png`) });
    report.push({ size, screen, found });
    console.log(`${size.padEnd(8)} ${screen.padEnd(22)} ${found.length ? found.length + " problem(s)" : "ok"}`);
    for (const f of found) console.log(`           ${f}`);
  };
  const click = async (sel) => { await page.click(sel); await page.waitForTimeout(150); };
  const g = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(`http://localhost:${port}/?seed=7`);
  await page.waitForFunction(() => window.game, null, { timeout: 120000 });
  await shot("main-menu");
  await click("#mm-single"); await shot("single-player");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await click("#mm-multi"); await shot("multiplayer");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  if (!(await page.isVisible("#mm-packs"))) await g(() => window.game.showMainMenu());
  await click("#mm-packs"); await shot("art-packs");
  await g(() => window.game.showMainMenu());
  await click('.mainmenu-list button:has-text("Saved Games")'); await shot("saved-games");
  await g(() => window.game.showMainMenu());
  await click("#mm-help");
  for (const tab of await page.$$eval("#overlay .tabs [data-tab]", (t) => t.map((x) => x.dataset.tab))) { await click(`#overlay .tabs [data-tab="${tab}"]`); await shot(`help-${tab}`); }
  // In a game.
  await g(() => window.game.showMainMenu());
  await click("#mm-single");
  await click("[data-start]");
  await page.waitForTimeout(2000);
  await g(() => { const gm = window.game; gm.selection = gm.world.buildingsOf(0).filter((b) => b.def.id === "town_center").map((b) => b.id); });
  await shot("game-town-center");
  await g(() => { const gm = window.game; gm.selection = gm.world.unitsOf(0).filter((u) => u.isVillager).map((u) => u.id).slice(0, 1); });
  await shot("game-villager");
  await g(() => {
    const gm = window.game, w = gm.world, c = w.startTiles[0].center, V = c.constructor;
    const ids = []; for (let i = 0; i < 20; i++) ids.push(w.spawnUnit(["villager", "clubman", "bowman", "scout"][i % 4], 0, new V(c.x + 2 + (i % 5), c.y + 3 + Math.floor(i / 5))).id);
    gm.selection = ids;
  });
  await shot("game-many-picked");
  await page.keyboard.press("F10"); await shot("menu");
  await click("#settings-open"); await shot("settings");
  await click("#menu-back"); await click("#timeline-btn"); await shot("timeline");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await click("#diplomacy-btn"); await shot("diplomacy");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await g(() => { const gm = window.game, w = gm.world, s = w.startTiles[0], T = s.constructor; const m = w.addBuilding("market", 0, new T(s.x - 6, s.y - 6), true); gm.selection = [m.id]; });
  await page.waitForTimeout(250); await page.keyboard.press("t"); await shot("tribute");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.keyboard.press("F1"); await shot("help-in-game");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.keyboard.press("F10"); await click("#saves-open"); await shot("saves-in-game");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.keyboard.press("F10"); await click("#resign-open"); await shot("resign");
  await click("#resign-yes"); await page.waitForTimeout(1200); await shot("defeat");
  await page.close();
}
await browser.close();
server.close();

const problems = report.filter((r) => r.found.length);
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const screens = [...new Set(report.map((r) => r.screen))];
writeFileSync(join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>UI shots</title>
<style>body{font:14px system-ui;background:#222;color:#eee;margin:16px}h2{margin:28px 0 8px}.row{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}
figure{margin:0}img{max-height:340px;border:1px solid #555;display:block}figcaption{font-size:12px;max-width:420px}.bad{color:#ff8a7a}</style>
<h1>UI shots: ${report.length} pictures, ${problems.length} with problems</h1>
${screens.map((s) => `<h2>${s}</h2><div class="row">${SIZES.map(([size]) => { const r = report.find((x) => x.screen === s && x.size === size); return r ? `<figure><a href="${size}/${s}.png"><img src="${size}/${s}.png"></a><figcaption>${size}${r.found.length ? `<div class="bad">${r.found.map(esc).join("<br>")}</div>` : " · ok"}</figcaption></figure>` : ""; }).join("")}</div>`).join("")}`);
console.log(`\n${report.length} pictures, ${problems.length} with problems -> ui-shots/index.html`);
