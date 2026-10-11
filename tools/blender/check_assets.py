#!/usr/bin/env python3
"""Check that content-referenced place models resolve to generated GLB assets.

Run from the repository root: python3 tools/blender/check_assets.py
This deliberately uses only the Python standard library (no Blender/bpy).
"""

import json
import sys
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content" / "base"
ASSETS = ROOT / "apps" / "web" / "public" / "assets"


def toml_files(directory):
    return sorted(directory.rglob("*.toml")) if directory.exists() else []


def model_ids(value):
    """Collect explicit model fields in place and scenario TOML structures."""
    found = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "model" and isinstance(child, str):
                found.add(child)
            else:
                found.update(model_ids(child))
    elif isinstance(value, list):
        for child in value:
            found.update(model_ids(child))
    return found


def main():
    referenced = set()
    for directory in (CONTENT / "places", CONTENT / "scenarios"):
        for path in toml_files(directory):
            with path.open("rb") as source:
                referenced.update(model_ids(tomllib.load(source)))

    manifest_path = ASSETS / "manifest.json"
    if not manifest_path.is_file():
        print(f"missing asset manifest: {manifest_path}", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ids = {row["id"] for row in manifest.get("models", [])}
    aliases = manifest.get("aliases", {})
    missing = []
    for model_id in sorted(referenced):
        resolved = aliases.get(model_id, model_id)
        if resolved not in ids or not (ASSETS / "models" / f"{resolved}.glb").is_file():
            missing.append((model_id, resolved))
    if missing:
        for model_id, resolved in missing:
            print(f"missing model {model_id!r} (resolved to {resolved!r})")
        return 1
    print(f"assets ok: {len(referenced)} referenced model ids resolve to generated GLBs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
