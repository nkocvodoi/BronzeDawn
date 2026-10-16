# The five architectures, as the original sorts its civilizations: Egyptian (Assyrians, Egyptians,
# Sumerians), Babylonian (Babylonians, Hittites, Persians), Asian (Choson, Shang, Yamato, Lac Viet), Greek
# (Greeks, Minoans, Phoenicians) and Roman (Carthaginians, Macedonians, Palmyrans, Romans). Each has its own
# walls, roofs, doors and columns, and a few things of its own about its buildings, from the Tool Age on (the
# Stone Age's huts, in stoneage.py, are everyone's). Everything here is our own, modelled in code: the shapes
# of the ancient buildings themselves, not anyone's pictures of them.
#
# buildings.py calls in here when a Style has an architecture: hall() for walls and a roof, door(), columns(),
# and decorate() once a building is up. Same conventions: one unit is one tile, the front faces -Y.

import math

import lib

R = math.radians
ARCHES = ["egyptian", "babylonian", "asian", "greek", "roman"]


def palette(arch, i):
    """Colours of an architecture in an age (i: 1 Tool, 2 Bronze, 3 Iron): walls, roofs, trim, and a colour
    of its own (the Egyptians' blue, the Babylonians' glazed tiles, the Asians' red lacquer)."""
    t = min(max(i, 1), 3) - 1
    return {
        "egyptian": dict(wall=[(0.80, 0.66, 0.46), (0.88, 0.76, 0.54), (0.92, 0.84, 0.66)][t],
                         roof=[(0.62, 0.50, 0.30), (0.78, 0.66, 0.46), (0.86, 0.78, 0.60)][t],
                         trim=[(0.66, 0.52, 0.34), (0.94, 0.88, 0.72), (0.97, 0.93, 0.82)][t],
                         accent=(0.16, 0.46, 0.60), accent2=(0.70, 0.26, 0.16)),
        "babylonian": dict(wall=[(0.70, 0.56, 0.38), (0.74, 0.56, 0.38), (0.70, 0.50, 0.34)][t],
                           roof=[(0.58, 0.46, 0.30), (0.64, 0.50, 0.34), (0.60, 0.46, 0.32)][t],
                           trim=[(0.62, 0.48, 0.32), (0.86, 0.76, 0.56), (0.90, 0.82, 0.62)][t],
                           accent=(0.14, 0.30, 0.62), accent2=(0.90, 0.72, 0.28)),
        "asian": dict(wall=[(0.76, 0.66, 0.50), (0.90, 0.86, 0.78), (0.93, 0.90, 0.84)][t],
                      roof=[(0.50, 0.42, 0.28), (0.32, 0.38, 0.36), (0.24, 0.28, 0.30)][t],
                      trim=[(0.44, 0.26, 0.14), (0.58, 0.16, 0.10), (0.62, 0.14, 0.10)][t],
                      accent=(0.86, 0.68, 0.26), accent2=(0.40, 0.40, 0.38)),
        "greek": dict(wall=[(0.78, 0.68, 0.52), (0.92, 0.89, 0.82), (0.95, 0.94, 0.90)][t],
                      roof=[(0.66, 0.46, 0.28), (0.74, 0.38, 0.24), (0.70, 0.34, 0.22)][t],
                      trim=[(0.62, 0.50, 0.34), (0.94, 0.92, 0.86), (0.98, 0.97, 0.94)][t],
                      accent=(0.20, 0.36, 0.62), accent2=(0.70, 0.22, 0.18)),
        "roman": dict(wall=[(0.72, 0.56, 0.42), (0.82, 0.64, 0.50), (0.86, 0.70, 0.56)][t],
                      roof=[(0.64, 0.36, 0.24), (0.66, 0.30, 0.20), (0.62, 0.28, 0.20)][t],
                      trim=[(0.70, 0.62, 0.50), (0.88, 0.84, 0.74), (0.93, 0.90, 0.82)][t],
                      accent=(0.62, 0.12, 0.10), accent2=(0.84, 0.70, 0.30)),
    }[arch]


# ---- shapes of its own

def mesh(name, verts, faces, m):
    bpy = lib.bpy
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    lib.link(o)
    lib.setmat(o, m)
    return o


