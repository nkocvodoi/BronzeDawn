// A page to review the fantasy races' buildings (replica/fantasy-art-plan.md): for each race and building, the
// pictures on main beside the ones in the working tree, age by age, the plan's proposal for it, and a choice
// (approve, approve with changes, drop) with a box for notes. The choices are kept in the browser and written
// out as fantasy-art-review.json for whoever makes the changes.
//
//   node scripts/race-review.mjs [--base main]      (from web/)
//   then open art-compare/fantasy/index.html
//
// The pictures are all our own (art3d/), so the page may be shared; it is written to art-compare/ (gitignored).
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "main";
const OUT = "art-compare/fantasy";
const RACES = { elf: "Elf", dwarf: "Dwarf", centaur: "Centaur", beastfolk: "Beastfolk" };
const AGES = ["stone", "tool", "bronze", "iron"];
const AGE_NAME = { stone: "Đồ Đá", tool: "Tool", bronze: "Bronze", iron: "Iron" };
const NAMES = {
  town_center: "Town Center", house: "House", granary: "Granary", storage_pit: "Storage Pit", barracks: "Barracks", dock: "Dock",
  archery_range: "Archery Range", stable: "Stable", market: "Market", watch_tower: "Watch Tower", sentry_tower: "Sentry Tower",
  guard_tower: "Guard Tower", ballista_tower: "Ballista Tower", government_center: "Government Center", temple: "Temple",
  academy: "Academy", siege_workshop: "Siege Workshop", wonder: "Wonder",
};

const now = JSON.parse(readFileSync("public/assets/manifest.json", "utf8"));
const git = (...a) => execFileSync("git", a, { maxBuffer: 1 << 28 });
const before = JSON.parse(git("show", `${base}:web/public/assets/manifest.json`).toString());

// The plan: "## <race> — ..." sections of "- **<key>:** text" items, the text running on over indented lines.
const plan = readFileSync("../replica/fantasy-art-plan.md", "utf8");
const items = {};
let section = null, last = null;
for (const line of plan.split(/\r?\n/)) {
  const h = /^## (\w+)/.exec(line);
  if (h) { section = h[1]; items[section] ??= {}; last = null; continue; }
  const m = /^- \*\*([^*]+):\*\* (.*)$/.exec(line);
  if (m && section) { last = m[1]; items[section][last] = m[2]; continue; }
  if (last && section && /^\s+\S/.test(line)) items[section][last] += " " + line.trim();
  else if (!line.trim()) last = null;
}
const proposal = (race, key) => items[race]?.[key] ?? (key.endsWith("tower") ? items[race]?.towers : undefined) ?? "";

