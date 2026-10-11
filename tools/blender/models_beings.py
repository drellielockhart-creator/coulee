"""Figures (person, child, elf, goblin, shadow_faekin) and animals (deer, wolf, cow, mule).

All beings face -Y and stand on z=0. Humans are ~1.7 m. Silhouettes are chunky on purpose:
they are read from a top-down orthographic camera a few pixels tall.
"""

import math

from lowpoly import Mesh, circ
from palette import PALETTE as P
from palette import shade
from registry import model, new_mesh


# ---------------------------------------------------------------- people


def make_person(
    seed, H=1.7, build=1.0, head_k=1.0, skin=None, hair=None, shirt=None, trousers=None, vest=None,
    coat=None, skirt=None, hat=None, hair_style="short", ears=None, hands_k=1.0, leg_k=1.0, stoop=0.0,
    belt=True, sash=None, nose_k=1.0,
):  # fmt: skip
    m = new_mesh(seed, jitter=0.025)
    skin = skin or P["skin_light"]
    hair = hair or P["hair_brown"]
    shirt = shirt or P["homespun"]
    trousers = trousers or P["wool_brown"]

    L = 0.48 * H * leg_k  # hip height
    T = 0.32 * H  # torso
    sh_z = L + T
    ws = 0.26 * H * build  # shoulder width
    hw = 0.2 * H * build  # hip width
    hd = 0.14 * H  # depth
    hk = head_k
    head_r = 0.093 * H * hk
    head_z = sh_z + 0.03 * H + head_r * 0.95
    lean = -stoop * H  # torso leans forward (-y)

    # legs and boots
    for sx in (-1, 1):
        x = sx * hw * 0.28
        m.limb((x, 0, L + 0.02), (x, 0.005 * H, 0.05 * H), 0.052 * H * build, 0.034 * H, trousers, n=5)
        m.box((x, -0.025 * H, 0), (0.07 * H, 0.14 * H, 0.06 * H), P["boot"], top=(0.06 * H, 0.12 * H), toff=(0, -0.005 * H))
    # skirt / long coat hides the legs
    longc = skirt or coat
    if longc:
        m.solid(
            (0, 0, L * 0.58), circ(0.2 * H * build, 8, 22.5, 1.0, 0.8), circ(0.12 * H * build, 8, 22.5, 1.0, 0.8),
            L * 0.46, longc, cap_bot=False,
        )  # fmt: skip
    # torso
    body = coat or shirt
    m.box(
        (0, 0, L - 0.02 * H), (hw, hd * 0.9, T + 0.02 * H), body, top=(ws, hd), toff=(0, lean),
    )  # fmt: skip
    if vest:
        m.box((0, -0.012 * H, L + 0.1 * H), (hw * 0.96, hd * 0.9 + 0.012 * H, T * 0.55), vest, top=(ws * 0.9, hd * 0.95), toff=(0, lean * 0.5))
    if belt and not longc:
        m.box((0, 0, L - 0.005 * H), (hw + 0.012, hd * 0.9 + 0.012, 0.035 * H), P["boot"])
    if sash:
        m.box((0, 0, L + 0.02 * H), (hw + 0.012, hd * 0.9 + 0.012, 0.05 * H), sash)
    # arms
    sleeve = coat or shirt
    for sx in (-1, 1):
        s = (sx * (ws / 2 + 0.012 * H), lean, sh_z - 0.02 * H)
        hnd = (sx * (ws / 2 + 0.035 * H), lean - 0.03 * H, L + 0.02 * H)
        m.limb(s, hnd, 0.034 * H * build, 0.027 * H, sleeve, n=5)
        hs = 0.034 * H * hands_k
        m.box((hnd[0], hnd[1], hnd[2] - hs * 1.6), (hs, hs, hs * 1.6 * hands_k), skin, cap_bot=True)
    # neck and head
    m.cyl((0, lean, sh_z - 0.01 * H), 0.032 * H, 0.03 * H, 0.05 * H * hk, skin, n=5)
    hz = head_z
    m.blob((0, lean, hz), (head_r * 0.86, head_r * 0.95, head_r * 1.02), skin, sub=1 if hk > 1.15 else 0, seed=2, jit=0.05, grad=0.45)
    m.box((0, lean - head_r * 0.95, hz - head_r * 0.28), (0.018 * H * nose_k, 0.026 * H * nose_k, 0.032 * H * nose_k), shade(skin, 0.92))
    # hair
    if hair_style == "short":
        m.blob((0, lean + head_r * 0.12, hz + head_r * 0.2), (head_r * 0.93, head_r * 0.96, head_r * 0.85), hair, top=shade(hair, 1.12), sub=0, seed=3, jit=0.05)
    elif hair_style == "long":
        m.blob((0, lean + head_r * 0.15, hz + head_r * 0.2), (head_r * 0.95, head_r * 0.98, head_r * 0.87), hair, top=shade(hair, 1.12), sub=0, seed=3, jit=0.05)
        m.box((0, lean + head_r * 0.78, hz - head_r * 2.0), (head_r * 1.4, head_r * 0.55, head_r * 2.5), hair, top=(head_r * 1.0, head_r * 0.5), cap_bot=True)
    elif hair_style == "bun":
        m.blob((0, lean + head_r * 0.12, hz + head_r * 0.2), (head_r * 0.93, head_r * 0.96, head_r * 0.85), hair, top=shade(hair, 1.12), sub=0, seed=3, jit=0.05)
        m.blob((0, lean + head_r * 0.85, hz + head_r * 0.15), (head_r * 0.45, head_r * 0.45, head_r * 0.4), hair, sub=0, seed=4, jit=0.05)
    # hat
    if hat:
        m.cyl((0, lean, hz + head_r * 0.5), head_r * 1.75, head_r * 1.7, head_r * 0.1, hat, n=8)
        m.cyl((0, lean, hz + head_r * 0.55), head_r * 1.08, head_r * 0.92, head_r * 0.85, shade(hat, 1.06), n=8, top_color=shade(hat, 1.15))
    # ears
    if ears == "elf":
        for sx in (-1, 1):
            m.limb(
                (sx * head_r * 0.82, lean + head_r * 0.05, hz + head_r * 0.0),
                (sx * head_r * 1.95, lean + head_r * 0.28, hz + head_r * 1.0),
                head_r * 0.2, 0.0, skin, n=4,
            )  # fmt: skip
    elif ears == "goblin":
        for sx in (-1, 1):
            poly = [(0, -head_r * 0.5), (head_r * 2.0 * sx, head_r * 0.05), (0, head_r * 0.45)]
            if sx < 0:
                poly = list(reversed(poly))
            # thin vertical sheet, flared sideways and slightly up
            m.extrude((sx * head_r * 0.75, lean + head_r * 0.1, hz + head_r * 0.05), poly, head_r * 0.14, shade(skin, 0.95), rot=(90, 0, 0))
    return m


