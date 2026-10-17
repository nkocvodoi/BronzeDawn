# The elves' buildings age by age (replica/elf-ages-plan.md, approved 2026-10-17): a clear step at each age, so a
# town shows its age from afar. Stone Age: leaf huts on stumps. Tool Age: living wood bent to shape under
# leaves. Bronze Age: white birch and carved white stone under domes of jade silk, mushroom lights. Iron Age: a
# town in the trees of polished white wood, silver and leaf glass, moonstone lights at every door.
#
# The materials of each age are the Elf Kit's (race_buildings.py); props and lights are race_compounds.py's.
# Same conventions: one unit is one tile, the front toward the viewer (+X, -Y).

import math

import lib
import buildings as B
from race_compounds import lamp, light, statue, thing_of

R = math.radians


# ---- the elves' shapes, a step richer with each age

def hut(k, name, x, y, r, h):
    """Stone Age: a cone of leaves on a low wall of bark. Later: walls of the age's wood under a dome."""
    t = k.tier
    if t == 0:
        lib.cyl(f"{name}-wall", r, h * 0.45, (x, y, h * 0.225), k.bark, verts=12)
        roof = lib.cyl(f"{name}-roof", r * 1.25, h * 0.9, (x, y, h * 0.45 + h * 0.45), k.leaf, verts=12, r2=0.04)
        lib.lumpy(roof, 0.03, 0.12, len(name))
        lib.box(f"{name}-door", (r * 0.6, 0.03, h * 0.35), (x, y - r * 0.97, h * 0.17), k.dark)
        return h * 1.35
    return dome_hall(k, name, x, y, 2 * r, 2 * r, h, round_=True)


