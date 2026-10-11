"""Buildings. Meters, origin at footprint center on the ground, front (door side) faces -Y.

Dimensions are plausible 1855 sizes, slightly generous so they read as the largest thing on their
footprint tile block (1 tile = 10 ft = 3.05 m). The web fits models to footprints using manifest.json.
"""

import math

from lowpoly import Walls, gable_roof, hip_roof, spire
from models_props import make_barrel, make_crate, make_sack
from palette import PALETTE as P
from palette import shade
from registry import model, new_mesh


def chimney(m, x, y, z0, z1, w=0.85, d=0.95, color=None):
    color = color or P["limestone"]
    m.box((x, y, z0), (w, d, z1 - z0), color, top=(w * 0.88, d * 0.88), bands=3, band_k=-0.05, cap_bot=False)
    m.box((x, y, z1 - 0.02), (w * 1.1, d * 1.1, 0.14), P["limestone_dark"], cap_bot=False)


def posts(m, pts, h, size=0.16, color=None, z0=0.0):
    for x, y in pts:
        m.box((x, y, z0), (size, size, h), color or P["wood_light"], cap_bot=False)


# ================================================================= cabin


@model("cabin", "building", "Squared-log cabin with a stone chimney, shingle roof and a little stoop.", ["home", "log"])
def cabin():
    m = new_mesh("cabin")
    W, D, H, z0 = 5.6, 4.4, 2.3, 0.25
    m.box((0, 0, 0), (W + 0.25, D + 0.25, z0 + 0.02), P["fieldstone"], cap_bot=False, bands=2, band_k=-0.08)
    w = Walls(m, W, D, H, P["wood_weathered"], z0=z0, bands=7, band_k=-0.09)
    ch = H / 7
    for sx in (-1, 1):
        for sy in (-1, 1):
            for c in range(1, 6):
                z = z0 + c * ch
                col = P["wood_light"] if c % 2 else P["wood_gray"]
                if c % 2:
                    m.box((sx * (W / 2 + 0.02), sy * (D / 2 - 0.15), z), (0.56, 0.26, ch * 0.9), col, cap_bot=False)
                else:
                    m.box((sx * (W / 2 - 0.15), sy * (D / 2 + 0.02), z), (0.26, 0.56, ch * 0.9), col, cap_bot=False)
    gable_roof(m, (0, 0, z0 + H), W, D, 1.4, P["shingle"], over=(0.45, 0.55), end_color=P["wood_dark"], under=P["wood_dark"])
    chimney(m, W / 2 + 0.38, 0.2, 0, z0 + H + 2.0, w=0.8, d=1.1)
    w.door("-y", -1.1, w=0.95, h=1.85)
    w.window("-y", 1.25, 0.85, w=0.7, h=0.8, shutters=P["wood_dark"])
    w.window("+y", 0.0, 0.85, w=0.7, h=0.8)
    w.window("-x", 0.0, 0.85, w=0.6, h=0.7, frame=P["wood_light"])
    # stoop with a shed roof on two posts
    m.box((-1.1, -D / 2 - 0.85, 0), (1.9, 1.3, 0.2), P["wood_light"], cap_bot=False)
    posts(m, [(-1.95, -D / 2 - 1.35), (-0.25, -D / 2 - 1.35)], 2.1, 0.12)
    m.slab(-1.1, 2.3, (-D / 2 - 1.6, 2.0), (-D / 2 + 0.05, 2.35), 0.1, P["shingle_light"])
    return m


# ================================================================= house


@model("house", "building", "Framed clapboard house: stone foundation, slate roof, porch, kitchen ell.", ["home", "framed"])
def house():
    m = new_mesh("house")
    W, D, H, z0 = 7.2, 5.6, 3.1, 0.45
    m.box((0, 0, 0), (W + 0.3, D + 0.3, z0 + 0.02), P["limestone"], cap_bot=False, bands=2, band_k=-0.05)
    w = Walls(m, W, D, H, P["cream"], z0=z0, bands=10, band_k=-0.045)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), z0), (0.2, 0.2, H), P["paint_white"], cap_bot=False)
    gable_roof(m, (0, 0, z0 + H), W, D, 2.1, P["slate"], over=(0.5, 0.6), end_color=P["cream"], under=P["wood_light"])
    chimney(m, -1.8, 0.5, z0 + H, z0 + H + 3.0, w=0.9, d=0.9)
    w.door("-y", 0.0, w=1.05, h=2.2)
    for u in (-2.3, 2.3):
        w.window("-y", u, 1.0, w=0.8, h=1.3, shutters=P["shutter_green"])
    w.window("+x", 0.0, 1.0, w=0.8, h=1.3, shutters=P["shutter_green"])
    w.window("-x", 0.0, 1.0, w=0.8, h=1.3, shutters=P["shutter_green"])
    # attic windows in the gable ends
    m.face_out([(W / 2 + 0.5 + 0.02, -0.35, z0 + H + 0.6), (W / 2 + 0.52, 0.35, z0 + H + 0.6), (W / 2 + 0.52, 0.35, z0 + H + 1.3), (W / 2 + 0.52, -0.35, z0 + H + 1.3)], P["glass"], (1, 0, 0))
    # front porch
    px, py = 0.0, -D / 2 - 0.95
    m.box((px, py, 0), (4.4, 1.7, 0.4), P["wood_light"], cap_bot=False)
    posts(m, [(-2.0, py - 0.7), (-0.7, py - 0.7), (0.7, py - 0.7), (2.0, py - 0.7)], 2.5, 0.15, P["paint_white"], z0=0.4)
    m.slab(0, 4.9, (py - 1.0, z0 + 2.75), (-D / 2 + 0.05, z0 + 3.1), 0.12, P["slate_light"])
    # kitchen ell
    ew, ed, eh = 3.6, 4.0, 2.6
    e = Walls(m, ew, ed, eh, P["cream"], at=(W / 2 + ew / 2 - 0.2, 0.9), z0=z0, bands=9, band_k=-0.045)
    m.box((W / 2 + ew / 2 - 0.2, 0.9, 0), (ew + 0.3, ed + 0.3, z0 + 0.02), P["limestone"], cap_bot=False)
    gable_roof(m, (W / 2 + ew / 2 - 0.2, 0.9, z0 + eh), ew, ed, 1.5, P["slate"], over=(0.4, 0.45), end_color=P["cream"], under=P["wood_light"])
    e.window("-y", 0.0, 0.95, w=0.8, h=1.1, shutters=P["shutter_green"])
    e.door("+x", 0.9, w=0.9, h=2.0)
    chimney(m, W / 2 + ew - 0.5, 1.0, z0 + eh, z0 + eh + 2.0, w=0.7, d=0.7)
    return m