def tapered(name, w, d, h, loc, m, top=0.88):
    """A block whose sides lean in as they rise, `top` its width at the top: Egyptian walls and pylons."""
    x, y, z = loc
    a, b = w / 2, d / 2
    c, e = a * top, b * top
    v = [(x - a, y - b, z), (x + a, y - b, z), (x + a, y + b, z), (x - a, y + b, z),
         (x - c, y - e, z + h), (x + c, y - e, z + h), (x + c, y + e, z + h), (x - c, y + e, z + h)]
    f = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return mesh(name, v, f, m)


def hip(name, w, d, h, loc, m, ridge=0.45):
    """A hipped roof, its ridge along the longer side, `ridge` of that side long."""
    x, y, z = loc
    a, b = w / 2, d / 2
    if w >= d:
        r = a * ridge
        v = [(x - a, y - b, z), (x + a, y - b, z), (x + a, y + b, z), (x - a, y + b, z), (x - r, y, z + h), (x + r, y, z + h)]
        f = [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (0, 3, 2, 1)]
    else:
        r = b * ridge
        v = [(x - a, y - b, z), (x + a, y - b, z), (x + a, y + b, z), (x - a, y + b, z), (x, y - r, z + h), (x, y + r, z + h)]
        f = [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5), (0, 3, 2, 1)]
    return mesh(name, v, f, m)


def asian_roof(st, name, x, y, w, d, z, tiers=1):
    """Tiled hipped roofs with deep eaves turned up at the corners, one over another for a hall of note."""
    top = z
    for k in range(tiers):
        s = 1 - 0.22 * k
        ww, dd = (w + 0.36) * s, (d + 0.36) * s
        h = 0.32 * min(w, d) * s
        lib.box(f"{name}-eave{k}", (ww, dd, 0.05), (x, y, top + 0.025), st.roof, bevel=0.015)
        hip(f"{name}-roof{k}", ww - 0.04, dd - 0.04, h, (x, y, top + 0.05), st.roof, ridge=0.5)
        # The corners turned up.
        for sx in (-1, 1):
            for sy in (-1, 1):
                lib.box(f"{name}-horn{k}{sx}{sy}", (0.16, 0.05, 0.04), (x + sx * ww / 2, y + sy * dd / 2, top + 0.09),
                        st.roof, rot=(0, R(-28 * sx), R(45 * sx * sy)))
        lib.box(f"{name}-ridge{k}", (ww * 0.5 if w >= d else 0.05, 0.05 if w >= d else dd * 0.5, 0.05),
                (x, y, top + 0.05 + h), st.trim)
        if k + 1 < tiers:
            # The storey between: a band of red-lacquered wall under the next roof.
            top += h * 0.55
            lib.box(f"{name}-storey{k}", (w * s * 0.7, d * s * 0.7, 0.28), (x, y, top + 0.14), st.trim, bevel=0.01)
            top += 0.28
        else:
            top += h + 0.05
    # A gilded finial on the ridge.
    lib.ball(f"{name}-finial", 0.05, (x, y, top + 0.03), st.accent, sub=1)
    return top


def crenels(st, name, x, y, w, d, z, m=None, size=0.1):
    """Stepped merlons round a flat roof, as on the Babylonians' walls."""
    m = m or st.wall
    for side in range(4):
        along_x = side % 2 == 0
        length = w if along_x else d
        n = max(2, int(length / (size * 2)))
        for k in range(n):
            t = -length / 2 + (k + 0.5) * length / n
            px, py = (x + t, y + (d / 2 if side == 0 else -d / 2)) if along_x else (x + (w / 2 if side == 1 else -w / 2), y + t)
            lib.box(f"{name}-mer{side}{k}", (size, size, size * 1.1), (px, py, z + size * 0.55), m)
            lib.box(f"{name}-step{side}{k}", (size * 0.5, size * 0.5, size * 0.5), (px, py, z + size * 1.35), m)


