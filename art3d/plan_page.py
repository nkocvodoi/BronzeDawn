#!/usr/bin/env python3
"""A page to approve the art plan (replica/art-plan.md) item by item, each with the original's pictures and ours.

Every item of the plan (a building and an architecture, or a rule for all) becomes a card: the original's pictures
and ours of that building in that architecture, age by age, the proposal, and a choice (approve, approve with
changes, drop) with a box for the changes. The choices are kept in the browser and written out as
art-plan-review.json for whoever makes the changes.

The page holds the original's pictures: it goes to web/art-compare/ (gitignored) and must not be published.

    python3 art3d/plan_page.py --aoe ../BronzeDawn-aoe-data [--ours web/public/assets]
    open web/art-compare/plan.html

Needs Pillow and numpy, as compare.py.
"""

import argparse
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # compare.py beside it, also when run with python3 -I
import compare  # noqa: E402


ROOT = os.path.dirname(HERE)
ARCHS = ["egyptian", "babylonian", "asian", "greek", "roman"]
NAMES = {"egyptian": "Ai Cập", "babylonian": "Babylon", "asian": "Châu Á", "greek": "Hy Lạp", "roman": "La Mã", "chung": "Chung"}
# A section of the plan that stands for several buildings.
GROUPS = {"towers": ["watch_tower", "sentry_tower", "guard_tower", "ballista_tower"]}


def parse(path):
    """The plan's sections: [(key, title, [(item, text)])]. A section is "## key — Title"; an item is a bullet
    "- **item:** text", its text running on over the indented lines after it."""
    sections, cur, item = [], None, None
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        m = re.match(r"^## (\w+) — (.+)$", line)
        if m:
            cur = (m.group(1), m.group(2), [])
            sections.append(cur)
            item = None
            continue
        m = re.match(r"^- \*\*([\w-]+):\*\* (.*)$", line)
        if m and cur:
            item = [m.group(1), m.group(2)]
            cur[2].append(item)
            continue
        if item and line.startswith("  ") and line.strip():
            item[1] += " " + line.strip()
        elif not line.strip():
            item = None
    return [(k, t, [(i, x) for i, x in items]) for k, t, items in sections]


def strip(orig, ours, aoe, mine, building, arch):
    """The original's pictures and ours of a building in an architecture, one pair per age either changes in."""
    o_looks = orig["buildings"].get(building, {}).get(arch, {})
    m_all = ours["buildings"].get(building, {})
    m_looks = m_all.get(arch) or m_all.get("default", {})
    cells = []
    for age in compare.AGES:
        if age not in o_looks and age not in m_looks:
            continue
        o = compare.look_at(o_looks, age)
        m = compare.look_at(m_all.get(arch, {}), age) or compare.look_at(m_all.get("default", {}), age)
        oi = compare.frame_of(o, aoe) if o else None
        mi = compare.frame_of(m, mine) if m else None
        if oi is None and mi is None:
            continue
        pics = "".join(f"<figure><img src='{compare.on_grass(im, 1)}'><figcaption>{who}</figcaption></figure>"
                       for im, who in ((oi, "gốc"), (mi, "ta")) if im is not None)
        cells.append(f"<div class=age><div class=agename>{age}</div><div class=pair>{pics}</div></div>")
    return "<div class=strip>" + "".join(cells) + "</div>" if cells else ""


JS = """
const KEY = "bd-art-plan-review";
let marks = {};
try { marks = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { marks = {}; }
const cards = [...document.querySelectorAll(".card[data-id]")];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch (e) {} count(); };
function count() {
  const n = cards.filter((c) => (marks[c.dataset.id] || {}).verdict).length;
  document.querySelector("#done").textContent = `${n} / ${cards.length} mục đã duyệt`;
}
for (const c of cards) {
  const id = c.dataset.id, sel = c.querySelector("select"), note = c.querySelector("textarea");
  const m = marks[id] || {};
  sel.value = m.verdict || ""; note.value = m.note || "";
  c.dataset.verdict = sel.value;
  const put = () => { marks[id] = { verdict: sel.value || null, note: note.value }; c.dataset.verdict = sel.value; save(); };
  sel.addEventListener("change", put); note.addEventListener("input", put);
}
document.querySelector("#allok").addEventListener("click", () => {
  for (const c of cards) {
    const id = c.dataset.id;
    if (!(marks[id] || {}).verdict) { marks[id] = { verdict: "ok", note: (marks[id] || {}).note || "" }; c.querySelector("select").value = "ok"; c.dataset.verdict = "ok"; }
  }
  save();
});
const out = () => JSON.stringify({ when: new Date().toISOString(), marks }, null, 1);
document.querySelector("#export").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out()], { type: "application/json" }));
  a.download = "art-plan-review.json"; a.click();
});
document.querySelector("#copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(out()); document.querySelector("#copy").textContent = "Đã chép"; } catch (e) { alert(out()); }
});
document.querySelector("#load").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const d = JSON.parse(await f.text()); marks = d.marks || d; save(); location.reload(); } catch (err) { alert("Không đọc được file: " + err); }
});
count();
"""

