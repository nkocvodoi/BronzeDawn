# The scene, camera, light, materials and sheet packing shared by every model. Runs inside Blender.
#
# Coordinates: Blender X is the game's map x, Blender -Y is the game's map y, Z is up, one unit is one
# tile. The camera looks along the game's (-1, -1), down 30 degrees, so a tile is a 2:1 diamond on screen,
# as in the game (64 x 32 at scale 1). Models are built facing Blender -Y and turned for each direction.

import math
import os

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

# Scenes are rendered at twice the game's size, then brought down to the game's own size as pixel art
# (see pixel_art), drawn at scale 1 with sharp pixels, as the sprites of the old games were.
RES = 2
DOWN = 2
SCALE = DOWN / RES  # one picture pixel to one game unit
# Pixels per unit across the screen: a tile's diagonal (sqrt 2 units) is 64 px at scale 1.
PPU = 64 * RES / math.sqrt(2)
ELEVATION = math.radians(30)

TEAM = (1.0, 0.0, 1.0)
# A hard sun and a dim sky: strong light and shade, as pre-rendered sprites had. Set against the original's
# pictures with art3d/compare.py: brighter by a third and with sides in shade lit nearly as the sunny ones,
# ours read as flat and washed out beside them.
SUN = 7.5
SKY = 0.1
EXPOSURE = -0.3  # in stops


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.samples = 12  # the picture ends up as pixel art: more samples would not show
    s.cycles.use_denoising = True
    s.cycles.max_bounces = 4
    s.render.film_transparent = True
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    s.render.resolution_percentage = 100
    s.render.filter_size = 1.2
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    s.view_settings.exposure = EXPOSURE
    s.view_settings.gamma = 1.0
    gpu()
    world()
    sun()
    return s


def gpu():
    # Metal on a Mac; on Windows and Linux whichever the machine's card speaks.
    prefs = bpy.context.preferences.addons["cycles"].preferences
    # CUDA before OptiX: it ships compiled for every card, OptiX compiles on the spot and fails on older drivers.
    for kind in ("METAL", "CUDA", "OPTIX", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
        except Exception:  # not a kind this Blender knows on this system
            continue
        cards = [d for d in prefs.devices if d.type == kind]
        if not cards:
            continue
        for d in prefs.devices:
            d.use = d.type == kind
        bpy.context.scene.cycles.device = "GPU"
        return
    print("cycles: CPU only")  # no GPU: the CPU is slower, not wrong


def world():
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.62, 0.70, 0.85, 1)
    bg.inputs["Strength"].default_value = SKY
    bpy.context.scene.world = w


def sun():
    # Light from the upper left of the screen and a little behind, as in the old pre-rendered games.
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = SUN
    d.angle = math.radians(6)
    d.color = (1.0, 0.95, 0.86)
    o = bpy.data.objects.new("sun", d)
    bpy.context.scene.collection.objects.link(o)
    # Shining from the screen's upper left, so shadows fall to the right and a little toward the viewer.
    # Screen right is (1, 1) and toward the viewer (1, -1) in the scene.
    travel = Vector((1.3, 0.75, 0)).normalized()
    travel.z = -1.5
    o.rotation_euler = travel.normalized().to_track_quat("-Z", "Y").to_euler()


def camera(width, height, target=(0, 0, 0)):
    """An orthographic camera of `width` x `height` pixels centred on `target`."""
    s = bpy.context.scene
    s.render.resolution_x, s.render.resolution_y = width, height
    cam = bpy.data.cameras.get("cam") or bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.sensor_fit = "HORIZONTAL"
    cam.ortho_scale = width / PPU
    cam.clip_start, cam.clip_end = 0.1, 200
    o = bpy.data.objects.get("cam") or bpy.data.objects.new("cam", cam)
    if o.name not in s.collection.objects:
        s.collection.objects.link(o)
    look = Vector((-math.cos(ELEVATION) / math.sqrt(2), math.cos(ELEVATION) / math.sqrt(2), -math.sin(ELEVATION)))
    o.location = Vector(target) - look * 60
    o.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    s.camera = o
    bpy.context.view_layer.update()
    return o


def pixel_of(point):
    """Where a point in the scene lands in the picture, in pixels from the top left."""
    s = bpy.context.scene
    bpy.context.view_layer.update()
    v = world_to_camera_view(s, s.camera, Vector(point))
    return (v.x * s.render.resolution_x, (1 - v.y) * s.render.resolution_y)


