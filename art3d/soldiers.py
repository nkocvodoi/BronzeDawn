# Soldiers on foot, riders, chariots and elephants: the villager's figure with a kit (helmet, armour, shield,
# weapon, cape), and the animals it rides. Kits follow the game's own (KITS in web/src/game/art.ts).

import math

import animals
import lib
import villager

R = math.radians

LEATHER = (0.45, 0.30, 0.16)
BRONZE = (0.72, 0.52, 0.24)
IRON = (0.55, 0.56, 0.60)
CLOTH = (0.80, 0.70, 0.50)
RED = (0.75, 0.14, 0.12)
WOOD = (0.45, 0.28, 0.12)

KITS = {
    "clubman": ("none", "none", "none", "club", {}),
    "axeman": ("leather", "leather", "none", "axe", {}),
    "slinger": ("band", "none", "none", "sling", {}),
    "short_swordsman": ("bronze", "leather", "small", "short", {}),
    "broad_swordsman": ("cheek", "scale", "round", "broad", {}),
    "long_swordsman": ("crest", "bronze", "oval", "long", {"cape": True}),
    "legion": ("roman", "lorica", "scutum", "gladius", {"cape": True, "plume": True}),
    "hoplite": ("corinth", "bronze", "aspis", "spear", {"plume": True}),
    "phalanx": ("plume", "iron", "aspis", "spear", {}),
    "centurion": ("transverse", "iron", "aspis", "spear", {"cape": True, "plume": True}),
    "bowman": ("none", "none", "none", "bow", {"quiver": True}),
    "improved_bowman": ("cap", "leather", "none", "longbow", {"quiver": True}),
    "composite_bowman": ("pointed", "scale", "none", "composite", {"quiver": True}),
    "priest": ("hood", "none", "none", "staff", {"robe": True}),
    # Riders.
    "scout": ("band", "none", "none", "javelin", {}),
    "cavalry": ("bronze", "leather", "round", "short", {}),
    "heavy_cavalry": ("crest", "bronze", "round", "broad", {"cape": True}),
    "cataphract": ("pointed", "scale", "none", "lance", {}),
    "horse_archer": ("band", "leather", "none", "composite", {"quiver": True}),
    "heavy_horse_archer": ("pointed", "scale", "none", "composite", {"quiver": True}),
    "camel_rider": ("turban", "none", "none", "scimitar", {}),
    "chariot": ("bronze", "leather", "none", "spear", {}),
    "scythe_chariot": ("crest", "bronze", "none", "spear", {}),
    "chariot_archer": ("cap", "leather", "none", "bow", {"quiver": True}),
    "war_elephant": ("turban", "none", "none", "javelin", {}),
    "armored_elephant": ("turban", "none", "none", "javelin", {}),
    "elephant_archer": ("turban", "leather", "none", "composite", {"quiver": True}),
}

SWORDS = {"short": 0.24, "broad": 0.3, "long": 0.36, "gladius": 0.24, "scimitar": 0.3}
SPEARS = {"spear": 0.75, "lance": 0.85, "javelin": 0.5}
BOWS = {"bow": 0.32, "longbow": 0.4, "composite": 0.3}


def attack_of(weapon):
    if weapon in BOWS:
        return "shoot"
    if weapon in SPEARS:
        return "thrust"
    if weapon == "sling":
        return "sling"
    if weapon == "staff":
        return "bless"
    return "slash"


