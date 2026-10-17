# The fantasy races (replica/game/fantasy-races.md): the common figure (villager.Rig) given each people's
# build, colours and parts of their own, and the races' own units. Drawn in the manner of Japanese
# animation rather than European tradition: heads a little larger, hair in big clear shapes.
#
#   Elf          as tall as anyone, slender, women with full figures in bikinis of bear fur, golden hair,
#                long pointed ears
#   Dwarf        short and broad, a braided beard down the chest, a big nose
#   Centaur  centaurs: a man's body where a horse's neck would be, villagers too
#   Beastfolk    villagers with a human face and a cat's ears and tail; soldiers tall, with a wolf's or
#                a bear's head
#
# The elves wear bear fur, as the owner asked: a top and a short bottom, a loincloth and headband in their
# player's colour. Grown women, nothing more shown than a swimsuit would.

import math

import bpy
import mathutils

import animals
import lib
import soldiers
import villager

R = math.radians


class Look:
    def __init__(self, name, skin, hair, cloth, height=1.0, girth=1.0, head=1.0, parts=()):
        self.name, self.skin, self.hair, self.cloth = name, skin, hair, cloth
        self.height, self.girth, self.head, self.parts = height, girth, head, parts


ELF = Look("elf", skin=(0.98, 0.86, 0.76), hair=(1.0, 0.84, 0.36), cloth=(0.40, 0.58, 0.30),
           girth=0.92, head=1.14, parts=("elf_ears", "long_hair", "fur_bikini"))
DWARF = Look("dwarf", skin=(0.88, 0.62, 0.48), hair=(0.66, 0.28, 0.10), cloth=(0.44, 0.42, 0.40),
             height=0.8, girth=1.32, head=1.12, parts=("beard", "big_nose"))
CENTAUR_LOOK = Look("centaur", skin=(0.86, 0.62, 0.44), hair=(0.26, 0.16, 0.10), cloth=(0.94, 0.90, 0.78),
                   head=1.1, parts=("tail_of_hair",))
CATFOLK = Look("beastfolk", skin=(0.96, 0.78, 0.64), hair=(0.96, 0.58, 0.22), cloth=(0.72, 0.52, 0.30),
               height=1.1, head=1.12, parts=("cat_ears", "cat_tail"))
WOLF = Look("wolfkin", skin=(0.58, 0.58, 0.62), hair=(0.34, 0.34, 0.38), cloth=(0.45, 0.30, 0.16),
            height=1.25, girth=1.08, parts=("wolf_head", "wolf_tail"))
BEAR = Look("bearkin", skin=(0.44, 0.28, 0.16), hair=(0.30, 0.19, 0.10), cloth=(0.45, 0.30, 0.16),
            height=1.45, girth=1.5, head=1.05, parts=("bear_head",))

# The villager of each race, for the game's "<civ>/villager" sheets.
VILLAGERS = {"elf": ELF, "dwarf": DWARF, "centaur": CENTAUR_LOOK, "beastfolk": CATFOLK}


# ---- the parts only some peoples have, put on the figure as it stands at rest

