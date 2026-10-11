"""Props: barrel, crate, sack, hay bale, fence, wagon, campfire, tent, woodpile, bridge, ford."""

import math

from lowpoly import Mesh, circ, deck_gaps, lighten
from palette import PALETTE as P
from palette import shade
from registry import model, new_mesh

# ---------------------------------------------------------------- reusable pieces


def make_barrel(seed="barrel", wood=None, scale=1.0):
    m = new_mesh(seed)
    wood = wood or P["wood_mid"]

    def r_at(z):
        # bulged staves: widest at z=.38
        t = abs(z - 0.38) / 0.38
        return 0.33 - 0.07 * t

    m.cyl((0, 0, 0), 0.26, 0.33, 0.38, wood, n=8, start=22.5)
    m.cyl((0, 0, 0.38), 0.33, 0.26, 0.38, wood, n=8, start=22.5, top_color=P["wood_cut"], cap_bot=False)
    for z in (0.07, 0.29, 0.47, 0.69):
        m.cyl((0, 0, z), r_at(z) + 0.012, r_at(z + 0.05) + 0.012, 0.05, P["iron"], n=8, start=22.5, cap_bot=False, cap_top=False)
    if scale != 1.0:
        s = Mesh(seed=1)
        s.add(m, scale=scale)
        return s
    return m


def make_crate(seed="crate", size=0.8, wood=None):
    m = new_mesh(seed)
    wood = wood or P["wood_light"]
    m.box((0, 0, 0), (size, size, size), wood, cap_bot=False)
    t = 0.07
    bar = shade(wood, 0.72)
    # corner posts and cross-slats read as a slatted shipping crate
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (size / 2 - t / 2 + 0.012), sy * (size / 2 - t / 2 + 0.012), 0), (t, t, size + 0.02), bar, cap_bot=False)
    m.box((0, 0, size - 0.02), (size + 0.02, size * 0.2, 0.05), bar, cap_bot=False)
    m.box((0, 0, size - 0.02), (size * 0.2, size + 0.02, 0.05), bar, cap_bot=False)
    m.box((0, 0, size * 0.44), (size + 0.025, size + 0.025, 0.07), bar, cap_bot=False, cap_top=False)
    return m


def make_sack(seed="sack", color=None, h=0.6):
    m = new_mesh(seed)
    color = color or P["homespun"]
    m.blob((0, 0, h * 0.5), (0.26, 0.2, h * 0.5), color, top=shade(color, 1.1), bottom=shade(color, 0.82), sub=1, seed=3, jit=0.06, flat=0.95)
    m.cyl((0, 0, h * 0.92), 0.07, 0.1, 0.1, shade(color, 0.8), n=5)  # tied neck
    return m


def make_bale(seed="bale"):
    m = new_mesh(seed)
    m.box((0, 0, 0), (1.0, 0.5, 0.45), P["hay"], bands=3, band_k=-0.07)
    for x in (-0.28, 0.28):
        m.box((x, 0, 0), (0.04, 0.53, 0.47), P["rope"], cap_bot=False)
    return m


# ---------------------------------------------------------------- catalog props


@model("barrel", "prop", "Cooperage barrel: pork, flour, whiskey, cider.", ["storage", "supplies"])
def barrel():
    return make_barrel("barrel")


@model("crate", "prop", "Slatted shipping crate with a smaller one stacked on top.", ["storage", "supplies"])
def crate():
    m = new_mesh("crate")
    m.add(make_crate("c1", 0.8), (0, 0, 0), rz=8)
    m.add(make_crate("c2", 0.55, P["wood_gray"]), (0.05, 0.02, 0.8), rz=-14)
    m.add(make_crate("c3", 0.5), (0.85, 0.1, 0), rz=-20)
    return m


@model("sack", "prop", "Tied cloth sack: flour, meal, beans.", ["storage", "supplies"])
def sack():
    m = new_mesh("sack")
    m.add(make_sack("s1", P["homespun"]), (-0.15, 0, 0), rz=10)
    m.add(make_sack("s2", P["canvas_shade"], 0.55), (0.3, 0.15, 0), rz=-25)
    m.add(make_sack("s3", P["homespun"], 0.5), (0.05, -0.35, 0), rz=35)
    return m