# ================================================================= store (outfitter)


@model("store", "building", "General store and outfitter: false front, boardwalk, signboard, goods out front.", ["store", "outfitter", "shop"], aliases=["outfitter"])
def store():
    m = new_mesh("store")
    W, D, H, z0 = 8.4, 10.4, 3.5, 0.3
    m.box((0, 0, 0), (W + 0.2, D + 0.2, z0 + 0.02), P["fieldstone"], cap_bot=False)
    w = Walls(m, W, D, H, P["wood_weathered"], z0=z0, bands=2, band_k=-0.05)
    gable_roof(m, (0, 0, z0 + H), W, D, 1.7, P["shingle"], over=(0.2, 0.3), ridge="y", end_color=P["wood_gray"], under=P["wood_dark"])
    # false front
    fy = -D / 2 - 0.16
    top = 5.7
    m.box((0, fy, z0), (W + 0.3, 0.34, top), P["wood_light"], bands=1, cap_bot=False)
    m.box((0, fy - 0.08, z0 + top - 0.1), (W + 0.7, 0.5, 0.28), P["barn_red_dark"], cap_bot=False)
    m.box((0, fy - 0.1, z0 + top - 1.65), (W - 0.9, 0.12, 1.1), P["slate"], cap_bot=False)
    for i in range(3):  # signboard lettering suggested by cream bars
        x = -2.2 + i * 2.2
        m.wallquad("y", fy - 0.17, -1, x - 0.22, x + 0.22, z0 + top - 1.35, z0 + top - 0.55, P["cream"])
    # entrance and big display windows (drawn on the false front)
    fw = Walls.__new__(Walls)
    fw.m, fw.W, fw.D, fw.H, fw.ax, fw.ay, fw.z0 = m, W, 0.34, top, 0.0, fy, z0
    fw.door("-y", 0.0, w=1.6, h=2.25, step=False)
    for u in (-2.6, 2.6):
        fw.window("-y", u, 0.75, w=1.7, h=1.45, frame=P["paint_white"])
    fw.window("-y", 2.6, 3.0, w=1.2, h=1.1, lit=True)
    # boardwalk with an awning
    by = -D / 2 - 1.35
    m.box((0, by, 0), (W + 0.8, 2.2, 0.28), P["wood_light"], cap_bot=False)
    for i in (2, 5):
        m.topquad(-(W + 0.8) / 2, (W + 0.8) / 2, by - 1.1 + i * 0.275 - 0.012, by - 1.1 + i * 0.275 + 0.012, 0.281, P["wood_dark"])
    posts(m, [(-W / 2 - 0.1, by - 0.9), (-W / 6, by - 0.9), (W / 6, by - 0.9), (W / 2 + 0.1, by - 0.9)], 2.9, 0.16, z0=0.28)
    m.slab(0, W + 1.0, (by - 1.3, 3.2), (-D / 2 - 0.2, 3.5), 0.12, P["shingle_light"])
    # goods out front
    m.add(make_barrel("sb1"), (-3.2, by - 0.1, 0.28))
    m.add(make_crate("sc1", 0.7), (3.1, by - 0.1, 0.28), rz=10)
    # hanging lantern bracket
    m.box((W / 2 + 0.55, by - 0.9, 0.28), (0.1, 0.1, 3.0), P["wood_dark"], cap_bot=False)
    m.box((W / 2 + 0.55, by - 0.9 + 0.35, 2.7), (0.08, 0.7, 0.08), P["iron"], cap_bot=False)
    m.box((W / 2 + 0.55, by - 0.5, 2.25), (0.3, 0.3, 0.42), P["glass_lit"], top=(0.22, 0.22))
    w.window("+x", 0.0, 1.1, w=0.8, h=1.1)
    return m


# ================================================================= tavern