class Soldier(villager.Rig):
    def __init__(self, unit):
        super().__init__("none")
        helm, armor, shield, weapon, more = KITS[unit]
        self.weapon, self.shield_kind = weapon, shield
        metal = lib.mat("iron", IRON, 0.35, 0.8) if armor in ("iron", "lorica") or helm in ("roman", "transverse", "plume") else lib.mat("bronze", BRONZE, 0.35, 0.8)
        leather = lib.mat("leather", LEATHER, 0.8)
        # Armour over the tunic: a cuirass of leather, scales or metal, leaving the colour showing below.
        if armor != "none":
            m = leather if armor == "leather" else metal
            lib.cyl("cuirass", 0.102, 0.17, (0, 0, 0.61), m, self.torso, r2=0.09, verts=16)
            if armor in ("scale", "lorica"):
                for k in range(3):
                    lib.cyl(f"band{k}", 0.105 - k * 0.004, 0.012, (0, 0, 0.56 + k * 0.045), lib.mat("dark", (0.25, 0.22, 0.2), 0.6), self.torso, verts=16)
        if more.get("robe"):
            lib.cyl("robe", 0.13, 0.42, (0, 0, 0.32), lib.mat("robe", (0.92, 0.90, 0.84), 0.9), self.torso, r2=0.1, verts=20)
            lib.box("stole", (0.05, 0.02, 0.3), (0, -0.1, 0.55), self.team_cloth(), self.torso)
        if more.get("cape"):
            lib.box("cape", (0.18, 0.02, 0.32), (0, 0.1, 0.5), self.team_cloth(), self.torso, rot=(R(-8), 0, 0))
        self.helmet(helm, metal, leather, more.get("plume"))
        if shield != "none":
            self.make_shield(shield, metal)
        self.make_weapon(weapon, metal)
        if more.get("quiver"):
            q = lib.cyl("quiver", 0.035, 0.24, (0.05, 0.1, 0.6), leather, self.torso, rot=(R(15), R(-15), 0))
            for k in range(3):
                lib.cyl(f"arrowtip{k}", 0.006, 0.08, (0.05 + k * 0.01, 0.12, 0.74), lib.mat("feather", (0.9, 0.9, 0.85), 0.8), self.torso, rot=(R(15), R(-15), 0))

    def team_cloth(self):
        return lib.team_mat("teamcloth")

    def helmet(self, kind, metal, leather, plume):
        n = self.neck
        if kind == "none":
            return
        if kind == "band":
            lib.cyl("headband", 0.081, 0.02, (0, 0, 0.79), self.team_cloth(), n, verts=16)
            return
        if kind == "hood":
            lib.ball("hood", 0.088, (0, 0.01, 0.79), lib.mat("robe", (0.92, 0.90, 0.84), 0.9), n, scale=(1, 1.05, 1.05))
            return
        if kind == "turban":
            lib.ball("turban", 0.088, (0, 0.005, 0.81), lib.mat("turban", (0.92, 0.88, 0.78), 0.9), n, scale=(1.05, 1.05, 0.8))
            return
        m = leather if kind in ("cap", "leather") else metal
        lib.ball("helm", 0.085, (0, 0.005, 0.8), m, n, scale=(1.0, 1.0, 0.9))
        if kind == "pointed":
            lib.cyl("spike", 0.06, 0.1, (0, 0.005, 0.86), m, n, r2=0.005, verts=10)
        if kind in ("cheek", "corinth", "roman"):
            for x in (0.06, -0.06):
                lib.box(f"cheek{x}", (0.02, 0.05, 0.06), (x, -0.03, 0.755), m, n)
        if kind == "crest" or (kind in ("corinth", "plume", "roman") and plume):
            c = lib.box("crest", (0.025, 0.16, 0.06), (0, 0.01, 0.9), lib.mat("plume", RED, 0.9), n)
        if kind == "transverse":
            lib.box("tcrest", (0.18, 0.025, 0.06), (0, 0.0, 0.9), lib.mat("plume", RED, 0.9), n)
        if kind == "plume" and not plume:
            lib.ball("tuft", 0.035, (0, 0.03, 0.9), lib.mat("tuft", (0.95, 0.95, 0.9), 0.9), n, scale=(0.7, 1.4, 1.3))

    def make_shield(self, kind, metal):
        # On the left forearm, facing out.
        g = lib.empty("shieldgrip", (0.13, 0, 0.42), self.elbows["L"])
        face, rim = self.team_cloth(), metal
        if kind in ("small", "round", "aspis"):
            r = {"small": 0.08, "round": 0.1, "aspis": 0.13}[kind]
            lib.cyl("shield", r, 0.02, (0.16, 0, 0.42), face, g, rot=(0, R(90), 0), verts=20)
            lib.cyl("rim", r + 0.008, 0.012, (0.155, 0, 0.42), rim, g, rot=(0, R(90), 0), verts=20)
        elif kind == "oval":
            lib.ball("shield", 0.1, (0.16, 0, 0.42), face, g, scale=(0.15, 0.8, 1.3))
        else:  # the tall, curved shield of the legions
            lib.box("shield", (0.025, 0.17, 0.3), (0.16, 0, 0.42), face, g, bevel=0.012)
            lib.box("boss", (0.03, 0.04, 0.04), (0.175, 0, 0.42), rim, g)
        self.shield = g

    def make_weapon(self, w, metal):
        hx, hz = -0.112, 0.36
        g = lib.empty("grip", (hx, 0, hz), self.handR)
        wood = lib.mat("wood", WOOD, 0.7)
        blade = lib.mat("blade", (0.80, 0.80, 0.82), 0.25, 0.9)
        if w in SWORDS:
            L = SWORDS[w]
            lib.box("hilt", (0.06, 0.02, 0.015), (hx, 0, hz - 0.02), metal, g)
            lib.box("blade", (0.035 if w != "gladius" else 0.04, 0.012, L), (hx, 0, hz - 0.03 - L / 2), blade, g, bevel=0.004)
        elif w in SPEARS:
            L = SPEARS[w]
            lib.cyl("shaft", 0.011, L, (hx, 0, hz - 0.1 + L / 2 - 0.15), wood, g)
            lib.cyl("point", 0.022, 0.08, (hx, 0, hz - 0.1 + L - 0.11), blade, g, r2=0.002, verts=4)
        elif w == "axe":
            lib.cyl("haft", 0.013, 0.34, (hx, 0, hz - 0.12), wood, g)
            lib.box("axeblade", (0.012, 0.08, 0.07), (hx, -0.04, hz - 0.26), blade, g, bevel=0.006)
        elif w == "club":
            lib.cyl("club", 0.035, 0.3, (hx, 0, hz - 0.13), wood, g, r2=0.015)
        elif w == "sling":
            lib.cyl("strap", 0.006, 0.18, (hx, 0, hz - 0.08), lib.mat("leather", LEATHER, 0.8), g)
            lib.ball("pouch", 0.02, (hx, 0, hz - 0.17), lib.mat("leather", LEATHER, 0.8), g)
        elif w == "staff":
            lib.cyl("staff", 0.012, 0.9, (hx, 0, hz + 0.1), wood, g)
            lib.ball("knob", 0.03, (hx, 0, hz + 0.55), lib.mat("gold", (0.95, 0.74, 0.18), 0.3, 1.0), g)
        if w in BOWS:
            # The bow is in the left hand: an arc of wood, its string.
            gb = lib.empty("bowgrip", (0.112, 0, hz), self.handL)
            L = BOWS[w]
            for k in range(7):
                a = (k / 6 - 0.5) * math.pi * 0.7
                lib.box(f"bowseg{k}", (0.012, 0.012, L / 6.5), (0.112, -math.cos(a) * 0.06, hz + math.sin(a) * L / 2), wood, gb, rot=(-a, 0, 0))
            lib.box("string", (0.003, 0.003, L * 0.95), (0.112, 0.0, hz), lib.mat("string", (0.9, 0.9, 0.85), 0.8), gb)
            self.bowgrip = gb
            g.hide_render = True
        self.grip = g

    def pose(self, anim, t):
        if anim not in ("slash", "thrust", "shoot", "sling", "bless"):
            super().pose(anim, t)
            self.hold(anim)
            return
        self.rest()
        ease = lambda k: 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, k)))  # noqa: E731
        self.stance(10, 16)
        self.shield_up()
        if anim == "slash":
            if t < 0.5:
                a, lean, turn = -40 - 130 * ease(t / 0.5), -5 * ease(t / 0.5), -20 * ease(t / 0.5)
            elif t < 0.68:
                k = ((t - 0.5) / 0.18) ** 2
                a, lean, turn = -170 + 140 * k, -5 + 18 * k, -20 + 35 * k
            else:
                k = ease((t - 0.68) / 0.32)
                a, lean, turn = -30 - 10 * k, 13 - 13 * k, 15 - 15 * k
            self.torso.rotation_euler = (R(lean), 0, R(turn))
            self.arms["R"].rotation_euler = (R(a), 0, R(12))
            self.elbows["R"].rotation_euler = (R(-15), 0, 0)
            self.grip.rotation_euler = (R(80), 0, 0)
        elif anim == "thrust":
            k = math.sin(math.pi * min(1.0, t / 0.6)) if t < 0.6 else 0.0
            self.torso.rotation_euler = (R(4 + 10 * k), 0, R(-10 + 10 * k))
            arm = -70 - 10 * k
            self.arms["R"].rotation_euler = (R(arm), 0, R(10 - 8 * k))
            self.elbows["R"].rotation_euler = (R(-50 + 45 * k), 0, 0)
            self.grip.rotation_euler = (R(-arm - (-50 + 45 * k) - 90), 0, 0)
        elif anim == "shoot":
            # The bow held out, the string drawn to the cheek, then loosed.
            draw = ease(t / 0.55) if t < 0.55 else (1.0 if t < 0.7 else 1 - ease((t - 0.7) / 0.3))
            self.torso.rotation_euler = (0, 0, R(-25))
            self.arms["L"].rotation_euler = (R(-88), 0, R(-8))
            self.elbows["L"].rotation_euler = (R(-4), 0, 0)
            self.arms["R"].rotation_euler = (R(-88 + 5 * draw), 0, R(-10 - 25 * draw))
            self.elbows["R"].rotation_euler = (R(-20 - 120 * draw), 0, 0)
            if hasattr(self, "bowgrip"):
                self.bowgrip.rotation_euler = (R(88 + 4), 0, 0)
        elif anim == "sling":
            if t < 0.6:
                spin = 360 * 2 * t / 0.6
                self.arms["R"].rotation_euler = (R(-150), 0, R(spin))
                self.elbows["R"].rotation_euler = (R(-20), 0, 0)
            else:
                k = ease((t - 0.6) / 0.25)
                self.arms["R"].rotation_euler = (R(-150 + 100 * k), 0, 0)
                self.torso.rotation_euler = (R(10 * k), 0, 0)
        elif anim == "bless":
            up = math.sin(math.pi * t)
            for side, z in (("L", -20), ("R", 20)):
                self.arms[side].rotation_euler = (R(-40 - 120 * up), 0, R(z))
                self.elbows[side].rotation_euler = (R(-10), 0, 0)
            self.neck.rotation_euler = (R(-15 * up), 0, 0)

    def shield_up(self):
        if self.shield_kind != "none":
            # Held before the body, upright whatever the arm does.
            self.arms["L"].rotation_euler = (R(-50), 0, R(-25))
            self.elbows["L"].rotation_euler = (R(-50), 0, 0)
            self.shield.rotation_euler = (R(100), 0, R(25))

    def hold(self, anim):
        """How the weapon is carried standing and walking."""
        self.shield_up()
        w = self.weapon
        if w in SPEARS or w == "staff":
            # Upright at the side: the arm and forearm turn the shaft 82 degrees; the grip turns it the rest.
            self.arms["R"].rotation_euler = (R(-12), R(8), 0)
            self.elbows["R"].rotation_euler = (R(-70), 0, 0)
            self.grip.rotation_euler = (R(-8), 0, 0)
        elif w in BOWS:
            self.arms["L"].rotation_euler = (R(-25), 0, R(-6))
            self.elbows["L"].rotation_euler = (R(-30), 0, 0)
            if hasattr(self, "bowgrip"):
                self.bowgrip.rotation_euler = (R(55), 0, 0)
        else:
            self.grip.rotation_euler = (R(60), 0, 0)


