# The buildings each architecture makes its own: the Town Center, the Temple, the Government Center and the
# Wonder, the ones a player tells a civilization by. The rest take the shared plans in buildings.py with
# arch.py's walls, roofs, doors and columns.
#
#   Egyptian    pylon gates, papyrus halls, the pyramid
#   Babylonian  walled courts with glazed gates, the ziggurat, the terraced gardens
#   Asian       palace halls on terraces, the pagoda
#   Greek       the stoa, the temple on its acropolis
#   Roman       the basilica, the domed temple, the arena

import math

import lib
import buildings as b
from arch import (arch_door, asian_roof, columns, cornice, crenels, hall, lantern, obelisk, palm, pediment, statue,
                  tapered)

R = math.radians


def pylon_gate(st, name, x, y, w=1.4, h=0.95, depth=0.35):
    """Two leaning towers either side of a doorway, a cornice on each, the player's pennants on masts."""
    tw = w * 0.38
    for sx in (-1, 1):
        cx = x + sx * (w / 2 - tw / 2)
        tapered(f"{name}-pylon{sx}", tw, depth, h, (cx, y, 0), st.wall, top=0.8)
        cornice(st, f"{name}-pc{sx}", cx, y, tw * 0.8, depth * 0.8, h)
        lib.box(f"{name}-relief{sx}", (tw * 0.5, 0.01, h * 0.35), (cx, y - depth / 2 + 0.02, h * 0.5), st.accent)
        lib.cyl(f"{name}-mast{sx}", 0.012, h + 0.45, (cx + sx * tw * 0.2, y - depth / 2 - 0.03, (h + 0.45) / 2), st.wood, verts=6)
        lib.box(f"{name}-pennant{sx}", (0.02, 0.18, 0.1), (cx + sx * tw * 0.2, y - depth / 2 - 0.12, h + 0.35), st.team)
    gap = w - 2 * tw
    lib.box(f"{name}-gatewall", (gap, depth * 0.7, h * 0.7), (x, y, h * 0.35), st.wall)
    cornice(st, f"{name}-gc", x, y, gap, depth * 0.65, h * 0.7)
    lib.box(f"{name}-gatedoor", (gap * 0.6, 0.03, h * 0.55), (x, y - depth * 0.36, h * 0.275), st.dark)


def egyptian_town_center(st):
    b.ground(3, (0.74, 0.64, 0.46))
    h = 0.6 + 0.08 * st.i
    hall(st, "hall", 0.0, 0.35, 2.0, 1.5, h)
    if st.i >= 2:
        hall(st, "upper", 0.45, 0.6, 0.8, 0.7, h + 0.3)
    pylon_gate(st, "gate", 0.0, -0.55, w=1.6, h=h + 0.35)
    b.flag(st, -0.75, 0.75, h + 0.9)
    b.tc_yard(st)


def egyptian_temple(st):
    b.ground(3, (0.80, 0.72, 0.54))
    # A hall of papyrus columns behind a pylon gate.
    b.paving("court", 2.2, 1.6, (0, 0.35, 0.02), color=(0.80, 0.74, 0.60))  # stone flags, weeds in the joints
    hall(st, "sanctuary", 0, 0.8, 1.6, 0.8, 0.85)
    columns(st, -0.85, 0.85, 0.15, 0.75, 5, r=0.06)
    lib.box("architrave", (1.9, 0.18, 0.08), (0, 0.15, 0.79), st.trim)
    lib.box("architrave-band", (1.92, 0.19, 0.025), (0, 0.15, 0.76), st.accent)
    pylon_gate(st, "gate", 0, -0.65, w=2.0, h=1.15, depth=0.4)


def egyptian_wonder(st):
    b.ground(5, (0.84, 0.74, 0.52))
    # A pyramid with a gilded cap, a gate and obelisks at its foot.
    s, h = 4.0, 2.4
    lib.cyl("pyramid", s / math.sqrt(2), h, (0, 0.2, h / 2), st.trim, verts=4, r2=0.04, rot=(0, 0, R(45)), smooth_it=False)
    gold = lib.mat("gold", (0.95, 0.78, 0.30), 0.3, metal=0.9)
    lib.cyl("cap", 0.2, 0.25, (0, 0.2, h - 0.1), gold, verts=4, r2=0.0, rot=(0, 0, R(45)), smooth_it=False)
    pylon_gate(st, "gate", 0, -1.9, w=1.6, h=0.8)
    for x in (-1.4, 1.4):
        obelisk(st, f"obl{x}", x, -2.1, 1.0)


