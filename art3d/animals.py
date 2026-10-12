# Animals: a four-legged figure on a skeleton of empties, posed frame by frame, like the villager.
# Facing Blender -Y. One unit is one tile.

import math

import lib

R = math.radians

TAN = (0.78, 0.58, 0.34)
BELLY = (0.94, 0.88, 0.76)
HOOF = (0.16, 0.12, 0.08)
HORN = (0.22, 0.17, 0.12)


class Gazelle:
    """A gazelle: slim, long-legged, with ringed horns and a white belly."""

    def __init__(self):
        coat, belly = lib.mat("coat", TAN, 0.75), lib.mat("belly", BELLY, 0.8)
        hoof, horn = lib.mat("hoof", HOOF, 0.6), lib.mat("horn", HORN, 0.5)
        self.root = lib.empty("root")
        self.body = lib.empty("body", (0, 0, 0.30), self.root)
        lib.ball("torso", 0.11, (0, 0, 0.31), coat, self.body, scale=(0.8, 1.7, 0.85))
        lib.ball("underside", 0.088, (0, 0.0, 0.29), belly, self.body, scale=(0.72, 1.6, 0.7))
        lib.box("flank", (0.005, 0.24, 0.025), (0.072, 0, 0.29), lib.mat("stripe", (0.30, 0.20, 0.12), 0.8), self.body)
        lib.box("flank2", (0.005, 0.24, 0.025), (-0.072, 0, 0.29), lib.mat("stripe", (0.30, 0.20, 0.12), 0.8), self.body)
        self.neck = lib.empty("neck", (0, -0.14, 0.34), self.body)
        lib.cyl("neckc", 0.04, 0.17, (0, -0.17, 0.41), coat, self.neck, rot=(R(-30), 0, 0), r2=0.03)
        lib.ball("head", 0.05, (0, -0.21, 0.49), coat, self.neck, scale=(0.85, 1.4, 0.9))
        lib.ball("muzzle", 0.025, (0, -0.265, 0.475), belly, self.neck)
        for x in (0.02, -0.02):
            lib.cyl(f"horn{x}", 0.009, 0.13, (x, -0.19, 0.57), horn, self.neck, rot=(R(25), 0, 0), r2=0.003, verts=6)
            lib.ball(f"ear{x}", 0.018, (x * 2.2, -0.18, 0.52), coat, self.neck, scale=(1.4, 0.5, 0.8))
        lib.cyl("tail", 0.012, 0.07, (0, 0.17, 0.31), lib.mat("tailtip", HOOF, 0.6), self.body, rot=(R(-30), 0, 0))
        self.legs, self.knees = {}, {}
        for name, x, y in (("FL", 0.045, -0.11), ("FR", -0.045, -0.11), ("BL", 0.05, 0.11), ("BR", -0.05, 0.11)):
            h = lib.empty(f"hip{name}", (x, y, 0.27), self.body)
            lib.cyl(f"thigh{name}", 0.028, 0.14, (x, y, 0.20), coat, h, r2=0.014)
            k = lib.empty(f"knee{name}", (x, y, 0.13), h)
            lib.cyl(f"shin{name}", 0.013, 0.12, (x, y, 0.07), coat, k, r2=0.009)
            lib.cyl(f"hoof{name}", 0.012, 0.025, (x, y, 0.012), hoof, k)
            self.legs[name], self.knees[name] = h, k

    def face(self, angle):
        self.root.rotation_euler = (0, 0, angle)

    def pose(self, anim, t):
        s = math.sin(2 * math.pi * t)
        self.body.location = (0, 0, 0.30)
        self.body.rotation_euler = (0, 0, 0)
        self.neck.rotation_euler = (0, 0, 0)
        for k in self.legs:
            self.legs[k].rotation_euler = (0, 0, 0)
            self.knees[k].rotation_euler = (0, 0, 0)
        if anim == "idle":
            # Grazing: the head goes down to the grass and comes up to look about.
            down = max(0.0, math.sin(math.pi * t)) ** 0.6
            self.neck.rotation_euler = (R(75 * down), 0, R(10 * math.sin(4 * math.pi * t) * (1 - down)))
        elif anim == "walk":
            # A bounding run: front legs together, back legs together, the body rocking.
            self.body.location = (0, 0, 0.30 + 0.03 * max(0.0, s))
            self.body.rotation_euler = (R(6 * math.cos(2 * math.pi * t)), 0, 0)
            for k, phase in (("FL", 0), ("FR", 0.08), ("BL", math.pi), ("BR", math.pi + 0.08)):
                a = math.sin(2 * math.pi * t + phase)
                self.legs[k].rotation_euler = (R(-35 * a), 0, 0)
                self.knees[k].rotation_euler = (R((30 if k[0] == "F" else -30) * max(0.0, -a)), 0, 0)
            self.neck.rotation_euler = (R(-8 * s), 0, 0)
        elif anim == "dead":
            # On its side, legs out.
            self.body.location = (0, 0, 0.07)
            self.body.rotation_euler = (0, R(85), 0)
            self.neck.rotation_euler = (R(30), 0, 0)
            for k in self.legs:
                self.legs[k].rotation_euler = (R(-20 if k[0] == "F" else 20), 0, 0)