class Horse(animals.Quadruped):
    BODY = (0.14, 1.75, 0.85)
    HIGH = 0.42
    LEG = (0.035, 0.2, 0.18)
    SPREAD = (0.06, 0.17)
    GAIT = 34

    def __init__(self, coat=(0.42, 0.28, 0.16), armored=False):
        super().__init__(lib.mat(f"horse{coat}", coat, 0.7))
        if armored:
            lib.ball("barding", 0.15, (0, 0, self.HIGH + 0.01), lib.mat("barding", (0.55, 0.56, 0.6), 0.4, 0.8), self.body, scale=(1.02, 1.7, 0.8), sub=3)
        lib.box("saddle", (0.16, 0.16, 0.03), (0, 0.0, self.HIGH + 0.12), lib.team_mat("teamcloth"), self.body)

    def head(self):
        n, c = self.neck, self.coat
        y, z = -0.24, self.HIGH + 0.1
        lib.cyl("neckc", 0.06, 0.24, (0, y + 0.02, z + 0.08), c, n, rot=(R(-35), 0, 0), r2=0.045)
        lib.ball("head", 0.055, (0, y - 0.1, z + 0.2), c, n, scale=(0.75, 1.7, 0.8))
        lib.box("mane", (0.02, 0.18, 0.04), (0, y + 0.03, z + 0.2), lib.mat("mane", (0.15, 0.1, 0.06), 0.9), n, rot=(R(-35), 0, 0))
        lib.cyl("tail", 0.03, 0.26, (0, 0.27, self.HIGH - 0.02), lib.mat("mane", (0.15, 0.1, 0.06), 0.9), self.tail, rot=(R(-25), 0, 0), r2=0.015)

    def pose(self, anim, t):
        super().pose("walk" if anim in ("walk",) else "idle", t)
        if anim == "walk":
            # A gallop: front legs together, back legs together, the body rocking.
            s = math.sin(2 * math.pi * t)
            self.body.location = (0, 0, self.HIGH + 0.03 * max(0.0, s))
            self.body.rotation_euler = (R(5 * math.cos(2 * math.pi * t)), 0, 0)
            for k, phase in (("FL", 0), ("FR", 0.3), ("BL", math.pi), ("BR", math.pi + 0.3)):
                a = math.sin(2 * math.pi * t + phase)
                self.legs[k].rotation_euler = (R(-38 * a), 0, 0)
                self.knees[k].rotation_euler = (R((35 if k[0] == "F" else -35) * max(0.0, -a)), 0, 0)


