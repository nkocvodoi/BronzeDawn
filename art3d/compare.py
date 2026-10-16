#!/usr/bin/env python3
"""Bronze Dawn's pictures beside the original's, scored on what can be measured.

Each building (by architecture and age), unit and resource the game draws is paired with the original's picture
of the same thing, from a local copy of the private BronzeDawn-aoe-data repository, and the two are measured the
same way: how big the picture stands, how much detail and contrast it has, how bright and how saturated it is,
how near its colours are, how much of it takes the owner's colour, and how dark its edges are. Each measure gives
a score out of 100 for how near ours is to the original; the page shows both pictures on grass with the scores
and what to change, worst first.

The page holds the original's pictures: it goes to web/art-compare/ (gitignored) and must not be published.

    python3 art3d/compare.py                          # the original from web/assets-local/
    python3 art3d/compare.py --aoe ../BronzeDawn-aoe-data --only house,clubman
    open web/art-compare/index.html

Needs Pillow and numpy (not run inside Blender).
"""

import argparse
import base64
import html
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AGES = ["stone", "tool", "bronze", "iron"]
GRASS = (86, 118, 52)

# What each measure looks at, and what to change when ours is off, on the page.
EXPLAIN = {
    "size": "Diện tích phần hình (không tính bóng đổ). Lệch nhiều thì sửa scale trong manifest hoặc khung camera khi render.",
    "detail": "Độ gắt trung bình giữa các điểm ảnh liền nhau bên trong hình: bản gốc vẽ tay, đầy vân, gạch, vết. Thấp thì thêm vân (texture), "
              "chi tiết nhỏ, giảm làm mịn khi render.",
    "contrast": "Độ chênh sáng tối trong hình. Thấp là hình bệt, phẳng: tăng đổ bóng, tối các góc khuất.",
    "brightness": "Độ sáng trung bình.",
    "saturation": "Độ đậm màu trung bình. Bản gốc dùng màu đất, hơi xám; cao quá là màu kẹo.",
    "palette": "Bao nhiêu phần màu của hình trùng với màu của bản gốc (lưới 6×6×6 màu). Thấp là dùng khác bảng màu.",
    "team": "Phần trăm hình mang màu phe (#FF00FF). Bản gốc chỉ tô một mảng nhỏ: cờ, khiên, viền áo.",
    "outline": "Độ tối ở mép hình. Bản gốc có mép tối, tách hình khỏi nền cỏ.",
}

# What each measure is called on the page, and the words for ours being above or below the original.
MEASURES = {
    "size": ("Cỡ", "to hơn", "nhỏ hơn"),
    "detail": ("Chi tiết", "nhiều chi tiết hơn", "ít chi tiết hơn"),
    "contrast": ("Tương phản", "tương phản mạnh hơn", "tương phản yếu hơn"),
    "brightness": ("Độ sáng", "sáng hơn", "tối hơn"),
    "saturation": ("Độ đậm màu", "đậm màu hơn", "nhạt màu hơn"),
    "palette": ("Bảng màu", "", ""),
    "team": ("Màu phe", "nhiều màu phe hơn", "ít màu phe hơn"),
    "outline": ("Viền tối", "viền tối hơn", "viền nhạt hơn"),
}


def frame_of(entry, root):
    """The first picture of an entry: a building or resource's whole picture, a unit's first idle frame facing
    the viewer. With its scale applied, so both stand as the game draws them."""
    if isinstance(entry, list):
        entry = entry[0]
    path = os.path.join(root, entry["file"])
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGBA")
    if "frame" in entry:
        fw, fh = entry["frame"]
        anim = (entry.get("anims") or {}).get("idle") or {"row": 0}
        row = anim.get("row", 0)
        im = im.crop((0, row * fh, fw, row * fh + fh))
    s = entry.get("scale", 1.0)
    if s and abs(s - 1.0) > 1e-6:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im


def look_at(looks, age):
    """A building's look in an age: the latest one given up to it (the original lists the age a look begins)."""
    if not isinstance(looks, dict):
        return None
    keys = [a for a in AGES[: AGES.index(age) + 1] if a in looks]
    return looks[keys[-1]] if keys else None


def pairs(ours, orig, only):
    """(kind, name, our entry, the original's entry) for everything both have."""
    out = []
    for b, by_arch in orig.get("buildings", {}).items():
        mine = ours.get("buildings", {}).get(b)
        if not mine:
            continue
        for arch, looks in by_arch.items():
            for age in AGES:
                if age not in looks:
                    continue
                o = looks[age]
                m = look_at(mine.get(arch, {}), age) or look_at(mine.get("default", {}), age)
                if m:
                    out.append(("building", f"{b} · {arch} · {age}", m, o))
    for u, o in orig.get("units", {}).items():
        m = ours.get("units", {}).get(u)
        if m:
            out.append(("unit", u, m, o))
    for r, o in orig.get("resources", {}).items():
        m = ours.get("resources", {}).get(r)
        if m:
            out.append(("resource", r, m, o))
    if only:
        keep = set(only.split(","))
        out = [p for p in out if p[1].split(" · ")[0] in keep]
    return out


