# Siege engines and ships: wooden machines with a moving part or two, posed frame by frame like the figures.
# Facing Blender -Y.

import math

import lib

R = math.radians
WOOD = (0.48, 0.32, 0.16)
DARKWOOD = (0.32, 0.20, 0.10)
ROPE = (0.70, 0.60, 0.40)
IRON = (0.45, 0.46, 0.50)


class Machine:
    def __init__(self):
        self.root = lib.empty("root")
        self.wood = lib.mat("mwood", WOOD, 0.8, grain=0.4, grain_size=0.02)
        self.dark = lib.mat("mdark", DARKWOOD, 0.8, grain=0.3, grain_size=0.02)
        self.team = lib.team_mat("teamcloth")
        self.wheels = []

    def face(self, angle):
        self.root.rotation_euler = (0, 0, angle)

    def wheel(self, x, y, r=0.12):
        w = lib.cyl(f"wheel{x}{y}", r, 0.035, (x, y, r), self.dark, self.root, rot=(0, R(90), 0), verts=10)
        lib.cyl(f"hub{x}{y}", r * 0.3, 0.05, (x, y, r), lib.mat("miron", IRON, 0.4, 0.7), w, rot=(0, R(90), 0), verts=8)
        self.wheels.append(w)

    def roll(self, t):
        for w in self.wheels:
            w.rotation_euler = (R(-360 * t), R(90), 0)

    def pose(self, anim, t):
        self.roll(t if anim == "walk" else 0)


class Catapult(Machine):
    """A throwing arm on a frame: wound down, then flung up against a crossbar. Bigger for the later ones."""

    def __init__(self, size=1.0, kind="catapult"):
        super().__init__()
        k = size
        for x in (0.16 * k, -0.16 * k):
            lib.box(f"rail{x}", (0.05, 0.62 * k, 0.06), (x, 0, 0.15 * k), self.wood, self.root, bevel=0.01)
            lib.box(f"upright{x}", (0.05, 0.05, 0.35 * k), (x, -0.08 * k, 0.33 * k), self.wood, self.root)
            for y in (0.22 * k, -0.22 * k):
                self.wheel(x * 1.35, y, 0.11 * k)
        lib.box("crossbar", (0.38 * k, 0.05, 0.05), (0, -0.08 * k, 0.5 * k), self.dark, self.root)
        lib.box("axle", (0.34 * k, 0.04, 0.04), (0, 0.12 * k, 0.2 * k), self.dark, self.root)
        self.arm = lib.empty("arm", (0, 0.12 * k, 0.2 * k), self.root)
        lib.box("armbeam", (0.05, 0.05, 0.55 * k), (0, 0.12 * k, 0.2 * k + 0.27 * k), self.wood, self.arm)
        lib.ball("cup", 0.06 * k, (0, 0.12 * k, 0.2 * k + 0.55 * k), self.dark, self.arm, scale=(1, 1, 0.6))
        lib.ball("stone", 0.045 * k, (0, 0.12 * k, 0.2 * k + 0.58 * k), lib.mat("mstone", (0.6, 0.58, 0.54), 0.9), self.arm)
        if kind != "stone_thrower":
            lib.box("counterweight", (0.16 * k, 0.12 * k, 0.12 * k), (0, 0.12 * k, 0.12 * k), lib.mat("mstone", (0.6, 0.58, 0.54), 0.9), self.arm)
        lib.box("banner", (0.02, 0.16, 0.1), (0.2 * k, 0.3 * k, 0.32 * k), self.team, self.root)
        self.arm_rest = 62

    def pose(self, anim, t):
        super().pose(anim, t)
        if anim == "attack":
            # Wound back, then flung forward against the crossbar.
            rest = self.arm_rest
            if t < 0.3:
                a = rest
            elif t < 0.42:
                a = rest - (rest + 10) * (t - 0.3) / 0.12
            else:
                a = -10 + (rest + 10) * (t - 0.42) / 0.58
            self.arm.rotation_euler = (R(a), 0, 0)
        else:
            self.arm.rotation_euler = (R(self.arm_rest), 0, 0)


class Ballista(Machine):
    def __init__(self):
        super().__init__()
        lib.box("bed", (0.28, 0.6, 0.06), (0, 0, 0.2), self.wood, self.root, bevel=0.01)
        for x in (0.14, -0.14):
            for y in (0.2, -0.2):
                self.wheel(x * 1.4, y, 0.1)
        self.head = lib.empty("head", (0, -0.05, 0.32), self.root)
        lib.box("stock", (0.06, 0.6, 0.05), (0, -0.05, 0.32), self.dark, self.head)
        lib.box("bowarms", (0.62, 0.05, 0.05), (0, -0.28, 0.33), self.wood, self.head)
        self.bolt = lib.cyl("bolt", 0.012, 0.42, (0, -0.15, 0.36), lib.mat("miron", IRON, 0.4, 0.7), self.head, rot=(R(90), 0, 0))
        lib.box("shieldboard", (0.4, 0.02, 0.18), (0, -0.33, 0.42), self.team, self.head)

    def pose(self, anim, t):
        super().pose(anim, t)
        k = math.sin(math.pi * min(1.0, t / 0.3)) if anim == "attack" and t < 0.3 else 0
        self.head.location = (0, -0.05 + 0.04 * k, 0.32)
        self.bolt.hide_render = anim == "attack" and 0.15 < t < 0.75


