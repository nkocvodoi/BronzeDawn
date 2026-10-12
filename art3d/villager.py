# A villager: a figure of simple shapes on a skeleton of empties, posed frame by frame in Python.
# Facing Blender -Y; the figure's right hand is on -X. About 0.9 tiles tall, as the old games drew people.

import math

import lib

R = math.radians

SKIN = (0.78, 0.52, 0.36)
HAIR = (0.18, 0.11, 0.06)
CLOTH = (0.80, 0.70, 0.50)     # undyed linen, for the parts that are not the player's colour
BELT = (0.30, 0.18, 0.08)
WOOD = (0.45, 0.28, 0.12)
IRON = (0.55, 0.55, 0.58)


class Rig:
    def __init__(self, tool="none"):
        skin, hair = lib.mat("skin", SKIN, 0.6), lib.mat("hair", HAIR, 0.9)
        cloth, belt = lib.mat("cloth", CLOTH, 0.9), lib.mat("belt", BELT, 0.8)
        team = lib.team_mat()
        self.root = lib.empty("root")
        self.hips = lib.empty("hips", (0, 0, 0.42), self.root)
        self.torso = lib.empty("torso", (0, 0, 0.42), self.hips)
        # The tunic, in the player's colour, with a belt; a linen skirt below it.
        lib.cyl("tunic", 0.098, 0.26, (0, 0, 0.56), team, self.torso, r2=0.084, verts=20)
        lib.cyl("skirt", 0.118, 0.14, (0, 0, 0.40), cloth, self.torso, r2=0.098, verts=20)
        lib.cyl("belt", 0.104, 0.03, (0, 0, 0.47), belt, self.torso, verts=20)
        lib.ball("shoulders", 0.1, (0, 0, 0.665), team, self.torso, scale=(1.1, 0.75, 0.45))
        self.neck = lib.empty("neck", (0, 0, 0.70), self.torso)
        lib.cyl("neckc", 0.03, 0.05, (0, 0, 0.705), skin, self.neck)
        lib.ball("head", 0.075, (0, 0, 0.775), skin, self.neck, scale=(0.95, 1.0, 1.08))
        lib.ball("hair", 0.079, (0, 0.012, 0.80), hair, self.neck, scale=(1.0, 1.0, 0.9))
        lib.ball("nose", 0.016, (0, -0.072, 0.77), skin, self.neck)
        self.arms, self.elbows, self.legs, self.knees = {}, {}, {}, {}
        for side, x in (("L", 0.112), ("R", -0.112)):
            a = lib.empty(f"shoulder{side}", (x, 0, 0.655), self.torso)
            lib.cyl(f"upper{side}", 0.034, 0.15, (x, 0, 0.58), team, a, r2=0.028)
            e = lib.empty(f"elbow{side}", (x, 0, 0.505), a)
            lib.cyl(f"fore{side}", 0.027, 0.14, (x, 0, 0.44), skin, e, r2=0.022)
            hand = lib.empty(f"hand{side}", (x, 0, 0.36), e)
            lib.ball(f"fist{side}", 0.03, (x, 0, 0.36), skin, hand)
            self.arms[side], self.elbows[side] = a, e
            setattr(self, f"hand{side}", hand)
            lx = x * 0.45
            h = lib.empty(f"hip{side}", (lx, 0, 0.42), self.hips)
            lib.cyl(f"thigh{side}", 0.045, 0.21, (lx, 0, 0.32), skin, h, r2=0.036)
            k = lib.empty(f"knee{side}", (lx, 0, 0.215), h)
            lib.cyl(f"shin{side}", 0.034, 0.19, (lx, 0, 0.12), skin, k, r2=0.026)
            lib.box(f"foot{side}", (0.055, 0.1, 0.035), (lx, -0.02, 0.018), belt, k, bevel=0.01)
            self.legs[side], self.knees[side] = h, k
        self.tool = tool
        if tool == "axe":
            # Held in the right fist, the handle forward and down along the swing.
            g = lib.empty("grip", (-0.112, 0, 0.36), self.handR)
            lib.cyl("haft", 0.014, 0.36, (-0.112, -0.13, 0.36), lib.mat("wood", WOOD, 0.7), g, rot=(R(90), 0, 0))
            lib.box("blade", (0.02, 0.06, 0.09), (-0.112, -0.29, 0.40), lib.mat("iron", IRON, 0.35, 0.8), g, bevel=0.008)
            g.rotation_euler = (R(-25), 0, 0)
            self.grip = g

    def face(self, angle):
        self.root.rotation_euler = (0, 0, angle)

    def rest(self):
        self.hips.location = (0, 0, 0.42)
        self.hips.rotation_euler = (0, 0, 0)
        self.torso.rotation_euler = (0, 0, 0)
        self.neck.rotation_euler = (0, 0, 0)
        for side in "LR":
            self.arms[side].rotation_euler = (0, R(-6) if side == "L" else R(6), 0)
            self.elbows[side].rotation_euler = (R(-12), 0, 0)
            self.legs[side].rotation_euler = (0, 0, 0)
            self.knees[side].rotation_euler = (0, 0, 0)

    def pose(self, anim, t):
        """`t` from 0 to 1 through the animation's loop."""
        self.rest()
        s, c = math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)
        if anim == "idle":
            self.torso.rotation_euler = (R(1.2 * s), 0, 0)
            self.neck.rotation_euler = (R(-1.5 * s), 0, R(4 * math.sin(math.pi * t)))
            for side, k in (("L", 1), ("R", -1)):
                self.arms[side].rotation_euler = (R(3 * s * k), R(-6 * k), 0)
        elif anim == "walk":
            self.hips.location = (0, 0, 0.42 + 0.012 * abs(c))
            self.torso.rotation_euler = (R(4), 0, R(5 * s))
            for side, k in (("L", 1), ("R", -1)):
                swing = 28 * s * k
                self.legs[side].rotation_euler = (R(-swing), 0, 0)
                # The knee bends as the leg comes forward behind the body.
                back = math.sin(2 * math.pi * t + (0 if k > 0 else math.pi) - math.pi / 2)
                self.knees[side].rotation_euler = (R(8 + 32 * max(0.0, back)), 0, 0)
                if not (self.tool == "axe" and side == "R"):
                    self.arms[side].rotation_euler = (R(24 * s * k), R(-6 * k), 0)
                    self.elbows[side].rotation_euler = (R(-14 - 10 * max(0.0, -s * k)), 0, 0)
            if self.tool == "axe":
                self.arms["R"].rotation_euler = (R(-12 - 6 * s), R(6), 0)
                self.elbows["R"].rotation_euler = (R(-50), 0, 0)
        elif anim == "chop":
            # Up over the shoulder, then down hard in front, then back to the start.
            if t < 0.55:
                k = t / 0.55
                a = -40 - 130 * (0.5 - 0.5 * math.cos(math.pi * k))
                lean = -6 * k
            elif t < 0.72:
                k = (t - 0.55) / 0.17
                a = -170 + 125 * k * k
                lean = -6 + 20 * k
            else:
                k = (t - 0.72) / 0.28
                a = -45 + 5 * k
                lean = 14 - 14 * k
            self.torso.rotation_euler = (R(lean), 0, R(-8))
            for side, y in (("L", -18), ("R", 18)):
                self.arms[side].rotation_euler = (R(a), R(y), 0)
                self.elbows[side].rotation_euler = (R(-18), 0, 0)
            for side, k2 in (("L", 1), ("R", -1)):
                self.legs[side].rotation_euler = (R(-12 * k2), 0, 0)
                self.knees[side].rotation_euler = (R(10), 0, 0)