def cornice(st, name, x, y, w, d, z):
    """The Egyptian cornice: a band that flares out at the top of a wall, painted in bands."""
    tapered(f"{name}-cav", w, d, 0.09, (x, y, z), st.trim, top=1.08)
    lib.box(f"{name}-band", (w + 0.02, d + 0.02, 0.03), (x, y, z - 0.015), st.accent)
    lib.box(f"{name}-cap", (w * 1.09, d * 1.09, 0.03), (x, y, z + 0.105), st.trim)


def pediment(st, name, x, y, w, d, z, h=None):
    """A low gable with its triangular end toward the viewer, a cornice and an acroterion on top."""
    from buildings import prism  # the plain gable shape
    h = h if h is not None else 0.22 * min(w, d) + 0.08
    lib.box(f"{name}-entab", (w + 0.1, d + 0.1, 0.1), (x, y, z + 0.05), st.trim, bevel=0.01)
    lib.box(f"{name}-frieze", (w + 0.11, d + 0.11, 0.04), (x, y, z + 0.08), st.accent)
    prism(f"{name}-roof", w + 0.16, d + 0.16, h, (x, y, z + 0.1), st.roof, "y" if d >= w else "x")
    lib.ball(f"{name}-acro", 0.04, (x, y - (d / 2 + 0.08) if d >= w else y, z + 0.1 + h), st.trim, sub=1)
    return z + 0.1 + h


def arch_door(st, x, y, w, h, side="front"):
    """A round-headed opening, dark, in a frame of the trim's stone."""
    if side == "front":
        lib.box("adoor", (w, 0.03, h - w / 2), (x, y, (h - w / 2) / 2), st.dark)
        lib.cyl("adoortop", w / 2, 0.03, (x, y, h - w / 2), st.dark, rot=(R(90), 0, 0), verts=16)
        lib.cyl("aframe", w / 2 + 0.04, 0.025, (x, y + 0.012, h - w / 2), st.trim, rot=(R(90), 0, 0), verts=16)
    else:
        lib.box("adoor", (0.03, w, h - w / 2), (x, y, (h - w / 2) / 2), st.dark)
        lib.cyl("adoortop", w / 2, 0.03, (x, y, h - w / 2), st.dark, rot=(0, R(90), 0), verts=16)
        lib.cyl("aframe", w / 2 + 0.04, 0.025, (x - 0.012, y, h - w / 2), st.trim, rot=(0, R(90), 0), verts=16)


# ---- what buildings.py asks for