def dome_hall(k, name, x, y, w, d, h, round_=False):
    """A hall of the age's wood. Tool: a dome of leaves. Bronze: a pointed dome of jade silk, round windows, a
    garland at the eaves. Iron: the dome of leaf glass on silver ribs, a silver band, a moonstone over the door."""
    t = k.tier
    wall = lib.cyl(f"{name}-wall", 0.5, h, (x, y, h / 2), k.live, verts=16)
    wall.scale = (w, d, 1)
    if t <= 1:
        for i, (dx, dy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
            lib.cyl(f"{name}-root{i}", 0.045, h * 1.1, (x + dx * w * 0.42, y + dy * d * 0.42, h * 0.55), k.bark, verts=8, r2=0.03)
        dome = lib.ball(f"{name}-roof", 0.5, (x, y, h), k.leaf, scale=(w * 1.12, d * 1.12, min(w, d) * 0.8), sub=3)
        lib.lumpy(dome, 0.04, 0.167, len(name))
        top = h + min(w, d) * 0.4
    else:
        rise = min(w, d) * (0.75 if t == 2 else 0.95)
        lib.ball(f"{name}-roof", 0.5, (x, y, h), k.leaf, scale=(w * 1.06, d * 1.06, rise), sub=3)
        lib.cyl(f"{name}-tip", min(w, d) * 0.12, rise * 0.45, (x, y, h + rise * 0.6), k.leaf, verts=12, r2=0.0)
        lib.cyl(f"{name}-eave", 0.53, 0.05, (x, y, h), k.trim, verts=20).scale = (w, d, 1)
        # Round windows along the front.
        n = max(1, int(w / 0.45))
        for i in range(n):
            wx = x - w / 2 + (i + 0.5) * w / n
            if abs(wx - x) < 0.15:
                continue
            lib.cyl(f"{name}-win{i}", 0.06, 0.03, (wx, y - d / 2 + 0.01, h * 0.6), k.dark if t == 2 else k.leaf2, rot=(R(90), 0, 0), verts=12)
            lib.cyl(f"{name}-winrim{i}", 0.075, 0.02, (wx, y - d / 2, h * 0.6), k.trim, rot=(R(90), 0, 0), verts=12)
        if t == 3:
            for i in range(6):
                a = R(30 * i)
                rib = lib.cyl(f"{name}-rib{i}", 0.012, rise * 1.4, (x, y, h + rise * 0.45), k.trim, verts=5)
                rib.rotation_euler = (math.cos(a) * R(35), math.sin(a) * R(35), 0)
            light(k, f"{name}-moon", x, y - d / 2 - 0.02, h * 0.92, 0.035)
        else:
            # A garland of leaves at the eaves.
            for i in range(10):
                a = R(36 * i)
                lib.ball(f"{name}-gar{i}", 0.04, (x + math.cos(a) * w * 0.53, y + math.sin(a) * d * 0.53, h - 0.03), k.leaf2, sub=1)
        top = h + rise * 0.95
    lib.box(f"{name}-door", (0.2 if round_ else 0.24, 0.04, h * 0.7), (x, y - d / 2, h * 0.35), k.dark)
    if t >= 2:
        lib.cyl(f"{name}-doorarch", 0.1 if round_ else 0.12, 0.045, (x, y - d / 2, h * 0.7), k.trim, rot=(R(90), 0, 0), verts=12)
    return top


def tree(k, name, x, y, h, spread=1.0, decks=1):
    """A tree to live in: a trunk on roots, decks round it with rails (and stairs), a crown. Bronze: a dome of
    silk on the top deck. Iron: silver bands round the trunk, rails of silver."""
    t = k.tier
    lib.cyl(f"{name}-trunk", 0.36 * spread, h, (x, y, h / 2), k.bark, verts=16, r2=0.24 * spread)
    for i in range(6):
        a = R(60 * i + 15)
        lib.cyl(f"{name}-root{i}", 0.08 * spread, 0.55 * spread, (x + math.cos(a) * 0.36 * spread, y + math.sin(a) * 0.36 * spread, 0.11),
                k.bark, rot=(math.sin(a) * R(60), -math.cos(a) * R(60), 0), verts=8, r2=0.03)
    if t == 3:
        for j in range(3):
            lib.cyl(f"{name}-band{j}", (0.37 - j * 0.03) * spread, 0.04, (x, y, 0.15 + j * h * 0.25), k.trim, verts=18)
    zs = [h * (0.35 + 0.5 * j / max(1, decks)) for j in range(decks)]
    for j, z in enumerate(zs):
        r = (0.85 - j * 0.15) * spread
        lib.cyl(f"{name}-deck{j}", r, 0.06, (x, y, z), k.live, verts=22)
        lib.cyl(f"{name}-rail{j}", r + 0.01, 0.09, (x, y, z + 0.07), k.trim if t >= 2 else k.live, verts=22)
        if t >= 1:
            # A stair winding up to it.
            z0 = 0.1 if j == 0 else zs[j - 1]
            for s in range(7):
                a = R(52 * s + 120 * j)
                lib.box(f"{name}-step{j}{s}", (0.15, 0.08, 0.025), (x + math.cos(a) * 0.42 * spread, y + math.sin(a) * 0.42 * spread, z0 + (z - z0) * (s + 1) / 8), k.live, rot=(0, 0, a))
    crown_z = h
    for c, (dx, dy, dz, r) in enumerate(((0, 0, 0.1, 0.9), (0.45, 0.2, -0.15, 0.58), (-0.4, 0.3, -0.1, 0.6), (0.1, -0.4, -0.2, 0.5))):
        ball = lib.ball(f"{name}-crown{c}", r * spread, (x + dx * spread, y + dy * spread, crown_z + dz), k.foliage if c % 2 == 0 else k.foliage2, scale=(1, 1, 0.7), sub=3)
        lib.lumpy(ball, 0.05 if t < 3 else 0.02, 0.133, c + 11)
    if t >= 2 and zs:
        z = zs[-1]
        lib.ball(f"{name}-silk", 0.32 * spread, (x, y - 0.1, z + 0.08), k.leaf2, scale=(1, 1, 0.75), sub=3)
    return crown_z + 0.6 * spread


def bridge(k, name, a, b, z0, z1, n=7):
    for i in range(n):
        f = (i + 0.5) / n
        x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
        sag = -0.08 * math.sin(math.pi * f)
        lib.box(f"{name}-plank{i}", (0.13, 0.11, 0.02), (x, y, z0 + (z1 - z0) * f + sag), k.live, rot=(0, 0, math.atan2(b[1] - a[1], b[0] - a[0])))
    for s in (-1, 1):
        lib.cyl(f"{name}-rope{s}", 0.006, math.hypot(b[0] - a[0], b[1] - a[1]), ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + s * 0.06, (z0 + z1) / 2 + 0.1),
                k.trim, rot=(0, R(90), math.atan2(b[1] - a[1], b[0] - a[0])), verts=4)


def mushrooms(k, name, x, y, n=3):
    for j in range(n):
        dx, dy = (j - 1) * 0.06, (j % 2) * 0.05
        lib.cyl(f"{name}-stem{j}", 0.012, 0.08, (x + dx, y + dy, 0.04), lib.mat("stem", (0.86, 0.84, 0.76), 0.9), verts=6)
        light(k, f"{name}-cap{j}", x + dx, y + dy, 0.085, 0.035)


def pool(k, name, x, y, r):
    lib.cyl(f"{name}-rim", r + 0.05, 0.05, (x, y, 0.025), k.paving, verts=20)
    lib.cyl(f"{name}-water", r, 0.055, (x, y, 0.028), lib.mat("spring", (0.30, 0.55, 0.62), 0.08), verts=20)
    if k.tier == 3:
        light(k, f"{name}-moonstone", x, y, 0.07, 0.05)