@model("person", "figure", "Base adult in homespun, vest and a felt hat; the common human.", ["actor", "human"])
def person():
    return make_person(
        "person", H=1.7, skin=P["skin_light"], hair=P["hair_brown"], shirt=P["homespun"], trousers=P["wool_brown"],
        vest=P["wool_blue"], hat=P["felt_hat"],
    )  # fmt: skip


@model("child", "figure", "Child at about 1.15 m: bigger head, short legs, no hat.", ["actor", "human", "child"])
def child():
    return make_person(
        "child", H=1.18, build=0.85, head_k=1.3, skin=P["skin_light"], hair=P["hair_blond"], shirt=P["calico_red"],
        trousers=P["wool_gray"], leg_k=0.92,
    )  # fmt: skip


@model("elf", "figure", "Elf: tall, slender, long hair and a long green coat; pointed ears.", ["actor", "elf", "fae"])
def elf():
    return make_person(
        "elf", H=1.98, build=0.78, head_k=0.95, skin=P["skin_elf"], hair=P["hair_gold"], hair_style="long",
        coat=P["elf_green"], sash=P["elf_cream"], ears="elf", leg_k=1.03, hands_k=1.1,
    )  # fmt: skip


@model("goblin", "figure", "Goblin: short and broad, big ears, practical patched clothing.", ["actor", "goblin", "fae"])
def goblin():
    return make_person(
        "goblin", H=1.2, build=1.25, head_k=1.3, skin=P["skin_goblin"], hair=P["hair_goblin"], shirt=P["linsey_ochre"],
        trousers=P["wool_brown"], vest=P["calico_red"], ears="goblin", stoop=0.03, nose_k=2.0,
        leg_k=0.9, hands_k=1.2,
    )  # fmt: skip


@model("shadow_faekin", "figure", "Shadow faekin: reads as human; a shade too tall, hands a little long, eyes too dark.", ["actor", "faekin", "fae"])
def shadow_faekin():
    # Deliberately close to `person`. The tells are small: height, hands, the pale-gray cast of the skin,
    # and an indigo cast to the dark clothing.
    m = make_person(
        "shadow_faekin", H=1.78, build=0.94, skin=P["skin_faekin"], hair=P["hair_dark"], shirt=P["wool_gray"],
        trousers=P["black_coat"], vest=P["faekin_indigo"], hat=P["felt_hat"], hands_k=1.35, leg_k=1.03,
    )  # fmt: skip
    return m


# ---------------------------------------------------------------- quadrupeds


