"""Headless asset build for Coulee.

  blender -b --factory-startup -P tools/blender/build_assets.py -- --out apps/web/public/assets

Writes (deterministically; no unseeded randomness):
  <out>/models/<id>.glb         flat-shaded, vertex-colored low-poly glTF 2.0 (Y-up, meters, origin at ground center)
  <out>/previews/<id>.png       256 px transparent-background previews
  <out>/manifest.json           ids, categories, tris, sizes, footprints, aliases
  tools/blender/previews/       512 px previews + contact_sheet.png (for design review; not shipped)

Geometry lives in pure-Python modules (lowpoly.py, models_*.py) so it can be unit tested without Blender;
this file is the only one that touches bpy.

Options after `--`:  --out DIR   --previews DIR   --only id,id   --no-render
"""

import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import models_beings  # noqa: E402,F401
import models_buildings  # noqa: E402,F401
import models_nature  # noqa: E402,F401
import models_props  # noqa: E402,F401
from lowpoly import Mesh  # noqa: E402
from palette import PALETTE, srgb_to_linear  # noqa: E402
from registry import REGISTRY  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CATEGORY_ORDER = ["building", "nature", "prop", "figure", "animal"]
CATEGORY_TITLE = {
    "building": "BUILDINGS",
    "nature": "NATURE",
    "prop": "PROPS",
    "figure": "FIGURES",
    "animal": "ANIMALS",
}
MAX_TRIS = 2000
VIEW_YAW = 35.0  # preview models are turned this much about Z so two faces show
VIEW_PITCH = 40.0  # camera X rotation (0 = straight down, 90 = horizon)

# Main-body footprint (meters, x by y) of buildings: what the web should fit to the place footprint.
CORE_FOOTPRINT = {
    "cabin": (5.6, 4.4), "house": (7.2, 5.6), "store": (8.4, 10.4), "tavern": (9.2, 7.0),
    "church": (7.4, 11.4), "smithy": (7.4, 6.4), "mill": (10.4, 8.2), "schoolhouse": (6.0, 8.0),
    "print_shop": (5.4, 8.0), "landing": (9.6, 4.6), "barn": (9.6, 13.0),
}  # fmt: skip


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    opts = {"out": os.path.join(ROOT, "apps", "web", "public", "assets"), "previews": os.path.join(HERE, "previews"), "only": None, "render": True}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--out":
            opts["out"] = os.path.abspath(argv[i + 1])
            i += 1
        elif a == "--previews":
            opts["previews"] = os.path.abspath(argv[i + 1])
            i += 1
        elif a == "--only":
            opts["only"] = set(argv[i + 1].split(","))
            i += 1
        elif a == "--no-render":
            opts["render"] = False
        i += 1
    return opts


# ------------------------------------------------------------------ bpy helpers

_MATERIAL = None


def shared_material():
    global _MATERIAL
    if _MATERIAL is not None:
        return _MATERIAL
    mat = bpy.data.materials.new("palette_vertex")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    _MATERIAL = mat
    return mat


def to_object(mesh, name):
    verts, polys, cols = [], [], []
    for vs, col in mesh.faces:
        base = len(verts)
        verts.extend(vs)
        polys.append(list(range(base, base + len(vs))))
        lin = srgb_to_linear(col)
        cols.extend([(lin[0], lin[1], lin[2], 1.0)] * len(vs))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], polys)
    me.update()
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    attr.data.foreach_set("color", [c for rgba in cols for c in rgba])
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(shared_material())
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def remove_object(obj):
    me = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if me and me.users == 0:
        if isinstance(me, bpy.types.Mesh):
            bpy.data.meshes.remove(me)
        elif isinstance(me, bpy.types.Curve):
            bpy.data.curves.remove(me)


def export_glb(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_texcoords=False,
        export_normals=True,
        export_extras=False,
        export_vertex_color="MATERIAL",
    )
    valid = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kwargs = {k: v for k, v in kwargs.items() if k in valid}
    bpy.ops.export_scene.gltf(**kwargs)


# ------------------------------------------------------------------ rendering


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_object_outline = True
    sh.object_outline_color = (0.10, 0.08, 0.06)
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_specular_highlight = False
    scene.display.render_aa = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.55
    scene.display_settings.display_device = "sRGB"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    world = bpy.data.worlds.new("w") if not scene.world else scene.world
    scene.world = world
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.clip_start = 0.1
    cam_data.clip_end = 400.0
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_euler = (math.radians(VIEW_PITCH), 0.0, 0.0)
    return cam


def world_corners(obj):
    from mathutils import Vector

    return [obj.matrix_world @ Vector(c) for c in obj.bound_box]