@model("hay_bale", "prop", "Two bales of hay, stacked.", ["storage", "forage"])
def hay_bale():
    m = new_mesh("hay_bale")
    m.add(make_bale("b1"), (0, 0, 0), rz=4)
    m.add(make_bale("b2"), (0, 0.1, 0.45), rz=-6)
    return m


@model("fence", "prop", "Split-rail fence segment, 3 m long.", ["fence", "boundary"])
def fence():
    m = new_mesh("fence")
    # three rails, stacked in stake-and-rider style, with notched crossing stakes at each end
    for x in (-1.45, 1.45):
        m.box((x - 0.08, 0, 0), (0.12, 0.12, 1.25), P["wood_weathered"], rot=(0, 0, 0), top=(0.1, 0.1), cap_bot=False)
        m.box((x + 0.08, 0, 0), (0.12, 0.12, 1.25), P["wood_gray"], top=(0.1, 0.1), cap_bot=False)
    for i, z in enumerate((0.25, 0.62, 0.98)):
        m.box((0, 0, z), (3.1, 0.14, 0.13), P["wood_weathered"] if i % 2 else P["wood_light"], toff=(0, 0), cap_bot=False)
    return m


@model("woodpile", "prop", "Cordwood stack with a chopping block and axe.", ["fuel", "firewood"])
def woodpile():
    m = new_mesh("woodpile")
    rows = [(4, 0.16), (3, 0.45), (2, 0.74)]
    for count, z in rows:
        for i in range(count):
            y = (i - (count - 1) / 2) * 0.34
            w = P["wood_mid"] if (i + int(z * 10)) % 2 else P["wood_light"]
            m.cyl((-0.75, y, z), 0.16, 0.16, 1.5, w, n=6, rot=(0, 90, 0), bot_color=P["wood_cut"], top_color=P["wood_cut"])
    # chopping block + axe
    m.cyl((1.25, -0.6, 0), 0.24, 0.24, 0.42, P["wood_mid"], n=7, top_color=P["wood_cut"])
    m.limb((1.2, -0.58, 0.42), (1.05, -0.5, 0.2), 0.025, 0.025, P["wood_light"], n=4)
    m.box((1.2, -0.6, 0.38), (0.14, 0.04, 0.12), P["iron"], cap_bot=False)
    return m


@model("tent", "prop", "Canvas wall tent with ridge pole, guy ropes and stakes.", ["camp", "shelter"])
def tent():
    m = new_mesh("tent")
    prof = [(-1.15, 0.0), (1.15, 0.0), (1.15, 0.75), (0.0, 1.95), (-1.15, 0.75)]
    m.prism_x((0, 0, 0), prof, 2.9, P["canvas"], end_color=P["canvas_shade"], rot=(0, 0, 90), under_color=P["canvas_shade"])
    # door flap: dark opening with two canvas flaps on the front (-y) end
    y = -1.45 - 0.02
    m.tri((-0.5, y, 0.0), (0.5, y, 0.0), (0.0, y, 1.35), P["glass"])
    m.tri((-0.5, y - 0.01, 0.0), (-0.05, y - 0.01, 0.0), (-0.05, y - 0.01, 1.3), P["canvas"])
    m.tri((0.5, y - 0.01, 0.0), (0.05, y - 0.01, 0.0), (0.05, y - 0.01, 1.3), P["canvas"])
    # ridge pole ends
    m.limb((0, -1.7, 1.95), (0, 1.7, 1.95), 0.03, 0.03, P["wood_light"], n=4)
    # stakes and guy ropes (front and rear corners)
    for sx in (-1, 1):
        for sy in (-1, 1):
            sp = (sx * 1.7, sy * 1.9, 0.0)
            m.limb(sp, (sp[0], sp[1], 0.28), 0.03, 0.02, P["wood_light"], n=4)
            m.limb((sp[0], sp[1], 0.26), (sx * 1.15, sy * 1.1, 0.75), 0.008, 0.008, P["rope"], n=3)
    return m