@model("tavern", "building", "Two-story tavern with a gallery porch, chimneys at both ends and a hanging sign.", ["tavern", "court", "inn"])
def tavern():
    m = new_mesh("tavern")
    W, D, H, z0 = 9.2, 7.0, 5.0, 0.4
    m.box((0, 0, 0), (W + 0.3, D + 0.3, z0 + 0.02), P["limestone"], cap_bot=False, bands=2, band_k=-0.05)
    w = Walls(m, W, D, H, P["ochre"], z0=z0, bands=2, band_k=-0.045)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), z0), (0.22, 0.22, H), P["paint_white"], cap_bot=False)
    m.box((0, -D / 2 - 0.02, z0 + 2.55), (W + 0.05, 0.1, 0.14), P["paint_white"], cap_bot=False)  # belt course
    gable_roof(m, (0, 0, z0 + H), W, D, 2.5, P["shingle"], over=(0.6, 0.7), end_color=P["ochre"], under=P["wood_dark"])
    for sx in (-1, 1):
        chimney(m, sx * (W / 2 + 0.3), 0.0, 0, z0 + H + 3.4, w=0.9, d=1.5)
    # ground floor: doors and windows
    w.door("-y", 0.0, w=1.5, h=2.2, color=P["barn_red_dark"], step=False)
    for u in (-3.2, 3.2):
        w.window("-y", u, 0.85, w=0.75, h=1.3, shutters=P["shutter_green"], lit=(u == 1.9))
    # upper floor
    for u in (-3.4, 0.0, 3.4):
        w.window("-y", u, 3.2, w=0.75, h=1.25, lit=(u == -1.7))
    for u in (-2.0, 2.0):
        w.window("+y", u, 1.0, w=0.8, h=1.2)
    # gallery: porch deck, posts, balcony, rail, shed roof
    gy = -D / 2 - 1.1
    m.box((0, gy, 0), (W - 0.2, 2.2, 0.38), P["wood_light"], cap_bot=False)
    for i in (2, 5):
        m.topquad(-(W - 0.2) / 2, (W - 0.2) / 2, gy - 1.1 + i * 0.275 - 0.012, gy - 1.1 + i * 0.275 + 0.012, 0.381, P["wood_dark"])
    px = [-4.3, -2.15, 0.0, 2.15, 4.3]
    posts(m, [(x, gy - 0.95) for x in px], 5.0, 0.17, P["paint_white"], z0=0.38)
    m.box((0, gy, z0 + 2.3), (W - 0.2, 2.2, 0.18), P["wood_mid"], cap_bot=True)
    m.box((0, gy - 0.95, z0 + 3.4), (W - 0.2, 0.08, 0.1), P["paint_white"], cap_bot=False)
    for x in [-4.3 + i * 2.15 for i in range(5)]:
        m.box((x, gy - 0.95, z0 + 2.45), (0.05, 0.05, 0.95), P["paint_white"], cap_bot=False)
    m.slab(0, W + 0.4, (gy - 1.35, z0 + 4.65), (-D / 2 + 0.05, z0 + 5.2), 0.13, P["shingle_light"])
    # hanging sign on a post at the corner
    sx = W / 2 + 0.9
    m.box((sx, gy - 0.9, 0), (0.14, 0.14, 3.6), P["wood_dark"], cap_bot=False)
    m.box((sx, gy - 0.9 + 0.4, 3.4), (0.09, 0.9, 0.09), P["iron"], cap_bot=False)
    m.box((sx, gy - 0.9 + 0.7, 2.3), (0.08, 0.95, 0.9), P["barn_red_dark"], cap_bot=False)
    m.box((sx + 0.05, gy - 0.9 + 0.7, 2.7), (0.04, 0.6, 0.12), P["brass"], cap_bot=False)
    m.add(make_barrel("tb", wood=None), (-W / 2 + 0.3, gy - 0.3, 0.38))
    return m


# ================================================================= church


@model("church", "building", "Lutheran church: white clapboard nave, square tower, belfry and slate spire.", ["church", "worship", "landmark"])
def church():
    m = new_mesh("church")
    W, D, H, z0 = 7.4, 11.4, 4.4, 0.4
    m.box((0, 0, 0), (W + 0.3, D + 0.3, z0 + 0.02), P["limestone"], cap_bot=False, bands=2, band_k=-0.05)
    w = Walls(m, W, D, H, P["paint_white"], z0=z0, bands=9, band_k=-0.04)
    gable_roof(m, (0, 0, z0 + H), W, D, 3.0, P["slate"], over=(0.45, 0.55), ridge="y", end_color=P["paint_white"], under=P["slate_light"])
    # chancel (apse-like rear room)
    cw = Walls(m, 4.4, 2.8, 3.4, P["paint_white"], at=(0, D / 2 + 1.1), z0=z0, bands=7, band_k=-0.04)
    gable_roof(m, (0, D / 2 + 1.1, z0 + 3.4), 4.4, 2.8, 1.8, P["slate"], over=(0.3, 0.3), ridge="y", end_color=P["paint_white"], under=P["slate_light"])
    cw.pointed_window("+y", 0.0, 0.9, w=0.8, h=1.4)
    # tower
    tw, td, th = 3.4, 3.4, 6.6
    ty = -D / 2 - 0.5
    t = Walls(m, tw, td, th, P["paint_white"], at=(0, ty), z0=z0, bands=11, band_k=-0.04)
    m.box((0, ty, 0), (tw + 0.3, td + 0.3, z0 + 0.02), P["limestone"], cap_bot=False)
    bz = z0 + th
    m.box((0, ty, bz), (tw - 0.3, td - 0.3, 2.1), P["paint_white"], cap_bot=False)
    m.box((0, ty, bz + 2.1), (tw + 0.35, td + 0.35, 0.2), P["wood_light"], cap_bot=True)  # belfry cornice
    for sd in ("-y", "+y", "-x", "+x"):
        b = Walls.__new__(Walls)
        b.m, b.W, b.D, b.H, b.ax, b.ay, b.z0 = m, tw - 0.3, td - 0.3, 2.1, 0.0, ty, bz
        b.rect(sd, 0.0, 0.35, 0.85, 1.4, P["glass"], 0.03)
        b.rect(sd, -0.5, 0.45, 0.08, 1.2, P["paint_white"], 0.04)
        b.rect(sd, 0.5, 0.45, 0.08, 1.2, P["paint_white"], 0.04)
    spire(m, (0, ty, bz + 2.3), tw + 0.2, 4.8, P["slate"], n=4, cap_color=P["slate_light"])
    m.box((0, ty, bz + 7.0), (0.12, 0.12, 0.8), P["iron"], cap_bot=False)
    m.box((0, ty, bz + 7.5), (0.45, 0.1, 0.1), P["iron"], cap_bot=False)
    # doors and windows
    t.door("-y", 0.0, w=1.5, h=2.5, color=P["door"])
    t.pointed_window("-y", 0.0, 3.4, w=0.9, h=1.2)
    for sd in ("-x", "+x"):
        for u in (-3.6, -1.2, 1.2, 3.6):
            w.pointed_window(sd, u, 1.2, w=0.85, h=1.8)
    return m