def yard_lights(k, xs, y, h=0.36):
    for i, x in enumerate(xs):
        if k.tier == 0:
            continue
        if k.tier == 2:
            mushrooms(k, f"yl{i}", x, y)
        else:
            lamp(k, f"yl{i}", x, y, h)


# ---- the buildings

def town_center(k):
    t = k.tier
    k.ground(3, k.yard)
    if t == 0:
        lib.cyl("tc-stump", 0.55, 0.4, (0.15, 0.35, 0.2), k.bark, verts=16, r2=0.48)
        hut(k, "tc-hut", 0.15, 0.35, 0.45, 0.55)
        hut(k, "tc-hut2", -0.9, -0.4, 0.28, 0.35)
        lamp(k, "tc-fire", 0.4, -0.75, 0.06)
        B.log_pile(-0.85, 0.85, 4, "tc-logs")
    elif t == 1:
        tree(k, "tc", 0.2, 0.35, 1.5, 0.9, decks=1)
        hut(k, "tc-roothut", -0.85, -0.45, 0.28, 0.36)
    elif t == 2:
        tree(k, "tc", 0.2, 0.35, 1.8, 1.0, decks=2)
        hut(k, "tc-roothut", -0.9, -0.45, 0.3, 0.38)
        pool(k, "tc-spring", 0.95, -0.75, 0.22)
        mushrooms(k, "tc-shrooms", -0.35, -0.95)
    else:
        tree(k, "tc", 0.2, 0.4, 2.1, 1.1, decks=3)
        # Two smaller trees bridged to it, a pool with a moonstone.
        for name, (x, y) in (("tc-west", (-1.05, 0.75)), ("tc-east", (1.1, 0.55))):
            lib.cyl(f"{name}-trunk", 0.12, 1.0, (x, y, 0.5), k.bark, verts=10, r2=0.09)
            lib.cyl(f"{name}-deck", 0.3, 0.05, (x, y, 0.85), k.live, verts=14)
            lib.lumpy(lib.ball(f"{name}-crown", 0.35, (x, y, 1.15), k.foliage, scale=(1, 1, 0.75), sub=2), 0.02, 0.1)
            bridge(k, f"{name}-bridge", (x, y), (0.2 + (x - 0.2) * 0.25, 0.4 + (y - 0.4) * 0.25), 0.88, 0.95)
        pool(k, "tc-pool", 0.95, -0.85, 0.25)
        hut(k, "tc-roothut", -0.95, -0.55, 0.28, 0.36)
    yard_lights(k, (-0.4, 0.15, 0.6), -1.25)
    k.flag(1.25, 1.2, 1.2 + 0.3 * t)


def house(k):
    t = k.tier
    k.ground(2, k.yard)
    if t == 0:
        hut(k, "house", 0, 0.1, 0.42, 0.45)
    elif t == 1:
        lib.cyl("h-stump", 0.38, 0.28, (0, 0.1, 0.14), k.bark, verts=14, r2=0.34)
        dome_hall(k, "house", 0, 0.1, 0.6, 0.6, 0.32, round_=True)
        for i in range(5):
            lib.box(f"h-rung{i}", (0.1, 0.012, 0.012), (0.38, -0.15, 0.05 + i * 0.07), k.bark)
    elif t == 2:
        lib.cyl("h-trunk", 0.12, 0.5, (0, 0.2, 0.25), k.bark, verts=10, r2=0.09)
        lib.cyl("h-deck", 0.42, 0.05, (0, 0.15, 0.42), k.live, verts=16)
        dome_hall(k, "house", 0, 0.15, 0.6, 0.55, 0.3, round_=True)
        for o in lib.bpy.data.objects:
            if o.name.startswith("house-"):
                o.location.z += 0.44
        for i in range(6):
            lib.box(f"h-rung{i}", (0.1, 0.012, 0.012), (0.3, -0.25, 0.06 + i * 0.07), k.bark)
    else:
        lib.cyl("h-trunk", 0.16, 1.1, (0.1, 0.35, 0.55), k.bark, verts=12, r2=0.11)
        for j, z in enumerate((0.0, 0.42)):
            dome_hall(k, f"house{j}", -0.05 + j * 0.15, 0.1 + j * 0.15, 0.62 - j * 0.12, 0.55 - j * 0.1, 0.3, round_=True)
            for o in lib.bpy.data.objects:
                if o.name.startswith(f"house{j}-"):
                    o.location.z += z
        lib.lumpy(lib.ball("h-crown", 0.35, (0.1, 0.35, 1.25), k.foliage, scale=(1, 1, 0.7), sub=2), 0.02, 0.1)
    thing_of(k, "h-basket", 0.55, -0.55, "store")
    if t >= 1:
        (mushrooms if t == 2 else lamp)(k, "h-light", -0.55, -0.55)
    k.banner(-0.45, -0.5, 0.22, 0.1, 0.14)


