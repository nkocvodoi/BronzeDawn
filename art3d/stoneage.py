# The Stone Age buildings: daub walls on a footing of fieldstones, timber posts, and thatch laid in tiers,
# each tier's eave bound with a darker cord, so a roof reads as straw laid in courses rather than one smooth
# cone. Round huts and longhouses stand on a yard filling their tiles, among the things of a camp: firewood,
# pots, baskets, hides on racks, wattle fences, a pole with the player's colour.
#
# Same conventions as buildings.py: one unit is one tile, the tiles run from -size/2 to size/2, and the front
# is toward the viewer, the scene's (+X, -Y) corner.

import math
import random

import lib

R = math.radians

DAUB = (0.66, 0.52, 0.36)
THATCH = (0.72, 0.60, 0.34)
THATCH_DARK = (0.46, 0.35, 0.18)
THATCH_OLD = (0.60, 0.49, 0.27)    # last year's courses, weathered darker
TIMBER = (0.38, 0.24, 0.12)
FIELDSTONE = (0.58, 0.55, 0.50)
CLAY = (0.70, 0.40, 0.24)
HIDE = (0.66, 0.48, 0.30)
WICKER = (0.74, 0.58, 0.32)


def mats():
    return {
        "daub": lib.mat("sa-daub", DAUB, 0.95, grain=0.35, grain_size=0.02),
        "thatch": lib.mat("sa-thatch", THATCH, 1.0, grain=0.55, grain_size=0.006),
        "thatchd": lib.mat("sa-thatchd", THATCH_DARK, 1.0, grain=0.3, grain_size=0.01),
        "thatch2": lib.mat("sa-thatch2", THATCH_OLD, 1.0, grain=0.55, grain_size=0.006),
        "timber": lib.mat("sa-timber", TIMBER, 0.8, grain=0.3, grain_size=0.01),
        "stone": lib.mat("sa-stone", FIELDSTONE, 0.9, grain=0.3, grain_size=0.02),
        "clay": lib.mat("sa-clay", CLAY, 0.8),
        "hide": lib.mat("sa-hide", HIDE, 0.9, grain=0.3, grain_size=0.02),
        "wicker": lib.mat("sa-wicker", WICKER, 0.9, grain=0.45, grain_size=0.006),
        "dark": lib.mat("door", (0.12, 0.08, 0.05), 1.0),
        "team": lib.team_mat("teamcloth"),
    }


def yard(size, seed=0):
    """Trodden earth over the whole of the tiles, ragged at the edge."""
    import buildings
    buildings.ground(size, (0.47, 0.37, 0.24))


# ---- roofs

def sub(o, cuts):
    """More faces on a flat-sided mesh, so `lumpy` has something to roughen."""
    bpy = lib.bpy
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.subdivide(number_cuts=cuts)
    bpy.ops.object.mode_set(mode="OBJECT")
    o.select_set(False)


def tiered_cone(m, name, x, y, z, r, h, tiers=3):
    """A conical thatch roof in `tiers` courses from the eave at height `z`, `r` across, up to a point `h`
    above it; each course's lower edge bound with dark cord. Crossed poles stick out of the top."""
    th = h / tiers
    for i in range(tiers):
        r0 = r * (1 - i / tiers * 0.82)
        r1 = r * (1 - (i + 1) / tiers * 0.82) * 0.94
        z0 = z + i * th * 0.92
        o = lib.cyl(f"{name}-t{i}", r0, th * 1.15, (x, y, z0 + th * 0.55), m["thatch" if i % 2 == 0 else "thatch2"], verts=36, r2=max(0.02, r1))
        lib.lumpy(o, 0.018, 0.03, seed=i)
        lib.cyl(f"{name}-cord{i}", r0 * 0.985, 0.03, (x, y, z0 + 0.03), m["thatchd"], verts=36, r2=r0 * 0.96)
    top = z + h
    lib.cyl(f"{name}-knot", 0.06, 0.1, (x, y, top - 0.02), m["thatchd"], verts=10, r2=0.02)
    for k, a in enumerate((35, 125)):
        lib.cyl(f"{name}-pole{k}", 0.012, 0.32, (x, y, top + 0.06), m["timber"], rot=(R(22), 0, R(a)), verts=6)
    return top