# ================================================================= smithy


@model("smithy", "building", "Smithy at the ford: open-fronted forge shed, big stone chimney, anvil and quench trough.", ["smithy", "workshop", "forge"])
def smithy():
    m = new_mesh("smithy")
    W, D, H = 7.4, 6.4, 3.0
    t = 0.25
    m.box((0, 0, 0), (W, D, 0.1), P["earth"])  # beaten-earth floor
    wood = P["wood_dark"]
    m.box((0, D / 2 - t / 2, 0.1), (W, t, H), wood, bands=1, cap_bot=False)
    for sx in (-1, 1):
        m.box((sx * (W / 2 - t / 2), 0, 0.1), (t, D, H), wood if sx < 0 else P["wood_mid"], cap_bot=False)
    m.box((W / 4 + 0.2, -D / 2 + t / 2, 0.1), (W / 2 - 0.4, t, 1.5), wood, cap_bot=False)  # half-wall at front right
    posts(m, [(-W / 2 + 0.3, -D / 2 + 0.2), (0.0, -D / 2 + 0.2)], H + 0.1, 0.25, P["wood_mid"], z0=0.1)
    gable_roof(m, (0, 0, 0.1 + H), W, D, 1.7, P["shingle"], over=(0.5, 0.9), end_color=wood, under=P["wood_dark"])
    # forge hearth and big chimney (back-left)
    m.box((-2.3, 2.1, 0.1), (2.2, 1.7, 0.95), P["limestone_dark"], top=(2.0, 1.5), bands=2, band_k=-0.06)
    m.topquad(-3.0, -1.7, 1.55, 2.55, 1.06, P["ember"])
    m.topquad(-2.7, -2.0, 1.75, 2.35, 1.07, P["flame"])
    m.box((-2.3, 2.45, 1.05), (1.6, 1.0, 3.6), P["limestone"], top=(1.0, 0.9), bands=4, band_k=-0.05)
    m.box((-2.3, 2.45, 4.6), (1.2, 1.2, 0.2), P["limestone_dark"], cap_bot=False)
    chimney(m, -2.3, 2.45, 4.7, 6.0, w=0.9, d=0.9)
    # anvil on a stump, quench trough, coal pile, iron stock
    m.cyl((0.4, -0.3, 0.1), 0.34, 0.3, 0.7, P["wood_mid"], n=7, top_color=P["wood_cut"])
    m.box((0.4, -0.3, 0.8), (0.75, 0.24, 0.2), P["iron"], top=(0.6, 0.22))
    m.limb((0.78, -0.3, 0.92), (1.15, -0.3, 0.9), 0.07, 0.02, P["iron"], n=4)
    m.box((0.4, -0.3, 0.74), (0.3, 0.3, 0.07), P["iron"])
    m.box((2.1, 0.3, 0.1), (1.5, 0.6, 0.55), P["wood_light"], cap_bot=False)
    m.topquad(1.45, 2.75, 0.07, 0.53, 0.654, P["pale_water"])
    m.blob((-2.9, 0.3, 0.3), (0.55, 0.5, 0.3), P["coal"], top=P["iron"], sub=0, seed=7, jit=0.2, flat=0.6)
    for i, x in enumerate((-1.2, -0.95, -0.7)):
        m.limb((x, 2.9, 0.1), (x + 0.2, 3.0, 2.2), 0.04, 0.04, P["iron"], n=4)
    m.add(make_barrel("sbar", scale=0.9), (3.0, 1.9, 0.1))
    # sign: horseshoe suggested by a board over the opening
    m.box((-W / 4 + 0.2, -D / 2 - 0.05, 2.1), (3.0, 0.1, 0.5), P["wood_light"], cap_bot=False)
    return m


# ================================================================= mill


def _waterwheel(m, cx, cy, cz, R=2.3, width=1.3, buckets=12):
    # two rims (axis along x), spokes, paddles, axle
    for dx in (-width / 2 + 0.1, width / 2 - 0.1):
        m.ring((cx + dx, cy, cz), R, R - 0.2, 0.1, P["wood_mid"], n=buckets, rot=(0, 90, 0), inner_color=P["wood_weathered"])
        for k in range(3):
            t = math.radians(k * 60)
            ry, rz = (R - 0.1) * math.cos(t), (R - 0.1) * math.sin(t)
            m.limb((cx + dx, cy - ry, cz - rz), (cx + dx, cy + ry, cz + rz), 0.07, 0.07, P["wood_light"], n=4)
    for k in range(buckets):
        a = k * 360.0 / buckets
        t = math.radians(a)
        px, py, pz = cx, cy - (R - 0.3) * math.sin(t), cz + (R - 0.3) * math.cos(t)
        m.box((px, py, pz), (width, 0.6, 0.16), P["wood_dark"] if k % 2 else P["wood_weathered"], rot=(a, 0, 0), cap_bot=False)
    m.limb((cx - width / 2 - 0.15, cy, cz), (cx + width / 2 + 0.55, cy, cz), 0.16, 0.16, P["wood_dark"], n=6)