mkdirSync(join(OUT, "before"), { recursive: true });
mkdirSync(join(OUT, "after"), { recursive: true });
const pic = (side, file) => {
  const to = join(OUT, side, file.replace(/^art3d\//, ""));
  if (side === "after") copyFileSync(join("public/assets", file), to);
  else {
    try { writeFileSync(to, git("show", `${base}:web/public/assets/${file}`)); } catch { return null; }
  }
  return `${side}/${file.replace(/^art3d\//, "")}`;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The plan's notes as they read: **bold**, `code`.
const md = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");

const cards = [];
const card = (id, title, body, rows = "") => cards.push(`
<section class="card" data-id="${id}">
  <h3>${esc(title)}</h3>${rows}
  <p class="plan">${body}</p>
  <div class="choice">
    <label><input type="radio" name="${id}" value="ok"> Duyệt</label>
    <label><input type="radio" name="${id}" value="change"> Sửa</label>
    <label><input type="radio" name="${id}" value="drop"> Bỏ</label>
    <textarea placeholder="Ghi chú (sửa thế nào...)"></textarea>
  </div>
</section>`);

for (const [k, v] of Object.entries(items.all ?? {})) card(`all/${k}`, `Quy tắc chung: ${k}`, md(v));
for (const [race, raceName] of Object.entries(RACES)) {
  cards.push(`<h2 id="${race}">${raceName}</h2>`);
  if (items[race]?.["vat-lieu"]) card(`${race}/vat-lieu`, `${raceName}: vật liệu qua 4 đời`, md(items[race]["vat-lieu"]));
  for (const key of Object.keys(NAMES)) {
    const nowBy = now.buildings?.[key]?.[race];
    if (!nowBy) continue;
    const ages = AGES.filter((a) => nowBy[a]);
    const row = (side, by) => `<div class="row"><span class="side">${side === "before" ? "Hiện tại (main)" : "Cải thiện"}</span>${ages.map((a) => {
      const f = by?.[a]?.file, src = f ? pic(side, f) : null;
      return `<figure>${src ? `<img src="${src}" alt="">` : `<div class="none">chưa có</div>`}<figcaption>${AGE_NAME[a]}</figcaption></figure>`;
    }).join("")}</div>`;
    card(`${race}/${key}`, `${raceName}: ${NAMES[key]}`, `<b>Đề xuất sửa:</b> ${md(proposal(race, key) || "(chưa có đề xuất riêng)")}`,
      row("before", before.buildings?.[key]?.[race]) + row("after", nowBy));
  }
}
for (const sec of ["units", "icons", "hud", "fx"]) for (const [k, v] of Object.entries(items[sec] ?? {})) card(`${sec}/${k}`, `${sec}: ${k}`, md(v));

const page = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Duyệt hình tộc giả tưởng</title>
<style>
:root { --bg: #f4efe4; --card: #fffdf8; --ink: #2a241c; --muted: #6e6253; --edge: #ddd2bf; --accent: #9a6a1f; --grass: #5d8a3c; }
@media (prefers-color-scheme: dark) { :root { --bg: #1d1a16; --card: #27231e; --ink: #ece4d6; --muted: #a89a86; --edge: #3d362d; --accent: #e0a94a; --grass: #3f6129; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
header { position: sticky; top: 0; z-index: 2; background: var(--card); border-bottom: 1px solid var(--edge); padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
header h1 { font-size: 17px; margin: 0 12px 0 0; }
header nav a { color: var(--accent); margin-right: 10px; text-decoration: none; font-weight: 600; }
header .count { color: var(--muted); }
header button { margin-left: auto; padding: 6px 12px; border: 1px solid var(--accent); background: transparent; color: var(--accent); border-radius: 6px; cursor: pointer; font-weight: 600; }
main { max-width: 1200px; margin: 0 auto; padding: 16px; }
.intro { color: var(--muted); }
h2 { margin: 28px 0 8px; }
.card { background: var(--card); border: 1px solid var(--edge); border-radius: 10px; padding: 12px 14px; margin: 12px 0; }
.card h3 { margin: 0 0 8px; font-size: 16px; }
.card.ok { border-left: 5px solid #4c9a4c; } .card.change { border-left: 5px solid var(--accent); } .card.drop { border-left: 5px solid #b04a3a; }
.row { display: flex; gap: 8px; align-items: flex-end; overflow-x: auto; max-width: 100%; padding: 4px 0; }
.side { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 12px; color: var(--muted); min-width: 18px; }
figure { margin: 0; background: var(--grass); border-radius: 6px; padding: 6px; text-align: center; min-width: 120px; }
figure img { image-rendering: pixelated; display: block; margin: 0 auto; } /* at their own size, as in the game: the old frames were bigger, and shrunk to fit they looked smaller */
figcaption { font-size: 12px; color: #f4f0e6; }
.none { color: #f4f0e6; font-size: 12px; padding: 30px 8px; }
.plan { margin: 8px 0; }
code { background: var(--bg); padding: 0 3px; border-radius: 3px; }
.choice { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.choice textarea { flex: 1 1 280px; min-height: 38px; background: var(--bg); color: var(--ink); border: 1px solid var(--edge); border-radius: 6px; padding: 6px; font: inherit; }
</style></head><body>
<header><h1>Duyệt hình tộc giả tưởng</h1><nav>${Object.entries(RACES).map(([r, n]) => `<a href="#${r}">${n}</a>`).join("")}</nav>
<span class="count"></span><button id="export">Tải file duyệt (JSON)</button></header>
<main>
<p class="intro">Mỗi thẻ là một việc trong <code>replica/fantasy-art-plan.md</code>. Hàng "Hiện tại" là hình trên <code>${esc(base)}</code>. Hàng "Cải thiện" là
hình vừa render (bước 1 và bản đầu của bước 2): mỗi công trình là một khu nhiều phần theo đề xuất, có nhà phụ, rào, đồ nghề, đèn của tộc, cắt gọn vào giữa khung; nhà và
Granary nhỏ lại 20%. "Đề xuất sửa" là bản kế hoạch đã duyệt; ghi chú chỗ nào chưa đạt để mình làm tiếp. Chọn Duyệt, Sửa hoặc Bỏ.
Lựa chọn được lưu trong trình duyệt này. Xong thì bấm "Tải file duyệt" rồi gửi file đó lại cho mình.</p>
${cards.join("\n")}
</main>
<script>
const KEY = "bd-fantasy-review";
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} count(); };
const count = () => { const n = document.querySelectorAll(".card").length, d = Object.values(state).filter((v) => v.choice).length; document.querySelector(".count").textContent = d + " / " + n + " mục đã chọn"; };
for (const c of document.querySelectorAll(".card")) {
  const id = c.dataset.id, s = state[id] || {};
  if (s.choice) { c.querySelector('input[value="' + s.choice + '"]').checked = true; c.classList.add(s.choice); }
  const ta = c.querySelector("textarea"); ta.value = s.note || "";
  c.addEventListener("change", (e) => { if (e.target.type !== "radio") return; state[id] = { ...(state[id] || {}), choice: e.target.value }; c.classList.remove("ok", "change", "drop"); c.classList.add(e.target.value); save(); });
  ta.addEventListener("input", () => { state[id] = { ...(state[id] || {}), note: ta.value }; save(); });
}
document.getElementById("export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 1)], { type: "application/json" }));
  a.download = "fantasy-art-review.json"; a.click();
};
count();
</script></body></html>`;
mkdirSync(dirname(join(OUT, "index.html")), { recursive: true });
writeFileSync(join(OUT, "index.html"), page);
console.log(`${cards.filter((c) => c.includes('class="card"')).length} cards -> ${join(OUT, "index.html")}`);