class Quadruped:
    """A four-legged animal from a few numbers: a body, a neck and head on the front, four legs with a knee
    each, a tail. Subclasses add what makes the animal (a trunk, a mane, a long jaw)."""

    BODY = (0.12, 1.8, 0.8)    # radius, and stretch along and up
    HIGH = 0.3                 # height of the body's middle
    LEG = (0.03, 0.15, 0.13)   # thickness, upper and lower length
    SPREAD = (0.06, 0.13)      # legs apart: sideways, front to back
    GAIT = 30                  # how far a leg swings walking, degrees

    def __init__(self, coat):
        self.coat = coat
        self.root = lib.empty("root")
        r, sy, sz = self.BODY
        self.body = lib.empty("body", (0, 0, self.HIGH), self.root)
        lib.ball("torso", r, (0, 0, self.HIGH), coat, self.body, scale=(1, sy, sz), sub=3)
        front = -r * sy * 0.85
        self.neck = lib.empty("neck", (0, front, self.HIGH + r * 0.3), self.body)
        self.legs, self.knees = {}, {}
        th, up, low = self.LEG
        sx, sy2 = self.SPREAD
        for name, x, y in (("FL", sx, -sy2), ("FR", -sx, -sy2), ("BL", sx, sy2), ("BR", -sx, sy2)):
            top = self.HIGH - r * sz * 0.3
            h = lib.empty(f"hip{name}", (x, y, top), self.body)
            lib.cyl(f"thigh{name}", th, up, (x, y, top - up / 2), coat, h, r2=th * 0.75)
            k = lib.empty(f"knee{name}", (x, y, top - up), h)
            lib.cyl(f"shin{name}", th * 0.7, low, (x, y, top - up - low / 2), coat, k, r2=th * 0.6)
            self.legs[name], self.knees[name] = h, k
        self.tail = lib.empty("tailroot", (0, r * sy * 0.9, self.HIGH + r * 0.2), self.body)
        self.head()

    def head(self):
        pass

    def face(self, angle):
        self.root.rotation_euler = (0, 0, angle)

    def rest(self):
        self.body.location = (0, 0, self.HIGH)
        self.body.rotation_euler = (0, 0, 0)
        self.neck.rotation_euler = (0, 0, 0)
        self.tail.rotation_euler = (0, 0, 0)
        for k in self.legs:
            self.legs[k].rotation_euler = (0, 0, 0)
            self.knees[k].rotation_euler = (0, 0, 0)

    def pose(self, anim, t):
        self.rest()
        s = math.sin(2 * math.pi * t)
        if anim == "idle":
            self.neck.rotation_euler = (R(4 * s), 0, R(8 * math.sin(math.pi * t)))
            self.tail.rotation_euler = (0, R(15 * s), 0)
        elif anim == "walk":
            # A walk: the legs in diagonal pairs.
            self.body.location = (0, 0, self.HIGH + 0.008 * abs(s))
            for k, phase in (("FL", 0), ("BR", 0), ("FR", math.pi), ("BL", math.pi)):
                a = math.sin(2 * math.pi * t + phase)
                self.legs[k].rotation_euler = (R(-self.GAIT * a), 0, 0)
                self.knees[k].rotation_euler = (R((25 if k[0] == "F" else -25) * max(0.0, -a)), 0, 0)
            self.neck.rotation_euler = (R(3 * s), 0, 0)
            self.tail.rotation_euler = (0, R(10 * s), 0)
        elif anim == "attack":
            self.strike(t)
        elif anim == "dead":
            self.body.location = (0, 0, self.BODY[0] * self.BODY[2] * 0.9)
            self.body.rotation_euler = (0, R(88), 0)
            self.neck.rotation_euler = (R(20), 0, 0)
            for k in self.legs:
                self.legs[k].rotation_euler = (R(-15 if k[0] == "F" else 15), 0, 0)

    def strike(self, t):
        """A lunge: back on the haunches, then forward with the head."""
        k = math.sin(math.pi * t)
        lean = -10 + 22 * (t if t < 0.6 else (1 - t) / 0.4 * 0.6)
        self.body.rotation_euler = (R(lean), 0, 0)
        self.body.location = (0, -0.05 * k, self.HIGH)
        self.neck.rotation_euler = (R(25 * k), 0, 0)
        for name in ("FL", "FR"):
            self.legs[name].rotation_euler = (R(-30 * k), 0, 0)