@model("mill", "building", "Haugen's grist mill: limestone ground story, timber upper, hoist, overshot waterwheel and flume.", ["mill", "workplace", "landmark"])
def mill():
    m = new_mesh("mill")
    W, D = 10.4, 8.2
    bh, uh = 3.6, 3.2
    base = Walls(m, W, D, bh, P["limestone"], bands=1, band_k=-0.06)
    up = Walls(m, W - 0.5, D - 0.4, uh, P["wood_gray"], z0=bh, bands=1, band_k=-0.05)
    m.box((0, 0, bh - 0.05), (W + 0.25, D + 0.25, 0.2), P["limestone_dark"])  # string course
    gable_roof(m, (0, 0, bh + uh), W - 0.5, D - 0.4, 2.7, P["shingle"], over=(0.5, 0.7), end_color=P["wood_gray"], under=P["wood_dark"])
    # hoist house on the front gable
    hx = 0.0
    hy = -(D - 0.4) / 2 - 0.45
    hh = Walls(m, 2.1, 1.1, 2.2, P["wood_weathered"], at=(hx, hy), z0=bh + 0.7, bands=1, band_k=-0.05)
    gable_roof(m, (hx, hy, bh + 0.7 + 2.2), 2.1, 1.1, 0.9, P["shingle_light"], over=(0.2, 0.25), ridge="y", end_color=P["wood_weathered"])
    hh.rect("-y", 0.0, 0.2, 1.1, 1.7, P["glass"], 0.03)
    m.limb((hx, hy - 0.5, bh + 2.5), (hx, hy - 1.35, bh + 2.5), 0.08, 0.08, P["wood_dark"], n=4)
    m.limb((hx, hy - 1.3, bh + 2.5), (hx, hy - 1.3, bh + 1.5), 0.012, 0.012, P["rope"], n=3)
    m.add(make_sack("hs", P["homespun"], 0.5), (hx, hy - 1.3, bh + 1.0))
    # doors, windows
    base.door("-y", -2.2, w=1.5, h=2.3, color=P["door"])
    base.door("-y", 2.4, w=1.1, h=2.0)
    base.window("-y", 0.9, 1.2, w=0.7, h=0.9)
    for u in (-3.5, 3.5):
        up.window("-y", u, 0.8, w=0.8, h=1.2)
    up.window("+y", 0.0, 0.8, w=0.8, h=1.2)
    base.window("+y", 0.0, 1.2, w=0.7, h=0.9)
    # wheel on the east (+x) wall, with a flume running to its top
    cx = W / 2 + 0.9
    R = 2.3
    cz = R + 0.15
    _waterwheel(m, cx, 0.0, cz, R, buckets=6)
    fx0, fx1 = cx + 0.1, cx + 4.6
    m.box(((fx0 + fx1) / 2, 0, cz + R - 0.2), (fx1 - fx0, 1.0, 0.3), P["wood_light"], cap_bot=True)
    m.topquad(fx0, fx1, -0.4, 0.4, cz + R + 0.101, P["pale_water"])
    for x in (fx0 + 1.2, fx1 - 0.3):
        for y in (-0.4, 0.4):
            m.box((x, y, 0), (0.22, 0.22, cz + R - 0.2), P["wood_dark"], cap_bot=False)
    m.box((fx1 + 0.4, 0, cz + R - 0.35), (0.9, 1.5, 0.5), P["wood_mid"])  # headbox
    # sacks, barrel and a cart-step at the front
    return m


# ================================================================= schoolhouse


@model("schoolhouse", "building", "One-room schoolhouse: red clapboard, bell cupola, tall windows.", ["school", "civic"])
def schoolhouse():
    m = new_mesh("schoolhouse")
    W, D, H, z0 = 6.0, 8.0, 2.9, 0.3
    m.box((0, 0, 0), (W + 0.2, D + 0.2, z0 + 0.02), P["fieldstone"], cap_bot=False)
    w = Walls(m, W, D, H, P["barn_red"], z0=z0, bands=9, band_k=-0.05)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (W / 2 - 0.04), sy * (D / 2 - 0.04), z0), (0.18, 0.18, H), P["paint_white"], cap_bot=False)
    gable_roof(m, (0, 0, z0 + H), W, D, 2.0, P["shingle"], over=(0.4, 0.5), ridge="y", end_color=P["barn_red"], under=P["wood_dark"])
    # cupola with louvers and a hip cap
    cz = z0 + H + 2.0
    cy = -D / 2 + 1.2
    m.box((0, cy, cz - 0.4), (1.2, 1.2, 1.2), P["paint_white"], cap_bot=False)
    cw = Walls.__new__(Walls)
    cw.m, cw.W, cw.D, cw.H, cw.ax, cw.ay, cw.z0 = m, 1.2, 1.2, 1.2, 0.0, cy, cz - 0.4
    for sd in ("-y", "+y", "-x", "+x"):
        cw.rect(sd, 0.0, 0.2, 0.55, 0.8, P["glass"], 0.03)
    m.blob((0, cy, cz + 0.2), (0.14, 0.14, 0.14), P["brass"], sub=0, seed=3, jit=0.0)
    spire(m, (0, cy, cz + 0.8), 1.5, 1.0, P["slate"], n=4)
    chimney(m, 0.0, D / 2 - 1.0, z0 + H + 0.3, z0 + H + 2.6, w=0.7, d=0.7)
    # entrance
    w.door("-y", 0.0, w=1.2, h=2.1)
    for u in (-1.9, 1.9):
        w.window("-y", u, 1.0, w=0.7, h=1.2)
    for sd in ("-x", "+x"):
        for u in (-2.6, 0.0, 2.6):
            w.window(sd, u, 0.9, w=0.8, h=1.5)
    m.box((0, -D / 2 - 0.55, 0), (1.9, 1.1, 0.35), P["limestone"], cap_bot=False)
    return m