def tiered_gable(m, name, x, y, z, w, d, h, along="x", tiers=2):
    """A gable roof of thatch in courses, the lower one wider; a bundled ridge on top."""
    import buildings
    for i in range(tiers):
        k = 1 - i * 0.28
        ww, dd = (w + 0.16) * (1 if along == "x" else k), (d + 0.16) * (k if along == "x" else 1)
        zz = z + i * h * 0.34
        o = buildings.prism(f"{name}-t{i}", ww, dd, h * (1 - i * 0.34), (x, y, zz), m["thatch" if i % 2 == 0 else "thatch2"], along)
        sub(o, 3)
        lib.lumpy(o, 0.016, 0.03, seed=i + 3)
        # The course's eave, bound.
        if along == "x":
            lib.box(f"{name}-eave{i}a", (ww, 0.03, 0.03), (x, y - dd / 2 + 0.01, zz + 0.01), m["thatchd"])
            lib.box(f"{name}-eave{i}b", (ww, 0.03, 0.03), (x, y + dd / 2 - 0.01, zz + 0.01), m["thatchd"])
        else:
            lib.box(f"{name}-eave{i}a", (0.03, dd, 0.03), (x - ww / 2 + 0.01, y, zz + 0.01), m["thatchd"])
            lib.box(f"{name}-eave{i}b", (0.03, dd, 0.03), (x + ww / 2 - 0.01, y, zz + 0.01), m["thatchd"])
    ridge = z + h
    length = w + 0.2 if along == "x" else d + 0.2
    lib.cyl(f"{name}-ridge", 0.05, length, (x, y, ridge - 0.02), m["thatchd"], rot=(0, R(90), 0) if along == "x" else (R(90), 0, 0), verts=10)
    # Crossed sticks over each end of the ridge.
    for s in (-1, 1):
        ex, ey = (x + s * length / 2, y) if along == "x" else (x, y + s * length / 2)
        for k, a in enumerate((-30, 30)):
            rot = (R(a), 0, 0) if along == "x" else (0, R(a), 0)
            lib.cyl(f"{name}-x{s}{k}", 0.012, 0.3, (ex, ey, ridge + 0.08), m["timber"], rot=rot, verts=6)
    return ridge


# ---- walls

def footing(m, name, x, y, r, n, seed):
    """Fieldstones round the foot of a round wall."""
    rnd = random.Random(seed)
    for i in range(n):
        a = 2 * math.pi * (i + rnd.random() * 0.4) / n
        s = lib.ball(f"{name}-fs{i}", 0.045 + rnd.random() * 0.025, (x + r * math.cos(a), y + r * math.sin(a), 0.03), m["stone"], sub=1)
        s.scale = (1.3, 1.0, 0.7)
        s.rotation_euler = (0, 0, a)


def round_hut(m, name, x, y, r, wall_h, roof_h, door_angle=-45, tiers=3):
    """A round hut: daub on wattle between timber posts, on fieldstones, under tiered thatch."""
    walls = lib.cyl(f"{name}-walls", r, wall_h, (x, y, wall_h / 2), m["daub"], verts=32, r2=r * 0.95)
    lib.lumpy(walls, 0.01, 0.08)
    for i in range(10):
        a = 2 * math.pi * i / 10 + R(door_angle) + math.pi / 10
        lib.cyl(f"{name}-post{i}", 0.026, wall_h, (x + r * 0.99 * math.cos(a), y + r * 0.99 * math.sin(a), wall_h / 2), m["timber"], verts=6)
    footing(m, name, x, y, r * 1.02, int(14 * r + 8), hash(name) % 97)
    a = R(door_angle)
    dx, dy = math.cos(a), math.sin(a)
    dw, dh = r * 0.42, wall_h * 0.78
    lib.box(f"{name}-door", (0.05, dw, dh), (x + dx * r * 0.97, y + dy * r * 0.97, dh / 2), m["dark"], rot=(0, 0, a))
    # The door's frame: two posts and a lintel standing out of the wall.
    for s in (-1, 1):
        px, py = x + dx * r * 1.0 - dy * s * dw * 0.55, y + dy * r * 1.0 + dx * s * dw * 0.55
        lib.cyl(f"{name}-jamb{s}", 0.025, dh + 0.04, (px, py, (dh + 0.04) / 2), m["timber"], verts=6)
    lib.box(f"{name}-lintel", (0.05, dw * 1.4, 0.05), (x + dx * r * 1.0, y + dy * r * 1.0, dh + 0.03), m["timber"], rot=(0, 0, a))
    return tiered_cone(m, name, x, y, wall_h - 0.04, r * 1.2, roof_h, tiers)


