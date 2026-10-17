# The fantasy races' buildings (replica/game/fantasy-races.md): each race's own way of building, the same
# layouts for every race. A Kit gives a race's shapes (a hall, a round hut, a tower, a fence, a flag); the
# buildings below lay them out with what each building needs (targets, stalls, a paddock). The town centre,
# temple and wonder are each race's own. Bigger and richer with each age (`tier`).
#
#   Elf        living wood walls under domes of leaves; the town centre is an old tree
#   Dwarf      thick granite, dug into a mound of rock behind, deep arched doors, slate, bronze
#   Centaur    canvas tents and open pavilions on poles, wide yards, star-watching towers
#   Beastfolk  hide tents, mud longhouses under thatch, totem poles, fences of bone
#
# As buildings.py: one unit is one tile, tiles from -size/2 to size/2, the front toward the viewer (+X, -Y).

import math
import random

import lib
from buildings import AGES, FIRST, ONE_LOOK, prism

R = math.radians


class Kit:
    def __init__(self, race, age):
        self.race, self.age, self.tier = race, age, AGES.index(age)
        self.team = lib.team_mat("teamcloth")
        self.dark = lib.mat("door", (0.10, 0.07, 0.05), 1.0)
        self.wood = lib.mat("wood", (0.42, 0.27, 0.13), 0.8)

    # ---- what every race has, drawn its own way
    def ground(self, size, color):
        import buildings
        buildings.ground(size, color)

    def flag(self, x, y, h):
        lib.cyl(f"pole{x:.2f}{y:.2f}", 0.016, h, (x, y, h / 2), self.wood, verts=8)
        lib.box(f"flag{x:.2f}{y:.2f}", (0.02, 0.24, 0.14), (x, y - 0.12, h - 0.09), self.team)

    def banner(self, x, y, z, w=0.16, h=0.22):
        lib.box(f"banner{x:.2f}{z:.2f}", (w, 0.015, h), (x, y, z), self.team)

    def door(self, x, y, w, h):
        lib.box(f"door{x:.2f}", (w, 0.03, h), (x, y, h / 2), self.dark)


class Elf(Kit):
    def __init__(self, race, age):
        super().__init__(race, age)
        # The ladder of the elves' ages (replica/elf-ages-plan.md, "thang-vat-lieu"): rough wood and fresh
        # leaves; living wood bent to shape; white birch, jade silk and green bronze; silver, moonstone and
        # leaf glass. Each age's materials are named apart, so a scene keeps its own.
        t = self.tier
        self.bark = lib.mat(f"bark{t}", [(0.32, 0.22, 0.14), (0.38, 0.26, 0.16), (0.70, 0.68, 0.62), (0.86, 0.85, 0.82)][t], 0.95,
                            grain=[0.5, 0.5, 0.45, 0.2][t], grain_size=0.008)
        self.live = lib.mat(f"livewood{t}", [(0.56, 0.42, 0.28), (0.80, 0.68, 0.48), (0.90, 0.88, 0.82), (0.95, 0.94, 0.91)][t],
                            [0.9, 0.85, 0.8, 0.5][t], grain=[0.4, 0.3, 0.25, 0.08][t], grain_size=0.01)
        self.leaf = lib.mat(f"leaf{t}", [(0.24, 0.42, 0.16), (0.30, 0.55, 0.22), (0.30, 0.60, 0.52), (0.62, 0.84, 0.76)][t],
                            [0.9, 0.9, 0.6, 0.25][t], grain=[0.45, 0.45, 0.2, 0.08][t], grain_size=0.012)
        self.leaf2 = lib.mat(f"leaflight{t}", [(0.36, 0.52, 0.20), (0.52, 0.70, 0.28), (0.46, 0.74, 0.64), (0.78, 0.92, 0.86)][t],
                             [0.9, 0.9, 0.6, 0.25][t], grain=[0.4, 0.4, 0.2, 0.08][t], grain_size=0.012)
        self.paving = lib.mat(f"whitestone{t}", [(0.60, 0.56, 0.50), (0.78, 0.76, 0.68), (0.88, 0.87, 0.82), (0.95, 0.95, 0.93)][t], 0.9, grain=0.15)
        # The trees themselves stay green in every age, a little lusher with each: only what the elves make
        # changes (domes of silk, then glass), not the forest.
        self.foliage = lib.mat(f"foliage{t}", [(0.24, 0.42, 0.16), (0.30, 0.55, 0.22), (0.28, 0.58, 0.24), (0.30, 0.62, 0.28)][t], 0.9, grain=0.45, grain_size=0.012)
        self.foliage2 = lib.mat(f"foliage2-{t}", [(0.36, 0.52, 0.20), (0.52, 0.70, 0.28), (0.50, 0.72, 0.30), (0.56, 0.76, 0.34)][t], 0.9, grain=0.4, grain_size=0.012)
        # Bark cord, then green bronze, then silver: the bands, rails and fittings.
        self.trim = [self.bark, self.bark, lib.mat("verdigris", (0.36, 0.60, 0.50), 0.45, 0.6),
                     lib.mat("silver", (0.86, 0.88, 0.92), 0.25, 0.95)][t]
        self.yard = [(0.34, 0.36, 0.20), (0.36, 0.42, 0.22), (0.40, 0.44, 0.28), (0.44, 0.46, 0.34)][t]

    def hall(self, name, x, y, w, d, h):
        # Rounded walls of pale living wood, roots at the corners, a dome of leaves.
        lib.cyl(f"{name}-wall", 0.5, h, (x, y, h / 2), self.live, verts=14).scale = (w, d, 1)
        for i, (dx, dy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
            lib.cyl(f"{name}-root{i}", 0.05, h * 1.1, (x + dx * w * 0.42, y + dy * d * 0.42, h * 0.55), self.bark, verts=8, r2=0.03)
        dome = lib.ball(f"{name}-roof", 0.5, (x, y, h), self.leaf, scale=(w * 1.12, d * 1.12, min(w, d) * 0.85), sub=3)
        lib.lumpy(dome, 0.04, 0.167, len(name))
        lib.ball(f"{name}-roof2", 0.3, (x - w * 0.12, y + d * 0.1, h + min(w, d) * 0.32), self.leaf2, scale=(w, d, min(w, d) * 0.7), sub=2)
        lib.box(f"{name}-arch", (0.24, 0.04, h * 0.7), (x, y - d / 2, h * 0.35), self.dark)
        return h + min(w, d) * 0.42

    def hut(self, name, x, y, r, h):
        lib.cyl(f"{name}-wall", r, h, (x, y, h / 2), self.live, verts=14)
        roof = lib.cyl(f"{name}-roof", r * 1.3, r * 1.3, (x, y, h + r * 0.6), self.leaf, verts=14, r2=0.05)
        lib.lumpy(roof, 0.03, 0.2, 2)
        return h + r * 1.25

    def tower(self, name, x, y, h):
        # A tree: a tapering trunk, a platform in its crown, leaves above.
        lib.cyl(f"{name}-trunk", 0.2, h, (x, y, h / 2), self.bark, verts=10, r2=0.13)
        lib.cyl(f"{name}-deck", 0.42, 0.06, (x, y, h * 0.8), self.live, verts=14)
        lib.cyl(f"{name}-rail", 0.43, 0.12, (x, y, h * 0.8 + 0.08), self.live, verts=14)
        crown = lib.ball(f"{name}-crown", 0.5, (x, y, h + 0.15), self.leaf, scale=(1, 1, 0.75), sub=3)
        lib.lumpy(crown, 0.05, 0.167, 7)
        return h + 0.5

    def fence(self, x0, y0, x1, y1, h=0.22):
        # Bushes along the line, not a wall: the elves grow their fences.
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 0.42))
        for i in range(n):
            k = (i + 0.5) / n
            b = lib.ball(f"bush{x0:.1f}{y0:.1f}{i}", 0.15, (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 0.1), self.leaf if i % 2 else self.leaf2, scale=(1, 1, 0.8), sub=2)
            lib.lumpy(b, 0.025, 0.08, i)

    def great_tree(self, x, y, h, spread=1.0):
        """The old tree a town lives in: a broad trunk on roots, two decks round it, a wide crown."""
        lib.cyl("gt-trunk", 0.38 * spread, h, (x, y, h / 2), self.bark, verts=14, r2=0.26 * spread)
        for i in range(6):
            a = R(60 * i + 15)
            lib.cyl(f"gt-root{i}", 0.09 * spread, 0.6 * spread, (x + math.cos(a) * 0.38 * spread, y + math.sin(a) * 0.38 * spread, 0.12),
                    self.bark, rot=(math.sin(a) * R(60), -math.cos(a) * R(60), 0), verts=8, r2=0.03)
        for k, z in enumerate((h * 0.42, h * 0.72)):
            lib.cyl(f"gt-deck{k}", (0.85 - k * 0.2) * spread, 0.06, (x, y, z), self.live, verts=18)
            lib.cyl(f"gt-rail{k}", (0.86 - k * 0.2) * spread, 0.1, (x, y, z + 0.07), self.live, verts=18)
        for k, (dx, dy, dz, r) in enumerate(((0, 0, 0.1, 0.95), (0.45, 0.2, -0.15, 0.6), (-0.4, 0.3, -0.1, 0.62), (0.1, -0.4, -0.2, 0.55))):
            c = lib.ball(f"gt-crown{k}", r * spread, (x + dx * spread, y + dy * spread, h + dz), self.leaf if k % 2 == 0 else self.leaf2, scale=(1, 1, 0.7), sub=3)
            lib.lumpy(c, 0.06, 0.133, k + 11)
        return h + 0.7 * spread