def _parts(rig):
    look, n, t, hips = rig.look, rig.neck, rig.torso, rig.hips
    skin = lib.mat(f"skin-{look.name}", look.skin, 0.6)
    hair = lib.mat(f"hair-{look.name}", look.hair, 0.9)
    fur = lib.mat(f"fur-{look.name}", look.skin, 0.95, grain=0.4, grain_size=0.01)
    dark = lib.mat("nosetip", (0.10, 0.08, 0.08), 0.4)
    p = set(look.parts)
    if "elf_ears" in p:
        # Long and pointed, out to the side and swept back and up.
        for x, k in ((0.072, 1), (-0.072, -1)):
            lib.cyl(f"ear{k}", 0.022, 0.1, (x + 0.04 * k, 0.018, 0.80), skin, n, rot=(R(-22), R(68 * k), 0), r2=0.002, verts=8)
    if "long_hair" in p:
        # Down the back to the waist, with a fringe over the brow.
        lib.ball("longhair", 0.08, (0, 0.05, 0.68), hair, n, scale=(1.05, 0.55, 2.0))
        lib.ball("fringe", 0.062, (0, -0.035, 0.835), hair, n, scale=(1.3, 0.55, 0.5))
        # Two long locks in front of the shoulders, so the hair shows from the front too.
        for x in (0.078, -0.078):
            lib.ball(f"lock{x}", 0.028, (x, -0.03, 0.69), hair, n, scale=(0.75, 0.7, 3.0))
    if "fur_bikini" in p:
        # Bare arms and midriff; a top and a short bottom of bear fur; a loincloth front and back and a
        # headband in the player's colour, so the side still shows. A soldier's cuirass is left off (her
        # helmet, shield, weapon and cape stay).
        bear = lib.mat("bearfur", (0.42, 0.27, 0.15), 0.95, grain=0.45, grain_size=0.008)
        team = lib.team_mat()
        for o in list(rig.root.children_recursive):
            if o.type != "MESH":
                continue
            if o.name.startswith("cuirass") or (o.name.startswith("band") and o.parent is t):
                bpy.data.objects.remove(o, do_unlink=True)
                continue
            if o.name in ("tunic", "shoulders") or o.name.startswith("upper"):
                o.active_material = skin
            if o.name == "tunic":
                o.scale = (0.84, 0.78, 1)
            if o.name == "skirt":
                # The fur bottom: short, on the hips.
                o.active_material = bear
                o.scale = (1.06, 1.02, 0.55)
                o.location.z += 0.03
        for x in (0.037, -0.037):
            lib.ball(f"bust{x}", 0.04, (x, -0.064, 0.612), bear, t, scale=(1.0, 0.95, 0.9))
        lib.box("bikinistrap", (0.17, 0.12, 0.016), (0, 0.0, 0.625), bear, t)
        for y, k in ((-0.108, "front"), (0.108, "back")):
            lib.box(f"loincloth{k}", (0.07, 0.01, 0.13), (0, y, 0.35), team, t)
        if not any(o.name in ("headband", "helm", "hood") for o in n.children_recursive):
            lib.cyl("headband", 0.081, 0.018, (0, 0, 0.825), team, n, verts=16)
    if "tail_of_hair" in p:
        lib.ball("tailofhair", 0.03, (0, 0.09, 0.74), hair, n, scale=(0.9, 0.9, 2.4))
    if "beard" in p:
        # Down over the chest in two braids, a moustache over it.
        lib.ball("beard", 0.06, (0, -0.06, 0.69), hair, n, scale=(1.15, 0.7, 1.5))
        lib.ball("moustache", 0.03, (0, -0.075, 0.745), hair, n, scale=(1.8, 0.7, 0.6))
        ring = lib.mat("bronze", soldiers.BRONZE, 0.35, 0.8)
        for x in (0.028, -0.028):
            lib.cyl(f"braid{x}", 0.018, 0.12, (x, -0.075, 0.585), hair, n, r2=0.012, verts=8)
            lib.cyl(f"braidring{x}", 0.02, 0.018, (x, -0.075, 0.55), ring, n, verts=8)
    if "big_nose" in p:
        lib.ball("bignose", 0.026, (0, -0.078, 0.772), skin, n)
    if "cat_ears" in p:
        # A cat's ears on top of the head, in the colour of the hair, pink inside.
        pink = lib.mat("earpink", (0.95, 0.66, 0.66), 0.7)
        for x, k in ((0.048, 1), (-0.048, -1)):
            lib.cyl(f"catear{k}", 0.032, 0.07, (x, 0.0, 0.865), hair, n, rot=(R(-6), R(18 * k), 0), r2=0.003, verts=4)
            lib.cyl(f"catearin{k}", 0.018, 0.045, (x, -0.012, 0.86), pink, n, rot=(R(-6), R(18 * k), 0), r2=0.002, verts=4)
    if "cat_tail" in p:
        _tail(hips, hair, [(0, 0.10, 0.42), (0, 0.17, 0.38), (0, 0.23, 0.40), (0, 0.27, 0.47), (0, 0.28, 0.55), (0, 0.26, 0.61)], 0.022)
    if "wolf_tail" in p:
        _tail(hips, fur, [(0, 0.10, 0.40), (0, 0.16, 0.34), (0, 0.20, 0.27), (0, 0.22, 0.20)], 0.04)
    if "wolf_head" in p or "bear_head" in p:
        # A beast's head on the man's: the human nose gone under the muzzle.
        for o in list(n.children):
            if o.name == "nose":
                bpy.data.objects.remove(o, do_unlink=True)
        pale = lib.mat(f"muzzle-{look.name}", tuple(min(1.0, c * 1.35) for c in look.skin), 0.9)
        if "wolf_head" in p:
            lib.cyl("muzzle", 0.048, 0.12, (0, -0.105, 0.755), pale, n, rot=(R(90), 0, 0), r2=0.022, verts=12)
            lib.ball("nosetip", 0.017, (0, -0.168, 0.765), dark, n)
            for x, k in ((0.045, 1), (-0.045, -1)):
                lib.cyl(f"wolfear{k}", 0.03, 0.09, (x, 0.01, 0.865), fur, n, rot=(R(-10), R(14 * k), 0), r2=0.003, verts=4)
            lib.ball("ruff", 0.09, (0, 0.0, 0.69), fur, n, scale=(1.25, 1.1, 0.7))
        else:
            lib.ball("muzzle", 0.046, (0, -0.075, 0.75), pale, n, scale=(1.0, 1.2, 0.8))
            lib.ball("nosetip", 0.016, (0, -0.125, 0.765), dark, n)
            for x in (0.06, -0.06):
                lib.ball(f"bearear{x}", 0.026, (x, 0.0, 0.845), fur, n, scale=(1, 0.6, 1))
        # Fur over the arms and legs, where the villager shows skin.
        for o in rig.root.children_recursive:
            if o.type == "MESH" and o.active_material and o.active_material.name.startswith(f"skin-{look.name}"):
                o.active_material = fur