def longhouse(m, name, x, y, w, d, wall_h, roof_h, along="x"):
    """A rectangular hall: daub walls with timber at the corners and along them, a tiered gable of thatch."""
    lib.box(f"{name}-walls", (w, d, wall_h), (x, y, wall_h / 2), m["daub"], bevel=0.03)
    n = max(2, int((w if along == "x" else d) / 0.4))
    for s in (-1, 1):
        for i in range(n + 1):
            k = -0.5 + i / n
            px, py = (x + k * w, y + s * d / 2) if along == "x" else (x + s * w / 2, y + k * d)
            lib.cyl(f"{name}-p{s}{i}", 0.03, wall_h, (px, py, wall_h / 2), m["timber"], verts=6)
    lib.box(f"{name}-sill", (w + 0.06, d + 0.06, 0.06), (x, y, 0.03), m["stone"], bevel=0.02)
    return tiered_gable(m, name, x, y, wall_h - 0.03, w, d, roof_h, along)


# ---- the things of a camp

def woodpile(m, name, x, y, n=6, length=0.36):
    for k in range(n):
        row, col = divmod(k, 3)
        lib.cyl(f"{name}-log{k}", 0.045, length, (x, y - 0.1 + col * 0.095 + row * 0.047, 0.045 + row * 0.08), m["timber"], rot=(0, R(90), 0), verts=8)


def pots(m, name, x, y, n=3):
    for k in range(n):
        lib.ball(f"{name}-pot{k}", 0.06 - 0.008 * (k % 2), (x + k * 0.13, y + (k % 2) * 0.06, 0.06), m["clay"], scale=(1, 1, 1.25), sub=2)
        lib.cyl(f"{name}-lip{k}", 0.035, 0.03, (x + k * 0.13, y + (k % 2) * 0.06, 0.135), m["clay"], verts=10)


def basket(m, name, x, y, r=0.08, fill=None):
    lib.cyl(f"{name}", r * 0.85, r * 1.1, (x, y, r * 0.55), m["wicker"], verts=14, r2=r)
    if fill is not None:
        lib.ball(f"{name}-fill", r * 0.85, (x, y, r * 1.05), fill, scale=(1, 1, 0.4), sub=1)


def hide_rack(m, name, x, y, along="x"):
    for s in (-1, 1):
        px, py = (x + s * 0.24, y) if along == "x" else (x, y + s * 0.24)
        lib.cyl(f"{name}-leg{s}", 0.015, 0.48, (px, py, 0.24), m["timber"], verts=6)
    lib.cyl(f"{name}-bar", 0.014, 0.56, (x, y, 0.47), m["timber"], rot=(0, R(90), 0) if along == "x" else (R(90), 0, 0), verts=6)
    size = (0.4, 0.02, 0.3) if along == "x" else (0.02, 0.4, 0.3)
    hide = lib.box(f"{name}-hide", size, (x, y, 0.31), m["hide"], bevel=0.01)
    lib.lumpy(hide, 0.01, 0.06)


def wattle(m, name, x0, y0, x1, y1, h=0.32):
    """A fence of woven withies between stakes."""
    length = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(length / 0.3))
    a = math.atan2(y1 - y0, x1 - x0)
    for i in range(n + 1):
        k = i / n
        lib.cyl(f"{name}-st{i}", 0.02, h + 0.05, (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, (h + 0.05) / 2), m["timber"], verts=6)
    for j in range(3):
        lib.box(f"{name}-w{j}", (length, 0.025, 0.06), ((x0 + x1) / 2, (y0 + y1) / 2, 0.08 + j * (h - 0.1) / 2), m["wicker"], rot=(0, 0, a))


def palisade(m, name, x0, y0, x1, y1, h=0.5):
    """Sharpened stakes side by side."""
    length = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(length / 0.08))
    rnd = random.Random(hash(name) % 1000)
    for i in range(n + 1):
        k = i / n
        hh = h * (0.9 + rnd.random() * 0.2)
        px, py = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
        lib.cyl(f"{name}-s{i}", 0.04, hh, (px, py, hh / 2), m["timber"], verts=6)
        lib.cyl(f"{name}-tip{i}", 0.04, 0.1, (px, py, hh + 0.05), m["timber"], verts=6, r2=0.003)