def granary(k):
    t = k.tier
    k.ground(3, k.yard)
    if t <= 1:
        tree(k, "g", 0.3, 0.55, 1.1, 0.75, decks=0 if t == 0 else 1)
        for i, (x, y) in enumerate(((-0.25, 0.35), (0.65, 0.25), (0.2, 0.9))):
            lib.cyl(f"g-rope{i}", 0.006, 0.3, (x, y, 0.95), k.bark, verts=4)
            lib.ball(f"g-pod{i}", 0.12, (x, y, 0.72), k.live if t else k.leaf, scale=(1, 1, 1.3), sub=2)
    elif t == 2:
        for i, (x, y) in enumerate(((-0.45, 0.5), (0.45, 0.6))):
            lib.cyl(f"g-leg{i}", 0.05, 0.3, (x, y, 0.15), k.bark, verts=8)
            dome_hall(k, f"g-store{i}", x, y, 0.6, 0.6, 0.4, round_=True)
            for o in lib.bpy.data.objects:
                if o.name.startswith(f"g-store{i}-"):
                    o.location.z += 0.3
    else:
        lib.cyl("g-tower", 0.42, 1.0, (0.1, 0.5, 0.5), k.live, verts=18)
        lib.ball("g-dome", 0.45, (0.1, 0.5, 1.0), k.trim, scale=(1, 1, 0.8), sub=3)
        lib.cyl("g-pulleyarm", 0.012, 0.6, (0.1, 0.05, 1.05), k.trim, rot=(R(90), 0, 0), verts=5)
        lib.cyl("g-rope", 0.005, 0.8, (0.1, -0.22, 0.65), k.bark, verts=4)
        lib.cyl("g-basket", 0.08, 0.1, (0.1, -0.22, 0.25), k.bark, verts=10)
        for i in range(3):
            lib.cyl(f"g-win{i}", 0.05, 0.03, (-0.1 + i * 0.2, 0.08, 0.6), k.leaf2, rot=(R(90), 0, 0), verts=12)
    for i in range(4):
        lib.cyl(f"g-rackpost{i}", 0.012, 0.32, (-1.0 + i * 0.28, -0.85, 0.16), k.bark, verts=5)
    lib.box("g-rackbar", (0.9, 0.02, 0.02), (-0.58, -0.85, 0.31), k.bark)
    for i in range(5):
        thing_of(k, f"g-basket{i}", -1.0 + i * 0.25, -1.1, "store")
    yard_lights(k, (0.6, 1.0), -1.15)
    k.flag(1.2, -1.2, 0.8)


def storage_pit(k):
    t = k.tier
    k.ground(3, k.yard)
    B.log_pile(0.65, -0.65, 5 + t, "sp-logs")  # fallen wood: the elves cut no living tree
    B.stone_blocks(-0.85, -1.0, "sp-blocks")
    B.ore_heap(1.0, 0.4, "sp-gold", 0.14)
    if t == 0:
        hut(k, "sp", -0.4, 0.5, 0.42, 0.45)
    elif t == 1:
        lean(k, "sp", -0.35, 0.45, 1.3, 0.9, 0.55)
    else:
        # A workshop: posts of twisted trunks, a roof of the age (silk, then leaf glass), a rack of bows.
        for i, (x, y) in enumerate(((-1.0, 0.0), (0.3, 0.0), (0.3, 0.9), (-1.0, 0.9))):
            twisted(k, f"sp-post{i}", x, y, 0.6)
        roof = lib.ball("sp-roof", 0.5, (-0.35, 0.45, 0.6), k.leaf, scale=(1.6, 1.15, 0.35), sub=3)
        if t == 3:
            for i in range(5):
                lib.cyl(f"sp-rib{i}", 0.01, 1.5, (-0.95 + i * 0.3, 0.45, 0.7), k.trim, rot=(R(90), 0, 0), verts=4)
        for i in range(4):
            lib.cyl(f"sp-bow{i}", 0.008, 0.4, (-0.7 + i * 0.13, 0.85, 0.32), k.trim if t == 3 else k.bark, verts=5, rot=(0, R(15), 0))
    lib.box("sp-bench", (0.5, 0.18, 0.12), (-0.35, -0.3, 0.06), k.live, bevel=0.02)
    yard_lights(k, (-0.3,), -0.75)
    k.flag(1.15, 1.0, 0.8)


def lean(k, name, x, y, w, d, h):
    """A roof of leaves on bent poles."""
    for dx in (-w / 2, w / 2):
        for dy in (-d / 2, d / 2):
            lib.cyl(f"{name}-pole{dx}{dy}", 0.025, h, (x + dx, y + dy, h / 2), k.bark, verts=6)
    roof = lib.ball(f"{name}-roof", 0.5, (x, y, h), k.foliage, scale=(w * 1.1, d * 1.1, 0.3), sub=3)
    lib.lumpy(roof, 0.03, 0.1)


