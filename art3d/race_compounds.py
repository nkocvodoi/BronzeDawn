# The fantasy races' buildings as compounds (replica/fantasy-art-plan.md, approved 2026-10-16): each one a main
# building with the smaller ones and the yard about it, and the things of its trade, in the race's own
# materials, a step richer with each age. The race's shapes (a hall, a hut, a tower, a fence) are its Kit's in
# race_buildings.py; the props shared with everyone's buildings (wells, racks, horses, logs) are buildings.py's.
#
# As buildings.py: one unit is one tile, tiles from -size/2 to size/2, the front toward the viewer (+X, -Y).
# Keep the front corners and the edge toward the viewer low, so the building stays in view.

import math

import lib
import buildings as B

R = math.radians


# ---- each race's own things, besides its Kit's

def pick(k, **by):
    """The Kit's material named for the race: pick(k, elf="live", dwarf="stone", ...)."""
    return getattr(k, by[k.race])


def light(k, name, x, y, z, r=0.035):
    from race_buildings import LIGHT
    lib.ball(name, r, (x, y, z), lib.mat(f"{k.race}-glow", LIGHT[k.race], 1.0, emit=LIGHT[k.race]), sub=1)


def lamp(k, name, x, y, h=0.38):
    """A light on a post: a moonstone on a curled branch, a brazier, a lantern on an arm, a torch."""
    if k.race == "elf":
        lib.cyl(f"{name}-post", 0.014, h, (x, y, h / 2), k.bark, verts=6, r2=0.008)
        lib.cyl(f"{name}-curl", 0.01, 0.12, (x + 0.04, y, h), k.bark, rot=(0, R(60), 0), verts=5)
        light(k, f"{name}-stone", x + 0.08, y, h - 0.03, 0.03)
    elif k.race == "dwarf":
        lib.cyl(f"{name}-post", 0.03, h * 0.7, (x, y, h * 0.35), k.dstone, verts=8)
        lib.cyl(f"{name}-bowl", 0.06, 0.05, (x, y, h * 0.7 + 0.02), k.bronze, verts=10, r2=0.04)
        light(k, f"{name}-coal", x, y, h * 0.7 + 0.05, 0.04)
    elif k.race == "centaur":
        lib.cyl(f"{name}-pole", 0.012, h, (x, y, h / 2), k.wood, verts=6)
        lib.box(f"{name}-arm", (0.09, 0.012, 0.012), (x + 0.04, y, h - 0.02), k.wood)
        lib.cyl(f"{name}-cage", 0.025, 0.05, (x + 0.08, y, h - 0.06), k.gold, verts=6)
        light(k, f"{name}-flame", x + 0.08, y, h - 0.06, 0.02)
    else:
        lib.cyl(f"{name}-post", 0.02, h, (x, y, h / 2), k.wood, verts=6)
        lib.ball(f"{name}-wrap", 0.035, (x, y, h), k.hide2, scale=(1, 1, 1.4), sub=1)
        light(k, f"{name}-fire", x, y, h + 0.05, 0.035)


def statue(k, name, x, y, h=0.5):
    """A figure on a plinth in the race's manner: an elf archer of living wood, a dwarf miner of granite, a
    centaur of bronze, a beast-headed warrior carved in wood."""
    m = pick(k, elf="live", dwarf="stone", centaur="gold", beastfolk="wood")
    plinth = pick(k, elf="paving", dwarf="dstone", centaur="canvas2", beastfolk="mud")
    lib.box(f"{name}-plinth", (0.18, 0.18, 0.12), (x, y, 0.06), plinth, bevel=0.01)
    if k.race == "centaur":
        lib.ball(f"{name}-horse", 0.09, (x, y, 0.24), m, scale=(1.4, 0.7, 0.7), sub=2)
        for dx in (-0.08, 0.08):
            lib.cyl(f"{name}-leg{dx}", 0.015, 0.1, (x + dx, y, 0.16), m, verts=6)
        lib.cyl(f"{name}-torso", 0.04, h * 0.4, (x + 0.08, y, 0.3 + h * 0.2), m, verts=8)
        lib.ball(f"{name}-head", 0.035, (x + 0.08, y, 0.32 + h * 0.42), m, sub=1)
        return
    lib.cyl(f"{name}-body", 0.05 if k.race != "dwarf" else 0.07, h * 0.62, (x, y, 0.12 + h * 0.31), m, verts=10, r2=0.04)
    lib.ball(f"{name}-head", 0.04 if k.race != "beastfolk" else 0.05, (x, y, 0.12 + h * 0.7), m, sub=1)
    if k.race == "elf":
        lib.cyl(f"{name}-bow", 0.008, h * 0.6, (x + 0.06, y, 0.12 + h * 0.4), k.bark, verts=5, rot=(0, R(10), 0))
    elif k.race == "dwarf":
        lib.ball(f"{name}-beard", 0.04, (x, y - 0.04, 0.12 + h * 0.58), m, scale=(1, 0.7, 1.4), sub=1)
        lib.cyl(f"{name}-pick", 0.008, 0.28, (x + 0.07, y, 0.12 + h * 0.45), k.wood, verts=5, rot=(0, R(30), 0))
    else:
        for s in (-1, 1):
            lib.cyl(f"{name}-ear{s}", 0.015, 0.05, (x + s * 0.03, y, 0.12 + h * 0.78), m, verts=4, r2=0.002)


def banners(k, x0, x1, y, z, n=2):
    for i in range(n):
        k.banner(x0 + (x1 - x0) * i / max(1, n - 1), y, z, 0.12, 0.18)