# ================================================================= print shop


@model("print_shop", "building", "Sentinel print shop: narrow two-story false front, wide display window, stovepipe.", ["print", "press", "workplace"])
def print_shop():
    m = new_mesh("print_shop")
    W, D, H, z0 = 5.4, 8.0, 4.4, 0.3
    m.box((0, 0, 0), (W + 0.2, D + 0.2, z0 + 0.02), P["fieldstone"], cap_bot=False)
    w = Walls(m, W, D, H, P["slate_blue"], z0=z0, bands=12, band_k=-0.05)
    gable_roof(m, (0, 0, z0 + H), W, D, 1.2, P["shingle"], over=(0.15, 0.2), ridge="y", end_color=P["slate_blue"], under=P["wood_dark"])
    fy = -D / 2 - 0.12
    top = 6.0
    m.box((0, fy, z0), (W + 0.2, 0.28, top), P["slate_blue"], bands=14, band_k=-0.05, cap_bot=False)
    m.box((0, fy - 0.08, z0 + top - 0.15), (W + 0.6, 0.45, 0.3), P["paint_white"], cap_bot=False)
    m.box((0, fy - 0.1, z0 + top - 1.7), (W - 0.8, 0.1, 1.05), P["black_coat"], cap_bot=False)
    for i in range(7):
        x = -1.8 + i * 0.6
        m.wallquad("y", fy - 0.16, -1, x - 0.18, x + 0.18, z0 + top - 1.45, z0 + top - 0.75, P["cream"])
    fw = Walls.__new__(Walls)
    fw.m, fw.W, fw.D, fw.H, fw.ax, fw.ay, fw.z0 = m, W, 0.28, top, 0.0, fy, z0
    fw.window("-y", -0.9, 0.7, w=2.6, h=1.6, lit=True)
    fw.door("-y", 1.7, w=0.95, h=2.15)
    for u in (-1.3, 1.3):
        fw.window("-y", u, 3.0, w=0.9, h=1.2)
    fw.rect("-y", 0.0, 2.5, W - 0.4, 0.12, P["paint_white"], 0.03)
    # stovepipe, hanging press-sign
    m.cyl((1.2, 2.4, z0 + H + 0.2), 0.11, 0.11, 2.4, P["iron"], n=6)
    m.cyl((1.2, 2.4, z0 + H + 2.5), 0.17, 0.17, 0.12, P["iron"], n=6)
    m.box((W / 2 + 0.35, fy - 0.5, z0 + 3.4), (0.07, 0.9, 0.07), P["iron"], cap_bot=False)
    m.box((W / 2 + 0.35, fy - 0.85, z0 + 2.7), (0.07, 0.7, 0.55), P["cream"], cap_bot=False)
    m.add(make_crate("pc", 0.6), (-1.6, fy - 0.8, 0), rz=10)
    w.window("+x", -1.0, 1.0, w=0.8, h=1.3)
    w.window("+x", 1.6, 1.0, w=0.8, h=1.3)
    w.window("-x", 0.0, 1.0, w=0.8, h=1.3)
    return m


# ================================================================= landing


