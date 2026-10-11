"""Shared vertex-color palette. OWNER: module:assets.

Values are authored as sRGB 0..1 (what you see on screen). The Blender driver converts to linear
before writing the glTF COLOR_0 attribute, which is what three.js expects. Muted, period,
Driftless: limestone/dolomite cream, oak green, weathered wood browns, barn red, slate.

Pure Python (no bpy) so the geometry code can be unit tested with the system interpreter.
"""

PALETTE = {
    # --- original keys (kept: contracts are additive-only) ---
    "timber": (0.42, 0.30, 0.20),
    "roof": (0.30, 0.24, 0.22),
    "stone": (0.62, 0.60, 0.55),
    "iron": (0.22, 0.22, 0.24),
    "grass": (0.48, 0.56, 0.35),
    "water": (0.36, 0.49, 0.64),
    "paint_white": (0.88, 0.86, 0.80),
    # --- stone: the Driftless is dolomite and limestone country ---
    "limestone": (0.80, 0.75, 0.63),
    "limestone_dark": (0.66, 0.61, 0.51),
    "dolomite": (0.76, 0.69, 0.55),
    "dolomite_dark": (0.57, 0.52, 0.43),
    "dolomite_light": (0.86, 0.81, 0.69),
    "fieldstone": (0.55, 0.53, 0.50),
    "gravel": (0.64, 0.60, 0.53),
    # --- wood ---
    "bark": (0.33, 0.26, 0.20),
    "bark_dark": (0.24, 0.19, 0.15),
    "wood_dark": (0.30, 0.22, 0.17),
    "wood_mid": (0.44, 0.33, 0.24),
    "wood_weathered": (0.52, 0.45, 0.37),
    "wood_gray": (0.60, 0.56, 0.50),
    "wood_light": (0.68, 0.54, 0.38),
    "wood_cut": (0.80, 0.68, 0.50),
    "shingle": (0.47, 0.39, 0.32),
    "shingle_light": (0.58, 0.49, 0.38),
    "door": (0.34, 0.25, 0.19),
    # --- paint ---
    "barn_red": (0.55, 0.23, 0.18),
    "barn_red_dark": (0.43, 0.18, 0.15),
    "ochre": (0.76, 0.64, 0.40),
    "cream": (0.86, 0.80, 0.64),
    "slate": (0.40, 0.45, 0.51),
    "slate_light": (0.48, 0.52, 0.56),
    "slate_blue": (0.40, 0.48, 0.55),
    "sage": (0.55, 0.60, 0.48),
    "shutter_green": (0.32, 0.42, 0.34),
    "glass": (0.18, 0.21, 0.25),
    "glass_lit": (0.80, 0.66, 0.36),
    # --- vegetation (spring 1855: fresh leaf) ---
    "oak_leaf": (0.38, 0.47, 0.27),
    "oak_leaf_dark": (0.27, 0.36, 0.21),
    "oak_leaf_light": (0.50, 0.58, 0.32),
    "maple_leaf": (0.52, 0.57, 0.27),
    "maple_leaf_light": (0.64, 0.67, 0.34),
    "birch_bark": (0.87, 0.85, 0.79),
    "birch_mark": (0.22, 0.20, 0.19),
    "birch_leaf": (0.58, 0.65, 0.36),
    "pine": (0.21, 0.33, 0.25),
    "pine_dark": (0.15, 0.26, 0.21),
    "pine_light": (0.30, 0.43, 0.30),
    "shrub": (0.33, 0.43, 0.26),
    "shrub_dark": (0.25, 0.34, 0.22),
    "grass_blade": (0.52, 0.60, 0.34),
    "grass_blade_dry": (0.66, 0.64, 0.40),
    "moss": (0.45, 0.52, 0.30),
    "earth": (0.45, 0.37, 0.28),
    "hay": (0.78, 0.67, 0.36),
    "hay_dark": (0.62, 0.52, 0.28),
    # --- cloth, metal, fire ---
    "canvas": (0.83, 0.77, 0.63),
    "canvas_shade": (0.70, 0.64, 0.51),
    "rope": (0.66, 0.57, 0.40),
    "coal": (0.13, 0.13, 0.14),
    "iron_rust": (0.58, 0.33, 0.20),
    "iron_ore": (0.50, 0.28, 0.19),
    "brass": (0.72, 0.58, 0.28),
    "ember": (0.86, 0.43, 0.16),
    "flame": (0.95, 0.72, 0.24),
    "ash": (0.40, 0.38, 0.36),
    "pale_water": (0.50, 0.62, 0.70),
    # --- skin and hair ---
    "skin_light": (0.85, 0.68, 0.57),
    "skin_mid": (0.72, 0.55, 0.43),
    "skin_elf": (0.90, 0.82, 0.74),
    "skin_goblin": (0.52, 0.59, 0.37),
    "skin_goblin_dark": (0.44, 0.50, 0.32),
    "skin_faekin": (0.78, 0.71, 0.69),
    "hair_brown": (0.30, 0.21, 0.15),
    "hair_dark": (0.15, 0.12, 0.11),
    "hair_blond": (0.74, 0.62, 0.38),
    "hair_red": (0.52, 0.26, 0.16),
    "hair_silver": (0.80, 0.80, 0.78),
    "hair_gold": (0.80, 0.68, 0.40),
    "hair_goblin": (0.24, 0.20, 0.14),
    # --- clothing: homespun, wool, calico ---
    "wool_blue": (0.30, 0.38, 0.50),
    "wool_brown": (0.42, 0.32, 0.24),
    "wool_gray": (0.46, 0.46, 0.45),
    "linsey_ochre": (0.70, 0.57, 0.31),
    "calico_red": (0.62, 0.30, 0.28),
    "homespun": (0.72, 0.66, 0.52),
    "loden_green": (0.34, 0.42, 0.30),
    "black_coat": (0.19, 0.18, 0.19),
    "elf_green": (0.38, 0.50, 0.38),
    "elf_cream": (0.84, 0.80, 0.68),
    "faekin_indigo": (0.28, 0.30, 0.40),
    "boot": (0.25, 0.19, 0.15),
    "felt_hat": (0.34, 0.28, 0.22),
    # --- animals ---
    "deer_brown": (0.60, 0.43, 0.29),
    "deer_belly": (0.84, 0.76, 0.64),
    "antler": (0.80, 0.72, 0.58),
    "hoof": (0.20, 0.17, 0.15),
    "wolf_gray": (0.52, 0.51, 0.48),
    "wolf_dark": (0.34, 0.33, 0.32),
    "wolf_light": (0.76, 0.73, 0.66),
    "cow_red": (0.56, 0.31, 0.21),
    "cow_white": (0.89, 0.86, 0.79),
    "cow_pink": (0.80, 0.60, 0.55),
    "mule_brown": (0.46, 0.36, 0.29),
    "mule_muzzle": (0.74, 0.66, 0.54),
    # --- previews (not part of any model) ---
    "preview_bg": (0.91, 0.88, 0.80),
    "preview_pad": (0.80, 0.80, 0.66),
}


def shade(c, k):
    """Scale brightness of an sRGB triple."""
    return tuple(max(0.0, min(1.0, v * k)) for v in c[:3])


def mix(a, b, t):
    """Linear blend of two sRGB triples (t=0 -> a, t=1 -> b)."""
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def srgb_to_linear(c):
    """sRGB triple -> linear triple (what glTF COLOR_0 / Blender float colors store)."""
    out = []
    for v in c[:3]:
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)