def thing_of(k, name, x, y, what):
    """Race-flavoured versions of the yard's things."""
    if what == "store":
        if k.race == "elf":
            lib.cyl(f"{name}", 0.06, 0.12, (x, y, 0.06), k.bark, verts=10)  # a woven basket
            lib.ball(f"{name}-fruit", 0.05, (x, y, 0.13), lib.mat("fruit", (0.80, 0.26, 0.30), 0.6), sub=1)
        elif k.race == "dwarf":
            lib.cyl(f"{name}", 0.05, 0.11, (x, y, 0.055), k.wood, verts=12)
            lib.cyl(f"{name}-hoop", 0.052, 0.012, (x, y, 0.08), k.bronze, verts=12)
        elif k.race == "centaur":
            lib.ball(f"{name}", 0.05, (x, y, 0.05), k.canvas2, scale=(1, 1, 1.3), sub=1)
        else:
            lib.ball(f"{name}", 0.05, (x, y, 0.04), k.hide, scale=(1, 1, 0.8), sub=1)


# ---- the compounds

def town_center(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "elf":
        top = k.great_tree(0.2, 0.35, 1.3 + 0.3 * t, 0.85 + 0.12 * t)
        # A stair round the trunk, a hut in its roots, a hanging bridge to a smaller tree (Iron).
        for i in range(8):
            a = R(45 * i)
            lib.box(f"tc-stair{i}", (0.16, 0.08, 0.025), (0.2 + math.cos(a) * 0.42, 0.35 + math.sin(a) * 0.42, 0.12 + i * 0.07), k.live, rot=(0, 0, a))
        k.hut("tc-roothut", -0.85, -0.45, 0.28, 0.35)
        if t >= 2:
            k.hut("tc-hut2", 0.95, -0.55, 0.24, 0.3)
        if t >= 3:
            lib.cyl("tc-silver", 0.95, 0.04, (0.2, 0.35, 1.3 + 0.3 * t * 0.72 + 0.09), lib.mat("silver", (0.86, 0.88, 0.92), 0.3, 0.9), verts=24)
            k.tower("tc-little", -0.95, 0.9, 0.9)
            for j in range(5):
                lib.box(f"tc-bridge{j}", (0.12, 0.1, 0.02), (-0.75 + j * 0.2, 0.75 - j * 0.08, 0.8 + 0.05 * math.sin(j)), k.live)
        lib.cyl("tc-spring", 0.22, 0.03, (0.95, 0.85, 0.015), lib.mat("spring", (0.30, 0.55, 0.62), 0.1), verts=16)
        for i in range(4):
            lamp(k, f"tc-lamp{i}", -1.2 + i * 0.75, -1.25)
    elif k.race == "dwarf":
        k.mountain(0.25, 0.85, 2.3, 1.35 + 0.25 * t)
        top = k.hall("tc", -0.15, -0.05, 1.5, 1.0, 0.55 + 0.1 * t)
        # Miners carved either side of the door, rails coming out of it to a heap of ore.
        for x in (-0.75, 0.45):
            statue(k, f"tc-miner{x}", x, -0.7, 0.55 + 0.1 * t)
        for s in (-0.06, 0.06):
            lib.box(f"tc-rail{s}", (0.02, 0.9, 0.015), (-0.15 + s, -0.95, 0.01), lib.mat("ironrail", (0.30, 0.30, 0.32), 0.4, 0.8))
        for j in range(5):
            lib.box(f"tc-sleeper{j}", (0.2, 0.04, 0.015), (-0.15, -0.6 - j * 0.18, 0.006), k.wood)
        B.ore_heap(0.85, -0.95, "tc-ore", 0.18)
        B.log_pile(-1.0, -1.1, 4, "tc-logs")
        if t >= 2:
            k.tower("tc-tower", 1.05, -0.2, 0.75 + 0.2 * t)
        if t >= 3:
            k.tower("tc-tower2", -1.1, 0.2, 0.95)
            lib.box("tc-gate", (0.38, 0.05, 0.42), (-0.15, -0.58, 0.21), k.bronze)
        for x in (-0.45, 0.15):
            lamp(k, f"tc-lamp{x}", x, -0.75)
    elif k.race == "centaur":
        if t >= 3:
            # A round platform of white stone under a stretched canvas roof, a sundial before it.
            lib.cyl("tc-dais", 1.0, 0.16, (-0.1, 0.3, 0.08), k.canvas2, verts=24)
            for i in range(10):
                a = R(36 * i)
                lib.cyl(f"tc-col{i}", 0.04, 0.8, (-0.1 + math.cos(a) * 0.85, 0.3 + math.sin(a) * 0.85, 0.56), k.canvas2, verts=10)
            lib.cyl("tc-roof", 1.05, 0.4, (-0.1, 0.3, 1.16), k.canvas, verts=20, r2=0.1)
            lib.cyl("tc-sundial", 0.18, 0.04, (0.95, -0.95, 0.02), k.canvas2, verts=16)
            lib.cyl("tc-gnomon", 0.012, 0.18, (0.95, -0.95, 0.1), k.gold, verts=5, rot=(R(30), 0, 0))
        else:
            k.hut("tc-yurt", -0.15, 0.35, 0.7 + 0.08 * t, 0.55 + 0.08 * t)
        # The camp round it: small tents, a fire, a cart, horse-tail standards.
        for i, (x, y) in enumerate(((1.0, 0.6), (-1.05, 0.75), (0.95, -0.55))):
            k.hut(f"tc-tent{i}", x, y, 0.24, 0.32)
        lib.box("tc-cart", (0.4, 0.22, 0.12), (-0.85, -0.85, 0.12), k.wood, bevel=0.01)
        for s in (-1, 1):
            lib.cyl(f"tc-wheel{s}", 0.09, 0.03, (-0.85, -0.85 + s * 0.13, 0.09), k.wood, rot=(R(90), 0, 0), verts=12)
        for x in (-0.3, 0.35):
            lib.cyl(f"tc-standard{x}", 0.012, 1.0, (x, -0.95, 0.5), k.wood, verts=6)
            lib.cyl(f"tc-tail{x}", 0.03, 0.25, (x, -0.95, 0.85), lib.mat("horsehair", (0.20, 0.14, 0.10), 0.9), verts=8, r2=0.01)
        lamp(k, "tc-lamp", 0.4, -0.5)
    else:
        k.hall("tc", -0.2, 0.35, 1.9, 1.15, 0.8 + 0.1 * t)
        # A wolf's head carved at the gable, a totem, a fire, a rack of meat and hides.
        lib.ball("tc-wolf", 0.14, (-1.2, 0.35, 1.0 + 0.1 * t), k.wood, scale=(1.3, 0.8, 0.8), sub=2)
        k.totem("tc-totem", 0.95, -0.35, 1.0 + 0.25 * t)
        k.hut("tc-tent", -1.0, -0.6, 0.3, 0.5)
        B.hide_rack(0.3, -0.95, "tc-hides")
        lamp(k, "tc-fire", -0.2, -0.85, 0.08)
        if t >= 3:
            for i in range(7):
                a = R(-160 + 25 * i)
                lib.box(f"tc-menhir{i}", (0.1, 0.08, 0.35 + 0.1 * (i % 2)), (math.cos(a) * 1.3, 0.2 + math.sin(a) * 1.2, 0.18), lib.mat("menhir", (0.52, 0.50, 0.46), 0.95, grain=0.35))
            lib.ball("tc-mammoth", 0.22, (0.95, 0.95, 0.25), k.bone, scale=(1, 1.2, 0.8), sub=2)
        k.fence(-1.4, 1.35, 1.4, 1.35)
    k.flag(1.2, 1.15, 1.3 + 0.2 * t)
    banners(k, -0.6, 0.2, -0.3 if k.race != "dwarf" else -0.56, 0.35)


def house(k):
    t = k.tier
    k.ground(2, k.yard)
    if k.race == "elf":
        lib.cyl("h-stump", 0.36, 0.25 + 0.05 * t, (0, 0.1, 0.12), k.bark, verts=14, r2=0.32)
        k.hut("house", 0, 0.1, 0.34 + 0.03 * t, 0.3 + 0.06 * t)
        for i in range(5):
            lib.box(f"h-rung{i}", (0.1, 0.012, 0.012), (0.36, -0.12, 0.05 + i * 0.08), k.bark)
        lamp(k, "h-lamp", -0.55, -0.55, 0.3)
        thing_of(k, "h-basket", 0.55, -0.55, "store")
    elif k.race == "dwarf":
        rock = lib.ball("h-rock", 0.45, (0.1, 0.45, 0.25), k.rock, scale=(1.3, 1, 0.9), sub=3)
        lib.lumpy(rock, 0.05, 0.1, 3)
        k.hall("house", 0, 0.0, 0.9, 0.7, 0.36 + 0.06 * t)
        thing_of(k, "h-barrel", 0.5, -0.5, "store")
        lib.cyl("h-axe", 0.01, 0.3, (-0.48, -0.36, 0.2), k.wood, verts=5, rot=(0, R(15), 0))
    elif k.race == "centaur":
        k.hut("house", 0, 0.1, 0.48 + 0.04 * t, 0.42 + 0.06 * t)
        lib.box("h-rug", (0.3, 0.2, 0.008), (0.45, -0.5, 0.004), k.sky)
        thing_of(k, "h-jar", -0.5, -0.5, "store")
        if t >= 2:
            lib.box("h-door", (0.16, 0.02, 0.26), (0, -0.39, 0.13), lib.mat("carveddoor", (0.56, 0.30, 0.14), 0.7))
    else:
        if t <= 1:
            k.hut("house", 0, 0.1, 0.5, 0.5 + 0.05 * t)
        else:
            lib.box("h-pit", (0.95, 0.75, 0.22), (0, 0.1, 0.11), k.mud, bevel=0.04)
            r = B.prism("h-roof", 1.05, 0.85, 0.42, (0, 0.1, 0.22), k.thatch, "x")
            lib.lumpy(r, 0.015, 0.04)
        for s in (-1, 1):
            lib.cyl(f"h-horn{s}", 0.02, 0.18, (s * 0.1, -0.42, 0.42 + 0.05 * t), k.bone, rot=(R(30 * s), 0, 0), verts=5, r2=0.004)
        for i in range(3):
            lib.cyl(f"h-bone{i}", 0.01, 0.1, (0.5 + i * 0.03, -0.55, 0.01), k.bone, rot=(0, R(90), i), verts=5)
    k.banner(-0.45, -0.5 if k.race != "dwarf" else -0.36, 0.22, 0.1, 0.14)


def granary(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "elf":
        # Stores hung under a crown, baskets on a rack of branches.
        k.great_tree(0.2, 0.45, 1.1 + 0.15 * t, 0.7)
        for i, (x, y) in enumerate(((-0.25, 0.4), (0.55, 0.25), (0.15, 0.8))):
            lib.cyl(f"g-rope{i}", 0.006, 0.35, (x, y, 0.85 + 0.15 * t), k.bark, verts=4)
            lib.ball(f"g-pod{i}", 0.13, (x, y, 0.6 + 0.15 * t), k.live, scale=(1, 1, 1.3), sub=2)
        for i in range(4):
            lib.cyl(f"g-rackpost{i}", 0.012, 0.35, (-0.9 + i * 0.3, -0.8, 0.17), k.bark, verts=5)
        lib.box("g-rackbar", (0.95, 0.02, 0.02), (-0.45, -0.8, 0.33), k.bark)
        for i in range(5):
            thing_of(k, f"g-basket{i}", -1.0 + i * 0.25, -1.05, "store")
    elif k.race == "dwarf":
        lib.box("g-hatchframe", (1.0, 0.7, 0.12), (-0.2, 0.35, 0.06), k.dstone, bevel=0.02)
        lib.box("g-hatch", (0.8, 0.5, 0.03), (-0.2, 0.35, 0.13), k.wood, rot=(R(-20), 0, 0))
        k.hall("granary", 0.5, 0.75, 1.0, 0.6, 0.4 + 0.06 * t)
        for i in range(6):
            thing_of(k, f"g-barrel{i}", -0.95 + (i % 3) * 0.13, -0.6 - (i // 3) * 0.13, "store")
        sack = lib.mat("sack", (0.80, 0.70, 0.48), 0.9)
        for j in range(4):
            lib.ball(f"g-sack{j}", 0.07, (0.4 + 0.16 * j, -0.85, 0.06), sack, scale=(1, 1, 1.2), sub=1)
        lamp(k, "g-lamp", 0.95, -0.25)
    elif k.race == "centaur":
        for i, (x, y) in enumerate(((-0.5, 0.45), (0.45, 0.6), (0.85, -0.2))):
            k.hut(f"g-tent{i}", x, y, 0.32, 0.38 + 0.04 * t)
        hay = lib.mat("hay", (0.86, 0.74, 0.40), 0.95, grain=0.4, grain_size=0.01)
        for j in range(3):
            lib.ball(f"g-hay{j}", 0.15, (-0.85 + j * 0.3, -0.55, 0.08), hay, scale=(1.2, 1, 0.6), sub=2)
        for j in range(5):
            thing_of(k, f"g-sack{j}", -0.3 + j * 0.15, -1.0, "store")
    else:
        # Drying racks of meat and fruit, a pit lidded with hide.
        for r in range(2):
            for i in range(3):
                lib.cyl(f"g-post{r}{i}", 0.02, 0.6, (-0.8 + i * 0.5, 0.2 + r * 0.6, 0.3), k.wood, verts=5)
            lib.cyl(f"g-bar{r}", 0.015, 1.1, (-0.3, 0.2 + r * 0.6, 0.58), k.wood, rot=(0, R(90), 0), verts=5)
            for j in range(6):
                lib.ball(f"g-meat{r}{j}", 0.04, (-0.75 + j * 0.18, 0.2 + r * 0.6, 0.48), lib.mat("meat", (0.56, 0.22, 0.16), 0.7), scale=(0.8, 0.8, 1.4), sub=1)
        lib.cyl("g-pit", 0.3, 0.03, (0.75, -0.6, 0.015), k.hide2, verts=14)
        k.hut("g-tent", 0.8, 0.6, 0.32, 0.45)
        for j in range(3):
            k.skull(-0.6 + j * 0.3, -1.05, 0.04)
    k.flag(1.2, -1.2, 0.8)


def storage_pit(k):
    t = k.tier
    k.ground(3, k.yard)
    # An open yard first: logs, cut stone, ore, under a shelter of the race's kind.
    B.log_pile(0.65, -0.6, 6 + t, "sp-logs")
    B.stone_blocks(-0.85, -0.95, "sp-blocks")
    B.ore_heap(0.95, 0.35, "sp-gold", 0.15)
    if k.race == "elf":
        k.hall("sp", -0.4, 0.5, 1.2, 0.9, 0.45 + 0.05 * t)
        lib.box("sp-bench", (0.5, 0.18, 0.12), (-0.35, -0.35, 0.06), k.live, bevel=0.02)
        for i in range(3):
            lib.cyl(f"sp-bow{i}", 0.008, 0.4, (-0.5 + i * 0.12, -0.35, 0.3), k.bark, verts=5, rot=(0, R(20), 0))
    elif k.race == "dwarf":
        k.hall("sp", -0.4, 0.55, 1.3, 0.9, 0.5 + 0.05 * t)
        lib.box("sp-cart", (0.25, 0.16, 0.1), (0.1, -0.95, 0.07), k.wood, bevel=0.01)
        for j in range(4):
            lib.box(f"sp-ingot{j}", (0.1, 0.05, 0.035), (-0.3 + j * 0.11, -0.45, 0.02), k.bronze if t < 3 else lib.mat("ironingot", (0.40, 0.40, 0.44), 0.4, 0.8))
        if t >= 2:
            B.crane(k, 1.0, 0.95, 0.9, "sp-crane")
    elif k.race == "centaur":
        (k.pavilion if t >= 2 else k.hall)("sp", -0.4, 0.5, 1.3, 0.9, 0.5 + 0.05 * t)
        lib.box("sp-cart", (0.4, 0.22, 0.12), (0.1, -1.0, 0.12), k.wood, bevel=0.01)
        B.hide_rack(-0.4, -0.35, "sp-hides")
    else:
        k.hut("sp", -0.4, 0.5, 0.5, 0.6 + 0.05 * t)
        B.hide_rack(-0.3, -0.35, "sp-hides")
        for j in range(4):
            lib.cyl(f"sp-bone{j}", 0.015, 0.25, (0.1 + j * 0.06, -1.0, 0.015), k.bone, rot=(0, R(90), j * 0.4), verts=5)
    if k.race in ("dwarf", "centaur") or t >= 2:
        k.fence(-1.4, 1.35, 1.4, 1.35)
    k.flag(1.15, 1.0, 0.8)


def barracks(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "elf":
        k.hall("bar", -0.3, 0.55, 1.8, 0.9, 0.5 + 0.07 * t)
        # An arch of grown branches over the way in.
        for s in (-1, 1):
            lib.cyl(f"bar-arch{s}", 0.03, 0.7, (0.75 + s * 0.25, -0.95, 0.35), k.bark, verts=6, rot=(0, R(-12 * s), 0))
        lib.lumpy(lib.ball("bar-archtop", 0.18, (0.75, -0.95, 0.72), k.leaf2, scale=(1.6, 0.6, 0.6), sub=2), 0.03, 0.08)
    elif k.race == "dwarf":
        k.mountain(0.4, 1.0, 1.6, 0.9 + 0.15 * t)
        k.hall("bar", -0.25, 0.35, 1.8, 0.9, 0.55 + 0.08 * t)
        k.fence(-1.35, -1.35, -1.35, 0.6)
    elif k.race == "centaur":
        (k.pavilion if t >= 2 else k.hall)("bar", -0.25, 0.55, 1.9, 0.85, 0.6 + 0.08 * t)
        # A ring to run round, posts with straw riders.
        lib.cyl("bar-ring", 0.55, 0.01, (0.55, -0.6, 0.005), lib.mat("track", (0.44, 0.36, 0.24), 1.0), verts=24)
    else:
        # A wrestling ring fenced with bones, a longhouse behind.
        k.hall("bar", -0.3, 0.6, 1.8, 0.85, 0.6 + 0.08 * t)
        for i in range(12):
            a = R(30 * i)
            lib.cyl(f"bar-ringbone{i}", 0.02, 0.22, (0.45 + math.cos(a) * 0.45, -0.55 + math.sin(a) * 0.4, 0.11), k.bone, verts=5, r2=0.004)
        k.totem("bar-totem", -1.05, -0.8, 0.9 + 0.15 * t)
    B.weapon_rack(k, 0.95, 0.25, "bar-rack", along_x=False, shields=2 + (t >= 2))
    B.dummy(k, -0.55 if k.race != "beastfolk" else 0.45, -0.8 if k.race != "beastfolk" else -0.55, "bar-dummy")
    if t >= 2:
        B.dummy(k, -0.15, -1.05, "bar-dummy2")
    lamp(k, "bar-lamp", 1.1, -1.1)
    k.flag(1.15, 1.1, 1.0 + 0.1 * t)


def dock(k):
    from race_buildings import dock as plain
    plain(k)
    # Nets drying and baskets of fish on the deck, a little boat of the race's kind tied alongside.
    net = lib.mat("net", (0.62, 0.56, 0.42), 0.9, grain=0.3)
    for i in range(3):
        lib.cyl(f"d-netpost{i}", 0.012, 0.35, (-1.1 + i * 0.3, -0.9, 0.33), k.wood, verts=5)
    lib.box("d-net", (0.62, 0.01, 0.22), (-0.8, -0.9, 0.38), net)
    for j in range(3):
        thing_of(k, f"d-fish{j}", 0.2 + j * 0.15, -1.05, "store")
    hull = pick(k, elf="live", dwarf="wood", centaur="canvas2", beastfolk="wood")
    lib.ball("d-boat", 0.2, (1.55, -0.6, 0.1), hull, scale=(2.2, 0.8, 0.45), sub=2)


def archery_range(k):
    t = k.tier
    k.ground(3, k.yard)
    straw = lib.mat("straw", (0.82, 0.70, 0.38), 0.95, grain=0.4, grain_size=0.01)
    # The shooting line at the left, targets along the right; a shelter for the archers.
    if k.race == "elf":
        statue(k, "ar-goddess", -0.55, 0.5, 0.8 + 0.1 * t)
        for y in (-1.2, 1.2):
            for i in range(3):
                lib.lumpy(lib.ball(f"ar-tree{y}{i}", 0.2, (-1.0 + i * 0.9, y, 0.45), k.leaf if i % 2 else k.leaf2, scale=(1, 1, 1.2), sub=2), 0.04, 0.1)
                lib.cyl(f"ar-trunk{y}{i}", 0.04, 0.3, (-1.0 + i * 0.9, y, 0.15), k.bark, verts=6)
    elif k.race == "dwarf":
        k.hall("ar", -0.6, 0.6, 1.1, 0.9, 0.45 + 0.05 * t)
        lib.box("ar-trench", (0.4, 2.2, 0.02), (0.2, 0.0, 0.01), k.dstone)
        B.weapon_rack(k, -0.6, -0.5, "ar-crossbows", shields=0)
    elif k.race == "centaur":
        (k.pavilion if t >= 2 else k.hall)("ar", -0.7, 0.6, 1.0, 0.8, 0.55)
        lib.cyl("ar-track", 0.9, 0.01, (0.2, -0.2, 0.005), lib.mat("track", (0.44, 0.36, 0.24), 1.0), verts=28)
    else:
        k.hut("ar", -0.7, 0.6, 0.45, 0.55)
        for j in range(5):
            lib.cyl(f"ar-spear{j}", 0.01, 0.55, (-0.9 + j * 0.08, -0.5, 0.27), k.wood, verts=5, rot=(R(-8), 0, 0))
    for j, y in enumerate((-0.6, 0.15, 0.9)):
        if k.race == "elf":
            lib.cyl(f"ar-slice{j}", 0.17, 0.06, (1.05, y, 0.25), k.live, rot=(0, R(90), 0), verts=16)
            lib.cyl(f"ar-ring{j}", 0.1, 0.065, (1.05, y, 0.25), k.team, rot=(0, R(90), 0), verts=16)
        elif k.race == "dwarf":
            lib.cyl(f"ar-shield{j}", 0.16, 0.04, (1.05, y, 0.25), k.dstone, rot=(0, R(90), 0), verts=12)
            lib.cyl(f"ar-boss{j}", 0.05, 0.05, (1.03, y, 0.25), k.bronze, rot=(0, R(90), 0), verts=10)
        elif k.race == "beastfolk":
            lib.ball(f"ar-beast{j}", 0.15, (1.05, y, 0.22), straw, scale=(0.8, 1.4, 1), sub=2)
            k.skull(1.0, y - 0.18, 0.3)
        else:
            lib.cyl(f"ar-pole{j}", 0.015, 0.6, (1.05, y, 0.3), k.wood, verts=5)
            lib.cyl(f"ar-target{j}", 0.12, 0.03, (1.03, y, 0.6), k.team, rot=(0, R(90), 0), verts=14)
    lamp(k, "ar-lamp", -1.15, -1.15)
    k.flag(-1.15, 1.1, 1.0)


def stable(k):
    t = k.tier
    k.ground(3, k.yard)
    beast = {"elf": (0.62, 0.48, 0.32), "dwarf": (0.36, 0.34, 0.32), "centaur": (0.48, 0.32, 0.20), "beastfolk": (0.30, 0.30, 0.32)}[k.race]
    (k.pavilion if k.race == "centaur" else k.hall)("st", -0.3, 0.6, 2.0, 0.8, 0.5 + 0.06 * t)
    k.fence(-1.3, -1.25, 1.3, -1.25)
    k.fence(1.3, -1.25, 1.3, 0.2)
    B.trough(-0.6, -0.55, "st-trough")
    hay = lib.mat("hay", (0.86, 0.74, 0.40), 0.95, grain=0.4, grain_size=0.01)
    for j in range(3):
        lib.ball(f"st-hay{j}", 0.13, (0.25 + j * 0.25, -0.35, 0.07), hay, scale=(1.2, 1, 0.6), sub=2)
    # The race's mount (only a picture): an elk, a mountain goat, a horse, a great wolf.
    B.horse("st-mount", 0.75, -0.85, R(15), beast)
    if k.race == "elf":
        for s in (-1, 1):
            lib.cyl(f"st-antler{s}", 0.012, 0.22, (0.9 + 0.03 * s, -0.85, 0.48), lib.mat("antler", (0.86, 0.80, 0.66), 0.7), rot=(0, R(30 * s), 0), verts=5)
    elif k.race == "dwarf":
        for s in (-1, 1):
            lib.cyl(f"st-horn{s}", 0.015, 0.12, (0.9, -0.85 + 0.04 * s, 0.42), k.dstone, rot=(R(40 * s), 0, 0), verts=5)
    lamp(k, "st-lamp", -1.15, 1.05)
    k.flag(1.15, 1.1, 1.0)


def market(k):
    t = k.tier
    k.ground(3, k.yard)
    k.hall("mk", -0.6, 0.65, 1.2, 0.85, 0.5 + 0.06 * t) if k.race != "beastfolk" else k.hut("mk", -0.6, 0.6, 0.45, 0.55)
    if k.race == "elf":
        goods, awning = [lib.mat("silk", (0.40, 0.66, 0.52), 0.6), lib.mat("fruit", (0.80, 0.26, 0.30), 0.6)], None
    elif k.race == "dwarf":
        goods, awning = [k.bronze, lib.mat("gem", (0.30, 0.70, 0.86), 0.2)], k.slate
    elif k.race == "centaur":
        goods, awning = [k.sky, k.canvas2], k.team
    else:
        goods, awning = [k.bone, k.hide2], k.hide
    awning = awning or goods[0]
    for j, (x, y) in enumerate(((0.75, -0.15), (0.0, -0.85), (0.85, -0.95), (-0.85, -0.6))):
        for dx, dy in ((-0.22, -0.16), (0.22, -0.16), (0.22, 0.16), (-0.22, 0.16)):
            lib.cyl(f"mk-post{j}{dx}{dy}", 0.016, 0.4, (x + dx, y + dy, 0.2), k.wood, verts=6)
        lib.box(f"mk-awning{j}", (0.55, 0.42, 0.02), (x, y, 0.41), awning, rot=(R(8), 0, 0))
        lib.box(f"mk-counter{j}", (0.45, 0.26, 0.11), (x, y, 0.055), k.wood, bevel=0.01)
        for i in range(3):
            lib.ball(f"mk-good{j}{i}", 0.04, (x - 0.13 + i * 0.13, y, 0.15), goods[i % 2], scale=(1, 1, 1.1), sub=1)
    if k.race == "dwarf":
        lib.box("mk-anvil", (0.14, 0.07, 0.06), (0.35, -0.45, 0.1), k.dstone)
    lamp(k, "mk-lamp", 0.35, 0.4)
    k.flag(1.2, 1.15, 1.0)


def tower(k, kind):
    from race_buildings import tower as plain
    plain(k, kind)
    k_ = {"watch_tower": 0, "sentry_tower": 1, "guard_tower": 2, "ballista_tower": 3}[kind]
    # A wall or a hedge about its foot, a light at its door, more of them the higher the tower.
    k.fence(-0.85, -0.85, 0.85, -0.85, 0.15 + 0.03 * k_)
    k.fence(0.85, -0.85, 0.85, 0.85, 0.15 + 0.03 * k_)
    lamp(k, "tw-lamp", 0.5, -0.6, 0.3)
    if k_ >= 2:
        lamp(k, "tw-lamp2", -0.6, 0.5, 0.3)


def government_center(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "elf":
        k.great_tree(0.25, 0.5, 1.3 + 0.15 * t, 0.85)
        lib.cyl("gov-deck", 0.9, 0.06, (0.25, 0.5, 0.45), k.live, verts=22)
        for i in range(9):
            a = R(40 * i)
            lib.box(f"gov-seat{i}", (0.16, 0.08, 0.08), (0.25 + math.cos(a) * 0.8, 0.5 + math.sin(a) * 0.8, 0.53), k.paving, rot=(0, 0, a))
    elif k.race == "dwarf":
        k.mountain(0.2, 0.9, 2.4, 1.5 + 0.15 * t)
        k.hall("gov", -0.1, 0.0, 1.7, 1.1, 0.7 + 0.08 * t)
        for x in (-0.85, 0.65):
            lib.cyl(f"gov-pillar{x}", 0.09, 0.85, (x, -0.65, 0.42), k.dstone, verts=8)
            lib.box(f"gov-rune{x}", (0.1, 0.02, 0.1), (x, -0.75, 0.55), lib.mat("runegold", (0.95, 0.78, 0.30), 0.3, 0.9))
    elif k.race == "centaur":
        k.hut("gov", -0.1, 0.35, 0.85, 0.7 + 0.06 * t)
        for i in range(6):
            lib.cyl(f"gov-pole{i}", 0.012, 1.0, (-1.1 + i * 0.44, -1.0, 0.5), k.wood, verts=6)
            lib.box(f"gov-tribe{i}", (0.02, 0.14, 0.1), (-1.1 + i * 0.44, -1.06, 0.92), k.team if i % 2 else k.sky)
    else:
        k.hall("gov", -0.15, 0.4, 2.0, 1.2, 0.75 + 0.08 * t)
        for i in range(5):
            k.totem(f"gov-clan{i}", -1.1 + i * 0.55, -0.9, 0.75 + 0.15 * (i % 2))
        lib.box("gov-throne", (0.3, 0.22, 0.35), (0.85, -0.3, 0.18), k.bone, bevel=0.02)
    statue(k, "gov-statue", 1.05, -0.95 if k.race != "beastfolk" else 1.0, 0.55)
    lamp(k, "gov-lamp", -1.15, -1.15)
    k.flag(-1.15, 1.15, 1.4)


def temple(k):
    from race_buildings import temple as plain
    plain(k)
    t = k.tier
    # About the old temple: lights round it, and the race's things of worship.
    if k.race == "elf":
        lib.cyl("tm-moonwell", 0.22, 0.08, (0.9, -0.9, 0.04), k.paving, verts=16)
        light(k, "tm-moonlight", 0.9, -0.9, 0.09, 0.15)
        for i in range(4):
            lamp(k, f"tm-lamp{i}", -1.15 + i * 0.3, -1.2, 0.3)
    elif k.race == "dwarf":
        statue(k, "tm-smith", 1.0, -1.0, 0.8)
        lamp(k, "tm-lamp", -1.1, -1.1)
    elif k.race == "centaur":
        lib.ball("tm-starglobe", 0.12, (0.95, -0.95, 0.3), k.gold, sub=2)
        lib.cyl("tm-globestand", 0.03, 0.2, (0.95, -0.95, 0.1), k.canvas2, verts=8)
        for i in range(3):
            lamp(k, f"tm-lamp{i}", -1.1 + i * 0.35, -1.15)
    else:
        lib.ball("tm-cave", 0.6, (0.0, 1.0, 0.2), k.mud, scale=(1.6, 0.8, 0.9), sub=2)
        lib.ball("tm-caveskull", 0.25, (0.0, 0.62, 0.55), k.bone, scale=(1, 1.2, 0.8), sub=2)
        lib.cyl("tm-drum", 0.08, 0.12, (1.0, -0.9, 0.06), k.hide, verts=12)
    if t >= 3:
        statue(k, "tm-guard", -1.05, 0.95, 0.6)


def academy(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "elf":
        k.great_tree(-0.2, 0.55, 1.2 + 0.1 * t, 0.8)
        for i in range(4):
            lib.box(f"ac-scroll{i}", (0.05, 0.02, 0.18), (-0.6 + i * 0.12, 0.05, 0.5), k.paving)
    elif k.race == "dwarf":
        k.hall("ac", -0.2, 0.55, 1.9, 0.9, 0.6 + 0.06 * t)
        # A model of gears, plans on a table.
        lib.cyl("ac-gear", 0.15, 0.04, (0.75, -0.55, 0.3), k.bronze, rot=(R(90), 0, 0), verts=16)
        lib.cyl("ac-gear2", 0.09, 0.04, (0.95, -0.55, 0.22), k.bronze, rot=(R(90), 0, 0), verts=12)
        lib.box("ac-table", (0.5, 0.3, 0.14), (-0.3, -0.55, 0.07), k.wood, bevel=0.01)
        lib.box("ac-plan", (0.36, 0.22, 0.005), (-0.3, -0.55, 0.145), lib.mat("parchment", (0.88, 0.82, 0.66), 0.9))
    elif k.race == "centaur":
        k.hut("ac", -0.3, 0.45, 0.65, 0.6 + 0.06 * t)
        lib.cyl("ac-scope", 0.04, 0.6, (0.75, -0.55, 0.45), k.gold, rot=(R(-40), 0, 0), verts=10)
        lib.box("ac-starmap", (0.5, 0.02, 0.35), (-0.3, -0.85, 0.3), k.sky)
    else:
        k.hut("ac", -0.3, 0.45, 0.6, 0.65 + 0.06 * t)
        for i in range(6):
            a = R(60 * i)
            lib.box(f"ac-stone{i}", (0.1, 0.08, 0.2), (0.6 + math.cos(a) * 0.35, -0.55 + math.sin(a) * 0.3, 0.1), lib.mat("menhir", (0.52, 0.50, 0.46), 0.95, grain=0.35))
        lib.cyl("ac-drum", 0.08, 0.12, (0.6, -0.55, 0.06), k.hide, verts=12)
    k.fence(-1.4, 1.35, 1.4, 1.35)
    lamp(k, "ac-lamp", -1.15, -1.15)
    k.banner(0.9, 0.05, 0.4)
    k.flag(1.15, -1.15, 1.2)


def siege_workshop(k):
    t = k.tier
    k.ground(3, k.yard)
    if k.race == "beastfolk":
        k.hut("sw", -0.5, 0.5, 0.6, 0.7)
    else:
        (k.pavilion if k.race == "centaur" else k.hall)("sw", -0.45, 0.55, 1.7, 1.1, 0.7)
    B.catapult_frame(k, 0.7, -0.6, "sw-engine", 0.75)
    B.log_pile(-0.6, -0.95, 5, "sw-timber", r=0.05, length=0.8)
    if k.race == "dwarf":
        lib.cyl("sw-furnace", 0.2, 0.45, (1.05, 0.55, 0.22), k.dstone, verts=10, r2=0.14)
        light(k, "sw-furnacefire", 1.05, 0.4, 0.15, 0.06)
    elif k.race == "elf":
        lib.cyl("sw-bentbranch", 0.03, 0.9, (1.0, 0.5, 0.45), k.live, rot=(R(25), 0, 0), verts=8)
    lamp(k, "sw-lamp", -1.15, -0.4)
    k.flag(1.15, 1.1, 1.3)


def wonder(k):
    from race_buildings import wonder as plain
    plain(k)
    # What each plan adds about the wonder.
    if k.race == "elf":
        lib.cyl("w-lake", 1.0, 0.02, (-1.3, -1.3, 0.01), lib.mat("spring", (0.30, 0.55, 0.62), 0.1), verts=24)
        for i in range(6):
            lamp(k, f"w-lamp{i}", -2.2 + i * 0.8, -2.25, 0.35)
        lib.cyl("w-silverdeck", 1.6, 0.05, (0, 0.3, 1.6), lib.mat("silver", (0.86, 0.88, 0.92), 0.3, 0.9), verts=28)
    elif k.race == "dwarf":
        lava = lib.mat("lava", (1.0, 0.42, 0.10), 0.6, emit=(1.0, 0.35, 0.05))
        lib.box("w-lavafall", (0.3, 0.05, 1.8), (1.4, 0.2, 1.0), lava, rot=(R(-20), 0, 0))
        lib.cyl("w-lavapool", 0.35, 0.03, (1.4, -0.3, 0.015), lava, verts=16)
        for x in (-2.0, 2.0):
            statue(k, f"w-miner{x}", x, -2.0, 0.9)
    elif k.race == "centaur":
        for i in range(12):
            a = R(30 * i)
            lib.box(f"w-stone{i}", (0.16, 0.12, 0.7), (math.cos(a) * 2.35, math.sin(a) * 2.35, 0.35), k.canvas2)
        lib.ball("w-globe", 0.35, (0, 0, 2.6), k.gold, sub=3)
    else:
        for i in range(10):
            a = R(36 * i)
            lib.box(f"w-menhir{i}", (0.18, 0.14, 0.8 + 0.2 * (i % 2)), (math.cos(a) * 2.3, 0.2 + math.sin(a) * 2.2, 0.45), lib.mat("menhir", (0.52, 0.50, 0.46), 0.95, grain=0.35))
        lamp(k, "w-bonfire", 0, -2.0, 0.1)
        k.totem("w-tall", 1.6, 1.6, 2.2)


BUILDERS = {
    "town_center": town_center, "house": house, "granary": granary, "storage_pit": storage_pit, "barracks": barracks,
    "dock": dock, "archery_range": archery_range, "stable": stable, "market": market,
    "watch_tower": lambda k: tower(k, "watch_tower"), "sentry_tower": lambda k: tower(k, "sentry_tower"),
    "guard_tower": lambda k: tower(k, "guard_tower"), "ballista_tower": lambda k: tower(k, "ballista_tower"),
    "government_center": government_center, "temple": temple, "academy": academy, "siege_workshop": siege_workshop,
    "wonder": wonder,
}