def egyptian_government_center(st):
    b.ground(3, (0.78, 0.70, 0.52))
    hall(st, "hall", 0, 0.45, 2.2, 1.2, 0.85)
    columns(st, -0.95, 0.95, -0.35, 0.8, 6, r=0.06)
    lib.box("portico-roof", (2.2, 0.6, 0.08), (0, -0.2, 0.84), st.trim)
    cornice(st, "portico", 0, -0.2, 2.1, 0.55, 0.88)
    b.banner(st, -0.5, -0.12, 0.5)
    b.banner(st, 0.5, -0.12, 0.5)
    b.flag(st, 0.9, 0.9, 1.6)


def ziggurat(st, name, x, y, base, tiers, step_h, shrink=0.72, shrine=True):
    """Terraces one on another, banded in glaze, a stair up the front, a shrine on top."""
    z, w = 0.0, base
    for k in range(tiers):
        lib.box(f"{name}-t{k}", (w, w, step_h), (x, y, z + step_h / 2), st.wall, bevel=0.01)
        lib.box(f"{name}-glaze{k}", (w + 0.01, w + 0.01, step_h * 0.18), (x, y, z + step_h * 0.82), st.accent if k % 2 == 0 else st.accent2)
        z += step_h
        w *= shrink
    slope = math.atan2(z, base * 0.5)
    lib.box(f"{name}-stair", (base * 0.18, base * 0.62, 0.03), (x, y - base * 0.3, z * 0.48), st.trim, rot=(-slope, 0, 0))
    if shrine:
        lib.box(f"{name}-shrine", (w * 0.8, w * 0.8, step_h * 0.9), (x, y, z + step_h * 0.45), st.accent, bevel=0.01)
        crenels(st, f"{name}-sh", x, y, w * 0.8, w * 0.8, z + step_h * 0.9, m=st.accent, size=0.06)
    return z


def babylonian_town_center(st):
    b.ground(3, (0.70, 0.58, 0.42))
    h = 0.65 + 0.08 * st.i
    hall(st, "hall", 0.1, 0.35, 1.9, 1.4, h)
    for sx in (-1, 1):
        lib.box(f"tower{sx}", (0.42, 0.42, h + 0.3), (sx * 0.85, -0.45, (h + 0.3) / 2), st.wall, bevel=0.01)
        crenels(st, f"tw{sx}", sx * 0.85, -0.45, 0.42, 0.42, h + 0.3, size=0.08)
    # The gate wall of brick with a band of blue glaze: the whole of it glazed, with lions, read as a block
    # and was taken out (replica/art-plan.md, round 1).
    lib.box("gatewall", (1.3, 0.3, h * 0.8), (0, -0.45, h * 0.4), st.wall)
    if st.i >= 2:
        lib.box("gateglaze", (1.31, 0.31, 0.08), (0, -0.45, h * 0.62), st.accent)
    crenels(st, "gw", 0, -0.45, 1.3, 0.3, h * 0.8, size=0.08)
    arch_door(st, 0, -0.61, 0.36, 0.55)
    b.flag(st, 0.85, 0.9, h + 0.8)
    b.tc_yard(st)


def babylonian_temple(st):
    b.ground(3, (0.72, 0.60, 0.44))
    ziggurat(st, "zig", 0, 0.15, 2.4, 3, 0.36)
    b.flag(st, 1.1, 1.1, 1.2)


