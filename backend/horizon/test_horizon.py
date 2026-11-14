"""Synthetic-terrain tests of the horizon march (no DEM files needed).

Run from backend/:  py -3 -m pytest horizon -q
"""
import numpy as np
import pytest

from horizon.geometry import (R, curvature_dip_deg, elevation_angle_deg, enu_basis,
                              offset_point, unit_from_latlon)
from horizon.march import compute_horizon

LAT, LON = -89.45, -137.16          # a south-polar site (Connecting Ridge)
STEP = 20.0


def flat(h=0.0):
    return lambda p: np.full(p.shape[:-1], float(h))


def local_xy(p):
    """Local east/north coordinates (m) of points p, projected on the site's tangent plane."""
    e, n, _ = enu_basis(LAT, LON)
    return R * (p @ e), R * (p @ n)


def central_dist(p, q):
    # chord form: accurate near zero, unlike arccos of a dot product
    return 2 * R * np.arcsin(np.clip(np.linalg.norm(p - q, axis=-1) / 2, 0.0, 1.0))


def run(sampler, heights=(0, 2, 5), h_site=0.0, h_max=0.0, r=30e3, step=STEP, az_step=0.25):
    return compute_horizon(LAT, LON, [(r, step, sampler)], heights, az_step=az_step,
                           h_site=h_site, h_max=h_max, r_cap=r)


def test_elevation_formula_matches_vectors():
    u = unit_from_latlon(LAT, LON)
    e, n, up = enu_basis(LAT, LON)
    for theta, ro, rt in [(1e-4, R + 2, R + 50), (0.05, R + 1000, R - 300), (0.2, R, R + 7000)]:
        t = n
        p = np.cos(theta) * u + np.sin(theta) * t
        v = rt * p - ro * u
        expect = np.degrees(np.arcsin(v @ up / np.linalg.norm(v)))
        assert elevation_angle_deg(ro, rt, theta) == pytest.approx(expect, abs=1e-9)


def test_flat_sphere_gives_curvature_only_dip():
    res = run(flat(), h_max=0.0)
    for h in (2, 5):
        dip = curvature_dip_deg(h)
        assert dip < 0
        assert np.allclose(res["h"][float(h)], dip, atol=2e-5), (h, dip, res["h"][float(h)][:3])
    # h = 0: the nearest sample (one step away) is the highest: -step/(2R) rad, ~0
    assert np.allclose(res["h"][0.0], -np.degrees(STEP / (2 * R)), atol=1e-9)


def test_cone_gives_analytic_angle():
    D, H, RC = 3000.0, 400.0, 150.0
    lat_c, lon_c = offset_point(LAT, LON, D, 0.0)          # due east
    c = unit_from_latlon(lat_c, lon_c)

    def cone(p):
        return H * np.clip(1.0 - central_dist(p, c) / RC, 0.0, None)

    res = run(cone, heights=(2,), h_max=H)
    expect = elevation_angle_deg(R + 2.0, R + H, D / R)
    az = res["az"]
    assert res["h"][2.0][az == 90.0][0] == pytest.approx(expect, abs=1e-6)
    assert res["h"][2.0].argmax() == np.where(az == 90.0)[0][0]
    # opposite side sees only the bare sphere
    assert res["h"][2.0][az == 270.0][0] == pytest.approx(curvature_dip_deg(2.0), abs=2e-5)


def test_ridge_has_expected_azimuth_extent():
    DX, W, L, H = 2000.0, 100.0, 2000.0, 300.0     # wall 2 km east, 2 km long (N-S)

    def ridge(p):
        x, y = local_xy(p)
        return np.where((x >= DX) & (x <= DX + W) & (np.abs(y) <= L / 2), H, 0.0)

    res = run(ridge, heights=(2,), h_max=H)
    half = np.degrees(np.arctan((L / 2) / DX))        # 26.57 deg each side of east
    az, h = res["az"], res["h"][2.0]
    blocked = h > 1.0
    inside = (az > 90 - half + 0.5) & (az < 90 + half - 0.5)
    outside = (az < 90 - half - 2.0) | (az > 90 + half + 2.0)
    assert blocked[inside].all()
    assert not blocked[outside].any()


def test_pit_raises_horizon():
    P, RP = 200.0, 1000.0

    def pit(p):
        x, y = local_xy(p)
        return np.where(np.hypot(x, y) < RP, -P, 0.0)

    res = run(pit, heights=(2,), h_site=-P, h_max=0.0)
    # rim edge seen from the floor; the first sample outside the pit is <= one step past RP
    hi = elevation_angle_deg(R - P + 2.0, R, RP / R)
    lo = elevation_angle_deg(R - P + 2.0, R, (RP + STEP) / R)
    h = res["h"][2.0]
    assert lo > 10
    assert ((h >= lo - 1e-9) & (h <= hi + 1e-9)).all()
    assert (h > curvature_dip_deg(2.0)).all()


def test_wraparound_at_north():
    D, H, RC = 2500.0, 300.0, 100.0
    lat_c, lon_c = offset_point(LAT, LON, 0.0, D)           # due north
    c = unit_from_latlon(lat_c, lon_c)

    def cone(p):
        return H * np.clip(1.0 - central_dist(p, c) / RC, 0.0, None)

    res = run(cone, heights=(0,), h_max=H)
    h, az = res["h"][0.0], res["az"]
    assert az[0] == 0.0 and az[-1] == 360.0 - 0.25 and az.size == 1440
    assert h.argmax() == 0
    assert h[1] == pytest.approx(h[-1], abs=1e-6)            # symmetric across 0/360
    assert h[1] > 1.0 and h[-1] > 1.0


def test_stopping_rule_reports_distance():
    res = run(flat(), heights=(2,), h_max=7027.0, r=600e3, step=240.0)
    # worst-case 7 km peak drops below the -0.03 deg dip only far out
    assert 150e3 < res["stop_m"] < 600e3
    assert not res["capped"]