def _leg(m, x, y, top_z, color, hoof=P["hoof"], thick=1.0, knee=0.5, fwd=0.0):
    k = top_z * knee
    m.limb((x, y, top_z), (x, y + fwd, k), 0.07 * thick, 0.042 * thick, color, n=4)
    m.limb((x, y + fwd, k), (x, y + fwd * 0.4, 0.035), 0.04 * thick, 0.03 * thick, color, n=4)
    m.box((x, y + fwd * 0.4 - 0.015, 0), (0.07 * thick, 0.1 * thick, 0.05), hoof)


@model("deer", "animal", "White-tailed buck, antlers in velvet.", ["animal", "game", "deer"])
def deer():
    m = new_mesh("deer")
    c, belly = P["deer_brown"], P["deer_belly"]
    m.blob((0, 0.02, 0.98), (0.26, 0.62, 0.3), c, top=shade(c, 0.9), bottom=belly, sub=1, seed=61, jit=0.06)
    m.blob((0, -0.38, 1.03), (0.24, 0.3, 0.3), c, bottom=belly, sub=0, seed=62, jit=0.05)
    m.blob((0, 0.42, 1.0), (0.24, 0.3, 0.28), c, bottom=belly, sub=0, seed=63, jit=0.05)
    m.limb((0, -0.5, 1.08), (0, -0.82, 1.5), 0.13, 0.08, c, n=5)
    m.blob((0, -0.9, 1.55), (0.085, 0.15, 0.09), c, sub=0, seed=64, jit=0.04)
    m.limb((0, -0.97, 1.53), (0, -1.2, 1.44), 0.065, 0.04, P["deer_belly"], n=4)
    m.box((0, -1.22, 1.41), (0.045, 0.04, 0.04), P["coal"])
    for sx in (-1, 1):
        m.limb((sx * 0.08, -0.86, 1.62), (sx * 0.2, -0.86, 1.78), 0.055, 0.0, c, n=4)
        # antlers: main beam with two tines
        m.limb((sx * 0.05, -0.88, 1.64), (sx * 0.17, -0.82, 2.0), 0.025, 0.015, P["antler"], n=4)
        m.limb((sx * 0.12, -0.84, 1.85), (sx * 0.22, -0.96, 2.0), 0.015, 0.0, P["antler"], n=3)
        m.limb((sx * 0.15, -0.82, 1.95), (sx * 0.27, -0.76, 2.1), 0.015, 0.0, P["antler"], n=3)
    for sx in (-1, 1):
        _leg(m, sx * 0.12, -0.45, 0.82, c, fwd=-0.03)
        _leg(m, sx * 0.12, 0.5, 0.82, c, fwd=0.05)
    m.limb((0, 0.68, 1.08), (0, 0.85, 0.98), 0.07, 0.04, belly, n=4)
    return m


@model("wolf", "animal", "Timber wolf, gray, head low.", ["animal", "predator", "wolf"])
def wolf():
    m = new_mesh("wolf")
    c, dark, light = P["wolf_gray"], P["wolf_dark"], P["wolf_light"]
    m.blob((0, 0.05, 0.62), (0.19, 0.5, 0.21), c, top=dark, bottom=light, sub=1, seed=71, jit=0.06)
    m.blob((0, -0.3, 0.66), (0.2, 0.26, 0.25), c, top=dark, bottom=light, sub=0, seed=72, jit=0.05)
    m.limb((0, -0.45, 0.7), (0, -0.72, 0.82), 0.13, 0.09, c, n=5)
    m.blob((0, -0.82, 0.82), (0.095, 0.14, 0.09), c, top=dark, sub=0, seed=73, jit=0.04)
    m.limb((0, -0.9, 0.8), (0, -1.1, 0.74), 0.07, 0.04, light, n=4)
    m.box((0, -1.12, 0.71), (0.05, 0.04, 0.04), P["coal"])
    for sx in (-1, 1):
        m.limb((sx * 0.06, -0.8, 0.9), (sx * 0.09, -0.8, 1.08), 0.045, 0.0, dark, n=3)
        _leg(m, sx * 0.11, -0.32, 0.55, c, hoof=dark, thick=0.85)
        _leg(m, sx * 0.11, 0.38, 0.55, c, hoof=dark, thick=0.85, fwd=0.05)
    m.limb((0, 0.5, 0.65), (0, 0.9, 0.34), 0.05, 0.085, dark, n=5)
    return m