def twisted(k, name, x, y, h):
    """A post of two trunks grown round each other."""
    for s in range(2):
        for j in range(6):
            a = R(60 * j + 180 * s)
            lib.ball(f"{name}-{s}{j}", 0.04, (x + math.cos(a) * 0.03, y + math.sin(a) * 0.03, h * (j + 0.5) / 6), k.live, scale=(1, 1, 1.8), sub=1)


def barracks(k):
    t = k.tier
    k.ground(3, k.yard)
    if t == 0:
        for i, (x, y) in enumerate(((-0.6, 0.6), (0.4, 0.75))):
            hut(k, f"bar{i}", x, y, 0.32, 0.4)
    elif t == 1:
        dome_hall(k, "bar", -0.3, 0.55, 1.7, 0.85, 0.5)
        for s in (-1, 1):
            lib.cyl(f"bar-arch{s}", 0.03, 0.7, (0.75 + s * 0.25, -0.95, 0.35), k.bark, verts=6, rot=(0, R(-12 * s), 0))
        lib.lumpy(lib.ball("bar-archtop", 0.18, (0.75, -0.95, 0.72), k.leaf2, scale=(1.6, 0.6, 0.6), sub=2), 0.03, 0.08)
    else:
        dome_hall(k, "bar", -0.25, 0.55, 2.0, 0.9, 0.6 + 0.1 * (t - 2))
        for i in range(5):
            twisted(k, f"bar-col{i}", -1.1 + i * 0.42, -0.0, 0.55)
        lib.box("bar-beam", (1.9, 0.1, 0.05), (-0.25, 0.0, 0.57), k.trim)
        if t == 3:
            for i in range(3):
                lib.cyl(f"bar-shield{i}", 0.1, 0.02, (-0.85 + i * 0.6, 0.08, 0.4), k.trim, rot=(R(90), 0, 0), verts=16)
    B.weapon_rack(k, 0.95, 0.25, "bar-rack", along_x=False, shields=2)
    B.dummy(k, -0.6, -0.8, "bar-dummy")
    if t >= 2:
        B.dummy(k, -0.15, -1.05, "bar-dummy2")
    yard_lights(k, (1.1,), -1.1)
    k.flag(1.15, 1.1, 1.0 + 0.1 * t)


def archery_range(k):
    t = k.tier
    k.ground(3, k.yard)
    for y in (-1.2, 1.2):
        for i in range(3):
            lib.cyl(f"ar-trunk{y}{i}", 0.04, 0.3, (-1.0 + i * 0.9, y, 0.15), k.bark, verts=6)
            lib.lumpy(lib.ball(f"ar-tree{y}{i}", 0.2, (-1.0 + i * 0.9, y, 0.45), k.foliage if i % 2 else k.foliage2, scale=(1, 1, 1.2), sub=2), 0.04, 0.1)
    if t >= 2:
        statue(k, "ar-goddess", -0.55, 0.45, 0.85 if t == 2 else 1.0)
        if t == 3:
            lib.cyl("ar-silverbow", 0.01, 0.5, (-0.47, 0.45, 0.55), k.trim, verts=5, rot=(0, R(10), 0))
            lib.box("ar-lane", (0.5, 2.2, 0.02), (0.55, 0.0, 0.01), k.paving)
    else:
        lean(k, "ar-shelter", -0.6, 0.45, 0.8, 0.6, 0.45)
    for j, y in enumerate((-0.6, 0.15, 0.9)):
        lib.cyl(f"ar-slice{j}", 0.17, 0.06, (1.05, y, 0.25), k.live, rot=(0, R(90), 0), verts=16)
        lib.cyl(f"ar-ring{j}", 0.1, 0.065, (1.05, y, 0.25), k.team, rot=(0, R(90), 0), verts=16)
        if t == 3:
            light(k, f"ar-targetlight{j}", 1.05, y + 0.2, 0.45, 0.025)
    yard_lights(k, (-1.15,), -0.6)
    k.flag(-1.15, 1.1, 1.0)