class Helepolis(Machine):
    """A siege tower on wheels, with a bolt thrower's port at the top."""

    def __init__(self):
        super().__init__()
        lib.box("tower", (0.55, 0.55, 1.15), (0, 0.05, 0.68), self.wood, self.root, bevel=0.02)
        for k in range(4):
            lib.box(f"plank{k}", (0.57, 0.57, 0.025), (0, 0.05, 0.25 + k * 0.28), self.dark, self.root)
        lib.box("top", (0.62, 0.62, 0.08), (0, 0.05, 1.28), self.dark, self.root)
        self.port = lib.box("port", (0.18, 0.03, 0.12), (0, -0.23, 1.05), lib.mat("mdoor", (0.08, 0.06, 0.04), 1.0), self.root)
        lib.box("hide", (0.5, 0.02, 0.25), (0, -0.235, 0.62), lib.mat("mhide", (0.62, 0.46, 0.30), 0.9), self.root)
        lib.box("banner", (0.02, 0.2, 0.14), (0.28, 0.05, 1.45), self.team, self.root)
        lib.cyl("bpole", 0.012, 0.35, (0.28, 0.05, 1.42), self.dark, self.root, verts=6)
        for x in (0.24, -0.24):
            for y in (0.25, -0.15):
                self.wheel(x * 1.15, y, 0.11)


class Ship(Machine):
    """A hull with a deck; a mast and a sail in the player's colour; oars, if rowed; a ram, a catapult, a fire
    pot or cargo, by kind."""

    def __init__(self, kind):
        super().__init__()
        big = {"fishing_boat": 0.7, "trade_boat": 0.8, "light_transport": 0.9, "scout_ship": 0.85, "fishing_ship": 0.85,
               "merchant_ship": 1.0, "heavy_transport": 1.1, "war_galley": 1.0, "fire_galley": 1.0, "trireme": 1.15,
               "catapult_trireme": 1.2, "juggernaught": 1.35}[kind]
        k = big
        hull = lib.ball("hull", 0.22 * k, (0, 0, 0.02), self.wood, self.root, scale=(0.75, 2.6, 0.55), sub=3)
        lib.box("deck", (0.28 * k, 1.0 * k, 0.03), (0, 0, 0.1 * k + 0.02), self.dark, self.root)
        lib.ball("prow", 0.05 * k, (0, -0.56 * k, 0.12 * k), self.dark, self.root, scale=(0.8, 1.5, 1.2))
        lib.ball("stern", 0.07 * k, (0, 0.55 * k, 0.15 * k), self.dark, self.root, scale=(0.9, 1.0, 1.4))
        self.oars = []
        rowed = kind in ("war_galley", "trireme", "catapult_trireme", "juggernaught", "fire_galley", "scout_ship")
        if rowed:
            for side in (1, -1):
                for i in range(5 if k < 1.2 else 7):
                    y = -0.32 * k + i * (0.64 * k / (4 if k < 1.2 else 6))
                    o = lib.empty(f"oarlock{side}{i}", (side * 0.17 * k, y, 0.1 * k), self.root)
                    lib.cyl(f"oar{side}{i}", 0.008, 0.35 * k, (side * 0.32 * k, y, 0.03 * k), self.dark, o, rot=(0, R(90 + side * 20), 0), verts=5)
                    self.oars.append((o, side))
        if kind in ("war_galley", "trireme", "catapult_trireme", "juggernaught", "fire_galley"):
            lib.cyl("ram", 0.03 * k, 0.18 * k, (0, -0.66 * k, 0.03), lib.mat("bronzeram", (0.72, 0.52, 0.24), 0.35, 0.8), self.root, rot=(R(90), 0, 0), r2=0.005)
        # Mast and sail.
        mh = 0.75 * k
        lib.cyl("mast", 0.015 * k, mh, (0, -0.05 * k, mh / 2 + 0.1), self.dark, self.root, verts=6)
        lib.box("yard", (0.5 * k, 0.02, 0.02), (0, -0.05 * k, mh + 0.05), self.dark, self.root)
        self.sail = lib.box("sail", (0.46 * k, 0.015, 0.42 * k), (0, -0.04 * k, mh - 0.17 * k), self.team, self.root)
        if kind in ("fishing_boat", "fishing_ship"):
            n = lib.ball("netpile", 0.06 * k, (0.05, 0.25 * k, 0.15 * k), lib.mat("netcord", (0.62, 0.52, 0.34), 0.9), self.root, scale=(1.4, 1, 0.6))
        if kind in ("trade_boat", "merchant_ship", "light_transport", "heavy_transport"):
            for i in range(3):
                lib.box(f"crate{i}", (0.1 * k, 0.1 * k, 0.08 * k), (0.04 * (i - 1), (i - 1) * 0.18 * k + 0.15 * k, 0.17 * k), self.wood, self.root, bevel=0.005)
        if kind == "catapult_trireme" or kind == "juggernaught":
            lib.box("catframe", (0.16 * k, 0.2 * k, 0.12 * k), (0, 0.28 * k, 0.2 * k), self.wood, self.root)
            lib.cyl("catarm", 0.012 * k, 0.3 * k, (0, 0.28 * k, 0.32 * k), self.dark, self.root, rot=(R(-40), 0, 0))
        if kind == "fire_galley":
            lib.ball("firepot", 0.05 * k, (0, -0.45 * k, 0.2 * k), lib.mat("ember", (0.3, 0.1, 0.02), 1.0, emit=(1.0, 0.45, 0.08)), self.root)

    def pose(self, anim, t):
        # Riding the swell; oars sweeping when under way.
        s = math.sin(2 * math.pi * t)
        self.root.location = (0, 0, 0.01 * s)
        for o, side in self.oars:
            sweep = 25 * s if anim == "walk" else 4 * s
            o.rotation_euler = (0, 0, R(side * sweep))