@model("cow", "animal", "Red-and-white dairy cow, the homestead's quiet engine.", ["animal", "livestock", "cow"])
def cow():
    m = new_mesh("cow")
    c, w = P["cow_red"], P["cow_white"]
    n0 = len(m.faces)
    m.blob((0, 0.05, 1.0), (0.46, 0.98, 0.52), c, bottom=w, sub=1, seed=81, jit=0.05)
    m.blob((0, -0.45, 1.05), (0.4, 0.4, 0.5), c, bottom=w, sub=1, seed=82, jit=0.05)
    for i in range(n0, len(m.faces)):
        vs, col = m.faces[i]
        cx = sum(v[0] for v in vs) / len(vs)
        cy = sum(v[1] for v in vs) / len(vs)
        cz = sum(v[2] for v in vs) / len(vs)
        if math.sin(cy * 3.3 + 0.6) * math.cos(cx * 5.1 + cz * 3.7) > 0.45:
            m.faces[i] = (vs, w)
    m.blob((0, 0.46, 0.62), (0.2, 0.22, 0.14), P["cow_pink"], sub=0, seed=83, jit=0.05)  # udder
    m.limb((0, -0.85, 1.1), (0, -1.12, 1.15), 0.2, 0.16, c, n=5)
    m.blob((0, -1.25, 1.12), (0.19, 0.26, 0.2), w, sub=0, seed=84, jit=0.04)
    m.limb((0, -1.4, 1.06), (0, -1.5, 1.0), 0.15, 0.12, P["cow_pink"], n=5)
    for sx in (-1, 1):
        m.limb((sx * 0.14, -1.2, 1.28), (sx * 0.32, -1.18, 1.46), 0.03, 0.0, P["antler"], n=3)
        m.limb((sx * 0.17, -1.2, 1.2), (sx * 0.38, -1.2, 1.24), 0.05, 0.03, c, n=4)
        _leg(m, sx * 0.24, -0.62, 0.7, c, thick=1.3, knee=0.55)
        _leg(m, sx * 0.24, 0.62, 0.7, c, thick=1.3, knee=0.55)
    m.limb((0, 1.0, 1.25), (0, 1.12, 0.55), 0.04, 0.03, c, n=4)
    m.blob((0, 1.12, 0.5), (0.05, 0.05, 0.12), P["wolf_dark"], sub=0, seed=85, jit=0.05)
    return m


@model("mule", "animal", "Pack mule with a sawbuck saddle and two sacks; the frontier's freight.", ["animal", "livestock", "pack", "mule"])
def mule():
    m = new_mesh("mule")
    c, mz = P["mule_brown"], P["mule_muzzle"]
    m.blob((0, 0.02, 1.15), (0.3, 0.8, 0.4), c, top=shade(c, 0.92), bottom=shade(c, 1.15), sub=1, seed=91, jit=0.05)
    m.blob((0, -0.5, 1.2), (0.28, 0.35, 0.4), c, sub=0, seed=92, jit=0.05)
    m.limb((0, -0.65, 1.3), (0, -1.0, 1.72), 0.16, 0.1, c, n=5)
    m.blob((0, -1.12, 1.72), (0.1, 0.24, 0.12), c, sub=0, seed=93, jit=0.04)
    m.limb((0, -1.28, 1.7), (0, -1.46, 1.6), 0.09, 0.07, mz, n=5)
    m.box((0, -1.47, 1.57), (0.06, 0.05, 0.05), P["coal"])
    for sx in (-1, 1):
        m.limb((sx * 0.07, -1.0, 1.82), (sx * 0.14, -0.98, 2.2), 0.06, 0.0, c, n=4)
        _leg(m, sx * 0.16, -0.5, 0.95, c, thick=1.15)
        _leg(m, sx * 0.16, 0.55, 0.95, c, thick=1.15, fwd=0.04)
    m.box((0, -0.82, 1.72), (0.07, 0.3, 0.2), shade(c, 0.7), top=(0.05, 0.25))  # mane
    m.limb((0, 0.78, 1.25), (0, 0.9, 0.55), 0.05, 0.035, c, n=4)
    m.blob((0, 0.92, 0.5), (0.07, 0.07, 0.16), shade(c, 0.6), sub=0, seed=94, jit=0.06)
    # sawbuck pack frame, blanket, and two hanging sacks
    m.box((0, 0.0, 1.5), (0.7, 0.9, 0.06), P["calico_red"])
    m.box((0, 0.0, 1.52), (0.12, 0.8, 0.3), P["wood_mid"], top=(0.08, 0.8))
    for sx in (-1, 1):
        m.blob((sx * 0.5, 0.0, 1.35), (0.24, 0.4, 0.34), P["homespun"], top=shade(P["homespun"], 1.1), bottom=shade(P["homespun"], 0.8), sub=0, seed=95 + sx, jit=0.08)
    m.box((0, 0.0, 1.78), (0.4, 0.5, 0.3), P["canvas_shade"], top=(0.34, 0.44))
    return m