class Dwarf(Kit):
    def __init__(self, race, age):
        super().__init__(race, age)
        self.stone = lib.mat("granite", (0.50, 0.49, 0.47), 0.9, grain=0.3, grain_size=0.02)
        self.dstone = lib.mat("darkstone", (0.30, 0.30, 0.32), 0.9, grain=0.25, grain_size=0.02)
        self.slate = lib.mat("slate", (0.26, 0.28, 0.32), 0.85, grain=0.2, grain_size=0.015)
        self.rock = lib.mat("rock", (0.44, 0.42, 0.40), 0.95, grain=0.45, grain_size=0.04)
        self.bronze = lib.mat("bronze", (0.72, 0.48, 0.22), 0.35, 0.8)
        self.ember = lib.mat("ember", (0.95, 0.42, 0.12), 0.6)
        self.yard = (0.40, 0.38, 0.36)

    def hall(self, name, x, y, w, d, h):
        # Into a mound of rock behind: thick walls, a slab roof, a deep arched door, a chimney.
        mound = lib.ball(f"{name}-mound", 0.5, (x, y + d * 0.45, h * 0.55), self.rock, scale=(w * 1.25, d * 1.1, h * 1.9), sub=3)
        lib.lumpy(mound, 0.06, 0.133, len(name) + 1)
        lib.box(f"{name}-walls", (w, d, h), (x, y, h / 2), self.stone, bevel=0.03)
        lib.box(f"{name}-slab", (w + 0.12, d + 0.12, 0.08), (x, y, h + 0.04), self.slate, bevel=0.02)
        prism(f"{name}-roof", w + 0.1, d + 0.1, 0.16, (x, y, h + 0.08), self.slate, "x")
        lib.box(f"{name}-arch", (0.3, 0.06, h * 0.62), (x, y - d / 2 - 0.01, h * 0.31), self.dark)
        lib.cyl(f"{name}-archtop", 0.15, 0.06, (x, y - d / 2 - 0.01, h * 0.62), self.dark, rot=(R(90), 0, 0), verts=12)
        lib.box(f"{name}-lintel", (0.42, 0.08, 0.08), (x, y - d / 2 - 0.02, h * 0.62 + 0.15), self.dstone)
        lib.box(f"{name}-chimney", (0.16, 0.16, 0.4), (x + w * 0.3, y + d * 0.2, h + 0.2), self.dstone)
        lib.box(f"{name}-chimneytop", (0.2, 0.2, 0.04), (x + w * 0.3, y + d * 0.2, h + 0.42), self.slate)
        if self.tier >= 2:
            lib.box(f"{name}-band", (w + 0.02, 0.03, 0.05), (x, y - d / 2 - 0.01, h * 0.86), self.bronze)
        return h + 0.24

    def hut(self, name, x, y, r, h):
        lib.cyl(f"{name}-wall", r, h, (x, y, h / 2), self.stone, verts=8)
        lib.cyl(f"{name}-cap", r * 1.15, r * 0.6, (x, y, h + r * 0.3), self.slate, verts=8, r2=0.04)
        return h + r * 0.6

    def tower(self, name, x, y, h):
        lib.box(f"{name}-body", (0.7, 0.7, h), (x, y, h / 2), self.stone, bevel=0.03)
        for i in range(4):
            for j in (-1, 1):
                dx, dy = ((j * 0.25, -0.33), (0.33, j * 0.25), (j * 0.25, 0.33), (-0.33, j * 0.25))[i]
                lib.box(f"{name}-merlon{i}{j}", (0.16, 0.16, 0.14), (x + dx, y + dy, h + 0.07), self.stone)
        lib.box(f"{name}-slit", (0.05, 0.03, 0.22), (x, y - 0.36, h * 0.65), self.dark)
        lib.cyl(f"{name}-brazier", 0.09, 0.08, (x, y, h + 0.04), self.bronze, verts=10)
        lib.ball(f"{name}-coals", 0.06, (x, y, h + 0.09), self.ember, sub=1)
        return h + 0.15

    def fence(self, x0, y0, x1, y1, h=0.2):
        lib.box(f"wall{x0:.1f}{y0:.1f}", (abs(x1 - x0) + 0.12, abs(y1 - y0) + 0.12, h), ((x0 + x1) / 2, (y0 + y1) / 2, h / 2), self.stone, bevel=0.02)

    def mountain(self, x, y, w, h):
        """A peak of rock, the town's hall cut into its foot, snow on its top."""
        m = lib.cyl("peak", w / 2, h, (x, y, h / 2), self.rock, verts=9, r2=w * 0.06)
        lib.lumpy(m, 0.08, 0.18, 21)
        lib.cyl("shoulder", w * 0.36, h * 0.55, (x + w * 0.28, y + w * 0.1, h * 0.275), self.rock, verts=8, r2=w * 0.05)
        lib.cyl("snowcap", w * 0.16, h * 0.2, (x, y, h * 0.9), lib.mat("snow", (0.92, 0.92, 0.95), 0.8), verts=9, r2=w * 0.03)