def babylonian_wonder(st):
    b.ground(5, (0.70, 0.60, 0.44))
    # The terraced gardens: a great ziggurat green with trees on every step.
    top = ziggurat(st, "garden", 0, 0.2, 4.2, 4, 0.48, shrink=0.75)
    green = lib.mat("garden", (0.30, 0.52, 0.22), 0.8, grain=0.35, grain_size=0.03)
    w = 4.2
    for k in range(4):
        z = 0.48 * (k + 1)
        for j in range(6):
            a = 2 * math.pi * j / 6 + k
            bush = lib.ball(f"bush{k}{j}", 0.13, (math.cos(a) * w * 0.4, 0.2 + math.sin(a) * w * 0.4, z + 0.06), green, scale=(1.3, 1, 0.8), sub=2)
            lib.lumpy(bush, 0.03, 0.08)
        w *= 0.75
    palm(st, "gpalm", 0.3, 0.3, top + 0.7)


def babylonian_government_center(st):
    b.ground(3, (0.72, 0.60, 0.44))
    # The apadana: a hall of columns with bull capitals under a crenellated roof.
    hall(st, "hall", 0, 0.4, 2.2, 1.3, 0.85)
    columns(st, -0.95, 0.95, -0.4, 0.75, 6, r=0.05)
    lib.box("apadana-roof", (2.2, 0.55, 0.08), (0, -0.2, 0.8), st.trim)
    crenels(st, "ap", 0, -0.2, 2.2, 0.55, 0.84, size=0.08)
    b.flag(st, 0.9, 0.9, 1.6)


def pagoda(st, name, x, y, base, tiers, storey=0.34):
    """A tower of storeys, each under its own up-turned roof, a spire of rings on top."""
    lib.box(f"{name}-podium", (base + 0.3, base + 0.3, 0.14), (x, y, 0.07), st.accent2, bevel=0.01)
    z, w = 0.14, base
    for k in range(tiers):
        lib.box(f"{name}-storey{k}", (w, w, storey), (x, y, z + storey / 2), st.wall, bevel=0.01)
        for sx in (-1, 1):
            lib.box(f"{name}-post{k}{sx}", (0.05, 0.05, storey), (x + sx * w / 2, y - w / 2, z + storey / 2), st.trim)
        lib.box(f"{name}-door{k}", (w * 0.3, 0.03, storey * 0.6), (x, y - w / 2 - 0.01, z + storey * 0.35), st.dark)
        z = asian_roof(st, f"{name}-r{k}", x, y, w, w, z + storey) - 0.05
        w *= 0.8
    lib.cyl(f"{name}-spire", 0.03, 0.5, (x, y, z + 0.25), st.accent, verts=8)
    for k in range(4):
        lib.cyl(f"{name}-ring{k}", 0.06 - k * 0.01, 0.02, (x, y, z + 0.1 + k * 0.08), st.accent, verts=10)
    return z


def asian_town_center(st):
    b.ground(3, (0.62, 0.58, 0.50))
    lib.box("terrace", (2.5, 2.1, 0.16), (0, 0.15, 0.08), st.accent2, bevel=0.01)
    for k in range(3):
        lib.box(f"stair{k}", (0.6, 0.12, 0.05 * (3 - k)), (0, -0.97 + k * 0.1, 0.025 * (3 - k)), st.accent2)
    # The hall on the terrace, two roofs high, a gate of red posts before it.
    h = 0.62 + 0.06 * st.i
    hall(st, "hall", 0, 0.3, 2.0, 1.3, h)
    for sx in (-1, 1):
        lib.cyl(f"gatepost{sx}", 0.05, 0.75, (sx * 0.45, -1.1, 0.375), st.trim, verts=10)
    lib.box("gatebeam", (1.2, 0.08, 0.07), (0, -1.1, 0.72), st.trim)
    lib.box("gatebeam2", (1.0, 0.06, 0.05), (0, -1.1, 0.6), st.trim)
    b.flag(st, 1.0, 0.95, h + 1.0)
    b.tc_yard(st)


def asian_temple(st):
    b.ground(3, (0.60, 0.56, 0.48))
    pagoda(st, "pagoda", 0.1, 0.2, 1.2, 3)


def asian_wonder(st):
    b.ground(5, (0.60, 0.56, 0.48))
    pagoda(st, "great", 0, 0.3, 2.3, 5, storey=0.42)
    for x in (-1.9, 1.9):
        lantern(st, f"wl{x}", x, -1.9)


