"""Tiny flat-shaded low-poly mesh kit. Pure Python (no bpy) so it is unit-testable.

Coordinates while modelling: Blender-style, Z up, ground at z=0, origin at the footprint center.
The model's FRONT faces -Y (Blender), which is +Z after the glTF Y-up export. Units are meters.

A Mesh is a bag of colored polygons (no shared vertices: the model is flat-shaded anyway).
Convex primitives are winding-checked as they are placed (`Mesh.bad` counts inward-facing faces).
"""

import math
import random

from palette import mix, shade

# ---------------------------------------------------------------- small vector helpers


def _rot(p, rot):
    rx, ry, rz = (math.radians(a) for a in rot)
    x, y, z = p
    if rx:
        c, s = math.cos(rx), math.sin(rx)
        y, z = y * c - z * s, y * s + z * c
    if ry:
        c, s = math.cos(ry), math.sin(ry)
        x, z = x * c + z * s, -x * s + z * c
    if rz:
        c, s = math.cos(rz), math.sin(rz)
        x, y = x * c - y * s, x * s + y * c
    return (x, y, z)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a):
    return math.sqrt(_dot(a, a))


def _unit(a):
    n = _norm(a) or 1.0
    return (a[0] / n, a[1] / n, a[2] / n)


def newell(vs):
    """Face normal (not unit) from the Newell method; robust for any planar polygon."""
    nx = ny = nz = 0.0
    k = len(vs)
    for i in range(k):
        a, b = vs[i], vs[(i + 1) % k]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return (nx, ny, nz)


def _centroid(vs):
    k = len(vs)
    return (sum(v[0] for v in vs) / k, sum(v[1] for v in vs) / k, sum(v[2] for v in vs) / k)


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(len(a)))


def _clean(vs):
    out = []
    for v in vs:
        if not out or _norm(_sub(v, out[-1])) > 1e-9:
            out.append(v)
    if len(out) > 1 and _norm(_sub(out[0], out[-1])) <= 1e-9:
        out.pop()
    return out


def _align_z(d):
    """Return fn(p) rotating +Z onto direction d (Rodrigues)."""
    d = _unit(d)
    ax = _cross((0.0, 0.0, 1.0), d)
    s = _norm(ax)
    c = d[2]
    if s < 1e-9:
        if c > 0:
            return lambda p: p
        return lambda p: (p[0], -p[1], -p[2])
    k = (ax[0] / s, ax[1] / s, ax[2] / s)

    def f(p):
        kxp = _cross(k, p)
        kdp = _dot(k, p)
        return (
            p[0] * c + kxp[0] * s + k[0] * kdp * (1 - c),
            p[1] * c + kxp[1] * s + k[1] * kdp * (1 - c),
            p[2] * c + kxp[2] * s + k[2] * kdp * (1 - c),
        )

    return f


# ---------------------------------------------------------------- 2D rings


def rect(w, d):
    return [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]


def circ(r, n, start=0.0, sx=1.0, sy=1.0):
    out = []
    for i in range(n):
        a = math.radians(start + 360.0 * i / n)
        out.append((r * math.cos(a) * sx, r * math.sin(a) * sy))
    return out


# ---------------------------------------------------------------- icosphere template