class Elephant(Quadruped):
    """An elephant as big as one is: a long, deep body higher at the shoulder than the rump, four column legs
    on round feet with nails, a big head with a domed brow, wide ears that flap, curved tusks, and a trunk
    of seven pieces that hangs nearly to the ground and swings. Shoulder about 1.3 times a villager."""

    HIGH = 0.80                 # the body's middle
    BODY = (0.36, 1.55, 0.95)   # for Quadruped's dead pose: lying, the body's middle this high
    GAIT = 16
    TOP = HIGH + 0.36           # the top of the back at the shoulder, where a rider sits
    SEAT = (0, -0.34, HIGH + 0.3)
    WIDE, LONG = 0.30, 0.58     # the body's half width and half length

    def __init__(self):
        skin = lib.mat("hide", (0.52, 0.49, 0.47), 0.9, grain=0.45, grain_size=0.05)
        self.coat = skin
        dark = lib.mat("hidedark", (0.38, 0.35, 0.34), 0.95, grain=0.3, grain_size=0.04)
        ivory = lib.mat("ivory", (0.93, 0.89, 0.78), 0.4, grain=0)
        self.root = lib.empty("root")
        h = self.HIGH
        self.body = lib.empty("body", (0, 0, h), self.root)
        # The barrel, a hump of shoulder in front and a rounder, lower rump behind, the belly sagging.
        lib.ball("torso", 0.36, (0, 0.02, h), skin, self.body, scale=(0.83, 1.55, 0.92), sub=3)
        lib.ball("shoulders", 0.33, (0, -0.3, h + 0.08), skin, self.body, scale=(0.9, 0.85, 0.95), sub=3)
        lib.ball("rump", 0.31, (0, 0.34, h - 0.01), skin, self.body, scale=(0.92, 0.85, 0.95), sub=3)
        lib.ball("belly", 0.3, (0, 0.0, h - 0.13), skin, self.body, scale=(0.85, 1.3, 0.7), sub=3)
        self.legs, self.knees = {}, {}
        for name, x, y in (("FL", 0.17, -0.33), ("FR", -0.17, -0.33), ("BL", 0.17, 0.36), ("BR", -0.17, 0.36)):
            top = h - 0.12
            hip = lib.empty(f"hip{name}", (x, y, top), self.body)
            lib.cyl(f"thigh{name}", 0.115, 0.38, (x, y, top - 0.17), skin, hip, r2=0.1, verts=16)
            k = lib.empty(f"knee{name}", (x, y, top - 0.36), hip)
            lib.cyl(f"shin{name}", 0.1, 0.34, (x, y, top - 0.36 - 0.15), skin, k, r2=0.105, verts=16)
            lib.cyl(f"foot{name}", 0.12, 0.05, (x, y, 0.025), dark, k, r2=0.115, verts=16)
            for n in range(3):
                a = R(-90 + (n - 1) * 32)
                lib.ball(f"nail{name}{n}", 0.026, (x + 0.1 * math.cos(a), y + 0.1 * math.sin(a), 0.035), ivory, k, scale=(1, 1, 0.8), sub=1)
            self.legs[name], self.knees[name] = hip, k
        # The head, on a short thick neck low on the front.
        self.neck = lib.empty("neck", (0, -0.55, h + 0.12), self.body)
        y, z = -0.72, h + 0.2
        lib.ball("head", 0.22, (0, y, z), skin, self.neck, scale=(0.95, 0.9, 1.05), sub=3)
        lib.ball("brow", 0.16, (0, y - 0.04, z + 0.12), skin, self.neck, scale=(1.1, 0.8, 0.7), sub=2)
        for x in (0.1, -0.1):
            lib.ball(f"eye{x}", 0.018, (x * 1.45, y - 0.13, z + 0.05), lib.mat("eye", (0.08, 0.06, 0.05), 0.4), self.neck, sub=1)
        # Ears: wide flat fans behind the head, on a hinge each so they flap.
        self.ears = []
        for side in (1, -1):
            e = lib.empty(f"earhinge{side}", (side * 0.17, y + 0.08, z + 0.08), self.neck)
            ear = lib.ball(f"ear{side}", 0.24, (side * 0.24, y + 0.16, z - 0.0), skin, e, scale=(0.13, 0.85, 1.0), sub=2)
            ear.rotation_euler = (0, 0, R(side * 22))
            lib.ball(f"earin{side}", 0.2, (side * 0.215, y + 0.15, z - 0.01), lib.mat("earin", (0.62, 0.50, 0.48), 0.9), e, scale=(0.08, 0.75, 0.85), sub=2)
            self.ears.append((side, e))
        # Tusks, curving forward and up from either side of the trunk's root.
        for side in (1, -1):
            x = side * 0.09
            lib.cyl(f"tuskA{side}", 0.036, 0.2, (x, y - 0.2, z - 0.15), ivory, self.neck, rot=(R(-120), 0, 0), r2=0.03, verts=10)
            lib.cyl(f"tuskB{side}", 0.03, 0.16, (x, y - 0.35, z - 0.15), ivory, self.neck, rot=(R(-60), 0, 0), r2=0.006, verts=10)
        # The trunk, seven pieces from the face nearly down to the ground.
        self.trunk = []
        parent, at = self.neck, (0, y - 0.17, z - 0.02)
        for k in range(7):
            seg = lib.empty(f"trunk{k}", at, parent)
            r0, r1 = 0.085 - k * 0.008, 0.078 - k * 0.008
            lib.cyl(f"trunkc{k}", r0, 0.11, (at[0], at[1], at[2] - 0.05), skin, seg, r2=r1, verts=12)
            lib.ball(f"trunkj{k}", r1, (at[0], at[1], at[2] - 0.1), skin, seg, sub=1)
            self.trunk.append(seg)
            parent, at = seg, (at[0], at[1], at[2] - 0.1)
        self.tail = lib.empty("tailroot", (0, 0.66, h + 0.08), self.body)
        lib.cyl("tail", 0.018, 0.42, (0, 0.68, h - 0.13), skin, self.tail, rot=(R(-8), 0, 0), r2=0.01, verts=8)
        tuft = lib.ball("tuft", 0.035, (0, 0.7, h - 0.36), lib.mat("tuft", (0.15, 0.12, 0.1), 0.95, grain=0.4, grain_size=0.01), self.tail, scale=(0.8, 0.8, 1.6), sub=1)
        lib.lumpy(tuft, 0.01, 0.02)

    def rest(self):
        super().rest()
        self.trunk_curl(3, 2)
        for side, e in self.ears:
            e.rotation_euler = (0, 0, 0)

    def trunk_curl(self, base, per, swing=0.0):
        """Each piece of the trunk bent `base` + `per` per piece toward the chest (degrees), swung sideways."""
        for k, seg in enumerate(self.trunk):
            seg.rotation_euler = (R(base + per * k), 0, R(swing * (0.3 + k * 0.12)))

    def flap(self, a):
        for side, e in self.ears:
            e.rotation_euler = (0, 0, R(side * a))

    def pose(self, anim, t):
        self.rest()
        s, c = math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)
        if anim == "idle":
            # Standing: the ears fanning, the trunk swaying and curling up a little, the tail flicking.
            self.flap(18 * max(0.0, s) ** 1.5)
            self.trunk_curl(2 + 3 * max(0.0, c), 1.5 + 3 * max(0.0, c), 14 * s)
            self.neck.rotation_euler = (R(2 * s), 0, R(3 * s))
            self.tail.rotation_euler = (0, R(20 * math.sin(4 * math.pi * t)), 0)
        elif anim == "walk":
            # A slow walk, the legs in diagonal pairs, the body rolling and the head nodding with the steps.
            self.body.location = (0, 0, self.HIGH + 0.012 * abs(c))
            self.body.rotation_euler = (0, R(2.5 * s), 0)
            for k, phase in (("FL", 0), ("BR", 0.2), ("FR", math.pi), ("BL", math.pi + 0.2)):
                a = math.sin(2 * math.pi * t + phase)
                self.legs[k].rotation_euler = (R(-self.GAIT * a), 0, 0)
                self.knees[k].rotation_euler = (R((22 if k[0] == "F" else -14) * max(0.0, -a)), 0, 0)
            self.neck.rotation_euler = (R(3 * c), 0, 0)
            self.trunk_curl(3, 2, 18 * s)
            self.flap(8 + 6 * c)
            self.tail.rotation_euler = (0, R(12 * s), 0)
        elif anim == "attack":
            self.strike(t)
        elif anim == "dead":
            super().pose("dead", t)
            self.body.location = (0, 0, self.WIDE * 0.95)
            self.trunk_curl(10, 4)

    def strike(self, t):
        # Up on the hind legs a little, trunk raised and ears out, then down with the tusks.
        k = math.sin(math.pi * min(1.0, t / 0.6)) if t < 0.6 else 0.0
        hit = math.sin(math.pi * (t - 0.55) / 0.45) if t > 0.55 else 0.0
        self.body.rotation_euler = (R(-14 * k + 6 * hit), 0, 0)
        self.body.location = (0, 0.04 * k, self.HIGH + 0.06 * k)
        self.neck.rotation_euler = (R(-18 * k + 16 * hit), 0, 0)
        self.trunk_curl(-20 * k + 6 * hit, -6 * k + 2, 0)
        self.flap(30 * k)
        for name in ("FL", "FR"):
            self.legs[name].rotation_euler = (R(-28 * k), 0, 0)
            self.knees[name].rotation_euler = (R(30 * k), 0, 0)


