# Ruins and Artifacts: the two kinds of relic out on the map. Each comes in two looks: as found (no
# owner, none of the player's colour) and held (a banner or a cloth in the holder's colour).
# Facing Blender -Y. One unit is one tile.

import math
import random

import lib

R = math.radians

STONE = (0.62, 0.60, 0.55)
STONE_DARK = (0.40, 0.39, 0.36)
MOSS = (0.30, 0.38, 0.16)
EARTH = (0.50, 0.43, 0.31)
GOLD = (0.95, 0.74, 0.22)
GOLD_DARK = (0.62, 0.42, 0.12)
WOOD = (0.58, 0.39, 0.20)
POLE = (0.30, 0.20, 0.10)

# Picture sizes and the ground point's place in them, at the render's size (twice the game's).
RUINS_FRAME = (300, 260)
RUINS_ANCHOR = (146, 164)
ARTIFACT_FRAME = (200, 170)
ARTIFACT_ANCHOR = (96, 112)
ARTIFACT_SIZE = 1.35  # the chest is drawn larger than life, to read at a glance beside the people


def megalith(name, x, y, w, d, h, parent, seed, lean=(0.0, 0.0), lying=False):
    """A rough standing stone, a little narrower at the top, its faces chipped. Lying, it is a stone
    fallen flat, half sunk in the ground."""
    rnd = random.Random(seed)
    stone = lib.mat("megalith", STONE, 0.95, grain=0.3, grain_size=0.02)
    if lying:
        o = lib.box(name, (h, w, d), (x, y, d * 0.35), stone, parent, rot=(0, R(4), rnd.uniform(0, math.pi)), bevel=0.02)
    else:
        o = lib.box(name, (w, d, h), (x, y, h / 2), stone, parent, rot=(lean[0], lean[1], rnd.uniform(-0.3, 0.3)), bevel=0.02)
        # Taper toward the top.
        for v in o.data.vertices:
            if v.co.z > 0:
                v.co.x *= 0.8
                v.co.y *= 0.85
    tex = lib.bpy.data.textures.new(f"chip{name}", "VORONOI")
    tex.noise_scale = 0.07
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.subdivision_type = "SIMPLE"
    sub.levels = sub.render_levels = 3
    mod = o.modifiers.new("chips", "DISPLACE")
    mod.texture = tex
    mod.strength = 0.04
    mod.mid_level = 0.6
    # A little moss at the foot.
    if not lying and rnd.random() < 0.7:
        lib.ball(f"{name}moss", w * 0.45, (x + rnd.uniform(-0.03, 0.03), y - d * 0.45, 0.02), lib.mat("moss", MOSS, 0.9), parent,
                 scale=(1.3, 0.8, 0.35), sub=1)
    return o


def banner(name, x, y, z, parent, h=0.95):
    """A pole with a pennant in the holder's colour, turned so that it shows from every side."""
    lib.cyl(f"{name}pole", 0.016, h, (x, y, z + h / 2), lib.mat("pole", POLE, 0.7), parent, verts=8)
    a = R(45)
    w = 0.32
    lib.box(f"{name}flag", (w, 0.008, 0.19), (x + math.cos(a) * w / 2, y + math.sin(a) * w / 2, z + h - 0.12), lib.team_mat("pennant"), parent,
            rot=(0, 0, a), bevel=0.003)
    lib.ball(f"{name}knob", 0.026, (x, y, z + h + 0.012), lib.mat("gold", GOLD, 0.35, metal=0.8), parent, sub=1)


