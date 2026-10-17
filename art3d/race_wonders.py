# The fantasy races' Wonders as colossal statues (the owner's notes, 2026-10-17): the elves' goddess grown into
# a tree, her arms and hair spreading into its crown; the dwarves' god of the forge, hammer raised over his
# anvil; the centaurs' great rearing horse; the beastfolk's dragon on its crag, wings spread, roaring. Each is
# modelled in clay (clay.py: metaballs, so the body flows from one part into the next), Bronze Age in stone
# and wood, the Iron Age richer: silver, gold, fire, light.
#
# Five tiles, -2.5 to 2.5, the front toward the viewer (+X, -Y); the races' frames are tall enough for 4 units.

import math

import lib
from clay import Clay, scales
from race_compounds import lamp, light

R = math.radians


def _tube(name, a, b, r0, r1, m, verts=10):
    """A plain tapering rod a -> b (horns, spikes, branches, bones of a wing)."""
    from mathutils import Vector
    va, vb = Vector(a), Vector(b)
    d = vb - va
    o = lib.cyl(name, r0, d.length, tuple((va + vb) / 2), m, verts=verts, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return o


def _fan(name, pts, m):
    """A membrane: a fan of triangles from the first point through the rest."""
    bpy = lib.bpy
    me = bpy.data.meshes.new(name)
    me.from_pydata(pts, [], [(0, i, i + 1) for i in range(1, len(pts) - 1)])
    o = bpy.data.objects.new(name, me)
    lib.link(o)
    lib.setmat(o, m)
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = 0.015
    return o


class Pose:
    """Everything made inside `with Pose(...)`: grown by `k` and turned by `turn` degrees about `pivot` on the
    ground, so a statue can be made at its own size and set to face the viewer."""

    def __init__(self, pivot, k=1.0, turn=0.0):
        self.pivot, self.k, self.turn = pivot, k, turn

    def __enter__(self):
        self.before = set(lib.bpy.data.objects)
        return self

    def __exit__(self, *exc):
        if exc[0] is not None:
            return False
        made = [o for o in lib.bpy.data.objects if o not in self.before and o.parent is None]
        root = lib.empty("pose", self.pivot)
        for o in made:
            o.location = (o.location.x - self.pivot[0], o.location.y - self.pivot[1], o.location.z - self.pivot[2])
            o.parent = root
        root.scale = (self.k, self.k, self.k)
        root.rotation_euler = (0, 0, R(self.turn))
        return False


def _round_plinth(steps, y, m, band):
    z = 0.0
    for i, (r, h) in enumerate(steps):
        lib.cyl(f"plinth{i}", r, h, (0, y, z + h / 2), m, verts=40)
        lib.cyl(f"plinthband{i}", r + 0.012, 0.035, (0, y, z + h - 0.02), band, verts=40)
        z += h
    return z


def _lamps(k, n, rx, ry, cy, h=0.4, skip_front=True):
    for i in range(n):
        a = R(360 / n * i + 180 / n)
        if skip_front and abs(math.cos(a)) < 0.3 and math.sin(a) < 0:
            continue
        lamp(k, f"w-lamp{i}", math.cos(a) * rx, cy + math.sin(a) * ry, h)


# ---- the elves: a goddess grown into a tree

def elf(k):
    iron = k.tier >= 3
    k.ground(5, k.yard)
    cy = 0.25
    z0 = _round_plinth([(2.25, 0.12), (1.8, 0.14)], cy, k.paving, k.trim)
    lib.cyl("w-pool", 1.62, 0.035, (0, cy, z0 + 0.018), lib.mat("spring", (0.30, 0.55, 0.62), 0.08), verts=40)
    if iron:
        for i in range(6):
            a = R(60 * i + 30)
            light(k, f"w-poolstone{i}", math.cos(a) * 1.35, cy + math.sin(a) * 1.35, z0 + 0.06, 0.05)
    pose = Pose((0, cy, z0), 1.3, -15)
    pose.__enter__()
    skin = lib.mat("goddess-skin", (0.93, 0.86, 0.72) if not iron else (0.97, 0.95, 0.90), 0.45 if iron else 0.6, grain=0.12, grain_size=0.01)
    bark = lib.mat("goddess-bark", (0.36, 0.26, 0.17) if not iron else (0.52, 0.46, 0.40), 0.9, grain=0.5, grain_size=0.008)
    # Roots and the trunk her body rises from: wider at the foot, a twist of bark up to the hips.
    trunk = Clay("w-trunk", bark)
    for i in range(10):
        a = R(36 * i + 8)
        trunk.taper((math.cos(a) * 0.18, cy + math.sin(a) * 0.18, z0 + 0.55), (math.cos(a) * 1.45, cy + math.sin(a) * 1.4, z0 + 0.02), 0.13, 0.035)
    trunk.taper((0, cy, z0), (0, cy, z0 + 1.15), 0.45, 0.27, n=8)
    for i in range(5):
        a = R(72 * i)
        trunk.taper((math.cos(a) * 0.3, cy + math.sin(a) * 0.3, z0 + 0.1), (math.cos(a + 1.2) * 0.2, cy + math.sin(a + 1.2) * 0.2, z0 + 1.2), 0.09, 0.05)
    scales(trunk.bake(), 0.012, 0.05, 1)
    # Her body: hips where the bark gives way, a narrow waist, breast and shoulders, a long neck, the head
    # turned a little down toward her people.
    body = Clay("w-goddess", skin)
    body.ellipsoid((0, cy, z0 + 1.32), 0.3, (1.15, 0.85, 0.9))
    body.taper((0, cy, z0 + 1.35), (0, cy, z0 + 1.75), 0.24, 0.19)
    body.ellipsoid((0, cy, z0 + 1.92), 0.27, (1.25, 0.8, 0.85))
    for x in (-0.11, 0.11):
        body.ball((x, cy - 0.17, z0 + 1.9), 0.11)
    body.ellipsoid((0, cy, z0 + 2.12), 0.24, (1.55, 0.75, 0.5))
    body.capsule((0, cy + 0.01, z0 + 2.18), (0, cy + 0.02, z0 + 2.36), 0.075)
    body.ellipsoid((0, cy - 0.02, z0 + 2.5), 0.15, (0.85, 0.95, 1.12))
    body.ball((0, cy - 0.16, z0 + 2.48), 0.025)  # her nose
    for s in (-1, 1):
        body.capsule((s * 0.12, cy, z0 + 2.52), (s * 0.27, cy + 0.06, z0 + 2.66), 0.025)  # long ears
    # Arms raised and opening outward; at the wrists they become branches.
    for s in (-1, 1):
        sh, el, wr = (s * 0.33, cy, z0 + 2.12), (s * 0.66, cy - 0.06, z0 + 2.5), (s * 0.84, cy, z0 + 2.95)
        body.taper(sh, el, 0.085, 0.07)
        body.taper(el, wr, 0.07, 0.05)
    scales(body.bake(), 0.004, 0.02, 2)
    branches = Clay("w-branches", bark)
    tips = []
    for s in (-1, 1):
        wr = (s * 0.84, cy, z0 + 2.95)
        for j in range(4):
            tip = (wr[0] + s * (0.2 + 0.2 * j), cy + 0.1 + j * 0.18, wr[2] + 0.4 + 0.08 * j)
            branches.taper(wr, tip, 0.05, 0.02, n=5)
            tips.append(tip)
    # Her hair falls behind her and rises into the trunk of the crown.
    hair_wood = Clay("w-hair", bark)
    hair_wood.taper((0, cy + 0.12, z0 + 2.55), (0, cy + 0.3, z0 + 3.1), 0.16, 0.1)
    for s in (-1, 0, 1):
        hair_wood.taper((s * 0.08, cy + 0.16, z0 + 2.45), (s * 0.45, cy + 0.35, z0 + 3.2), 0.07, 0.035)
        tips.append((s * 0.45, cy + 0.35, z0 + 3.2))
    branches.bake()
    hair_wood.bake()
    # The crown: clusters of leaves at every branch's end and over her head, wide over the whole square.
    crown = Clay("w-crown", k.foliage, resolution=0.05)
    for i, t in enumerate(tips):
        crown.ellipsoid(t, 0.42, (1.2, 1.0, 0.65))
    # Spread behind and above her, so her body stays in view from the front.
    for i in range(9):
        a = R(10 + 20 * i)
        crown.ellipsoid((math.cos(a) * 1.15, cy + 0.35 + math.sin(a) * 0.75, z0 + 3.25 + 0.15 * math.sin(3 * a)), 0.36, (1.2, 1.0, 0.6))
    crown.ellipsoid((0, cy + 0.45, z0 + 3.5), 0.55, (1.4, 1.1, 0.55))
    lib.lumpy(crown.bake(), 0.05, 0.13, 7)
    # Blossoms in the crown (glowing in the Iron Age), a circlet on her brow.
    bloom = lib.mat("blossom", (0.96, 0.92, 0.96), 0.6) if not iron else lib.mat("elf-glow", (0.55, 0.95, 0.75), 1.0, emit=(0.55, 0.95, 0.75))
    for i in range(18):
        a = R(20 * i)
        r = 0.6 + 0.6 * ((i * 7) % 5) / 5
        lib.ball(f"w-bloom{i}", 0.035, (math.cos(a) * r, cy + 0.2 + math.sin(a) * r * 0.75, z0 + 3.2 + 0.25 * math.sin(2 * a)), bloom, sub=1)
    lib.cyl("w-circlet", 0.16, 0.025, (0, cy - 0.02, z0 + 2.62), k.trim, verts=20)
    if iron:
        light(k, "w-brow", 0, cy - 0.17, z0 + 2.63, 0.03)
    pose.__exit__(None, None, None)
    _lamps(k, 8, 2.1, 1.95, cy)
    k.flag(2.25, 2.25, 1.5)


# ---- the dwarves: the god of the forge

def dwarf(k):
    iron = k.tier >= 3
    k.ground(5, k.yard)
    lava = lib.mat("lava", (1.0, 0.42, 0.10), 0.6, emit=(1.0, 0.35, 0.05))
    metal = k.bronze if not iron else lib.mat("goldleaf", (0.95, 0.78, 0.32), 0.3, 0.9)
    # Cast in dark bronze, so the figure stands out against the grey steps (in pale stone he read as a lump).
    stone = lib.mat("godbronze", (0.42, 0.28, 0.17) if not iron else (0.48, 0.32, 0.18), 0.35, 0.8, grain=0.2, grain_size=0.02)
    z0 = 0.0
    for i, (w, d, h) in enumerate(((4.5, 4.0, 0.16), (3.7, 3.3, 0.16), (2.9, 2.6, 0.18))):
        lib.box(f"step{i}", (w, d, h), (0, 0.25, z0 + h / 2), k.dstone, bevel=0.03)
        lib.box(f"stepband{i}", (w + 0.01, d + 0.01, 0.03), (0, 0.25, z0 + h - 0.02), metal)
        z0 += h
    # Runes along the top step's front, lava in a channel before it.
    for i in range(9):
        lib.box(f"rune{i}", (0.06, 0.02, 0.1), (-1.2 + i * 0.3, -1.06, z0 - 0.09), lava if iron else metal)
    lib.box("lavachannel", (2.6, 0.12, 0.03), (0, -0.82, z0 + 0.015), lava)
    # The forge behind, the anvil before him.
    lib.box("forge", (1.0, 0.75, 0.85), (-1.0, 1.05, z0 + 0.42), k.dstone, bevel=0.05)
    lib.box("forgemouth", (0.45, 0.05, 0.32), (-1.0, 0.66, z0 + 0.32), lava)
    _tube("chimney", (-1.0, 1.15, z0 + 0.85), (-1.0, 1.2, z0 + 2.4), 0.2, 0.15, k.dstone, 12)
    light(k, "forgefire", -1.0, 0.62, z0 + 0.32, 0.12)
    lib.box("anvilfoot", (0.45, 0.32, 0.32), (0.6, -0.3, z0 + 0.16), k.dstone, bevel=0.03)
    lib.box("anvil", (0.85, 0.38, 0.17), (0.6, -0.3, z0 + 0.4), metal if iron else k.dstone, bevel=0.03)
    _tube("anvilhorn", (1.02, -0.3, z0 + 0.42), (1.32, -0.3, z0 + 0.4), 0.075, 0.01, metal if iron else k.dstone)
    lib.ball("hotiron", 0.06, (0.55, -0.3, z0 + 0.52), lava, sub=1).scale = (2.4, 0.8, 0.6)
    for i in range(7):
        light(k, f"spark{i}", 0.4 + 0.08 * i, -0.45 - 0.04 * (i % 3), z0 + 0.6 + 0.12 * ((i * 3) % 4), 0.012)
    # The god: broad and short-legged, a barrel of a body, the beard to his belt, an apron of leather.
    gx, gy = -0.25, 0.35
    pose = Pose((gx, gy, z0), 1.2, -25)
    pose.__enter__()
    body = Clay("w-smith", stone)
    for s in (-1, 1):
        body.taper((gx + s * 0.26, gy, z0 + 0.12), (gx + s * 0.24, gy, z0 + 0.62), 0.16, 0.19)  # legs
    body.ellipsoid((gx, gy, z0 + 0.82), 0.42, (1.15, 0.85, 0.75))  # hips
    body.ellipsoid((gx, gy - 0.05, z0 + 1.15), 0.5, (1.0, 0.85, 0.9))  # belly
    body.ellipsoid((gx, gy, z0 + 1.58), 0.48, (1.35, 0.85, 0.75))  # chest and shoulders
    for s in (-1, 1):
        body.ellipsoid((gx + s * 0.6, gy, z0 + 1.7), 0.2, (1.2, 1.0, 0.9))  # shoulder muscle
    body.capsule((gx, gy, z0 + 1.85), (gx, gy - 0.02, z0 + 2.0), 0.15)
    body.ellipsoid((gx, gy - 0.03, z0 + 2.12), 0.22, (0.95, 1.0, 1.05))  # head
    body.ellipsoid((gx, gy - 0.25, z0 + 2.1), 0.07, (0.9, 1.1, 1.1))  # nose
    for s in (-1, 1):
        body.ellipsoid((gx + s * 0.09, gy - 0.2, z0 + 2.2), 0.05, (1.4, 0.8, 0.6))  # brows
    # Right arm up with the hammer, left down to the tongs on the anvil.
    body.taper((gx + 0.66, gy, z0 + 1.72), (gx + 1.0, gy - 0.05, z0 + 2.2), 0.15, 0.13)
    body.ellipsoid((gx + 0.84, gy - 0.02, z0 + 1.98), 0.16, (1.0, 1.0, 1.4))  # biceps
    body.taper((gx + 1.0, gy - 0.05, z0 + 2.2), (gx + 0.92, gy - 0.12, z0 + 2.78), 0.13, 0.11)
    body.ball((gx + 0.91, gy - 0.12, z0 + 2.82), 0.12)  # fist
    body.taper((gx - 0.66, gy, z0 + 1.72), (gx - 0.62, gy - 0.4, z0 + 1.3), 0.15, 0.13)
    body.taper((gx - 0.62, gy - 0.4, z0 + 1.3), (gx + 0.1, gy - 0.62, z0 + 1.05), 0.13, 0.11)
    body.ball((gx + 0.14, gy - 0.63, z0 + 1.03), 0.11)
    scales(body.bake(), 0.005, 0.03, 3)
    for s in (-1, 1):
        lib.box(f"boot{s}", (0.34, 0.46, 0.16), (gx + s * 0.26, gy - 0.07, z0 + 0.08), k.dstone, bevel=0.04)
    # The beard, in braids down the belly, in a darker stone; the helm with horns.
    beardm = lib.mat("beardstone", (0.40, 0.38, 0.37) if not iron else (0.80, 0.62, 0.30), 0.7, 0.0 if not iron else 0.6, grain=0.3, grain_size=0.01)
    beard = Clay("w-beard", beardm)
    beard.ellipsoid((gx, gy - 0.24, z0 + 1.95), 0.2, (1.2, 0.6, 1.0))
    for x in (-0.12, 0.0, 0.12):
        beard.taper((gx + x, gy - 0.3, z0 + 1.85), (gx + x * 1.3, gy - 0.45, z0 + 1.2), 0.08, 0.05)
    beard.ellipsoid((gx, gy - 0.26, z0 + 2.04), 0.12, (2.0, 0.6, 0.5))  # moustache
    scales(beard.bake(), 0.01, 0.015, 4)
    for x in (-0.12, 0.0, 0.12):
        lib.cyl(f"braidring{x}", 0.06, 0.05, (gx + x * 1.2, gy - 0.4, z0 + 1.42), metal, verts=12)
    helm = Clay("w-helm", metal if iron else k.dstone)
    helm.ellipsoid((gx, gy - 0.02, z0 + 2.22), 0.25, (1.0, 1.0, 0.7))
    helm.ellipsoid((gx, gy - 0.02, z0 + 2.12), 0.27, (1.0, 1.0, 0.18))
    helm.bake()
    for s in (-1, 1):
        _tube(f"helmhorn{s}", (gx + s * 0.22, gy, z0 + 2.25), (gx + s * 0.5, gy - 0.05, z0 + 2.6), 0.07, 0.008, lib.mat("hornbone", (0.86, 0.82, 0.70), 0.6), 10)
    apron = Clay("w-apron", lib.mat("apron", (0.36, 0.24, 0.14), 0.8, grain=0.3, grain_size=0.01))
    apron.ellipsoid((gx, gy - 0.32, z0 + 0.95), 0.36, (1.0, 0.25, 1.3))
    apron.bake()
    lib.cyl("belt", 0.52, 0.11, (gx, gy - 0.02, z0 + 1.05), metal, verts=24).scale = (1.0, 0.86, 1)
    lib.box("buckle", (0.18, 0.04, 0.15), (gx, gy - 0.46, z0 + 1.05), metal, bevel=0.01)
    # The hammer, the tongs.
    _tube("haft", (gx + 0.91, gy - 0.12, z0 + 2.7), (gx + 0.88, gy - 0.12, z0 + 3.3), 0.04, 0.04, k.wood, 8)
    lib.box("hammerhead", (0.5, 0.27, 0.27), (gx + 0.88, gy - 0.12, z0 + 3.36), metal, bevel=0.035)
    _tube("tongs", (gx + 0.14, gy - 0.63, z0 + 1.03), (gx + 0.5, gy - 0.65, z0 + 0.6), 0.025, 0.02, k.dstone, 6)
    pose.__exit__(None, None, None)
    for x in (-2.0, 2.0):
        lamp(k, f"w-brazier{x}", x, -1.9, 0.5)
    k.flag(2.25, 2.25, 1.5)


# ---- the centaurs: the great rearing horse

def _horse(name, m, at, rear=40):
    """A horse rearing on its hind legs, facing -Y (toward the viewer), `rear` degrees up."""
    x0, y0, z0 = at
    up = math.sin(R(rear)), math.cos(R(rear))

    def p(along, side=0.0, high=0.0):
        """A point `along` the body's length (0 at the hips, + toward the head), `high` above its line."""
        return (x0 + side, y0 - along * up[1] - high * up[0], z0 + 0.95 + along * up[0] + high * up[1])

    c = Clay(name, m)
    c.ellipsoid(p(0.05), 0.33, (0.85, 1.0, 0.95))  # hindquarters
    c.ellipsoid(p(0.45), 0.3, (0.8, 1.0, 0.95))  # barrel
    c.ellipsoid(p(0.85, high=0.03), 0.31, (0.85, 1.0, 1.0))  # chest
    # The neck arched up from the chest, the head bent toward the viewer.
    neck = [p(0.95, high=0.12), p(1.1, high=0.32), p(1.2, high=0.55), p(1.22, high=0.75)]
    for i, q in enumerate(neck):
        c.ball(q, 0.2 - 0.025 * i)
    hx, hy, hz = neck[-1]
    c.capsule((hx, hy, hz), (hx, hy - 0.35, hz - 0.12), 0.11)  # head
    c.ball((hx, hy - 0.36, hz - 0.13), 0.085)  # muzzle
    for s in (-1, 1):
        c.capsule((hx + s * 0.06, hy + 0.04, hz + 0.08), (hx + s * 0.08, hy + 0.02, hz + 0.22), 0.025)  # ears
    # Hind legs on the ground: thigh, hock, cannon, hoof.
    for s in (-1, 1):
        hip = p(0.0, side=s * 0.17, high=-0.05)
        stifle = (x0 + s * 0.2, y0 + 0.05, z0 + 0.62)
        hock = (x0 + s * 0.2, y0 + 0.32, z0 + 0.35)
        hoof = (x0 + s * 0.2, y0 + 0.18, z0 + 0.06)
        c.taper(hip, stifle, 0.17, 0.12)
        c.taper(stifle, hock, 0.11, 0.07)
        c.taper(hock, hoof, 0.06, 0.05)
        c.ellipsoid(hoof, 0.065, (1.0, 1.2, 0.7))
    # Forelegs up and folded, striking.
    for s in (-1, 1):
        sh = p(0.82, side=s * 0.17, high=-0.12)
        knee = (sh[0] + s * 0.02, sh[1] - 0.32, sh[2] + 0.05)
        hoof = (knee[0], knee[1] + 0.05 + 0.08 * s, knee[2] - 0.3 + 0.08 * s)
        c.taper(sh, knee, 0.11, 0.07)
        c.taper(knee, hoof, 0.065, 0.05)
        c.ellipsoid(hoof, 0.06, (1.0, 1.2, 0.7))
    body = c.bake()
    # Mane and tail flying, in strands.
    hair = Clay(f"{name}-hair", m)
    for i, q in enumerate(neck):
        for j in range(2):
            hair.taper((q[0], q[1] + 0.12, q[2] + 0.1), (q[0] + 0.12 + 0.05 * j, q[1] + 0.3, q[2] + 0.05 + 0.06 * j), 0.05, 0.015, n=4)
    tail0 = p(-0.15, high=0.12)
    for j in range(4):
        hair.taper(tail0, (tail0[0] + (j - 1.5) * 0.08, tail0[1] + 0.55, tail0[2] - 0.55 + 0.1 * j), 0.07, 0.02, n=6)
    hair.bake()
    return body, neck[-1]


def centaur(k):
    iron = k.tier >= 3
    k.ground(5, k.yard)
    metal = lib.mat("horsebronze", (0.56, 0.38, 0.20), 0.3, 0.85) if not iron else k.gold
    cy = 0.25
    z0 = _round_plinth([(2.25, 0.14), (1.65, 0.2), (1.2, 0.24)], cy, k.canvas2, k.gold)
    # A ring of standing stones about the square, a way in toward the viewer.
    for i in range(14):
        a = R(360 / 14 * i)
        if math.sin(a) < -0.8:
            continue
        lib.box(f"w-stone{i}", (0.18, 0.13, 0.8), (math.cos(a) * 2.35, cy + math.sin(a) * 2.3, 0.4), k.canvas2, rot=(0, 0, a))
        lib.box(f"w-stonecap{i}", (0.22, 0.17, 0.05), (math.cos(a) * 2.35, cy + math.sin(a) * 2.3, 0.82), k.canvas2, rot=(0, 0, a))
    with Pose((0.0, cy + 0.15, z0), 1.6, -20):
        body, head = _horse("w-horse", metal, (0.0, cy + 0.15, z0), rear=42)
        scales(body, 0.003, 0.02, 5)
    if iron:
        pass  # the eye moves with the horse: see below
        # The star-globe on a column before the plinth.
        lib.cyl("w-column", 0.07, 0.6, (1.45, -1.3, 0.3), k.canvas2, verts=12)
        lib.ball("w-globe", 0.17, (1.45, -1.3, 0.75), k.gold, sub=3)
        for rot in ((R(90), 0, R(20)), (R(90), 0, R(-50))):
            lib.cyl(f"w-globering{rot[2]:.1f}", 0.22, 0.015, (1.45, -1.3, 0.75), k.gold, rot=rot, verts=24)
    _lamps(k, 6, 1.95, 1.85, cy, 0.45)
    k.flag(2.25, 2.25, 1.5)


# ---- the beastfolk: a dragon on its crag

def beastfolk(k):
    iron = k.tier >= 3
    k.ground(5, k.yard)
    scale_m = lib.mat("dragonscale", (0.46, 0.14, 0.11) if not iron else (0.60, 0.13, 0.09), 0.45, 0.2 if iron else 0.0, grain=0.4, grain_size=0.006)
    belly_m = lib.mat("dragonbelly", (0.80, 0.62, 0.34), 0.55, grain=0.25, grain_size=0.01)
    bone = lib.mat("dragonhorn", (0.90, 0.85, 0.72), 0.5)
    rock = lib.mat("crag", (0.40, 0.38, 0.36), 0.95, grain=0.45, grain_size=0.04)
    # A low crag, so the dragon stands clear on it.
    crag = Clay("w-crag", rock, resolution=0.06)
    crag.ellipsoid((0, 0.5, 0.25), 1.2, (1.4, 1.1, 0.45))
    crag.ellipsoid((-0.7, 0.9, 0.5), 0.6, (1.0, 1.0, 0.8))
    crag.ellipsoid((0.6, 0.95, 0.42), 0.5, (1.0, 1.0, 0.8))
    lib.lumpy(crag.bake(), 0.1, 0.25, 31)
    zb = 0.7  # the top of the crag
    # The body crouched on the crag, chest up, toward the viewer.
    body = Clay("w-dragon", scale_m)
    spine = [(0.0, 1.0, zb + 0.35), (0.0, 0.7, zb + 0.45), (0.0, 0.4, zb + 0.6), (0.0, 0.15, zb + 0.78)]
    for i, q in enumerate(spine):
        body.ellipsoid(q, 0.3 + 0.02 * i, (1.0, 1.25, 0.9))
    # The neck rising in an S, the head thrust forward and down at the viewer, jaws open.
    neck = [(0.0, 0.0, zb + 1.0), (0.02, -0.05, zb + 1.25), (0.04, -0.02, zb + 1.5), (0.04, -0.15, zb + 1.72), (0.03, -0.35, zb + 1.82)]
    for i, q in enumerate(neck):
        body.ball(q, 0.21 - 0.022 * i)
    hx, hy, hz = neck[-1]
    body.ellipsoid((hx, hy - 0.12, hz + 0.03), 0.17, (0.95, 1.25, 0.8))  # skull
    body.capsule((hx, hy - 0.2, hz + 0.0), (hx, hy - 0.52, hz - 0.06), 0.09)  # upper jaw
    for s in (-1, 1):
        body.ellipsoid((hx + s * 0.1, hy - 0.08, hz + 0.1), 0.06, (1.0, 1.3, 0.8))  # brows over the eyes
        body.ball((hx + s * 0.05, hy - 0.52, hz - 0.03), 0.035)  # nostrils
    # Four legs gripping the crag.
    legs = [((0.25, 0.25, zb + 0.6), (0.38, 0.0, zb + 0.3), (0.42, -0.2, zb + 0.05)), ((-0.25, 0.25, zb + 0.6), (-0.38, 0.0, zb + 0.3), (-0.42, -0.2, zb + 0.05)),
            ((0.25, 0.95, zb + 0.35), (0.42, 0.85, zb + 0.15), (0.45, 0.65, zb - 0.05)), ((-0.25, 0.95, zb + 0.35), (-0.42, 0.85, zb + 0.15), (-0.45, 0.65, zb - 0.05))]
    for a, b, c in legs:
        body.taper(a, b, 0.14, 0.09)
        body.taper(b, c, 0.09, 0.06)
    # The tail down the crag and round its foot toward the viewer.
    tail = [(0.0, 1.15, zb + 0.25), (0.2, 1.45, zb + 0.05), (0.6, 1.5, 0.35), (1.0, 1.15, 0.22), (1.3, 0.6, 0.12), (1.35, 0.0, 0.08), (1.15, -0.45, 0.06)]
    for i in range(len(tail) - 1):
        body.taper(tail[i], tail[i + 1], 0.2 * (1 - i / 7) + 0.04, 0.2 * (1 - (i + 1) / 7) + 0.03, n=5)
    scales(body.bake(), 0.014, 0.025, 6)
    # The lower jaw apart from the head, open; teeth; fire in the throat.
    jaw = Clay("w-jaw", belly_m)
    jaw.capsule((hx, hy - 0.15, hz - 0.12), (hx, hy - 0.45, hz - 0.26), 0.07)
    jaw.bake()
    for s in (-1, 1):
        for j in range(4):
            yy = hy - 0.25 - 0.07 * j
            _tube(f"tooth{s}{j}", (hx + s * 0.06, yy, hz - 0.08), (hx + s * 0.06, yy, hz - 0.15), 0.014, 0.002, bone, 5)
    light(k, "w-throat", hx, hy - 0.4, hz - 0.15, 0.06 if iron else 0.04)
    # The belly plates, paler, down the throat and chest.
    belly = Clay("w-belly", belly_m)
    for i, q in enumerate(neck[:4] + spine[2:]):
        belly.ellipsoid((q[0], q[1] - 0.15, q[2] - 0.05), 0.13, (1.0, 0.6, 1.1))
    scales(belly.bake(), 0.01, 0.04, 7)
    # Horns swept back, a crest of spikes down the neck, back and tail.
    for s in (-1, 1):
        _tube(f"horn{s}", (hx + s * 0.1, hy - 0.05, hz + 0.15), (hx + s * 0.26, hy + 0.35, hz + 0.45), 0.055, 0.004, bone, 8)
        _tube(f"hornb{s}", (hx + s * 0.13, hy - 0.02, hz + 0.05), (hx + s * 0.38, hy + 0.25, hz + 0.08), 0.035, 0.003, bone, 6)
        light(k, f"eye{s}", hx + s * 0.09, hy - 0.2, hz + 0.08, 0.025)
    crest = neck[:-1][::-1] + spine[::-1]
    for i, q in enumerate(crest):
        _tube(f"spike{i}", (q[0], q[1] + 0.1, q[2] + 0.14), (q[0], q[1] + 0.22, q[2] + 0.38 - 0.02 * i), 0.05, 0.003, bone, 6)
    for i in range(1, len(tail) - 1):
        q = tail[i]
        _tube(f"tailspike{i}", (q[0], q[1], q[2] + 0.14), (q[0], q[1], q[2] + 0.3 - 0.02 * i), 0.04, 0.003, bone, 5)
    _tube("tailblade", tail[-1], (tail[-1][0] - 0.2, tail[-1][1] - 0.3, tail[-1][2] + 0.05), 0.07, 0.004, bone, 6)
    # Claws on each foot.
    for i, (_, _, c) in enumerate(legs):
        for j in range(3):
            _tube(f"claw{i}{j}", c, (c[0] + (j - 1) * 0.06, c[1] - 0.14, c[2] - 0.06), 0.022, 0.002, bone, 5)
    # Wings raised wide: an arm of bone to the wrist, fingers spreading, skin between them.
    membrane = lib.mat("wingskin", (0.34, 0.10, 0.09) if not iron else (0.46, 0.12, 0.08), 0.7)
    shoulder = spine[2]
    for s in (-1, 1):
        root = (shoulder[0] + s * 0.25, shoulder[1], shoulder[2] + 0.15)
        wrist = (root[0] + s * 0.75, root[1] + 0.15, root[2] + 0.8)
        _tube(f"wingarm{s}", root, wrist, 0.06, 0.04, scale_m, 10)
        fingers = [(wrist[0] + s * (0.35 + 0.35 * j), wrist[1] + 0.2 + 0.12 * j, wrist[2] + 0.35 - 0.45 * j) for j in range(4)]
        for j, f in enumerate(fingers):
            _tube(f"finger{s}{j}", wrist, f, 0.03, 0.006, bone, 6)
        _fan(f"wing{s}", [wrist, root, *fingers[::-1], (root[0] + s * 0.4, root[1] + 0.45, root[2] - 0.15)][::1], membrane)
    # Totems and fires round the crag; the hoard of the Iron Age.
    for i in range(4):
        a = R(90 * i + 45)
        k.totem(f"w-totem{i}", math.cos(a) * 2.15, 0.25 + math.sin(a) * 2.05, 1.1 + 0.2 * (i % 2))
    for x in (-1.0, 1.0):
        lamp(k, f"w-fire{x}", x, -1.95, 0.1)
    if iron:
        gold = lib.mat("hoardgold", (0.95, 0.78, 0.30), 0.3, 0.9)
        hoard = Clay("w-hoard", gold)
        for i in range(7):
            hoard.ellipsoid((-0.8 + 0.12 * i, -0.75 + 0.03 * (i % 2), 0.05), 0.12, (1.2, 1.0, 0.45))
        hoard.bake()
    for i in range(3):
        k.skull(-0.5 + i * 0.5, -1.45, 0.06)
    k.flag(2.25, 2.25, 1.5)


WONDERS = {"elf": elf, "dwarf": dwarf, "centaur": centaur, "beastfolk": beastfolk}