class Camel(Horse):
    BODY = (0.15, 1.6, 0.8)
    HIGH = 0.5
    LEG = (0.03, 0.24, 0.22)

    def __init__(self):
        super().__init__((0.78, 0.62, 0.40))
        lib.ball("hump", 0.1, (0, 0.04, self.HIGH + 0.12), self.coat, self.body, scale=(0.9, 1.2, 0.9))


def mounted(unit, mount):
    """A rider on a horse, camel or elephant; poses go to both."""
    rider = Soldier(unit)
    seat = {"horse": (0, 0.02, Horse.HIGH + 0.02), "camel": (0, 0.1, Camel.HIGH + 0.12), "elephant": animals.Elephant.SEAT}[mount]
    if mount == "horse":
        beast = Horse(armored=unit == "cataphract")
    elif mount == "camel":
        beast = Camel()
    else:
        beast = animals.Elephant()
        h = beast.HIGH
        # A saddle cloth in the player's colour over the back, under whatever else it carries.
        lib.ball("saddlecloth", 0.37, (0, -0.05, h + 0.02), lib.team_mat("teamcloth"), beast.body, scale=(0.86, 1.2, 0.95), sub=3)
        if unit == "armored_elephant":
            barding = lib.mat("barding", (0.55, 0.56, 0.6), 0.4, 0.8)
            lib.ball("plates", 0.38, (0, -0.02, h + 0.0), barding, beast.body, scale=(0.86, 1.45, 0.94), sub=3)
            lib.ball("headplate", 0.17, (0, -0.8, h + 0.36), barding, beast.body, scale=(1.0, 0.6, 0.7), sub=2)
        if unit == "elephant_archer":
            wood = lib.mat("wood", WOOD, 0.7)
            lib.box("howdah", (0.46, 0.5, 0.2), (0, 0.02, beast.TOP + 0.1), wood, beast.body, bevel=0.02)
            lib.box("howdahcloth", (0.5, 0.54, 0.08), (0, 0.02, beast.TOP + 0.0), lib.team_mat("teamcloth"), beast.body)
            for x in (-0.2, 0.2):
                for y in (-0.22, 0.26):
                    lib.cyl(f"howdahpost{x}{y}", 0.015, 0.22, (x, y, beast.TOP + 0.3), wood, beast.body, verts=6)
            seat = (0, 0.02, beast.TOP + 0.12)
    # The rider sits: legs forward and apart, the figure lowered onto the saddle.
    rider.root.location = (seat[0], seat[1], seat[2] - 0.42)
    lib.adopt(rider.root, beast.body)
    return Mount(rider, beast)


