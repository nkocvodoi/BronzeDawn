# A villager: a figure of simple shapes on a skeleton of empties, posed frame by frame in Python.
# Facing Blender -Y; the figure's right hand is on -X. About 0.9 tiles tall, as the old games drew people.

import math

import mathutils

import lib

R = math.radians

SKIN = (0.78, 0.52, 0.36)
HAIR = (0.18, 0.11, 0.06)
CLOTH = (0.80, 0.70, 0.50)     # undyed linen, for the parts that are not the player's colour
BELT = (0.30, 0.18, 0.08)
WOOD = (0.45, 0.28, 0.12)
IRON = (0.55, 0.55, 0.58)
ROD = 0.95                     # a fishing rod's length
CARRIES = ("basket", "butcher", "rod")  # the tools that go with a basket on the left arm


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
        wood, iron = lib.mat("wood", WOOD, 0.7), lib.mat("iron", IRON, 0.35, 0.8)
        hx, hz = -0.112, 0.36  # the right fist
        if tool == "hoe":
            g = lib.empty("grip", (hx, 0, hz), self.handR)
            lib.cyl("haft", 0.013, 0.34, (hx, -0.12, hz), wood, g, rot=(R(90), 0, 0))
            lib.box("hoeblade", (0.07, 0.015, 0.06), (hx, -0.28, hz - 0.03), iron, g, bevel=0.005)
            g.rotation_euler = (R(80), 0, 0)
            self.grip = g
        if tool == "spear":
            g = lib.empty("grip", (hx, 0, hz), self.handR)
            lib.cyl("shaft", 0.011, 0.62, (hx, -0.12, hz), wood, g, rot=(R(90), 0, 0))
            lib.cyl("point", 0.02, 0.07, (hx, -0.46, hz), lib.mat("flint", (0.35, 0.33, 0.36), 0.4), g, rot=(R(90), 0, 0), r2=0.002, verts=4)
            g.rotation_euler = (R(-80), 0, 0)
            self.grip = g
        if tool == "rod":
            # A long cane rod in the right fist, the line from its tip to a float on the water in front.
            g = lib.empty("grip", (hx, 0, hz), self.handR)
            cane = lib.mat("cane", (0.74, 0.62, 0.36), 0.7, grain=0.3, grain_size=0.01)
            lib.cyl("rod", 0.014, ROD, (hx, -ROD / 2 + 0.08, hz), cane, g, rot=(R(90), 0, 0), r2=0.005, verts=8)
            lib.cyl("rodgrip", 0.018, 0.1, (hx, 0.0, hz), lib.mat("cord", (0.40, 0.26, 0.12), 0.9), g, rot=(R(90), 0, 0), verts=8)
            self.tip = lib.empty("tip", (hx, -ROD + 0.08, hz), g)
            g.rotation_euler = (R(-25), 0, 0)
            self.grip = g
            self.float = lib.empty("float", (hx, -0.95, 0.01), self.root)
            lib.ball("floatred", 0.022, (hx, -0.95, 0.03), lib.mat("floatred", (0.85, 0.16, 0.10), 0.5, grain=0), self.float, scale=(1, 1, 1.3), sub=1)
            lib.ball("floatwhite", 0.018, (hx, -0.95, 0.06), lib.mat("floatwhite", (0.92, 0.90, 0.84), 0.5, grain=0), self.float, sub=1)
            # The line: a thin thread stretched from the tip to the float at each pose (`string_line`).
            self.line = lib.cyl("line", 0.005, 1.0, (0, 0, 0), lib.mat("line", (0.88, 0.86, 0.78), 0.6, grain=0), verts=4, smooth_it=False)
            # On the bank beside the angler: a creel with the catch in it.
            gb = lib.empty("creel", (0.22, -0.12, 0), self.root)
            wicker = lib.mat("wicker", (0.78, 0.60, 0.32), 0.9, grain=0.45, grain_size=0.006)
            lib.cyl("gcreel", 0.08, 0.11, (0.22, -0.12, 0.055), wicker, gb, r2=0.1, verts=16)
            lib.cyl("gcrim", 0.105, 0.018, (0.22, -0.12, 0.11), lib.mat("wickerd", (0.55, 0.38, 0.18), 0.9), gb, verts=16)
            self.fish_in(gb, (0.22, -0.12, 0.12), "g")
            self.ground_basket = gb
        if tool in ("axe", "pick", "hammer"):
            # Held in the right fist, the handle running forward from it.
            g = lib.empty("grip", (hx, 0, hz), self.handR)
            length = 0.24 if tool == "hammer" else 0.36
            lib.cyl("haft", 0.014, length, (hx, -length / 2 + 0.05, hz), wood, g, rot=(R(90), 0, 0))
            end = -length + 0.07
            if tool == "axe":
                lib.box("blade", (0.02, 0.06, 0.09), (hx, end, hz + 0.04), iron, g, bevel=0.008)
            elif tool == "pick":
                lib.cyl("pickhead", 0.016, 0.26, (hx, end, hz), iron, g, r2=0.004, verts=8)
                lib.cyl("pickhead2", 0.016, 0.12, (hx, end, hz - 0.06), iron, g, rot=(R(180), 0, 0), r2=0.004, verts=8)
            else:
                lib.box("hammerhead", (0.05, 0.05, 0.09), (hx, end, hz), lib.mat("stonehead", (0.5, 0.48, 0.44), 0.8), g, bevel=0.01)
            g.rotation_euler = (R(-25), 0, 0)
            self.grip = g
        if tool == "butcher":
            # A flint knife in the right fist.
            g = lib.empty("grip", (hx, 0, hz), self.handR)
            lib.cyl("knifehaft", 0.012, 0.06, (hx, -0.03, hz), wood, g, rot=(R(90), 0, 0))
            lib.cyl("knife", 0.016, 0.09, (hx, -0.1, hz), lib.mat("flint", (0.35, 0.33, 0.36), 0.4), g, rot=(R(90), 0, 0), r2=0.002, verts=4)
            g.rotation_euler = (R(60), 0, 0)
            self.grip = g
            # On the ground beside the work: a basket with meat in it.
            gb = lib.empty("groundbasket", (0.2, -0.16, 0), self.root)
            wicker = lib.mat("wicker", (0.78, 0.60, 0.32), 0.9, grain=0.45, grain_size=0.006)
            lib.cyl("gbasket", 0.085, 0.1, (0.2, -0.16, 0.05), wicker, gb, r2=0.105, verts=16)
            lib.cyl("grim", 0.11, 0.018, (0.2, -0.16, 0.1), lib.mat("wickerd", (0.55, 0.38, 0.18), 0.9), gb, verts=16)
            meat = lib.mat("meat", (0.72, 0.22, 0.20), 0.5, grain=0.3, grain_size=0.01)
            for i, (bx, by) in enumerate(((0, 0), (0.035, 0.02), (-0.03, 0.02), (0.01, -0.035))):
                lib.ball(f"gmeat{i}", 0.032, (0.2 + bx, -0.16 + by, 0.11), meat, gb, scale=(1.3, 1, 0.7), sub=1)
            self.ground_basket = gb
        if tool in CARRIES:
            # A wicker basket on the left arm: of berries, of meat, or of fish.
            g = lib.empty("basketgrip", (0.112, 0, hz), self.handL)
            self.basket = g
            wicker = lib.mat("wicker", (0.78, 0.60, 0.32), 0.9, grain=0.45, grain_size=0.006)
            lib.cyl("basket", 0.085, 0.10, (0.13, -0.05, hz - 0.03), wicker, g, r2=0.105, verts=16)
            lib.cyl("rim", 0.11, 0.018, (0.13, -0.05, hz + 0.02), lib.mat("wickerd", (0.55, 0.38, 0.18), 0.9), g, verts=16)
            if tool == "rod":
                self.fish_in(g, (0.13, -0.05, hz + 0.03), "c")
                return
            berry =lib.mat("berry", (0.85, 0.10, 0.12), 0.35, grain=0) if tool == "basket" else lib.mat("meat", (0.72, 0.22, 0.20), 0.5, grain=0.3, grain_size=0.01)
            for i, (bx, by, bz) in enumerate(((0, 0, 0.05), (0.04, 0.02, 0.035), (-0.04, 0.015, 0.035), (0.015, -0.045, 0.035),
                                              (-0.03, -0.035, 0.03), (0.02, 0.045, 0.03), (-0.01, 0.0, 0.075))):
                lib.ball(f"berry{i}", 0.03, (0.13 + bx, -0.05 + by, hz + bz), berry, g, sub=1)

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
        if self.tool in CARRIES:
            self.carry_basket()
        if self.tool in ("butcher", "rod"):
            self.show(self.basket, True)
            self.show(self.ground_basket, False)
        if self.tool == "rod":
            # Not fishing: the rod upright at the side, no line out.
            self.grip.rotation_euler = (R(-68), 0, 0)
            self.show(self.float, False)
            self.line.hide_render = True

    @staticmethod
    def fish_in(parent, at, tag):
        """Three fish in a basket, heads and tails over the rim."""
        scale = lib.mat("fishscale", (0.70, 0.74, 0.76), 0.35, 0.4, grain=0.2, grain_size=0.01)
        x, y, z = at
        for i, (dx, dy, tilt) in enumerate(((0.0, 0.0, 30), (0.03, 0.025, -40), (-0.03, 0.02, 70))):
            f = lib.ball(f"{tag}fish{i}", 0.026, (x + dx, y + dy, z), scale, parent, scale=(2.2, 0.8, 0.9), sub=1)
            f.rotation_euler = (R(28), 0, R(tilt))
            lib.cyl(f"{tag}tail{i}", 0.022, 0.03, (x + dx + 0.055 * math.cos(R(tilt)), y + dy + 0.055 * math.sin(R(tilt)), z + 0.03),
                    scale, parent, rot=(0, R(90), R(tilt)), r2=0.002, verts=4)

    def string_line(self):
        """Stretches the line from the rod's tip to the float, as they stand in this pose."""
        import bpy
        bpy.context.view_layer.update()
        a = self.tip.matrix_world.translation
        b = self.float.matrix_world.translation + mathutils.Vector((0, 0, 0.05))
        d = b - a
        self.line.location = (a + b) / 2
        self.line.rotation_mode = "QUATERNION"
        self.line.rotation_quaternion = d.to_track_quat("Z", "Y")
        self.line.scale = (1, 1, d.length)
        self.line.hide_render = False

    @staticmethod
    def show(root, on):
        for o in [root, *root.children_recursive]:
            o.hide_render = not on

    def carry_basket(self, sway=0.0):
        # The forearm up and across the body, the basket at the hip, kept upright whatever the arm does.
        arm, elbow = -18 + sway, -75
        self.arms["L"].rotation_euler = (R(arm), 0, R(-10))
        self.elbows["L"].rotation_euler = (R(elbow), 0, 0)
        self.basket.rotation_euler = (R(-arm - elbow), 0, R(10))

    def stance(self, bend=10, spread=12):
        for side, k in (("L", 1), ("R", -1)):
            self.legs[side].rotation_euler = (R(-spread * k - bend * 0.5), 0, 0)
            self.knees[side].rotation_euler = (R(bend), 0, 0)

    def pose(self, anim, t):
        """`t` from 0 to 1 through the animation's loop."""
        self.rest()
        s, c = math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)
        ease = lambda k: 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, k)))  # noqa: E731
        if anim == "idle":
            self.torso.rotation_euler = (R(1.2 * s), 0, 0)
            self.neck.rotation_euler = (R(-1.5 * s), 0, R(4 * math.sin(math.pi * t)))
            for side, k in (("L", 1), ("R", -1)):
                if side == "L" and self.tool in CARRIES:
                    self.carry_basket(2 * s)
                else:
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
                held = (side == "R" and self.tool in ("axe", "pick", "hoe", "spear", "rod")) or (side == "L" and self.tool in CARRIES)
                if not held:
                    self.arms[side].rotation_euler = (R(24 * s * k), R(-6 * k), 0)
                    self.elbows[side].rotation_euler = (R(-14 - 10 * max(0.0, -s * k)), 0, 0)
            if self.tool == "spear":
                # Carried upright at the side.
                self.arms["R"].rotation_euler = (R(-10 - 4 * s), R(8), 0)
                self.elbows["R"].rotation_euler = (R(-70), 0, 0)
                self.grip.rotation_euler = (R(-10), 0, 0)
            if self.tool == "hoe":
                self.arms["R"].rotation_euler = (R(-20 - 4 * s), R(6), 0)
                self.elbows["R"].rotation_euler = (R(-40), 0, 0)
            if self.tool == "rod":
                # Over the right shoulder, the tip up and behind.
                self.arms["R"].rotation_euler = (R(-22 - 4 * s), R(8), 0)
                self.elbows["R"].rotation_euler = (R(-58), 0, 0)
                self.grip.rotation_euler = (R(-52), 0, 0)
            if self.tool in ("axe", "pick"):
                # Carried over the shoulder.
                self.arms["R"].rotation_euler = (R(-12 - 6 * s), R(6), 0)
                self.elbows["R"].rotation_euler = (R(-50), 0, 0)
            if self.tool in CARRIES:
                self.carry_basket(4 * s)
        elif anim == "chop":
            # A woodcutter's swing: the body turns away to the right with the axe drawn back at the
            # shoulder, then whips round so the blade bites the trunk in front at hip height.
            if t < 0.45:
                k = ease(t / 0.45)
                turn, arm, lean = -55 * k, -62 - 18 * k, -3 * k
            elif t < 0.62:
                k = ((t - 0.45) / 0.17) ** 2
                turn, arm, lean = -55 + 85 * k, -80 + 22 * k, -3 + 9 * k
            else:
                k = ease((t - 0.62) / 0.38)
                turn, arm, lean = 30 - 30 * k, -58 - 4 * k, 6 - 6 * k
            self.torso.rotation_euler = (R(lean), 0, R(turn))
            self.neck.rotation_euler = (0, 0, R(-turn * 0.5))  # the eyes stay on the tree
            # Both hands on the haft, together in front of the body.
            self.arms["R"].rotation_euler = (R(arm), 0, R(18))
            self.arms["L"].rotation_euler = (R(arm + 6), 0, R(-34))
            self.elbows["R"].rotation_euler = (R(-20), 0, 0)
            self.elbows["L"].rotation_euler = (R(-28), 0, 0)
            # The haft level, reaching forward from the fists toward the trunk.
            self.grip.rotation_euler = (R(-arm + 20 + 4), 0, R(-30))
            self.stance(12, 14)
        elif anim == "mine":
            # Up over the head, then down hard on the rock in front, then back to the start.
            if t < 0.55:
                k = t / 0.55
                a = -40 - 130 * ease(k)
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
            # The pick swings with the arms: back over the head when raised, forward and down at the strike.
            self.grip.rotation_euler = (R(80), 0, 0)
            self.stance(10, 12)
        elif anim == "hammer":
            # Bent over the work: the hammer comes up slowly and down fast, the left hand holding the
            # piece steady.
            if t < 0.6:
                a = -40 - 85 * ease(t / 0.6)
            elif t < 0.75:
                a = -125 + 95 * ((t - 0.6) / 0.15) ** 2
            else:
                a = -30 - 10 * ease((t - 0.75) / 0.25)
            self.torso.rotation_euler = (R(24), 0, R(6))
            self.neck.rotation_euler = (R(10), 0, 0)
            self.arms["R"].rotation_euler = (R(a), 0, R(8))
            self.elbows["R"].rotation_euler = (R(-35), 0, 0)
            self.arms["L"].rotation_euler = (R(-55), 0, R(-18))
            self.elbows["L"].rotation_euler = (R(-20), 0, 0)
            self.grip.rotation_euler = (R(85), 0, 0)
            self.stance(28, 10)
        elif anim == "forage":
            # Reaching into the bush with the right hand, picking, and dropping it into the basket.
            self.torso.rotation_euler = (R(20), 0, R(10))
            self.neck.rotation_euler = (R(8), 0, 0)
            self.carry_basket()
            if t < 0.3:
                k = ease(t / 0.3)
                arm, out, elbow = -30 - 68 * k, -10 + 45 * k, -40 + 32 * k
            elif t < 0.6:
                k = (t - 0.3) / 0.3
                arm, out, elbow = -98 + 8 * math.sin(4 * math.pi * k), 35, -8 - 22 * abs(math.sin(4 * math.pi * k))
            elif t < 0.85:
                k = ease((t - 0.6) / 0.25)
                arm, out, elbow = -98 + 63 * k, 35 - 60 * k, -8 - 52 * k
            else:
                k = ease((t - 0.85) / 0.15)
                arm, out, elbow = -35 + 5 * k, -25 + 15 * k, -60 + 20 * k
            self.arms["R"].rotation_euler = (R(arm), 0, R(out))
            self.elbows["R"].rotation_euler = (R(elbow), 0, 0)
            self.stance(14, 6)
        elif anim == "butcher":
            # Down on the haunches by the carcass, the basket set on the ground: cutting with the knife in
            # short strokes, then reaching over to drop the meat in the basket.
            self.show(self.basket, False)
            self.show(self.ground_basket, True)
            self.hips.location = (0, 0, 0.27)
            self.torso.rotation_euler = (R(38), 0, R(-6))
            self.neck.rotation_euler = (R(12), 0, 0)
            for side, k in (("L", 1), ("R", -1)):
                self.legs[side].rotation_euler = (R(-82), R(10 * k), 0)
                self.knees[side].rotation_euler = (R(118), 0, 0)
            # The left hand holds the carcass steady.
            self.arms["L"].rotation_euler = (R(-48), 0, R(-12))
            self.elbows["L"].rotation_euler = (R(-12), 0, 0)
            if t < 0.6:
                k = t / 0.6
                arm, across, elbow = -42 + 10 * math.sin(6 * math.pi * k), 4, -18 - 10 * math.sin(6 * math.pi * k)
            elif t < 0.8:
                k = ease((t - 0.6) / 0.2)
                arm, across, elbow = -42 + 12 * k, 4 + 44 * k, -18 - 10 * k
            else:
                k = ease((t - 0.8) / 0.2)
                arm, across, elbow = -30 - 12 * k, 48 - 44 * k, -28 + 10 * k
            self.arms["R"].rotation_euler = (R(arm), 0, R(-across))
            self.elbows["R"].rotation_euler = (R(elbow), 0, 0)
        elif anim == "hoe":
            # Short strokes into the soil: up to the chest, down to the feet.
            if t < 0.5:
                a = -35 - 70 * ease(t / 0.5)
            elif t < 0.7:
                a = -105 + 75 * ((t - 0.5) / 0.2) ** 2
            else:
                a = -30 - 5 * ease((t - 0.7) / 0.3)
            self.torso.rotation_euler = (R(18), 0, R(-6))
            for side, y in (("L", -16), ("R", 16)):
                self.arms[side].rotation_euler = (R(a), R(y), 0)
                self.elbows[side].rotation_euler = (R(-22), 0, 0)
            self.stance(16, 12)
        elif anim == "throw":
            # A hunter's throw: the spear drawn back over the shoulder, the body turning, then let fly.
            if t < 0.5:
                k = ease(t / 0.5)
                arm, turn, lean = -60 - 100 * k, -25 * k, -6 * k
            elif t < 0.65:
                k = ((t - 0.5) / 0.15) ** 2
                arm, turn, lean = -160 + 110 * k, -25 + 45 * k, -6 + 16 * k
            else:
                k = ease((t - 0.65) / 0.35)
                arm, turn, lean = -50 - 10 * k, 20 - 20 * k, 10 - 10 * k
            self.torso.rotation_euler = (R(lean), 0, R(turn))
            self.arms["R"].rotation_euler = (R(arm), 0, R(10))
            self.elbows["R"].rotation_euler = (R(-25), 0, 0)
            self.arms["L"].rotation_euler = (R(-70), 0, R(-10))
            self.grip.rotation_euler = (R(-arm + 25 - 5), 0, 0)  # the spear level, pointing at the quarry
            self.stance(10, 18)
        elif anim == "angle":
            # Angling from the bank, the creel set down beside: the rod held out over the water while the
            # float bobs, then a bite pulls it under and the rod is struck up, and lowered again.
            self.show(self.basket, False)
            self.show(self.ground_basket, True)
            self.show(self.float, True)
            bob, pull = 0.006 * math.sin(6 * math.pi * t), 0.0
            if t < 0.55:
                lift, lean = 2 * math.sin(2 * math.pi * t / 0.55), 0
            elif t < 0.65:
                k = (t - 0.55) / 0.1
                lift, lean, bob = -6 * k, 3 * k, -0.03 * k
            elif t < 0.75:
                k = ((t - 0.65) / 0.1) ** 0.6
                lift, lean, bob, pull = -6 + 34 * k, 3 - 10 * k, -0.03 + 0.05 * k, 0.12 * k
            else:
                k = ease((t - 0.75) / 0.25)
                lift, lean, bob, pull = 28 - 28 * k, -7 + 7 * k, 0.02 - 0.02 * k, 0.12 - 0.12 * k
            self.torso.rotation_euler = (R(6 + lean), 0, R(-6))
            self.neck.rotation_euler = (R(8), 0, 0)  # eyes on the float
            arm, elbow = -42 - lift * 0.4, -40
            self.arms["R"].rotation_euler = (R(arm), 0, R(10))
            self.elbows["R"].rotation_euler = (R(elbow), 0, 0)
            self.arms["L"].rotation_euler = (R(arm + 4), 0, R(-30))
            self.elbows["L"].rotation_euler = (R(elbow - 6), 0, 0)
            # The rod 40 degrees up from level, more as it is struck.
            self.grip.rotation_euler = (R(-40 - lift - (arm + elbow)), 0, 0)
            self.float.location = (-0.112, -0.95 + pull, 0.01 + bob)
            self.stance(8, 12)
            self.string_line()