def _tail(parent, m, points, r):
    """A tail of small overlapping balls along a curve, thinning to its tip."""
    pts = [mathutils.Vector(p) for p in points]
    steps = []
    for a, b in zip(pts, pts[1:]):
        for i in range(4):
            steps.append(a.lerp(b, i / 4))
    steps.append(pts[-1])
    for i, v in enumerate(steps):
        lib.ball(f"tail{i}", r * (1.15 - 0.35 * i / len(steps)), tuple(v), m, parent, sub=1)


# ---- a people's build: wider or slimmer, a larger head, taller or shorter

def _reshape(rig):
    look = rig.look
    bpy.context.view_layer.update()
    objs = [rig.root, *rig.root.children_recursive]
    parents = {o: o.parent for o in objs}
    for o in objs:
        w = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = w
    bpy.context.view_layer.update()
    head_parts = set(rig.neck.children_recursive) if rig.look.head != 1 else set()
    centre = mathutils.Vector((0, 0, 0.775))

    def scale_mesh(o, s):
        rot = o.matrix_world.to_3x3()
        m = rot.inverted() @ mathutils.Matrix.Diagonal(s) @ rot
        o.data.transform(m.to_4x4())

    for o in objs:
        if o is rig.root:
            continue
        loc = o.matrix_world.translation.copy()
        # The head grows about its middle, everything on it with it.
        if o in head_parts and loc.z > 0.71:
            k = look.head
            loc = centre + (loc - centre) * k
            if o.type == "MESH":
                scale_mesh(o, (k, k, k))
        if look.girth != 1:
            loc.x, loc.y = loc.x * look.girth, loc.y * look.girth
            if o.type == "MESH":
                scale_mesh(o, (look.girth, look.girth, 1))
        m = o.matrix_world.copy()
        m.translation = loc
        o.matrix_world = m
    bpy.context.view_layer.update()
    for o in objs:
        if parents[o] is not None:
            lib.adopt(o, parents[o])
    rig.root.scale = (look.height,) * 3


def finish(rig):
    """The parts, then the build: a rig built with a look is not that people's until this is done."""
    if rig.look:
        _parts(rig)
        _reshape(rig)
    return rig


# The common units the elves train (their tech tree leaves out the rest), drawn as elves: "elf/<unit>".
ELF_UNITS = ["clubman", "axeman", "slinger", "short_swordsman", "broad_swordsman", "long_swordsman", "hoplite", "phalanx",
             "bowman", "improved_bowman", "priest", "scout", "cavalry", "horse_archer", "heavy_horse_archer"]


def elf_unit(unit):
    """A common unit as an elf: on foot, or riding a horse."""
    kit = soldiers.KITS[unit]
    if unit not in ("scout", "cavalry", "horse_archer", "heavy_horse_archer"):
        return soldier_of(ELF, kit)
    rider = finish(soldiers.Soldier(unit, ELF, kit))
    beast = soldiers.Horse()
    rider.root.location = (0, 0.02, soldiers.Horse.HIGH + 0.02 - 0.42)
    lib.adopt(rider.root, beast.body)
    return soldiers.Mount(rider, beast)


def villager_of(race, tool):
    """A race's villager with a tool (villager.Rig's): a centaur for the Centaurs."""
    look = VILLAGERS[race]
    if race == "centaur":
        return Centaur(lambda: villager.Rig(tool, look), trot=True)
    return finish(villager.Rig(tool, look))


def soldier_of(look, kit):
    return finish(soldiers.Soldier(None, look, kit))


# ---- the elves' huntress and fighter: a bow to hunt with, a dagger to fight

def elf_hunter():
    return soldier_of(ELF, ("none", "none", "none", "bow", {"quiver": True}))


def elf_fighter():
    return soldier_of(ELF, ("none", "none", "none", "dagger", {}))


# ---- the races' own units

