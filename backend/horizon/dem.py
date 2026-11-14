"""Memory-mapped LOLA polar DEM with bilinear sampling.

Bilinear interpolation between the four surrounding pixel centres (pixel-registered
grid: pixel centre of 0-based column c is at X = (c + 0.5 - N/2) * scale). A point is
"no data" (NaN) if any of its four neighbours lies outside the image or holds the
nodata value. The LOLA polar int16 labels define no MISSING_CONSTANT (the grids are
GMT 'surface' interpolations, i.e. gap-filled); we still treat -32768 as nodata so a
corrupted or edge pixel can never become a fake 16 km pit.
"""
from pathlib import Path

import numpy as np

from .geometry import stereo_xy_from_unit
from .products import PRODUCTS, SCALING_FACTOR

NODATA_DN = -32768


class PolarDEM:
    def __init__(self, name, data_dir):
        self.product = PRODUCTS[name]
        self.name = name
        path = Path(data_dir) / f"{name}.img"
        if not path.exists():
            raise FileNotFoundError(f"{path} missing; run: py -3 -m horizon.download {name}")
        if path.stat().st_size != self.product.img_bytes:
            raise ValueError(f"{path} has wrong size (incomplete download?)")
        n = self.product.n
        self.mm = np.memmap(path, dtype="<i2", mode="r", shape=(n, n))
        self.n, self.scale = n, self.product.scale_m

    def pixel_coords(self, x, y):
        """0-based fractional (column, row) for stereographic X, Y in metres."""
        c = x / self.scale + self.n / 2.0 - 0.5
        r = -y / self.scale + self.n / 2.0 - 0.5
        return c, r

    def sample_xy(self, x, y):
        """Bilinear height (m above 1737.4 km) at stereographic X, Y; NaN = no data."""
        c, r = self.pixel_coords(np.asarray(x, float), np.asarray(y, float))
        return _bilinear(self.mm, c, r)

    def sample_unit(self, p):
        x, y = stereo_xy_from_unit(p)
        return self.sample_xy(x, y)

    def window(self, x, y, radius_m):
        """In-RAM copy of the square of pixels within radius_m of (x, y), clipped.

        One contiguous read instead of millions of random memmap page faults (the
        DEMs live on a spinning disk). Samples identically to the full grid inside
        the window and returns NaN outside it.
        """
        c, r = self.pixel_coords(np.array([x - radius_m, x + radius_m]),
                                 np.array([y + radius_m, y - radius_m]))
        c0, c1 = max(int(np.floor(c[0])) - 2, 0), min(int(np.ceil(c[1])) + 3, self.n)
        r0, r1 = max(int(np.floor(r[0])) - 2, 0), min(int(np.ceil(r[1])) + 3, self.n)
        return Window(self, np.array(self.mm[r0:r1, c0:c1]), c0, r0)


class Window(PolarDEM):
    """A rectangular piece of a PolarDEM held in memory (same sampling code)."""

    def __init__(self, parent, array, c0, r0):  # noqa: D107 (no file opened)
        self.product, self.name = parent.product, parent.name
        self.n, self.scale = parent.n, parent.scale
        self.mm, self.c0, self.r0 = array, c0, r0

    def sample_xy(self, x, y):
        c, r = self.pixel_coords(np.asarray(x, float), np.asarray(y, float))
        return _bilinear(self.mm, c - self.c0, r - self.r0)


def _bilinear(arr, c, r):
    """Bilinear sample of int16 DN array at fractional 0-based (c, r); NaN outside/nodata."""
    nr, nc = arr.shape
    c0, r0 = np.floor(c), np.floor(r)
    ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 <= nc - 1) & (r0 + 1 <= nr - 1)
    out = np.full(c.shape, np.nan)
    if not ok.any():
        return out
    ci, ri = c0[ok].astype(np.intp), r0[ok].astype(np.intp)
    fc, fr = c[ok] - c0[ok], r[ok] - r0[ok]
    v00 = arr[ri, ci].astype(float)
    v01 = arr[ri, ci + 1].astype(float)
    v10 = arr[ri + 1, ci].astype(float)
    v11 = arr[ri + 1, ci + 1].astype(float)
    bad = (v00 == NODATA_DN) | (v01 == NODATA_DN) | (v10 == NODATA_DN) | (v11 == NODATA_DN)
    val = (1 - fr) * ((1 - fc) * v00 + fc * v01) + fr * ((1 - fc) * v10 + fc * v11)
    val[bad] = np.nan
    out[ok] = val * SCALING_FACTOR
    return out


def chained_sampler(dems):
    """Sampler that uses the first DEM (finest first) with data at each point."""
    def sample(p):
        h = dems[0].sample_unit(p)
        for d in dems[1:]:
            miss = np.isnan(h)
            if not miss.any():
                break
            h[miss] = d.sample_unit(p[miss])
        return h
    return sample