class Ruins:
    """A ring of old standing stones on worn ground: most upright, one leaning, one fallen, one broken to
    a stump, the two at the back bearing a lintel; an altar slab in the middle. Held, a banner stands
    behind the altar."""

    def __init__(self, held=False):
        self.root = lib.empty("root")
        rnd = random.Random(11)
        # Worn ground: overlapping flat patches, so the edge is ragged, not a plate.
        earth = lib.mat("floor", EARTH, 0.95, grain=0.35, grain_size=0.05)
        for k in range(9):
            a = 2 * math.pi * k / 9 + rnd.uniform(-0.2, 0.2)
            r = 0.45 if k else 0.0
            p = lib.cyl(f"floor{k}", rnd.uniform(0.32, 0.42) if k else 0.5, 0.01, (r * math.cos(a), r * math.sin(a), 0.004 + k * 0.0004), earth,
                        self.root, verts=12, rot=(0, 0, rnd.uniform(0, math.pi)))
            p.scale = (rnd.uniform(0.8, 1.2), rnd.uniform(0.8, 1.2), 1)
        n = 9
        stones = {}
        for k in range(n):
            a = 2 * math.pi * k / n + R(20) + rnd.uniform(-0.08, 0.08)
            x, y = 0.62 * math.cos(a), 0.62 * math.sin(a)
            if k == 6:  # fallen outward
                megalith(f"fallen{k}", x * 1.12, y * 1.12, 0.2, 0.12, 0.55, self.root, k, lying=True)
                continue
            h = 0.14 if k == 3 else rnd.uniform(0.5, 0.68)  # 3 is broken off
            lean = (R(13) * math.sin(a), -R(13) * math.cos(a)) if k == 8 else (0.0, 0.0)
            megalith(f"stone{k}", x, y, 0.22, 0.14, h, self.root, k, lean=lean)
            stones[k] = (x, y, h)
        # A lintel across two stones at the back of the ring (seen behind it), so the ring reads as built.
        (x0, y0, h0), (x1, y1, h1) = stones[1], stones[2]
        lib.box("lintel", (math.hypot(x1 - x0, y1 - y0) + 0.24, 0.15, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, min(h0, h1) + 0.045),
                lib.mat("megalith", STONE, 0.95), self.root, rot=(0, 0, math.atan2(y1 - y0, x1 - x0)), bevel=0.02)
        # The altar: a flat slab on two low stones.
        dark = lib.mat("altarbase", STONE_DARK, 0.95, grain=0.3, grain_size=0.02)
        for dx in (-0.11, 0.11):
            lib.box(f"leg{dx}", (0.08, 0.16, 0.1), (dx, 0, 0.05), dark, self.root, bevel=0.01)
        lib.box("altar", (0.38, 0.22, 0.06), (0, 0, 0.13), lib.mat("megalith", STONE, 0.95), self.root, rot=(0, 0, R(8)), bevel=0.014)
        # Rubble.
        for k in range(7):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(0.25, 0.85)
            s = rnd.uniform(0.03, 0.055)
            lib.ball(f"rubble{k}", s, (r * math.cos(a), r * math.sin(a), s * 0.4), dark, self.root, scale=(1.3, 1, 0.7), sub=1)
        if held:
            banner("ruins", 0.06, 0.2, 0.0, self.root)

    def face(self, angle):
        # Ruins never turn: every direction of the sheet is the one view in which the lintel and the
        # banner both show, whichever the game asks for.
        self.root.rotation_euler = (0, 0, 0)

    def pose(self, anim, t):
        pass


class Artifact:
    """A sacred chest of gold on two carrying poles, standing on short feet. Held, a cloth in the holder's
    colour lies over its lid. On the move it rocks a little at each step, as if carried."""

    def __init__(self, held=False):
        self.root = lib.empty("root")
        self.body = lib.empty("body", (0, 0, 0), self.root)
        gold = lib.mat("gold", GOLD, 0.35, metal=0.85, grain=0.12)
        trim = lib.mat("goldtrim", GOLD_DARK, 0.45, metal=0.8, grain=0.1)
        wood = lib.mat("poles", WOOD, 0.7)
        # The chest, its long side along the way it goes (-Y).
        lib.box("chest", (0.24, 0.34, 0.15), (0, 0, 0.155), gold, self.body, bevel=0.012)
        lib.box("band", (0.25, 0.04, 0.155), (0, 0, 0.155), trim, self.body)
        lib.box("rim", (0.26, 0.36, 0.025), (0, 0, 0.235), trim, self.body, bevel=0.006)
        # The lid, a little arched, with a sun disc on top.
        lid = lib.cyl("lid", 0.12, 0.35, (0, 0, 0.25), gold, self.body, rot=(R(90), 0, 0), verts=24)
        lid.scale = (1, 0.35, 1)
        lib.cyl("disc", 0.055, 0.012, (0, 0, 0.3), trim, self.body, rot=(R(90), 0, 0), verts=20)
        lib.ball("boss", 0.022, (0, -0.008, 0.3), gold, self.body, sub=1)
        for x in (-0.09, 0.09):
            for y in (-0.13, 0.13):
                lib.cyl(f"foot{x}{y}", 0.022, 0.08, (x, y, 0.04), trim, self.body, r2=0.015, verts=8)
        # Two poles through rings on the long sides, a hand's reach out at each end.
        for x in (-0.155, 0.155):
            lib.cyl(f"pole{x}", 0.022, 0.82, (x, 0, 0.13), wood, self.body, rot=(R(90), 0, 0), verts=10)
            for y in (-0.1, 0.1):
                lib.cyl(f"ring{x}{y}", 0.03, 0.022, (x * 0.88, y, 0.13), trim, self.body, rot=(R(90), 0, 0), verts=12)
            for y in (-0.41, 0.41):
                lib.ball(f"cap{x}{y}", 0.026, (x, y, 0.13), trim, self.body, sub=1)
        if held:
            cloth = lib.team_mat("cloth")
            lib.box("drape", (0.27, 0.2, 0.012), (0, 0.04, 0.315), cloth, self.body, bevel=0.004)
            for x in (-0.137, 0.137):
                lib.box(f"flap{x}", (0.012, 0.2, 0.11), (x, 0.04, 0.255), cloth, self.body, bevel=0.003)
        self.root.scale = (ARTIFACT_SIZE,) * 3

    def face(self, angle):
        self.root.rotation_euler = (0, 0, angle)

    def pose(self, anim, t):
        self.body.location = (0, 0, 0)
        self.body.rotation_euler = (0, 0, 0)
        if anim == "walk":
            step = math.sin(2 * math.pi * t)
            self.body.location = (0, 0, 0.025 * abs(step))
            self.body.rotation_euler = (R(2.5 * math.cos(2 * math.pi * t)), R(2 * step), 0)