def stable(k):
    t = k.tier
    k.ground(3, k.yard)
    if t == 1:
        lean(k, "st", -0.3, 0.6, 1.9, 0.7, 0.45)
    else:
        dome_hall(k, "st", -0.3, 0.6, 2.0, 0.75, 0.48 + 0.08 * (t - 2))
    k.fence(-1.3, -1.25, 1.3, -1.25)
    k.fence(1.3, -1.25, 1.3, 0.2)
    trough = lib.box("st-trough", (0.6, 0.2, 0.12), (-0.6, -0.55, 0.06), k.paving if t >= 2 else k.live, bevel=0.01)
    hay = lib.mat("hay", (0.86, 0.74, 0.40), 0.95, grain=0.4, grain_size=0.01)
    for j in range(3):
        lib.ball(f"st-hay{j}", 0.13, (0.25 + j * 0.25, -0.35, 0.07), hay, scale=(1.2, 1, 0.6), sub=2)
    coat = (0.62, 0.48, 0.32) if t < 3 else (0.92, 0.90, 0.86)
    B.horse("st-elk", 0.75, -0.85, R(15), coat)
    antler = lib.mat("antler", (0.86, 0.80, 0.66), 0.7)
    for s in (-1, 1):
        lib.cyl(f"st-antler{s}", 0.012, 0.24, (0.9 + 0.03 * s, -0.85, 0.5), antler, rot=(0, R(30 * s), 0), verts=5)
    yard_lights(k, (-1.15,), 1.05)
    k.flag(1.15, 1.1, 1.0)


def market(k):
    t = k.tier
    k.ground(3, k.yard)
    silk = lib.mat("silk", (0.36, 0.66, 0.58), 0.6)
    fruit = lib.mat("fruit", (0.80, 0.26, 0.30), 0.6)
    if t == 3:
        # A market under a canopy of leaf glass on silver posts, a little fountain.
        for x in (-1.0, 0.2):
            for y in (-0.2, 0.9):
                lib.cyl(f"mk-post{x}{y}", 0.025, 0.7, (x, y, 0.35), k.trim, verts=8)
        lib.ball("mk-canopy", 0.5, (-0.4, 0.35, 0.7), k.leaf, scale=(1.6, 1.4, 0.4), sub=3)
        pool(k, "mk-fountain", 0.85, 0.65, 0.18)
        lib.cyl("mk-jet", 0.02, 0.25, (0.85, 0.65, 0.18), k.trim, verts=6)
    else:
        dome_hall(k, "mk", -0.6, 0.65, 1.1, 0.8, 0.45)
    for j, (x, y) in enumerate(((0.75, -0.15), (0.0, -0.85), (0.85, -0.95))):
        for dx, dy in ((-0.22, -0.16), (0.22, -0.16), (0.22, 0.16), (-0.22, 0.16)):
            lib.cyl(f"mk-stallpost{j}{dx}{dy}", 0.016, 0.4, (x + dx, y + dy, 0.2), k.trim if t >= 2 else k.bark, verts=6)
        lib.box(f"mk-awning{j}", (0.55, 0.42, 0.02), (x, y, 0.41), silk if t >= 2 else k.leaf, rot=(R(8), 0, 0))
        lib.box(f"mk-counter{j}", (0.45, 0.26, 0.11), (x, y, 0.055), k.live, bevel=0.01)
        for i in range(3):
            lib.ball(f"mk-good{j}{i}", 0.04, (x - 0.13 + i * 0.13, y, 0.15), fruit if i % 2 else silk, sub=1)
        if t == 3:
            light(k, f"mk-hanging{j}", x, y - 0.2, 0.36, 0.025)
    k.flag(1.2, 1.15, 1.0)


def temple(k):
    t = k.tier
    k.ground(3, k.yard)
    tree(k, "tm", 0.0, 0.4, 1.3 + 0.2 * (t - 2), 0.75, decks=0)
    n = 8
    for i in range(n):
        a = R(360 / n * i)
        px, py = math.cos(a) * 1.1, 0.25 + math.sin(a) * 0.95
        if t == 3:
            lib.cyl(f"tm-col{i}", 0.05, 0.75, (px, py, 0.375), k.trim, verts=10)
            light(k, f"tm-collight{i}", px, py, 0.8, 0.025)
        else:
            lib.box(f"tm-stone{i}", (0.12, 0.08, 0.32), (px, py, 0.16), k.paving, rot=(0, 0, a))
    pool(k, "tm-moonwell", 0.0, -0.75, 0.2 if t == 2 else 0.25)
    light(k, "tm-moonlight", 0.0, -0.75, 0.09, 0.12 if t == 2 else 0.18)
    yard_lights(k, (-1.15, 1.15), -1.2, 0.32)
    k.flag(1.2, 1.2, 1.2)