def asian_government_center(st):
    b.ground(3, (0.62, 0.58, 0.50))
    lib.box("terrace", (2.4, 1.9, 0.12), (0, 0.15, 0.06), st.accent2, bevel=0.01)
    hall(st, "hall", 0, 0.25, 2.1, 1.3, 0.75)
    b.flag(st, 1.0, 0.95, 1.8)


def greek_town_center(st):
    b.ground(3, (0.70, 0.66, 0.56))
    # A stoa: a long hall behind a row of columns, under a pediment.
    base = b.steps(st, 0, 0.1, 2.3, 1.8) if st.i >= 2 else 0.0
    h = 0.62 + 0.08 * st.i
    lib.box("hall", (2.1, 1.0, h), (0, 0.5, base + h / 2), st.wall, bevel=0.01)
    columns(st, -1.0, 1.0, -0.15, h, 6 if st.i >= 2 else 4)
    pediment(st, "roof", 0, 0.25, 2.2, 1.55, base + h)
    b.door(st, 0, -0.01, 0.3, 0.45)
    b.flag(st, 1.05, 1.05, h + 1.1)
    b.tc_yard(st)


def greek_wonder(st):
    b.ground(5, (0.72, 0.68, 0.58))
    # A great temple on a raised acropolis, columns all round.
    lib.box("acropolis", (4.4, 4.0, 0.3), (0, 0.2, 0.15), lib.mat("rock", (0.60, 0.56, 0.48), 0.95, grain=0.3), bevel=0.05)
    base = 0.3
    for k in range(3):
        lib.box(f"wstep{k}", (3.4 - k * 0.15, 2.6 - k * 0.15, 0.06), (0, 0.3, base + 0.03 + k * 0.06), st.trim)
    base += 0.18
    lib.box("cella", (2.4, 1.6, 1.0), (0, 0.3, base + 0.5), st.wall)
    for y in (-0.85, 1.45):
        columns(st, -1.5, 1.5, y, 1.1, 8, r=0.07)
    for x in (-1.5, 1.5):
        for k, y in enumerate((-0.35, 0.3, 0.95)):
            lib.cyl(f"wcol{x}{k}", 0.075, 1.1, (x, y, base + 0.55), st.trim, verts=20, smooth_it=False)
    pediment(st, "wroof", 0, 0.3, 3.2, 2.5, base + 1.1)
    statue(st, "athena", 1.8, -1.6, 0.7)


def greek_government_center(st):
    b.ground(3, (0.70, 0.66, 0.56))
    base = b.steps(st, 0, 0.1, 2.3, 1.9)
    # The bouleuterion: a hall with a columned porch.
    lib.box("hall", (2.0, 1.2, 0.85), (0, 0.4, base + 0.425), st.wall, bevel=0.01)
    columns(st, -0.95, 0.95, -0.45, 0.85, 6)
    pediment(st, "roof", 0, 0.1, 2.1, 1.85, base + 0.85)
    b.flag(st, 1.05, 1.05, 2.0)


def roman_town_center(st):
    b.ground(3, (0.72, 0.66, 0.56))
    # A basilica: a tall nave over arcaded aisles.
    h = 0.6 + 0.08 * st.i
    lib.box("aisles", (2.2, 1.5, h), (0, 0.25, h / 2), st.wall, bevel=0.01)
    for k in range(5):
        arch_door(st, -0.8 + k * 0.4, -0.51, 0.22, h * 0.75)
    lib.box("nave", (1.4, 1.5, 0.4), (0, 0.25, h + 0.2), st.wall)
    b.prism("naveroof", 1.55, 1.65, 0.35, (0, 0.25, h + 0.4), st.roof, "y")
    b.prism("aisleroof", 2.35, 1.65, 0.18, (0, 0.25, h), st.roof, "x")
    b.flag(st, 1.0, 1.0, h + 1.2)
    b.tc_yard(st)


def roman_temple(st):
    b.ground(3, (0.72, 0.68, 0.58))
    # A round temple under a dome, a columned porch before it.
    base = b.steps(st, 0, 0.0, 2.2, 2.2, n=3)
    lib.cyl("rotunda", 0.85, 0.8, (0, 0.35, base + 0.4), st.wall, verts=32)
    dome = lib.mat("dome", (0.66, 0.66, 0.62), 0.6) if st.i >= 3 else st.roof
    lib.ball("dome", 0.86, (0, 0.35, base + 0.8), dome, scale=(1, 1, 0.6), sub=3)
    lib.cyl("oculus", 0.12, 0.05, (0, 0.35, base + 1.3), st.trim, verts=16)
    columns(st, -0.6, 0.6, -0.65, 0.8, 4, r=0.05)
    pediment(st, "porch", 0, -0.45, 1.4, 0.6, base + 0.8)