def hall(st, name, x, y, w, d, h, roof="gable", along="x", roof_h=None):
    """Walls and a roof in the architecture's manner. Returns the height of the top."""
    a = st.arch
    if a == "egyptian":
        tapered(f"{name}-walls", w, d, h, (x, y, 0), st.wall, top=0.92)
        cornice(st, name, x, y, w * 0.93, d * 0.93, h)
        # Painted bands low on the wall.
        lib.box(f"{name}-dado", (w + 0.01, d + 0.01, 0.05), (x, y, 0.12), st.accent2)
        if st.i == 1:
            # Palm logs laid over the roof.
            for k in range(int(w / 0.12)):
                lib.cyl(f"{name}-log{k}", 0.025, d * 0.9, (x - w * 0.42 + k * 0.12, y, h + 0.13), st.wood, rot=(R(90), 0, 0), verts=6)
        return h + 0.14
    if a == "babylonian":
        lib.box(f"{name}-walls", (w, d, h), (x, y, h / 2), st.wall, bevel=0.01)
        # Buttresses up the walls, and a glazed blue band with yellow studs from the Bronze Age.
        n = max(2, int(w / 0.35))
        for k in range(n + 1):
            lib.box(f"{name}-but{k}", (0.07, 0.05, h), (x - w / 2 + k * w / n, y - d / 2 - 0.02, h / 2), st.wall)
        if st.i >= 2:
            lib.box(f"{name}-glaze", (w + 0.02, d + 0.02, 0.1), (x, y, h * 0.72), st.accent)
            for k in range(max(2, int(w / 0.25))):
                lib.ball(f"{name}-stud{k}", 0.025, (x - w / 2 + 0.12 + k * 0.25, y - d / 2 - 0.02, h * 0.72), st.accent2, sub=1)
        lib.box(f"{name}-roof", (w, d, 0.04), (x, y, h + 0.02), st.roof)
        crenels(st, name, x, y, w, d, h + 0.04, size=0.08 if st.i == 1 else 0.1)
        return h + 0.2
    if a == "asian":
        # A stone podium, red posts at the corners and along the front, plastered walls between.
        lib.box(f"{name}-podium", (w + 0.1, d + 0.1, 0.1), (x, y, 0.05), st.accent2, bevel=0.01)
        lib.box(f"{name}-walls", (w, d, h - 0.1), (x, y, 0.1 + (h - 0.1) / 2), st.wall, bevel=0.01)
        n = max(2, int(w / 0.4))
        for k in range(n + 1):
            lib.box(f"{name}-post{k}", (0.06, 0.06, h - 0.1), (x - w / 2 + k * w / n, y - d / 2 - 0.01, 0.1 + (h - 0.1) / 2), st.trim)
        for sx in (-1, 1):
            lib.box(f"{name}-cpost{sx}", (0.06, 0.06, h - 0.1), (x + sx * w / 2, y + d / 2, 0.1 + (h - 0.1) / 2), st.trim)
        lib.box(f"{name}-beam", (w + 0.04, d + 0.04, 0.06), (x, y, h - 0.03), st.trim)
        # A hall of note (the Town Center, a temple) gets two roofs, one over the other.
        return asian_roof(st, name, x, y, w, d, h, tiers=2 if w * d >= 2.5 else 1)
    if a == "greek":
        lib.box(f"{name}-walls", (w, d, h), (x, y, h / 2), st.wall, bevel=0.015)
        lib.box(f"{name}-base", (w + 0.04, d + 0.04, 0.06), (x, y, 0.03), st.trim)
        if roof == "flat":
            lib.box(f"{name}-roof", (w + 0.06, d + 0.06, 0.06), (x, y, h + 0.03), st.trim)
            return h + 0.06
        return pediment(st, name, x, y, w, d, h)
    if a == "roman":
        lib.box(f"{name}-walls", (w, d, h), (x, y, h / 2), st.wall, bevel=0.015)
        # Stone quoins at the corners and a string course.
        for sx in (-1, 1):
            for sy in (-1, 1):
                lib.box(f"{name}-quoin{sx}{sy}", (0.08, 0.08, h), (x + sx * w / 2, y + sy * d / 2, h / 2), st.trim)
        lib.box(f"{name}-string", (w + 0.03, d + 0.03, 0.04), (x, y, h * 0.55), st.trim)
        from buildings import prism
        lib.box(f"{name}-eaves", (w + 0.1, d + 0.1, 0.05), (x, y, h + 0.025), st.trim)
        rh = roof_h if roof_h is not None else 0.28 * min(w, d)
        o = prism(f"{name}-roof", w + 0.16, d + 0.16, rh, (x, y, h + 0.05), st.roof, along)
        lib.lumpy(o, 0.006, 0.05)  # the rows of tiles
        return h + 0.05 + rh
    raise ValueError(a)


def door(st, x, y, w, h, side="front"):
    a = st.arch
    if a in ("babylonian", "roman"):
        arch_door(st, x, y, w * 1.05, h * 1.1, side)
        return
    if a == "egyptian":
        # A doorway framed in stone, with the winged disc over it.
        lib.box("door", (w, 0.03, h) if side == "front" else (0.03, w, h), (x, y, h / 2), st.dark)
        if side == "front":
            lib.box("doorframe", (w + 0.1, 0.035, 0.08), (x, y + 0.01, h + 0.04), st.trim)
            lib.box("disc", (w * 0.8, 0.04, 0.04), (x, y - 0.005, h + 0.04), st.accent)
            lib.cyl("sun", 0.035, 0.04, (x, y - 0.01, h + 0.04), st.accent2, rot=(R(90), 0, 0), verts=12)
        return
    if a == "asian":
        lib.box("door", (w, 0.03, h) if side == "front" else (0.03, w, h), (x, y, 0.1 + h / 2), st.dark)
        if side == "front":
            for k in range(3):
                lib.box(f"lattice{k}", (0.012, 0.035, h * 0.9), (x - w / 3 + k * w / 3, y - 0.005, 0.1 + h / 2), st.trim)
        return
    # Greek: a plain doorway with a lintel.
    lib.box("door", (w, 0.03, h) if side == "front" else (0.03, w, h), (x, y, h / 2), st.dark)
    lib.box("lintel", (w + 0.08, 0.04, 0.05) if side == "front" else (0.04, w + 0.08, 0.05), (x, y, h + 0.025), st.trim)