UNITS = {
    # Elves: a hooded archer with a bow as tall as herself, a cloak in her colour.
    "glade_archer": (lambda: soldier_of(ELF, ("band", "leather", "none", "greatbow", {"quiver": True, "cape": True})), "shoot"),
    # Dwarves: shut up in iron with a shield half their height; a heavy crossbow wound by a crank.
    "ironclad": (lambda: soldier_of(DWARF, ("corinth", "iron", "aspis", "axe", {"plume": False})), "slash"),
    "deep_arbalest": (lambda: soldier_of(DWARF, ("cheek", "scale", "none", "crossbow", {})), "crossbow"),
    # Beastfolk: a grey wolf with an axe in each hand; a brown bear with a stone maul.
    "wolfkin_raider": (lambda: soldier_of(WOLF, ("none", "leather", "none", "twin_axe", {})), "slash"),
    "bearkin_brute": (lambda: soldier_of(BEAR, ("none", "leather", "none", "maul", {})), "slash"),
}


class Centaur:
    """A man's body rising from a horse's chest, where its neck would be. `make` builds the man (a villager
    or a soldier, with the Centaur look); his legs are the horse's."""

    def __init__(self, make, trot=False, coat=(0.54, 0.33, 0.18)):
        self.trot = trot
        self.beast = _HeadlessHorse(coat)
        self.rider = finish(make())
        for o in self.rider.root.children_recursive:
            if o.name.startswith(("thigh", "shin", "foot")):
                o.hide_render = True
        front = -soldiers.Horse.BODY[0] * soldiers.Horse.BODY[1] * 0.72
        self.rider.root.location = (0, front, soldiers.Horse.HIGH + 0.06 - 0.42)
        lib.adopt(self.rider.root, self.beast.body)

    def face(self, angle):
        self.beast.face(angle)

    def pose(self, anim, t):
        if anim == "walk":
            if self.trot:  # villagers walk; soldiers gallop
                animals.Quadruped.pose(self.beast, "walk", t)
            else:
                self.beast.pose("walk", t)
        else:
            self.beast.pose("idle", t)
        # The man's work is his arms' and body's: squatting at a carcass becomes leaning down to it.
        self.rider.pose("hammer" if anim == "butcher" else anim if anim != "walk" else "idle", t)
        self.rider.hips.location = (0, 0, 0.42)
        if anim == "butcher":
            self.rider.torso.rotation_euler = (R(40), 0, R(-6))


class _HeadlessHorse(soldiers.Horse):
    def __init__(self, coat):
        super().__init__(coat)

    def head(self):
        # No neck or head: the man stands there. The tail stays.
        lib.cyl("tail", 0.03, 0.3, (0, 0.27, self.HIGH - 0.02), lib.mat("mane", (0.15, 0.1, 0.06), 0.9), self.tail, rot=(R(-25), 0, 0), r2=0.015)


def centaur_archer():
    return Centaur(lambda: soldiers.Soldier(None, CENTAUR_LOOK, ("band", "leather", "none", "composite", {"quiver": True})))


def hoof_lancer():
    return Centaur(lambda: soldiers.Soldier(None, CENTAUR_LOOK, ("bronze", "bronze", "none", "lance", {})), coat=(0.62, 0.60, 0.58))


UNITS["centaur_archer"] = (centaur_archer, "shoot")
UNITS["hoof_lancer"] = (hoof_lancer, "thrust")