def tube(name, r, thick, h, loc, m, verts=48):
    """An open ring of wall, `thick` deep inward: an arena's walls and the rows of its seats."""
    bpy = lib.bpy
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, end_fill_type="NOTHING")
    o = bpy.context.object
    o.name = name
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = 1.0
    mod.use_rim = True
    lib.setmat(o, m)
    return o


def roman_wonder(st):
    b.ground(5, (0.72, 0.66, 0.56))
    # The great arena: an oval of arches in three storeys, the near half open to view.
    for k in range(3):
        z = k * 0.6
        tube(f"ring{k}", 2.1 - k * 0.02, 0.12, 0.6, (0, 0.2, z + 0.3), st.wall)
        n = 20
        for j in range(n):
            a = 2 * math.pi * j / n
            if math.sin(a) > 0.35:
                continue  # the far side is out of sight
            ax, ay = math.cos(a) * 2.23, 0.2 + math.sin(a) * 2.23
            lib.cyl(f"arch{k}{j}", 0.12, 0.04, (ax, ay, z + 0.3), st.dark, rot=(R(90), 0, a + R(90)), verts=12)
            lib.box(f"archlow{k}{j}", (0.24, 0.04, 0.18), (ax, ay, z + 0.18), st.dark, rot=(0, 0, a + R(90)))
        tube(f"cornice{k}", 2.14, 0.18, 0.05, (0, 0.2, z + 0.6), st.trim)
    # The seats: rings stepping down inward to the sand, so the bowl shows from above.
    seats = lib.mat("seats", (0.70, 0.64, 0.54), 0.9)
    for k in range(6):
        top = 1.7 - k * 0.27
        tube(f"seats{k}", 1.98 - k * 0.15, 0.16, top, (0, 0.2, top / 2), seats if k % 2 else st.trim, verts=40)
    lib.cyl("arena", 1.1, 0.12, (0, 0.2, 0.06), lib.mat("sand", (0.86, 0.78, 0.58), 1.0), verts=40)
    b.flag(st, 1.5, -1.3, 2.4)


def roman_government_center(st):
    b.ground(3, (0.72, 0.66, 0.56))
    base = b.steps(st, 0, 0.1, 2.2, 1.9)
    lib.box("curia", (1.8, 1.3, 0.9), (0, 0.35, base + 0.45), st.wall, bevel=0.01)
    columns(st, -0.85, 0.85, -0.45, 0.85, 6)
    pediment(st, "roof", 0, 0.05, 1.9, 1.8, base + 0.9)
    lib.ball("dome", 0.4, (0, 0.55, base + 1.35), lib.mat("dome", (0.66, 0.66, 0.62), 0.6), scale=(1, 1, 0.7), sub=3)
    b.flag(st, 1.0, 1.0, 2.2)


SPECIAL = {
    ("egyptian", "town_center"): egyptian_town_center, ("egyptian", "temple"): egyptian_temple,
    ("egyptian", "wonder"): egyptian_wonder, ("egyptian", "government_center"): egyptian_government_center,
    ("babylonian", "town_center"): babylonian_town_center, ("babylonian", "temple"): babylonian_temple,
    ("babylonian", "wonder"): babylonian_wonder, ("babylonian", "government_center"): babylonian_government_center,
    ("asian", "town_center"): asian_town_center, ("asian", "temple"): asian_temple,
    ("asian", "wonder"): asian_wonder, ("asian", "government_center"): asian_government_center,
    ("greek", "town_center"): greek_town_center, ("greek", "wonder"): greek_wonder,
    ("greek", "government_center"): greek_government_center,
    ("roman", "town_center"): roman_town_center, ("roman", "temple"): roman_temple,
    ("roman", "wonder"): roman_wonder, ("roman", "government_center"): roman_government_center,
}
