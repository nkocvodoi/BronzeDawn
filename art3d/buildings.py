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

import lib
import models
import stoneage

R = math.radians
AGES = ["stone", "tool", "bronze", "iron"]


class Style:
    def __init__(self, age):
        self.age = age
        i = AGES.index(age)
        # Mud plastered, then mud brick, then whitewashed blocks, then cut stone; thatch, then tile.
        self.wall = lib.mat(f"wall{i}", [(0.60, 0.45, 0.30), (0.68, 0.52, 0.36), (0.86, 0.80, 0.68), (0.74, 0.70, 0.62)][i], 0.95,
                            grain=[0.3, 0.35, 0.18, 0.25][i], grain_size=0.02,
                            kind=[None, ("brick", 0.16, 0.07, 0.55), ("brick", 0.26, 0.11, 0.3), ("brick", 0.3, 0.13, 0.6)][i])
        self.roof = lib.mat(f"roof{i}", [(0.74, 0.60, 0.30), (0.70, 0.56, 0.28), (0.70, 0.36, 0.22), (0.62, 0.28, 0.18)][i], 0.9,
                            grain=0.4, grain_size=0.012 if i < 2 else 0.02,
                            kind=[("thatch", 0.05, 0, 0.5), ("thatch", 0.05, 0, 0.5), ("brick", 0.09, 0.06, 0.55), ("brick", 0.09, 0.06, 0.6)][i])
        self.trim = lib.mat(f"trim{i}", [(0.40, 0.25, 0.12), (0.42, 0.27, 0.13), (0.62, 0.58, 0.50), (0.90, 0.88, 0.84)][i], 0.8)
        self.wood = lib.mat("wood", (0.40, 0.25, 0.12), 0.8)
        self.dark = lib.mat("door", (0.12, 0.08, 0.05), 1.0)
        self.team = lib.team_mat("teamcloth")
        self.thatch = i < 2
        self.stone = i >= 2


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
    if side == "front":
        lib.box("door", (w, 0.03, h), (x, y, h / 2), st.dark)
    else:
        lib.box("door", (0.03, w, h), (x, y, h / 2), st.dark)


def columns(st, x0, x1, y, h, n, r=0.045):
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


def ground(size, color=(0.46, 0.37, 0.25)):
    """Trodden earth or paving under a building, inside its tiles, ragged at the edge so it fades into the
    ground round it rather than standing on it like a board."""
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
    lib.setmat(p, lib.mat("yard", color, 1.0, grain=0.55, grain_size=0.025))
    # Pebbles and clods about the edge of the yard.
    pebble = lib.mat("pebble", (0.52, 0.48, 0.42), 0.95, grain=0.3)
    clod = lib.mat("clod", tuple(x * 0.7 for x in color), 1.0, grain=0.3)
    for i in range(int(14 * size)):
        a = rnd.uniform(0, 2 * math.pi)
        r = size * rnd.uniform(0.4, 0.55)
        q = lib.ball(f"pebble{i}", rnd.uniform(0.018, 0.035), (r * math.cos(a), r * math.sin(a), 0.012), pebble if i % 3 else clod, sub=1)
        q.scale = (1.3, 1.0, 0.6)


# ---- the buildings. Each takes a Style.

def town_center(st):
    if st.age == "stone":
        models.town_center()
        return
    if st.age == "tool":
        ground(3)
        hall(st, "main", -0.2, 0.2, 1.7, 1.5, 0.6, along="x")
        hall(st, "wing", 0.8, -0.55, 0.9, 0.9, 0.45, along="y")
        door(st, -0.2, -0.56, 0.3, 0.42)
        palisade(st, -1.4, -1.4, -1.4, 1.4)
        palisade(st, -1.4, 1.4, 1.4, 1.4)
        flag(st, -0.2, 0.2, 1.45)
        banner(st, 0.5, -0.56, 0.32)
        return
    ground(3, (0.62, 0.58, 0.50))
    base = steps(st, -0.15, 0.15, 2.0, 1.9)
    lib.box("plinth", (2.0, 1.9, 0.02), (-0.15, 0.15, base), st.trim)
    top = hall(st, "main", -0.15, 0.15, 1.8, 1.7, 0.75 if st.age == "bronze" else 0.85, roof="gable" if st.age == "iron" else "flat", along="x")
    columns(st, -0.95, 0.65, -0.82, 0.75 if st.age == "bronze" else 0.85, 5 if st.age == "iron" else 4)
    door(st, -0.15, -0.71, 0.36, 0.5)
    hall(st, "tower", 0.95, 0.95, 0.6, 0.6, 1.0 if st.age == "iron" else 0.8, roof="flat")
    flag(st, 0.95, 0.95, (1.0 if st.age == "iron" else 0.8) + 0.5)
    banner(st, -0.75, -0.72, 0.5)
    banner(st, 0.45, -0.72, 0.5)