class Centaur(Kit):
    def __init__(self, race, age):
        super().__init__(race, age)
        self.canvas = lib.mat("canvas", (0.92, 0.88, 0.76), 0.9, grain=0.12, grain_size=0.03)
        self.canvas2 = lib.mat("canvasdark", (0.78, 0.70, 0.54), 0.9, grain=0.15, grain_size=0.03)
        self.sky = lib.mat("skyblue", (0.40, 0.62, 0.80), 0.8)
        self.gold = lib.mat("gold", (0.92, 0.74, 0.30), 0.35, 0.9)
        self.yard = (0.56, 0.52, 0.36)

    def hall(self, name, x, y, w, d, h):
        # A long ridge tent on low canvas walls, its poles standing out at the ends, a blue band.
        wall = h * 0.35
        lib.box(f"{name}-walls", (w, d, wall), (x, y, wall / 2), self.canvas2)
        prism(f"{name}-tent", w + 0.12, d + 0.14, h - wall, (x, y, wall), self.canvas, "x")
        lib.box(f"{name}-band", (w + 0.02, d + 0.02, 0.05), (x, y, wall), self.sky)
        for dx in (-w / 2 - 0.06, w / 2 + 0.06):
            lib.cyl(f"{name}-pole{dx:.2f}", 0.022, h + 0.25, (x + dx, y, (h + 0.25) / 2), self.wood, verts=6)
        lib.box(f"{name}-flap", (0.36, 0.03, wall * 1.6), (x, y - d / 2 - 0.02, wall * 0.8), self.dark)
        return h + 0.25

    def hut(self, name, x, y, r, h):
        wall = h * 0.4
        lib.cyl(f"{name}-wall", r, wall, (x, y, wall / 2), self.canvas2, verts=16)
        lib.cyl(f"{name}-roof", r * 1.08, h - wall + r * 0.4, (x, y, wall + (h - wall + r * 0.4) / 2), self.canvas, verts=16, r2=0.04)
        lib.cyl(f"{name}-band", r * 1.01, 0.05, (x, y, wall), self.team, verts=16)
        lib.cyl(f"{name}-top", 0.015, 0.25, (x, y, h + r * 0.4 + 0.1), self.wood, verts=6)
        return h + r * 0.4

    def tower(self, name, x, y, h):
        # A star-watcher's frame: four poles, a platform, a canopy, a ring of bronze on top.
        for dx, dy in ((-0.3, -0.3), (0.3, -0.3), (0.3, 0.3), (-0.3, 0.3)):
            lib.cyl(f"{name}-leg{dx}{dy}", 0.035, h, (x + dx, y + dy, h / 2), self.wood, verts=8, r2=0.025)
        lib.box(f"{name}-deck", (0.8, 0.8, 0.05), (x, y, h * 0.85), self.wood, bevel=0.01)
        lib.cyl(f"{name}-canopy", 0.6, 0.3, (x, y, h + 0.12), self.canvas, verts=4, r2=0.03).rotation_euler = (0, 0, R(45))
        ring = lib.cyl(f"{name}-ring", 0.18, 0.02, (x, y, h + 0.45), self.gold, rot=(R(90), 0, R(30)), verts=20)
        lib.cyl(f"{name}-ring2", 0.18, 0.02, (x, y, h + 0.45), self.gold, rot=(R(90), 0, R(-50)), verts=20)
        ring.name = f"{name}-ring"
        return h + 0.65

    def fence(self, x0, y0, x1, y1, h=0.25):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 0.45))
        for i in range(n + 1):
            k = i / n
            lib.cyl(f"rp{x0:.1f}{y0:.1f}{i}", 0.02, h, (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, h / 2), self.wood, verts=6)
        lib.box(f"rope{x0:.1f}{y0:.1f}", (abs(x1 - x0) + 0.02, abs(y1 - y0) + 0.02, 0.012), ((x0 + x1) / 2, (y0 + y1) / 2, h * 0.85), self.canvas2)

    def pavilion(self, name, x, y, w, d, h):
        """Columns of wood under a canvas roof, open on every side: a centaur does not go in at a door."""
        n = 4 if w > 1.4 else 3
        for i in range(n):
            for yy in (y - d / 2, y + d / 2):
                xx = x - w / 2 + w * i / (n - 1)
                lib.cyl(f"{name}-col{i}{yy:.2f}", 0.04, h, (xx, yy, h / 2), self.wood if self.tier < 3 else self.canvas2, verts=10)
        lib.box(f"{name}-beam", (w + 0.1, d + 0.1, 0.06), (x, y, h + 0.03), self.wood)
        prism(f"{name}-roof", w + 0.25, d + 0.25, min(w, d) * 0.35, (x, y, h + 0.06), self.canvas, "x")
        lib.box(f"{name}-floor", (w, d, 0.04), (x, y, 0.02), self.canvas2)
        return h + min(w, d) * 0.4