def banner_pole(m, name, x, y, h):
    lib.cyl(f"{name}-pole", 0.02, h, (x, y, h / 2), m["timber"], verts=8)
    lib.box(f"{name}-cross", (0.02, 0.3, 0.02), (x, y - 0.13, h - 0.04), m["timber"])
    cloth = lib.box(f"{name}-cloth", (0.015, 0.26, 0.3), (x, y - 0.14, h - 0.21), m["team"])
    lib.lumpy(cloth, 0.008, 0.08)
    # Feathers or tassels hanging off the cross-bar.
    for k in range(3):
        lib.cyl(f"{name}-tas{k}", 0.008, 0.1, (x, y - 0.04 - k * 0.09, h - 0.42), m["thatchd"], verts=5)


def hearth(m, name, x, y):
    for i in range(9):
        a = 2 * math.pi * i / 9
        s = lib.ball(f"{name}-hs{i}", 0.045, (x + 0.15 * math.cos(a), y + 0.15 * math.sin(a), 0.03), m["stone"], sub=1)
        s.scale = (1.2, 1.0, 0.75)
    lib.cyl(f"{name}-embers", 0.11, 0.025, (x, y, 0.02), lib.mat("ember", (0.3, 0.1, 0.02), 1.0, emit=(1.0, 0.35, 0.05)), verts=12)
    for k, a in enumerate((0, 120, 240)):
        lib.cyl(f"{name}-stick{k}", 0.012, 0.2, (x + 0.03 * math.cos(R(a)), y + 0.03 * math.sin(R(a)), 0.07), m["timber"], rot=(R(60), 0, R(a)), verts=5)


# ---- the buildings

def house(st):
    m = mats()
    yard(2)
    round_hut(m, "hut", -0.1, 0.12, 0.58, 0.42, 0.68, door_angle=-45)
    # A lean-to for firewood against the back, a fence round the side, pots by the door.
    lib.box("leanroof", (0.5, 0.36, 0.03), (0.55, 0.45, 0.32), m["thatch"], rot=(R(-18), 0, R(0)))
    for dx in (0.33, 0.77):
        lib.cyl(f"leanpost{dx}", 0.02, 0.3, (dx, 0.32, 0.15), m["timber"], verts=6)
    woodpile(m, "wood", 0.5, 0.45, 6, 0.36)
    wattle(m, "fence", -0.85, 0.85, 0.2, 0.85)
    wattle(m, "fence2", -0.85, -0.3, -0.85, 0.85)
    pots(m, "pots", 0.35, -0.65)
    basket(m, "basket", -0.4, -0.65, 0.08, m["clay"])
    banner_pole(m, "flag", 0.75, -0.25, 0.9)


def town_center(st):
    m = mats()
    yard(3)
    # The chief's great hut, two lesser huts beside it, and the fire in front.
    round_hut(m, "great", -0.25, 0.3, 0.8, 0.5, 0.95, door_angle=-45, tiers=4)
    round_hut(m, "west", -0.95, -0.75, 0.36, 0.32, 0.46, door_angle=-15)
    round_hut(m, "north", 0.8, 0.85, 0.34, 0.3, 0.44, door_angle=-75)
    hearth(m, "fire", 0.55, -0.45)
    hide_rack(m, "rack", 0.5, -1.15)
    woodpile(m, "wood", 1.1, -0.35, 6, 0.4)
    pots(m, "pots", -0.35, -0.95)
    basket(m, "b1", 0.05, -1.05, 0.08, lib.mat("grainfill", (0.86, 0.74, 0.40), 0.9))
    palisade(m, "back1", -1.45, 1.45, 0.3, 1.45, 0.5)
    palisade(m, "back2", -1.45, -0.2, -1.45, 1.45, 0.5)
    banner_pole(m, "flag1", 1.25, -1.2, 1.15)
    banner_pole(m, "flag2", -0.25, 0.3, 2.05)


