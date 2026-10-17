# Modelling in clay: shapes that flow into each other, for statues and beasts (the Wonders' colossi), built
# from Blender's metaballs and turned into meshes. A Clay is one piece in one material: add balls, capsules
# (a limb from a to b) and ellipsoids, then bake() it.
#
#   c = Clay("goddess-body", skin)
#   c.ball((0, 0, 1.4), 0.3)
#   c.capsule((0, 0, 1.4), (0, 0, 1.9), 0.22)
#   body = c.bake()

import math

import lib

# The surface sits about here on a lone element's radius with the threshold below; radii are given as the
# size wanted and scaled by this so a lone ball comes out that size.
GROW = 1.75


class Clay:
    def __init__(self, name, material, resolution=0.035, threshold=0.6):
        bpy = lib.bpy
        self.name, self.material = name, material
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = resolution
        self.mb.render_resolution = resolution
        self.mb.threshold = threshold
        self.obj = bpy.data.objects.new(name, self.mb)
        lib.link(self.obj)

    def ball(self, at, r, stiff=2.0):
        e = self.mb.elements.new(type="BALL")
        e.co, e.radius, e.stiffness = at, r * GROW, stiff
        return e

    def ellipsoid(self, at, r, size, rot=None, stiff=2.0):
        """`size`: the half-lengths along x, y, z as a share of r (1, 1, 1 is a ball)."""
        e = self.mb.elements.new(type="ELLIPSOID")
        e.co, e.radius, e.stiffness = at, r * GROW, stiff
        e.size_x, e.size_y, e.size_z = size
        if rot is not None:
            e.rotation = rot
        return e

    def capsule(self, a, b, r, stiff=2.0):
        """A rounded rod from a to b, `r` thick."""
        from mathutils import Vector
        va, vb = Vector(a), Vector(b)
        d = vb - va
        e = self.mb.elements.new(type="CAPSULE")
        e.co, e.radius, e.stiffness = (va + vb) / 2, r * GROW, stiff
        e.size_x = d.length / 2
        e.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
        return e

    def taper(self, a, b, r0, r1, n=None, stiff=2.0):
        """A limb thinning from r0 at a to r1 at b, as a row of balls."""
        n = n or max(3, int(math.dist(a, b) / (min(r0, r1) * 0.7)) + 1)
        for i in range(n):
            f = i / (n - 1)
            self.ball(tuple(a[j] + (b[j] - a[j]) * f for j in range(3)), r0 + (r1 - r0) * f, stiff)

    def bake(self, smooth=True):
        """The clay as a mesh object in its material."""
        bpy = lib.bpy
        for o in bpy.context.selected_objects:
            o.select_set(False)
        bpy.context.view_layer.objects.active = self.obj
        self.obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        o = bpy.context.view_layer.objects.active
        o.name = self.name
        lib.setmat(o, self.material)
        if smooth:
            lib.smooth(o)
        return o


def scales(o, amount=0.012, size=0.03, seed=0):
    """A surface of scales or carving: small bumps pushed out of it."""
    bpy = lib.bpy
    tex = bpy.data.textures.new(f"scales{seed}{o.name}", "VORONOI")
    tex.noise_scale = size
    mod = o.modifiers.new("scales", "DISPLACE")
    mod.texture = tex
    mod.strength = amount
    mod.mid_level = 0.6
    return o