class Beastfolk(Kit):
    def __init__(self, race, age):
        super().__init__(race, age)
        self.hide = lib.mat("hide", (0.60, 0.44, 0.27), 0.95, grain=0.35, grain_size=0.02)
        self.hide2 = lib.mat("hidedark", (0.42, 0.30, 0.18), 0.95, grain=0.35, grain_size=0.02)
        self.mud = lib.mat("mud", (0.54, 0.40, 0.26), 0.98, grain=0.35, grain_size=0.03)
        self.thatch = lib.mat("thatch", (0.72, 0.60, 0.32), 0.95, grain=0.45, grain_size=0.01)
        self.bone = lib.mat("bone", (0.90, 0.86, 0.74), 0.7)
        self.ochre = lib.mat("ochre", (0.64, 0.22, 0.14), 0.85)
        self.yard = (0.46, 0.36, 0.24)

    def hall(self, name, x, y, w, d, h):
        # A longhouse: mud walls, a steep thatch, horns of bone crossed over each gable, an ochre band.
        lib.box(f"{name}-walls", (w, d, h * 0.55), (x, y, h * 0.275), self.mud, bevel=0.04)
        lib.box(f"{name}-band", (w + 0.02, d + 0.02, 0.05), (x, y, h * 0.35), self.ochre)
        roof = prism(f"{name}-roof", w + 0.16, d + 0.2, h * 0.75, (x, y, h * 0.55), self.thatch, "x")
        lib.lumpy(roof, 0.015, 0.04)
        top = h * 0.55 + h * 0.75
        for dx in (-w / 2 - 0.05, w / 2 + 0.05):
            for k in (-1, 1):
                lib.cyl(f"{name}-horn{dx:.2f}{k}", 0.025, 0.3, (x + dx, y + k * 0.07, top + 0.08), self.bone, rot=(R(35 * k), 0, 0), verts=6, r2=0.004)
        lib.box(f"{name}-door", (0.28, 0.03, h * 0.45), (x, y - d / 2 - 0.01, h * 0.225), self.dark)
        return top + 0.2

    def hut(self, name, x, y, r, h):
        # A tent of hides on poles that stand out of its top.
        lib.cyl(f"{name}-tent", r, h, (x, y, h / 2), self.hide, verts=10, r2=r * 0.12)
        lib.cyl(f"{name}-stripe", r * 0.78, 0.06, (x, y, h * 0.3), self.ochre, verts=10)
        for i in range(3):
            a = R(120 * i)
            lib.cyl(f"{name}-pole{i}", 0.014, 0.35, (x + math.cos(a) * 0.04, y + math.sin(a) * 0.04, h + 0.1), self.wood, rot=(math.sin(a) * R(15), -math.cos(a) * R(15), 0), verts=5)
        lib.box(f"{name}-flap", (0.18, 0.03, h * 0.4), (x, y - r * 0.7, h * 0.2), self.dark, rot=(R(-12), 0, 0))
        return h + 0.25

    def totem(self, name, x, y, h):
        """A carved pole: painted rings, a beast's head on top with ears and teeth of bone."""
        cols = (self.hide2, self.ochre, self.wood, self.bone)
        n = 4
        for i in range(n):
            lib.cyl(f"{name}-seg{i}", 0.11 - i * 0.008, h / n, (x, y, h / n * (i + 0.5)), cols[i % 4], verts=10)
        lib.ball(f"{name}-head", 0.14, (x, y, h + 0.08), self.hide2, scale=(1, 1.2, 0.9), sub=2)
        lib.cyl(f"{name}-snout", 0.07, 0.14, (x, y - 0.14, h + 0.05), self.hide2, rot=(R(90), 0, 0), verts=8, r2=0.04)
        for k in (-1, 1):
            lib.cyl(f"{name}-ear{k}", 0.045, 0.12, (x + k * 0.08, y, h + 0.2), self.hide2, rot=(0, R(15 * k), 0), verts=4, r2=0.004)
            lib.cyl(f"{name}-fang{k}", 0.012, 0.06, (x + k * 0.035, y - 0.2, h + 0.0), self.bone, verts=5, r2=0.002)
        return h + 0.3

    def tower(self, name, x, y, h):
        top = self.totem(f"{name}-totem", x, y + 0.2, h)
        lib.box(f"{name}-deck", (0.7, 0.6, 0.05), (x, y - 0.1, h * 0.65), self.wood, bevel=0.01)
        for dx, dy in ((-0.3, -0.35), (0.3, -0.35)):
            lib.cyl(f"{name}-leg{dx}", 0.035, h * 0.65, (x + dx, y + dy, h * 0.325), self.wood, verts=6)
        lib.cyl(f"{name}-hidewall", 0.36, 0.18, (x, y - 0.1, h * 0.65 + 0.12), self.hide, verts=8)
        return top

    def fence(self, x0, y0, x1, y1, h=0.32):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 0.11))
        for i in range(n + 1):
            k = i / n
            lib.cyl(f"bone{x0:.1f}{y0:.1f}{i}", 0.025, h * (0.8 + 0.2 * (i % 2)), (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, h * 0.45), self.bone, verts=6, r2=0.004)

    def skull(self, x, y, z):
        lib.ball(f"skull{x:.2f}{y:.2f}", 0.06, (x, y, z), self.bone, scale=(1, 1.2, 0.85), sub=2)
        lib.ball(f"eye{x:.2f}{y:.2f}", 0.015, (x - 0.02, y - 0.065, z + 0.01), self.dark, sub=1)


KITS = {"elf": Elf, "dwarf": Dwarf, "centaur": Centaur, "beastfolk": Beastfolk}


# ---- the buildings, for every race. `k` is a Kit; `t` its tier (0 Stone Age to 3 Iron Age).

