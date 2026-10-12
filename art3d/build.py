# Renders Bronze Dawn's sprites with Blender and writes them, with their manifest entries, to
# web/public/assets/. Everything here is made from scratch in code, so the pictures are the project's own
# and are published with the game.
#
#   blender -b --factory-startup -P art3d/build.py -- [--only villager,house] [--quick]
#
# --quick renders two directions and a frame or two of each animation, for a look at the style.

import json
import math
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import lib  # noqa: E402
import models  # noqa: E402
import villager  # noqa: E402

OUT = os.path.join(HERE, "..", "web", "public", "assets")
ART = "art3d"  # the folder under assets/ these files go in

DIRS = 8
# Direction i turns a model built facing -Y (toward the viewer's lower right) clockwise on screen.
FACING = [math.radians(45 - 45 * i) for i in range(DIRS)]


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = None
    if "--only" in a:
        only = set(a[a.index("--only") + 1].split(","))
    return only, "--quick" in a


def unit_sheet(key, build, anims, frame_size, anchor, quick, tmp):
    """Renders every direction of every animation of one figure into a sheet. `anims` is a list of
    (name in the manifest, pose name, frames, fps)."""
    lib.reset()
    rig = build()
    lib.shadow_catcher(4)
    w, h = frame_size
    target_z = (anchor[1] - h / 2) / (math.cos(lib.ELEVATION) * lib.PPU)
    lib.camera(w, h, target=(0, 0, target_z))
    dirs = [0, 2] if quick else range(DIRS)
    rows, spec_anims = [], {}
    for name, pose, frames, fps in anims:
        spec_anims[name] = {"row": len(rows), "frames": frames, "fps": fps}
        steps = range(0, frames, max(1, frames // 2)) if quick else range(frames)
        for d in dirs:
            rig.face(FACING[d])
            row = []
            for f in steps:
                rig.pose(pose, f / frames)
                img = lib.frame(tmp)
                lib.check_edges(img, f"{key} {name} dir {d} frame {f}")
                row.append(img)
            rows.append(row)
    path = os.path.join(OUT, ART, f"{key.replace(':', '-')}.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lib.save_png(lib.sheet(rows), path)
    print(f"{key}: {len(rows)} rows -> {path}")
    k = lib.DOWN
    return {"file": f"{ART}/{os.path.basename(path)}", "frame": [w // k, h // k], "anchor": [anchor[0] / k, anchor[1] / k], "scale": lib.SCALE,
            "directions": DIRS, "anims": spec_anims}


def still(key, build, size, anchor_point, tmp, center=(0, 0, 0)):
    """One picture of a model; `anchor_point` is the point in the scene that stands on the ground spot."""
    lib.reset()
    build()
    lib.shadow_catcher(12)
    w, h = size
    lib.camera(w, h, target=center)
    ax, ay = lib.pixel_of(anchor_point)
    img = lib.frame(tmp)
    lib.check_edges(img, key)
    path = os.path.join(OUT, ART, f"{key}.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lib.save_png(img, path)
    print(f"{key} -> {path}")
    k = lib.DOWN
    return {"file": f"{ART}/{key}.png", "anchor": [round(ax / k, 1), round(ay / k, 1)], "scale": lib.SCALE}


VILLAGER_FRAME = (200, 168)
VILLAGER_ANCHOR = (96, 118)


def main():
    only, quick = args()
    want = lambda k: only is None or k in only  # noqa: E731
    tmp = tempfile.mkdtemp(prefix="bd-art-")
    units, buildings, resources = {}, {}, {}

    if want("villager"):
        units["villager"] = unit_sheet("villager", lambda: villager.Rig("none"),
                                       [("idle", "idle", 6, 4), ("walk", "walk", 12, 14)],
                                       VILLAGER_FRAME, VILLAGER_ANCHOR, quick, tmp)
    # A villager by job: the game picks "villager:<tool>" for the work in hand.
    for tool, work, frames, fps in (("axe", "chop", 12, 11), ("pick", "mine", 12, 11), ("hammer", "hammer", 10, 12),
                                    ("basket", "forage", 16, 10)):
        if want("villager") or want(f"villager:{tool}"):
            units[f"villager:{tool}"] = unit_sheet(f"villager:{tool}", lambda tool=tool: villager.Rig(tool),
                                                   [("idle", "idle", 6, 4), ("walk", "walk", 12, 14), ("work", work, frames, fps)],
                                                   VILLAGER_FRAME, VILLAGER_ANCHOR, quick, tmp)
    if want("town_center"):
        s = models.TOWN_CENTER
        buildings["town_center"] = {"default": {"stone": still("town_center", models.town_center, s["size"], s["anchor"], tmp, s["center"])}}
    if want("house"):
        s = models.HOUSE
        buildings["house"] = {"default": {"stone": still("house", models.house, s["size"], s["anchor"], tmp, s["center"])}}
    if want("tree"):
        resources["tree"] = [still(f"tree{i}", lambda i=i: models.tree(i), models.TREE["size"], (0, 0, 0), tmp, models.TREE["center"])
                             for i in range(models.TREE["variants"])]

    if want("lone_tree"):
        s = models.LONE_TREE
        resources["lone_tree"] = still("lone_tree", models.lone_tree, s["size"], (0, 0, 0), tmp, s["center"])

    cliffs = {}
    if want("cliff"):
        s = models.CLIFF
        for mask in range(16):
            cliffs[str(mask)] = [still(f"cliff{mask}-{v}", lambda mask=mask, v=v: models.cliff(mask, v), s["size"], (0, 0, 0), tmp, s["center"])
                                 for v in range(s["variants"])]

    write_manifest(units, buildings, resources, cliffs)


def write_manifest(units, buildings, resources, cliffs=None):
    path = os.path.join(OUT, "manifest.json")
    m = json.load(open(path)) if os.path.exists(path) else {}
    for k, v in (("units", units), ("buildings", buildings), ("resources", resources), ("cliffs", cliffs or {})):
        if v:
            m.setdefault(k, {}).update(v)
    credit = {"what": "Sprites in art3d/ (units, buildings, trees, cliffs)", "author": "Bronze Dawn contributors, rendered with Blender from art3d/",
              "license": "Same as the game (made for this project)"}
    m["credits"] = [c for c in m.get("credits", []) if not c.get("what", "").startswith("Sprites in art3d/")] + [credit]
    with open(path, "w") as f:
        json.dump(m, f, indent=1)
        f.write("\n")
    print("manifest ->", path)


if __name__ == "__main__":
    main()