def barracks(st):
    m = mats()
    yard(3)
    longhouse(m, "hall", -0.2, 0.35, 2.0, 1.05, 0.52, 0.55, along="x")
    lib.box("halldoor", (0.36, 0.04, 0.4), (-0.2, -0.19, 0.2), m["dark"])
    for s in (-1, 1):
        lib.cyl(f"jamb{s}", 0.03, 0.44, (-0.2 + s * 0.21, -0.2, 0.22), m["timber"], verts=6)
    palisade(m, "back1", -1.45, 1.45, 1.45, 1.45, 0.55)
    palisade(m, "back2", -1.45, -1.0, -1.45, 1.45, 0.55)
    # A rack of spears, shields in the player's colour, and a straw man to train on.
    for k in range(6):
        lib.cyl(f"spear{k}", 0.012, 0.7, (0.55 + k * 0.08, -0.85, 0.35), m["timber"], rot=(R(-12), 0, 0), verts=6)
        lib.cyl(f"spearpt{k}", 0.02, 0.06, (0.55 + k * 0.08, -0.92, 0.72), lib.mat("flint", (0.35, 0.33, 0.36), 0.4), rot=(R(-12), 0, 0), verts=4, r2=0.002)
    lib.box("rackbar", (0.55, 0.03, 0.03), (0.75, -0.82, 0.45), m["timber"])
    for k in range(2):
        lib.cyl(f"shield{k}", 0.11, 0.025, (0.6 + k * 0.3, -1.05, 0.13), m["team"], rot=(R(75), 0, 0), verts=16)
    lib.cyl("dummypost", 0.025, 0.55, (-0.85, -0.95, 0.27), m["timber"], verts=6)
    straw = lib.mat("straw", (0.82, 0.70, 0.38), 0.95, grain=0.4, grain_size=0.01)
    lib.ball("dummy", 0.12, (-0.85, -0.95, 0.5), straw, scale=(1, 0.8, 1.4), sub=2)
    lib.box("dummyarms", (0.36, 0.04, 0.04), (-0.85, -0.95, 0.55), m["timber"])
    banner_pole(m, "flag", 1.2, 1.0, 1.2)


def granary(st):
    m = mats()
    yard(3)
    # Round stores on stilts out of the damp, a ladder to one, and a hall to thresh in.
    for i, (x, y, r) in enumerate(((-0.75, 0.65, 0.32), (0.25, 0.85, 0.3), (0.9, 0.05, 0.3))):
        for dx, dy in ((-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2)):
            lib.cyl(f"stilt{i}{dx}{dy}", 0.03, 0.26, (x + dx, y + dy, 0.13), m["timber"], verts=6)
        lib.box(f"deck{i}", (0.55, 0.55, 0.04), (x, y, 0.27), m["timber"], bevel=0.01)
        store = lib.cyl(f"store{i}", r, 0.34, (x, y, 0.46), m["daub"], verts=24, r2=r * 0.93)
        lib.lumpy(store, 0.008, 0.06)
        tiered_cone(m, f"sroof{i}", x, y, 0.6, r * 1.3, 0.42, tiers=2)
    lib.box("ladder1", (0.03, 0.03, 0.42), (0.68, -0.2, 0.2), m["timber"], rot=(R(-20), 0, 0))
    lib.box("ladder2", (0.03, 0.03, 0.42), (0.82, -0.2, 0.2), m["timber"], rot=(R(-20), 0, 0))
    for k in range(4):
        lib.box(f"rung{k}", (0.16, 0.02, 0.02), (0.75, -0.25 + k * 0.035, 0.06 + k * 0.1), m["timber"])
    longhouse(m, "hall", -0.35, -0.45, 1.15, 0.75, 0.38, 0.45, along="x")
    lib.box("halldoor", (0.26, 0.04, 0.3), (-0.35, -0.84, 0.15), m["dark"])
    sack = lib.mat("sack", (0.80, 0.70, 0.48), 0.9)
    for k in range(4):
        s = lib.ball(f"sack{k}", 0.08, (0.35 + 0.17 * k, -1.0, 0.08), sack, scale=(1, 0.9, 1.1), sub=2)
        lib.lumpy(s, 0.01, 0.05, seed=k)
    basket(m, "b1", 1.1, -0.7, 0.09, lib.mat("grainfill", (0.86, 0.74, 0.40), 0.9))
    basket(m, "b2", -1.15, -0.95, 0.08, lib.mat("grainfill", (0.86, 0.74, 0.40), 0.9))
    banner_pole(m, "flag", 1.2, -1.15, 0.95)


