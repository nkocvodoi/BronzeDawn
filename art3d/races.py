# The fantasy races (replica/game/fantasy-races.md): the common figure (villager.Rig) given each people's
# build, colours and parts of their own, and the races' own units. Drawn in the manner of Japanese
# animation rather than European tradition: heads a little larger, hair in big clear shapes.
#
#   Elf          as tall as anyone, slender, mostly women with full figures, golden hair, long pointed ears
#   Dwarf        short and broad, a braided beard down the chest, a big nose
#   Centaur  centaurs: a man's body where a horse's neck would be, villagers too
#   Beastfolk    villagers with a human face and a cat's ears and tail; soldiers tall, with a wolf's or
#                a bear's head
#
# Clothing covers everyone: the full figure is the shape of the tunic, never skin.

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
           girth=0.92, head=1.14, parts=("elf_ears", "long_hair", "figure"))
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
    if "figure" in p:
        # A woman's figure: a fitted bodice with a full bust and a narrow waist, a long skirt in her player's
        # colour (so the side shows from the front), sleeves of the bodice's cloth.
        bodice = next((o.active_material for o in t.children_recursive if o.name.startswith("cuirass")), None) \
            or lib.mat(f"bodice-{look.name}", look.cloth, 0.8)
        team = lib.team_mat()
        for o in rig.root.children_recursive:
            if o.type != "MESH":
                continue
            if o.name in ("tunic", "shoulders") or o.name.startswith("upper"):
                o.active_material = bodice
            if o.name == "tunic":
                o.scale = (0.86, 0.8, 1)
            if o.name == "skirt":
                o.active_material = team
                o.scale = (1.12, 1.05, 1.9)
                o.location.z -= 0.04
        for x in (0.036, -0.036):
            lib.ball(f"bust{x}", 0.036, (x, -0.062, 0.615), bodice, t, scale=(1.0, 0.95, 0.9))
        lib.cyl("waist", 0.082, 0.04, (0, 0, 0.5), lib.mat("belt", villager.BELT, 0.8), t, verts=16)
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