def measure(im):
    """The numbers for one picture, over the pixels it covers."""
    a = np.asarray(im).astype(np.float64) / 255.0
    rgb, alpha = a[..., :3], a[..., 3]
    solid = alpha > 0.75  # not the half-clear black of a cast shadow
    n = int(solid.sum())
    if n < 20:
        return None
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # Inside: solid with all four neighbours solid, so the picture's own edge against the transparent is left out.
    inner = solid.copy()
    inner[1:, :] &= solid[:-1, :]
    inner[:-1, :] &= solid[1:, :]
    inner[:, 1:] &= solid[:, :-1]
    inner[:, :-1] &= solid[:, 1:]
    edge = solid & ~inner
    gx = np.zeros_like(lum)
    gy = np.zeros_like(lum)
    gx[:, 1:-1] = lum[:, 2:] - lum[:, :-2]
    gy[1:-1, :] = lum[2:, :] - lum[:-2, :]
    grad = np.hypot(gx, gy)
    # The owner's colour: drawn in shades of magenta (#FF00FF), red and blue well above green.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    team = solid & (r > 0.25) & (b > 0.25) & (g < 0.6 * np.minimum(r, b)) & (np.abs(r - b) < 0.35 * np.maximum(r, b))
    hist, _ = np.histogramdd(rgb[solid], bins=(6, 6, 6), range=((0, 1), (0, 1), (0, 1)))
    return {
        "size": math.sqrt(n),  # the side of a square of the same area, in pixels
        "detail": float(grad[inner].mean()) if inner.any() else 0.0,
        "contrast": float(lum[solid].std()),
        "brightness": float(lum[solid].mean()),
        "saturation": float(sat[solid].mean()),
        "team": float(team.sum()) / n * 100.0,
        "outline": float((1.0 - lum[edge]).mean()) if edge.any() else 0.0,
        "_hist": hist / hist.sum(),
        "_w": im.width,
        "_h": im.height,
    }


def ratio_score(r):
    """100 for the same, 35 for twice or half, 72 for a quarter off either way."""
    if r <= 0:
        return 0.0
    return 100.0 * math.exp(-1.5 * abs(math.log(r)))


def score(m, o):
    s = {}
    for k in ("size", "detail", "contrast", "brightness", "saturation", "outline"):
        r = m[k] / o[k] if o[k] > 1e-9 else (1.0 if m[k] < 1e-9 else 3.0)
        s[k] = (ratio_score(r), r)
    # Colours: the share of the histogram the two have in common.
    common = float(np.minimum(m["_hist"], o["_hist"]).sum())
    s["palette"] = (100.0 * common, common)
    # Owner's colour, in points of the picture: 3 points off costs a third.
    d = m["team"] - o["team"]
    s["team"] = (100.0 * math.exp(-abs(d) / 7.5), d)
    total = sum(v[0] for v in s.values()) / len(s)
    return total, s


def advice(k, val):
    name, up, down = MEASURES[k]
    if k == "palette":
        return f"{round(val * 100)}% màu trùng bản gốc"
    if k == "team":
        if abs(val) < 1:
            return "như bản gốc"
        return f"{up if val > 0 else down} {abs(val):.1f} điểm %"
    if 0.9 <= val <= 1.1:
        return "như bản gốc"
    return f"{up} {val:.1f}×" if val > 1 else f"{down} {1 / val:.1f}×"


def on_grass(im, zoom=2):
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)  # the frame's empty margin left out; both drawn at the same zoom
    bg = Image.new("RGBA", (im.width + 8, im.height + 8), GRASS + (255,))
    bg.alpha_composite(im, (4, 4))
    bg = bg.resize((bg.width * zoom, bg.height * zoom), Image.NEAREST)
    buf = io.BytesIO()
    bg.convert("RGB").save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def colour(v):
    return "#3fa34d" if v >= 75 else "#d9a400" if v >= 50 else "#d6452f"


