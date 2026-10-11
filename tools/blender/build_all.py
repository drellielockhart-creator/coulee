"""
Headless asset build: blender --background --factory-startup --python tools/blender/build_all.py
Writes apps/web/public/assets/models/<id>.glb and previews/<id>.png.
OWNER: module:assets. M0 placeholder: one flat-shaded cabin to prove the pipeline.
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from palette import PALETTE  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_MODELS = os.path.join(ROOT, "apps", "web", "public", "assets", "models")
OUT_PREVIEWS = os.path.join(ROOT, "apps", "web", "public", "assets", "previews")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def color_mesh(obj, rgb):
    mesh = obj.data
    attr = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    for i in range(len(attr.data)):
        attr.data[i].color = (*rgb, 1.0)
    for p in mesh.polygons:
        p.use_smooth = False
    mat = bpy.data.materials.new(name=f"vc_{obj.name}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    mesh.materials.append(mat)


def box(name, size, loc, rgb):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    color_mesh(o, rgb)
    return o


def build_cabin():
    reset()
    box("walls", (3, 2.4, 1.6), (0, 0, 0.8), PALETTE["timber"])
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=2.3, depth=1.2, location=(0, 0, 2.2))
    roof = bpy.context.active_object
    roof.name = "roof"
    roof.rotation_euler = (0, 0, 0.785398)
    roof.scale = (1.0, 0.8, 1.0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    color_mesh(roof, PALETTE["roof"])
    box("chimney", (0.4, 0.4, 1.2), (1.0, 0.6, 2.4), PALETTE["stone"])
    return "cabin"


def export(asset_id):
    os.makedirs(OUT_MODELS, exist_ok=True)
    path = os.path.join(OUT_MODELS, f"{asset_id}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True)
    print(f"assets: wrote {os.path.relpath(path, ROOT)}")


def preview(asset_id):
    """Workbench render of the current scene; skipped (with a message) if rendering is unavailable."""
    os.makedirs(OUT_PREVIEWS, exist_ok=True)
    scene = bpy.context.scene
    bpy.ops.object.camera_add(location=(7, -7, 6), rotation=(1.0, 0, 0.785398))
    scene.camera = bpy.context.active_object
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "VERTEX"
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.film_transparent = True
    scene.render.filepath = os.path.join(OUT_PREVIEWS, f"{asset_id}.png")
    try:
        bpy.ops.render.render(write_still=True)
        print(f"assets: wrote {os.path.relpath(scene.render.filepath, ROOT)}")
    except Exception as e:  # headless GPU may be missing
        print(f"assets: preview skipped for {asset_id}: {e}")


for builder in (build_cabin,):
    aid = builder()
    export(aid)
    preview(aid)