_T = (1 + 5**0.5) / 2
_ICO_V = [
    (-1, _T, 0), (1, _T, 0), (-1, -_T, 0), (1, -_T, 0),
    (0, -1, _T), (0, 1, _T), (0, -1, -_T), (0, 1, -_T),
    (_T, 0, -1), (_T, 0, 1), (-_T, 0, -1), (-_T, 0, 1),
]  # fmt: skip
_ICO_F = [
    (0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11),
    (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
    (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9),
    (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1),
]  # fmt: skip
_ICO_CACHE = {}


def _ico(sub):
    if sub in _ICO_CACHE:
        return _ICO_CACHE[sub]
    verts = [_unit(v) for v in _ICO_V]
    faces = list(_ICO_F)
    for _ in range(sub):
        mids = {}
        nf = []

        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in mids:
                m = _unit(_lerp(verts[a], verts[b], 0.5))
                verts.append(m)
                mids[key] = len(verts) - 1
            return mids[key]

        for a, b, c in faces:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    _ICO_CACHE[sub] = (verts, faces)
    return verts, faces


# ---------------------------------------------------------------- the mesh


class Mesh:
    def __init__(self, seed=1, jitter=0.03):
        self.faces = []  # (tuple of (x,y,z), (r,g,b) sRGB)
        self.rng = random.Random(seed)
        self.jitter = jitter
        self.bad = 0  # count of convex-primitive faces whose winding points inward

    # -- low-level
    def _vary(self, color, var):
        if not var or not self.jitter:
            return tuple(color[:3])
        k = 1.0 + (self.rng.random() * 2.0 - 1.0) * self.jitter
        return shade(color, k)

    def face(self, verts, color, var=True):
        vs = _clean([tuple(v) for v in verts])
        if len(vs) < 3:
            return
        self.faces.append((tuple(vs), self._vary(color, var)))

    def _place(self, local, at=(0, 0, 0), rot=(0, 0, 0), xf=None, check=True, var=True):
        """Transform local faces [(verts, color)], check convex winding, append."""

        def tr(p):
            q = xf(p) if xf else _rot(p, rot)
            return (q[0] + at[0], q[1] + at[1], q[2] + at[2])

        placed = [([tr(p) for p in vs], col) for vs, col in local]
        allv = [v for vs, _ in placed for v in vs]
        sc = _centroid(allv)
        for vs, col in placed:
            vs2 = _clean(vs)
            if len(vs2) < 3:
                continue
            if check:
                n = newell(vs2)
                nn = _norm(n)
                if nn > 1e-9 and _dot(n, _sub(_centroid(vs2), sc)) < -1e-6 * nn:
                    self.bad += 1
            self.faces.append((tuple(vs2), self._vary(col, var)))

    # -- primitives (all take `at` = center of the base)
    def solid(
        self, at, bot, top, h, color, rot=(0, 0, 0), toff=(0, 0), cap_bot=True, cap_top=True,
        top_color=None, bot_color=None, bands=1, band_k=0.0, side_colors=None, xf=None,
    ):  # fmt: skip
        n = len(bot)
        b = [(x, y, 0.0) for x, y in bot]
        t = [(x + toff[0], y + toff[1], h) for x, y in top]
        local = []
        for i in range(n):
            j = (i + 1) % n
            col = side_colors[i] if side_colors else color
            for k in range(bands):
                f0, f1 = k / bands, (k + 1) / bands
                a, bb = _lerp(b[i], t[i], f0), _lerp(b[j], t[j], f0)
                c, d = _lerp(b[j], t[j], f1), _lerp(b[i], t[i], f1)
                cc = shade(col, 1.0 + band_k) if (k % 2 and band_k) else col
                local.append(((a, bb, c, d), cc))
        if cap_bot:
            local.append((tuple(reversed(b)), bot_color or color))
        if cap_top and len(set((round(p[0], 6), round(p[1], 6)) for p in t)) > 1:
            local.append((tuple(t), top_color or color))
        self._place(local, at, rot, xf)

    def box(self, at, size, color, rot=(0, 0, 0), top=None, toff=(0, 0), **kw):
        sx, sy, sz = size
        tw, td = top if top else (sx, sy)
        self.solid(at, rect(sx, sy), rect(tw, td), sz, color, rot=rot, toff=toff, **kw)

    def cyl(self, at, r0, r1, h, color, n=8, rot=(0, 0, 0), start=0.0, **kw):
        bot = circ(r0, n, start)
        top = circ(r1, n, start) if r1 > 1e-9 else [(0.0, 0.0)] * n
        self.solid(at, bot, top, h, color, rot=rot, **kw)

    def limb(self, p0, p1, r0, r1, color, n=5, caps=(True, True), **kw):
        """Tapered cylinder between two points."""
        d = _sub(p1, p0)
        h = _norm(d)
        if h < 1e-9:
            return
        al = _align_z(d)
        self.solid(
            p0, circ(r0, n), circ(r1, n) if r1 > 1e-9 else [(0.0, 0.0)] * n, h, color,
            cap_bot=caps[0], cap_top=caps[1], xf=al, **kw,
        )  # fmt: skip

    def prism_x(self, at, profile, length, color, end_color=None, rot=(0, 0, 0), under_color=None):
        """Extrude a convex (y, z) profile (CCW seen from +x) along x; centered on `at` in x."""
        hl = length / 2
        pts = profile
        n = len(pts)
        local = []
        for i in range(n):
            j = (i + 1) % n
            a, b = pts[i], pts[j]
            col = color
            if under_color and a[1] == 0 and b[1] == 0:
                col = under_color
            local.append((((-hl, a[0], a[1]), (-hl, b[0], b[1]), (hl, b[0], b[1]), (hl, a[0], a[1])), col))
        ec = end_color or color
        local.append((tuple((hl, y, z) for y, z in pts), ec))
        local.append((tuple((-hl, y, z) for y, z in reversed(pts)), ec))
        self._place(local, at, rot)

    def blob(
        self, at, radii, color, top=None, bottom=None, sub=1, seed=0, jit=0.12, rot=(0, 0, 0),
        flat=None, grad=0.35,
    ):  # fmt: skip
        """Jittered icosphere ellipsoid. top/bottom recolor faces by normal.z."""
        verts, faces = _ico(sub)
        r = random.Random(seed * 7919 + 17)
        fac = [1.0 + (r.random() * 2 - 1) * jit for _ in verts]
        pv = []
        for (x, y, z), f in zip(verts, fac):
            p = (x * radii[0] * f, y * radii[1] * f, z * radii[2] * f)
            if flat is not None and p[2] < -radii[2] * flat:
                p = (p[0], p[1], -radii[2] * flat)
            pv.append(p)
        local = []
        for ia, ib, ic in faces:
            tri = (pv[ia], pv[ib], pv[ic])
            nz = _unit(newell(tri))[2] if _norm(newell(tri)) > 1e-12 else 0.0
            col = color
            if top is not None and nz > grad:
                col = top
            elif bottom is not None and nz < -grad:
                col = bottom
            local.append((tri, col))
        self._place(local, at, rot)

    def extrude(self, at, poly, thickness, color, rot=(0, 0, 0)):
        self.solid(at, poly, poly, thickness, color, rot=rot)

    def ring(self, at, r_out, r_in, depth, color, n=8, rot=(0, 0, 0), inner_color=None, outer_color=None):
        """Flat annulus (wheel rim) with its axis along local Z, centered on `at`."""
        o, i = circ(r_out, n, 360.0 / n / 2), circ(r_in, n, 360.0 / n / 2)
        hd = depth / 2
        local = []
        for k in range(n):
            j = (k + 1) % n
            local.append((((*o[k], -hd), (*o[j], -hd), (*o[j], hd), (*o[k], hd)), outer_color or color))
            local.append((((*i[j], -hd), (*i[k], -hd), (*i[k], hd), (*i[j], hd)), inner_color or shade(color, 0.8)))
            local.append((((*o[k], hd), (*o[j], hd), (*i[j], hd), (*i[k], hd)), color))
            local.append((((*o[j], -hd), (*o[k], -hd), (*i[k], -hd), (*i[j], -hd)), color))
        self._place(local, at, rot, check=False)

    # -- flat quads for trim (windows, doors, gaps). No winding check; caller gives sign.
    def wallquad(self, axis, val, sign, u0, u1, z0, z1, color, var=False):
        if axis == "y":
            vs = [(u0, val, z0), (u1, val, z0), (u1, val, z1), (u0, val, z1)]
            if sign > 0:
                vs.reverse()
        else:
            vs = [(val, u0, z0), (val, u1, z0), (val, u1, z1), (val, u0, z1)]
            if sign < 0:
                vs.reverse()
        self.face(vs, color, var)

    def face_out(self, verts, color, outward, var=False):
        """Add a planar polygon, flipping it if needed so it faces `outward`."""
        vs = _clean([tuple(v) for v in verts])
        if len(vs) < 3:
            return
        if _dot(newell(vs), outward) < 0:
            vs.reverse()
        self.faces.append((tuple(vs), self._vary(color, var)))

    def strip(self, p0, p1, width, color, outward):
        """A thin quad from p0 to p1 lying in a wall plane (for braces, trim). `outward` is the plane normal."""
        d = _sub(p1, p0)
        perp = _unit(_cross(d, outward))
        w = width / 2
        a = (p0[0] + perp[0] * w, p0[1] + perp[1] * w, p0[2] + perp[2] * w)
        b = (p0[0] - perp[0] * w, p0[1] - perp[1] * w, p0[2] - perp[2] * w)
        c = (p1[0] - perp[0] * w, p1[1] - perp[1] * w, p1[2] - perp[2] * w)
        e = (p1[0] + perp[0] * w, p1[1] + perp[1] * w, p1[2] + perp[2] * w)
        self.face_out([a, b, c, e], color, outward)

    def slab(self, cx, length, a, b, thick, color):
        """Sloped plank/roof slab running along x, from (y,z)=a to (y,z)=b, `thick` meters thick."""
        (ya, za), (yb, zb) = a, b
        prof = [(ya, za), (yb, zb), (yb, zb + thick), (ya, za + thick)]
        if ya > yb:
            prof = list(reversed(prof))
        self.prism_x((cx, 0, 0), prof, length, color)

    def topquad(self, x0, x1, y0, y1, z, color, var=False):
        self.face([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], color, var)

    def tri(self, a, b, c, color, var=False):
        self.face([a, b, c], color, var)

    # -- composition
    def add(self, other, at=(0, 0, 0), rz=0.0, scale=1.0, tint=None):
        c = math.cos(math.radians(rz))
        s = math.sin(math.radians(rz))
        for vs, col in other.faces:
            nv = []
            for x, y, z in vs:
                x, y, z = x * scale, y * scale, z * scale
                nv.append((x * c - y * s + at[0], x * s + y * c + at[1], z + at[2]))
            self.faces.append((tuple(nv), tint(col) if tint else col))
        self.bad += other.bad

    # -- queries
    def tri_count(self):
        return sum(len(vs) - 2 for vs, _ in self.faces)

    def bounds(self):
        xs = [v[0] for vs, _ in self.faces for v in vs]
        ys = [v[1] for vs, _ in self.faces for v in vs]
        zs = [v[2] for vs, _ in self.faces for v in vs]
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

    def ground_snap(self):
        """Sit the model on z=0."""
        (_, _, z0), _ = self.bounds()
        if abs(z0) > 1e-9:
            self.faces = [(tuple((x, y, z - z0) for x, y, z in vs), c) for vs, c in self.faces]


# ---------------------------------------------------------------- building helpers


class Walls:
    """A box room with helpers to hang windows and doors on its four sides (front = -y)."""

    def __init__(self, m, W, D, H, color, at=(0, 0), z0=0.0, bands=1, band_k=0.0, cap_top=True):
        self.m, self.W, self.D, self.H = m, W, D, H
        self.ax, self.ay, self.z0 = at[0], at[1], z0
        m.box((at[0], at[1], z0), (W, D, H), color, bands=bands, band_k=band_k, cap_top=cap_top)

    def plane(self, side):
        return {
            "-y": ("y", self.ay - self.D / 2, -1),
            "+y": ("y", self.ay + self.D / 2, 1),
            "-x": ("x", self.ax - self.W / 2, -1),
            "+x": ("x", self.ax + self.W / 2, 1),
        }[side]

    def rect(self, side, u, z, w, h, color, off=0.02):
        axis, val, sign = self.plane(side)
        c = (self.ax if axis == "y" else self.ay) + u
        self.m.wallquad(axis, val + sign * off, sign, c - w / 2, c + w / 2, self.z0 + z, self.z0 + z + h, color)

    def window(self, side, u, z, w=0.7, h=1.0, frame=None, glass=None, shutters=None, mullions=True, lit=False):
        from palette import PALETTE as P

        frame = frame or P["paint_white"]
        glass = glass or (P["glass_lit"] if lit else P["glass"])
        self.rect(side, u, z - 0.07, w + 0.14, h + 0.14, frame, 0.012)
        self.rect(side, u, z, w, h, glass, 0.024)
        if mullions:
            self.rect(side, u, z, 0.05, h, frame, 0.034)
            self.rect(side, u, z + h * 0.5 - 0.025, w, 0.05, frame, 0.034)
        if shutters:
            sw = w * 0.5
            self.rect(side, u - (w + sw) / 2 - 0.09, z - 0.05, sw, h + 0.1, shutters, 0.03)
            self.rect(side, u + (w + sw) / 2 + 0.09, z - 0.05, sw, h + 0.1, shutters, 0.03)

    def pointed_window(self, side, u, z, w=0.8, h=1.5, frame=None, glass=None):
        from palette import PALETTE as P

        frame = frame or P["paint_white"]
        glass = glass or P["glass"]
        axis, val, sign = self.plane(side)
        c = (self.ax if axis == "y" else self.ay) + u
        nrm = {"y": (0, sign, 0), "x": (sign, 0, 0)}[axis]

        def pt(uu, zz, off):
            return (c + uu, val + sign * off, self.z0 + zz) if axis == "y" else (val + sign * off, c + uu, self.z0 + zz)

        for k, (ww, hh, col, off) in enumerate(((w + 0.16, h + 0.08, frame, 0.012), (w, h, glass, 0.024))):
            a = pt(-ww / 2, z - (0.04 if k == 0 else 0), off)
            b = pt(ww / 2, z - (0.04 if k == 0 else 0), off)
            self.m.face_out([a, b, pt(ww / 2, z + hh, off), pt(0, z + hh + ww * 0.55, off), pt(-ww / 2, z + hh, off)], col, nrm)
        self.m.strip(pt(0, z, 0.034), pt(0, z + h + w * 0.45, 0.034), 0.05, frame, nrm)

    def door(self, side, u, w=1.0, h=2.0, color=None, frame=None, step=True):
        from palette import PALETTE as P

        color = color or P["door"]
        frame = frame or P["paint_white"]
        self.rect(side, u, 0.0, w + 0.2, h + 0.1, frame, 0.012)
        self.rect(side, u, 0.0, w, h, color, 0.026)
        self.rect(side, u, 0.0, 0.05, h, shade(color, 0.7), 0.036)
        if step:
            axis, val, sign = self.plane(side)
            c = (self.ax if axis == "y" else self.ay) + u
            if axis == "y":
                at = (c, val + sign * 0.28, self.z0)
                size = (w + 0.4, 0.56, 0.16)
            else:
                at = (val + sign * 0.28, c, self.z0)
                size = (0.56, w + 0.4, 0.16)
            self.m.box(at, size, P["limestone_dark"], cap_bot=False)


def gable_roof(m, at, W, D, rise, color, over=(0.4, 0.4), ridge="x", end_color=None, under=None):
    """Gable roof whose eave plane is at at[2]. `W`,`D` are the wall footprint (x, y)."""
    ox, oy = over
    if ridge == "x":
        prof = [(-D / 2 - oy, 0.0), (D / 2 + oy, 0.0), (0.0, rise)]
        m.prism_x(at, prof, W + 2 * ox, color, end_color=end_color, under_color=under)
    else:
        prof = [(-W / 2 - ox, 0.0), (W / 2 + ox, 0.0), (0.0, rise)]
        m.prism_x(at, prof, D + 2 * oy, color, end_color=end_color, rot=(0, 0, 90), under_color=under)


def hip_roof(m, at, W, D, rise, color, over=0.4, ridge_frac=0.0):
    w, d = W + 2 * over, D + 2 * over
    if ridge_frac <= 0:
        tw, td = 0.001, 0.001
    elif W >= D:
        tw, td = max(0.001, (w - d) + d * ridge_frac), d * ridge_frac
    else:
        tw, td = w * ridge_frac, max(0.001, (d - w) + w * ridge_frac)
    m.box(at, (w, d, rise), color, top=(tw, td))


def spire(m, at, w, h, color, n=4, cap_color=None):
    r = w / 2 * (2 ** 0.5 if n == 4 else 1.0)
    m.cyl(at, r, 0.0, h, color, n=n, start=45.0 if n == 4 else 0.0, bot_color=cap_color)


def deck_gaps(m, x0, x1, y0, y1, z, color, along="x", count=8):
    """Plank seams as dark hairline quads on a flat top."""
    for i in range(1, count):
        t = i / count
        if along == "x":
            y = y0 + (y1 - y0) * t
            m.topquad(x0, x1, y - 0.015, y + 0.015, z, color)
        else:
            x = x0 + (x1 - x0) * t
            m.topquad(x - 0.015, x + 0.015, y0, y1, z, color)


def lighten(c, k=0.12):
    return mix(c, (1, 1, 1), k)