def page(rows, means, kinds):
    css = """body{font:14px system-ui,sans-serif;background:#1f2320;color:#e9ece8;margin:16px}h1{font-size:20px}
table{border-collapse:collapse}td,th{padding:4px 8px;border-bottom:1px solid #333;text-align:left;vertical-align:middle}
.row{display:grid;grid-template-columns:60px 170px auto auto 1fr;gap:16px;align-items:end;padding:14px 0;border-bottom:1px solid #444}
@media (max-width:900px){.row{grid-template-columns:60px 1fr}.row table{grid-column:1/-1}}
.pic{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:#aab}
.score{font-size:22px;font-weight:700;min-width:60px}.bar{display:inline-block;height:8px;border-radius:4px;vertical-align:middle;margin-right:6px}
.m td{padding:2px 8px;border:0}.warn{color:#d6452f}img{image-rendering:pixelated}"""
    out = [f"<!doctype html><meta charset=utf-8><title>So sánh hình với bản gốc</title><style>{css}</style>",
           "<h1>Hình của Bronze Dawn so với bản gốc</h1>",
           "<p>Mỗi điểm trên 100 cho biết hình của ta gần bản gốc tới đâu ở thước đo đó (100 là như nhau; gấp đôi hay "
           "bằng nửa là 35). Trang này chứa hình của bản gốc: không đăng, không chia sẻ.</p>",
           "<h2>Theo nhóm</h2><table><tr><th>Nhóm</th><th>Điểm</th><th>Số hình</th></tr>"]
    for kind, (sc, n) in kinds.items():
        out.append(f"<tr><td>{kind}</td><td><span class=bar style='width:{sc:.0f}px;background:{colour(sc)}'></span>{sc:.0f}</td><td>{n}</td></tr>")
    out.append("</table><h2>Trung bình từng thước đo</h2><table><tr><th>Thước đo</th><th>Điểm</th><th>Ta so với gốc (trung vị)</th><th>Đo gì, sửa sao</th></tr>")
    for k, (sc, med) in means.items():
        out.append(f"<tr><td>{MEASURES[k][0]}</td><td><span class=bar style='width:{sc:.0f}px;background:{colour(sc)}'></span>{sc:.0f}</td><td>{html.escape(advice(k, med))}</td>"
                   f"<td style='color:#aab;max-width:520px'>{html.escape(EXPLAIN[k])}</td></tr>")
    out.append("</table><h2>Từng hình, kém nhất trước</h2>")
    for kind, name, total, s, oi, mi in rows:
        cells = "".join(
            f"<tr><td>{MEASURES[k][0]}</td><td><span class=bar style='width:{v[0] * 0.6:.0f}px;background:{colour(v[0])}'></span>{v[0]:.0f}</td>"
            f"<td class='{'warn' if v[0] < 50 else ''}'>{html.escape(advice(k, v[1]))}</td></tr>" for k, v in s.items())
        out.append(f"<div class=row><div class=score style='color:{colour(total)}'>{total:.0f}</div>"
                   f"<div><b>{html.escape(name)}</b><br><span style='color:#99a'>{kind}</span></div>"
                   f"<div class=pic><img src='{on_grass(oi)}'>bản gốc</div><div class=pic><img src='{on_grass(mi)}'>Bronze Dawn</div>"
                   f"<table class=m>{cells}</table></div>")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--aoe", default=os.path.join(ROOT, "web", "assets-local"), help="a copy of BronzeDawn-aoe-data")
    ap.add_argument("--ours", default=os.path.join(ROOT, "web", "public", "assets"), help="Bronze Dawn's assets")
    ap.add_argument("--out", default=os.path.join(ROOT, "web", "art-compare"))
    ap.add_argument("--only", default="", help="names to keep, comma separated (house,clubman,tree)")
    ap.add_argument("--json", action="store_true", help="print the scores as JSON too")
    args = ap.parse_args()
    if not os.path.exists(os.path.join(args.aoe, "manifest.json")):
        sys.exit(f"No original art at {args.aoe}: clone BronzeDawn-aoe-data there (see its README) or pass --aoe")
    ours = json.load(open(os.path.join(args.ours, "manifest.json")))
    orig = json.load(open(os.path.join(args.aoe, "manifest.json")))
    rows, report = [], []
    for kind, name, m, o in pairs(ours, orig, args.only):
        mi, oi = frame_of(m, args.ours), frame_of(o, args.aoe)
        if mi is None or oi is None:
            continue
        mm, om = measure(mi), measure(oi)
        if not mm or not om:
            continue
        total, s = score(mm, om)
        rows.append((kind, name, total, s, oi, mi))
        report.append({"kind": kind, "name": name, "score": round(total, 1), **{k: {"score": round(v[0], 1), "value": round(v[1], 3)} for k, v in s.items()}})
    if not rows:
        sys.exit("Nothing to compare")
    rows.sort(key=lambda r: r[2])
    means = {}
    for k in MEASURES:
        means[k] = (float(np.mean([r[3][k][0] for r in rows])), float(np.median([r[3][k][1] for r in rows])))
    kinds = {}
    for kind in ("building", "unit", "resource"):
        xs = [r[2] for r in rows if r[0] == kind]
        if xs:
            kinds[kind] = (float(np.mean(xs)), len(xs))
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "index.html"), "w") as f:
        f.write(page(rows, means, kinds))
    with open(os.path.join(args.out, "scores.json"), "w") as f:
        json.dump({"mean": {k: round(v[0], 1) for k, v in means.items()}, "items": report}, f, indent=1, ensure_ascii=False)
    overall = float(np.mean([r[2] for r in rows]))
    print(f"{len(rows)} pictures, overall {overall:.0f}/100")
    for kind, (sc, n) in kinds.items():
        print(f"  {kind:9s} {sc:5.0f}  ({n})")
    for k, (sc, med) in means.items():
        print(f"  {MEASURES[k][0]:12s} {sc:5.0f}   {advice(k, med)}")
    print(f"-> {os.path.relpath(os.path.join(args.out, 'index.html'))}")
    if args.json:
        print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
