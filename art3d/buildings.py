# Every building, in the style of each age. One unit is one tile; a building's tiles run from -size/2 to
# size/2 on X and Y, centred on the origin. The front, where doors face, is toward the viewer: the scene's
# (+X, -Y) corner.
#
#   Stone Age   mud walls, thatch, poles
#   Tool Age    mud brick, thatched gables, timber
#   Bronze Age  whitewashed walls, red tile roofs, columns
#   Iron Age    cut stone, tile roofs, marble columns

import math
import random

import arch
import lib
import models
import stoneage

R = math.radians
AGES = ["stone", "tool", "bronze", "iron"]


# How each age's walls are laid: plastered mud (none), mud brick, whitewashed blocks, cut stone; as
# (pattern, width, height, how dark the joints are) for lib.courses.
WALL_COURSES = [None, ("brick", 0.16, 0.07, 0.55), ("brick", 0.26, 0.11, 0.3), ("brick", 0.3, 0.13, 0.6)]


class Style:
    """The materials of an age, in an architecture (arch.py) or, with "default", the style everyone shared."""

    def __init__(self, age, arch_name="default"):
        self.age = age
        self.arch = arch_name
        i = AGES.index(age)
        self.i = i
        # Mud plastered, then mud brick, then whitewashed blocks, then cut stone; thatch, then tile.
        self.wall = lib.mat(f"wall{i}", [(0.60, 0.45, 0.30), (0.68, 0.52, 0.36), (0.86, 0.80, 0.68), (0.90, 0.87, 0.80)][i], 0.95,
                            grain=[0.3, 0.35, 0.18, 0.25][i], grain_size=0.02,
                            kind=WALL_COURSES[i])
        self.roof = lib.mat(f"roof{i}", [(0.74, 0.60, 0.30), (0.70, 0.56, 0.28), (0.70, 0.36, 0.22), (0.62, 0.28, 0.18)][i], 0.9,
                            grain=0.4, grain_size=0.012 if i < 2 else 0.02,
                            kind=[("thatch", 0.05, 0, 0.5), ("thatch", 0.05, 0, 0.5), ("brick", 0.09, 0.06, 0.55), ("brick", 0.09, 0.06, 0.6)][i])
        self.trim = lib.mat(f"trim{i}", [(0.40, 0.25, 0.12), (0.42, 0.27, 0.13), (0.62, 0.58, 0.50), (0.90, 0.88, 0.84)][i], 0.8)
        self.wood = lib.mat("wood", (0.40, 0.25, 0.12), 0.8)
        self.dark = lib.mat("door", (0.12, 0.08, 0.05), 1.0)
        self.team = lib.team_mat("teamcloth")
        self.thatch = i < 2
        self.stone = i >= 2
        if arch_name != "default":
            p = arch.palette(arch_name, i)
            self.wall = lib.mat(f"{arch_name}-wall{i}", p["wall"], 0.95, grain=0.22, grain_size=0.02, kind=WALL_COURSES[i])
            self.roof = lib.mat(f"{arch_name}-roof{i}", p["roof"], 0.9, grain=0.3, grain_size=0.015, kind=("brick", 0.09, 0.06, 0.55))
            self.trim = lib.mat(f"{arch_name}-trim{i}", p["trim"], 0.8, grain=0.12)
            self.accent = lib.mat(f"{arch_name}-accent", p["accent"], 0.6, grain=0.1)
            self.accent2 = lib.mat(f"{arch_name}-accent2", p["accent2"], 0.7, grain=0.1)
            # Built, not thatched: every architecture has its own walls and roofs from the Tool Age on.
            self.thatch = False


# ---- shapes

def prism(name, w, d, h, loc, m, along="x"):
    """A gable roof: a ridge `h` above its eaves, running along X or Y, `w` by `d` at the eaves."""
    bpy = lib.bpy
    x0, y0, z0 = loc
    if along == "x":
        verts = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0), (-w / 2, 0, h), (w / 2, 0, h)]
        faces = [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    else:
        verts = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0), (0, -d / 2, h), (0, d / 2, h)]
        faces = [(0, 4, 5, 3), (1, 2, 5, 4), (0, 1, 4), (3, 5, 2), (0, 3, 2, 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x + x0, y + y0, z + z0) for x, y, z in verts], [], faces)
    o = bpy.data.objects.new(name, me)
    lib.link(o)
    lib.setmat(o, m)
    return o


def hall(st, name, x, y, w, d, h, roof="gable", along="x", roof_h=None):
    """A rectangular building: walls, then a roof of the age's kind."""
    if st.arch != "default":
        return arch.hall(st, name, x, y, w, d, h, roof, along, roof_h)
    lib.box(f"{name}-walls", (w, d, h), (x, y, h / 2), st.wall, bevel=0.02)
    rh = roof_h if roof_h is not None else (0.42 if st.thatch else 0.3) * min(w, d)
    over = 0.08
    if roof == "flat":
        lib.box(f"{name}-roof", (w + 0.04, d + 0.04, 0.05), (x, y, h + 0.025), st.trim, bevel=0.01)
        lib.box(f"{name}-parapet", (w + 0.06, d + 0.06, 0.08), (x, y, h + 0.07), st.wall, bevel=0.01)
        lib.box(f"{name}-roofin", (w - 0.04, d - 0.04, 0.1), (x, y, h + 0.075), st.trim)
    else:
        o = prism(f"{name}-roof", w + over * 2, d + over * 2, rh, (x, y, h), st.roof, along)
        if st.thatch:
            lib.lumpy(o, 0.012, 0.04)
    return h + (0 if roof == "flat" else rh)


def door(st, x, y, w, h, side="front"):
    """A door on the side facing the viewer: front is -Y, right is +X."""
    if st.arch != "default":
        arch.door(st, x, y, w, h, side)
        return
    if side == "front":
        lib.box("door", (w, 0.03, h), (x, y, h / 2), st.dark)
    else:
        lib.box("door", (0.03, w, h), (x, y, h / 2), st.dark)


def columns(st, x0, x1, y, h, n, r=0.045):
    if st.arch != "default":
        arch.columns(st, x0, x1, y, h, n, r)
        return
    for i in range(n):
        x = x0 + (x1 - x0) * i / max(1, n - 1)
        lib.cyl(f"col{i}{y:.2f}", r, h, (x, y, h / 2), st.trim, verts=12)
        lib.box(f"cap{i}{y:.2f}", (r * 2.6, r * 2.6, 0.03), (x, y, h + 0.015), st.trim)


def flag(st, x, y, h):
    lib.cyl(f"pole{x:.2f}{y:.2f}", 0.016, h, (x, y, h / 2), st.wood, verts=8)
    lib.box(f"flag{x:.2f}{y:.2f}", (0.02, 0.24, 0.14), (x, y - 0.12, h - 0.09), st.team)


def banner(st, x, y, z, w=0.16, h=0.22, side="front"):
    if side == "front":
        lib.box(f"banner{x:.2f}{z:.2f}", (w, 0.015, h), (x, y, z), st.team)
    else:
        lib.box(f"banner{x:.2f}{z:.2f}", (0.015, w, h), (x, y, z), st.team)


def palisade(st, x0, y0, x1, y1, h=0.4, gap=0.075):
    n = max(2, int(math.hypot(x1 - x0, y1 - y0) / gap))
    for i in range(n + 1):
        k = i / n
        lib.cyl(f"stake{x0:.1f}{y0:.1f}{i}", 0.03, h, (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, h / 2), st.wood, verts=6, r2=0.02)


def steps(st, x, y, w, d, n=3, h=0.04):
    for i in range(n):
        lib.box(f"step{i}", (w + (n - i) * 0.08, d + (n - i) * 0.08, h), (x, y, h * (i + 0.5)), st.trim if st.stone else st.wall, bevel=0.005)
    return n * h


EARTH = (0.44, 0.36, 0.24)
MOSS = (0.34, 0.42, 0.20)


def earthy(color):
    """A yard's colour brought to trodden earth: a pale one (paving, sand, a court) was read as concrete."""
    c = tuple(0.45 * x + 0.55 * e for x, e in zip(color, EARTH))
    lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    k = min(1.0, 0.46 / max(lum, 1e-6))
    return tuple(x * k for x in c)


def ground(size, color=EARTH):
    """Trodden earth under a building, inside its tiles, ragged at the edge so it fades into the ground round it
    rather than standing on it like a board; moss and grass in patches over it, and the small things of a
    lived-in yard about its edge (jars, sacks, crates, firewood, baskets, tufts of grass, bushes, tools)."""
    bpy = lib.bpy
    # Kept close to the walls, as the original's: a wide flat yard read as a board the building stood on.
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=size * 0.54, depth=0.012, location=(0, 0, 0.006))
    p = bpy.context.object
    p.name = "yard"
    rnd = random.Random(size * 7)
    for v in p.data.vertices:
        x, y = v.co.x, v.co.y
        r = math.hypot(x, y)
        if r < 1e-6:
            continue
        # Squared off toward the tiles' corners, ragged.
        k = max(abs(x), abs(y)) / r
        f = (0.86 + 0.14 * k) / (0.84 + rnd.uniform(-0.09, 0.09))
        v.co.x, v.co.y = x / f, y / f
    yard = lib.mat("yard", earthy(color), 1.0, grain=0.55, grain_size=0.025)
    lib.mottle(yard, MOSS, scale=0.3, cover=0.32)
    lib.setmat(p, yard)
    clutter(size, rnd)


def clutter(size, rnd):
    """The small things about the edge of a yard: a ring just inside the edge, most toward the viewer, where
    they show and do not stand in front of the building."""
    pebble = lib.mat("pebble", (0.52, 0.48, 0.42), 0.95, grain=0.3)
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    sack = lib.mat("sack", (0.74, 0.66, 0.50), 1.0, grain=0.3)
    wood = lib.mat("wood", (0.40, 0.25, 0.12), 0.8)
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    grass = lib.mat("tuft", (0.36, 0.48, 0.20), 0.9, grain=0.3)
    bush = lib.mat("bush", (0.26, 0.38, 0.18), 0.9, grain=0.35, grain_size=0.02)
    n = int(7 * size)
    for i in range(n):
        # Two in three on the half toward the viewer (the -Y, +X side).
        a = rnd.uniform(-math.pi * 0.85, math.pi * 0.35) if rnd.random() < 0.67 else rnd.uniform(0, 2 * math.pi)
        r = size * rnd.uniform(0.44, 0.56)
        x, y = r * math.cos(a), r * math.sin(a)
        kind = rnd.choice(("pebble", "pebble", "tuft", "tuft", "tuft", "pot", "sack", "crate", "logs", "basket", "bush", "tool"))
        name = f"clutter{i}"
        if kind == "pebble":
            q = lib.ball(name, rnd.uniform(0.02, 0.04), (x, y, 0.014), pebble, sub=1)
            q.scale = (1.3, 1.0, 0.6)
        elif kind == "tuft":
            for j in range(3):
                lib.cyl(f"{name}-{j}", 0.012, rnd.uniform(0.05, 0.09), (x + rnd.uniform(-0.03, 0.03), y + rnd.uniform(-0.03, 0.03), 0.03),
                        grass, verts=4, r2=0.0, rot=(rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0))
        elif kind == "pot":
            lib.ball(name, rnd.uniform(0.035, 0.05), (x, y, 0.045), clay, scale=(1, 1, 1.3), sub=1)
        elif kind == "sack":
            lib.ball(name, rnd.uniform(0.04, 0.055), (x, y, 0.04), sack, scale=(1, 1, 1.1), sub=1)
        elif kind == "crate":
            lib.box(name, (0.09, 0.09, 0.08), (x, y, 0.04), wood, rot=(0, 0, rnd.uniform(0, 1.5)), bevel=0.006)
        elif kind == "logs":
            for j in range(3):
                lib.cyl(f"{name}-{j}", 0.018, 0.2, (x + (j - 1) * 0.02, y, 0.02 + (j == 1) * 0.03), wood, rot=(0, R(90), rnd.uniform(0, 3)), verts=6)
        elif kind == "basket":
            lib.cyl(name, 0.04, 0.045, (x, y, 0.022), basket, verts=10)
        elif kind == "bush":
            lib.lumpy(lib.ball(name, rnd.uniform(0.05, 0.08), (x, y, 0.04), bush, scale=(1.2, 1.0, 0.75), sub=2), 0.015, 0.05)
        else:
            lib.cyl(name, 0.008, 0.26, (x, y, 0.1), wood, verts=4, rot=(R(rnd.uniform(15, 30)), 0, rnd.uniform(0, 3)))


# ---- things that stand about the compounds (round 2 of replica/art-plan.md)

def mats():
    """The materials the props share, made once a scene."""
    return dict(
        straw=lib.mat("straw", (0.82, 0.70, 0.38), 0.95, grain=0.4, grain_size=0.01),
        hay=lib.mat("hay", (0.86, 0.74, 0.40), 0.95, grain=0.4, grain_size=0.01),
        wood=lib.mat("wood", (0.40, 0.25, 0.12), 0.8),
        log=lib.mat("logbark", (0.36, 0.26, 0.16), 0.95, grain=0.4, grain_size=0.01),
        cut=lib.mat("logend", (0.70, 0.56, 0.36), 0.9, grain=0.3),
        stone=lib.mat("cutstone", (0.62, 0.60, 0.56), 0.9, grain=0.25),
        rope=lib.mat("rope", (0.62, 0.52, 0.34), 0.95),
        water=lib.mat("troughwater", (0.24, 0.40, 0.46), 0.15),
        bronze=lib.mat("statue", (0.40, 0.33, 0.20), 0.4, metal=0.6, grain=0.1),
        gold=lib.mat("ore", (0.80, 0.62, 0.22), 0.5, metal=0.5, grain=0.3, grain_size=0.01),
        hide=lib.mat("hide", (0.56, 0.38, 0.22), 0.9, grain=0.35, grain_size=0.02),
        iron=lib.mat("ironwork", (0.30, 0.30, 0.32), 0.5, metal=0.7),
        fire=lib.mat("flame", (1.0, 0.55, 0.15), 1.0, emit=(1.0, 0.5, 0.1)),
    )


def well(st, x, y, name="well"):
    m = mats()
    lib.cyl(f"{name}-ring", 0.13, 0.15, (x, y, 0.075), m["stone"], verts=16)
    lib.cyl(f"{name}-water", 0.1, 0.01, (x, y, 0.148), lib.mat("wellwater", (0.06, 0.10, 0.12), 0.2), verts=14)
    for dx in (-0.12, 0.12):
        lib.cyl(f"{name}-post{dx}", 0.014, 0.34, (x + dx, y, 0.17), m["wood"], verts=6)
    lib.cyl(f"{name}-beam", 0.012, 0.3, (x, y, 0.33), m["wood"], rot=(0, R(90), 0), verts=6)
    lib.cyl(f"{name}-bucket", 0.03, 0.05, (x, y, 0.25), m["wood"], verts=8)


def dummy(st, x, y, name="dummy"):
    """A straw man on a post to hit at, a crossbar for arms."""
    m = mats()
    lib.cyl(f"{name}-post", 0.015, 0.42, (x, y, 0.21), m["wood"], verts=6)
    lib.cyl(f"{name}-body", 0.055, 0.18, (x, y, 0.3), m["straw"], verts=10)
    lib.ball(f"{name}-head", 0.04, (x, y, 0.44), m["straw"], sub=1)
    lib.cyl(f"{name}-arms", 0.012, 0.26, (x, y, 0.35), m["wood"], rot=(0, R(90), 0), verts=5)


def weapon_rack(st, x, y, name="rack", along_x=True, shields=2):
    """Spears leaning on a rail, and a shield or two in the owner's colour."""
    m = mats()
    for d in (-0.2, 0.2):
        px, py = (x + d, y) if along_x else (x, y + d)
        lib.cyl(f"{name}-post{d}", 0.014, 0.36, (px, py, 0.18), m["wood"], verts=6)
    lib.box(f"{name}-rail", (0.46, 0.025, 0.025) if along_x else (0.025, 0.46, 0.025), (x, y, 0.32), m["wood"])
    for k in range(5):
        t = (k - 2) * 0.08
        px, py = (x + t, y + 0.03) if along_x else (x + 0.03, y + t)
        lib.cyl(f"{name}-spear{k}", 0.008, 0.62, (px, py, 0.3), m["wood"], rot=(R(-8), 0, 0) if along_x else (0, R(8), 0), verts=5)
        lib.cyl(f"{name}-tip{k}", 0.012, 0.05, (px, py - 0.04 if along_x else py, 0.62), m["iron"], verts=4, r2=0.0)
    for k in range(shields):
        t = (k - 0.5) * 0.22
        px, py = (x + t, y - 0.06) if along_x else (x - 0.06, y + t)
        lib.cyl(f"{name}-shield{k}", 0.085, 0.02, (px, py, 0.1), st.team, rot=(R(78), 0, 0) if along_x else (0, R(-78), 0), verts=14)


def horse(name, x, y, facing=0.0, coat=(0.42, 0.28, 0.18)):
    """A horse standing, tied: body, neck and head, four legs, a tail."""
    m = lib.mat(f"horse{coat[0]:.2f}", coat, 0.7, grain=0.2)
    dark = lib.mat("mane", (0.16, 0.12, 0.10), 0.8)
    # Built about the origin and moved after (lib.adopt keeps where a part stands in the world).
    root = lib.empty(name, (0, 0, 0))
    lib.ball(f"{name}-body", 0.1, (0, 0, 0.22), m, parent=root, scale=(1.7, 0.75, 0.8), sub=2)
    for dx in (-0.12, 0.12):
        for dy in (-0.045, 0.045):
            lib.cyl(f"{name}-leg{dx}{dy}", 0.016, 0.18, (dx, dy, 0.09), m, parent=root, verts=6)
    lib.cyl(f"{name}-neck", 0.04, 0.16, (0.17, 0, 0.32), m, parent=root, rot=(0, R(35), 0), verts=8)
    lib.box(f"{name}-head", (0.12, 0.05, 0.05), (0.24, 0, 0.38), m, parent=root, rot=(0, R(30), 0))
    lib.box(f"{name}-mane", (0.12, 0.015, 0.03), (0.16, 0, 0.36), dark, parent=root, rot=(0, R(35), 0))
    lib.cyl(f"{name}-tail", 0.014, 0.14, (-0.19, 0, 0.18), dark, parent=root, rot=(0, R(-25), 0), verts=5)
    root.location = (x, y, 0)
    root.rotation_euler = (0, 0, facing)
    return root


