"""Checks on the real LOLA files (skipped when they are not downloaded).

Shackleton crater, IAU/USGS Gazetteer of Planetary Nomenclature (searched 2026-11-14):
diameter 20.92 km, centre -89.67, 129.78 E. If our projection were mirrored
(east/west flip) or rotated, the deep floor would not be found at that point.
"""
import os
from pathlib import Path

import numpy as np
import pytest

from horizon.dem import PolarDEM
from horizon.geometry import latlon_from_stereo_xy, stereo_xy_from_latlon
from horizon.products import PRODUCTS

DATA = Path(os.environ.get("CLPS_LOLA_DATA", r"D:\clps-lola-data"))
SHACK = (-89.67, 129.78)


def have(name):
    f = DATA / f"{name}.img"
    return f.exists() and f.stat().st_size == PRODUCTS[name].img_bytes


def dist_km(a, b):
    xa, ya = stereo_xy_from_latlon(*a)
    xb, yb = stereo_xy_from_latlon(*b)
    return np.hypot(xa - xb, ya - yb) / 1000.0


@pytest.mark.parametrize("name", ["ldem_60s_240m", "ldem_75s_60m", "ldem_80s_20m", "ldem_875s_5m"])
def test_shackleton_floor_is_where_the_gazetteer_says(name):
    if not have(name):
        pytest.skip(f"{name} not downloaded")
    d = PolarDEM(name, DATA)
    cx, cy = stereo_xy_from_latlon(*SHACK)
    step = max(d.scale, 60.0)
    g = np.arange(-15e3, 15e3, step)
    X, Y = np.meshgrid(cx + g, cy + g)
    H = d.sample_xy(X, Y)
    i = np.nanargmin(H)
    deepest = latlon_from_stereo_xy(X.flat[i], Y.flat[i])
    assert H.flat[i] < -2500, H.flat[i]
    assert dist_km(deepest, SHACK) < 4.0, deepest          # floor is ~6 km wide
    # the mirror-image point (east/west flipped) is high ground, not a crater floor
    assert d.sample_xy(*stereo_xy_from_latlon(SHACK[0], -SHACK[1])) > 0


def test_products_agree_where_they_overlap():
    names = [n for n in PRODUCTS if have(n)]
    if len(names) < 2:
        pytest.skip("need two products")
    pts = [(-89.45, -137.16), (-89.7849, -156.03), (-88.5, -61.2), (-84.79, 29.2)]
    for lat, lon in pts:
        x, y = stereo_xy_from_latlon(lat, lon)
        vals = [PolarDEM(n, DATA).sample_xy(x, y) for n in names]
        vals = [float(v) for v in vals if np.isfinite(v)]
        if len(vals) >= 2:
            # coarser grids smooth relief; a few hundred metres on steep ground at most
            assert max(vals) - min(vals) < 400, (lat, lon, dict(zip(names, vals)))


@pytest.mark.parametrize("name", ["ldem_60s_240m", "ldem_875s_5m"])
def test_window_samples_identically_to_full_grid(name):
    """The in-RAM window used by horizon.run must give bit-identical heights inside it."""
    if not have(name):
        pytest.skip(f"{name} not downloaded")
    d = PolarDEM(name, DATA)
    x0, y0 = stereo_xy_from_latlon(-89.7849, -156.03)
    rad = 200 * d.scale
    w = d.window(x0, y0, rad)
    rng = np.random.default_rng(1)
    x = x0 + rng.uniform(-rad, rad, 500)
    y = y0 + rng.uniform(-rad, rad, 500)
    full, win = d.sample_xy(x, y), w.sample_xy(x, y)
    assert np.isfinite(full).all()
    np.testing.assert_array_equal(win, full)
    # outside the window: NaN, so a chained sampler falls back instead of inventing data
    assert np.isnan(w.sample_xy(np.array([x0 + 3 * rad]), np.array([y0])))[0]