@model("landing", "building", "Ferry landing: plank deck on pilings, approach ramp, ferryman's hut, lantern post and mooring posts.", ["ferry", "river", "dock"])
def landing():
    m = new_mesh("landing")
    W, D, zt = 9.6, 4.6, 0.95
    for ix, x in enumerate((-4.4, -1.5, 1.5, 4.4)):
        for y in (-2.0, 2.0):
            m.cyl((x, y, 0), 0.17, 0.15, zt + 0.5 if ix in (0, 4) else zt + 0.1, P["bark_dark"], n=6)
    m.box((0, 0, zt - 0.28), (W, 0.18, 0.28), P["wood_dark"], cap_bot=False)
    for y in (-1.6, 0.0, 1.6):
        m.box((0, y, zt - 0.3), (W, 0.18, 0.3), P["wood_dark"], cap_bot=False)
    m.box((0, 0, zt - 0.05), (W, D, 0.14), P["wood_light"])
    for i in (2, 5, 8, 11):
        m.topquad(-W / 2 + i * W / 12 - 0.012, -W / 2 + i * W / 12 + 0.012, -D / 2, D / 2, zt + 0.091, P["wood_dark"])
    # approach ramp on land side (-y)
    m.slab(0, 3.2, (-D / 2 - 3.8, 0.05), (-D / 2, zt + 0.09), 0.14, P["wood_weathered"])
    for y in (-D / 2 - 1.0, -D / 2 - 2.0, -D / 2 - 3.0):
        m.box((0, y, 0.12 + (y + D / 2 + 3.8) * (zt / 3.8) * 0.93), (3.1, 0.07, 0.04), P["wood_dark"], cap_bot=False)
    # mooring posts (river side +y)
    for x in (-3.9, -1.3, 1.3, 3.9):
        m.cyl((x, D / 2 - 0.25, zt + 0.09), 0.14, 0.12, 0.45, P["bark"], n=6, top_color=P["wood_cut"])
    # lantern post
    m.box((-W / 2 + 0.3, -D / 2 + 0.3, zt + 0.09), (0.14, 0.14, 2.8), P["wood_dark"], cap_bot=False)
    m.box((-W / 2 + 0.3, -D / 2 + 0.3, zt + 2.6), (0.34, 0.34, 0.42), P["glass_lit"], top=(0.26, 0.26))
    m.cyl((-W / 2 + 0.3, -D / 2 + 0.3, zt + 3.02), 0.28, 0.0, 0.25, P["iron"], n=4, start=45)
    # ferryman's hut with a lean-to roof
    hx, hy, hw, hd, hh = 3.0, 0.2, 2.8, 2.4, 2.2
    hut = Walls(m, hw, hd, hh, P["wood_gray"], at=(hx, hy), z0=zt + 0.09, bands=1, band_k=-0.06)
    m.slab(hx, hw + 0.5, (hy - hd / 2 - 0.35, zt + 0.09 + hh + 0.2), (hy + hd / 2 + 0.2, zt + 0.09 + hh - 0.25), 0.12, P["shingle"])
    hut.door("-y", -0.5, w=0.8, h=1.7, step=False)
    hut.window("-x", 0.0, 0.8, w=0.6, h=0.6)
    # ferry-rope stanchion and goods
    m.box((-1.0, 0.2, zt + 0.09), (0.22, 0.22, 2.5), P["wood_dark"], cap_bot=False)
    m.limb((-1.0, 0.2, zt + 2.2), (-1.0 + 0.0, D / 2 + 2.6, zt + 0.6), 0.025, 0.025, P["rope"], n=3)
    m.add(make_barrel("lb"), (-3.2, 0.0, zt + 0.09))
    m.add(make_crate("lc", 0.65), (-3.6, 1.1, zt + 0.09), rz=15)
    return m


# ================================================================= barn


@model("barn", "building", "Gambrel-roofed bank barn: red board siding, X-braced doors, hayloft door, cupola, stone foundation.", ["farm", "barn", "livestock"])
def barn():
    m = new_mesh("barn")
    W, D, H, z0 = 9.6, 13.0, 4.4, 0.6
    m.box((0, 0, 0), (W + 0.3, D + 0.3, z0 + 0.02), P["limestone"], cap_bot=False, bands=2, band_k=-0.06)
    w = Walls(m, W, D, H, P["barn_red"], z0=z0, bands=1)
    hw = W / 2 + 0.45
    prof = [(-hw, 0.0), (hw, 0.0), (W * 0.32, 2.3), (0.0, 3.6), (-W * 0.32, 2.3)]
    m.prism_x((0, 0, z0 + H), prof, D + 1.0, P["shingle"], end_color=P["barn_red"], rot=(0, 0, 90), under_color=P["wood_dark"])
    # white trim on the corners and eaves
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), z0), (0.2, 0.2, H), P["paint_white"], cap_bot=False)
    # big front doors with X-braces
    fy = -D / 2
    n = (0, -1, 0)
    w.rect("-y", 0.0, 0.0, 3.8, 3.3, P["barn_red_dark"], 0.03)
    w.rect("-y", 0.0, 0.0, 0.1, 3.3, P["paint_white"], 0.045)
    for sx in (-1, 1):
        cx = sx * 0.95
        for a, b in (((cx - 0.8, 0.12), (cx + 0.8, 3.2)), ((cx - 0.8, 3.2), (cx + 0.8, 0.12))):
            m.strip((a[0], fy - 0.05, z0 + a[1]), (b[0], fy - 0.05, z0 + b[1]), 0.1, P["paint_white"], n)
    w.rect("-y", -1.95, 0.0, 0.1, 3.4, P["paint_white"], 0.045)
    w.rect("-y", 1.95, 0.0, 0.1, 3.4, P["paint_white"], 0.045)
    w.rect("-y", 0.0, 3.3, 4.0, 0.1, P["paint_white"], 0.045)
    # hayloft door high in the gable
    hy = -(D + 1.0) / 2 - 0.04
    m.wallquad("y", hy, -1, -0.8, 0.8, z0 + H + 0.5, z0 + H + 1.9, P["paint_white"])
    m.wallquad("y", hy - 0.01, -1, -0.65, 0.65, z0 + H + 0.62, z0 + H + 1.78, P["glass"])
    m.strip((-0.65, hy - 0.02, z0 + H + 0.62), (0.65, hy - 0.02, z0 + H + 1.78), 0.08, P["paint_white"], n)
    m.strip((-0.65, hy - 0.02, z0 + H + 1.78), (0.65, hy - 0.02, z0 + H + 0.62), 0.08, P["paint_white"], n)
    m.box((0, hy - 0.04, z0 + H + 1.9), (0.1, 0.9, 0.1), P["iron"], cap_bot=False)  # hay hook beam
    for sd in ("-x", "+x"):
        for u in (-4.0, -1.3, 1.3, 4.0):
            w.window(sd, u, 2.2, w=0.6, h=0.7, mullions=False)
    w.door("+x", -4.2, w=1.2, h=2.2, color=P["barn_red_dark"], step=False)
    # ridge cupola
    cz = z0 + H + 3.6
    m.box((0, 0, cz - 0.3), (1.3, 1.3, 1.1), P["paint_white"], cap_bot=False)
    cw = Walls.__new__(Walls)
    cw.m, cw.W, cw.D, cw.H, cw.ax, cw.ay, cw.z0 = m, 1.3, 1.3, 1.1, 0.0, 0.0, cz - 0.3
    for sd in ("-y", "+y", "-x", "+x"):
        cw.rect(sd, 0.0, 0.2, 0.7, 0.7, P["glass"], 0.03)
    spire(m, (0, 0, cz + 0.8), 1.7, 1.1, P["slate"], n=4)
    m.limb((0, 0, cz + 1.9), (0, 0, cz + 2.6), 0.02, 0.012, P["iron"], n=3)
    # hay spilling from a lean-to feed shed, a couple of bales
    return m


