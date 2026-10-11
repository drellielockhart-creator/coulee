"""Nature: oak, maple, white pine, birch, shrub, rock, dolomite outcrop, bluff rock, grass tuft."""

import math

from palette import PALETTE as P
from palette import shade
from registry import model, new_mesh


def _trunk(m, base_r, top_r, h, color, n=6, lean=(0.0, 0.0)):
    m.cyl((0, 0, 0), base_r, top_r, h, color, n=n, toff=lean)


@model("oak", "nature", "Bur oak of the oak savanna: broad, spreading crown on a short trunk.", ["tree", "hardwood"])
def oak():
    m = new_mesh("oak")
    m.cyl((0, 0, 0), 0.5, 0.34, 1.5, P["bark"], n=6)  # flared base
    m.limb((0, 0, 1.4), (-1.4, 0.3, 3.3), 0.27, 0.15, P["bark"], n=5)
    m.limb((0, 0, 1.4), (1.5, -0.2, 3.1), 0.25, 0.15, P["bark_dark"], n=5)
    m.limb((0, 0, 1.4), (0.1, 0.9, 3.6), 0.22, 0.14, P["bark"], n=5)
    leaf, top, dark = P["oak_leaf"], P["oak_leaf_light"], P["oak_leaf_dark"]
    crowns = [
        ((-1.7, 0.4, 4.0), (2.0, 1.8, 1.4), 1),
        ((1.8, -0.3, 3.8), (2.1, 1.9, 1.4), 2),
        ((0.1, 1.1, 4.7), (2.0, 1.8, 1.3), 3),
        ((-0.2, -1.2, 4.3), (1.7, 1.5, 1.2), 4),
        ((0.0, 0.0, 5.3), (2.2, 2.0, 1.2), 5),
    ]
    for at, rad, sd in crowns:
        m.blob(at, rad, leaf, top=top, bottom=dark, sub=0, seed=sd, jit=0.14)
    return m


@model("maple", "nature", "Sugar maple: dense rounded crown, fresh spring green.", ["tree", "hardwood", "sugar"])
def maple():
    m = new_mesh("maple")
    m.cyl((0, 0, 0), 0.36, 0.22, 3.0, P["bark_dark"], n=6)
    m.limb((0, 0, 2.6), (-0.7, 0.2, 3.8), 0.15, 0.09, P["bark_dark"], n=5)
    m.limb((0, 0, 2.6), (0.8, -0.2, 3.7), 0.14, 0.09, P["bark_dark"], n=5)
    leaf, top = P["maple_leaf"], P["maple_leaf_light"]
    m.blob((0.0, 0.0, 5.0), (2.2, 2.1, 2.1), leaf, top=top, bottom=shade(leaf, 0.7), sub=1, seed=11, jit=0.12)
    m.blob((-1.2, 0.5, 4.2), (1.5, 1.4, 1.2), leaf, top=top, bottom=shade(leaf, 0.7), sub=1, seed=12, jit=0.12)
    m.blob((1.3, -0.4, 4.3), (1.4, 1.4, 1.2), leaf, top=top, bottom=shade(leaf, 0.7), sub=1, seed=13, jit=0.12)
    return m


@model("pine", "nature", "Eastern white pine: tall, layered whorls of dark needles.", ["tree", "conifer", "pine"], aliases=["white_pine"])
def pine():
    m = new_mesh("pine")
    m.cyl((0, 0, 0), 0.34, 0.14, 11.0, P["bark_dark"], n=6)
    tiers = [  # z0, r, h, rot
        (1.8, 2.2, 2.4, 0),
        (3.4, 1.9, 2.3, 20),
        (5.0, 1.6, 2.2, 40),
        (6.5, 1.3, 2.1, 10),
        (7.9, 1.0, 2.0, 30),
        (9.2, 0.7, 1.9, 0),
        (10.4, 0.4, 1.7, 15),
    ]
    for i, (z, r, h, rot) in enumerate(tiers):
        col = P["pine"] if i % 2 == 0 else P["pine_dark"]
        m.cyl((0, 0, z), r, 0.0, h, col, n=7, start=rot, bot_color=P["pine_dark"])
    return m