class Treant(soldiers.Soldier):
    """The Grove Warden: a walking tree. The figure's joints, bark and roots instead of the man; a crown of
    leaves for a head; a band of cloth in its player's colour round the trunk."""

    def __init__(self):
        super().__init__(None, None, ("none", "none", "none", "club", {}))
        for o in list(self.root.children_recursive):
            if o.type == "MESH":
                bpy.data.objects.remove(o, do_unlink=True)
        bark = lib.mat("bark", (0.36, 0.24, 0.14), 0.95, grain=0.5, grain_size=0.008)
        moss = lib.mat("moss", (0.36, 0.52, 0.22), 0.95, grain=0.4, grain_size=0.01)
        leaf = lib.mat("treeleaf", (0.30, 0.56, 0.20), 0.9, grain=0.45, grain_size=0.012)
        t = lib.cyl("trunk", 0.12, 0.42, (0, 0, 0.56), bark, self.torso, r2=0.09, verts=10)
        lib.lumpy(t, 0.012, 6, 3)
        lib.cyl("band", 0.125, 0.04, (0, 0, 0.5), lib.team_mat("teamcloth"), self.torso, verts=12)
        lib.ball("mossyshoulders", 0.11, (0, 0, 0.72), moss, self.torso, scale=(1.3, 0.9, 0.5))
        for i, (x, y, z, r) in enumerate(((0, 0, 0.84, 0.1), (0.07, 0.02, 0.8, 0.07), (-0.07, 0.03, 0.8, 0.07), (0, 0.05, 0.9, 0.07))):
            lib.ball(f"crown{i}", r, (x, y, z), leaf, self.neck)
        for side, x in (("L", 0.13), ("R", -0.13)):
            a = self.arms[side]
            lib.cyl(f"bough{side}", 0.035, 0.32, (x, 0, 0.5), bark, a, r2=0.022, verts=8)
            for j, (dx, dz) in enumerate(((0.03, 0.33), (-0.02, 0.32), (0.0, 0.3))):
                lib.cyl(f"twig{side}{j}", 0.01, 0.08, (x + dx, -0.01, dz), bark, self.elbows[side], r2=0.003, verts=5)
            lib.ball(f"handleaf{side}", 0.035, (x, 0, 0.33), leaf, self.elbows[side])
            lx = x * 0.45
            lib.cyl(f"root{side}", 0.06, 0.38, (lx, 0, 0.2), bark, self.legs[side], r2=0.05, verts=8)
            for j, ang in enumerate((0, 120, 240)):
                dx, dy = 0.06 * math.cos(R(ang)), 0.06 * math.sin(R(ang))
                lib.cyl(f"rootlet{side}{j}", 0.025, 0.1, (lx + dx, dy, 0.02), bark, self.knees[side], rot=(R(70) * (dy / 0.06), R(-70) * (dx / 0.06), 0), r2=0.006, verts=6)
        self.weapon = "club"
        self.root.scale = (1.6,) * 3

    def hold(self, anim):
        pass  # no weapon to carry: the boughs hang


UNITS["grove_warden"] = (Treant, "slash")


# ---- the elves age by age (replica/elf-ages-plan.md, approved 2026-10-17): over the bear fur, a layer more with
# each age, never covering less of her than the swimsuit she wears now and never more than a cape behind.
#   Tool    a leather wrap at the hips, vine bracelets, laced sandals, a satchel across her
#   Bronze  a short cape of jade silk, a torc of green bronze, leaves in her hair, an embroidered belt
#   Iron    a white cape hemmed in silver, a circlet of silver leaves, a moonstone at her breast, white boots
# Blades go from stone to green bronze to silver.

ELF_AGES = ["stone", "tool", "bronze", "iron"]
# The age each common unit of the elves is first trained in, which is the dress it wears.
ELF_UNIT_AGE = {"clubman": 0, "axeman": 1, "slinger": 1, "bowman": 1, "scout": 1, "short_swordsman": 2, "broad_swordsman": 2,
                "hoplite": 2, "improved_bowman": 2, "cavalry": 2, "priest": 2, "long_swordsman": 3, "phalanx": 3,
                "horse_archer": 3, "heavy_horse_archer": 3}