def columns(st, x0, x1, y, h, n, r=0.045):
    """A row of columns in the order of the architecture."""
    a = st.arch
    for i in range(n):
        x = x0 + (x1 - x0) * i / max(1, n - 1)
        if a == "egyptian":
            # Papyrus columns: a fat shaft painted in bands, an open flower for a capital.
            lib.cyl(f"col{i}{y:.2f}", r * 1.3, h, (x, y, h / 2), st.trim, verts=12, r2=r * 1.1)
            for k in range(3):
                lib.cyl(f"colband{i}{k}{y:.2f}", r * 1.35, 0.025, (x, y, h * (0.25 + 0.25 * k)), st.accent if k % 2 else st.accent2, verts=12)
            lib.cyl(f"cap{i}{y:.2f}", r * 1.2, 0.1, (x, y, h - 0.02), st.trim, verts=12, r2=r * 2.2)
        elif a == "asian":
            lib.cyl(f"col{i}{y:.2f}", r, h, (x, y, h / 2), st.trim, verts=10)
            lib.box(f"cap{i}{y:.2f}", (r * 3, r * 2, 0.04), (x, y, h), st.accent2)
        elif a == "babylonian":
            lib.cyl(f"col{i}{y:.2f}", r * 1.1, h, (x, y, h / 2), st.trim, verts=10)
            # A double bull's head (a block with horns) for a capital, as at Persepolis.
            lib.box(f"cap{i}{y:.2f}", (r * 4, r * 1.6, 0.07), (x, y, h + 0.035), st.accent2)
        elif a == "roman":
            lib.box(f"plinth{i}{y:.2f}", (r * 2.6, r * 2.6, 0.06), (x, y, 0.03), st.trim)
            lib.cyl(f"col{i}{y:.2f}", r, h - 0.12, (x, y, 0.06 + (h - 0.12) / 2), st.trim, verts=16)
            # A Corinthian capital: a flaring bell of leaves under a square abacus.
            lib.cyl(f"bell{i}{y:.2f}", r * 1.05, 0.08, (x, y, h - 0.06), st.accent2, verts=12, r2=r * 1.6)
            lib.box(f"cap{i}{y:.2f}", (r * 3, r * 3, 0.03), (x, y, h - 0.005), st.trim)
        else:
            # Greek Doric: fluted shaft (many facets), a cushion and a square abacus.
            lib.cyl(f"col{i}{y:.2f}", r * 1.1, h - 0.05, (x, y, (h - 0.05) / 2), st.trim, verts=20, r2=r * 0.95, smooth_it=False)
            lib.cyl(f"echinus{i}{y:.2f}", r * 0.95, 0.04, (x, y, h - 0.04), st.trim, verts=16, r2=r * 1.4)
            lib.box(f"cap{i}{y:.2f}", (r * 3, r * 3, 0.03), (x, y, h - 0.005), st.trim)


# ---- the things each architecture sets about its buildings

def palm(st, name, x, y, h=0.9):
    trunk = lib.mat("palmtrunk", (0.46, 0.36, 0.24), 0.9, grain=0.4, grain_size=0.01)
    leaf = lib.mat("palmleaf", (0.30, 0.48, 0.20), 0.8, grain=0.3, grain_size=0.02)
    lib.cyl(f"{name}-trunk", 0.035, h, (x, y, h / 2), trunk, verts=8, r2=0.025)
    for k in range(7):
        a = 2 * math.pi * k / 7
        lib.box(f"{name}-frond{k}", (0.34, 0.07, 0.015), (x + math.cos(a) * 0.15, y + math.sin(a) * 0.15, h - 0.03),
                leaf, rot=(R(18), R(22), a))