class Lion(Quadruped):
    BODY = (0.11, 1.9, 0.85)
    HIGH = 0.27
    LEG = (0.03, 0.12, 0.11)
    SPREAD = (0.055, 0.14)
    GAIT = 32

    def __init__(self):
        super().__init__(lib.mat("lioncoat", (0.80, 0.62, 0.34), 0.75))

    def head(self):
        n, c = self.neck, self.coat
        y, z = -0.2, self.HIGH + 0.05
        mane = lib.ball("mane", 0.1, (0, y + 0.02, z + 0.02), lib.mat("mane", (0.48, 0.30, 0.14), 0.95, grain=0.4, grain_size=0.01), n, scale=(1.1, 0.9, 1.1), sub=3)
        lib.lumpy(mane, 0.025, 0.03)
        lib.ball("head", 0.065, (0, y - 0.05, z + 0.02), c, n, scale=(0.9, 1.1, 0.9), sub=3)
        lib.ball("muzzle", 0.035, (0, y - 0.11, z - 0.005), lib.mat("muzzle", (0.88, 0.76, 0.56), 0.8), n)
        lib.cyl("tail", 0.01, 0.2, (0, 0.27, self.HIGH), c, self.tail, rot=(R(-50), 0, 0))
        lib.ball("tuft", 0.02, (0, 0.34, self.HIGH - 0.07), lib.mat("mane", (0.48, 0.30, 0.14), 0.95), self.tail)