def elf_dress(rig, tier):
    if tier <= 0:
        return rig
    t, n, hips = rig.torso, rig.neck, rig.hips
    leather = lib.mat("elfleather", (0.50, 0.32, 0.18), 0.75, grain=0.3, grain_size=0.01)
    vine = lib.mat("vine", (0.30, 0.50, 0.22), 0.8)
    jade = lib.mat("jadesilk", (0.36, 0.66, 0.58), 0.45)
    bronze = lib.mat("verdigris", (0.36, 0.60, 0.50), 0.45, 0.6)
    white = lib.mat("elfwhite", (0.95, 0.94, 0.91), 0.5)
    silver = lib.mat("silver", (0.86, 0.88, 0.92), 0.25, 0.95)
    moon = lib.mat("moonstone", (0.70, 1.0, 0.86), 0.2, emit=(0.55, 0.95, 0.75))
    blade = {1: lib.mat("flintblade", (0.36, 0.34, 0.36), 0.4), 2: bronze, 3: silver}[tier]
    for o in list(rig.root.children_recursive):
        if o.type == "MESH" and o.active_material and o.active_material.name.split(".")[0] in ("iron", "flint"):
            o.active_material = blade
    # Tool: the wrap at the hips (sides only, over the fur), bracelets, sandals, a satchel.
    lib.cyl("elf-wrap", 0.112, 0.07, (0, 0.0, 0.40), leather if tier < 3 else white, t, r2=0.12, verts=20).scale = (1.12, 1.0, 1)
    for side in ("L", "R"):
        e = rig.elbows.get(side) if hasattr(rig, "elbows") else None
        if e is not None:
            x = 0.112 if side == "L" else -0.112
            lib.cyl(f"elf-bracelet{side}", 0.03, 0.02, (x, 0, 0.40), vine if tier == 1 else bronze if tier == 2 else silver, e, verts=10)
        kn = rig.knees.get(side) if hasattr(rig, "knees") else None
        if kn is not None:
            lx = (0.112 if side == "L" else -0.112) * 0.45
            if tier == 3:
                lib.cyl(f"elf-boot{side}", 0.038, 0.16, (lx, 0, 0.1), white, kn, r2=0.03, verts=10)
            else:
                for j in range(2):
                    lib.cyl(f"elf-lace{side}{j}", 0.036, 0.012, (lx, 0, 0.05 + j * 0.05), leather, kn, verts=10)
    if tier == 1:
        lib.box("elf-satchelstrap", (0.02, 0.2, 0.012), (0, 0, 0.56), leather, t, rot=(0, R(35), 0))
        lib.ball("elf-satchel", 0.04, (0.09, 0.06, 0.45), leather, t, scale=(1, 0.6, 1))
    if tier >= 2:
        # A cape from the shoulders, behind: jade silk, then white hemmed in silver.
        lib.box("elf-cape", (0.2, 0.012, 0.32), (0, 0.075, 0.5), jade if tier == 2 else white, t, rot=(R(-6), 0, 0))
        if tier == 3:
            lib.box("elf-capehem", (0.205, 0.014, 0.02), (0, 0.08, 0.345), silver, t)
        lib.cyl("elf-belt", 0.11, 0.025, (0, 0, 0.455), jade if tier == 2 else silver, t, verts=20)
    if tier == 2:
        lib.cyl("elf-torc", 0.04, 0.015, (0, 0, 0.705), bronze, n, verts=14)
        for j, x in enumerate((-0.06, 0.06)):
            lib.ball(f"elf-hairleaf{j}", 0.018, (x, 0.02, 0.85), vine, n, scale=(1.4, 0.5, 0.8))
    if tier == 3:
        lib.cyl("elf-circlet", 0.083, 0.014, (0, 0, 0.83), silver, n, verts=16)
        for j in range(3):
            lib.ball(f"elf-circletleaf{j}", 0.014, (-0.03 + j * 0.03, -0.075, 0.845), silver, n, scale=(0.8, 0.4, 1.4))
        lib.ball("elf-moonstone", 0.014, (0, -0.07, 0.66), moon, t)
    return rig


class Elk(soldiers.Horse):
    """The elves ride great elk, brown, and white in the Iron Age: a horse's build with antlers."""

    def __init__(self, coat=(0.52, 0.38, 0.24)):
        super().__init__(coat)

    def head(self):
        super().head()
        antler = lib.mat("antler", (0.86, 0.80, 0.66), 0.7)
        y, z = -0.24, self.HIGH + 0.1
        for k in (-1, 1):
            lib.cyl(f"antler{k}", 0.01, 0.22, (0.03 * k, y - 0.06, z + 0.35), antler, self.neck, rot=(R(-15), R(30 * k), 0), verts=5, r2=0.004)
            for j in range(2):
                lib.cyl(f"tine{k}{j}", 0.007, 0.1, (0.06 * k, y - 0.08 + 0.03 * j, z + 0.38 + 0.05 * j), antler, self.neck,
                        rot=(R(-40), R(60 * k), 0), verts=4, r2=0.002)


def elf_unit_aged(unit):
    """A common unit as an elf in the dress of the age it is first trained in; riders on elk."""
    tier = ELF_UNIT_AGE.get(unit, 0)
    kit = soldiers.KITS[unit]
    if unit not in ("scout", "cavalry", "horse_archer", "heavy_horse_archer"):
        return elf_dress(soldier_of(ELF, kit), tier)
    rider = elf_dress(finish(soldiers.Soldier(unit, ELF, kit)), tier)
    beast = Elk((0.92, 0.90, 0.86) if tier >= 3 else (0.52, 0.38, 0.24))
    rider.root.location = (0, 0.02, soldiers.Horse.HIGH + 0.02 - 0.42)
    lib.adopt(rider.root, beast.body)
    return soldiers.Mount(rider, beast)


# ---- the dwarves, centaurs and beastfolk age by age (replica/races-ages-plan.md), as the elves above: each
# age's villager wears a layer more, and each common soldier the dress of the age it is first trained in.
#   Dwarf      Tool: a leather apron, iron bracers, boots. Bronze: a shirt of mail, a bronze cap, a bronze belt.
#              Iron: a steel breastplate banded in gold, a helm rimmed in gold with a miner's lamp.
#   Centaur    Tool: a blanket over the horse's back, saddlebags, a leather vest. Bronze: the blanket blue and
#              starred, bronze armlets, a band with a star. Iron: a white caparison fringed in gold, a gold
#              breastplate and circlet.
#   Beastfolk  Tool: a leather vest and wraps. Bronze: a necklace of fangs, stripes of ochre, a feather.
#              Iron: bronze armlets, a cloak of dark fur, a circlet of bronze fangs.