def government_center(k):
    t = k.tier
    k.ground(3, k.yard)
    tree(k, "gov", 0.3, 0.55, 1.4, 0.85, decks=1)
    if t == 2:
        lib.cyl("gov-deck", 0.95, 0.06, (0.3, 0.55, 0.45), k.live, verts=22)
        for i in range(9):
            a = R(40 * i)
            lib.box(f"gov-seat{i}", (0.16, 0.08, 0.08), (0.3 + math.cos(a) * 0.82, 0.55 + math.sin(a) * 0.82, 0.53), k.paving, rot=(0, 0, a))
    else:
        dome_hall(k, "gov-hall", -0.35, -0.05, 1.3, 0.9, 0.6)
        lib.box("gov-throne", (0.22, 0.18, 0.4), (0.85, -0.5, 0.2), k.live, bevel=0.02)
        lib.box("gov-throneback", (0.22, 0.04, 0.35), (0.85, -0.42, 0.55), k.trim)
    statue(k, "gov-statue", 1.05, -1.0, 0.55)
    yard_lights(k, (-1.15, -0.6), -1.2)
    k.flag(-1.15, 1.15, 1.4)


def academy(k):
    t = k.tier
    k.ground(3, k.yard)
    if t == 2:
        tree(k, "ac", -0.2, 0.55, 1.2, 0.85, decks=1)
        for i in range(4):
            lib.box(f"ac-scroll{i}", (0.05, 0.02, 0.18), (-0.6 + i * 0.12, 0.05, 0.5), k.paving)
    else:
        # A library tower of white wood, windows of leaf glass, a balcony.
        lib.cyl("ac-tower", 0.5, 1.3, (-0.2, 0.55, 0.65), k.live, verts=18)
        lib.cyl("ac-balcony", 0.62, 0.05, (-0.2, 0.55, 0.85), k.live, verts=18)
        lib.cyl("ac-balrail", 0.63, 0.1, (-0.2, 0.55, 0.92), k.trim, verts=18)
        lib.cyl("ac-roof", 0.6, 0.6, (-0.2, 0.55, 1.6), k.leaf, verts=18, r2=0.02)
        for i in range(4):
            a = R(-150 + 40 * i)
            lib.cyl(f"ac-win{i}", 0.06, 0.03, (-0.2 + math.cos(a) * 0.5, 0.55 + math.sin(a) * 0.5, 1.1), k.leaf2, rot=(R(90), 0, a - R(90)), verts=12)
    lib.box("ac-bench", (0.7, 0.16, 0.1), (0.5, -0.6, 0.05), k.live, bevel=0.02)
    k.fence(-1.4, 1.35, 1.4, 1.35)
    yard_lights(k, (-1.15, 1.1), -1.15)
    k.banner(0.9, 0.05, 0.4)
    k.flag(1.15, -1.15, 1.2)


def siege_workshop(k):
    k.ground(3, k.yard)
    dome_hall(k, "sw", -0.45, 0.55, 1.6, 1.0, 0.65)
    B.catapult_frame(k, 0.7, -0.6, "sw-engine", 0.75)
    B.log_pile(-0.6, -0.95, 5, "sw-timber", r=0.05, length=0.8)
    # A crane of a bent branch.
    lib.cyl("sw-crane", 0.035, 1.1, (1.05, 0.6, 0.55), k.live, verts=8)
    lib.cyl("sw-boom", 0.025, 0.8, (1.05, 0.25, 1.05), k.live, rot=(R(65), 0, 0), verts=6)
    lib.cyl("sw-line", 0.005, 0.5, (1.05, -0.08, 0.9), k.trim, verts=4)
    yard_lights(k, (-1.15,), -0.4)
    k.flag(1.15, 1.1, 1.3)


def dock(k):
    t = k.tier
    deck = k.paving if t == 3 else lib.mat("deck", (0.55, 0.38, 0.20), 0.85, grain=0.4, grain_size=0.02)
    lib.box("deck", (2.8, 2.8, 0.08), (0, 0, 0.12), deck, bevel=0.01)
    for x in (-1.3, 0, 1.3):
        for y in (-1.3, 0, 1.3):
            lib.cyl(f"pile{x}{y}", 0.05, 0.3, (x, y, 0.0), k.bark, verts=8)
    import bpy
    before = set(bpy.data.objects)
    dome_hall(k, "dockhut", -0.55, 0.6, 0.9, 0.8, 0.4, round_=True) if t >= 1 else hut(k, "dockhut", -0.55, 0.6, 0.42, 0.42)
    for o in set(bpy.data.objects) - before:
        o.location.z += 0.16
    if t >= 2:
        # Posts carved as swans.
        for x in (0.6, 1.2):
            lib.cyl(f"swanpost{x}", 0.04, 0.5, (x, -1.25, 0.41), k.live, verts=8)
            lib.ball(f"swanhead{x}", 0.05, (x, -1.3, 0.68), k.live, scale=(0.8, 1.3, 0.8), sub=1)
    net = lib.mat("net", (0.62, 0.56, 0.42), 0.9, grain=0.3)
    lib.box("d-net", (0.62, 0.01, 0.22), (-0.8, -0.9, 0.38), net)
    lib.ball("d-boat", 0.2, (1.55, -0.6, 0.1), k.live, scale=(2.2, 0.8, 0.45), sub=2)
    if t == 3:
        light(k, "d-light", 1.2, -1.1, 0.5, 0.03)
    k.flag(-1.2, -1.2, 0.9)