@model("campfire", "prop", "Stone-ringed cookfire with a tripod and iron kettle.", ["camp", "fire", "cooking"])
def campfire():
    m = new_mesh("campfire")
    for i in range(8):
        a = math.radians(i * 45 + 10)
        r = 0.55
        m.blob((r * math.cos(a), r * math.sin(a), 0.1), (0.16, 0.14, 0.12), P["fieldstone"] if i % 2 else P["dolomite_dark"], sub=0, seed=i, jit=0.15, flat=0.7)
    m.cyl((0, 0, 0.0), 0.5, 0.5, 0.04, P["ash"], n=10)
    # crossed logs
    m.limb((-0.34, -0.12, 0.13), (0.34, 0.14, 0.2), 0.07, 0.065, P["bark"], n=5)
    m.limb((-0.3, 0.22, 0.14), (0.3, -0.2, 0.2), 0.065, 0.06, P["bark_dark"], n=5)
    m.limb((-0.05, -0.32, 0.14), (0.08, 0.3, 0.22), 0.06, 0.055, P["wood_mid"], n=5)
    # flames
    m.cyl((0, 0, 0.14), 0.2, 0.0, 0.5, P["ember"], n=5)
    m.cyl((0.03, 0.02, 0.14), 0.12, 0.0, 0.62, P["flame"], n=5, start=20)
    m.cyl((-0.1, 0.07, 0.14), 0.09, 0.0, 0.38, P["flame"], n=4, start=10)
    # tripod and kettle
    top = (0.0, 0.0, 1.35)
    for i in range(3):
        a = math.radians(i * 120 + 90)
        m.limb((1.0 * math.cos(a), 1.0 * math.sin(a), 0.0), top, 0.04, 0.03, P["wood_mid"], n=4)
    m.limb(top, (0.0, 0.0, 0.92), 0.01, 0.01, P["iron"], n=3)
    m.blob((0, 0, 0.78), (0.2, 0.2, 0.15), P["iron"], top=P["coal"], sub=1, seed=5, jit=0.03)
    m.limb((-0.2, 0, 0.8), (0.2, 0, 0.8), 0.012, 0.012, P["iron"], n=3)
    return m


def _wheel(m, at, r, depth, seed):
    """Spoked wheel with axis along Y, centered on `at`."""
    rot = (90, 0, 0)
    m.ring(at, r, r - 0.08, depth, P["wood_dark"], n=8, rot=rot, inner_color=P["wood_mid"], outer_color=P["iron"])
    for k in range(3):  # three crossing spars = six spokes
        t = math.radians(k * 60)
        dx, dz = (r - 0.05) * math.cos(t), (r - 0.05) * math.sin(t)
        m.limb((at[0] - dx, at[1], at[2] - dz), (at[0] + dx, at[1], at[2] + dz), 0.035, 0.035, P["wood_light"], n=4)
    m.cyl((at[0], at[1] - depth / 2 - 0.03, at[2]), 0.1, 0.1, depth + 0.06, P["wood_mid"], n=6, rot=(-90, 0, 0))