CSS = """body{font:14px system-ui,sans-serif;background:#1f2320;color:#e9ece8;margin:16px;max-width:1500px}
h1{font-size:20px}h2{margin:28px 0 8px;border-bottom:1px solid #555;padding-bottom:4px}
.bar{position:sticky;top:0;background:#1f2320;padding:10px 0;border-bottom:1px solid #555;display:flex;gap:12px;flex-wrap:wrap;align-items:center;z-index:2}
button,label.btn{padding:6px 12px;background:#3a4a3c;color:#e9ece8;border:1px solid #5a6a5c;border-radius:6px;cursor:pointer;font:inherit}
.card{display:grid;grid-template-columns:110px minmax(0,1fr) 300px;gap:14px;padding:12px;margin:8px 0;background:#262b27;border-radius:8px;border-left:4px solid #555}
.card[data-verdict=ok]{border-left-color:#3fa34d}.card[data-verdict=edit]{border-left-color:#d9a400}.card[data-verdict=drop]{border-left-color:#d6452f}
@media (max-width:1000px){.card{grid-template-columns:minmax(0,1fr)}}
.who{font-weight:700}.text{line-height:1.5}.strip{display:flex;gap:10px;overflow-x:auto;margin-top:8px;padding-bottom:4px}
.age{flex:none}.agename{font-size:11px;color:#99a}.pair{display:flex;gap:4px;align-items:flex-end}
figure{margin:0;text-align:center}figcaption{font-size:11px;color:#99a}img{image-rendering:pixelated;max-height:130px}
.rev{display:flex;flex-direction:column;gap:6px}.rev select,.rev textarea{background:#2b302c;color:#e9ece8;border:1px solid #555;border-radius:6px;font:inherit;padding:6px}
.rev textarea{min-height:90px;resize:vertical}"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--aoe", default=os.path.join(ROOT, "web", "assets-local"), help="a copy of BronzeDawn-aoe-data")
    ap.add_argument("--ours", default=os.path.join(ROOT, "web", "public", "assets"), help="Bronze Dawn's assets")
    ap.add_argument("--plan", default=os.path.join(ROOT, "replica", "art-plan.md"))
    ap.add_argument("--out", default=os.path.join(ROOT, "web", "art-compare", "plan.html"))
    args = ap.parse_args()
    if not os.path.exists(os.path.join(args.aoe, "manifest.json")):
        sys.exit(f"No original art at {args.aoe}: clone BronzeDawn-aoe-data there (see its README) or pass --aoe")
    orig = json.load(open(os.path.join(args.aoe, "manifest.json")))
    ours = json.load(open(os.path.join(args.ours, "manifest.json")))
    sections = parse(args.plan)
    out = [f"<!doctype html><meta charset=utf-8><title>Duyệt kế hoạch sửa hình</title><style>{CSS}</style>",
           "<h1>Kế hoạch sửa hình công trình: duyệt từng mục</h1>",
           "<p>Mỗi mục: hình gốc và hình của ta qua các đời, rồi đề xuất. Chọn Duyệt, Duyệt có sửa (ghi sửa gì) hoặc Bỏ. "
           "Lựa chọn tự lưu trong trình duyệt; xong thì tải file và gửi lại. Trang có hình của bản gốc: không đăng, không chia sẻ.</p>",
           "<div class=bar><span id=done></span><button id=allok>Duyệt mọi mục chưa chọn</button>"
           "<button id=export>Tải file duyệt</button><button id=copy>Chép</button>"
           "<label class=btn>Nạp file duyệt<input id=load type=file accept='.json' hidden></label></div>"]
    n = 0
    for key, title, items in sections:
        out.append(f"<h2>{html.escape(title)}</h2>")
        buildings = GROUPS.get(key, [key])
        for item, text in items:
            pics = ""
            if item in ARCHS:
                pics = "".join(strip(orig, ours, args.aoe, args.ours, b, item) for b in buildings if b in orig["buildings"])
            who = NAMES.get(item, item)
            sel = ("<select><option value=''>Chọn…</option><option value=ok>Duyệt</option>"
                   "<option value=edit>Duyệt có sửa</option><option value=drop>Bỏ</option></select>")
            out.append(f"<div class=card data-id='{key}/{item}'><div class=who>{html.escape(who)}</div>"
                       f"<div><div class=text>{html.escape(text)}</div>{pics}</div>"
                       f"<div class=rev>{sel}<textarea placeholder='Sửa gì (nếu có)…'></textarea></div></div>")
            n += 1
    out.append(f"<script>{JS}</script>")
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"{n} items in {len(sections)} sections -> {os.path.relpath(args.out)}")


if __name__ == "__main__":
    main()