@model("birch", "nature", "Paper birch: white trunk with dark lenticels, slender light crown.", ["tree", "hardwood"])
def birch():
    m = new_mesh("birch")
    m.cyl((0, 0, 0), 0.2, 0.12, 5.2, P["birch_bark"], n=5, toff=(0.2, 0.0))
    for z, a in ((0.7, 20), (1.6, 80), (2.5, 140), (3.4, 200), (4.2, 260)):
        t = z / 5.2
        cx = 0.2 * t
        r = 0.2 - 0.08 * t
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        m.box((cx + ca * r * 0.98, sa * r * 0.98, z), (0.1, 0.1, 0.1), P["birch_mark"], rot=(0, 0, a), cap_bot=True)
    leaf = P["birch_leaf"]
    m.blob((0.3, 0.0, 5.6), (1.2, 1.2, 1.7), leaf, top=shade(leaf, 1.12), bottom=shade(leaf, 0.75), sub=1, seed=21, jit=0.14)
    m.blob((-0.5, 0.4, 4.5), (0.9, 0.9, 1.1), leaf, top=shade(leaf, 1.12), bottom=shade(leaf, 0.75), sub=1, seed=22, jit=0.14)
    m.blob((0.9, -0.3, 4.3), (0.8, 0.8, 1.0), leaf, top=shade(leaf, 1.12), bottom=shade(leaf, 0.75), sub=1, seed=23, jit=0.14)
    return m


@model("shrub", "nature", "Hazel and dogwood thicket.", ["plant", "brush"])
def shrub():
    m = new_mesh("shrub")
    for i, (at, rad) in enumerate(
        [((0.0, 0.0, 0.5), (0.7, 0.65, 0.5)), ((0.6, 0.25, 0.38), (0.5, 0.5, 0.38)), ((-0.5, -0.2, 0.36), (0.5, 0.45, 0.36))]
    ):
        m.blob(at, rad, P["shrub"], top=shade(P["shrub"], 1.2), bottom=P["shrub_dark"], sub=1, seed=30 + i, jit=0.16, flat=0.6)
    return m


@model("rock", "nature", "Glacial erratic and fieldstone cluster.", ["stone"])
def rock():
    m = new_mesh("rock")
    m.blob((0, 0, 0.4), (0.75, 0.6, 0.5), P["fieldstone"], top=shade(P["fieldstone"], 1.15), bottom=shade(P["fieldstone"], 0.7), sub=0, seed=41, jit=0.2, flat=0.55)
    m.blob((0.8, 0.35, 0.2), (0.35, 0.3, 0.25), P["dolomite_dark"], top=P["dolomite"], sub=0, seed=42, jit=0.2, flat=0.4)
    m.blob((-0.6, -0.5, 0.15), (0.3, 0.25, 0.2), P["fieldstone"], top=shade(P["fieldstone"], 1.15), sub=0, seed=43, jit=0.2, flat=0.4)
    return m


def _strata(m, layers, color_cycle, cap=None):
    """Stack tapered slabs, each slightly offset: the layered look of Driftless dolomite."""
    z = 0.0
    for i, (w, d, h, ox, oy) in enumerate(layers):
        col = color_cycle[i % len(color_cycle)]
        m.box((ox, oy, z), (w, d, h), col, top=(w * 0.94, d * 0.94), toff=(0.02, -0.02), cap_bot=(i == 0), top_color=shade(col, 1.08))
        z += h
    if cap:
        m.blob((layers[-1][3], layers[-1][4], z - 0.05), (layers[-1][0] * 0.5, layers[-1][1] * 0.5, 0.3), cap, top=shade(cap, 1.15), sub=0, seed=7, jit=0.15, flat=0.5)
    return z