def obelisk(st, name, x, y, h=0.9):
    tapered(f"{name}-shaft", 0.12, 0.12, h, (x, y, 0.06), st.trim, top=0.65)
    lib.box(f"{name}-base", (0.2, 0.2, 0.06), (x, y, 0.03), st.trim)
    lib.cyl(f"{name}-tip", 0.055, 0.1, (x, y, h + 0.11), st.accent2, verts=4, r2=0.0, rot=(0, 0, R(45)))


def lantern(st, name, x, y):
    stone = lib.mat("lanternstone", (0.62, 0.62, 0.58), 0.9)
    lib.cyl(f"{name}-post", 0.035, 0.3, (x, y, 0.15), stone, verts=8)
    lib.box(f"{name}-box", (0.1, 0.1, 0.09), (x, y, 0.35), stone)
    lib.cyl(f"{name}-cap", 0.1, 0.06, (x, y, 0.42), stone, verts=6, r2=0.02)
    lib.ball(f"{name}-glow", 0.03, (x, y, 0.35), lib.mat("lanternlight", (1, 0.8, 0.4), 1.0, emit=(1.0, 0.7, 0.3)), sub=1)


def statue(st, name, x, y, h=0.4):
    lib.box(f"{name}-plinth", (0.16, 0.16, 0.16), (x, y, 0.08), st.trim)
    lib.cyl(f"{name}-body", 0.045, h * 0.7, (x, y, 0.16 + h * 0.35), st.trim, verts=10, r2=0.035)
    lib.ball(f"{name}-head", 0.035, (x, y, 0.16 + h * 0.75), st.trim, sub=1)


def lion_gate(st, name, x, y):
    """A gateway of glazed blue brick with a yellow lion on it, as on the Ishtar Gate."""
    lib.box(f"{name}-gate", (0.5, 0.12, 0.6), (x, y, 0.3), st.accent)
    lib.box(f"{name}-lion", (0.22, 0.02, 0.1), (x, y - 0.065, 0.42), st.accent2)
    crenels(st, f"{name}-g", x, y, 0.5, 0.12, 0.6, m=st.accent, size=0.07)


def decorate(st, key, size=3):
    """What stands about a building of the architecture, at the front corners of its tiles: palms and
    obelisks, lanterns, statues, cypresses."""
    a = st.arch
    if key in ("farm", "wall", "dock") or key.endswith("tower"):
        return
    big = key in ("town_center", "temple", "government_center", "academy", "wonder")
    c = size / 2 - 0.3  # the corner, inside the tiles
    L, Rt = (-c, -c), (c, -c)
    if a == "egyptian":
        palm(st, f"palm-{key}", L[0], L[1], 0.85)
        if big and st.i >= 2:
            obelisk(st, "obelisk-l", Rt[0], Rt[1], 0.8 if st.i == 2 else 1.0)
    elif a == "asian":
        lantern(st, f"lantern-{key}", L[0], L[1])
        if big:
            lantern(st, f"lantern2-{key}", Rt[0], Rt[1])
    elif a == "greek":
        if big and st.i >= 2:
            statue(st, f"statue-{key}", Rt[0], Rt[1])
        else:
            olive = lib.mat("olive", (0.42, 0.50, 0.30), 0.8, grain=0.3, grain_size=0.02)
            lib.cyl(f"olivetrunk-{key}", 0.03, 0.3, (L[0], L[1], 0.15), st.wood, verts=6)
            lib.lumpy(lib.ball(f"olive-{key}", 0.2, (L[0], L[1], 0.4), olive, scale=(1.2, 1, 0.8), sub=2), 0.04, 0.1)
    elif a == "roman":
        if big and st.i >= 2:
            statue(st, f"statue-{key}", Rt[0], Rt[1], 0.5)
        cypress = lib.mat("cypress", (0.20, 0.34, 0.20), 0.8, grain=0.3, grain_size=0.02)
        lib.cyl(f"cypress-{key}", 0.09, 0.8, (L[0], L[1], 0.4), cypress, verts=10, r2=0.02)
    elif a == "babylonian":
        if big and st.i >= 2:
            lion_gate(st, f"liongate-{key}", Rt[0] - 0.15, Rt[1])
        palm(st, f"palm-{key}", L[0], L[1], 0.8)