def trough(x, y, name="trough", along_x=True):
    m = mats()
    size = (0.36, 0.1, 0.08) if along_x else (0.1, 0.36, 0.08)
    lib.box(f"{name}", size, (x, y, 0.04), m["wood"], bevel=0.008)
    lib.box(f"{name}-water", (size[0] - 0.03, size[1] - 0.03, 0.01), (x, y, 0.078), m["water"])


def log_pile(x, y, n=6, name="logs", along_x=True, r=0.035, length=0.45):
    """Logs stacked in a pyramid, their cut ends toward the viewer."""
    m = mats()
    k = 0
    for row in range(3):
        for j in range(n - row * 2):
            if j >= n - row * 2:
                break
            off = (j - (n - row * 2 - 1) / 2) * r * 2
            px, py = (x + off, y) if along_x else (x, y + off)
            rot = (R(90), 0, 0) if along_x else (0, R(90), 0)
            lib.cyl(f"{name}{k}", r, length, (px, py, r + row * r * 1.7), m["log"], rot=rot, verts=8)
            k += 1


def stone_blocks(x, y, name="blocks", k=1.0):
    """Cut blocks of stone, stacked two high, `k` their size."""
    m = mats()
    for j, (dx, dy, dz) in enumerate(((0, 0, 0), (0.16, 0, 0), (0.08, 0.02, 0.1), (-0.14, 0.1, 0), (0.3, 0.08, 0), (0.22, 0.04, 0.1))):
        lib.box(f"{name}{j}", (0.15 * k, 0.11 * k, 0.1 * k), (x + dx * k, y + dy * k, (0.05 + dz) * k), m["stone"], bevel=0.01, rot=(0, 0, dx * 0.6))


def ore_heap(x, y, name="ore", r=0.17):
    m = mats()
    o = lib.cyl(f"{name}", r, r * 0.85, (x, y, r * 0.42), m["gold"], verts=14, r2=r * 0.18)
    lib.lumpy(o, r * 0.12, r * 0.3)
    for k in range(6):
        lib.ball(f"{name}-nugget{k}", r * 0.15, (x + r * 0.95 * math.cos(k * 1.1), y + r * 0.95 * math.sin(k * 1.1), r * 0.12), m["gold"], sub=1)


def hide_rack(x, y, name="hiderack"):
    """A hide stretched on a frame of poles to dry."""
    m = mats()
    for d in (-0.15, 0.15):
        lib.cyl(f"{name}-pole{d}", 0.012, 0.4, (x + d, y, 0.2), m["wood"], verts=5)
    lib.cyl(f"{name}-bar", 0.01, 0.34, (x, y, 0.38), m["wood"], rot=(0, R(90), 0), verts=5)
    lib.box(f"{name}-hide", (0.26, 0.012, 0.28), (x, y, 0.22), m["hide"], rot=(R(6), 0, 0))


def crane(st, x, y, h=0.9, name="crane"):
    """A wooden crane: a mast, a boom leaning out, a rope with a stone hanging from it."""
    m = mats()
    lib.cyl(f"{name}-mast", 0.025, h, (x, y, h / 2), m["wood"], verts=6)
    lib.cyl(f"{name}-boom", 0.018, 0.7, (x + 0.24, y - 0.12, h - 0.1), m["wood"], rot=(R(-35), R(55), 0), verts=6)
    lib.cyl(f"{name}-rope", 0.004, 0.42, (x + 0.48, y - 0.24, h - 0.4), m["rope"], verts=4)
    lib.box(f"{name}-load", (0.12, 0.1, 0.08), (x + 0.48, y - 0.24, h - 0.64), m["stone"], bevel=0.01)
    for d in (-0.14, 0.14):
        lib.cyl(f"{name}-leg{d}", 0.015, 0.35, (x + d, y + 0.1, 0.12), m["wood"], rot=(R(30), R(d * 120), 0), verts=5)


def catapult_frame(st, x, y, name="catapult", done=0.6):
    """A stone thrower half built: its base of beams, the uprights, the arm lying across them, a wheel
    leaning by it."""
    m = mats()
    for d in (-0.12, 0.12):
        lib.box(f"{name}-side{d}", (0.6, 0.05, 0.05), (x, y + d, 0.05), m["wood"])
    for d in (-0.22, 0.0, 0.22):
        lib.box(f"{name}-cross{d}", (0.05, 0.3, 0.04), (x + d, y, 0.08), m["wood"])
    if done > 0.4:
        for d in (-0.12, 0.12):
            lib.box(f"{name}-up{d}", (0.05, 0.05, 0.32), (x + 0.05, y + d, 0.24), m["wood"])
        lib.box(f"{name}-axle", (0.05, 0.3, 0.05), (x + 0.05, y, 0.38), m["wood"])
    lib.cyl(f"{name}-arm", 0.022, 0.7, (x - 0.1, y, 0.14), m["wood"], rot=(0, R(80), 0), verts=6)
    lib.cyl(f"{name}-wheel", 0.12, 0.03, (x + 0.42, y - 0.2, 0.12), m["wood"], rot=(R(80), 0, 0), verts=12)
    for k in range(3):
        lib.ball(f"{name}-shot{k}", 0.04, (x - 0.35 + k * 0.09, y - 0.25, 0.04), m["stone"], sub=1)


def sphinx(st, x, y, name="sphinx", facing=-math.pi / 2):
    """A small sphinx on a plinth: a lion's body lying, a man's head with a headdress."""
    m = st.trim
    root = lib.empty(name, (0, 0, 0))
    lib.box(f"{name}-plinth", (0.3, 0.14, 0.06), (0, 0, 0.03), m, parent=root)
    lib.ball(f"{name}-body", 0.06, (-0.03, 0, 0.1), m, parent=root, scale=(2.0, 0.9, 0.7), sub=1)
    lib.box(f"{name}-paws", (0.1, 0.08, 0.03), (0.1, 0, 0.075), m, parent=root)
    lib.box(f"{name}-head", (0.06, 0.06, 0.08), (0.08, 0, 0.16), m, parent=root)
    root.location = (x, y, 0)
    root.rotation_euler = (0, 0, facing + math.pi / 2)


def rider_statue(st, x, y, name="rider"):
    """A rider on a horse, of bronze, on a stone plinth."""
    m = mats()
    lib.box(f"{name}-plinth", (0.3, 0.16, 0.2), (x, y, 0.1), st.trim, bevel=0.01)
    h = horse(f"{name}-horse", x, y, facing=0.0, coat=(0.40, 0.33, 0.20))
    h.location = (x, y, 0.2)
    lib.cyl(f"{name}-body", 0.03, 0.14, (x, y, 0.5), m["bronze"], verts=8)
    lib.ball(f"{name}-head", 0.025, (x, y, 0.6), m["bronze"], sub=1)


def altar(st, x, y, name="altar"):
    """A stone altar with a fire on it."""
    m = mats()
    lib.box(f"{name}", (0.18, 0.14, 0.16), (x, y, 0.08), st.trim, bevel=0.01)
    lib.ball(f"{name}-fire", 0.05, (x, y, 0.2), m["fire"], scale=(1, 1, 1.4), sub=1)


def censer(st, x, y, name="censer"):
    """A bronze incense burner on three legs, smoke above it."""
    m = mats()
    for k in range(3):
        a = k * 2 * math.pi / 3
        lib.cyl(f"{name}-leg{k}", 0.01, 0.1, (x + 0.05 * math.cos(a), y + 0.05 * math.sin(a), 0.05), m["bronze"], verts=4)
    lib.ball(f"{name}-bowl", 0.08, (x, y, 0.14), m["bronze"], scale=(1, 1, 0.7), sub=2)
    lib.cyl(f"{name}-lid", 0.05, 0.06, (x, y, 0.22), m["bronze"], verts=8, r2=0.01)


def tc_yard(st):
    """The front yard of a Town Center (round 2 of the plan): what each architecture has there, age by age, at
    the front corners so the hall stays in view."""
    a, i = getattr(st, "arch", "default"), getattr(st, "i", 1)
    L, Rt = (-1.02, -1.0), (0.98, -0.98)
    log_pile(0.55, -1.15, 4, "tc-logs")
    if i == 1 or a == "default":
        well(st, *L, "tc-well")
    if a == "egyptian":
        if i >= 2:
            rim = st.trim
            lib.box("tc-poolrim", (0.5, 0.36, 0.06), (Rt[0], Rt[1], 0.03), rim)
            lib.box("tc-pool", (0.42, 0.28, 0.02), (Rt[0], Rt[1], 0.06), lib.mat("poolwater", (0.18, 0.34, 0.40), 0.15))
            papyrus("tc-papyrus", Rt[0] - 0.2, Rt[1] + 0.15)
            sphinx(st, L[0] + 0.05, L[1] + 0.05, "tc-sphinx")
        if i >= 3:
            for k, x in enumerate((-0.62, 0.62)):
                arch.obelisk(st, f"tc-obelisk{k}", x, -1.18, 0.7)
    elif a == "babylonian":
        if i >= 2:
            landmarks_ziggurat = __import__("landmarks").ziggurat
            landmarks_ziggurat(st, "tc-terrace", Rt[0], Rt[1], 0.5, 2, 0.12, shrine=False)
        if i >= 3:
            bush = lib.mat("bush", (0.26, 0.38, 0.18), 0.9, grain=0.35, grain_size=0.02)
            for k in range(6):
                lib.lumpy(lib.ball(f"tc-roofgarden{k}", 0.08, (-0.7 + k * 0.32, -0.32, 0.98), bush, scale=(1.2, 1, 0.7), sub=2), 0.02, 0.05)
            arch.palm(st, "tc-palm", L[0], L[1] + 0.1, 0.85)
    elif a == "asian":
        if i >= 2:
            censer(st, 0.62, -0.78, "tc-censer")
        if i >= 3:
            rim = lib.mat("pondstone", (0.50, 0.48, 0.44), 0.95, grain=0.3)
            pond("tc-pond", Rt[0], Rt[1], 0.3, rim)
            for k, x in enumerate((-0.85, 0.85)):
                lib.cyl(f"tc-sidepost{k}a", 0.035, 0.5, (x - 0.12, -1.1, 0.25), st.trim, verts=8)
                lib.cyl(f"tc-sidepost{k}b", 0.035, 0.5, (x + 0.12, -1.1, 0.25), st.trim, verts=8)
                arch.asian_roof(st, f"tc-sideroof{k}", x, -1.1, 0.24, 0.08, 0.5)
    elif a == "greek":
        if i == 2:
            fountain(st, Rt[0], Rt[1], "tc-fountain")
        if i >= 3:
            altar(st, L[0] + 0.05, L[1] + 0.05, "tc-hearth")
            arch.statue(st, "tc-statue", Rt[0], Rt[1], 0.45)
            cypress = lib.mat("cypress", (0.20, 0.34, 0.20), 0.8, grain=0.3, grain_size=0.02)
            for k, x in enumerate((-0.55, 0.55)):
                lib.cyl(f"tc-cypress{k}", 0.07, 0.7, (x, -1.2, 0.35), cypress, verts=10, r2=0.02)
    elif a == "roman":
        if i >= 2:
            fountain(st, Rt[0], Rt[1], "tc-fountain")
        if i >= 3:
            rider_statue(st, L[0] + 0.05, L[1] + 0.05, "tc-rider")
            colonnade(st, (-0.6, -0.82), (0.6, -0.82), 0.5, 5, "tc-forum")
            lib.box("tc-forumbeam", (1.3, 0.1, 0.06), (0, -0.82, 0.53), st.trim)


# ---- houses and granaries of each architecture (round 4 of replica/art-plan.md)

def thatch_roof(name, w, d, h, loc, along="x"):
    """A thatched gable, lumpy, of straw in streaks."""
    m = lib.mat("thatchroof", (0.66, 0.54, 0.30), 0.95, grain=0.4, grain_size=0.01, kind=("thatch", 0.05, 0, 0.5))
    o = prism(name, w, d, h, loc, m, along)
    lib.lumpy(o, 0.012, 0.04)
    return o


def side_stair(st, x, y, h, name="stair", n=5, along_x=True):
    """Steps up the outside of a wall to a flat roof."""
    for k in range(n):
        t = k / n
        size = (0.12, 0.12, h * (k + 1) / n)
        loc = (x + t * 0.5, y, size[2] / 2) if along_x else (x, y + t * 0.5, size[2] / 2)
        lib.box(f"{name}{k}", size, loc, st.wall)


def house_yard(st, x0, y0, x1, y1, h=0.18, name="hyard"):
    """A low wall round a house's yard, open at the front."""
    m = st.wall
    lib.box(f"{name}-back", (x1 - x0, 0.05, h), ((x0 + x1) / 2, y1, h / 2), m)
    lib.box(f"{name}-left", (0.05, y1 - y0, h), (x0, (y0 + y1) / 2, h / 2), m)
    lib.box(f"{name}-right", (0.05, y1 - y0, h * 0.8), (x1, (y0 + y1) / 2, h * 0.4), m)


def house_arch(st, a):
    """A house of an architecture in an age: see replica/art-plan.md, House."""
    i = st.i
    m = mats()
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    if a == "egyptian":
        h = 0.42 + 0.06 * i
        hall(st, "house", 0, 0.15, 1.0, 0.85, h, roof="flat")
        door(st, 0.1, -0.28, 0.2, 0.3)
        side_stair(st, -0.62, -0.2, h, "stair", along_x=False)
        if i >= 2:
            columns(st, -0.3, 0.4, -0.45, h * 0.8, 3, r=0.03)
            lib.box("porchroof", (0.85, 0.3, 0.04), (0.05, -0.42, h * 0.82), st.wood)
        if i >= 3:
            hall(st, "upper", -0.2, 0.3, 0.55, 0.5, h + 0.32, roof="flat")
            house_yard(st, -0.9, -0.85, 0.9, 0.75)
    elif a == "babylonian":
        if i == 1:
            # A reed house (mudhif): a vault of reed bundles over arched ribs, the ends latticed.
            reed = lib.mat("reed", (0.74, 0.62, 0.36), 0.95, grain=0.35, grain_size=0.008, kind=("thatch", 0.03, 0, 0.45))
            lib.cyl("vault", 0.42, 1.1, (0, 0.15, 0.06), reed, rot=(0, R(90), 0), verts=20)
            lib.box("vaultfloor", (1.12, 0.86, 0.08), (0, 0.15, 0.04), reed)
            for k in range(6):
                lib.cyl(f"rib{k}", 0.43, 0.03, (-0.5 + k * 0.2, 0.15, 0.06), lib.mat("reedrib", (0.56, 0.46, 0.26), 0.9), rot=(0, R(90), 0), verts=20)
            lib.box("reeddoor", (0.2, 0.02, 0.28), (0.56, 0.15, 0.14), st.dark, rot=(0, 0, R(90)))
        else:
            h = 0.48 + 0.05 * i
            hall(st, "house", 0, 0.2, 1.0, 0.8, h)
            door(st, 0.1, -0.21, 0.2, 0.3)
            house_yard(st, -0.9, -0.85, 0.9, 0.8)
            if i >= 3:
                well(st, -0.55, -0.45, "hwell")
    elif a == "asian":
        if i == 1:
            # On stilts of bamboo, a thatched roof.
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1), (0, -1), (0, 1)):
                lib.cyl(f"stilt{dx}{dy}", 0.025, 0.28, (dx * 0.45, 0.15 + dy * 0.32, 0.14), lib.mat("bamboo", (0.48, 0.58, 0.26), 0.7, grain=0.2), verts=6)
            lib.box("floor", (1.0, 0.75, 0.05), (0, 0.15, 0.3), m["wood"])
            lib.box("walls", (0.9, 0.65, 0.3), (0, 0.15, 0.47), lib.mat("bamboowall", (0.70, 0.62, 0.42), 0.9, grain=0.3, kind=("thatch", 0.025, 0, 0.35)))
            thatch_roof("roof", 1.15, 0.9, 0.38, (0, 0.15, 0.62))
            lib.box("ladder", (0.1, 0.02, 0.34), (0.2, -0.27, 0.16), m["wood"], rot=(R(20), 0, 0))
        else:
            hall(st, "house", 0, 0.15, 1.0, 0.8, 0.45)
            door(st, 0.1, -0.26, 0.2, 0.3)
            if i >= 3:
                hall(st, "upper", 0, 0.25, 0.65, 0.5, 0.9)
            bamboo("hbamboo", -0.75, 0.6, 5, 0.6)
            fence = lib.mat("bamboo", (0.48, 0.58, 0.26), 0.7, grain=0.2)
            for k in range(9):
                lib.cyl(f"fence{k}", 0.012, 0.2, (-0.85 + k * 0.1, -0.85, 0.1), fence, verts=4)
            lib.ball("waterjar", 0.07, (0.65, -0.55, 0.07), clay, scale=(1, 1, 1.1), sub=2)
    elif a == "greek":
        if i == 1:
            rubble = lib.mat("rubble", (0.58, 0.54, 0.48), 0.95, grain=0.35, kind=("brick", 0.09, 0.07, 0.6))
            lib.box("walls", (1.0, 0.8, 0.42), (0, 0.15, 0.21), rubble, bevel=0.02)
            thatch_roof("roof", 1.15, 0.95, 0.32, (0, 0.15, 0.42))
            door(st, 0.1, -0.26, 0.2, 0.3)
        else:
            hall(st, "house", 0, 0.2, 1.0, 0.75, 0.48)
            door(st, 0.1, -0.18, 0.2, 0.3)
            house_yard(st, -0.9, -0.85, 0.9, 0.8)
            if i >= 3:
                columns(st, -0.35, 0.35, -0.3, 0.42, 3, r=0.03)
                well(st, -0.55, -0.5, "hwell")
    else:  # roman
        if i == 1:
            lib.box("walls", (1.0, 0.8, 0.42), (0, 0.15, 0.21), st.wall, bevel=0.02)
            thatch_roof("roof", 1.15, 0.95, 0.32, (0, 0.15, 0.42))
            door(st, 0.1, -0.26, 0.2, 0.3)
        elif i == 2:
            hall(st, "house", 0, 0.15, 1.05, 0.85, 0.48)
            arch.arch_door(st, 0.1, -0.29, 0.2, 0.32)
        else:
            # A house round an atrium open to the sky, a pool under the opening, pots of flowers.
            w, d, h = 1.3, 1.1, 0.46
            for k, (size, loc) in enumerate((((w, 0.3, h), (0, 0.55, h / 2)), ((0.3, d, h), (-0.5, 0.1, h / 2)),
                                              ((0.3, d, h), (0.5, 0.1, h / 2)), ((w, 0.25, h), (0, -0.33, h / 2)))):
                lib.box(f"wing{k}", size, loc, st.wall, bevel=0.01)
            for k, (pw, pd, loc, along) in enumerate(((w + 0.1, 0.4, (0, 0.55, h), "x"), (w + 0.1, 0.35, (0, -0.33, h), "x"))):
                prism(f"atriumroof{k}", pw, pd, 0.16, loc, st.roof, along)
            lib.box("impluvium", (0.3, 0.25, 0.02), (0, 0.1, 0.02), lib.mat("poolwater", (0.18, 0.34, 0.40), 0.15))
            arch.arch_door(st, 0.0, -0.46, 0.2, 0.3)
            for k, x in enumerate((-0.45, 0.45)):
                lib.cyl(f"flowerpot{k}", 0.05, 0.08, (x, -0.6, 0.04), clay, verts=10)
                lib.ball(f"flowers{k}", 0.06, (x, -0.6, 0.12), lib.mat("flowers", (0.70, 0.30, 0.36), 0.8), sub=1)
    banner(st, -0.3, -0.32 if a != "roman" or i < 3 else -0.47, 0.3, 0.1, 0.13)
    # A few things of the household by the door.
    for k in range(2):
        lib.ball(f"hjar{k}", 0.04, (0.55 + k * 0.08, -0.62, 0.05), clay, scale=(1, 1, 1.3), sub=1)
    lib.box("hcrate", (0.08, 0.08, 0.07), (-0.6, -0.65, 0.035), m["wood"], bevel=0.006)


