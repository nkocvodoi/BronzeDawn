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