UNIT_AGE = {"clubman": 0, "axeman": 1, "slinger": 1, "bowman": 1, "scout": 1, "short_swordsman": 2, "broad_swordsman": 2,
            "hoplite": 2, "improved_bowman": 2, "cavalry": 2, "priest": 2, "camel_rider": 2, "long_swordsman": 3, "legion": 3,
            "phalanx": 3, "centurion": 3, "horse_archer": 3, "heavy_horse_archer": 3, "heavy_cavalry": 3, "cataphract": 3}
MOUNTED = {"scout", "cavalry", "heavy_cavalry", "cataphract", "horse_archer", "heavy_horse_archer", "camel_rider"}
# The common units each race trains (its tech tree), drawn as that race: "<race>/<unit>".
RACE_UNITS = {
    "dwarf": ["clubman", "axeman", "slinger", "short_swordsman", "broad_swordsman", "long_swordsman", "legion", "hoplite",
              "phalanx", "centurion", "bowman", "improved_bowman", "scout"],
    "centaur": ["clubman", "axeman", "slinger", "hoplite", "phalanx", "centurion", "bowman", "horse_archer",
                "heavy_horse_archer", "scout", "cavalry", "heavy_cavalry", "cataphract", "camel_rider"],
    "beastfolk": ["clubman", "axeman", "slinger", "short_swordsman", "broad_swordsman", "long_swordsman", "hoplite",
                  "phalanx", "centurion", "bowman", "improved_bowman", "horse_archer", "heavy_horse_archer", "scout",
                  "cavalry", "heavy_cavalry", "camel_rider"],
}
# The beastfolk's heavy foot are bearkin; the rest wolfkin.
BEARS = {"long_swordsman", "phalanx", "centurion", "legion"}


def _limbs(rig, fn):
    """Calls fn(side, x, elbow, knee) for each side of a figure."""
    for side in ("L", "R"):
        x = 0.112 if side == "L" else -0.112
        fn(side, x, rig.elbows.get(side), rig.knees.get(side))