def tower(k, kind):
    level = {"watch_tower": 0, "sentry_tower": 1, "guard_tower": 2, "ballista_tower": 3}[kind]
    k.ground(2, k.yard)
    h = (1.2, 1.45, 1.7, 1.95)[level]
    lib.cyl("tw-trunk", 0.2 + 0.03 * level, h, (0, 0, h / 2), k.bark, verts=12, r2=0.13)
    deck_z = h * 0.8
    lib.cyl("tw-deck", 0.45, 0.06, (0, 0, deck_z), k.live, verts=16)
    lib.cyl("tw-rail", 0.46, 0.1, (0, 0, deck_z + 0.08), k.trim if level >= 2 else k.live, verts=16)
    if level == 0:
        lib.lumpy(lib.ball("tw-crown", 0.5, (0, 0, h + 0.15), k.foliage, scale=(1, 1, 0.7), sub=3), 0.05, 0.15)
    elif level == 1:
        lib.cyl("tw-roof", 0.55, 0.45, (0, 0, deck_z + 0.55), k.leaf, verts=12, r2=0.03)
    else:
        for i in range(4):
            a = R(45 + 90 * i)
            lib.cyl(f"tw-post{i}", 0.02, 0.4, (math.cos(a) * 0.38, math.sin(a) * 0.38, deck_z + 0.25), k.trim, verts=6)
        lib.ball("tw-dome", 0.5, (0, 0, deck_z + 0.45), k.leaf, scale=(1, 1, 0.75), sub=3)
        lib.cyl("tw-tip", 0.08, 0.3, (0, 0, deck_z + 0.95), k.trim, verts=10, r2=0.0)
    if level == 3:
        # The swan crossbow on the deck.
        lib.box("tw-bolt", (0.05, 0.5, 0.05), (0, -0.1, deck_z + 0.2), k.trim, rot=(R(10), 0, 0))
        lib.box("tw-arms", (0.5, 0.04, 0.04), (0, -0.25, deck_z + 0.22), k.live)
        lib.ball("tw-swan", 0.05, (0, -0.38, deck_z + 0.26), k.live, scale=(0.8, 1.4, 0.8), sub=1)
    if level >= 1:
        lamp(k, "tw-lamp", 0.5, -0.6, 0.3)
    k.fence(-0.85, -0.85, 0.85, -0.85, 0.16)
    k.flag(0.45, 0.45, h * 0.7 + 0.5)


def wonder(k):
    t = k.tier
    k.ground(5, k.yard)
    top = tree(k, "world", 0, 0.3, 2.6, 2.0, decks=3)
    lib.cyl("w-lake", 0.95, 0.02, (-1.3, -1.35, 0.01), lib.mat("spring", (0.30, 0.55, 0.62), 0.08), verts=24)
    if t == 3:
        lib.ball("w-glass", 0.9, (0, 0.2, top - 0.1), k.leaf2, scale=(1, 1, 0.6), sub=3)
        lib.cyl("w-glasstip", 0.15, 0.6, (0, 0.2, top + 0.4), k.trim, verts=12, r2=0.0)
        # Water falling from the roots, white birds about the crown.
        lib.box("w-fall", (0.25, 0.04, 0.9), (-0.75, -0.5, 0.45), lib.mat("fall", (0.80, 0.90, 0.95), 0.1), rot=(R(-15), 0, 0))
        bird = lib.mat("bird", (0.96, 0.96, 0.96), 0.6)
        for i in range(5):
            a = R(72 * i)
            lib.box(f"w-bird{i}", (0.12, 0.03, 0.01), (math.cos(a) * 1.6, 0.3 + math.sin(a) * 1.4, top - 0.4 + 0.1 * i), bird, rot=(0, R(15), a))
    for i in range(6):
        x = -2.2 + i * 0.8
        (lamp if t == 3 else mushrooms)(k, f"w-light{i}", x, -2.25)
    k.flag(2.2, 2.2, 1.5)


BUILDERS = {
    "town_center": town_center, "house": house, "granary": granary, "storage_pit": storage_pit, "barracks": barracks,
    "dock": dock, "archery_range": archery_range, "stable": stable, "market": market,
    "watch_tower": lambda k: tower(k, "watch_tower"), "sentry_tower": lambda k: tower(k, "sentry_tower"),
    "guard_tower": lambda k: tower(k, "guard_tower"), "ballista_tower": lambda k: tower(k, "ballista_tower"),
    "government_center": government_center, "temple": temple, "academy": academy, "siege_workshop": siege_workshop,
    "wonder": wonder,
}