def house(st):
    if st.age == "stone":
        models.house()
        return
    ground(2)
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
    ground(3, (0.42, 0.33, 0.22))
    # The pit, and what is kept in it: logs, ore, cut stone.
    lib.box("pit", (1.5, 1.3, 0.05), (-0.25, 0.25, 0.025), lib.mat("pitdark", (0.25, 0.18, 0.11), 1.0))
    if st.thatch:
        for i, (dx, dy) in enumerate(((-0.75, -0.4), (0.25, -0.4), (0.25, 0.9), (-0.75, 0.9))):
            lib.cyl(f"post{i}", 0.035, 0.7, (dx, dy, 0.35), st.wood, verts=6)
        r = prism("shelter", 1.3, 1.6, 0.4, (-0.25, 0.25, 0.7), st.roof, "x")
        lib.lumpy(r, 0.012, 0.04)
    else:
        hall(st, "shed", -0.25, 0.35, 1.4, 1.2, 0.6, along="x")
        lib.box("opening", (1.0, 0.03, 0.45), (-0.25, -0.26, 0.23), st.dark)
    for k in range(5):
        lib.cyl(f"log{k}", 0.06, 0.7, (0.75, -0.9 + k * 0.13, 0.06), st.wood, rot=(0, R(90), 0), verts=8)
    stone = lib.mat("cutstone", (0.62, 0.60, 0.56), 0.9)
    for k in range(4):
        lib.box(f"block{k}", (0.16, 0.12, 0.1), (-0.9 + k * 0.2, -1.05, 0.05), stone, bevel=0.01)
    flag(st, 1.15, 1.0, 0.8)


def barracks(st):
    ground(3)
    if st.age == "stone":
        models.hut("hall", -0.2, 0.2, 0.75, 0.48, 0.9, door_angle=-45)
        palisade(st, -1.4, -1.4, 1.4, -1.4, 0.35)
    else:
        top = hall(st, "hall", -0.2, 0.25, 2.1, 1.3, 0.62 if st.age == "tool" else 0.75,
                   roof="flat" if st.age == "bronze" else "gable", along="x")
        door(st, -0.2, -0.41, 0.36, 0.48)
        if st.age == "iron":
            columns(st, -1.1, 0.7, -0.52, 0.75, 6)
        banner(st, -0.8, -0.42, 0.45)
        banner(st, 0.4, -0.42, 0.45)
    # A rack of spears and shields by the door.
    for k in range(5):
        lib.cyl(f"spear{k}", 0.012, 0.6, (0.75 + k * 0.08, -0.9, 0.3), st.wood, rot=(R(-10), 0, 0), verts=6)
    for k in range(2):
        lib.cyl(f"shield{k}", 0.1, 0.02, (0.8 + k * 0.25, -1.0, 0.12), st.team, rot=(R(80), 0, 0), verts=14)
    flag(st, 1.15, 1.1, 1.0)


