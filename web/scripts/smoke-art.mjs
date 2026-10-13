// Every sprite the game draws, checked pixel by pixel against the fingerprints kept in test/art.json, so a
// picture never changes by accident (a house lost its owner's colour once, and no test saw it). Each section
// of the sprite gallery is opened; each picture's pixels are fingerprinted, its key the section, the heading
// and the caption. Changed or new pictures are written to art-diff/ to look at.
//   npm run build && npm run smoke:art             compare
//   npm run build && npm run smoke:art -- --update  the pictures changed on purpose: keep them
import { createServer } from "node:http";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const update = process.argv.includes("--update");
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const dist = here("../dist/"), baseline = here("../test/art.json"), diffDir = here("../art-diff/");
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
// The canvas drawn by the processor, not the graphics card: the same pixels on every machine.
const browser = await chromium.launch({ executablePath, args: ["--disable-gpu", "--disable-accelerated-2d-canvas"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`http://localhost:${port}/gallery.html?art=code`);
const sections = await page.evaluate(() => [...document.querySelectorAll("#nav a:not(.art-toggle)")].map((a) => new URL(a.href).searchParams.get("section")));
const found = {}, pictures = {};
// The gallery's own compositions are left out: the scenes, and a sprite laid on a painted background. They
// blend half-clear pixels and draw smoothed grid lines, which machines round differently (a Linux runner
// differed from a Mac on exactly these); every sprite in them is checked on its own.
const composed = (section, key) => section === "scene" || key.includes("(on water)");
for (const section of sections) {
  await page.goto(`http://localhost:${port}/gallery.html?section=${section}&scale=1&art=code`);
  const got = await page.evaluate(() => {
    const out = [];
    let heading = "";
    const seen = new Map();
    for (const el of document.querySelectorAll("#main h2, #main figure")) {
      if (el.tagName === "H2") { heading = el.textContent; continue; }
      const c = el.querySelector("canvas");
      const base = `${heading}/${el.querySelector("figcaption")?.textContent ?? ""}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      // FNV-1a over the pixels; a clear pixel counts as clear whatever colour it was given.
      let h = 2166136261 >>> 0;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        for (const v of a ? [d[i], d[i + 1], d[i + 2], a] : [0, 0, 0, 0]) h = Math.imul(h ^ v, 16777619) >>> 0;
      }
      out.push({ key: `${base}${n > 1 ? `#${n}` : ""}`, print: `${c.width}x${c.height}:${h.toString(16)}`, png: c.toDataURL("image/png") });
    }
    return out;
  });
  for (const g of got) { if (composed(section, g.key)) continue; found[`${section}/${g.key}`] = g.print; pictures[`${section}/${g.key}`] = g.png; }
}

const total = Object.keys(found).length;
if (update) {
  writeFileSync(baseline, JSON.stringify(Object.fromEntries(Object.entries(found).sort()), null, 1) + "\n");
  console.log(`kept the fingerprints of ${total} pictures in test/art.json`);
} else {
  const kept = JSON.parse(readFileSync(baseline, "utf8"));
  const changed = Object.keys(found).filter((k) => k in kept && kept[k] !== found[k]);
  const added = Object.keys(found).filter((k) => !(k in kept));
  const gone = Object.keys(kept).filter((k) => !(k in found));
  rmSync(diffDir, { recursive: true, force: true });
  if (changed.length || added.length) {
    mkdirSync(diffDir, { recursive: true });
    for (const k of [...changed, ...added]) writeFileSync(join(diffDir, k.replace(/[^\w.-]+/g, "_") + ".png"), Buffer.from(pictures[k].split(",")[1], "base64"));
  }
  const say = (what, ks) => { if (ks.length) console.log(`${what} (${ks.length}): ${ks.slice(0, 12).join(", ")}${ks.length > 12 ? ", …" : ""}`); };
  say("changed", changed); say("new", added); say("gone", gone);
  const ok = !changed.length && !added.length && !gone.length && !errors.length;
  console.log(ok ? `all ${total} pictures as kept` : `\n${changed.length + added.length + gone.length} pictures differ${changed.length || added.length ? " (written to art-diff/)" : ""}; if on purpose: npm run smoke:art -- --update`);
  if (errors.length) console.log("errors: " + errors.join(" | "));
  await browser.close(); server.close();
  process.exit(ok ? 0 : 1);
}
await browser.close(); server.close();