def storage_pit(st):
    m = mats()
    yard(3)
    lib.box("pit", (1.5, 1.3, 0.05), (-0.25, 0.25, 0.025), lib.mat("pitdark", (0.25, 0.18, 0.11), 1.0))
    # An open shelter on posts over the pit.
    for i, (dx, dy) in enumerate(((-0.95, -0.35), (0.45, -0.35), (0.45, 0.85), (-0.95, 0.85))):
        lib.cyl(f"post{i}", 0.04, 0.68, (dx, dy, 0.34), m["timber"], verts=6)
    lib.box("beam1", (1.5, 0.05, 0.05), (-0.25, -0.35, 0.68), m["timber"])
    lib.box("beam2", (1.5, 0.05, 0.05), (-0.25, 0.85, 0.68), m["timber"])
    tiered_gable(m, "shelter", -0.25, 0.25, 0.68, 1.45, 1.35, 0.5, along="x")
    # What is kept: logs stacked, ore in baskets, stone blocks.
    woodpile(m, "logs", 0.85, -0.6, 9, 0.6)
    stone = lib.mat("cutstone", (0.62, 0.60, 0.56), 0.9)
    for k in range(5):
        lib.box(f"block{k}", (0.16, 0.12, 0.1), (-1.0 + k * 0.2, -1.05, 0.05 + (k % 2) * 0.0), stone, bevel=0.015)
    lib.box("block5", (0.16, 0.12, 0.1), (-0.9, -1.05, 0.15), stone, bevel=0.015)
    basket(m, "ore1", -0.1, -0.75, 0.1, lib.mat("orefill", (0.85, 0.68, 0.22), 0.4, 0.6))
    basket(m, "ore2", 0.15, -0.95, 0.09, lib.mat("stonefill", (0.6, 0.58, 0.54), 0.9))
    banner_pole(m, "flag", 1.15, 1.05, 0.95)


def dock(st):
    m = mats()
    deck = lib.mat("deck", (0.55, 0.38, 0.20), 0.85, grain=0.4, grain_size=0.02)
    # Planks on piles, a thatched shed, fish on a drying rack, a dugout tied alongside.
    for k in range(7):
        lib.box(f"plank{k}", (2.8, 0.38, 0.07), (0, -1.2 + k * 0.4, 0.12), deck, bevel=0.012)
    for x in (-1.3, 0, 1.3):
        for y in (-1.3, 0, 1.3):
            lib.cyl(f"pile{x}{y}", 0.055, 0.34, (x, y, 0.02), m["timber"], verts=8)
            lib.cyl(f"pilet{x}{y}", 0.055, 0.14, (x, y, 0.2), m["timber"], verts=8)
    for dx, dy in ((-0.65, -0.45), (0.65, -0.45), (0.65, 0.45), (-0.65, 0.45)):
        lib.cyl(f"shedpost{dx}{dy}", 0.035, 0.45, (-0.45 + dx, 0.6 + dy, 0.38), m["timber"], verts=6)
    tiered_gable(m, "shed", -0.45, 0.6, 0.6, 1.3, 0.9, 0.45, along="x")
    fish = lib.mat("fishscale", (0.70, 0.74, 0.76), 0.35, 0.4)
    for s in (-1, 1):
        lib.cyl(f"frleg{s}", 0.015, 0.5, (0.75 + s * 0.3, -0.65, 0.4), m["timber"], verts=6)
    lib.cyl("frbar", 0.014, 0.66, (0.75, -0.65, 0.64), m["timber"], rot=(0, R(90), 0), verts=6)
    for k in range(5):
        f = lib.ball(f"dryfish{k}", 0.03, (0.53 + k * 0.11, -0.65, 0.53), fish, scale=(0.8, 0.6, 2.2), sub=1)
    canoe = lib.ball("canoe", 0.2, (1.55, 0.2, 0.02), m["timber"], scale=(0.6, 4.0, 0.6), sub=2)
    lib.cyl("rope", 0.008, 0.3, (1.42, 0.0, 0.18), m["thatchd"], rot=(0, R(70), 0), verts=5)
    for k in range(2):
        basket(m, f"fb{k}", -1.0 + k * 0.25, -0.95, 0.08, fish)
    banner_pole(m, "flag", -1.2, -1.2, 0.95)


BUILDERS = {"house": house, "town_center": town_center, "barracks": barracks, "granary": granary,
            "storage_pit": storage_pit, "dock": dock}