def dock(st):
    # On the water: a deck on piles, with a shed and a crane.
    deck = lib.mat("deck", (0.55, 0.38, 0.20), 0.85, grain=0.4, grain_size=0.02)
    lib.box("deck", (2.8, 2.8, 0.08), (0, 0, 0.12), deck, bevel=0.01)
    for x in (-1.3, 0, 1.3):
        for y in (-1.3, 0, 1.3):
            lib.cyl(f"pile{x}{y}", 0.05, 0.3, (x, y, 0.0), st.wood, verts=8)
    if st.thatch:
        r = prism("shed", 1.3, 1.0, 0.45, (-0.5, 0.6, 0.6), st.roof, "x")
        lib.lumpy(r, 0.012, 0.04)
        for dx, dy in ((-0.6, -0.4), (0.6, -0.4), (0.6, 0.4), (-0.6, 0.4)):
            lib.cyl(f"shedpost{dx}{dy}", 0.03, 0.5, (-0.5 + dx, 0.6 + dy, 0.4), st.wood, verts=6)
    else:
        lib.box("shedwall", (1.3, 1.0, 0.5), (-0.5, 0.6, 0.41), st.wall, bevel=0.02)
        prism("shedroof", 1.45, 1.15, 0.35, (-0.5, 0.6, 0.66), st.roof, "x")
    # A crane, and a boat's frame on the slip.
    lib.cyl("crane", 0.04, 1.2, (0.9, 0.9, 0.76), st.wood, verts=8)
    lib.cyl("boom", 0.03, 0.9, (0.9, 0.5, 1.3), st.wood, rot=(R(70), 0, 0), verts=8)
    for k in range(5):
        lib.cyl(f"rib{k}", 0.015, 0.4, (0.5, -0.9 + k * 0.18, 0.3), st.wood, rot=(0, R(90), 0), verts=6)
    flag(st, -1.2, -1.2, 0.9)


def enclosure(st, half, h, gap, name="enc"):
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
        # A coping along the top.
        top = (size[0] + 0.03, size[1] + 0.03, 0.03)
        lib.box(f"{name}{k}-cap", top, ((x0 + x1) / 2, (y0 + y1) / 2, hh + 0.015), st.trim, bevel=0.005)


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


def archery_range(st):
    """A walled range: targets of straw with painted rings along the back wall, facing the way in; a line to
    shoot from, racks of bows and baskets of arrows by it; the armoury in the back corner."""
    ground(3)
    enclosure(st, 1.3, 0.34, (0.25, 0.95))
    gateway(st, 0.25, 0.95, -1.3, 0.62)
    if st.thatch:
        hall(st, "armoury", -0.75, 0.75, 0.9, 0.8, 0.45, along="y")
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
    ground(3, (0.48, 0.40, 0.26))
    hall(st, "stalls", -0.3, 0.5, 2.2, 0.9, 0.5 if st.thatch else 0.6, along="x")
    for k in range(4):
        lib.box(f"stall{k}", (0.4, 0.03, 0.4), (-1.1 + k * 0.55, 0.04, 0.2), st.dark)
    # A fenced paddock with hay.
    for x in (-1.3, 0.0, 1.3):
        lib.cyl(f"fpost{x}", 0.025, 0.3, (x, -1.25, 0.15), st.wood, verts=6)
    lib.box("rail", (2.6, 0.02, 0.025), (0, -1.25, 0.24), st.wood)
    lib.box("rail2", (2.6, 0.02, 0.025), (0, -1.25, 0.14), st.wood)
    hay = lib.mat("hay", (0.86, 0.74, 0.40), 0.95, grain=0.4, grain_size=0.01)
    for k in range(3):
        lib.ball(f"hay{k}", 0.15, (0.6 + k * 0.25, -0.5, 0.08), hay, scale=(1.2, 1, 0.6), sub=2)
    flag(st, 1.15, 1.1, 1.0)


def market(st):
    """A walled market: a gate at the front, stalls along the back and left walls under awnings of plain
    cloth with their wares (pots, baskets of fruit, sacks, bolts of cloth), the storehouse in the back corner,
    a well in the square."""
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
    # Ploughed rows with grain, inside a low edge. Farms are the same in every age.
    soil = lib.mat("soil", (0.42, 0.30, 0.18), 1.0, grain=0.35, grain_size=0.03)
    grain_ = lib.mat("grain", (0.80, 0.70, 0.30), 0.9, grain=0.4, grain_size=0.008)
    lib.box("field", (2.9, 2.9, 0.03), (0, 0, 0.015), soil)
    for k in range(9):
        y = -1.25 + k * 0.31
        row = lib.box(f"row{k}", (2.6, 0.14, 0.09), (0, y, 0.07), grain_, bevel=0.03)
        lib.lumpy(row, 0.025, 0.03)
    for (x0, y0, x1, y1) in ((-1.45, -1.45, 1.45, -1.45), (1.45, -1.45, 1.45, 1.45)):
        lib.box(f"edge{x0}{y0}", (abs(x1 - x0) + 0.05, abs(y1 - y0) + 0.05, 0.05), ((x0 + x1) / 2, (y0 + y1) / 2, 0.025), soil)