def town_center(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "elf":
        k.great_tree(0.15, 0.25, 1.4 + 0.25 * t, 0.9 + 0.1 * t)
        k.hut("tc-hut", -0.95, -0.55, 0.32, 0.4)
        k.fence(-1.35, -1.35, 1.35, -1.35)
    elif k.race == "dwarf":
        k.mountain(0.2, 0.75, 2.2, 1.3 + 0.2 * t)
        k.hall("tc", -0.1, -0.15, 1.6, 1.1, 0.55 + 0.08 * t)
        k.tower("tc-tower", 1.0, -0.8, 0.8 + 0.15 * t)
    elif k.race == "centaur":
        (k.pavilion if t >= 2 else k.hall)("tc", -0.2, 0.25, 1.9, 1.3, 0.75 + 0.1 * t)
        k.hut("tc-yurt", 0.9, -0.75, 0.38, 0.55)
        k.fence(-1.35, -1.35, 0.3, -1.35)
    else:
        k.hall("tc", -0.2, 0.3, 1.9, 1.2, 0.8 + 0.1 * t)
        k.hut("tc-tent", 0.95, -0.7, 0.35, 0.65)
        k.totem("tc-totem", -1.0, -0.9, 1.1 + 0.2 * t)
        k.fence(-1.4, 1.35, 1.4, 1.35)
    k.flag(1.2, 1.15, 1.3 + 0.2 * t)
    k.banner(-0.55, -0.42, 0.35)


def house(k):
    k.ground(2, k.yard)
    if k.tier == 0 or k.race in ("centaur", "beastfolk"):
        k.hut("house", 0, 0.1, 0.5 + 0.04 * k.tier, 0.45 + 0.06 * k.tier)
    else:
        k.hall("house", 0, 0.1, 1.1, 0.9, 0.42 + 0.06 * k.tier)
    k.banner(-0.45, -0.5, 0.25, 0.12, 0.16)


def granary(k):
    k.ground(3, k.yard)
    for i, (x, y) in enumerate(((-0.75, 0.65), (0.25, 0.8), (0.9, 0.05))):
        k.hut(f"store{i}", x, y, 0.32, 0.4 + 0.05 * k.tier)
    k.hall("granary", -0.3, -0.45, 1.2, 0.75, 0.45 + 0.05 * k.tier)
    sack = lib.mat("sack", (0.80, 0.70, 0.48), 0.9)
    for j in range(4):
        lib.cyl(f"sack{j}", 0.07, 0.12, (0.5 + 0.15 * j, -0.95, 0.06), sack, verts=10, r2=0.05)
    k.flag(1.2, -1.2, 0.8)


def storage_pit(k):
    k.ground(3, k.yard)
    lib.box("pit", (1.5, 1.3, 0.05), (-0.25, 0.25, 0.025), lib.mat("pitdark", (0.25, 0.18, 0.11), 1.0))
    k.hall("shed", -0.3, 0.45, 1.3, 1.0, 0.5 + 0.05 * k.tier)
    for j in range(5):
        lib.cyl(f"log{j}", 0.06, 0.7, (0.75, -0.9 + j * 0.13, 0.06), k.wood, rot=(0, R(90), 0), verts=8)
    stone = lib.mat("cutstone", (0.62, 0.60, 0.56), 0.9)
    gold = lib.mat("ore", (0.86, 0.68, 0.24), 0.5, 0.6)
    for j in range(4):
        lib.box(f"block{j}", (0.16, 0.12, 0.1), (-0.9 + j * 0.2, -1.05, 0.05), stone if j % 2 else gold, bevel=0.01)
    k.flag(1.15, 1.0, 0.8)


def barracks(k):
    k.ground(3, k.yard)
    k.hall("barracks", -0.2, 0.3, 2.0, 1.2, 0.55 + 0.08 * k.tier)
    for j in range(5):
        lib.cyl(f"spear{j}", 0.012, 0.6, (0.75 + j * 0.08, -0.9, 0.3), k.wood, rot=(R(-10), 0, 0), verts=6)
    for j in range(2):
        lib.cyl(f"shield{j}", 0.1, 0.02, (0.8 + j * 0.25, -1.0, 0.12), k.team, rot=(R(80), 0, 0), verts=14)
    # A post to strike at, in the yard.
    lib.cyl("dummy", 0.05, 0.5, (-0.9, -0.85, 0.25), k.wood, verts=8)
    lib.cyl("dummyarms", 0.02, 0.4, (-0.9, -0.85, 0.38), k.wood, rot=(0, R(90), 0), verts=6)
    if k.race == "beastfolk":
        k.skull(-0.9, -0.85, 0.55)
    k.banner(-0.9, -0.31, 0.38)
    k.flag(1.15, 1.1, 1.0 + 0.1 * k.tier)


def dock(k):
    deck = lib.mat("deck", (0.55, 0.38, 0.20), 0.85, grain=0.4, grain_size=0.02)
    lib.box("deck", (2.8, 2.8, 0.08), (0, 0, 0.12), deck, bevel=0.01)
    for x in (-1.3, 0, 1.3):
        for y in (-1.3, 0, 1.3):
            lib.cyl(f"pile{x}{y}", 0.05, 0.3, (x, y, 0.0), k.wood, verts=8)
    import bpy
    before = set(bpy.data.objects)
    k.hut("dockhut", -0.55, 0.6, 0.45, 0.45)
    for o in set(bpy.data.objects) - before:
        o.location.z += 0.16  # on the deck
    lib.cyl("crane", 0.04, 1.2, (0.9, 0.9, 0.76), k.wood, verts=8)
    lib.cyl("boom", 0.03, 0.9, (0.9, 0.5, 1.3), k.wood, rot=(R(70), 0, 0), verts=8)
    for j in range(5):
        lib.cyl(f"rib{j}", 0.015, 0.4, (0.5, -0.9 + j * 0.18, 0.3), k.wood, rot=(0, R(90), 0), verts=6)
    k.flag(-1.2, -1.2, 0.9)


def archery_range(k):
    k.ground(3, k.yard)
    k.hall("range", -0.5, 0.55, 1.3, 1.1, 0.5 + 0.06 * k.tier)
    straw = lib.mat("straw", (0.82, 0.70, 0.38), 0.95, grain=0.4, grain_size=0.01)
    for j, y in enumerate((-0.4, 0.3, 1.0)):
        lib.cyl(f"butt{j}", 0.17, 0.3, (1.1, y, 0.3), straw, rot=(0, R(90), 0), verts=14)
        lib.cyl(f"target{j}", 0.1, 0.02, (0.94, y, 0.3), k.team, rot=(0, R(90), 0), verts=14)
    for j in range(4):
        lib.cyl(f"bow{j}", 0.008, 0.4, (-0.9 + j * 0.12, -0.9, 0.2), k.wood, verts=5)
    k.flag(-1.15, -1.1, 1.0)


def stable(k):
    k.ground(3, k.yard)
    (k.pavilion if k.race == "centaur" else k.hall)("stable", -0.3, 0.55, 2.1, 0.9, 0.5 + 0.06 * k.tier)
    k.fence(-1.3, -1.25, 1.3, -1.25)
    hay = lib.mat("hay", (0.86, 0.74, 0.40), 0.95, grain=0.4, grain_size=0.01)
    for j in range(3):
        lib.ball(f"hay{j}", 0.15, (0.6 + j * 0.25, -0.5, 0.08), hay, scale=(1.2, 1, 0.6), sub=2)
    lib.box("trough", (0.6, 0.2, 0.12), (-0.6, -0.55, 0.06), k.wood, bevel=0.01)
    k.flag(1.15, 1.1, 1.0)


def market(k):
    k.ground(3, k.yard)
    k.hall("store", -0.6, 0.6, 1.2, 1.0, 0.5 + 0.06 * k.tier)
    clay = lib.mat("clay", (0.70, 0.40, 0.24), 0.8)
    for j, (x, y) in enumerate(((0.75, -0.2), (0.0, -0.9), (0.85, -1.0))):
        for dx, dy in ((-0.25, -0.18), (0.25, -0.18), (0.25, 0.18), (-0.25, 0.18)):
            lib.cyl(f"spost{j}{dx}{dy}", 0.018, 0.42, (x + dx, y + dy, 0.21), k.wood, verts=6)
        lib.box(f"awning{j}", (0.6, 0.45, 0.02), (x, y, 0.43), k.team, rot=(R(8), 0, 0))
        lib.box(f"counter{j}", (0.5, 0.3, 0.12), (x, y, 0.06), k.wood, bevel=0.01)
        for i in range(3):
            lib.ball(f"pot{j}{i}", 0.05, (x - 0.15 + i * 0.15, y, 0.16), clay, scale=(1, 1, 1.2), sub=2)
    k.flag(1.2, 1.15, 1.0)


def tower(k, kind):
    k.ground(2, k.yard)
    h = {"watch_tower": 1.3, "sentry_tower": 1.5, "guard_tower": 1.75, "ballista_tower": 1.95}[kind]
    top = k.tower("tower", 0, 0, h)
    if kind == "ballista_tower":
        lib.box("ballista", (0.06, 0.5, 0.06), (0, -0.05, top + 0.02), k.wood, rot=(R(10), 0, 0))
        lib.box("arms", (0.5, 0.05, 0.04), (0, -0.2, top + 0.05), k.wood)
    k.flag(0.45, 0.45, h * 0.7 + 0.4)


def government_center(k):
    k.ground(3, k.yard)
    t = k.tier
    if k.race == "centaur":
        k.pavilion("gov", -0.15, 0.2, 2.0, 1.5, 0.85)
    else:
        k.hall("gov", -0.15, 0.25, 2.0, 1.4, 0.7 + 0.08 * t)
    k.tower("govtower", 1.0, -0.8, 1.1 + 0.1 * t)
    k.banner(-0.75, -0.48, 0.45)
    k.banner(0.35, -0.48, 0.45)
    k.flag(-1.15, 1.15, 1.4)


def temple(k):
    k.ground(3, k.yard)
    if k.race == "elf":
        # A sacred tree in a ring of white stones, an altar of living wood before it.
        k.great_tree(0, 0.35, 1.2, 0.75)
        for i in range(8):
            a = R(45 * i)
            lib.box(f"ringstone{i}", (0.12, 0.08, 0.3), (math.cos(a) * 1.15, 0.2 + math.sin(a) * 1.0, 0.15), k.paving, rot=(0, 0, a))
        lib.box("altar", (0.35, 0.22, 0.2), (0.0, -0.75, 0.1), k.live, bevel=0.03)
    elif k.race == "dwarf":
        # A forge-hall: an anvil and a great fire before its door.
        k.hall("forge", 0, 0.35, 1.8, 1.1, 0.75)
        lib.box("anvil", (0.3, 0.14, 0.14), (0.55, -0.75, 0.22), k.dstone, bevel=0.02)
        lib.box("anvilfoot", (0.14, 0.1, 0.15), (0.55, -0.75, 0.075), k.dstone)
        lib.cyl("firepit", 0.25, 0.1, (-0.5, -0.8, 0.05), k.stone, verts=12)
        lib.ball("fire", 0.15, (-0.5, -0.8, 0.14), k.ember, scale=(1, 1, 0.7), sub=2)
        for x in (-0.95, 0.95):
            lib.cyl(f"statue{x}", 0.09, 0.55, (x, -0.55, 0.28), k.stone, verts=8)
            lib.ball(f"statuehead{x}", 0.08, (x, -0.55, 0.6), k.stone, sub=2)
    elif k.race == "centaur":
        # An observatory: a round pavilion, the great ring of the sky over it.
        for i in range(8):
            a = R(45 * i)
            lib.cyl(f"col{i}", 0.045, 0.85, (math.cos(a) * 0.85, 0.15 + math.sin(a) * 0.85, 0.425), k.canvas2, verts=10)
        lib.cyl("dome", 1.0, 0.45, (0, 0.15, 1.07), k.canvas, verts=16, r2=0.08)
        lib.cyl("floor", 0.95, 0.06, (0, 0.15, 0.03), k.canvas2, verts=16)
        for rot in ((R(90), 0, R(20)), (R(90), 0, R(-40)), (0, 0, 0)):
            lib.cyl(f"armillary{rot[2]:.2f}{rot[0]:.2f}", 0.35, 0.025, (0, 0.15, 1.75), k.gold, rot=rot, verts=24)
        lib.cyl("mast", 0.025, 0.5, (0, 0.15, 1.45), k.wood, verts=6)
    else:
        # A ring of totems round a fire.
        for i in range(6):
            a = R(60 * i + 30)
            k.totem(f"ring{i}", math.cos(a) * 0.95, 0.1 + math.sin(a) * 0.95, 0.75 + 0.15 * (i % 2))
        lib.cyl("firepit", 0.28, 0.08, (0, 0.1, 0.04), lib.mat("stones", (0.45, 0.43, 0.40), 0.9), verts=10)
        lib.ball("fire", 0.16, (0, 0.1, 0.14), lib.mat("flame", (1.0, 0.55, 0.12), 0.6), scale=(1, 1, 1.2), sub=2)
        for j in range(3):
            k.skull(-0.4 + j * 0.4, -1.0, 0.06)
    k.flag(1.2, 1.2, 1.2)


def academy(k):
    k.ground(3, k.yard)
    k.hall("back", 0, 0.85, 2.3, 0.65, 0.6 + 0.06 * k.tier)
    k.hall("left", -0.95, -0.15, 0.6, 1.0, 0.55 + 0.06 * k.tier)
    lib.box("court", (1.4, 1.0, 0.02), (0.3, 0.0, 0.02), lib.mat("paving", (0.70, 0.66, 0.58), 0.9, grain=0.2))
    lib.cyl("post", 0.06, 0.5, (0.3, -0.1, 0.25), k.wood, verts=8)
    k.banner(0.9, 0.5, 0.45)
    k.flag(1.15, -1.15, 1.2)


def siege_workshop(k):
    k.ground(3, k.yard)
    k.hall("shop", -0.5, 0.5, 1.8, 1.3, 0.7)
    lib.box("frame", (0.5, 0.7, 0.06), (0.75, -0.75, 0.15), k.wood)
    lib.cyl("arm", 0.025, 0.8, (0.75, -0.75, 0.45), k.wood, rot=(R(-40), 0, 0), verts=6)
    for j in range(4):
        lib.cyl(f"beam{j}", 0.05, 0.9, (-0.5 + j * 0.03, -1.05 + j * 0.1, 0.05 + (j % 2) * 0.08), k.wood, rot=(0, R(90), 0), verts=6)
    k.flag(1.15, 1.1, 1.3)


def wonder(k):
    k.ground(5, k.yard)
    if k.race == "elf":
        # The World Tree: a vast trunk, decks all the way up, a crown over the whole yard.
        top = k.great_tree(0, 0.3, 2.6, 2.1)
        for x in (-1.9, 1.9):
            k.hut(f"wtree-hut{x}", x, -1.5, 0.4, 0.5)
    elif k.race == "dwarf":
        # A gate into the mountain, kings of stone either side of it.
        k.mountain(0, 0.9, 4.2, 2.6)
        lib.box("gateframe", (1.6, 0.3, 1.5), (0, -0.6, 0.75), k.dstone, bevel=0.04)
        lib.box("gate", (0.9, 0.06, 1.1), (0, -0.76, 0.55), k.bronze)
        lib.box("gatelintel", (2.0, 0.35, 0.22), (0, -0.62, 1.6), k.stone, bevel=0.03)
        for x in (-1.4, 1.4):
            lib.box(f"king{x}", (0.5, 0.45, 1.5), (x, -0.8, 0.75), k.stone, bevel=0.05)
            lib.ball(f"kinghead{x}", 0.22, (x, -0.85, 1.65), k.stone, sub=2)
            lib.ball(f"kingbeard{x}", 0.16, (x, -1.0, 1.4), k.stone, scale=(1, 0.7, 1.4), sub=2)
    elif k.race == "centaur":
        # The great observatory: a stepped round platform, a mast and rings of gold.
        z = 0.0
        for j, r in enumerate((2.2, 1.7, 1.2)):
            lib.cyl(f"step{j}", r, 0.3, (0, 0, z + 0.15), k.canvas2 if j % 2 else k.canvas, verts=24)
            z += 0.3
        lib.cyl("mast", 0.07, 1.8, (0, 0, z + 0.9), k.wood, verts=10)
        for rot in ((R(90), 0, R(20)), (R(90), 0, R(-40)), (R(90), 0, R(80)), (0, 0, 0)):
            lib.cyl(f"wring{rot[2]:.2f}{rot[0]:.2f}", 0.75, 0.04, (0, 0, z + 1.6), k.gold, rot=rot, verts=32)
        for j in range(6):
            a = R(60 * j)
            k.hut(f"wtent{j}", math.cos(a) * 2.05, math.sin(a) * 2.05, 0.28, 0.4)
    else:
        # A mound under the skull of a giant beast, totems round it.
        mound = lib.ball("mound", 1.6, (0, 0.2, 0.3), k.mud, scale=(1.3, 1.2, 0.7), sub=3)
        lib.lumpy(mound, 0.08, 0.1, 9)
        lib.ball("skull", 0.9, (0, 0.1, 1.55), k.bone, scale=(1.0, 1.25, 0.8), sub=3)
        for x in (-0.38, 0.38):
            lib.ball(f"socket{x}", 0.2, (x, -0.85, 1.6), k.dark, sub=2)
            lib.cyl(f"tusk{x}", 0.09, 1.0, (x * 1.6, -1.0, 1.1), k.bone, rot=(R(-60), R(20 if x > 0 else -20), 0), verts=8, r2=0.01)
        for j in range(4):
            a = R(90 * j + 45)
            k.totem(f"wtotem{j}", math.cos(a) * 2.0, math.sin(a) * 2.0, 1.3)
    k.flag(2.2, 2.2, 1.5)


BUILDERS = {
    "town_center": town_center, "house": house, "granary": granary, "storage_pit": storage_pit, "barracks": barracks,
    "dock": dock, "archery_range": archery_range, "stable": stable, "market": market,
    "watch_tower": lambda k: tower(k, "watch_tower"), "sentry_tower": lambda k: tower(k, "sentry_tower"),
    "guard_tower": lambda k: tower(k, "guard_tower"), "ballista_tower": lambda k: tower(k, "ballista_tower"),
    "government_center": government_center, "temple": temple, "academy": academy, "siege_workshop": siege_workshop,
    "wonder": wonder,
}


# ---- what every race's buildings get once laid out (replica/fantasy-art-plan.md, "all"): the race's own small
# things about the yard, its own light, and the house and granary brought down to the size of everyone's.

LIGHT = {"elf": (0.55, 0.95, 0.75), "dwarf": (1.0, 0.45, 0.12), "centaur": (1.0, 0.80, 0.42), "beastfolk": (1.0, 0.55, 0.18)}


def glow(k, name, x, y, z, r=0.03):
    lib.ball(name, r, (x, y, z), lib.mat(f"{k.race}-glow", LIGHT[k.race], 1.0, emit=LIGHT[k.race]), sub=1)


def prop(k, name, x, y, kind):
    """One of a race's own things, at (x, y) on the ground."""
    if k.race == "elf":
        if kind == 0:  # glowing mushrooms
            for j in range(3):
                dx, dy = (j - 1) * 0.05, (j % 2) * 0.04
                lib.cyl(f"{name}-stem{j}", 0.01, 0.06, (x + dx, y + dy, 0.03), lib.mat("stem", (0.86, 0.84, 0.76), 0.9), verts=6)
                lib.ball(f"{name}-cap{j}", 0.03, (x + dx, y + dy, 0.065), lib.mat("elf-glow", LIGHT["elf"], 1.0, emit=LIGHT["elf"]), scale=(1, 1, 0.5), sub=1)
        elif kind == 1:  # a moonstone lantern on a curled post
            lib.cyl(f"{name}-post", 0.012, 0.3, (x, y, 0.15), k.bark, verts=6)
            glow(k, f"{name}-stone", x, y, 0.32, 0.035)
        else:  # flowers in a pot of woven twigs
            lib.cyl(f"{name}-pot", 0.04, 0.05, (x, y, 0.025), k.bark, verts=10)
            for j in range(4):
                lib.ball(f"{name}-fl{j}", 0.018, (x + 0.025 * math.cos(j * 1.6), y + 0.025 * math.sin(j * 1.6), 0.07),
                         lib.mat("flower", (0.92, 0.86, 0.95), 0.8), sub=1)
    elif k.race == "dwarf":
        if kind == 0:  # a barrel bound in bronze
            lib.cyl(f"{name}-barrel", 0.045, 0.1, (x, y, 0.05), k.wood, verts=12)
            lib.cyl(f"{name}-hoop", 0.047, 0.012, (x, y, 0.07), k.bronze, verts=12)
        elif kind == 1:  # an anvil on a block, and a brazier
            lib.box(f"{name}-block", (0.08, 0.08, 0.06), (x, y, 0.03), k.wood)
            lib.box(f"{name}-anvil", (0.11, 0.05, 0.04), (x, y, 0.08), k.dstone)
            lib.cyl(f"{name}-braz", 0.035, 0.05, (x + 0.1, y, 0.025), k.bronze, verts=8)
            glow(k, f"{name}-coal", x + 0.1, y, 0.055, 0.025)
        else:  # a cart of ore
            lib.box(f"{name}-cart", (0.12, 0.08, 0.05), (x, y, 0.045), k.wood, bevel=0.006)
            for j in range(3):
                lib.ball(f"{name}-ore{j}", 0.025, (x - 0.03 + j * 0.03, y, 0.08), k.rock, sub=1)
    elif k.race == "centaur":
        if kind == 0:  # a rug laid out
            lib.box(f"{name}-rug", (0.16, 0.1, 0.006), (x, y, 0.004), k.sky)
            lib.box(f"{name}-rugband", (0.16, 0.03, 0.007), (x, y, 0.005), k.team)
        elif kind == 1:  # a lantern on a pole
            lib.cyl(f"{name}-pole", 0.01, 0.34, (x, y, 0.17), k.wood, verts=6)
            lib.box(f"{name}-arm", (0.07, 0.01, 0.01), (x + 0.03, y, 0.33), k.wood)
            glow(k, f"{name}-lamp", x + 0.06, y, 0.3, 0.025)
        else:  # a saddle on a stand, a water jar
            lib.box(f"{name}-stand", (0.1, 0.04, 0.07), (x, y, 0.035), k.wood)
            lib.ball(f"{name}-saddle", 0.045, (x, y, 0.08), lib.mat("leather", (0.48, 0.30, 0.16), 0.7), scale=(1.2, 0.8, 0.5), sub=1)
            lib.ball(f"{name}-jar", 0.035, (x + 0.09, y, 0.04), k.canvas2, scale=(1, 1, 1.3), sub=1)
    else:
        if kind == 0:  # a heap of bones and a skull
            for j in range(3):
                lib.cyl(f"{name}-bone{j}", 0.01, 0.12, (x + j * 0.02, y, 0.012), k.bone, rot=(0, R(90), j), verts=5)
            k.skull(x + 0.06, y + 0.03, 0.04)
        elif kind == 1:  # a fire ringed with stones
            for j in range(6):
                a = j * math.pi / 3
                lib.ball(f"{name}-st{j}", 0.02, (x + 0.06 * math.cos(a), y + 0.06 * math.sin(a), 0.012), k.mud, sub=1)
            glow(k, f"{name}-fire", x, y, 0.035, 0.035)
        else:  # a drum of hide
            lib.cyl(f"{name}-drum", 0.045, 0.07, (x, y, 0.035), k.hide, verts=12)
            lib.cyl(f"{name}-skin", 0.046, 0.008, (x, y, 0.072), k.bone, verts=12)


def finish(k, key):
    if key in ("dock",) or key.endswith("tower"):
        return
    size = 5 if key == "wonder" else 2 if key == "house" else 3
    rnd = random.Random(f"{k.race}-{key}-{k.tier}")  # the same picture on every render
    # Along the front edges of the yard, where they show and stand in front of nothing.
    n = 3 + k.tier + (3 if key in ("town_center", "temple", "wonder", "government_center") else 0)
    c = size / 2 - 0.2
    for i in range(n):
        t = (i + 0.5) / n
        x, y = (-c + t * 2 * c, -c) if i % 2 == 0 else (c, -c + t * 2 * c)
        prop(k, f"race-prop{i}", x + rnd.uniform(-0.08, 0.08), y + rnd.uniform(-0.08, 0.08), (i + k.tier) % 3)
    if key in ("house", "granary"):
        lib.scale_all(0.8)  # everyone's were a quarter bigger than the original's (art-plan.md, "co")


def make(race, key, age):
    import race_compounds  # the compounds of the approved plan, built on this file's Kits and plain buildings
    k = KITS[race](race, age)
    if key == "wonder":
        import race_wonders  # each race's colossal statue (the owner's notes, 2026-10-17)
        race_wonders.WONDERS[race](k)
    elif race == "elf":
        import elf_ages  # the elves' own, age by age (replica/elf-ages-plan.md)
        elf_ages.BUILDERS[key](k)
    else:
        race_compounds.BUILDERS[key](k)
    finish(k, key)


def ages_of(key):
    """The ages a building gets a picture of: from its first on; a tower is of one time only."""
    first = AGES[FIRST[key]]
    return [first] if key in ONE_LOOK else AGES[FIRST[key]:]