def beehive(st, name, x, y, r=0.24, h=0.6, ladder=True):
    """A silo of mud brick shaped like a beehive, a hatch near the top and a ladder to it."""
    lib.ball(f"{name}", r, (x, y, h * 0.42), st.wall, scale=(1, 1, h / (r * 1.6)), sub=3)
    lib.box(f"{name}-hatch", (0.07, 0.02, 0.07), (x, y - r * 0.9, h * 0.72), st.dark)
    if ladder:
        lib.box(f"{name}-ladder", (0.07, 0.02, h * 0.8), (x + 0.04, y - r - 0.06, h * 0.4), mats()["wood"], rot=(R(18), 0, 0))


def granary_arch(st, a):
    """A granary of an architecture in an age: see replica/art-plan.md, Granary."""
    i = st.i
    m = mats()
    # The drying floor before it, sacks, baskets of grain, a hand mill, a cart.
    court("dryfloor", 1.4, 0.8, (0.35, -0.75, 0.01))
    grain_m = lib.mat("grainheap", (0.86, 0.72, 0.40), 0.95, grain=0.3, grain_size=0.01)
    for k in range(3):
        lib.cyl(f"grainpile{k}", 0.12, 0.08, (0.05 + k * 0.3, -0.75, 0.05), grain_m, verts=12, r2=0.02)
    sack = lib.mat("sack", (0.74, 0.66, 0.50), 1.0, grain=0.3)
    for k in range(4):
        lib.ball(f"gsack{k}", 0.055, (0.95 + (k % 2) * 0.1, -0.45 + (k // 2) * 0.12, 0.05), sack, scale=(1, 1, 1.1), sub=1)
    lib.cyl("quern", 0.07, 0.05, (-0.25, -0.9, 0.03), m["stone"], verts=12)
    lib.cyl("quern2", 0.065, 0.03, (-0.25, -0.9, 0.07), m["stone"], verts=12)
    if a == "egyptian":
        if i >= 3:
            lib.box("silobase", (2.5, 0.9, 0.12), (0.1, 0.5, 0.06), st.trim)
        z = 0.12 if i >= 3 else 0.0
        for k, x in enumerate((-0.85, -0.2, 0.45, 1.05)):
            beehive(st, f"silo{k}", x, 0.5, 0.31, 0.85 + 0.05 * i, ladder=k % 2 == 0)
            if z:
                for o in [ob for ob in lib.bpy.context.scene.objects if ob.name.startswith(f"silo{k}")]:
                    o.location.z += z
    elif a == "babylonian":
        lib.box("platform", (2.5, 1.0, 0.2), (0.0, 0.5, 0.1), st.wall, bevel=0.01)
        if i >= 3:
            hall(st, "store", 0.0, 0.5, 2.1, 0.8, 0.7)
            lib.box("storeglaze", (2.11, 0.81, 0.08), (0.0, 0.5, 0.52), st.accent)
        else:
            for k, x in enumerate((-0.8, 0.0, 0.8)):
                lib.cyl(f"silo{k}", 0.36, 0.42, (x, 0.5, 0.41), st.wall, verts=20)
                lib.ball(f"dome{k}", 0.36, (x, 0.5, 0.62), st.wall, scale=(1, 1, 0.8), sub=3)
    elif a == "asian":
        if i >= 3:
            for k, x in enumerate((-0.65, 0.55)):
                lib.cyl(f"roundstore{k}", 0.42, 0.65, (x, 0.5, 0.33), st.wall, verts=20)
                arch.asian_roof(st, f"rsroof{k}", x, 0.5, 0.7, 0.7, 0.65, tiers=2)
        else:
            # Raised on posts against damp and rats.
            for dx in (-0.95, -0.35, 0.25, 0.85):
                for dy in (0.1, 0.9):
                    lib.cyl(f"stilt{dx}{dy}", 0.04, 0.36, (dx, dy, 0.18), m["wood"], verts=6)
            lib.box("floor", (2.0, 0.95, 0.06), (-0.05, 0.5, 0.38), m["wood"])
            lib.box("store", (1.85, 0.85, 0.5), (-0.05, 0.5, 0.66), st.wall, bevel=0.01)
            lib.box("storeladder", (0.1, 0.02, 0.4), (0.4, -0.03, 0.2), m["wood"], rot=(R(18), 0, 0))
            if i == 1:
                thatch_roof("roof", 2.1, 1.1, 0.48, (-0.05, 0.5, 0.91))
            else:
                arch.asian_roof(st, "roof", -0.05, 0.5, 1.85, 0.85, 0.91)
    elif a == "greek":
        hall(st, "store", -0.35, 0.55, 1.6, 0.85, 0.7)
        if i >= 3:
            columns(st, -1.05, 0.35, 0.05, 0.62, 6)
        clayjar = lib.mat("pithos", (0.66, 0.40, 0.26), 0.85, grain=0.2)
        for k, (x, y) in enumerate(((0.75, 0.75), (1.05, 0.5), (0.8, 0.25), (1.1, 0.95), (0.55, 0.45))):
            lib.ball(f"pithos{k}", 0.16, (x, y, 0.12), clayjar, scale=(1, 1, 1.25), sub=2)
    else:  # roman: a long storehouse round a court
        hall(st, "horreum", -0.1, 0.85, 2.0, 0.5, 0.55)
        hall(st, "horreum-l", -0.85, 0.15, 0.5, 0.9, 0.5, along="y")
        for k in range(4):
            arch.arch_door(st, -0.85 + k * 0.5, 0.59, 0.16, 0.3)
        lib.box("cart", (0.34, 0.2, 0.07), (0.6, -0.3, 0.13), m["wood"], bevel=0.01)
        for dy in (-0.12, 0.12):
            lib.cyl(f"wheel{dy}", 0.085, 0.025, (0.6, -0.3 + dy, 0.085), m["wood"], rot=(R(90), 0, 0), verts=12)
        for k in range(3):
            lib.ball(f"cartsack{k}", 0.05, (0.5 + k * 0.1, -0.3, 0.2), sack, scale=(1, 1, 1.1), sub=1)
    flag(st, 1.2, -1.2, 0.8)


# ---- statues and trees of round 5

def cypress(name, x, y, h=0.75):
    m = lib.mat("cypress", (0.20, 0.34, 0.20), 0.8, grain=0.3, grain_size=0.02)
    lib.cyl(name, 0.07, h, (x, y, h / 2), m, verts=10, r2=0.02)


def goddess(st, x, y, name="goddess", kind="greek", k=1.6):
    """A goddess of the hunt with her bow, standing on a plinth: Greek (a chiton, as Artemis is shown) or
    Egyptian (a sheath dress and a crown, as Neith is shown). `k` her size: at 1 she was lost in the yard."""
    stone = lib.mat("statuestone", (0.82, 0.78, 0.70), 0.7, grain=0.15) if kind == "greek" else st.trim
    m = mats()
    lib.box(f"{name}-plinth", (0.22 * k, 0.22 * k, 0.2 * k), (x, y, 0.1 * k), st.trim, bevel=0.01)
    lib.cyl(f"{name}-robe", 0.07 * k, 0.36 * k, (x, y, (0.2 + 0.18) * k), stone, verts=12, r2=0.045 * k)
    lib.cyl(f"{name}-chest", 0.05 * k, 0.12 * k, (x, y, 0.62 * k), stone, verts=10)
    lib.ball(f"{name}-head", 0.04 * k, (x, y, 0.72 * k), stone, sub=1)
    if kind == "egyptian":
        lib.cyl(f"{name}-crown", 0.035 * k, 0.08 * k, (x, y, 0.79 * k), st.accent2 if hasattr(st, "accent2") else stone, verts=8, r2=0.025 * k)
    else:
        lib.ball(f"{name}-hair", 0.035 * k, (x, y + 0.02 * k, 0.75 * k), stone, sub=1)
    lib.cyl(f"{name}-bow", 0.008 * k, 0.42 * k, (x + 0.09 * k, y - 0.02 * k, 0.56 * k), m["wood"] if kind == "egyptian" else stone, rot=(0, R(8), 0), verts=5)
    lib.cyl(f"{name}-arm", 0.016 * k, 0.16 * k, (x + 0.06 * k, y, 0.6 * k), stone, rot=(0, R(60), 0), verts=6)


def seated_colossus(st, x, y, name="colossus"):
    """A king seated on his throne, in stone, his hands on his knees, a headdress."""
    m = st.trim
    lib.box(f"{name}-throne", (0.22, 0.24, 0.32), (x, y + 0.04, 0.16), m, bevel=0.01)
    lib.box(f"{name}-lap", (0.2, 0.2, 0.06), (x, y - 0.06, 0.34), m)
    lib.box(f"{name}-body", (0.16, 0.12, 0.26), (x, y + 0.02, 0.48), m)
    lib.box(f"{name}-head", (0.1, 0.1, 0.1), (x, y + 0.02, 0.66), m)
    lib.box(f"{name}-headdress", (0.14, 0.06, 0.12), (x, y + 0.04, 0.64), getattr(st, "accent", m))


def buddha(st, x, y, name="buddha", size=1.0):
    """A seated Buddha on a lotus throne, gilded."""
    gold = lib.mat("gilt", (0.86, 0.68, 0.30), 0.35, metal=0.8)
    stone = lib.mat("lotusstone", (0.62, 0.60, 0.56), 0.9)
    k = size
    lib.cyl(f"{name}-plinth", 0.3 * k, 0.16 * k, (x, y, 0.08 * k), stone, verts=16)
    lib.cyl(f"{name}-lotus", 0.26 * k, 0.08 * k, (x, y, 0.2 * k), lib.mat("lotuspink", (0.78, 0.52, 0.52), 0.8), verts=16, r2=0.3 * k)
    lib.ball(f"{name}-legs", 0.2 * k, (x, y, 0.3 * k), gold, scale=(1.2, 0.9, 0.45), sub=2)
    lib.cyl(f"{name}-body", 0.12 * k, 0.32 * k, (x, y + 0.02 * k, 0.48 * k), gold, verts=12, r2=0.09 * k)
    lib.ball(f"{name}-head", 0.08 * k, (x, y + 0.02 * k, 0.72 * k), gold, sub=2)
    lib.ball(f"{name}-knot", 0.035 * k, (x, y + 0.02 * k, 0.81 * k), gold, sub=1)
    lib.cyl(f"{name}-halo", 0.16 * k, 0.015 * k, (x, y + 0.08 * k, 0.72 * k), gold, rot=(R(90), 0, 0), verts=20)


def arched_gate(st, x, y, w=0.7, h=0.75, name="archgate"):
    """A gate of stone with a round-headed arch through it, a banner on each pier."""
    lib.box(f"{name}-block", (w + 0.3, 0.2, h), (x, y, h / 2), st.wall, bevel=0.01)
    lib.box(f"{name}-cap", (w + 0.36, 0.24, 0.05), (x, y, h + 0.025), st.trim)
    arch.arch_door(st, x, y - 0.11, w * 0.6, h * 0.75)
    for sx in (-1, 1):
        lib.box(f"{name}-banner{sx}", (0.09, 0.012, 0.18), (x + sx * (w / 2 + 0.06), y - 0.11, h * 0.62), st.team)


# ---- the buildings. Each takes a Style.

def town_center(st):
    # The Stone Age's is stoneage.town_center (see BUILDERS).
    if st.age == "tool":
        ground(3)
        hall(st, "main", -0.2, 0.2, 1.7, 1.5, 0.6, along="x")
        hall(st, "wing", 0.8, -0.55, 0.9, 0.9, 0.45, along="y")
        door(st, -0.2, -0.56, 0.3, 0.42)
        palisade(st, -1.4, -1.4, -1.4, 1.4)
        palisade(st, -1.4, 1.4, 1.4, 1.4)
        flag(st, -0.2, 0.2, 1.45)
        banner(st, 0.5, -0.56, 0.32)
        tc_yard(st)
        return
    ground(3, (0.62, 0.58, 0.50))
    base = steps(st, -0.15, 0.15, 2.0, 1.9)
    lib.box("plinth", (2.0, 1.9, 0.02), (-0.15, 0.15, base), st.trim)
    top = hall(st, "main", -0.15, 0.15, 1.8, 1.7, 0.75 if st.age == "bronze" else 0.85, roof="gable" if st.age == "iron" else "flat", along="x")
    columns(st, -0.95, 0.65, -0.82, 0.75 if st.age == "bronze" else 0.85, 5 if st.age == "iron" else 4)
    door(st, -0.15, -0.71, 0.36, 0.5)
    hall(st, "tower", 0.95, 0.95, 0.6, 0.6, 1.0 if st.age == "iron" else 0.8, roof="flat")
    flag(st, 0.95, 0.95, (1.0 if st.age == "iron" else 0.8) + 0.5)
    tc_yard(st)
    banner(st, -0.75, -0.72, 0.5)
    banner(st, 0.45, -0.72, 0.5)


def house(st):
    if st.age == "stone":
        models.house()
        return
    ground(2)
    a = getattr(st, "arch", "default")
    if a != "default":
        return house_arch(st, a)
    if st.age == "tool":
        hall(st, "house", 0, 0.1, 1.2, 1.0, 0.45, along="x")
        door(st, 0.1, -0.41, 0.22, 0.32)
        lib.box("woodpile", (0.3, 0.12, 0.1), (-0.6, -0.6, 0.05), st.wood, bevel=0.02)
    elif st.age == "bronze":
        hall(st, "house", 0, 0.1, 1.2, 1.1, 0.55, roof="flat")
        hall(st, "upper", -0.25, 0.3, 0.6, 0.6, 0.85, roof="flat")
        door(st, 0.15, -0.46, 0.22, 0.34)
    else:
        hall(st, "house", 0, 0.1, 1.3, 1.1, 0.6, along="x")
        door(st, 0.15, -0.46, 0.24, 0.36)
        columns(st, -0.5, 0.5, -0.55, 0.5, 3, r=0.035)
    banner(st, -0.3, -0.47 if st.age != "tool" else -0.41, 0.3, 0.12, 0.16)


def granary(st):
    ground(3)
    a = getattr(st, "arch", "default")
    if a != "default":
        return granary_arch(st, a)
    if st.thatch:
        # Stores raised on posts out of the damp, and a thatched hall.
        for i, (x, y) in enumerate(((-0.7, 0.6), (0.2, 0.75), (0.85, 0.0))):
            for dx, dy in ((-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2)):
                lib.cyl(f"stilt{i}{dx}{dy}", 0.03, 0.25, (x + dx, y + dy, 0.125), st.wood, verts=6)
            hut = lib.cyl(f"store{i}", 0.3, 0.35, (x, y, 0.42), st.wall, verts=20)
            r = lib.cyl(f"storeroof{i}", 0.38, 0.35, (x, y, 0.77), st.roof, verts=20, r2=0.02)
            lib.lumpy(r, 0.012, 0.04)
        hall(st, "hall", -0.3, -0.5, 1.2, 0.8, 0.45, along="x")
        door(st, -0.3, -0.91, 0.25, 0.32)
        for k in range(4):
            lib.cyl(f"sack{k}", 0.07, 0.12, (0.5 + 0.15 * k, -0.95, 0.06), lib.mat("sack", (0.80, 0.70, 0.48), 0.9), verts=10, r2=0.05)
    else:
        # Domed silos round a yard.
        for i, (x, y) in enumerate(((-0.75, 0.75), (0.2, 0.85), (-0.85, -0.2), (0.85, 0.1))):
            lib.cyl(f"silo{i}", 0.34, 0.5, (x, y, 0.25), st.wall, verts=24)
            lib.ball(f"dome{i}", 0.34, (x, y, 0.5), st.roof if st.age == "iron" else st.wall, scale=(1, 1, 0.8), sub=3)
        hall(st, "hall", 0.1, -0.55, 1.2, 0.7, 0.5, roof="flat")
        door(st, 0.1, -0.91, 0.25, 0.34)
    flag(st, 1.2, -1.2, 0.8)


def storage_pit(st):
    """A storage yard of the plan's round 2, open, not a closed house: a lean-to on posts over the stacks,
    logs, cut stone, a heap of gold ore, hides on frames to dry; a low wall and a crane from the Bronze Age;
    a Roman ox cart with stone."""
    a = getattr(st, "arch", "default")
    ground(3, (0.42, 0.33, 0.22))
    m = mats()
    # The lean-to: posts and a roof of one slope; reed mats for the Egyptians, the age's roof otherwise.
    roof = lib.mat("reedmat", (0.74, 0.62, 0.38), 0.95, grain=0.35, grain_size=0.008, kind=("thatch", 0.03, 0, 0.4)) if a == "egyptian" or st.thatch else st.roof
    for k, (x, y) in enumerate(((-1.1, 0.4), (-0.1, 0.4), (0.9, 0.4), (-1.1, 1.05), (-0.1, 1.05), (0.9, 1.05))):
        if a == "asian":
            lib.box(f"post{k}", (0.05, 0.05, 0.6), (x, y, 0.3), st.trim)
        else:
            lib.cyl(f"post{k}", 0.03, 0.6, (x, y, 0.3), m["wood"] if (st.thatch or a in ("egyptian", "default")) else st.trim, verts=6)
    lean_to("leanto", -0.1, 0.72, 2.2, 0.85, 0.62, roof)
    # Under the lean-to, logs; out in the yard, where they show: more logs, cut stone, gold ore, hides.
    log_pile(-0.65, 0.75, 6, "logs-a", r=0.05, length=0.6)
    log_pile(0.4, 0.75, 5, "logs-b", r=0.05, length=0.6)
    log_pile(0.55, -0.15, 7, "logs-c", r=0.055, length=0.7)
    stone_blocks(-0.85, -0.45, "blocks", k=1.6)
    ore_heap(-0.1, -0.2, "ore", r=0.28)
    for k, x in enumerate((0.85, 1.12)):
        hide_rack(x, -0.75 + k * 0.1, f"hide{k}")
    if st.age in ("bronze", "iron"):
        enclosure(st, 1.3, 0.24, (-0.35, 0.35), name="pwall", crenel=a == "babylonian")
        crane(st, -0.2, -0.6, 0.9, "crane")
    if a == "roman":
        lib.box("cart", (0.34, 0.2, 0.07), (0.7, -0.95, 0.13), m["wood"], bevel=0.01)
        for dy in (-0.12, 0.12):
            lib.cyl(f"wheel{dy}", 0.085, 0.025, (0.7, -0.95 + dy, 0.085), m["wood"], rot=(R(90), 0, 0), verts=12)
        lib.box("cartstone", (0.14, 0.1, 0.08), (0.7, -0.95, 0.21), m["stone"], bevel=0.01)
    flag(st, 1.15, 1.1, 0.8)


def barracks(st):
    """A barracks of the plan's round 2: walls round a drill yard, the soldiers' hall at the back and a second
    along the left wall, straw men to hit, racks of spears and shields, a target for javelins. Each
    architecture's way: Egyptian pylons at the gate from the Bronze Age, Babylonian battlements, Asian halls
    and a gate of two roofs in the Iron Age, a Greek sand court with a colonnade, a Roman camp of rows of
    huts and a standard."""
    a = getattr(st, "arch", "default")
    ground(3)  # The Stone Age's is stoneage.barracks (see BUILDERS).
    wh = 0.32 if st.age == "tool" else 0.4
    enclosure(st, 1.3, wh, (-0.3, 0.3), name="bwall", crenel=a == "babylonian",
              towers=(0.18 if st.age == "bronze" else 0.28) if a in ("egyptian", "roman") and st.age != "tool" else 0.0)
    # The gate.
    if a == "egyptian" and st.age != "tool":
        for k, x in enumerate((-0.42, 0.42)):
            arch.tapered(f"pylon{k}", 0.24, 0.22, 0.66, (x, -1.3, 0.0), st.wall, top=0.8)
            lib.box(f"pylonband{k}", (0.22, 0.23, 0.04), (x, -1.3, 0.56), st.accent)
            lib.box(f"pylonbanner{k}", (0.1, 0.012, 0.18), (x, -1.42, 0.4), st.team)
    elif a == "asian" and st.age == "iron":
        for k, x in enumerate((-0.32, 0.32)):
            lib.box(f"gatepost{k}", (0.07, 0.07, 0.6), (x, -1.3, 0.3), st.trim)
        lib.box("gatebeam", (0.74, 0.08, 0.06), (0, -1.3, 0.58), st.trim)
        arch.asian_roof(st, "gateroof", 0, -1.3, 0.5, 0.12, 0.61, tiers=2)
    else:
        gateway(st, -0.3, 0.3, -1.3, 0.62 if st.age != "tool" else 0.55, name="bgate")
    h = 0.55 if st.age == "tool" else 0.62
    roof = "flat" if (st.age == "bronze" and a == "default") else "gable"
    # Halls: a Roman camp has rows of huts; the others a hall at the back and one along the left wall.
    if a == "roman":
        for k, y in enumerate((0.95, 0.45)):
            hall(st, f"row{k}", -0.25, y, 1.8, 0.36, h * 0.85, along="x")
            for j in range(4):
                door(st, -0.95 + j * 0.45, y - 0.185, 0.14, 0.26)
        # The standard: a pole with discs and a gilded bird at the top.
        m = mats()
        lib.cyl("signum", 0.012, 0.9, (0.75, 0.15, 0.45), m["wood"], verts=6)
        for j in range(3):
            lib.cyl(f"signumdisc{j}", 0.045, 0.015, (0.75, 0.13, 0.55 + j * 0.1), m["gold"], rot=(R(90), 0, 0), verts=12)
        lib.ball("signumbird", 0.04, (0.75, 0.15, 0.94), m["gold"], scale=(1.4, 0.6, 0.8), sub=1)
        lib.box("signumbanner", (0.12, 0.012, 0.1), (0.75, 0.13, 0.48), st.team)
    else:
        hall(st, "hall", 0.1, 0.85, 2.0, 0.65, h, roof=roof, along="x")
        door(st, 0.1, 0.52, 0.3, 0.4)
        hall(st, "bunk", -0.88, -0.2, 0.55, 1.15, h * 0.85, roof=roof, along="y")
        door(st, -0.6, -0.2, 0.22, 0.32, side="right")
    # The yard: sand for the Greek wrestlers' court, earth for the rest.
    if a == "greek":
        sand = lib.mat("sandcourt", (0.80, 0.70, 0.50), 1.0, grain=0.35, grain_size=0.02)
        lib.box("sand", (1.4, 1.1, 0.015), (0.35, -0.35, 0.012), sand)
        if st.age == "iron":
            colonnade(st, (-0.35, 0.4), (1.1, 0.4), 0.45, 5, "gcol")
    else:
        court("yard", 1.6, 1.3, (0.3, -0.35, 0.01))
    for k, (x, y) in enumerate(((0.05, -0.2), (0.45, -0.25), (0.85, -0.2))):
        dummy(st, x, y, f"dummy{k}")
    weapon_rack(st, 0.85, -0.9, "rack-a")
    weapon_rack(st, -0.6, -0.95, "rack-b", shields=1)
    # A javelin target: a board on two legs.
    m = mats()
    lib.box("jtarget", (0.2, 0.03, 0.22), (1.05, 0.25, 0.22), m["straw"])
    for d in (-0.08, 0.08):
        lib.cyl(f"jleg{d}", 0.01, 0.3, (1.05 + d, 0.27, 0.15), m["wood"], verts=4)
    flag(st, 1.15, 1.1, 1.05)


def dock(st):
    """A dock of round 3 of the plan: smaller, a deck on piles with a pier out into the water, nets drying on a
    frame, baskets of fish, a boat tied alongside, a shed of the age; from the Bronze Age each architecture's own
    quay: Egyptian stone with lotus columns and a reed boat, Babylonian brick with glaze and a round coracle,
    an Asian pavilion on piles with lanterns, a Greek quay with a colonnade and jars, a Roman quay with arches
    and a crane."""
    a = getattr(st, "arch", "default")
    m = mats()
    deck = lib.mat("deck", (0.55, 0.38, 0.20), 0.85, grain=0.4, grain_size=0.02, kind=("brick", 0.6, 0.1, 0.5))
    stone = a != "default" and st.age in ("bronze", "iron") and a != "asian"
    quay = st.trim if stone else deck
    # The deck at the back, the pier toward the viewer.
    lib.box("deck", (2.2, 1.2, 0.1), (-0.1, 0.65, 0.12), quay, bevel=0.01)
    lib.box("pier", (0.55, 1.6, 0.08), (0.75, -0.45, 0.1), deck, bevel=0.01)
    piles = [(x, y) for x in (-1.15, -0.1, 0.95) for y in (0.1, 1.2)] + [(0.5, -0.4), (1.0, -0.4), (0.5, -1.2), (1.0, -1.2)]
    for k, (x, y) in enumerate(piles):
        lib.cyl(f"pile{k}", 0.045, 0.32, (x, y, 0.0), m["wood"] if not stone or y < 0 else st.wall, verts=8)
    # The shed or quay house of the age and architecture.
    if a == "asian" and st.age != "tool":
        for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            lib.box(f"pavpost{dx}{dy}", (0.05, 0.05, 0.42), (-0.5 + dx * 0.45, 0.75 + dy * 0.35, 0.38), st.trim)
        arch.asian_roof(st, "pavroof", -0.5, 0.75, 0.9, 0.7, 0.59, tiers=2 if st.age == "iron" else 1)
        arch.lantern(st, "dock-lantern", 0.4, 0.25)
    elif a == "egyptian" and stone:
        columns(st, -1.0, 0.0, 0.3, 0.5, 4)
        lib.box("shade", (1.2, 0.8, 0.05), (-0.5, 0.65, 0.68), st.roof)
        arch.cornice(st, "shadecornice", -0.5, 0.65, 1.15, 0.75, 0.7)
    elif a == "greek" and stone:
        columns(st, -1.0, 0.0, 0.3, 0.5, 5)
        prism("stoaroof", 1.25, 0.85, 0.2, (-0.5, 0.65, 0.68), st.roof, "x")
        for k in range(3):
            lib.ball(f"amphora{k}", 0.04, (0.2 + k * 0.1, 0.3, 0.24), lib.mat("clay", (0.70, 0.40, 0.24), 0.8), scale=(1, 1, 1.6), sub=1)
    elif a == "roman" and stone:
        lib.box("arcade", (1.2, 0.7, 0.5), (-0.5, 0.75, 0.42), st.wall, bevel=0.01)
        for k in range(3):
            arch.arch_door(st, -0.9 + k * 0.4, 0.39, 0.2, 0.36)
        prism("arcaderoof", 1.35, 0.85, 0.22, (-0.5, 0.75, 0.67), st.roof, "x")
        crane(st, 0.3, 0.9, 1.0, "dock-crane")
    elif a == "babylonian" and stone:
        lib.box("quayhouse", (1.0, 0.7, 0.45), (-0.5, 0.75, 0.39), st.wall, bevel=0.01)
        lib.box("quayglaze", (1.01, 0.71, 0.07), (-0.5, 0.75, 0.5), st.accent)
        arch.crenels(st, "quaytop", -0.5, 0.75, 1.0, 0.7, 0.62, size=0.08)
        arch.arch_door(st, -0.5, 0.39, 0.2, 0.3)
    elif st.thatch:
        r = prism("shed", 1.1, 0.8, 0.4, (-0.5, 0.75, 0.55), st.roof, "x")
        lib.lumpy(r, 0.012, 0.04)
        for dx, dy in ((-0.5, -0.32), (0.5, -0.32), (0.5, 0.32), (-0.5, 0.32)):
            lib.cyl(f"shedpost{dx}{dy}", 0.03, 0.4, (-0.5 + dx, 0.75 + dy, 0.37), m["wood"], verts=6)
    else:
        hall(st, "shed", -0.5, 0.75, 1.0, 0.7, 0.42, along="x")
    # Nets on a frame, baskets of fish, ropes, the boat tied alongside the pier.
    net = lib.mat("net", (0.52, 0.48, 0.38), 0.9, grain=0.3, kind=("brick", 0.04, 0.04, 0.6))
    for d in (-0.22, 0.22):
        lib.cyl(f"netpole{d}", 0.012, 0.42, (-1.0 + d, 0.2, 0.37), m["wood"], verts=5)
    lib.box("net", (0.44, 0.012, 0.28), (-1.0, 0.2, 0.38), net)
    fish = lib.mat("fishscale", (0.62, 0.66, 0.68), 0.4, metal=0.3)
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    for k, (x, y) in enumerate(((0.62, 0.2), (0.85, 0.15), (0.72, -0.1))):
        lib.cyl(f"fishbasket{k}", 0.05, 0.06, (x, y, 0.17), basket, verts=10)
        lib.ball(f"fish{k}", 0.025, (x, y, 0.21), fish, scale=(1.6, 0.7, 0.5), sub=1)
    boat_m = lib.mat("reedboat", (0.70, 0.60, 0.34), 0.9, grain=0.35, kind=("thatch", 0.02, 0, 0.4)) if a == "egyptian" else m["wood"]
    if a == "babylonian" and stone:
        lib.ball("coracle", 0.18, (0.25, -0.8, 0.06), boat_m, scale=(1, 1, 0.35), sub=2)
    else:
        lib.ball("boat", 0.14, (0.3, -0.75, 0.07), boat_m, scale=(1.0, 3.0, 0.4), sub=2)
        if a == "egyptian":
            for sy in (-1, 1):
                lib.cyl(f"boatend{sy}", 0.03, 0.18, (0.3, -0.75 + sy * 0.4, 0.14), boat_m, rot=(R(-30 * sy), 0, 0), verts=6, r2=0.012)
    lib.cyl("mooring", 0.03, 0.12, (0.55, -0.7, 0.18), m["wood"], verts=6)
    flag(st, -1.1, 1.1, 0.95)


def enclosure(st, half, h, gap, name="enc", crenel=False, towers=0.0):
    """A low wall round a yard of `half` each way from the middle, open at the front (-Y) between gap[0] and
    gap[1] on X: a fence of stakes while buildings are thatched, a built wall after. The front and right
    walls, the ones toward the viewer, stand lower, so the yard behind them shows."""
    near = h * 0.7
    sides = [((-half, half), (half, half), h), ((-half, -half), (-half, half), h), ((half, -half), (half, half), near),
             ((-half, -half), (gap[0], -half), near), ((gap[1], -half), (half, -half), near)]
    for k, ((x0, y0), (x1, y1), hh) in enumerate(sides):
        if st.thatch:
            palisade(st, x0, y0, x1, y1, h=hh + 0.08)
            continue
        length = math.hypot(x1 - x0, y1 - y0)
        along_x = abs(y1 - y0) < 1e-6
        size = (length + 0.08, 0.08, hh) if along_x else (0.08, length + 0.08, hh)
        lib.box(f"{name}{k}", size, ((x0 + x1) / 2, (y0 + y1) / 2, hh / 2), st.wall, bevel=0.01)
        # A coping along the top, or battlements.
        top = (size[0] + 0.03, size[1] + 0.03, 0.03)
        lib.box(f"{name}{k}-cap", top, ((x0 + x1) / 2, (y0 + y1) / 2, hh + 0.015), st.trim, bevel=0.005)
        if crenel:
            for j in range(int(length / 0.14)):
                t = -length / 2 + 0.07 + j * 0.14
                mx, my = ((x0 + x1) / 2 + t, (y0 + y1) / 2) if along_x else ((x0 + x1) / 2, (y0 + y1) / 2 + t)
                lib.box(f"{name}{k}-merlon{j}", (0.07, 0.09, 0.06) if along_x else (0.09, 0.07, 0.06), (mx, my, hh + 0.06), st.wall)
    # Square towers at the corners, `towers` above the wall.
    if towers and not st.thatch:
        for k, (x, y) in enumerate(((-half, half), (half, half), (-half, -half), (half, -half))):
            th = h + towers if y > 0 else h * 0.7 + towers
            lib.box(f"{name}-tower{k}", (0.24, 0.24, th), (x, y, th / 2), st.wall, bevel=0.01)
            lib.box(f"{name}-towercap{k}", (0.28, 0.28, 0.03), (x, y, th + 0.015), st.trim)
            for j, (dx, dy) in enumerate(((-0.09, -0.09), (0.09, -0.09), (0.09, 0.09), (-0.09, 0.09))):
                lib.box(f"{name}-tm{k}{j}", (0.06, 0.06, 0.06), (x + dx, y + dy, th + 0.06), st.wall)


def gateway(st, x0, x1, y, h, name="gate"):
    """Two posts and a beam over the way in, a little banner in the owner's colour on the beam."""
    m = st.wood if st.thatch else st.trim
    for k, x in enumerate((x0, x1)):
        if st.thatch:
            lib.cyl(f"{name}post{k}", 0.04, h, (x, y, h / 2), m, verts=8)
        else:
            lib.box(f"{name}post{k}", (0.12, 0.12, h), (x, y, h / 2), st.wall, bevel=0.01)
            lib.box(f"{name}cap{k}", (0.15, 0.15, 0.04), (x, y, h + 0.02), m, bevel=0.005)
    lib.box(f"{name}beam", (x1 - x0 + 0.16, 0.08, 0.07), ((x0 + x1) / 2, y, h - 0.02), m, bevel=0.005)
    lib.box(f"{name}banner", (0.14, 0.012, 0.12), ((x0 + x1) / 2, y - 0.045, h - 0.12), st.team)


def colonnade(st, a, b, h, n, name):
    """A row of `n` columns from point a to point b (x, y)."""
    (x0, y0), (x1, y1) = a, b
    if abs(y1 - y0) < 1e-6:
        columns(st, x0, x1, y0, h, n)
        return
    for i in range(n):
        t = i / max(1, n - 1)
        lib.cyl(f"{name}{i}", 0.045, h, (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, h / 2), st.trim, verts=12)


def lean_to(name, x, y, w, d, z, m, down="front"):
    """A roof of one slope, `w` by `d`, its high edge at the back, falling toward `down` ("front", -Y,
    or "right", +X)."""
    rot = (R(-14), 0, 0) if down == "front" else (0, R(14), 0)
    lib.box(name, (w, d, 0.03), (x, y, z), m, rot=rot, bevel=0.005)


def propylon(st, x, y, w, h, name="propylon"):
    """A gateway of the Iron Age: steps, four columns, a beam and a pediment, banners either side."""
    m = st.trim
    steps(st, x, y, w + 0.1, 0.36, n=2, h=0.035)
    for k, dx in enumerate((-w / 2, -w / 6, w / 6, w / 2)):
        for dy in (-0.12, 0.12):
            lib.cyl(f"{name}col{k}{dy}", 0.04, h, (x + dx, y + dy, 0.07 + h / 2), m, verts=12)
    lib.box(f"{name}beam", (w + 0.16, 0.34, 0.07), (x, y, 0.07 + h + 0.035), m, bevel=0.005)
    prism(f"{name}pediment", w + 0.2, 0.38, 0.16, (x, y, 0.07 + h + 0.07), st.roof, "x")
    for k, dx in enumerate((-w / 2 - 0.14, w / 2 + 0.14)):
        lib.box(f"{name}pier{k}", (0.12, 0.12, h + 0.1), (x + dx, y, (h + 0.1) / 2), st.wall, bevel=0.01)
        lib.box(f"{name}banner{k}", (0.1, 0.012, 0.2), (x + dx, y - 0.065, h - 0.1), st.team)


def court(name, w, d, loc):
    """The floor of a court within walls: trodden earth a little lighter than outside, moss in it, a few flags of
    stone set in it. (A pale flat floor was read as concrete.)"""
    m = lib.mat(f"court-{name}", earthy((0.62, 0.56, 0.44)), 1.0, grain=0.5, grain_size=0.025)
    lib.mottle(m, MOSS, scale=0.25, cover=0.28)
    lib.box(name, (w, d, 0.02), loc, m)
    flag_m = lib.mat("flagstone", (0.58, 0.55, 0.50), 0.9, grain=0.25)
    rnd = random.Random(int(w * 100 + d * 10))
    x0, y0, z0 = loc
    for k in range(int(w * d * 4)):
        lib.box(f"{name}-flag{k}", (rnd.uniform(0.08, 0.14), rnd.uniform(0.07, 0.12), 0.012),
                (x0 + rnd.uniform(-w / 2.4, w / 2.4), y0 + rnd.uniform(-d / 2.4, d / 2.4), z0 + 0.012), flag_m, rot=(0, 0, rnd.uniform(-0.2, 0.2)))


def paving(name, w, d, loc, color=(0.66, 0.62, 0.54)):
    """Stone slabs laid over a yard."""
    m = lib.mat(f"paving-{name}", color, 0.9, grain=0.2, grain_size=0.02, kind=("brick", 0.22, 0.2, 0.35))
    lib.mottle(m, MOSS, scale=0.12, cover=0.14)
    lib.box(name, (w, d, 0.02), loc, m)


def archery_range_iron(st):
    """The Iron Age's range, a soldiers' training ground: a wall of dressed stone with towers at the corners,
    a covered gallery to shoot from along the front, an earth bank behind the targets to stop the arrows, cut
    stones marking the distances, the armoury with a pediment, a statue of an archer by the gate."""
    ground(3, (0.58, 0.52, 0.40))
    enclosure(st, 1.3, 0.4, (0.25, 0.95), name="awall")
    for k, (x, y) in enumerate(((-1.3, 1.3), (1.3, 1.3), (-1.3, -1.3), (1.3, -1.3))):
        th = 0.62 if y > 0 else 0.5
        lib.box(f"tower{k}", (0.26, 0.26, th), (x, y, th / 2), st.wall, bevel=0.01)
        for j, (dx, dy) in enumerate(((-0.09, -0.09), (0.09, -0.09), (0.09, 0.09), (-0.09, 0.09))):
            lib.box(f"merlon{k}{j}", (0.07, 0.07, 0.07), (x + dx, y + dy, th + 0.035), st.wall)
    if getattr(st, "arch", "default") == "roman":
        arched_gate(st, 0.6, -1.3, 0.6, 0.75, "agate")
    else:
        gateway(st, 0.25, 0.95, -1.3, 0.66, name="agate")
    paving("path", 0.6, 1.4, (0.6, -0.65, 0.01))
    # The bank and the targets before it.
    soil = lib.mat("bank", (0.34, 0.27, 0.18), 1.0, grain=0.45, grain_size=0.03)
    prism("bank", 1.6, 0.5, 0.46, (0.5, 1.02, 0.0), soil, "x")
    turf = lib.mat("turf", (0.30, 0.40, 0.18), 1.0, grain=0.4, grain_size=0.02)
    lib.box("bankturf", (1.6, 0.08, 0.03), (0.5, 1.02, 0.45), turf)
    straw = lib.mat("straw", (0.82, 0.70, 0.38), 0.95, grain=0.4, grain_size=0.01)
    rings = [lib.mat("ring-white", (0.90, 0.86, 0.76), 0.8, grain=0.1), lib.mat("ring-red", (0.66, 0.18, 0.12), 0.8, grain=0.1),
             lib.mat("ring-black", (0.10, 0.08, 0.06), 0.8, grain=0.05)]
    for k, x in enumerate((0.0, 0.5, 1.0)):
        y = 0.78
        for d in (-0.13, 0.13):
            lib.box(f"frame{k}{d}", (0.035, 0.035, 0.5), (x + d, y + 0.05, 0.25), st.wood)
        lib.box(f"framebar{k}", (0.34, 0.035, 0.035), (x, y + 0.05, 0.5), st.wood)
        lib.cyl(f"butt{k}", 0.19, 0.1, (x, y, 0.32), straw, rot=(R(90), 0, 0), verts=18)
        for j, (r, m) in enumerate(zip((0.14, 0.095, 0.045), rings)):
            lib.cyl(f"ring{k}{j}", r, 0.012, (x, y - 0.054 - j * 0.004, 0.32), m, rot=(R(90), 0, 0), verts=18, smooth_it=False)
        for j in range(3):
            lib.cyl(f"arrow{k}{j}", 0.005, 0.2, (x + (j - 1) * 0.06, y - 0.14, 0.32 + ((j * 37) % 5 - 2) * 0.03), st.wood,
                    rot=(R(90), 0, 0), verts=4, smooth_it=False)
    # Cut stones marking the distances.
    marker = lib.mat("marker", (0.70, 0.67, 0.60), 0.9, grain=0.2)
    for k, (x, y) in enumerate(((0.0, 0.25), (0.5, 0.25), (1.0, 0.25), (0.0, -0.2), (0.5, -0.2), (1.0, -0.2))):
        lib.box(f"marker{k}", (0.06, 0.06, 0.1), (x, y, 0.05), marker, bevel=0.01)
    # The gallery along the front, left of the gate: columns, a tiled roof of one slope, low screens
    # between the places to shoot from.
    colonnade(st, (-1.15, -0.72), (0.05, -0.72), 0.48, 5, "gal")
    lean_to("galroof", -0.55, -1.0, 1.4, 0.66, 0.53, st.roof)
    for k, x in enumerate((-0.85, -0.55, -0.25)):
        lib.box(f"screen{k}", (0.03, 0.4, 0.22), (x, -1.0, 0.11), st.wall)
    # The armoury in the back corner: a pediment over the door, bows and sheaves of arrows before it; for the
    # Egyptians and Greeks the goddess of the hunt there instead (round 5, the owner's note).
    if getattr(st, "arch", "default") in ("egyptian", "greek"):
        goddess(st, -0.78, 0.72, "goddess", st.arch)
    else:
        hall(st, "armoury", -0.78, 0.72, 0.85, 0.75, 0.56, roof="gable", along="y")
        columns(st, -1.08, -0.48, 0.3, 0.5, 4)
        door(st, -0.78, 0.33, 0.3, 0.38)
    for k in range(4):
        lib.cyl(f"bow{k}", 0.009, 0.44, (-0.35 + k * 0.08, 0.2, 0.22), st.wood, verts=5, rot=(R(10), 0, 0))
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    for k, x in enumerate((-1.05, -0.95)):
        lib.cyl(f"quiver{k}", 0.05, 0.16, (x, 0.15, 0.08), basket, verts=10)
    # A statue of an archer by the gate, on a plinth.
    bronze = lib.mat("statue", (0.40, 0.33, 0.20), 0.4, metal=0.6, grain=0.1)
    lib.box("plinth", (0.16, 0.16, 0.18), (1.1, -0.95, 0.09), marker, bevel=0.01)
    lib.cyl("statue-legs", 0.03, 0.12, (1.1, -0.95, 0.24), bronze, verts=8)
    lib.cyl("statue-body", 0.04, 0.13, (1.1, -0.95, 0.36), bronze, verts=8)
    lib.ball("statue-head", 0.03, (1.1, -0.95, 0.46), bronze, sub=1)
    lib.cyl("statue-bow", 0.006, 0.26, (1.05, -0.98, 0.38), bronze, verts=4, rot=(R(15), 0, 0))
    flag(st, -1.15, -1.1, 1.0)


def archery_range(st):
    """A walled range: targets of straw with painted rings along the back wall, facing the way in; a line to
    shoot from, racks of bows and baskets of arrows by it; the armoury in the back corner."""
    if st.age == "iron":
        return archery_range_iron(st)
    ground(3)
    enclosure(st, 1.3, 0.34, (0.25, 0.95))
    gateway(st, 0.25, 0.95, -1.3, 0.62)
    a = getattr(st, "arch", "default")
    if a in ("egyptian", "greek"):
        # The goddess of the hunt in place of the armoury (round 5, the owner's note).
        goddess(st, -0.75, 0.75, "goddess", a)
    elif st.thatch:
        hall(st, "armoury", -0.75, 0.75, 0.9, 0.8, 0.45, along="y")
        door(st, -0.75, 0.34, 0.24, 0.34)
    else:
        hall(st, "armoury", -0.75, 0.75, 0.9, 0.8, 0.55, roof="flat" if st.age == "bronze" else "gable", along="y")
        door(st, -0.75, 0.34, 0.24, 0.34)
    straw = lib.mat("straw", (0.82, 0.70, 0.38), 0.95, grain=0.4, grain_size=0.01)
    rings = [lib.mat("ring-white", (0.90, 0.86, 0.76), 0.8, grain=0.1), lib.mat("ring-red", (0.66, 0.18, 0.12), 0.8, grain=0.1),
             lib.mat("ring-black", (0.10, 0.08, 0.06), 0.8, grain=0.05)]
    def target(k, x, y, along_x=True):
        """Two legs behind, a round butt of straw on them, its painted face toward the range (-Y when
        along the back wall, +X along the left one), arrows in it."""
        face = (R(90), 0, 0) if along_x else (0, R(90), 0)
        back = (0, 0.1) if along_x else (-0.1, 0)
        out = (0, -1) if along_x else (1, 0)
        for d in (-0.13, 0.13):
            lx, ly = (x + d, y + back[1]) if along_x else (x + back[0], y + d)
            lib.box(f"leg{k}{d}", (0.03, 0.03, 0.46), (lx, ly, 0.23), st.wood, rot=(R(-12), 0, 0) if along_x else (0, R(12), 0))
        lib.cyl(f"butt{k}", 0.2, 0.11, (x, y, 0.36), straw, rot=face, verts=18)
        for j, (r, m) in enumerate(zip((0.15, 0.1, 0.045), rings)):
            o = 0.058 + j * 0.004
            lib.cyl(f"ring{k}{j}", r, 0.012, (x + out[0] * o, y + out[1] * o, 0.36), m, rot=face, verts=18, smooth_it=False)
        for j in range(3):
            t, az = (j - 1) * 0.06, 0.36 + ((j * 37) % 5 - 2) * 0.03
            ax, ay = (x + t, y - 0.14) if along_x else (x + 0.14, y + t)
            lib.cyl(f"arrow{k}{j}", 0.005, 0.2, (ax, ay, az), st.wood, rot=face, verts=4, smooth_it=False)

    for k, x in enumerate((0.1, 0.6, 1.05)):
        target(k, x, 1.0)
    for k, y in enumerate((-0.45, 0.05)):
        target(k + 3, -1.0, y, along_x=False)
    # Bales against the wall between the targets.
    for k, x in enumerate((0.3, 0.8)):
        lib.box(f"bale{k}", (0.22, 0.16, 0.14), (x, 1.12, 0.07), straw, bevel=0.02)
    # Where they shoot from: a shelter on posts along the front, a rail before it, bows on a rack and
    # baskets of arrows.
    roof = st.roof if not st.thatch else lib.mat("thatchshelter", (0.66, 0.54, 0.30), 0.95, grain=0.4, grain_size=0.01)
    if a == "asian":
        roof = lib.mat("tentcloth", (0.84, 0.78, 0.62), 0.9, grain=0.2)  # a shelter of cloth (the owner's note)
    # Left of the way in, so the gate stays clear.
    for k, x in enumerate((-0.95, -0.5, -0.05)):
        lib.cyl(f"shelterpost{k}", 0.025, 0.5, (x, -0.95, 0.25), st.wood, verts=6)
        lib.cyl(f"railpost{k}", 0.02, 0.2, (x, -0.5, 0.1), st.wood, verts=6)
    lib.box("shelter", (1.05, 0.36, 0.03), (-0.5, -1.03, 0.52), roof, rot=(R(10), 0, 0))
    lib.box("rail", (1.0, 0.03, 0.03), (-0.5, -0.5, 0.2), st.wood)
    for k in range(5):
        lib.cyl(f"bow{k}", 0.009, 0.44, (-0.95 + k * 0.1, -0.85, 0.23), st.wood, verts=5, rot=(R(10), 0, 0))
    lib.box("rack", (0.56, 0.04, 0.04), (-0.75, -0.82, 0.4), st.wood)
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    for k, x in enumerate((-0.05, 0.6)):
        lib.cyl(f"quiver{k}", 0.06, 0.18, (x, -0.75, 0.09), basket, verts=10)
        for j in range(5):
            lib.cyl(f"shaft{k}{j}", 0.005, 0.14, (x + (j - 2) * 0.018, -0.75, 0.22), st.wood, verts=4, smooth_it=False)
    flag(st, -1.15, -1.1, 1.0)


def stable(st):
    """A stable of the plan's round 2: the stalls at the back, a paddock fenced with rails before them, horses,
    a trough, hay, saddles on the rail. In the Iron Age the stalls are stone and the yard walled."""
    ground(3, (0.48, 0.40, 0.26))
    a = getattr(st, "arch", "default")
    h = 0.5 if st.thatch else 0.6
    hall(st, "stalls", -0.25, 0.8, 2.2, 0.75, h, along="x")
    for k in range(4):
        lib.box(f"stall{k}", (0.36, 0.03, 0.36), (-1.05 + k * 0.52, 0.42, 0.18), st.dark)
    if st.age == "iron":
        enclosure(st, 1.3, 0.3, (0.2, 0.8), name="swall", crenel=a == "babylonian")
        gateway(st, 0.2, 0.8, -1.3, 0.55, name="sgate")
    m = mats()
    # The paddock: posts and two rails round the front of the yard.
    rails = [((-1.15, -1.1), (1.15, -1.1)), ((1.15, -1.1), (1.15, 0.3)), ((-1.15, -1.1), (-1.15, 0.3))]
    for k, ((x0, y0), (x1, y1)) in enumerate(rails):
        n = int(math.hypot(x1 - x0, y1 - y0) / 0.38) + 1
        for j in range(n + 1):
            t = j / n
            lib.cyl(f"fpost{k}{j}", 0.018, 0.28, (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.14), m["wood"], verts=6)
        along_x = abs(y1 - y0) < 1e-6
        length = math.hypot(x1 - x0, y1 - y0)
        for z in (0.12, 0.24):
            lib.box(f"rail{k}{z}", (length, 0.018, 0.02) if along_x else (0.018, length, 0.02), ((x0 + x1) / 2, (y0 + y1) / 2, z), m["wood"])
    horse("horse-a", 0.2, -0.45, facing=R(20))
    horse("horse-b", -0.55, -0.15, facing=R(160), coat=(0.62, 0.58, 0.54))
    if st.age != "tool":
        horse("horse-c", 0.75, 0.05, facing=R(-70), coat=(0.20, 0.14, 0.10))
    trough(-0.2, 0.22, "trough")
    for k in range(3):
        lib.ball(f"hay{k}", 0.13, (0.8 + (k % 2) * 0.18, 0.3 + k * 0.05, 0.07), m["hay"], scale=(1.2, 1, 0.6), sub=2)
    for k, x in enumerate((-0.6, -0.3)):
        lib.box(f"saddle{k}", (0.1, 0.08, 0.05), (x, -1.1, 0.27), m["hide"], bevel=0.01)
    lib.box("bucket", (0.06, 0.06, 0.06), (0.4, 0.25, 0.03), m["wood"])
    flag(st, 1.15, 1.1, 1.0)


def tholos(st, x, y, name="tholos"):
    """A round pavilion: a step, a ring of columns, a conical roof of tiles with a finial."""
    lib.cyl(f"{name}base", 0.44, 0.05, (x, y, 0.025), st.trim, verts=24)
    lib.cyl(f"{name}step", 0.4, 0.05, (x, y, 0.075), st.trim, verts=24)
    for i in range(8):
        a = 2 * math.pi * i / 8
        lib.cyl(f"{name}col{i}", 0.035, 0.4, (x + 0.33 * math.cos(a), y + 0.33 * math.sin(a), 0.3), st.trim, verts=10)
    lib.cyl(f"{name}ring", 0.38, 0.06, (x, y, 0.53), st.trim, verts=24)
    lib.cyl(f"{name}frieze", 0.381, 0.02, (x, y, 0.51), st.team, verts=24)
    lib.cyl(f"{name}roof", 0.46, 0.26, (x, y, 0.69), st.roof, verts=24, r2=0.04)
    lib.ball(f"{name}finial", 0.035, (x, y, 0.84), st.trim, sub=1)
    # A table of fish and meat inside.
    lib.cyl(f"{name}table", 0.14, 0.12, (x, y, 0.16), st.wood, verts=12)


def fountain(st, x, y, name="fountain"):
    """A round basin of water with a pillar in the middle and water falling from its spout."""
    lib.cyl(f"{name}basin", 0.36, 0.1, (x, y, 0.05), st.trim, verts=24)
    lib.cyl(f"{name}water", 0.32, 0.01, (x, y, 0.1), lib.mat("fountainwater", (0.30, 0.56, 0.66), 0.1), verts=24)
    if hasattr(st, "accent"):
        lib.cyl(f"{name}band", 0.362, 0.03, (x, y, 0.07), st.accent, verts=24)
    lib.cyl(f"{name}pillar", 0.04, 0.32, (x, y, 0.2), st.trim, verts=12)
    lib.ball(f"{name}bowl", 0.08, (x, y, 0.38), st.trim, scale=(1, 1, 0.4), sub=2)
    lib.cyl(f"{name}fall", 0.015, 0.28, (x, y, 0.24), lib.mat("fountainfall", (0.78, 0.88, 0.92), 0.1), verts=8)


# ---- trees and water for the markets of the east

def pine(name, x, y, h=0.9, lean=0.0):
    """A pine: a bare trunk leaning a little, flat tiers of dark needles."""
    bark = lib.mat("pinebark", (0.36, 0.26, 0.18), 0.9, grain=0.4, grain_size=0.01)
    needles = lib.mat("pine", (0.18, 0.30, 0.18), 0.9, grain=0.35, grain_size=0.02)
    lib.cyl(f"{name}-trunk", 0.03, h, (x + lean / 2, y, h / 2), bark, verts=6, r2=0.02, rot=(0, R(lean * 40), 0))
    for k, (z, r) in enumerate(((0.55, 0.24), (0.72, 0.19), (0.86, 0.13))):
        o = lib.ball(f"{name}-tier{k}", r, (x + lean, y, h * z), needles, scale=(1.2, 1.0, 0.35), sub=2)
        lib.lumpy(o, 0.03, 0.08)


def willow(name, x, y, h=0.7):
    """A weeping willow: a stout trunk, a round crown and long fronds hanging from it."""
    bark = lib.mat("willowbark", (0.38, 0.32, 0.24), 0.9, grain=0.4, grain_size=0.01)
    leaf = lib.mat("willow", (0.46, 0.58, 0.30), 0.85, grain=0.3, grain_size=0.015)
    lib.cyl(f"{name}-trunk", 0.04, h, (x, y, h / 2), bark, verts=7, r2=0.03)
    lib.lumpy(lib.ball(f"{name}-crown", 0.22, (x, y, h), leaf, scale=(1.1, 1.1, 0.7), sub=2), 0.03, 0.08)
    for k in range(10):
        a = 2 * math.pi * k / 10
        lib.box(f"{name}-frond{k}", (0.03, 0.03, 0.36), (x + math.cos(a) * 0.2, y + math.sin(a) * 0.2, h - 0.2), leaf)


def bamboo(name, x, y, n=7, h=0.8):
    """A clump of bamboo: thin green canes of a few heights, leaves at the top."""
    cane = lib.mat("bamboo", (0.48, 0.58, 0.26), 0.7, grain=0.2)
    leaf = lib.mat("bambooleaf", (0.34, 0.50, 0.22), 0.8, grain=0.3)
    rnd = random.Random(int(x * 100 + y * 10))
    for k in range(n):
        cx, cy, ch = x + rnd.uniform(-0.08, 0.08), y + rnd.uniform(-0.08, 0.08), h * rnd.uniform(0.7, 1.0)
        lib.cyl(f"{name}-cane{k}", 0.01, ch, (cx, cy, ch / 2), cane, verts=5)
        lib.ball(f"{name}-leaves{k}", 0.06, (cx, cy, ch), leaf, scale=(1.3, 1.0, 0.5), sub=1)


def papyrus(name, x, y, n=6):
    """Papyrus at the water's edge: green stems with a tuft at the top."""
    stem = lib.mat("papyrus", (0.38, 0.52, 0.22), 0.8, grain=0.2)
    rnd = random.Random(int(x * 100 + y * 10))
    for k in range(n):
        cx, cy, ch = x + rnd.uniform(-0.06, 0.06), y + rnd.uniform(-0.06, 0.06), rnd.uniform(0.25, 0.4)
        lib.cyl(f"{name}-stem{k}", 0.006, ch, (cx, cy, ch / 2), stem, verts=4)
        lib.ball(f"{name}-tuft{k}", 0.035, (cx, cy, ch), stem, scale=(1.2, 1.2, 0.6), sub=1)


def pond(name, x, y, r, rim):
    """Still water ringed with stones, lotus leaves on it."""
    lib.cyl(f"{name}-water", r, 0.02, (x, y, 0.012), lib.mat("pondwater", (0.16, 0.30, 0.32), 0.15), verts=28)
    rnd = random.Random(int(r * 100))
    for k in range(16):
        a = 2 * math.pi * k / 16 + rnd.uniform(-0.1, 0.1)
        q = lib.ball(f"{name}-rim{k}", rnd.uniform(0.035, 0.05), (x + math.cos(a) * r, y + math.sin(a) * r, 0.02), rim, sub=1)
        q.scale = (1.3, 1.0, 0.6)
    pad = lib.mat("lotuspad", (0.30, 0.50, 0.24), 0.7)
    for k in range(5):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.1, r * 0.75)
        lib.cyl(f"{name}-pad{k}", 0.035, 0.006, (x + math.cos(a) * d, y + math.sin(a) * d, 0.026), pad, verts=10)


def market_asian(st):
    """A market of the Asian architecture: a gateway of red posts under a tiled roof turned up at the corners,
    rows of shops of timber and plaster along the back and left walls, a pond in the middle with a little
    arched bridge and stone lanterns, stalls under round parasols, pines, a willow by the water, bamboo."""
    ground(3, (0.56, 0.50, 0.38))
    enclosure(st, 1.3, 0.26, (-0.42, 0.42), name="mwall")
    # The gateway.
    for k, x in enumerate((-0.36, -0.12, 0.12, 0.36)):
        ph = 0.6 if abs(x) < 0.2 else 0.48
        lib.box(f"gatepost{k}", (0.06, 0.06, ph), (x, -1.3, ph / 2), st.trim)
    lib.box("gatebeam", (0.86, 0.07, 0.06), (0.0, -1.3, 0.58), st.trim)
    lib.box("gatesign", (0.2, 0.02, 0.1), (0.0, -1.34, 0.5), st.team)
    arch.asian_roof(st, "gateroof", 0.0, -1.3, 0.6, 0.1, 0.61)
    # Shops along the back and left walls.
    hall(st, "shops-b", 0.25, 0.98, 1.8, 0.48, 0.42)
    for k, x in enumerate((-0.35, 0.25, 0.85)):
        door(st, x, 0.735, 0.2, 0.28)
    hall(st, "shops-l", -0.98, -0.2, 0.48, 1.3, 0.42)
    for k, y in enumerate((-0.6, 0.0)):
        door(st, -0.735, y, 0.2, 0.28, side="right")
    # The pond, a bridge over it, lanterns.
    rim = lib.mat("pondstone", (0.50, 0.48, 0.44), 0.95, grain=0.3)
    pond("pond", 0.3, -0.2, 0.5, rim)
    # The bridge across its near end.
    for k, sx in enumerate((-1, 1)):
        lib.box(f"bridge{k}", (0.24, 0.16, 0.03), (0.3 + sx * 0.1, -0.58, 0.06), st.wood, rot=(0, R(-22 * sx), 0))
        lib.box(f"bridgerail{k}", (0.24, 0.02, 0.06), (0.3 + sx * 0.1, -0.66, 0.1), st.trim, rot=(0, R(-22 * sx), 0))
    arch.lantern(st, "lantern-a", -0.25, -0.75)
    arch.lantern(st, "lantern-b", 0.95, 0.35)
    # Stalls under parasols.
    cloths = [lib.mat("parasol-cream", (0.88, 0.82, 0.66), 0.9), lib.mat("parasol-red", (0.66, 0.20, 0.14), 0.9)]
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    silk = lib.mat("silk", (0.80, 0.66, 0.30), 0.6)
    for k, (x, y) in enumerate(((-0.35, 0.4), (0.95, -0.75))):
        lib.box(f"table{k}", (0.3, 0.2, 0.1), (x, y, 0.05), st.wood, bevel=0.008)
        lib.cyl(f"parasolpole{k}", 0.01, 0.42, (x, y, 0.21), st.wood, verts=5)
        lib.cyl(f"parasol{k}", 0.24, 0.08, (x, y, 0.44), cloths[k], verts=16, r2=0.02)
        for j in range(3):
            if j % 2:
                lib.box(f"bolt{k}{j}", (0.07, 0.05, 0.035), (x + (j - 1) * 0.09, y, 0.12), silk, bevel=0.008)
            else:
                lib.ball(f"pot{k}{j}", 0.035, (x + (j - 1) * 0.09, y, 0.13), clay, scale=(1, 1, 1.2), sub=1)
    # Trees.
    pine("pine-a", -0.75, -0.95, 0.85, lean=0.08)
    pine("pine-b", 1.05, 0.6, 0.95, lean=-0.06)
    willow("willow", 0.95, 0.15, 0.65)
    bamboo("bamboo-a", -1.1, 0.75, 8, 0.85)
    bamboo("bamboo-b", 1.12, -1.1, 6, 0.7)
    bamboo("bamboo-c", -0.2, 0.62, 5, 0.6)
    flag(st, 1.2, 1.15, 1.0)


def market_egyptian(st):
    """A market of the Egyptian architecture: a gateway between two leaning pylons, stalls under reed mats
    along the walls with heaps of grain, baskets and linen, a pool of water in the middle with papyrus at its
    edge and a shaduf to draw from it, date palms all about."""
    ground(3, (0.76, 0.66, 0.46))
    enclosure(st, 1.3, 0.26, (-0.42, 0.42), name="mwall")
    for k, x in enumerate((-0.5, 0.5)):
        arch.tapered(f"pylon{k}", 0.26, 0.22, 0.7, (x, -1.3, 0.0), st.wall, top=0.8)
        lib.box(f"pylonband{k}", (0.24, 0.23, 0.04), (x, -1.3, 0.6), st.accent)
        lib.box(f"pylonbanner{k}", (0.1, 0.012, 0.2), (x, -1.42, 0.42), st.team)
    lib.box("lintel", (0.86, 0.16, 0.07), (0.0, -1.3, 0.62), st.trim)
    lib.box("lintelband", (0.86, 0.17, 0.025), (0.0, -1.3, 0.6), st.accent)
    reed = lib.mat("reedmat", (0.74, 0.62, 0.38), 0.95, grain=0.35, grain_size=0.008, kind=("thatch", 0.03, 0, 0.4))
    grain = lib.mat("grainheap", (0.86, 0.72, 0.40), 0.95, grain=0.3, grain_size=0.01)
    linen = lib.mat("linen", (0.92, 0.90, 0.82), 0.9)
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)

    def mat_stall(k, x, y, facing):
        sx, sy = (0.55, 0.36) if facing == "front" else (0.36, 0.55)
        for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            lib.cyl(f"rs{k}post{dx}{dy}", 0.014, 0.42, (x + dx * sx / 2, y + dy * sy / 2, 0.21), st.wood, verts=5)
        lean_to(f"rs{k}mat", x, y, sx + 0.08, sy + 0.08, 0.42, reed, down=facing)
        # Wares on mats on the ground: a heap of grain, a basket, folded linen, a jar.
        lib.cyl(f"rs{k}grain", 0.09, 0.08, (x - 0.12, y - 0.04, 0.04), grain, verts=12, r2=0.01)
        lib.cyl(f"rs{k}basket", 0.06, 0.06, (x + 0.05, y - 0.06, 0.03), basket, verts=10)
        lib.box(f"rs{k}linen", (0.1, 0.07, 0.04), (x + 0.15, y + 0.04, 0.02), linen, bevel=0.008)
        lib.ball(f"rs{k}jar", 0.04, (x - 0.02, y + 0.1, 0.05), clay, scale=(1, 1, 1.3), sub=1)

    for k, x in enumerate((-0.45, 0.2, 0.85)):
        mat_stall(k, x, 1.0, "front")
    for k, y in enumerate((-0.6, 0.15)):
        mat_stall(k + 3, -1.0, y, "right")
    # The pool, papyrus about it, a shaduf at its edge.
    lib.box("poolrim", (0.86, 0.6, 0.06), (0.3, -0.15, 0.03), st.trim)
    lib.box("pool", (0.76, 0.5, 0.02), (0.3, -0.15, 0.06), lib.mat("poolwater", (0.18, 0.34, 0.40), 0.15))
    for k, (x, y) in enumerate(((-0.12, -0.42), (0.72, 0.12), (0.7, -0.44))):
        papyrus(f"papyrus{k}", x, y)
    lib.cyl("shadufpost", 0.025, 0.42, (-0.15, 0.2, 0.21), st.wood, verts=6)
    lib.cyl("shadufpole", 0.012, 0.75, (0.0, 0.08, 0.46), st.wood, verts=5, rot=(R(30), R(-55), 0))
    lib.ball("shadufweight", 0.045, (-0.3, 0.32, 0.36), lib.mat("mudball", (0.46, 0.36, 0.24), 0.95), sub=1)
    lib.cyl("shadufbucket", 0.03, 0.05, (0.2, -0.08, 0.2), basket, verts=8)
    for k, (x, y, h) in enumerate(((-0.8, -0.95, 0.9), (1.05, 0.55, 1.0), (1.0, -0.95, 0.8), (-0.35, 0.55, 0.85), (0.85, 0.85, 0.95))):
        arch.palm(st, f"date{k}", x, y, h)
    flag(st, 1.2, 1.15, 1.0)


def market_babylonian(st):
    """A market of the Babylonian architecture: an opening in the wall for a way in (the glazed lion gate
    stood over the square like a block, and was taken out), rows of small domed shops along the back and left
    walls, carpets laid out before them, spices and pots, a fountain in the middle under date palms, the square
    paved in brick."""
    ground(3, (0.66, 0.56, 0.40))
    paving("square", 2.5, 2.5, (0, 0, 0.012), color=(0.70, 0.56, 0.40))
    enclosure(st, 1.3, 0.28, (-0.32, 0.32), name="mwall")

    def domed(k, x, y, facing):
        lib.box(f"cell{k}", (0.4, 0.4, 0.34), (x, y, 0.17), st.wall, bevel=0.01)
        lib.ball(f"dome{k}", 0.19, (x, y, 0.34), st.trim, scale=(1, 1, 0.75), sub=2)
        if facing == "front":
            lib.box(f"celldoor{k}", (0.14, 0.02, 0.22), (x, y - 0.205, 0.11), st.dark)
            lib.box(f"cellband{k}", (0.41, 0.41, 0.04), (x, y, 0.3), st.accent)
        else:
            lib.box(f"celldoor{k}", (0.02, 0.14, 0.22), (x + 0.205, y, 0.11), st.dark)
            lib.box(f"cellband{k}", (0.41, 0.41, 0.04), (x, y, 0.3), st.accent)

    for k, x in enumerate((-0.7, -0.25, 0.2, 0.65, 1.1)):
        domed(k, x, 1.05, "front")
    for k, y in enumerate((-0.85, -0.4, 0.05, 0.5)):
        domed(k + 5, -1.05, y, "right")
    # Carpets, spices, pots.
    rugs = [lib.mat("rug-red", (0.60, 0.16, 0.12), 0.9, grain=0.3, grain_size=0.01), lib.mat("rug-blue", (0.16, 0.24, 0.50), 0.9, grain=0.3, grain_size=0.01),
            lib.mat("rug-ochre", (0.80, 0.56, 0.20), 0.9, grain=0.3, grain_size=0.01)]
    for k, (x, y, w, d) in enumerate(((-0.25, 0.68, 0.34, 0.22), (0.45, 0.68, 0.3, 0.22), (-0.68, -0.2, 0.22, 0.32))):
        lib.box(f"rug{k}", (w, d, 0.012), (x, y, 0.025), rugs[k % 3])
        lib.box(f"rugborder{k}", (w * 0.8, d * 0.7, 0.013), (x, y, 0.026), rugs[(k + 1) % 3])
    spices = [lib.mat("spice-red", (0.72, 0.20, 0.10), 0.9), lib.mat("spice-yellow", (0.86, 0.70, 0.18), 0.9),
              lib.mat("spice-brown", (0.50, 0.30, 0.16), 0.9)]
    for k in range(3):
        lib.cyl(f"spice{k}", 0.05, 0.06, (0.95 + k * 0.12 - 0.12, 0.68, 0.04), spices[k], verts=10, r2=0.01)
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    for k, (x, y) in enumerate(((-0.68, 0.35), (-0.6, 0.45), (-0.7, 0.55))):
        lib.ball(f"bpot{k}", 0.045, (x, y, 0.06), clay, scale=(1, 1, 1.3), sub=1)
    # A fountain under palms.
    fountain(st, 0.35, -0.1)
    for k, (x, y, h) in enumerate(((-0.25, -0.75, 0.85), (1.05, -0.7, 0.95), (1.05, 0.4, 0.8), (-0.4, 0.3, 0.9))):
        arch.palm(st, f"date{k}", x, y, h)
    flag(st, 1.2, 1.15, 1.0)


def market_iron(st):
    """The Iron Age's market, a square of stone: a gateway with columns and a pediment, a colonnade along the
    back and left walls with shops of stone behind it, the square paved, in the middle a round pavilion, jars
    on racks, scales, a cart by the gate. The Asian, Egyptian and Babylonian markets are their own."""
    a = getattr(st, "arch", "default")
    if a in EAST_MARKETS:
        return EAST_MARKETS[a](st)
    ground(3, (0.62, 0.56, 0.44))
    paving("square", 2.5, 2.5, (0, 0, 0.012))
    enclosure(st, 1.3, 0.3, (-0.42, 0.42), name="mwall")
    propylon(st, 0.0, -1.3, 0.62, 0.52)
    # Shops behind a colonnade: their fronts with doors, the columns before them, a tiled roof over both.
    lib.box("shops-back", (2.5, 0.06, 0.5), (0.0, 1.15, 0.25), st.wall, bevel=0.01)
    for k, x in enumerate((-0.75, -0.25, 0.25, 0.75)):
        lib.box(f"shopdoor-b{k}", (0.2, 0.03, 0.3), (x, 1.115, 0.15), st.dark)
    colonnade(st, (-0.85, 0.85), (1.2, 0.85), 0.5, 6, "stoa-b")
    lean_to("stoaroof-b", 0.18, 1.06, 2.25, 0.55, 0.55, st.roof)
    lib.box("stoa-b-frieze", (2.2, 0.012, 0.035), (0.18, 0.8, 0.5), st.team)
    lib.box("shops-left", (0.06, 1.95, 0.5), (-1.15, -0.1, 0.25), st.wall, bevel=0.01)
    for k, y in enumerate((-0.75, -0.25, 0.25)):
        lib.box(f"shopdoor-l{k}", (0.03, 0.2, 0.3), (-1.115, y, 0.15), st.dark)
    colonnade(st, (-0.85, -0.95), (-0.85, 0.85), 0.5, 5, "stoa-l")
    lean_to("stoaroof-l", -1.06, -0.05, 0.55, 2.0, 0.55, st.roof, down="right")
    # The middle of the square.
    tholos(st, 0.3, 0.05)
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    # Jars on a rack by the shops, a pair of scales, sacks.
    lib.box("jarrack", (0.5, 0.12, 0.04), (0.75, 0.62, 0.12), st.wood)
    for j in range(4):
        lib.ball(f"amphora{j}", 0.04, (0.57 + j * 0.12, 0.62, 0.2), clay, scale=(1, 1, 1.6), sub=2)
    lib.cyl("scalepost", 0.012, 0.3, (-0.45, 0.45, 0.15), st.wood, verts=6)
    lib.box("scalebeam", (0.26, 0.012, 0.012), (-0.45, 0.45, 0.3), st.wood)
    metal = lib.mat("brass", (0.62, 0.48, 0.22), 0.4, metal=0.7)
    for dx in (-0.12, 0.12):
        lib.cyl(f"scalepan{dx}", 0.04, 0.01, (-0.45 + dx, 0.45, 0.22), metal, verts=10)
    sack = lib.mat("sack", (0.74, 0.66, 0.50), 1.0, grain=0.3)
    for k, (x, y) in enumerate(((-0.6, -0.55), (-0.5, -0.62), (-0.62, -0.68))):
        lib.ball(f"sack{k}", 0.055, (x, y, 0.06), sack, scale=(1, 1, 1.1), sub=1)
    # A cart by the gate.
    lib.box("cart", (0.36, 0.22, 0.08), (0.75, -0.85, 0.14), st.wood, bevel=0.01)
    for dy in (-0.13, 0.13):
        lib.cyl(f"wheel{dy}", 0.09, 0.025, (0.75, -0.85 + dy, 0.09), st.wood, rot=(R(90), 0, 0), verts=12)
    lib.box("shaft", (0.3, 0.025, 0.025), (0.45, -0.85, 0.12), st.wood)
    for j in range(3):
        lib.ball(f"cartjar{j}", 0.035, (0.68 + j * 0.07, -0.85, 0.22), clay, scale=(1, 1, 1.4), sub=1)
    flag(st, 1.2, 1.15, 1.0)


def market_bronze_east(st, a):
    """The Bronze Age's market of the east (round 5): simpler than the Iron Age's. Egyptian stalls under reed
    mats among date palms; Babylonian long tents of cloth, heaps of pots, palms; Asian stalls under small
    curved thatched roofs and parasols, a well."""
    ground(3, (0.62, 0.52, 0.36))
    enclosure(st, 1.3, 0.24, (-0.35, 0.35), name="mwall")
    gateway(st, -0.35, 0.35, -1.3, 0.62, name="mgate")
    m = mats()
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    spots = [(-0.5, 0.95, "front"), (0.2, 0.95, "front"), (0.85, 0.95, "front"), (-0.98, -0.5, "right"), (-0.98, 0.2, "right")]
    if a == "egyptian":
        reed = lib.mat("reedmat", (0.74, 0.62, 0.38), 0.95, grain=0.35, grain_size=0.008, kind=("thatch", 0.03, 0, 0.4))
        grain_m = lib.mat("grainheap", (0.86, 0.72, 0.40), 0.95, grain=0.3, grain_size=0.01)
        for k, (x, y, f) in enumerate(spots):
            sx, sy = (0.55, 0.36) if f == "front" else (0.36, 0.55)
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                lib.cyl(f"rs{k}post{dx}{dy}", 0.014, 0.4, (x + dx * sx / 2, y + dy * sy / 2, 0.2), m["wood"], verts=5)
            lean_to(f"rs{k}mat", x, y, sx + 0.08, sy + 0.08, 0.4, reed, down=f)
            lib.cyl(f"rs{k}grain", 0.08, 0.07, (x, y, 0.035), grain_m, verts=12, r2=0.01)
            lib.ball(f"rs{k}jar", 0.04, (x + 0.12, y - 0.05, 0.05), clay, scale=(1, 1, 1.3), sub=1)
        for k, (x, y, h) in enumerate(((0.35, -0.2, 0.9), (-0.3, -0.6, 0.8), (0.95, -0.55, 0.85))):
            arch.palm(st, f"mdate{k}", x, y, h)
        well(st, 0.3, 0.3, "mwell")
    elif a == "babylonian":
        tent = [lib.mat("tent-red", (0.62, 0.22, 0.16), 0.9, grain=0.2), lib.mat("tent-ochre", (0.80, 0.58, 0.26), 0.9, grain=0.2)]
        for k, (x, y, f) in enumerate(((-0.1, 0.95, "front"), (-0.98, -0.15, "right"))):
            w, d = (2.0, 0.5) if f == "front" else (0.5, 1.5)
            for j in range(4):
                t = -0.5 + j / 3
                px, py = (x + t * w, y - d / 2) if f == "front" else (x + d / 2, y + t * d)
                lib.cyl(f"tentpole{k}{j}", 0.014, 0.4, (px, py, 0.2), m["wood"], verts=5)
            lean_to(f"tent{k}", x, y, w, d, 0.42, tent[k], down=f)
        for k, (x, y) in enumerate(((0.2, 0.55), (0.55, 0.6), (-0.6, -0.4), (-0.65, 0.3))):
            for j in range(3):
                lib.ball(f"potheap{k}{j}", 0.045, (x + (j - 1) * 0.07, y, 0.05 + (j == 1) * 0.06), clay, scale=(1, 1, 1.2), sub=1)
        for k, (x, y, h) in enumerate(((0.45, -0.25, 0.9), (1.0, -0.6, 0.8), (0.95, 0.3, 0.85))):
            arch.palm(st, f"mpalm{k}", x, y, h)
    else:  # asian
        for k, (x, y, f) in enumerate(spots[:4]):
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                lib.box(f"as{k}post{dx}{dy}", (0.035, 0.035, 0.38), (x + dx * 0.22, y + dy * 0.15, 0.19), st.trim)
            lib.box(f"as{k}counter", (0.4, 0.22, 0.12), (x, y, 0.06), m["wood"], bevel=0.01)
            arch.asian_roof(st, f"as{k}roof", x, y, 0.44, 0.3, 0.38)
            lib.cyl(f"as{k}basket", 0.05, 0.05, (x - 0.1, y, 0.15), basket, verts=10)
        parasol = lib.mat("parasol-red", (0.66, 0.20, 0.14), 0.9)
        for k, (x, y) in enumerate(((0.3, -0.3), (0.95, -0.7))):
            lib.box(f"ptable{k}", (0.28, 0.18, 0.1), (x, y, 0.05), m["wood"], bevel=0.008)
            lib.cyl(f"ppole{k}", 0.01, 0.42, (x, y, 0.21), m["wood"], verts=5)
            lib.cyl(f"parasol{k}", 0.22, 0.08, (x, y, 0.44), parasol, verts=16, r2=0.02)
        well(st, -0.3, -0.5, "mwell")
        bamboo("mbamboo", 1.05, 0.55, 6, 0.7)
        pine("mpine", -0.85, 0.85, 0.85, lean=0.06)
    flag(st, 1.2, 1.15, 1.0)


# The markets of the east are their own, with more trees: see market_iron.
EAST_MARKETS = {"asian": market_asian, "egyptian": market_egyptian, "babylonian": market_babylonian}


def market(st):
    """A walled market: a gate at the front, stalls along the back and left walls under awnings of plain
    cloth with their wares (pots, baskets of fruit, sacks, bolts of cloth), the storehouse in the back corner,
    a well in the square."""
    if st.age == "iron":
        return market_iron(st)
    if st.age == "bronze" and getattr(st, "arch", "default") in EAST_MARKETS:
        return market_bronze_east(st, st.arch)
    ground(3, (0.62, 0.56, 0.44) if st.stone else (0.50, 0.40, 0.27))
    enclosure(st, 1.3, 0.26, (-0.35, 0.35), name="mwall")
    gateway(st, -0.35, 0.35, -1.3, 0.68, name="mgate")
    hall(st, "store", -0.8, 0.8, 0.8, 0.8, 0.5 if st.thatch else 0.6, roof="flat" if st.age == "bronze" else "gable", along="x")
    door(st, -0.8, 0.39, 0.22, 0.32)
    cloth = [lib.mat("cloth-cream", (0.86, 0.80, 0.64), 0.9, grain=0.2), lib.mat("cloth-ochre", (0.78, 0.55, 0.24), 0.9, grain=0.2),
             lib.mat("cloth-red", (0.58, 0.22, 0.15), 0.9, grain=0.2), lib.mat("cloth-green", (0.36, 0.44, 0.26), 0.9, grain=0.2)]
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    basket = lib.mat("basket", (0.55, 0.40, 0.20), 0.9, grain=0.4, grain_size=0.01)
    sack = lib.mat("sack", (0.74, 0.66, 0.50), 1.0, grain=0.3)
    fruit = [lib.mat("fruit-orange", (0.86, 0.50, 0.14), 0.6), lib.mat("fruit-green", (0.46, 0.60, 0.20), 0.6),
             lib.mat("fruit-red", (0.66, 0.16, 0.12), 0.6)]

    def stall(k, x, y, facing):
        """One stall against a wall, open toward the square; `facing` is the way it opens: "front" (-Y) or
        "right" (+X)."""
        w, d = 0.5, 0.32
        sx, sy = (w, d) if facing == "front" else (d, w)
        for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            tall = (dy > 0) if facing == "front" else (dx < 0)
            ph = 0.5 if tall else 0.4
            lib.cyl(f"st{k}post{dx}{dy}", 0.016, ph, (x + dx * sx / 2, y + dy * sy / 2, ph / 2), st.wood, verts=6)
        # The awning slopes down toward the square.
        rot = (R(-12), 0, 0) if facing == "front" else (0, R(-12), 0)
        lib.box(f"st{k}awning", (sx + 0.08, sy + 0.08, 0.02), (x, y, 0.46), cloth[k % len(cloth)], rot=rot)
        cx, cy = (x, y - d * 0.15) if facing == "front" else (x + d * 0.15, y)
        lib.box(f"st{k}counter", (sx * 0.9, sy * 0.55, 0.13) if facing == "front" else (sx * 0.55, sy * 0.9, 0.13),
                (cx, cy, 0.065), st.wood, bevel=0.01)
        # Wares on the counter and in front of it.
        for j in range(3):
            t = (j - 1) * 0.14
            px, py = (cx + t, cy) if facing == "front" else (cx, cy + t)
            kind = (k + j) % 3
            if kind == 0:
                lib.ball(f"st{k}pot{j}", 0.045, (px, py, 0.17), clay, scale=(1, 1, 1.25), sub=2)
            elif kind == 1:
                lib.cyl(f"st{k}basket{j}", 0.05, 0.04, (px, py, 0.15), basket, verts=10)
                for q in range(3):
                    lib.ball(f"st{k}fruit{j}{q}", 0.02, (px + (q - 1) * 0.022, py, 0.18), fruit[(k + q) % 3], sub=1)
            else:
                lib.box(f"st{k}bolt{j}", (0.09, 0.05, 0.04), (px, py, 0.15), cloth[(k + j + 1) % len(cloth)], bevel=0.01)
        sx2, sy2 = (cx + 0.18, cy - 0.2) if facing == "front" else (cx + 0.2, cy - 0.18)
        lib.ball(f"st{k}sack", 0.055, (sx2, sy2, 0.05), sack, scale=(1, 1, 1.1), sub=1)

    for k, x in enumerate((0.1, 0.75)):
        stall(k, x, 1.02, "front")
    for k, y in enumerate((-0.55, 0.12)):
        stall(k + 2, -1.02, y, "right")
    # A row down the middle of the square, open toward the gate.
    for k, x in enumerate((-0.25, 0.4)):
        stall(k + 4, x, 0.2, "front")
    # A well by the gate: a ring of stone, dark water, a beam and a bucket over it.
    stone = lib.mat("wellstone", (0.48, 0.45, 0.40), 0.95, grain=0.35, grain_size=0.015)
    lib.cyl("well", 0.15, 0.16, (0.85, -0.7, 0.08), stone, verts=18)
    lib.cyl("water", 0.11, 0.01, (0.85, -0.7, 0.155), lib.mat("wellwater", (0.06, 0.10, 0.12), 0.2), verts=16)
    for dx in (-0.13, 0.13):
        lib.cyl(f"wellpost{dx}", 0.015, 0.36, (0.85 + dx, -0.7, 0.18), st.wood, verts=6)
    lib.cyl("wellbeam", 0.012, 0.3, (0.85, -0.7, 0.35), st.wood, rot=(0, R(90), 0), verts=6)
    lib.cyl("bucket", 0.03, 0.05, (0.85, -0.7, 0.27), st.wood, verts=8)
    # Crates and jars by the gate.
    for k, (x, y) in enumerate(((-0.6, -1.05), (-0.48, -1.0), (0.55, -1.05))):
        lib.box(f"crate{k}", (0.11, 0.11, 0.1), (x, y, 0.05), st.wood, bevel=0.008)
    for k, x in enumerate((-0.75, -0.66)):
        lib.ball(f"jar{k}", 0.05, (x, -0.9, 0.06), clay, scale=(1, 1, 1.3), sub=2)
    flag(st, 1.2, 1.15, 1.0)


def farm(st):
    """A field of round 3 of the plan: ridged rows with the crop standing in them, green going to gold, a
    scarecrow at a corner; an Egyptian irrigation channel along one side, Asian paddies under water with rice
    in rows and dikes between them."""
    a = getattr(st, "arch", "default")
    soil = lib.mat("soil", (0.40, 0.28, 0.17), 1.0, grain=0.35, grain_size=0.03)
    lib.box("field", (2.9, 2.9, 0.03), (0, 0, 0.015), soil)
    rnd = random.Random(7)
    if a == "asian":
        water = lib.mat("paddywater", (0.30, 0.42, 0.36), 0.15)
        rice = lib.mat("rice", (0.42, 0.62, 0.22), 0.9, grain=0.3)
        for qx in (-0.72, 0.72):
            for qy in (-0.72, 0.72):
                lib.box(f"paddy{qx}{qy}", (1.3, 1.3, 0.02), (qx, qy, 0.035), water)
                for i in range(7):
                    for j in range(7):
                        lib.cyl(f"rice{qx}{qy}{i}{j}", 0.022, 0.11, (qx - 0.54 + i * 0.18, qy - 0.54 + j * 0.18, 0.09), rice, verts=5, r2=0.0)
        dike = lib.mat("dike", (0.36, 0.30, 0.18), 1.0, grain=0.3)
        lib.mottle(dike, MOSS, 0.15, 0.4)
        for k, (size, loc) in enumerate((((2.9, 0.12, 0.06), (0, 0, 0.04)), ((0.12, 2.9, 0.06), (0, 0, 0.04)), ((2.9, 0.1, 0.06), (0, -1.42, 0.04)), ((0.1, 2.9, 0.06), (1.42, 0, 0.04)))):
            lib.box(f"dike{k}", size, loc, dike)
    else:
        ridge = lib.mat("ridge", (0.46, 0.33, 0.20), 1.0, grain=0.35, grain_size=0.03)
        crops = [lib.mat("crop-green", (0.46, 0.58, 0.22), 0.9), lib.mat("crop-ripe", (0.82, 0.70, 0.30), 0.9, grain=0.3),
                 lib.mat("crop-gold", (0.88, 0.76, 0.36), 0.9, grain=0.3)]
        length = 2.6 if a != "egyptian" else 2.3
        cx = 0.0 if a != "egyptian" else -0.15
        for k in range(9):
            y = -1.25 + k * 0.31
            lib.box(f"ridge{k}", (length, 0.2, 0.04), (cx, y, 0.04), ridge, bevel=0.02)
            # The crop standing in the row: a lumpy band, green in some rows and gold in others, tufts on it.
            c = crops[(k * 2) % 3]
            band = lib.box(f"crop{k}", (length - 0.08, 0.15, 0.1), (cx, y, 0.11), c, bevel=0.04)
            lib.lumpy(band, 0.03, 0.03)
            for j in range(12):
                x = cx - length / 2 + 0.1 + j * (length - 0.2) / 11 + rnd.uniform(-0.03, 0.03)
                lib.cyl(f"ear{k}{j}", 0.03, rnd.uniform(0.08, 0.12), (x, y + rnd.uniform(-0.03, 0.03), 0.2), crops[(k * 2 + j) % 3], verts=5, r2=0.004)
        if a == "egyptian":
            lib.box("channel", (0.22, 2.9, 0.02), (1.32, 0, 0.04), lib.mat("channelwater", (0.20, 0.36, 0.42), 0.15))
            papyrus("farm-papyrus", 1.32, 1.2, 4)
    # The scarecrow at the front corner.
    m = mats()
    lib.cyl("scarepost", 0.012, 0.42, (1.2, -1.2, 0.21), m["wood"], verts=5)
    lib.cyl("scarearms", 0.01, 0.3, (1.2, -1.2, 0.34), m["wood"], rot=(0, R(90), 0), verts=5)
    lib.cyl("scarecoat", 0.05, 0.16, (1.2, -1.2, 0.3), lib.mat("sack", (0.74, 0.66, 0.50), 1.0, grain=0.3), verts=8, r2=0.03)
    lib.ball("scarehead", 0.035, (1.2, -1.2, 0.43), m["straw"], sub=1)


def ballista_top(st, h, name="ballista"):
    """A bolt thrower on a tower's top: a stock on a post, two arms and their string, a bolt laid in it."""
    m = mats()
    lib.cyl(f"{name}-post", 0.03, 0.14, (0, 0, h + 0.07), m["wood"], verts=6)
    lib.box(f"{name}-stock", (0.06, 0.46, 0.05), (0, -0.05, h + 0.16), m["wood"], rot=(R(8), 0, 0))
    for sx in (-1, 1):
        lib.box(f"{name}-arm{sx}", (0.24, 0.035, 0.035), (sx * 0.12, -0.22, h + 0.18), m["wood"], rot=(0, 0, R(sx * 18)))
    lib.cyl(f"{name}-string", 0.004, 0.46, (0, -0.2, h + 0.18), m["rope"], rot=(0, R(90), 0), verts=4)
    lib.cyl(f"{name}-bolt", 0.008, 0.4, (0, -0.1, h + 0.2), m["iron"], rot=(R(90), 0, 0), verts=4)


def tower(st, kind):
    """A tower of each architecture, a grade taller and better built at each step from Watch to Ballista
    (round 3 of replica/art-plan.md): Egyptian leaning pylon towers, Babylonian brick towers with
    battlements and glaze, Asian timber towers of storeys under curved roofs, Greek round stone towers with
    a conical roof, Roman square stone towers with arched windows; the default style keeps its own."""
    a = getattr(st, "arch", "default")
    grade = ["watch_tower", "sentry_tower", "guard_tower", "ballista_tower"].index(kind)
    h = [1.25, 1.45, 1.7, 1.85][grade]
    ground(2)
    if a == "default":
        return tower_default(st, kind)
    m = mats()
    if a == "egyptian":
        w = 0.7 + 0.06 * grade
        arch.tapered("towerbody", w, w, h, (0, 0, 0), st.wall, top=0.78)
        arch.cornice(st, "towercornice", 0, 0, w * 0.8, w * 0.8, h)
        lib.box("towerband", (w * 0.86, w * 0.86, 0.05), (0, 0, h * 0.72), st.accent)
        top = h + 0.1
        if grade == 0:
            # Palm logs and a shade of matting over the top.
            for k in range(5):
                lib.cyl(f"roofpole{k}", 0.015, 0.6, (-0.24 + k * 0.12, 0, top + 0.05), m["log"], rot=(R(90), 0, 0), verts=5)
        for sx in (-1, 1):
            lib.cyl(f"mast{sx}", 0.01, 0.5, (sx * w * 0.3, -w * 0.42, top + 0.2), m["wood"], verts=5)
            lib.box(f"pennant{sx}", (0.015, 0.12, 0.07), (sx * w * 0.3, -w * 0.42 - 0.07, top + 0.38), st.team)
        door(st, 0.0, -w * 0.47, 0.18, 0.3)
    elif a == "babylonian":
        w = 0.72 + 0.05 * grade
        lib.box("towerbody", (w, w, h), (0, 0, h / 2), st.wall, bevel=0.01)
        for sx in (-1, 1):
            lib.box(f"buttress{sx}", (0.08, 0.06, h), (sx * w * 0.3, -w / 2 - 0.02, h / 2), st.wall)
        if grade >= 1:
            lib.box("towerglaze", (w + 0.02, w + 0.02, 0.09), (0, 0, h * 0.75), st.accent)
        arch.crenels(st, "towertop", 0, 0, w, w, h, size=0.09)
        top = h + 0.1
        arch.arch_door(st, 0, -w / 2 - 0.01, 0.18, 0.32)
    elif a == "asian":
        storeys = [1, 2, 2, 3][grade]
        w = 0.62 + 0.04 * grade
        z = 0.0
        if grade == 0:
            # A lookout on four posts.
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                lib.box(f"leg{dx}{dy}", (0.06, 0.06, 0.8), (dx * w * 0.42, dy * w * 0.42, 0.4), st.trim)
            lib.box("deck", (w + 0.1, w + 0.1, 0.05), (0, 0, 0.8), m["wood"])
            z = 0.82
        for k in range(storeys):
            sh = 0.42 if grade else 0.3
            ww = w * (1 - 0.12 * k)
            lib.box(f"storey{k}", (ww, ww, sh), (0, 0, z + sh / 2), st.wall, bevel=0.01)
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                lib.box(f"post{k}{dx}{dy}", (0.05, 0.05, sh), (dx * ww / 2, dy * ww / 2, z + sh / 2), st.trim)
            z = arch.asian_roof(st, f"roof{k}", 0, 0, ww, ww, z + sh) - 0.05
        top = z
        if grade == 0:
            lib.box("ladder", (0.08, 0.02, 0.8), (0.1, -w * 0.5, 0.4), m["wood"], rot=(R(12), 0, 0))
        else:
            door(st, 0, -w / 2, 0.16, 0.28)
    elif a == "greek":
        r = 0.36 + 0.03 * grade
        lib.cyl("towerbody", r, h, (0, 0, h / 2), st.wall, verts=20, r2=r * 0.92)
        lib.cyl("towerring", r * 0.98, 0.05, (0, 0, h * 0.62), st.trim, verts=20)
        lib.cyl("towerparapet", r * 0.98, 0.12, (0, 0, h + 0.06), st.trim, verts=20)
        lib.cyl("towerroof", r * 1.08, 0.38, (0, 0, h + 0.31), st.roof, verts=20, r2=0.03)
        top = h + 0.5
        door(st, 0.0, -r, 0.18, 0.3)
        for k in range(3):
            lib.box(f"window{k}", (0.05, 0.03, 0.12), (-0.18 + k * 0.18, -r * 0.92, h * 0.82), st.dark)
    else:  # roman
        w = 0.7 + 0.05 * grade
        lib.box("towerbody", (w, w, h), (0, 0, h / 2), st.wall, bevel=0.01)
        for sx in (-1, 1):
            for sy in (-1, 1):
                lib.box(f"quoin{sx}{sy}", (0.08, 0.08, h), (sx * w / 2, sy * w / 2, h / 2), st.trim)
        for k in range(2):
            lib.box(f"window{k}", (0.1, 0.03, 0.16), (-0.15 + k * 0.3, -w / 2, h * 0.75), st.dark)
        arch.arch_door(st, 0, -w / 2 - 0.01, 0.2, 0.34)
        lib.box("towercap", (w + 0.08, w + 0.08, 0.05), (0, 0, h + 0.025), st.trim)
        if grade >= 2:
            arch.crenels(st, "towertop", 0, 0, w, w, h + 0.05, size=0.09)
            top = h + 0.15
        else:
            r_ = lib.cyl("towerroof", w * 0.8, 0.35, (0, 0, h + 0.22), st.roof, verts=4, r2=0.02)
            r_.rotation_euler = (0, 0, R(45))
            top = h + 0.4
    if kind == "ballista_tower":
        ballista_top(st, top if a in ("babylonian", "roman") else top - 0.05)
    flag(st, 0.0, 0.25, top + 0.45)


def tower_default(st, kind):
    if kind == "watch_tower":
        for dx, dy in ((-0.35, -0.35), (0.35, -0.35), (0.35, 0.35), (-0.35, 0.35)):
            lib.cyl(f"leg{dx}{dy}", 0.05, 1.4, (dx, dy, 0.7), st.wood, verts=8, r2=0.035)
        lib.box("platform", (0.95, 0.95, 0.06), (0, 0, 1.4), st.wood, bevel=0.01)
        palisade(st, -0.45, -0.45, 0.45, -0.45, 0.2, gap=0.07)
        r = lib.cyl("towerroof", 0.7, 0.45, (0, 0, 1.75), st.roof, verts=4, r2=0.02)
        r.rotation_euler = (0, 0, R(45))
        flag(st, 0, 0, 2.3)
        return
    stone = kind != "sentry_tower"
    h = {"sentry_tower": 1.4, "guard_tower": 1.7, "ballista_tower": 1.9}[kind]
    body = st.wall if stone else lib.mat("towerwall", (0.68, 0.62, 0.52), 0.95)
    lib.cyl("towerbody", 0.55, h, (0, 0, h / 2), body, verts=8, r2=0.48)
    for k in range(8):
        a = 2 * math.pi * k / 8 + math.pi / 8
        lib.box(f"merlon{k}", (0.16, 0.16, 0.14), (math.cos(a) * 0.5, math.sin(a) * 0.5, h + 0.07), body, rot=(0, 0, a))
    lib.box("slit", (0.04, 0.03, 0.25), (0.25, -0.47, h * 0.6), st.dark, rot=(0, 0, R(-30)))
    door(st, 0.2, -0.5, 0.22, 0.35)
    if kind == "ballista_tower":
        lib.box("ballista", (0.06, 0.5, 0.06), (0, -0.05, h + 0.12), st.wood, rot=(R(10), 0, 0))
        lib.box("arms", (0.5, 0.05, 0.04), (0, -0.2, h + 0.15), st.wood)
    flag(st, 0, 0.2, h + 0.6)


def wall(st, tier):
    pass  # walls join their neighbours: drawn by the game


def government_center(st):
    ground(3, (0.64, 0.60, 0.52))
    base = steps(st, 0, 0, 2.4, 2.1)
    hall(st, "main", 0, 0.1, 2.0, 1.7, 0.8, roof="gable", along="x", roof_h=0.35)
    columns(st, -0.9, 0.9, -0.85, 0.8, 7)
    lib.box("frieze", (2.1, 0.12, 0.08), (0, -0.85, base + 0.8), st.trim)
    door(st, 0, -0.76, 0.38, 0.5)
    lib.ball("dome", 0.42, (0, 0.2, 1.15), st.trim if st.age == "iron" else st.wall, scale=(1, 1, 0.75), sub=3)
    banner(st, -0.6, -0.77, 0.5)
    banner(st, 0.6, -0.77, 0.5)
    flag(st, 0, 0.2, 1.9)


def temple(st):
    ground(3, (0.66, 0.62, 0.54))
    base = steps(st, 0, 0.1, 2.2, 1.9, n=4)
    lib.box("cella", (1.5, 1.2, 0.85), (0, 0.2, base + 0.425), st.wall, bevel=0.02)
    for y in (-0.65, 0.95):
        columns(st, -0.95, 0.95, y, 0.9, 6, r=0.05)
    for x in (-0.95, 0.95):
        for k, y in enumerate((-0.25, 0.15, 0.55)):
            lib.cyl(f"scol{x}{k}", 0.05, 0.9, (x, y, base + 0.45), st.trim, verts=12)
    lib.box("entab", (2.1, 1.75, 0.12), (0, 0.15, base + 0.96), st.trim, bevel=0.01)
    prism("pediment", 2.15, 1.8, 0.35, (0, 0.15, base + 1.02), st.roof, "y")
    door(st, 0, -0.41, 0.35, 0.55)
    # A fire on an altar before it, cypresses either side.
    lib.box("altar", (0.25, 0.25, 0.2), (0.6, -1.15, 0.1), st.trim)
    lib.ball("fire", 0.07, (0.6, -1.15, 0.25), lib.mat("flame", (1, 0.6, 0.1), 1.0, emit=(1.0, 0.5, 0.1)), sub=1)
    for k, (x, y) in enumerate(((-1.2, -1.0), (1.2, 0.4), (1.15, -0.6))):
        cypress(f"tcypress{k}", x, y, 0.8)
    banner(st, -0.6, -0.72, 0.6, 0.14, 0.3)


def academy(st):
    ground(3, (0.64, 0.60, 0.52))
    # A courtyard behind a columned front.
    hall(st, "back", 0, 0.85, 2.4, 0.7, 0.75, roof="gable", along="x")
    hall(st, "left", -0.95, 0.0, 0.6, 1.2, 0.7, roof="gable", along="y")
    columns(st, -0.6, 1.1, -0.85, 0.7, 6)
    lib.box("lintel", (1.9, 0.12, 0.08), (0.25, -0.85, 0.74), st.trim)
    court("court", 1.5, 1.1, (0.3, 0.05, 0.02))
    # The court of each architecture (round 5): a fountain for the Greeks, steps and straw men to
    # practise the sword on for the Romans, a colonnade and a statue for the Egyptians, a yard for
    # the martial arts for the Asians.
    a = getattr(st, "arch", "default")
    if a == "greek":
        fountain(st, 0.35, 0.05, "afountain")
    elif a == "roman":
        steps(st, 0.0, 0.42, 1.2, 0.2, n=3)
        for k, (x, y) in enumerate(((0.0, -0.1), (0.4, -0.2), (0.8, -0.05))):
            dummy(st, x, y, f"adummy{k}")
    elif a == "egyptian":
        colonnade(st, (-0.45, 0.4), (1.05, 0.4), 0.55, 5, "acol")
        sphinx(st, 0.35, -0.2, "asphinx")
    elif a == "asian":
        weapon_rack(st, 0.95, 0.15, "arack-a", along_x=False)
        weapon_rack(st, -0.3, 0.35, "arack-b", shields=0)
        for k, (x, y) in enumerate(((0.2, -0.1), (0.6, -0.15))):
            dummy(st, x, y, f"adummy{k}")
    else:
        lib.cyl("statue", 0.08, 0.4, (0.3, 0.0, 0.22), st.trim, verts=10)
    banner(st, 0.9, 0.49, 0.5)
    flag(st, 1.15, 1.15, 1.2)


def siege_workshop(st):
    """A siege workshop of the plan's round 2: the shop with its wide bay at the back, a yard before it with a
    stone thrower half built, beams and logs, a crane, a pile of shot, a wheel and sawhorses."""
    ground(3, (0.48, 0.40, 0.26))
    a = getattr(st, "arch", "default")
    hall(st, "shop", -0.35, 0.75, 1.9, 0.9, 0.8, along="x")
    lib.box("bay", (1.0, 0.03, 0.6), (-0.35, 0.29, 0.3), st.dark)
    enclosure(st, 1.3, 0.3, (-0.4, 0.4), name="wwall", crenel=a == "babylonian")
    gateway(st, -0.4, 0.4, -1.3, 0.62, name="wgate")
    court("yard", 2.0, 1.3, (0.0, -0.35, 0.01))
    catapult_frame(st, 0.2, -0.3, "catapult")
    log_pile(-0.8, -0.6, 5, "beams", along_x=False)
    crane(st, 0.85, 0.3, 0.95, "crane")
    m = mats()
    for k in range(6):
        lib.ball(f"shot{k}", 0.045, (0.85 + (k % 3) * 0.09, -0.85 + (k // 3) * 0.09, 0.045 + (k // 3) * 0.05), m["stone"], sub=1)
    for k, x in enumerate((-0.25, 0.1)):
        for d in (-0.08, 0.08):
            lib.cyl(f"saw{k}{d}", 0.01, 0.18, (x + d, -0.95, 0.08), m["wood"], rot=(0, R(d * 200), 0), verts=4)
        lib.box(f"sawbeam{k}", (0.22, 0.03, 0.03), (x, -0.95, 0.16), m["wood"])
    flag(st, 1.15, 1.1, 1.3)


def wonder(st):
    # A stepped tower of the age's best stone, a shrine on top, and banners.
    ground(5, (0.66, 0.62, 0.54))
    stone = st.wall
    z = 0.0
    for k, w in enumerate((4.4, 3.6, 2.8, 2.0)):
        h = 0.45
        lib.box(f"tier{k}", (w, w, h), (0, 0, z + h / 2), stone, bevel=0.03)
        lib.box(f"ledge{k}", (w + 0.08, w + 0.08, 0.05), (0, 0, z + h), st.trim)
        z += h
    lib.box("stair", (0.7, 2.2, 0.03), (0, -1.6, 0.9), st.trim, rot=(R(-38), 0, 0))
    lib.box("shrine", (1.1, 1.1, 0.7), (0, 0, z + 0.35), st.trim if st.stone else stone, bevel=0.02)
    lib.box("shrinedoor", (0.3, 0.03, 0.45), (0, -0.56, z + 0.22), st.dark)
    prism("shrineroof", 1.3, 1.3, 0.4, (0, 0, z + 0.7), st.roof, "x")
    for x in (-1.8, 1.8):
        banner(st, x, -2.25, 0.6, 0.25, 0.5)
    flag(st, 0, 0, z + 1.6)


def smaller(make, k=0.78):
    """A builder whose model is scaled down about the middle of its tiles: the original's houses and granaries
    are smaller than its other buildings, and ours stood a third to a half larger than its."""
    def made(st):
        make(st)
        lib.scale_all(k)
    return made


BUILDERS = {
    "town_center": town_center, "house": smaller(house), "granary": smaller(granary), "storage_pit": storage_pit, "barracks": barracks,
    "dock": dock, "archery_range": archery_range, "stable": stable, "market": market, "farm": farm,
    "watch_tower": lambda st: tower(st, "watch_tower"), "sentry_tower": lambda st: tower(st, "sentry_tower"),
    "guard_tower": lambda st: tower(st, "guard_tower"), "ballista_tower": lambda st: tower(st, "ballista_tower"),
    "government_center": government_center, "temple": temple, "academy": academy, "siege_workshop": siege_workshop,
    "wonder": wonder,
}
# The Stone Age's own, in stoneage.py.
for _key, _make in stoneage.BUILDERS.items():
    # The Stone Age's dock was as big as a Town Center: three quarters of it now, as the other ages'.
    _make = smaller(_make, 0.75) if _key == "dock" else _make
    BUILDERS[_key] = (lambda stone, later: lambda st: stone(st) if st.age == "stone" else later(st))(_make, BUILDERS[_key])
# The age each first appears in (the game's own), and the ages that get their own picture after it. A farm
# and the towers are each of one time only.
FIRST = {"town_center": 0, "house": 0, "granary": 0, "storage_pit": 0, "barracks": 0, "dock": 0, "archery_range": 1,
         "stable": 1, "market": 1, "farm": 1, "watch_tower": 1, "sentry_tower": 2, "guard_tower": 3, "ballista_tower": 3,
         "government_center": 2, "temple": 2, "academy": 2, "siege_workshop": 3, "wonder": 2}
ONE_LOOK = {"farm", "watch_tower", "sentry_tower", "guard_tower", "ballista_tower"}
SIZE = {"town_center": 3, "house": 2, "watch_tower": 2, "sentry_tower": 2, "guard_tower": 2, "ballista_tower": 2, "wonder": 5}


def frame_of(key):
    """Picture size (px, at twice the game's size), the scene point it is centred on, and the anchor."""
    n = SIZE.get(key, 3)
    tall = {"wonder": 3.5, "watch_tower": 2.4, "sentry_tower": 2.2, "guard_tower": 2.5, "ballista_tower": 2.7, "farm": 0.3}.get(key, 1.7)
    w = int(n * 128 + 120 + (60 if key == "government_center" else 0))  # the Roman one's porch ran out of it
    h = int(n * 64 + tall * 0.866 * lib.PPU + 70)
    lift = tall * 0.45
    return (w, h), (0.0, 0.0, lift), (n / 2, -n / 2, 0)
