// A monkey at the keyboard: games played by random clicks, drags and keys in a real browser, with the menus
// opened and their buttons pressed at random (all but quitting, resigning and deleting), watching for what
// must not happen: an error on the page or in the console, a panel that will not close, the screen freezing
// for over a second, the game's clock stopping while nothing is paused. Each finding is kept with a picture and
// the thirty actions before it, in monkey-out/.
//   npm run build && npm run monkey -- [games] [seconds each]
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const [games = "4", secs = "120"] = process.argv.slice(2).filter((a) => a !== "--");
const dist = fileURLToPath(new URL("../dist/", import.meta.url)), out = fileURLToPath(new URL("../monkey-out/", import.meta.url));
mkdirSync(out, { recursive: true });
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

/** A random generator from a seed, so a run can be played again. */
function rng(seed) {
  let s = seed >>> 0; // mulberry32: neighbouring seeds give unlike numbers from the first one on
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Buttons the monkey leaves alone: they end the game or throw away what is kept.
const SPARE = ["data-restart", "resign-yes", "data-pack-remove", "data-delete-save", "packs-reload", "fs-btn", "mm-multi", "lock-btn", "report-btn"];
const KEYS = ["h", ".", "b", "e", "g", "s", "a", "c", "t", "z", "r", "d", "f", "u", "q", "1", "2", "Tab", "Space", "Delete", "Escape", "Escape", "F1", "F10", "F3", "F4", "=", "-", "PageUp", "PageDown", "?", "Enter"];

const findings = [];
for (let n = 0; n < Number(games); n++) {
  const seed = 100 + n, R = rng(seed), pick = (xs) => xs[Math.floor(R() * xs.length)];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { localStorage.setItem("bd-mouselock", "off"); } catch {} });
  const actions = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("download", (d) => d.cancel().catch(() => {}));
  const keep = async (kind, what) => {
    const id = `${String(findings.length + 1).padStart(2, "0")}-${kind}`;
    await page.screenshot({ path: join(out, `${id}.png`) }).catch(() => {});
    findings.push({ id, game: n, seed, kind, what, last: actions.slice(-30) });
    console.log(`  ** [${kind}] ${what}`);
  };
  await page.goto(`http://localhost:${port}/?seed=${seed}`);
  await page.waitForFunction(() => window.game, null, { timeout: 120000 });
  // A game of chance: civilization and map from the setup screen's own lists.
  await page.click("#mm-single");
  await page.evaluate((r) => {
    for (const id of ["civ", "map-type"]) {
      const s = document.querySelector(`#${id}`);
      if (s) { const o = [...s.options].filter((x) => x.value); s.value = o[Math.floor(r[id === "civ" ? 0 : 1] * o.length)].value; s.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  }, [R(), R()]);
  await page.click("[data-start]");
  await page.waitForTimeout(1500);
  const civ = await page.evaluate(() => `${window.game.world.players[0].civ?.id} on ${window.game.mapType}`);
  console.log(`game ${n} (seed ${seed}): ${civ}`);
  // The page's frames: the longest gap between two, and the game's clock.
  await page.evaluate(() => { window.__gap = 0; let last = performance.now(); const f = () => { const t = performance.now(); window.__gap = Math.max(window.__gap, t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  // MONKEY_SELFTEST=1: an error thrown on purpose, to see the monkey report it.
  if (process.env.MONKEY_SELFTEST) await page.evaluate(() => setTimeout(() => { throw new Error("monkey self test"); }, 3000));
  const end = Date.now() + Number(secs) * 1000;
  let overlayFor = 0, lastTime = -1, stillFor = 0;
  while (Date.now() < end) {
    const r = R();
    try {
      const overlay = await page.isVisible("#overlay");
      if (overlay && r < 0.6) {
        // In a panel: a button at random (not one that ends or deletes), or Esc.
        const buttons = await page.$$eval("#overlay button, #overlay [data-tab], #overlay [data-speed], #overlay select", (bs, spare) =>
          bs.map((b, i) => [i, b.outerHTML.slice(0, 160)]).filter(([, h]) => !spare.some((s) => h.includes(s))), SPARE);
        if (buttons.length && R() < 0.8) {
          const [i, html] = pick(buttons);
          actions.push(`click in panel: ${html.replace(/\s+/g, " ").slice(0, 90)}`);
          await page.locator("#overlay button, #overlay [data-tab], #overlay [data-speed], #overlay select").nth(i).click({ timeout: 1500 }).catch(() => {});
        } else { actions.push("key Escape (panel)"); await page.keyboard.press("Escape"); }
      } else if (r < 0.35) {
        const x = Math.floor(40 + R() * 1200), y = Math.floor(40 + R() * 600), right = R() < 0.5, shift = R() < 0.15;
        actions.push(`${shift ? "shift+" : ""}${right ? "right" : "left"} click ${x},${y}`);
        if (shift) await page.keyboard.down("Shift");
        await page.mouse.click(x, y, { button: right ? "right" : "left" });
        if (shift) await page.keyboard.up("Shift");
      } else if (r < 0.45) {
        const x = Math.floor(100 + R() * 900), y = Math.floor(100 + R() * 450), w = Math.floor(30 + R() * 250), h = Math.floor(30 + R() * 200);
        actions.push(`drag ${x},${y} +${w},${h}`);
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + w, y + h, { steps: 4 }); await page.mouse.up();
      } else if (r < 0.55) {
        // A command button.
        const n2 = await page.$$eval("#commands button:not(.empty)", (b) => b.length);
        if (n2) { const i = Math.floor(R() * n2); actions.push(`command button ${i}`); await page.locator("#commands button:not(.empty)").nth(i).click({ timeout: 1000 }).catch(() => {}); }
      } else if (r < 0.6) {
        const k = pick(["1", "2", "3"]); actions.push(`key Control+${k}`); await page.keyboard.press(`Control+${k}`);
      } else if (r < 0.62) {
        // Save the game, as a player would.
        actions.push("save the game");
        await page.evaluate(async () => { const g = window.game; if (!g.started || g.ended || g.net) return; await g.saveGame(); });
      } else {
        const k = pick(KEYS); actions.push(`key ${k}`); await page.keyboard.press(k === "Space" ? " " : k);
      }
    } catch (e) { actions.push(`(the action failed: ${String(e).slice(0, 80)})`); }
    await page.waitForTimeout(60 + Math.floor(R() * 120));
    if (errors.length) { for (const e of errors.splice(0)) await keep("error", e.slice(0, 400)); }
    // A panel up for many actions in a row, Esc pressed: it will not close.
    const state = await page.evaluate(() => ({ overlay: !document.querySelector("#overlay").hidden, title: document.querySelector("#overlay h1")?.textContent ?? "", t: window.game.world.time, paused: window.game.paused || window.game.hostPaused, started: window.game.started, ended: window.game.ended, gap: window.__gap }));
    if (state.gap > 1000) { await keep("freeze", `the screen froze for ${Math.round(state.gap)} ms`); await page.evaluate(() => { window.__gap = 0; }); }
    overlayFor = state.overlay ? overlayFor + 1 : 0;
    if (overlayFor === 40) {
      for (let k = 0; k < 3 && (await page.isVisible("#overlay")); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
      if ((await page.isVisible("#overlay")) && state.started && !state.ended) await keep("stuck", `the "${state.title}" panel stays after Esc three times`);
      overlayFor = 0;
    }
    if (!state.started || state.ended) {
      // Out of the game (the end, or a button that left it): start another.
      actions.push("(a new game)");
      await page.evaluate(() => { const g = window.game; if (g.ended || !g.started) g.restart(); });
      await page.waitForTimeout(400);
      await page.click("#mm-single").catch(() => {});
      await page.click("[data-start]").catch(() => {});
      await page.waitForTimeout(1200);
      lastTime = -1;
      continue;
    }
    // The clock stopped while nothing is paused and no panel is up.
    if (!state.overlay && !state.paused) {
      stillFor = state.t === lastTime ? stillFor + 1 : 0;
      if (stillFor === 15) await keep("clock", `the game's clock stopped at ${state.t.toFixed(1)} s with nothing paused`);
    } else stillFor = 0;
    lastTime = state.t;
  }
  console.log(`  ${actions.length} actions`);
  await page.close();
}
await browser.close();
server.close();
writeFileSync(join(out, "findings.json"), JSON.stringify(findings, null, 1));
console.log(`\n${findings.length} findings -> monkey-out/findings.json`);
