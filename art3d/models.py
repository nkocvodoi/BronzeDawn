# Buildings and trees, built from simple shapes. One unit is one tile; a building's tiles run from
# -size/2 to size/2 on X and Y, centred on the origin. Stone Age style: mud walls and thatch.

import math
import random

import lib

R = math.radians

MUD = (0.60, 0.45, 0.30)
EARTH = (0.47, 0.37, 0.24)
THATCH = (0.74, 0.60, 0.30)
THATCH_DARK = (0.55, 0.42, 0.20)
WOOD = (0.40, 0.25, 0.12)
DOOR = (0.12, 0.08, 0.05)
STONE = (0.55, 0.53, 0.50)
LEAF = [(0.16, 0.32, 0.08), (0.22, 0.38, 0.10), (0.12, 0.26, 0.07)]
BARK = (0.32, 0.22, 0.13)


def lumpy(o, amount, scale, levels=2):
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = sub.render_levels = levels + 1
    return lib.lumpy(o, amount, scale)


def hut(name, x, y, r, wall_h, roof_h, door_angle=-45, flag=False):
    """A round hut with a cone of thatch; the door turned toward `door_angle` (degrees, 0 is +X)."""
    walls = lib.cyl(f"{name}-walls", r, wall_h, (x, y, wall_h / 2), lib.mat("mud", MUD, 0.95), verts=28, r2=r * 0.94)
    lib.lumpy(walls, 0.012, 0.08)
    roof = lib.cyl(f"{name}-roof", r * 1.22, roof_h, (x, y, wall_h + roof_h / 2 - 0.04), lib.mat("thatch", THATCH, 1.0, grain=0.4, grain_size=0.012), verts=32, r2=0.03)
    lumpy(roof, 0.018, 0.05, 1)
    # A ring of rope round the thatch, and a knot of straw on top.
    rr = r * 1.22 * 0.6
    lib.cyl(f"{name}-band", rr + 0.012, 0.018, (x, y, wall_h - 0.04 + roof_h * 0.4), lib.mat("thatchd", THATCH_DARK, 1.0), verts=32)
    lib.cyl(f"{name}-knot", 0.05, 0.08, (x, y, wall_h + roof_h - 0.03), lib.mat("thatchd", THATCH_DARK, 1.0), verts=10, r2=0.015)
    a = R(door_angle)
    dx, dy = math.cos(a), math.sin(a)
    lib.box(f"{name}-door", (0.04, r * 0.42, wall_h * 0.7), (x + dx * (r * 0.97), y + dy * (r * 0.97), wall_h * 0.35),
            lib.mat("door", DOOR, 1.0), rot=(0, 0, a))
    if flag:
        pole_h = wall_h + roof_h + 0.35
        lib.cyl(f"{name}-pole", 0.018, pole_h, (x, y, pole_h / 2), lib.mat("wood", WOOD, 0.8), verts=8)
        lib.box(f"{name}-flag", (0.02, 0.26, 0.15), (x, y - 0.13, pole_h - 0.1), lib.team_mat("teamcloth"))


def platform(size, h=0.02):
    """Trodden earth under a building, ragged at the edge, a little inside its tiles."""
    bpy_ = lib.bpy
    bpy_.ops.mesh.primitive_cylinder_add(vertices=48, radius=size * 0.62, depth=h, location=(0, 0, h / 2))
    p = bpy_.context.object
    p.name = "platform"
    p.scale = (1, 1, 1)
    lib.setmat(p, lib.mat("earth", EARTH, 1.0))
    # Squared off toward the tiles' corners, and wavering.
    for v in p.data.vertices:
        x, y = v.co.x, v.co.y
        k = max(abs(x), abs(y)) / max(1e-6, math.hypot(x, y))
        f = 0.82 + 0.18 * k
        v.co.x, v.co.y = x / f * 0.78, y / f * 0.78
    lib.lumpy(p, 0.02, 0.15)
    return p


def stones(cx, cy, r, n, seed):
    rnd = random.Random(seed)
    for i in range(n):
        a = 2 * math.pi * i / n
        s = lib.ball(f"stone{seed}-{i}", 0.04 + rnd.random() * 0.02, (cx + r * math.cos(a), cy + r * math.sin(a), 0.03), lib.mat("stone", STONE, 0.9), sub=1)
        s.scale = (1.2, 1.0, 0.7)