def tower(st, kind):
    ground(2)
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
    # A fire on an altar before it.
    lib.box("altar", (0.25, 0.25, 0.2), (0.6, -1.15, 0.1), st.trim)
    lib.ball("fire", 0.07, (0.6, -1.15, 0.25), lib.mat("flame", (1, 0.6, 0.1), 1.0, emit=(1.0, 0.5, 0.1)), sub=1)
    banner(st, -0.6, -0.72, 0.6, 0.14, 0.3)


def academy(st):
    ground(3, (0.64, 0.60, 0.52))
    # A courtyard behind a columned front.
    hall(st, "back", 0, 0.85, 2.4, 0.7, 0.75, roof="gable", along="x")
    hall(st, "left", -0.95, 0.0, 0.6, 1.2, 0.7, roof="gable", along="y")
    columns(st, -0.6, 1.1, -0.85, 0.7, 6)
    lib.box("lintel", (1.9, 0.12, 0.08), (0.25, -0.85, 0.74), st.trim)
    lib.box("court", (1.5, 1.1, 0.02), (0.3, 0.05, 0.02), lib.mat("paving", (0.74, 0.70, 0.62), 0.9, grain=0.2))
    lib.cyl("statue", 0.08, 0.4, (0.3, 0.0, 0.22), st.trim, verts=10)
    banner(st, 0.9, 0.49, 0.5)
    flag(st, 1.15, 1.15, 1.2)


def siege_workshop(st):
    ground(3, (0.48, 0.40, 0.26))
    hall(st, "shop", -0.5, 0.5, 1.8, 1.4, 0.8, along="x")
    lib.box("bay", (1.0, 0.03, 0.62), (-0.5, -0.21, 0.31), st.dark)
    # A catapult frame being built, and timber.
    lib.box("frame", (0.5, 0.7, 0.06), (0.75, -0.75, 0.15), st.wood)
    lib.cyl("arm", 0.025, 0.8, (0.75, -0.75, 0.45), st.wood, rot=(R(-40), 0, 0), verts=6)
    for k in range(4):
        lib.cyl(f"beam{k}", 0.05, 0.9, (-0.5 + k * 0.03, -1.05 + k * 0.1, 0.05 + (k % 2) * 0.08), st.wood, rot=(0, R(90), 0), verts=6)
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


BUILDERS = {
    "town_center": town_center, "house": house, "granary": granary, "storage_pit": storage_pit, "barracks": barracks,
    "dock": dock, "archery_range": archery_range, "stable": stable, "market": market, "farm": farm,
    "watch_tower": lambda st: tower(st, "watch_tower"), "sentry_tower": lambda st: tower(st, "sentry_tower"),
    "guard_tower": lambda st: tower(st, "guard_tower"), "ballista_tower": lambda st: tower(st, "ballista_tower"),
    "government_center": government_center, "temple": temple, "academy": academy, "siege_workshop": siege_workshop,
    "wonder": wonder,
}
# The Stone Age's own, in stoneage.py.
for _key, _make in stoneage.BUILDERS.items():
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
    tall = {"wonder": 3.0, "watch_tower": 2.4, "sentry_tower": 2.2, "guard_tower": 2.5, "ballista_tower": 2.7, "farm": 0.3}.get(key, 1.7)
    w = int(n * 128 + 120)
    h = int(n * 64 + tall * 0.866 * lib.PPU + 70)
    lift = tall * 0.45
    return (w, h), (0.0, 0.0, lift), (n / 2, -n / 2, 0)
