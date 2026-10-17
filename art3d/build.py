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

try:
    import fcntl

    def lock_file(f):
        fcntl.flock(f, fcntl.LOCK_EX)

    def unlock_file(f):
        fcntl.flock(f, fcntl.LOCK_UN)
except ImportError:  # Windows
    import msvcrt

    def lock_file(f):
        msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)

    def unlock_file(f):
        f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import lib  # noqa: E402
import models  # noqa: E402
import animals  # noqa: E402
import arch  # noqa: E402
import landmarks  # noqa: E402
import buildings as blds  # noqa: E402
import machines  # noqa: E402
import race_buildings  # noqa: E402
import races  # noqa: E402
import relics  # noqa: E402
import soldiers  # noqa: E402
import terrain  # noqa: E402
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


def arch_arg():
    """--arch egyptian: the buildings of one architecture (arch.py), from the Tool Age on."""
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return a[a.index("--arch") + 1] if "--arch" in a else None


def bigger(key):
    """How much larger than the rest a figure is drawn: the ships, the lion and the alligator were hard to
    make out beside the villagers. Its frame and anchor grow with it."""
    return 1.5 if key in SHIPS or key in ("lion", "alligator", "carcass_lion", "carcass_alligator") else 1


def grown(key, size, point):
    k = bigger(key)
    return (round(size[0] * k), round(size[1] * k)), (round(point[0] * k), round(point[1] * k))


def unit_sheet(key, build, anims, frame_size, anchor, quick, tmp):
    """Renders every direction of every animation of one figure into a sheet. `anims` is a list of
    (name in the manifest, pose name, frames, fps)."""
    ppu = lib.PPU
    lib.PPU = ppu * bigger(key)
    frame_size, anchor = grown(key, frame_size, anchor)
    try:
        return _unit_sheet(key, build, anims, frame_size, anchor, quick, tmp)
    finally:
        lib.PPU = ppu


