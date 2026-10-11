"""Entry point for `just assets`: blender --background --factory-startup --python tools/blender/build_all.py

Thin wrapper over build_assets.py with the default output directory (apps/web/public/assets).
OWNER: module:assets.
"""
import os
import runpy

runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_assets.py"), run_name="__main__")