def race_dress(race, figure, tier):
    """A race's figure (a villager or a soldier, or a centaur holding one) in the dress of an age."""
    if tier <= 0:
        return figure
    rig = getattr(figure, "rider", figure)
    t, n = rig.torso, rig.neck
    leather = lib.mat(f"{race}-leather", (0.46, 0.30, 0.17), 0.75, grain=0.3, grain_size=0.01)
    bronze = lib.mat("bronze", soldiers.BRONZE, 0.35, 0.8)
    gold = lib.mat("dressgold", (0.95, 0.78, 0.32), 0.3, 0.9)
    steel = lib.mat("dresssteel", (0.56, 0.58, 0.62), 0.3, 0.9)
    if race == "dwarf":
        iron = lib.mat("dwarfbracer", (0.36, 0.36, 0.38), 0.4, 0.8)
        lib.box("d-apron", (0.15, 0.02, 0.24), (0, -0.115, 0.45), leather, t)
        _limbs(rig, lambda s, x, e, k: (e and lib.cyl(f"d-bracer{s}", 0.03, 0.06, (x, 0, 0.42), iron if tier < 3 else gold, e, verts=10),
                                          k and lib.cyl(f"d-boot{s}", 0.04, 0.12, (x * 0.45, 0, 0.07), leather, k, verts=10)))
        if tier >= 2:
            lib.cyl("d-mail", 0.104, 0.2, (0, 0, 0.56), lib.mat("mail", (0.50, 0.50, 0.52), 0.5, 0.7, grain=0.5, grain_size=0.004) if tier == 2 else steel,
                    t, r2=0.09, verts=20)
            lib.cyl("d-belt", 0.108, 0.035, (0, 0, 0.47), bronze if tier == 2 else gold, t, verts=20)
            lib.ball("d-cap", 0.082, (0, 0.005, 0.81), bronze if tier == 2 else steel, n, scale=(1, 1, 0.75))
        if tier == 3:
            lib.cyl("d-breastband", 0.106, 0.03, (0, 0, 0.62), gold, t, verts=20)
            lib.cyl("d-helmrim", 0.084, 0.02, (0, 0.005, 0.79), gold, n, verts=16)
            lib.ball("d-lamp", 0.018, (0, -0.08, 0.83), lib.mat("dwarf-glow", (1.0, 0.45, 0.12), 1.0, emit=(1.0, 0.45, 0.12)), n, sub=1)
    elif race == "centaur":
        beast = getattr(figure, "beast", None)
        blanket = [None, lib.mat("blanketbrown", (0.52, 0.34, 0.20), 0.85, grain=0.3), lib.mat("blanketblue", (0.20, 0.34, 0.64), 0.7),
                   lib.mat("caparison", (0.95, 0.94, 0.90), 0.6)][tier]
        if beast is not None:
            hb = soldiers.Horse.HIGH
            lib.ball("c-blanket", 0.15, (0, 0.08, hb + 0.04), blanket, beast.body, scale=(1.08, 1.4, 0.75), sub=2)
            if tier == 1:
                for s in (-1, 1):
                    lib.ball(f"c-saddlebag{s}", 0.045, (s * 0.14, 0.18, hb - 0.02), leather, beast.body, scale=(0.6, 1.0, 1.0), sub=1)
            if tier >= 2:
                for i in range(5):
                    lib.ball(f"c-star{i}", 0.014, (0.155, -0.08 + 0.08 * i, hb + 0.02), gold, beast.body, sub=1)
            if tier == 3:
                lib.cyl("c-fringe", 0.16, 0.025, (0, 0.08, hb - 0.06), gold, beast.body, verts=20).scale = (1.05, 1.45, 1)
        lib.cyl("c-vest", 0.1, 0.18, (0, 0, 0.57), leather if tier == 1 else blanket if tier == 2 else gold, t, r2=0.088, verts=20)
        if tier >= 2:
            _limbs(rig, lambda s, x, e, k: e and lib.cyl(f"c-armlet{s}", 0.031, 0.03, (x, 0, 0.48), bronze if tier == 2 else gold, e, verts=10))
            lib.cyl("c-headband", 0.081, 0.02, (0, 0, 0.82), blanket if tier == 2 else gold, n, verts=16)
            lib.ball("c-headstar", 0.016, (0, -0.08, 0.82), gold, n, sub=1)
    else:  # beastfolk
        ochre = lib.mat("ochre2", (0.72, 0.20, 0.12), 0.85)
        bone = lib.mat("bone", (0.90, 0.86, 0.74), 0.7)
        fur = lib.mat("darkfur", (0.24, 0.18, 0.12), 0.95, grain=0.45, grain_size=0.006)
        lib.cyl("b-vest", 0.1, 0.17, (0, 0, 0.57), leather, t, r2=0.09, verts=18)
        _limbs(rig, lambda s, x, e, k: k and lib.cyl(f"b-wrap{s}", 0.037, 0.06, (x * 0.45, 0, 0.12), leather, k, verts=10))
        if tier >= 2:
            for i in range(5):
                a = R(-60 + 30 * i)
                lib.cyl(f"b-fang{i}", 0.008, 0.035, (math.sin(a) * 0.06, -math.cos(a) * 0.06, 0.66), bone, n, verts=4, r2=0.001)
            for j in range(2):
                lib.box(f"b-paint{j}", (0.1, 0.01, 0.012), (0, -0.1, 0.52 + 0.04 * j), ochre, t)
            lib.cyl("b-feather", 0.008, 0.12, (0.05, 0.03, 0.87), lib.mat("feather", (0.90, 0.88, 0.82), 0.7), n, rot=(0, R(20), 0), verts=4, r2=0.002)
        if tier == 3:
            beastbronze = lib.mat("beastbronze", (0.68, 0.46, 0.22), 0.35, 0.8)
            _limbs(rig, lambda s, x, e, k: e and lib.cyl(f"b-armlet{s}", 0.031, 0.035, (x, 0, 0.47), beastbronze, e, verts=10))
            lib.box("b-cloak", (0.22, 0.015, 0.34), (0, 0.08, 0.5), fur, t, rot=(R(-6), 0, 0))
            lib.cyl("b-circlet", 0.082, 0.018, (0, 0, 0.83), beastbronze, n, verts=16)
    return figure


def race_unit_aged(race, unit):
    """A common unit as one of a race, in the dress of the age it is first trained in."""
    tier = UNIT_AGE.get(unit, 0)
    kit = soldiers.KITS[unit]
    if race == "centaur":
        coat = (0.56, 0.36, 0.20) if tier < 3 else (0.80, 0.76, 0.70)
        return race_dress("centaur", Centaur(lambda: soldiers.Soldier(None, CENTAUR_LOOK, kit), coat=coat), tier)
    look = DWARF if race == "dwarf" else (BEAR if unit in BEARS else WOLF)
    if unit not in MOUNTED:
        return race_dress(race, soldier_of(look, kit), tier)
    rider = race_dress(race, finish(soldiers.Soldier(unit, look, kit)), tier)
    beast = soldiers.Horse((0.40, 0.40, 0.42) if race == "dwarf" else (0.30, 0.30, 0.32))
    rider.root.location = (0, 0.02, soldiers.Horse.HIGH + 0.02 - 0.42)
    lib.adopt(rider.root, beast.body)
    return soldiers.Mount(rider, beast)