def shadow_catcher(size=6):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    p = bpy.context.object
    p.name = "ground"
    p.is_shadow_catcher = True
    return p


# ---- materials. Each has a mask switch: the second render of every frame shows the player's colour
# areas white and all else black, so the packer knows exactly where they are.

MATS = {}


def linear(c):
    """Colours are written as they look on screen (sRGB); Blender's shaders take linear light."""
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def courses(nt, color, kind):
    """A wall's or roof's courses: bricks or blocks with dark joints between them, or the streaks of thatch,
    as the colour and as a little relief. `kind` is (pattern, width, height, depth): pattern "brick" or
    "thatch", the size of one in units (a tile is one), how dark the joints are (0 to 1). Laid out across
    the faces whichever way they face: along X + Y and up Z, so a wall facing either way of the screen gets
    rows, and a roof gets rows up its slope."""
    pattern, w, h, depth = kind
    coord = nt.nodes.new("ShaderNodeTexCoord")
    xyz = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], xyz.inputs[0])
    u = nt.nodes.new("ShaderNodeMath")
    u.operation = "ADD"
    nt.links.new(xyz.outputs["X"], u.inputs[0])
    nt.links.new(xyz.outputs["Y"], u.inputs[1])
    uv = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(u.outputs[0], uv.inputs["X"])
    nt.links.new(xyz.outputs["Z"], uv.inputs["Y"])
    if pattern == "brick":
        t = nt.nodes.new("ShaderNodeTexBrick")
        t.inputs["Scale"].default_value = 1.0
        t.inputs["Brick Width"].default_value = w
        t.inputs["Row Height"].default_value = h
        t.inputs["Mortar Size"].default_value = min(w, h) * 0.12
        t.inputs["Mortar Smooth"].default_value = 0.1
        t.offset = 0.5
        # One brick a little lighter or darker than the next, the joints dark.
        t.inputs["Color1"].default_value = (*linear(tuple(min(1, x * 1.08) for x in color)), 1)
        t.inputs["Color2"].default_value = (*linear(tuple(x * 0.84 for x in color)), 1)
        t.inputs["Mortar"].default_value = (*linear(tuple(x * (1 - depth) for x in color)), 1)
        t.inputs["Bias"].default_value = 0.0
        nt.links.new(uv.outputs[0], t.inputs["Vector"])
        return t.outputs["Color"], t.outputs["Fac"]
    # Thatch: bundles of straw in streaks down the slope, each a little darker at its foot.
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 1 / w
    wave.inputs["Distortion"].default_value = 6.0
    wave.inputs["Detail"].default_value = 4.0
    nt.links.new(uv.outputs[0], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*linear(tuple(x * (1 - depth) for x in color)), 1)
    ramp.color_ramp.elements[1].color = (*linear(tuple(min(1, x * 1.1) for x in color)), 1)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    return ramp.outputs["Color"], wave.outputs["Fac"]