def fit_camera(cam, objs, margin=1.1, aspect=None):
    """Aim the ortho camera at the union bounds of objs. Returns (xrange, yrange) in view space."""
    pts = [p for o in objs for p in world_corners(o)]
    pr = math.radians(VIEW_PITCH)
    up = (0.0, math.cos(pr), math.sin(pr))
    d = (0.0, math.sin(pr), -math.cos(pr))
    xs = [p.x for p in pts]
    ys = [p.x * 0 + p.y * up[1] + p.z * up[2] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    xr, yr = (x1 - x0) * margin, (y1 - y0) * margin
    cam.location = (cx, cy * up[1] - d[1] * 150.0, cy * up[2] - d[2] * 150.0)
    cam.data.ortho_scale = max(xr, yr)
    return xr, yr


def set_background(opaque):
    scene = bpy.context.scene
    scene.render.film_transparent = not opaque
    lin = srgb_to_linear(PALETTE["preview_bg"])
    scene.world.color = lin


def render_to(path, res_x, res_y):
    scene = bpy.context.scene
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)


def pad_mesh(radius, seed=1):
    m = Mesh(seed=seed, jitter=0.02)
    m.cyl((0, 0, -0.06), radius, radius * 0.96, 0.06, PALETTE["preview_pad"], n=18, start=10.0)
    return m


def preview_one(cam, mid, mesh, out256, out512):
    (lo, hi) = mesh.bounds()
    radius = max(1.0, 0.6 * math.hypot(hi[0] - lo[0], hi[1] - lo[1]))
    cx = (lo[0] + hi[0]) / 2
    cy = (lo[1] + hi[1]) / 2
    pad = Mesh(seed=3, jitter=0.02)
    pad.cyl((cx, cy, -0.06), radius, radius * 0.96, 0.06, PALETTE["preview_pad"], n=18, start=10.0)
    pad_obj = to_object(pad, "pad")
    obj = to_object(mesh, mid)
    # rotate both about the model's own center for the 3/4 view
    for o in (obj, pad_obj):
        o.location = (-cx, -cy, 0)
    holder = bpy.data.objects.new("holder", None)
    bpy.context.scene.collection.objects.link(holder)
    holder.rotation_euler = (0, 0, math.radians(VIEW_YAW))
    for o in (obj, pad_obj):
        o.parent = holder
    bpy.context.view_layer.update()
    set_background(False)
    fit_camera(cam, [obj, pad_obj], margin=1.06)
    render_to(out256, 256, 256)
    render_to(out512, 512, 512)
    for o in (obj, pad_obj):
        o.parent = None
        remove_object(o)
    bpy.data.objects.remove(holder, do_unlink=True)


def make_label(text, size, ink, loc, align="CENTER"):
    curve = bpy.data.curves.new("lbl", "FONT")
    curve.body = text
    curve.size = size
    curve.align_x = align
    obj = bpy.data.objects.new("lbl", curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    bpy.context.view_layer.update()
    # convert to a mesh so the vertex-color shading path has something to read
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    lin = srgb_to_linear(ink)
    attr.data.foreach_set("color", [c for _ in range(len(attr.data)) for c in (lin[0], lin[1], lin[2], 1.0)])
    me.color_attributes.active_color = attr
    return obj


def contact_sheet(cam, entries, path):
    """entries: list of (id, category, Mesh). One scene, normalized scale, labeled grid."""
    cols = 7
    cell_w, cell_h = 6.4, 8.4
    ink = (0.18, 0.14, 0.10)
    objs = []
    y = 0.0
    for cat in CATEGORY_ORDER:
        group = [e for e in entries if e[1] == cat]
        if not group:
            continue
        objs.append(make_label(CATEGORY_TITLE[cat], 0.9, ink, (-cell_w * 1.0, y - 0.3, 0.02), align="LEFT"))
        y -= 0.4
        for i, (mid, _, mesh) in enumerate(group):
            r, c = divmod(i, cols)
            lo, hi = mesh.bounds()
            sx, sy, sz = hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]
            s = min(5.2 / max(math.hypot(sx, sy), 1e-6), 4.6 / max(sz, 1e-6), 5.0)
            cx_m, cy_m = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
            ox, oy = c * cell_w, y - r * cell_h
            sheet = Mesh(seed=5, jitter=0.0)
            sheet.add(pad_mesh(2.9, seed=i + 1), (ox, oy, 0))
            # rotate about the model center, scale, then place
            tmp = Mesh(seed=1, jitter=0.0)
            tmp.add(mesh, (-cx_m, -cy_m, 0))
            sheet.add(tmp, (ox, oy, 0), rz=VIEW_YAW, scale=s)
            objs.append(to_object(sheet, mid))
            objs.append(make_label(mid, 0.5, ink, (ox, oy - 3.9, 0.02)))
        rows = (len(group) + cols - 1) // cols
        y -= rows * cell_h + 0.6
    bpy.context.view_layer.update()
    set_background(True)
    xr, yr = fit_camera(cam, objs, margin=1.03)
    res_x = 3000
    res_y = max(512, int(round(res_x * yr / xr))) if xr >= yr else res_x
    if xr < yr:
        res_x, res_y = int(round(3000 * xr / yr)), 3000
    render_to(path, res_x, res_y)
    for o in objs:
        remove_object(o)