def post(x, y, h, team_cloth=False):
    lib.cyl(f"post{x:.2f}{y:.2f}", 0.025, h, (x, y, h / 2), lib.mat("wood", WOOD, 0.8), verts=8)
    if team_cloth:
        lib.box(f"cloth{x:.2f}{y:.2f}", (0.02, 0.22, 0.32), (x, y - 0.11, h - 0.2), lib.team_mat("teamcloth"))


# Size of the picture (px, at twice the game's size), the scene point it is centred on, and the anchor:
# the bottom corner of the building's diamond.
TOWN_CENTER = {"size": (440, 380), "center": (0, 0, 0.55), "anchor": (1.5, -1.5, 0)}
HOUSE = {"size": (300, 270), "center": (0, 0, 0.35), "anchor": (1.0, -1.0, 0)}
TREE = {"size": (230, 230), "center": (0.35, -0.1, 0.7), "variants": 4}
LONE_TREE = {"size": (360, 330), "center": (0.55, -0.15, 1.0), "scale": 1.55}


def town_center():
    hut("main", -0.25, 0.25, 0.78, 0.5, 0.95, door_angle=-45, flag=True)
    hut("west", -0.85, -0.75, 0.38, 0.34, 0.5, door_angle=-20)
    hut("north", 0.78, 0.82, 0.36, 0.32, 0.48, door_angle=-70)
    stones(0.65, -0.55, 0.16, 9, 1)  # a hearth before the door
    lib.cyl("embers", 0.12, 0.02, (0.65, -0.55, 0.02), lib.mat("ember", (0.3, 0.1, 0.02), 1.0, emit=(1.0, 0.35, 0.05)), verts=12)
    post(1.25, -1.25, 0.9, True)
    post(-1.3, 1.2, 0.8, True)
    post(1.3, 0.1, 0.7)
    post(-0.1, -1.3, 0.7)
    # A drying rack of hides.
    for x in (0.2, 0.75):
        lib.cyl(f"rack{x}", 0.015, 0.4, (x + 0.35, -1.05, 0.2), lib.mat("wood", WOOD, 0.8), verts=6)
    lib.box("hide", (0.5, 0.02, 0.22), (0.83, -1.05, 0.28), lib.mat("hide", (0.62, 0.44, 0.28), 0.9))


def house():
    hut("hut", 0.0, 0.1, 0.55, 0.38, 0.62, door_angle=-45)
    lib.box("doorcloth", (0.02, 0.2, 0.18), (0.39, -0.29, 0.34), lib.team_mat("teamcloth"), rot=(0, 0, R(-45)))
    lib.box("wood-pile", (0.3, 0.12, 0.1), (-0.55, -0.55, 0.05), lib.mat("wood", WOOD, 0.8), rot=(0, 0, R(30)), bevel=0.02)
    post(0.75, -0.75, 0.55)


def tree(variant):
    rnd = random.Random(variant * 17 + 3)
    lean = (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05))
    h = 0.42 + rnd.uniform(-0.04, 0.06)
    trunk = lib.cyl("trunk", 0.06, h + 0.2, (lean[0] / 2, lean[1] / 2, (h + 0.2) / 2), lib.mat("bark", BARK, 0.9), verts=10, r2=0.04)
    lib.lumpy(trunk, 0.008, 0.04)
    leaf = [lib.mat(f"leaf{i}", c, 0.85) for i, c in enumerate(LEAF)]
    # A crown of overlapping clumps, broad below and narrowing to the top.
    blobs = [(0, 0, h + 0.36, 0.40)]
    for k in range(5):
        a = 2 * math.pi * k / 5 + rnd.uniform(0, 1)
        d = rnd.uniform(0.18, 0.26)
        blobs.append((math.cos(a) * d, math.sin(a) * d, h + rnd.uniform(0.12, 0.42), rnd.uniform(0.2, 0.27)))
    for k in range(3):
        a = 2 * math.pi * k / 3 + rnd.uniform(0, 1)
        blobs.append((math.cos(a) * 0.1, math.sin(a) * 0.1, h + 0.62 + rnd.uniform(0, 0.12), rnd.uniform(0.17, 0.22)))
    for i, (x, y, z, r) in enumerate(blobs):
        b = lib.ball(f"leaves{i}", r, (x + lean[0], y + lean[1], z), leaf[i % 3], sub=3)
        lib.lumpy(b, r * 0.35, r * 0.35)


def lone_tree():
    """A tree standing alone: the same kind, grown bigger."""
    tree(1)
    lib.scale_all(LONE_TREE["scale"])