def mat(name, color, rough=0.8, metal=0.0, team=False, emit=None, grain=0.28, grain_size=0.03, kind=None):
    key = (name, team)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*linear(color), 1)
    if grain and not team:
        # Speckle and streak the colour a little, as paint and straw and bark are never one flat tone.
        coord = nt.nodes.new("ShaderNodeTexCoord")
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 1 / grain_size
        noise.inputs["Detail"].default_value = 6
        nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        lo = linear(tuple(x * (1 - grain) for x in color))
        hi = linear(tuple(min(1.0, x * (1 + grain * 0.6)) for x in color))
        ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.3, 0.7
        ramp.color_ramp.elements[0].color, ramp.color_ramp.elements[1].color = (*lo, 1), (*hi, 1)
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    if kind and not team:
        # Courses over the speckle: the speckle's tone, multiplied by the bricks and their joints, and the
        # joints sunk a little so the sun picks out each course.
        laid, fac = courses(nt, color, kind)
        speck = bsdf.inputs["Base Color"].links[0].from_socket if bsdf.inputs["Base Color"].links else None
        mixc = nt.nodes.new("ShaderNodeMix")
        mixc.data_type = "RGBA"
        mixc.blend_type = "MULTIPLY" if speck else "MIX"
        mixc.inputs["Factor"].default_value = 1.0
        if speck:
            nt.links.new(speck, mixc.inputs["A"])
            # Normalised against the base colour, so the speckle keeps the brightness it had.
            norm = nt.nodes.new("ShaderNodeMix")
            norm.data_type = "RGBA"
            norm.blend_type = "DIVIDE"
            norm.inputs["Factor"].default_value = 1.0
            nt.links.new(laid, norm.inputs["A"])
            norm.inputs["B"].default_value = (*linear(color), 1)
            nt.links.new(norm.outputs["Result"], mixc.inputs["B"])
        else:
            nt.links.new(laid, mixc.inputs["B"])
        nt.links.new(mixc.outputs["Result"], bsdf.inputs["Base Color"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.6
        bump.inputs["Distance"].default_value = 0.01
        nt.links.new(fac, bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*linear(emit), 1)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    flat = nt.nodes.new("ShaderNodeEmission")
    flat.inputs["Color"].default_value = (1, 1, 1, 1) if team else (0, 0, 0, 1)
    mix = nt.nodes.new("ShaderNodeMixShader")
    sw = nt.nodes.new("ShaderNodeValue")
    sw.name = "MASK"
    sw.outputs[0].default_value = 0.0
    nt.links.new(sw.outputs[0], mix.inputs["Fac"])
    nt.links.new(bsdf.outputs[0], mix.inputs[1])
    nt.links.new(flat.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    m["team"] = team
    MATS[key] = m
    return m


def team_mat(name="team", rough=0.75):
    return mat(name, TEAM, rough=rough, team=True)


def mask_mode(on):
    for m in bpy.data.materials:
        if m.node_tree and "MASK" in m.node_tree.nodes:
            m.node_tree.nodes["MASK"].outputs[0].default_value = 1.0 if on else 0.0
    g = bpy.data.objects.get("ground")
    if g:
        g.hide_render = on
    s = bpy.context.scene
    s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0 if on else SKY
    s.cycles.samples = 4 if on else 12
    s.cycles.use_denoising = not on


# ---- rendering and packing

def render_rgba(path):
    s = bpy.context.scene
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return np.flipud(a.reshape(h, w, 4))  # top row first


def frame(tmp):
    """One frame: the picture, with its player's colour areas turned to shades of magenta."""
    mask_mode(False)
    rgba = render_rgba(os.path.join(tmp, "beauty.png"))
    mask_mode(True)
    m = render_rgba(os.path.join(tmp, "mask.png"))[:, :, 0]
    mask_mode(False)
    return pixel_art(clean_shadow(rgba), m)


def clean_shadow(rgba, floor=0.13):
    """Drops the faint haze the ground leaves all over the picture (light from the sky, a little
    occluded), keeping real shadows and the soft edges of the model itself."""
    out = rgba.copy()
    a = out[:, :, 3]
    shadow = out[:, :, :3].max(axis=2) < 0.06
    out[:, :, 3] = np.where(shadow, np.clip((a - floor) / (1 - floor), 0, 1), a)
    return out


def teamify(rgba, mask):
    out = rgba.copy()
    r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2]
    lum = np.maximum(np.maximum(r, g), b) * 0.55 + (0.3 * r + 0.59 * g + 0.11 * b) * 0.45
    team = (mask > 0.5) & (out[:, :, 3] > 0)
    v = np.clip(lum * 1.05, 0.2, 1.0)
    out[:, :, 0] = np.where(team, v, r)
    out[:, :, 1] = np.where(team, 0.0, g)
    out[:, :, 2] = np.where(team, v, b)
    # Anything else that the game would take for magenta gets a little green, so it keeps its colour.
    r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2]
    lo = np.minimum(r, b)
    looks = (~team) & (r >= 40 / 255) & (b >= 40 / 255) & (g <= lo * 0.45) & (np.abs(r - b) <= 60 / 255)
    out[:, :, 1] = np.where(looks, lo * 0.5 + 2 / 255, g)
    return out


def save_png(arr, path):
    h, w, _ = arr.shape
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def sheet(rows):
    """Frames in rows (each a list of equal-sized arrays) as one picture; short rows are padded."""
    h, w, _ = rows[0][0].shape
    cols = max(len(r) for r in rows)
    out = np.zeros((h * len(rows), w * cols, 4), dtype=np.float32)
    for i, row in enumerate(rows):
        for j, f in enumerate(row):
            out[i * h:(i + 1) * h, j * w:(j + 1) * w] = f
    return out


# ---- building blocks

def link(o, parent=None):
    if o.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


def adopt(o, parent):
    """Parents `o` where it stands: positions are always given in the scene, not the parent."""
    if parent is None:
        return o
    bpy.context.view_layer.update()
    keep = o.matrix_world.copy()
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    o.matrix_world = keep
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    link(o)
    return adopt(o, parent)


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def setmat(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def box(name, size, loc, m, parent=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    setmat(o, m)
    return adopt(o, parent)


def cyl(name, r, depth, loc, m, parent=None, rot=(0, 0, 0), verts=16, r2=None, smooth_it=True):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    setmat(o, m)
    if smooth_it:
        smooth(o)
    return adopt(o, parent)


def ball(name, r, loc, m, parent=None, scale=(1, 1, 1), sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    setmat(o, m)
    smooth(o)
    return adopt(o, parent)


def lumpy(o, amount=0.04, scale=3.0, seed=0):
    """Pushes a mesh's surface in and out, for thatch, foliage and rock."""
    tex = bpy.data.textures.new(f"n{seed}{o.name}", "CLOUDS")
    tex.noise_scale = scale  # the size of a lump, in the object's units
    if not any(m.type == "SUBSURF" for m in o.modifiers):
        # Enough faces to push about, without rounding off the shape.
        sub = o.modifiers.new("sub", "SUBSURF")
        sub.subdivision_type = "SIMPLE"
        sub.levels = sub.render_levels = 3
    mod = o.modifiers.new("lumps", "DISPLACE")
    mod.texture = tex
    mod.strength = amount
    mod.mid_level = 0.5
    return o


def scale_all(k):
    """Grows everything in the scene about the origin, for a bigger version of a model."""
    root = empty("scale")
    for o in list(bpy.context.scene.objects):
        if o is not root and o.parent is None and o.type in ("MESH", "EMPTY"):
            adopt(o, root)
    root.scale = (k, k, k)
    return root


def check_edges(arr, what):
    """Warns when a picture is cut off: anything not see-through on its outermost pixels."""
    a = arr[:, :, 3]
    sides = {"top": a[0].max(), "bottom": a[-1].max(), "left": a[:, 0].max(), "right": a[:, -1].max()}
    cut = [k for k, v in sides.items() if v > 0.03]
    if cut:
        print(f"WARNING {what}: cut off at the {', '.join(cut)}")
    return not cut


# ---- pixel art: the look of a sprite from the late 90s

LEVELS = 48        # steps per colour channel: at 20 a wall's courses ran together into flat bands
SATURATE = 0.92    # the original's colours are earthy; at 1.18 ours were half as saturated again
OUTLINE = 0.55     # how dark the outermost pixels of the model are made
RIM = True         # off for things on water, whose thin light rings would all turn to rim


def down(a, k):
    h, w = a.shape[0] // k * k, a.shape[1] // k * k
    a = a[:h, :w]
    return a.reshape(h // k, k, w // k, k, *a.shape[2:]).mean(axis=(1, 3))


def pixel_art(rgba, mask):
    """The render brought down to the game's size with hard edges, a dark rim, fewer colours and a
    shadow of one flat tone; the player's colour areas in shades of magenta."""
    # Averaged with the alpha, so edges do not pick up the black of the empty background.
    pre = rgba.copy()
    pre[:, :, :3] *= pre[:, :, 3:4]
    small = down(pre, DOWN)
    m = down(mask, DOWN)
    a = small[:, :, 3]
    rgb = small[:, :, :3] / np.maximum(a, 1e-6)[:, :, None]
    dark = rgb.max(axis=2) < 0.07
    model = (a >= 0.5) & ~dark
    shadow = ~model & (a >= 0.22)
    # More colour and fewer steps of it.
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(grey + (rgb - grey) * SATURATE, 0, 1)
    rgb = np.round(rgb * (LEVELS - 1)) / (LEVELS - 1)
    out = np.zeros((*a.shape, 4), dtype=np.float32)
    out[:, :, :3] = np.where(model[:, :, None], rgb, 0)
    out[:, :, 3] = np.where(model, 1.0, np.where(shadow, 0.5, 0.0))
    # A dark rim: model pixels next to anything that is not the model.
    edge = np.zeros_like(model)
    pad = np.pad(model, 1, constant_values=False)
    for dy, dx in ((0, 1), (2, 1), (1, 0), (1, 2)):
        edge |= model & ~pad[dy:dy + model.shape[0], dx:dx + model.shape[1]]
    if RIM:
        out[:, :, :3] = np.where(edge[:, :, None], out[:, :, :3] * OUTLINE, out[:, :, :3])
    return teamify(out, np.where(model, m, 0))