def _unit_sheet(key, build, anims, frame_size, anchor, quick, tmp):
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
    path = os.path.join(OUT, ART, f"{key.replace(':', '-').replace('/', '-')}.png")  # "elf/villager:axe" -> elf-villager-axe.png
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lib.save_png(lib.sheet(rows), path)
    print(f"{key}: {len(rows)} rows -> {path}")
    k = lib.DOWN
    return {"file": f"{ART}/{os.path.basename(path)}", "frame": [w // k, h // k], "anchor": [anchor[0] / k, anchor[1] / k], "scale": lib.SCALE,
            "directions": DIRS, "anims": spec_anims}


def trim(img, ax, ay, pad=4):
    """Cuts the empty margin off a picture (the fantasy races' frames are made big enough for their tallest,
    and most stood in a corner of it), moving the anchor with it. In the picture's own pixels."""
    import numpy as np
    ys, xs = np.nonzero(img[:, :, 3] > 0)
    if not len(xs):
        return img, ax, ay
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(img.shape[1], xs.max() + 1 + pad), min(img.shape[0], ys.max() + 1 + pad)
    return img[y0:y1, x0:x1], ax - x0, ay - y0


def still(key, build, size, anchor_point, tmp, center=(0, 0, 0), ground=True, cut=False):
    """One picture of a model; `anchor_point` is the point in the scene that stands on the ground spot.
    `ground`: whether it casts a shadow on the ground (not on water)."""
    ppu = lib.PPU
    lib.PPU = ppu * bigger(key)
    size, _ = grown(key, size, (0, 0))
    try:
        return _still(key, build, size, anchor_point, tmp, center, ground, cut)
    finally:
        lib.PPU = ppu


def _still(key, build, size, anchor_point, tmp, center, ground, cut=False):
    lib.reset()
    build()
    lib.RIM = ground
    if ground:
        lib.shadow_catcher(12)
    w, h = size
    lib.camera(w, h, target=center)
    ax, ay = lib.pixel_of(anchor_point)
    img = lib.frame(tmp)
    lib.RIM = True
    lib.check_edges(img, key)
    k = lib.DOWN
    ax, ay = ax / k, ay / k
    if cut:
        img, ax, ay = trim(img, ax, ay)
    path = os.path.join(OUT, ART, f"{key}.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lib.save_png(img, path)
    print(f"{key} -> {path}")
    return {"file": f"{ART}/{key}.png", "anchor": [round(ax, 1), round(ay, 1)], "scale": lib.SCALE}


ANIMAL_FRAME = (180, 150)
ANIMAL_ANCHOR = (86, 104)
HORSES = {"scout", "cavalry", "heavy_cavalry", "cataphract", "horse_archer", "heavy_horse_archer"}
ELEPHANTS = {"war_elephant", "armored_elephant", "elephant_archer"}
CHARIOTS = {"chariot", "scythe_chariot", "chariot_archer"}


ENGINE_ANIMS = [("idle", "idle", 1, 1), ("walk", "walk", 8, 10), ("attack", "attack", 10, 10)]
SHIP_ANIMS = [("idle", "idle", 6, 4), ("walk", "walk", 8, 8)]
ENGINES = {
    "stone_thrower": (lambda: machines.Catapult(0.85, "stone_thrower"), (260, 240), (126, 160)),
    "catapult": (lambda: machines.Catapult(1.0), (280, 260), (136, 172)),
    "heavy_catapult": (lambda: machines.Catapult(1.2), (320, 300), (156, 196)),
    "ballista": (machines.Ballista, (260, 220), (126, 150)),
    "helepolis": (machines.Helepolis, (260, 330), (126, 250)),
}
SHIPS = ("fishing_boat", "fishing_ship", "trade_boat", "merchant_ship", "light_transport", "heavy_transport",
         "scout_ship", "war_galley", "fire_galley", "trireme", "catapult_trireme", "juggernaught")


def unit_spec(unit):
    """How to make a unit's figure, its animations, frame and anchor."""
    if unit in ENGINES:
        make, frame, anchor = ENGINES[unit]
        return make, ENGINE_ANIMS, frame, anchor
    if unit in SHIPS:
        return (lambda: machines.Ship(unit)), SHIP_ANIMS, (380, 330), (186, 210)
    weapon = soldiers.KITS[unit][3]
    attack = soldiers.attack_of(weapon)
    anims = [("idle", "idle", 4, 3), ("walk", "walk", 12, 14), ("attack", attack, 10, 10)]
    if unit in HORSES:
        return (lambda: soldiers.mounted(unit, "horse")), anims, (300, 250), (146, 178)
    if unit == "camel_rider":
        return (lambda: soldiers.mounted(unit, "camel")), anims, (300, 270), (146, 196)
    if unit in ELEPHANTS:
        return (lambda: soldiers.mounted(unit, "elephant")), anims, (480, 470), (236, 330)
    if unit in CHARIOTS:
        return (lambda: soldiers.Chariot(unit)), anims, (330, 260), (160, 184)
    big = weapon in soldiers.SPEARS
    return (lambda: soldiers.Soldier(unit)), anims, ((240, 200) if big else (200, 168)), ((116, 140) if big else (96, 118))


VILLAGER_FRAME = (200, 168)
VILLAGER_ANCHOR = (96, 118)
# The angler's rod reaches high and far: a bigger frame, the feet at the same place in it.
ANGLER_FRAME = (280, 260)
ANGLER_ANCHOR = (136, 190)

# A villager's jobs: (the game's name for the sheet, the rig's tool, the work animation, frames, fps).
# The fisher's sheet keeps the name "net", the tool the game and art packs know fishing by; it is drawn
# angling with a rod.
JOBS = (("axe", "axe", "chop", 12, 11), ("pick", "pick", "mine", 12, 11), ("hammer", "hammer", "hammer", 10, 12),
        ("basket", "basket", "forage", 16, 10), ("butcher", "butcher", "butcher", 14, 10), ("hoe", "hoe", "hoe", 10, 10),
        ("spear", "spear", "throw", 12, 12), ("net", "rod", "angle", 20, 8), ("fight", "spear", "thrust", 10, 11))

# The races are drawn bigger or smaller than the common villager: frames and anchors to hold them.
RACE_FRAME = {"elf": ((210, 180), (100, 128)), "dwarf": ((200, 168), (96, 118)),
              "centaur": ((340, 300), (166, 214)), "beastfolk": ((260, 200), (126, 146))}
RACE_ANGLER = {"centaur": ((420, 360), (206, 254))}
# The races' own units: frame and anchor.
OWN_FRAME = {"glade_archer": ((260, 240), (126, 170)), "grove_warden": ((340, 340), (166, 250)),
             "ironclad": ((210, 176), (100, 124)), "deep_arbalest": ((230, 186), (110, 130)),
             "centaur_archer": ((340, 300), (166, 214)), "hoof_lancer": ((360, 320), (176, 230)),
             "wolfkin_raider": ((250, 230), (120, 164)), "bearkin_brute": ((320, 310), (156, 224))}


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
    for tool, rig_tool, work, frames, fps in JOBS:
        if want("villager") or want(f"villager:{tool}"):
            units[f"villager:{tool}"] = unit_sheet(f"villager:{tool}", lambda rig_tool=rig_tool: villager.Rig(rig_tool),
                                                   [("idle", "idle", 6, 4), ("walk", "walk", 12, 14), ("work", work, frames, fps)],
                                                   *((ANGLER_FRAME, ANGLER_ANCHOR) if rig_tool == "rod" else (VILLAGER_FRAME, VILLAGER_ANCHOR)),
                                                   quick, tmp)
    # The fantasy races' villagers, as the game picks them first for a civilization ("elf/villager:axe"), in
    # every job; --only takes "elf", "elf/villager" or "elf/villager:axe".
    for race in races.VILLAGERS:
        frame, anchor = RACE_FRAME[race]
        jobs = [(None, "none", None, 0, 0), *JOBS]
        for tool, rig_tool, work, frames, fps in jobs:
            key = f"{race}/villager" + (f":{tool}" if tool else "")
            if not (only is None or race in only or key in only):
                continue
            make = lambda race=race, rig_tool=rig_tool: races.villager_of(race, rig_tool)  # noqa: E731
            # Elves hunt with the bow and fight with a dagger.
            if race == "elf" and tool == "spear":
                make, work = races.elf_hunter, "shoot"
            if race == "elf" and tool == "fight":
                make, work = races.elf_fighter, "slash"
            anims = [("idle", "idle", 6, 4), ("walk", "walk", 12, 14)] + ([("work", work, frames, fps)] if tool else [])
            f, a = RACE_ANGLER.get(race, (ANGLER_FRAME, ANGLER_ANCHOR)) if rig_tool == "rod" else (frame, anchor)
            units[key] = unit_sheet(key, make, anims, f, a, quick, tmp)
    # The elves' own looks for the common units they train ("elf/clubman"); --only takes "elf" or "elf/clubman".
    for unit in races.ELF_UNITS:
        key = f"elf/{unit}"
        if not (only is None or "elf" in only or key in only):
            continue
        _, anims, frame, anchor = unit_spec(unit)
        units[key] = unit_sheet(key, lambda unit=unit: races.elf_unit(unit), anims, frame, anchor, quick, tmp)
    for unit, (make, attack) in races.UNITS.items():
        if only is not None and unit not in only and "races" not in only:
            continue
        frame, anchor = OWN_FRAME[unit]
        units[unit] = unit_sheet(unit, make, [("idle", "idle", 4, 3), ("walk", "walk", 12, 14), ("attack", attack, 10, 10)], frame, anchor, quick, tmp)
    # Every building in the style of each age from its first; the game falls back to an earlier age's
    # picture, so the first is enough for the ages before it. --only takes "barracks" or "barracks@bronze".
    style = arch_arg()
    for key, make in blds.BUILDERS.items():
        first = max(blds.FIRST[key], 1) if style else blds.FIRST[key]
        ages = blds.AGES[first:] if key not in blds.ONE_LOOK else [blds.AGES[first]]
        for age in ages:
            if not (only is None or key in only or f"{key}@{age}" in only):
                continue
            size, center, anchor = blds.frame_of(key)
            if style:
                def made(make=make, age=age, key=key):
                    st = blds.Style(age, style)
                    (landmarks.SPECIAL.get((style, key)) or make)(st)
                    arch.decorate(st, key, blds.SIZE.get(key, 3))
                spec = still(f"{key}-{style}-{age}", made, size, anchor, tmp, center, ground=key != "dock")
            else:
                spec = still(f"{key}-{age}", lambda make=make, age=age: make(blds.Style(age)), size, anchor, tmp, center,
                             ground=key != "dock")
            buildings.setdefault(key, {}).setdefault(style or "default", {})[age] = spec
    # The fantasy races' own buildings, as the game picks them first for a civilization: buildings[id][race][age].
    # --only takes "buildings-elf", "elf-house" or "elf-house@tool".
    for race in race_buildings.KITS:
        for key in race_buildings.BUILDERS:
            for age in race_buildings.ages_of(key):
                name = f"{race}-{key}"
                if not (only is None or f"buildings-{race}" in only or name in only or f"{name}@{age}" in only):
                    continue
                (w, h), center, anchor = blds.frame_of(key)
                # Their tallest (an elf's tree, a dwarf's peak) stand higher than anyone's.
                grow = 1.7 if key in ("town_center", "temple", "wonder") else 1.3
                size = (int(w * (1.2 if key == "town_center" else 1)), int(h * grow))
                center = (center[0], center[1], center[2] * grow)
                spec = still(f"{name}-{age}", lambda race=race, key=key, age=age: race_buildings.make(race, key, age), size, anchor, tmp, center,
                             ground=key != "dock", cut=True)
                buildings.setdefault(key, {}).setdefault(race, {})[age] = spec
    if want("town_center-old"):
        s = models.TOWN_CENTER
        buildings["town_center"] = {"default": {"stone": still("town_center", models.town_center, s["size"], s["anchor"], tmp, s["center"])}}
    if want("house-old"):
        s = models.HOUSE
        buildings["house"] = {"default": {"stone": still("house", models.house, s["size"], s["anchor"], tmp, s["center"])}}
    if want("tree"):
        resources["tree"] = [still(f"tree{i}", lambda i=i: models.tree(i), models.TREE["size"], (0, 0, 0), tmp, models.TREE["center"])
                             for i in range(models.TREE["variants"])]

    if want("lone_tree"):
        s = models.LONE_TREE
        resources["lone_tree"] = still("lone_tree", models.lone_tree, s["size"], (0, 0, 0), tmp, s["center"])

    if want("berry_bush"):
        s = models.BUSH
        resources["berry_bush"] = [still(f"berry_bush{v}", lambda v=v: models.berry_bush(v), s["size"], (0, 0, 0), tmp, s["center"]) for v in range(s["variants"])]
    for kind in ("gold", "stone"):
        if want(f"{kind}_mine"):
            s = models.MINE
            resources[f"{kind}_mine"] = [still(f"{kind}_mine{v}", lambda v=v, kind=kind: models.mine(kind, v), s["size"], (0, 0, 0), tmp, s["center"])
                                         for v in range(s["variants"])]
    for unit in soldiers.KITS:
        if only is not None and unit not in only and "soldiers" not in only:
            continue
        make, anims, frame, anchor = unit_spec(unit)
        units[unit] = unit_sheet(unit, make, anims, frame, anchor, quick, tmp)

    for unit in [*ENGINES, *SHIPS]:
        if only is not None and unit not in only and ("machines" if unit in ENGINES else "ships") not in only:
            continue
        make, anims, frame, anchor = unit_spec(unit)
        units[unit] = unit_sheet(unit, make, anims, frame, anchor, quick, tmp)

    # Animals: (class, animations, frame, anchor, carcass picture size).
    beasts = {
        "gazelle": (animals.Gazelle, [("idle", "idle", 10, 5), ("walk", "walk", 10, 16)], ANIMAL_FRAME, ANIMAL_ANCHOR, (170, 120)),
        "lion": (animals.Lion, [("idle", "idle", 8, 4), ("walk", "walk", 10, 14), ("attack", "attack", 8, 10)], ANIMAL_FRAME, ANIMAL_ANCHOR, (190, 130)),
        "alligator": (animals.Alligator, [("idle", "idle", 8, 4), ("walk", "walk", 10, 12), ("attack", "attack", 8, 10)], (220, 150), (108, 96), (230, 140)),
        "elephant": (animals.Elephant, [("idle", "idle", 10, 5), ("walk", "walk", 12, 9), ("attack", "attack", 10, 9)], (440, 400), (216, 290), (440, 300)),
    }
    for key, (cls, anims, frame, anchor, dead_size) in beasts.items():
        if not want(key):
            continue
        units[key] = unit_sheet(key, cls, anims, frame, anchor, quick, tmp)
        def carcass(cls=cls):
            a = cls()
            a.face(FACING[1])
            a.pose("dead", 0)
        resources[f"carcass_{key}"] = still(f"carcass_{key}", carcass, dead_size, (0, 0, 0), tmp, (0.15, -0.05, 0.1))

    # Ruins and Artifacts, as found and held: the game shows "<id>:held" while a player holds one.
    for key, cls, anims, frame, anchor in (
        ("ruins", relics.Ruins, [("idle", "idle", 1, 1)], relics.RUINS_FRAME, relics.RUINS_ANCHOR),
        ("artifact", relics.Artifact, [("idle", "idle", 1, 1), ("walk", "walk", 8, 8)], relics.ARTIFACT_FRAME, relics.ARTIFACT_ANCHOR),
    ):
        if want(key) or want("relics"):
            for held in (False, True):
                name = f"{key}:held" if held else key
                units[name] = unit_sheet(name, lambda cls=cls, held=held: cls(held), anims, frame, anchor, quick, tmp)

    if want("fish"):
        s = models.FISH
        resources["fish"] = [still(f"fish{v}", lambda v=v: models.fish(v, False), s["size"], (0, 0, 0), tmp, s["center"], ground=False) for v in range(2)]
        resources["deep_fish"] = [still(f"deep_fish{v}", lambda v=v: models.fish(v, True), s["size"], (0, 0, 0), tmp, s["center"], ground=False) for v in range(2)]

    cliffs = {}
    if want("cliff"):
        s = models.CLIFF
        for mask in range(16):
            cliffs[str(mask)] = [still(f"cliff{mask}-{v}", lambda mask=mask, v=v: models.cliff(mask, v), s["size"], (0, 0, 0), tmp, s["center"])
                                 for v in range(s["variants"])]

    ground = {}
    if want("terrain"):
        for kind in terrain.KINDS:
            files = []
            for v in range(6):
                path = os.path.join(OUT, ART, f"ground-{kind}{v}.png")
                lib.save_png(terrain.tile(kind, v), path)
                files.append(f"{ART}/ground-{kind}{v}.png")
            ground[kind] = files
        print("terrain:", ", ".join(ground))

    write_manifest(units, buildings, resources, cliffs, ground)


def write_manifest(units, buildings, resources, cliffs=None, ground=None):
    """Adds what was rendered to the manifest. Several renders can run at once (each with its own --only):
    a lock on the file keeps one from writing over another's entries."""
    path = os.path.join(OUT, "manifest.json")
    lock = open(path + ".lock", "w")
    lock_file(lock)
    m = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    def merge(into, new):
        # Buildings nest by style and age: a render of one age keeps the others.
        for k, v in new.items():
            if isinstance(v, dict) and isinstance(into.get(k), dict) and "file" not in v:
                merge(into[k], v)
            else:
                into[k] = v
    for k, v in (("units", units), ("buildings", buildings), ("resources", resources), ("cliffs", cliffs or {}), ("terrain", ground or {})):
        if v:
            merge(m.setdefault(k, {}), v)
    credit = {"what": "Sprites in art3d/ (units, animals, buildings, trees, resources, cliffs)", "author": "Bronze Dawn contributors, rendered with Blender from art3d/",
              "license": "Same as the game (made for this project)"}
    m["credits"] = [c for c in m.get("credits", []) if not c.get("what", "").startswith("Sprites in art3d/")] + [credit]
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(m, f, indent=1)
        f.write("\n")
    unlock_file(lock)
    lock.close()
    os.remove(path + ".lock")
    print("manifest ->", path)


if __name__ == "__main__":
    main()