class Alligator(Quadruped):
    BODY = (0.09, 3.0, 0.5)
    HIGH = 0.07
    LEG = (0.025, 0.04, 0.04)
    SPREAD = (0.1, 0.13)
    GAIT = 35

    def __init__(self):
        super().__init__(lib.mat("scales", (0.30, 0.36, 0.20), 0.6, grain=0.45, grain_size=0.01))

    def head(self):
        n, c = self.neck, self.coat
        y, z = -0.27, self.HIGH + 0.0
        self.jaw = lib.empty("jaw", (0, y, z), n)
        lib.ball("snout", 0.05, (0, y - 0.07, z + 0.015), c, n, scale=(0.9, 2.2, 0.5), sub=2)
        lib.ball("lowerjaw", 0.045, (0, y - 0.07, z - 0.012), lib.mat("jawpale", (0.62, 0.60, 0.42), 0.6), self.jaw, scale=(0.85, 2.1, 0.35), sub=2)
        for x in (0.03, -0.03):
            lib.ball(f"eye{x}", 0.014, (x, y + 0.02, z + 0.04), lib.mat("eye", (0.8, 0.7, 0.1), 0.3, grain=0), n)
        # A long tail, tapering, in two pieces so it can sway.
        lib.cyl("tail1", 0.07, 0.25, (0, 0.38, self.HIGH), c, self.tail, rot=(R(90), 0, 0), r2=0.04)
        lib.cyl("tail2", 0.04, 0.22, (0, 0.6, self.HIGH - 0.01), c, self.tail, rot=(R(90), 0, 0), r2=0.01)

    def rest(self):
        super().rest()
        self.jaw.rotation_euler = (0, 0, 0)

    def pose(self, anim, t):
        super().pose(anim, t)
        if anim == "walk":
            # Low and sideways: the body and the tail sway.
            s = math.sin(2 * math.pi * t)
            self.body.rotation_euler = (0, 0, R(6 * s))
            self.tail.rotation_euler = (0, 0, R(-18 * s))
        if anim == "dead":
            self.body.location = (0, 0, self.HIGH)
            self.body.rotation_euler = (0, R(180), 0)

    def strike(self, t):
        k = math.sin(math.pi * t)
        self.jaw.rotation_euler = (R(35 * k), 0, 0)
        self.neck.rotation_euler = (R(-15 * k), 0, 0)
        self.body.location = (0, -0.06 * k, self.HIGH)