class Mount:
    def __init__(self, rider, beast):
        self.rider, self.beast = rider, beast

    def face(self, angle):
        self.beast.face(angle)

    def pose(self, anim, t):
        self.beast.pose("walk" if anim == "walk" else "idle", t)
        self.rider.pose(anim if anim != "walk" else "idle", t)
        for side, k in (("L", 1), ("R", -1)):
            self.rider.legs[side].rotation_euler = (R(-70), R(25 * k), 0)
            self.rider.knees[side].rotation_euler = (R(80), 0, 0)


class Chariot:
    """A two-wheeled car behind a horse, its driver standing in it; with scythes on the wheels if so."""

    def __init__(self, unit):
        self.beast = Horse()
        wood = lib.mat("wood", WOOD, 0.7)
        car = lib.empty("car", (0, 0.42, 0), self.beast.root)
        lib.box("bed", (0.32, 0.26, 0.04), (0, 0.42, 0.24), wood, car, bevel=0.01)
        lib.box("front", (0.32, 0.03, 0.18), (0, 0.29, 0.34), lib.team_mat("teamcloth"), car)
        lib.cyl("pole", 0.015, 0.5, (0, 0.1, 0.32), wood, car, rot=(R(90), 0, 0))
        self.wheels = []
        for x in (0.2, -0.2):
            w = lib.cyl(f"wheel{x}", 0.17, 0.03, (x, 0.42, 0.17), wood, car, rot=(0, R(90), 0), verts=12)
            self.wheels.append(w)
            if unit == "scythe_chariot":
                lib.box(f"scythe{x}", (0.22, 0.015, 0.02), (x * 1.6, 0.42, 0.17), lib.mat("blade", (0.8, 0.8, 0.82), 0.25, 0.9), car)
        self.rider = Soldier(unit)
        self.rider.root.location = (0, 0.42, 0.24)
        lib.adopt(self.rider.root, car)

    def face(self, angle):
        self.beast.face(angle)

    def pose(self, anim, t):
        self.beast.pose("walk" if anim == "walk" else "idle", t)
        self.rider.pose(anim if anim != "walk" else "idle", t)
        for w in self.wheels:
            w.rotation_euler = (R(-360 * t if anim == "walk" else 0), R(90), 0)