# ------------------------------------------------------------------ main


def main():
    opts = parse_args()
    out = opts["out"]
    models_dir = os.path.join(out, "models")
    prev_dir = os.path.join(out, "previews")
    review_dir = opts["previews"]
    os.makedirs(models_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cam = setup_render() if opts["render"] else None

    order = sorted(REGISTRY.values(), key=lambda e: (CATEGORY_ORDER.index(e["category"]), e["id"]))
    if opts["only"]:
        order = [e for e in order if e["id"] in opts["only"]]

    manifest_models = []
    built = []
    failures = []
    for e in order:
        mid = e["id"]
        mesh = e["build"]()
        mesh.ground_snap()
        tris = mesh.tri_count()
        lo, hi = mesh.bounds()
        problems = []
        if mesh.bad:
            problems.append(f"{mesh.bad} inward-facing faces")
        if tris > MAX_TRIS:
            problems.append(f"{tris} tris > {MAX_TRIS}")
        if any(not math.isfinite(c) for vs, _ in mesh.faces for v in vs for c in v):
            problems.append("non-finite coordinate")
        if problems:
            failures.append((mid, problems))
            continue
        obj = to_object(mesh, mid)
        glb = os.path.join(models_dir, f"{mid}.glb")
        export_glb(obj, glb)
        remove_object(obj)
        size_b = os.path.getsize(glb)
        print(f"assets: {mid:18s} {tris:5d} tris {size_b / 1024:6.1f} KB")
        built.append((mid, e["category"], mesh))
        # glTF axes: x -> x, blender z -> y (up), blender -y -> z (front)
        entry = {
            "id": mid,
            "category": e["category"],
            "file": f"models/{mid}.glb",
            "preview": f"previews/{mid}.png",
            "tris": tris,
            "bytes": size_b,
            "size": {"x": round(hi[0] - lo[0], 3), "y": round(hi[2] - lo[2], 3), "z": round(hi[1] - lo[1], 3)},
            "center": {"x": round((lo[0] + hi[0]) / 2, 3), "z": round(-(lo[1] + hi[1]) / 2, 3)},
            "tags": e["tags"],
            "description": e["desc"],
            "aliases": e["aliases"],
        }
        if mid in CORE_FOOTPRINT:
            entry["core_footprint"] = {"x": CORE_FOOTPRINT[mid][0], "z": CORE_FOOTPRINT[mid][1]}
        manifest_models.append(entry)
        if opts["render"]:
            preview_one(cam, mid, mesh, os.path.join(prev_dir, f"{mid}.png"), os.path.join(review_dir, f"{mid}.png"))

    if failures:
        for mid, ps in failures:
            print(f"assets: FAILED {mid}: {'; '.join(ps)}", file=sys.stderr)
        raise SystemExit(f"assets: {len(failures)} model(s) failed validation")

    # aliases: duplicate files so either id resolves
    aliases = {}
    for e in order:
        for alias in e["aliases"]:
            aliases[alias] = e["id"]
            for sub, ext in (("models", "glb"),):
                src = os.path.join(out, sub, f"{e['id']}.{ext}")
                dst = os.path.join(out, sub, f"{alias}.{ext}")
                with open(src, "rb") as f, open(dst, "wb") as g:
                    g.write(f.read())
            if opts["render"]:
                src = os.path.join(prev_dir, f"{e['id']}.png")
                dst = os.path.join(prev_dir, f"{alias}.png")
                if os.path.exists(src):
                    with open(src, "rb") as f, open(dst, "wb") as g:
                        g.write(f.read())

    manifest = {
        "version": 1,
        "generator": "tools/blender/build_assets.py",
        "units": "meters",
        "axes": "glTF: +Y up, front of buildings and beings faces +Z, origin at ground center of the main body",
        "palette": {k: "#%02x%02x%02x" % tuple(int(round(c * 255)) for c in v) for k, v in sorted(PALETTE.items())},
        "aliases": dict(sorted(aliases.items())),
        "models": manifest_models,
    }
    if not opts["only"]:
        with open(os.path.join(out, "manifest.json"), "w") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
        print(f"assets: wrote manifest.json ({len(manifest_models)} models, {len(aliases)} aliases)")

    if opts["render"] and not opts["only"]:
        contact_sheet(cam, built, os.path.join(review_dir, "contact_sheet.png"))
        print("assets: wrote contact_sheet.png")


main()