@model("dolomite_outcrop", "nature", "Stratified dolomite outcrop with a cap of moss and grass.", ["stone", "bluff"])
def dolomite_outcrop():
    m = new_mesh("dolomite_outcrop")
    cyc = [P["dolomite"], P["dolomite_light"], P["dolomite_dark"], P["limestone"]]
    layers = [(4.2, 3.0, 0.55, 0, 0), (3.8, 2.7, 0.5, 0.15, -0.1), (3.6, 2.6, 0.7, -0.1, 0.05), (3.0, 2.2, 0.45, 0.1, 0.1), (2.4, 1.8, 0.4, -0.05, 0.0)]
    _strata(m, layers, cyc, cap=P["moss"])
    m.blob((1.9, -1.2, 0.2), (0.5, 0.45, 0.3), P["dolomite_dark"], top=P["dolomite"], sub=0, seed=3, jit=0.2, flat=0.5)
    m.blob((-1.8, -1.0, 0.18), (0.4, 0.4, 0.26), P["dolomite"], top=P["dolomite_light"], sub=0, seed=4, jit=0.2, flat=0.5)
    return m


@model("bluff_rock", "nature", "Bluff face: tall stepped dolomite cliff with a green brow, the coulee wall.", ["stone", "bluff", "landform"])
def bluff_rock():
    m = new_mesh("bluff_rock")
    cyc = [P["dolomite_light"], P["dolomite"], P["limestone_dark"], P["dolomite"], P["dolomite_dark"]]
    layers = [
        (12.0, 5.5, 1.2, 0.0, 0.0),
        (11.2, 4.8, 1.4, -0.3, 0.3),
        (10.2, 4.2, 1.1, 0.2, 0.6),
        (9.4, 3.8, 1.5, -0.2, 0.9),
        (8.4, 3.4, 1.2, 0.3, 1.2),
    ]
    z = _strata(m, layers, cyc)
    # overhanging brow of sod, oaks' leaf green
    m.box((0.2, 1.2, z), (8.6, 3.6, 0.5), P["moss"], top=(8.0, 3.2), top_color=P["grass"])
    m.blob((-2.6, 1.2, z + 0.5), (1.2, 1.0, 0.7), P["shrub"], top=shade(P["shrub"], 1.2), sub=0, seed=5, jit=0.15, flat=0.5)
    m.blob((2.8, 1.4, z + 0.5), (1.0, 0.9, 0.6), P["shrub_dark"], top=P["shrub"], sub=0, seed=6, jit=0.15, flat=0.5)
    # talus at the foot
    for i, (x, y, r) in enumerate(((-4.6, -3.1, 0.9), (-2.0, -3.3, 0.7), (1.8, -3.4, 0.8), (4.5, -3.0, 1.0), (5.6, -2.0, 0.6))):
        m.blob((x, y, 0.2), (r, r * 0.8, r * 0.55), P["dolomite_dark"], top=P["dolomite"], sub=0, seed=50 + i, jit=0.2, flat=0.5)
    return m


@model("grass_tuft", "nature", "Tuft of prairie grass, for ground dressing.", ["plant", "dressing"])
def grass_tuft():
    m = new_mesh("grass_tuft")
    blades = [
        (0.00, 0.00, 0.55, 0.00, 0.10), (0.08, 0.06, 0.42, 0.9, 0.12), (-0.07, 0.05, 0.48, 2.1, -0.1),
        (0.05, -0.08, 0.38, 3.3, 0.14), (-0.09, -0.04, 0.34, 4.4, -0.12), (0.12, -0.02, 0.28, 5.2, 0.1),
        (-0.03, 0.1, 0.30, 5.9, -0.08),
    ]  # fmt: skip
    for i, (x, y, h, a, lean) in enumerate(blades):
        col = P["grass_blade"] if i % 3 else P["grass_blade_dry"]
        ca, sa = math.cos(a), math.sin(a)
        m.cyl((x, y, 0), 0.045, 0.0, h, col, n=3, toff=(0, 0), rot=(lean * 120 * ca, lean * 120 * sa, 0))
    return m
