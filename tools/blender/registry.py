"""Model registry. Each builder returns a lowpoly.Mesh in meters, Z-up, ground at z=0, front = -Y."""

import zlib

from lowpoly import Mesh

REGISTRY = {}  # id -> dict(category, build, desc, tags, aliases)


def model(model_id, category, desc="", tags=(), aliases=()):
    def deco(fn):
        REGISTRY[model_id] = {
            "id": model_id,
            "category": category,
            "build": fn,
            "desc": desc,
            "tags": list(tags),
            "aliases": list(aliases),
        }
        return fn

    return deco


def new_mesh(model_id, jitter=0.03):
    """Deterministic per-model mesh (color variation seeded from the id)."""
    return Mesh(seed=zlib.crc32(model_id.encode()), jitter=jitter)