@model("wagon", "prop", "Canvas-topped emigrant wagon with a load of barrels and sacks.", ["transport", "supplies"])
def wagon():
    m = new_mesh("wagon")
    # bed: boat-shaped, ends swept up
    m.box((0, 0, 0.75), (3.7, 1.15, 0.22), P["wood_mid"], cap_bot=True)
    side_h = 0.6
    for sy in (-1, 1):
        m.box((0, sy * 0.62, 0.8), (3.9, 0.08, side_h), P["wood_weathered"] if sy < 0 else P["wood_gray"], top=(4.15, 0.1), cap_bot=False)
    for sx in (-1, 1):
        m.box((sx * 1.93, 0, 0.8), (0.08, 1.2, side_h), P["wood_weathered"], top=(0.1, 1.28), cap_bot=False)
    # axles, reach, tongue, seat box
    m.box((-1.2, 0, 0.5), (0.1, 1.7, 0.1), P["wood_dark"])
    m.box((1.2, 0, 0.62), (0.1, 1.7, 0.1), P["wood_dark"])
    m.box((0, 0, 0.6), (2.4, 0.1, 0.1), P["wood_dark"])
    m.limb((-1.9, 0, 0.9), (-3.4, 0, 0.5), 0.05, 0.04, P["wood_dark"], n=4)
    m.box((-1.45, 0, 1.4), (0.5, 0.9, 0.12), P["wood_light"])
    # wheels: small in front, large behind
    for sy in (-1, 1):
        _wheel(m, (-1.2, sy * 0.95, 0.55), 0.55, 0.1, 1)
        _wheel(m, (1.2, sy * 0.95, 0.67), 0.67, 0.1, 2)
    # canvas bonnet over bows
    prof = [(-0.62, 0.0), (0.62, 0.0), (0.78, 0.5), (0.5, 0.95), (0.0, 1.12), (-0.5, 0.95), (-0.78, 0.5)]
    m.prism_x((0.3, 0, 1.3), prof, 2.5, P["canvas"], end_color=P["canvas_shade"], under_color=P["canvas_shade"])
    # cargo: barrel and sacks at the open rear
    b = make_barrel("wb", scale=0.8)
    m.add(b, (1.7, -0.25, 1.0))
    m.add(make_sack("ws", P["homespun"], 0.55), (1.55, 0.3, 1.0), rz=20)
    return m


@model("bridge", "prop", "Plank footbridge with iron bar rails over Hasp Creek.", ["crossing"])
def bridge():
    m = new_mesh("bridge")
    L, W = 7.0, 2.4
    # abutments
    for sx in (-1, 1):
        m.box((sx * 3.7, 0, 0), (1.4, W + 0.6, 0.8), P["limestone"], top=(1.0, W + 0.3), bands=3, band_k=-0.05)
    # stringers and deck
    for sy in (-0.8, 0.0, 0.8):
        m.box((0, sy, 0.58), (L, 0.2, 0.28), P["wood_dark"], cap_bot=False)
    m.box((0, 0, 0.82), (L, W, 0.1), P["wood_light"])
    deck_gaps(m, -L / 2, L / 2, -W / 2, W / 2, 0.923, P["wood_dark"], along="y", count=14)
    # iron bar rails
    for sy in (-1, 1):
        y = sy * (W / 2 - 0.06)
        for x in (-3.2, -1.6, 0.0, 1.6, 3.2):
            m.box((x, y, 0.9), (0.08, 0.08, 0.95), P["iron"], cap_bot=False)
        m.box((0, y, 1.8), (L, 0.07, 0.07), P["iron"], cap_bot=False)
        m.box((0, y, 1.2), (L, 0.05, 0.05), P["iron"], cap_bot=False)
    return m


@model("ford", "prop", "The iron ford: rust-red ore bars across a shallow creek bed, with stepping stones.", ["crossing", "water"])
def ford():
    m = new_mesh("ford")
    # gravel banks, shallow water slab, rust-colored iron bars on the creek bed
    m.box((0, -3.2, 0), (9.0, 2.0, 0.12), P["gravel"], top=(8.2, 1.6), cap_bot=False)
    m.box((0, 3.2, 0), (9.0, 2.0, 0.12), P["gravel"], top=(8.2, 1.6), cap_bot=False)
    m.box((0, 0, 0), (9.0, 4.4, 0.08), P["pale_water"], cap_bot=False)
    for i, x in enumerate((-3.4, -1.7, 0.1, 1.9, 3.5)):
        m.box((x, 0.0, 0.07), (0.9, 4.2, 0.1), P["iron_rust"] if i % 2 else P["iron_ore"], top=(0.7, 4.0), cap_bot=False)
    for i, (x, y) in enumerate(((-2.6, -1.4), (-0.8, 1.2), (1.0, -1.0), (2.7, 1.3), (-3.9, 1.0), (4.0, -0.9))):
        m.blob((x, y, 0.1), (0.35, 0.3, 0.2), P["fieldstone"], sub=0, seed=i, jit=0.15, flat=0.6)
    return m