# ================================================================= farmstead


@model("farmstead", "building", "Hill farmstead: farmhouse, smokehouse, corn crib, haystack and a well.", ["farm", "home"])
def farmstead():
    m = new_mesh("farmstead")
    # farmhouse (1.5 story, weathered clapboard)
    W, D, H, z0 = 6.0, 5.0, 2.6, 0.35
    hx, hy = -2.6, 1.4
    m.box((hx, hy, 0), (W + 0.2, D + 0.2, z0 + 0.02), P["fieldstone"], cap_bot=False)
    w = Walls(m, W, D, H, P["wood_gray"], at=(hx, hy), z0=z0, bands=3, band_k=-0.05)
    gable_roof(m, (hx, hy, z0 + H), W, D, 1.9, P["shingle"], over=(0.4, 0.5), end_color=P["wood_gray"], under=P["wood_dark"])
    chimney(m, hx + 1.6, hy, z0 + H, z0 + H + 2.7, w=0.8, d=0.8)
    w.door("-y", 0.0, w=0.95, h=2.0)
    for u in (-1.8, 1.8):
        w.window("-y", u, 0.95, w=0.7, h=1.05, shutters=P["shutter_green"])
    w.window("+x", 0.0, 1.0, w=0.7, h=1.0)
    w.window("-x", 0.0, 1.0, w=0.7, h=1.0)
    m.box((hx, hy - D / 2 - 0.75, 0), (2.8, 1.2, 0.3), P["wood_light"], cap_bot=False)
    posts(m, [(hx - 1.3, hy - D / 2 - 1.2), (hx + 1.3, hy - D / 2 - 1.2)], 2.1, 0.13, z0=0.3)
    m.slab(hx, 3.2, (hy - D / 2 - 1.5, z0 + 2.35), (hy - D / 2 + 0.05, z0 + 2.7), 0.1, P["shingle_light"])
    # smokehouse: small windowless hip-roofed box
    sx, sy = -6.9, -2.6
    sm = Walls(m, 2.2, 2.2, 2.0, P["wood_dark"], at=(sx, sy), z0=0.0, bands=2, band_k=-0.06)
    hip_roof(m, (sx, sy, 2.0), 2.2, 2.2, 1.0, P["shingle"], over=0.25)
    sm.door("-y", 0.0, w=0.7, h=1.4, color=P["door"], step=False)
    m.cyl((sx, sy, 2.8), 0.16, 0.16, 0.6, P["iron"], n=5)
    # corn crib: slatted cribs on posts with a gable roof
    cx, cy = 4.0, 3.0
    for ox in (-1.3, 1.3):
        for oy in (-0.7, 0.7):
            m.box((cx + ox, cy + oy, 0), (0.18, 0.18, 0.5), P["bark"], cap_bot=False)
    m.box((cx, cy, 0.5), (3.2, 1.7, 2.0), P["wood_light"], top=(3.5, 1.9), bands=3, band_k=-0.18)
    gable_roof(m, (cx, cy, 2.5), 3.5, 1.9, 0.9, P["shingle"], over=(0.2, 0.25), end_color=P["wood_dark"])
    # corn glimpsed at the slats
    m.topquad(cx - 1.4, cx + 1.4, cy - 0.85, cy + 0.85, 2.49, P["hay"])
    # haystack
    m.cyl((4.6, -3.0, 0), 1.4, 0.0, 2.2, P["hay"], n=8, bot_color=P["hay_dark"])
    m.blob((4.6, -3.0, 0.9), (1.6, 1.6, 1.1), P["hay"], top=P["hay"], bottom=P["hay_dark"], sub=1, seed=9, jit=0.06, flat=0.9)
    m.limb((4.6, -3.0, 2.0), (4.6, -3.0, 3.2), 0.05, 0.03, P["wood_dark"], n=4)
    # well: stone ring, two posts and a tiny gable
    wx, wy = -0.2, -3.8
    m.cyl((wx, wy, 0), 0.75, 0.7, 0.75, P["fieldstone"], n=8, top_color=P["pale_water"])
    posts(m, [(wx - 0.6, wy), (wx + 0.6, wy)], 1.9, 0.12, P["wood_dark"], z0=0.7)
    gable_roof(m, (wx, wy, 2.55), 1.5, 1.0, 0.5, P["shingle"], over=(0.25, 0.25), end_color=P["wood_dark"])
    m.limb((wx, wy, 2.4), (wx, wy, 1.6), 0.012, 0.012, P["rope"], n=3)
    m.cyl((wx, wy, 1.2), 0.14, 0.12, 0.4, P["wood_mid"], n=6)
    # a yard fence stub
    m.add(make_crate("fc", 0.55), (-5.4, -4.3, 0))
    return m
