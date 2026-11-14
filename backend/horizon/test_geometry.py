"""Projection and azimuth-convention tests.

The Skyfield test (skipped if Skyfield is not installed) checks that our azimuth
(clockwise from local north) is the same angle Skyfield's altaz() reports, which is
what sky.json contains. Run it with the backend venv that has Skyfield:
  backend/.venv/Scripts/python -m pytest horizon/test_geometry.py
"""
import numpy as np
import pytest

from horizon.dem import PolarDEM
from horizon.geometry import (R, enu_basis, latlon_from_stereo_xy, offset_point,
                              stereo_xy_from_latlon, stereo_xy_from_unit, unit_from_latlon)
from horizon.products import PRODUCTS


@pytest.mark.parametrize("lat,lon", [(-89.7849, -156.03), (-80.13, 1.44), (-84.79, 29.2),
                                     (-89.999, 77.0), (-75.0, -179.9), (-60.0, 90.0)])
def test_projection_round_trip(lat, lon):
    x, y = stereo_xy_from_latlon(lat, lon)
    x2, y2 = stereo_xy_from_unit(unit_from_latlon(lat, lon))
    assert x == pytest.approx(x2, abs=1e-6) and y == pytest.approx(y2, abs=1e-6)
    lat2, lon2 = latlon_from_stereo_xy(x, y)
    assert lat2 == pytest.approx(lat, abs=1e-10)
    assert (lon2 - lon + 180) % 360 - 180 == pytest.approx(0, abs=1e-9)


def test_projection_orientation_matches_catalogue():
    # lon 0 straight up (Earthward = smaller row), lon 90 E to the right (larger column)
    dem = PolarDEM.__new__(PolarDEM)
    dem.n, dem.scale = PRODUCTS["ldem_80s_20m"].n, 20.0
    c0, r0 = dem.pixel_coords(*stereo_xy_from_latlon(-90.0, 0.0))
    assert (c0, r0) == (15199.5, 15199.5)                 # = SAMPLE/LINE_PROJECTION_OFFSET
    c, r = dem.pixel_coords(*stereo_xy_from_latlon(-89.0, 0.0))
    assert r < r0 and c == pytest.approx(c0)
    c, r = dem.pixel_coords(*stereo_xy_from_latlon(-89.0, 90.0))
    assert c > c0 and r == pytest.approx(r0)
    # edge of full coverage: 80 S at lon 0 lands within half a pixel of the top edge
    # (catalogue: the edges reach 79.996-ish, not exactly 80)
    c, r = dem.pixel_coords(*stereo_xy_from_latlon(-80.0, 0.0))
    assert r == pytest.approx(-0.5, abs=0.5)


def test_offset_point_moves_north_away_from_south_pole():
    lat, lon = offset_point(-89.0, 125.0, 0.0, 1000.0)
    assert lat > -89.0 and lon == pytest.approx(125.0, abs=1e-9)
    lat, lon = offset_point(-89.0, 125.0, 1000.0, 0.0)
    assert lon > 125.0                                       # east = increasing longitude


def test_enu_is_right_handed():
    e, n, u = enu_basis(-89.45, -137.16)
    assert np.allclose(np.cross(e, n), u)


def test_azimuth_matches_skyfield_altaz():
    sky = pytest.importorskip("skyfield.api")
    import os
    from pathlib import Path
    data = Path(os.environ.get("CLPS_EPHEM_DIR", Path(__file__).resolve().parents[1] / "data"))
    needed = ["de421.bsp", "moon_080317.tf", "pck00008.tpc", "moon_pa_de421_1900-2050.bpc"]
    if not all((data / f).exists() for f in needed):
        pytest.skip(f"ephemeris files not in {data}")
    load = sky.Loader(str(data), verbose=False)
    eph = load("de421.bsp")
    pc = sky.PlanetaryConstants()
    pc.read_text(load("moon_080317.tf"))
    pc.read_text(load("pck00008.tpc"))
    pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
    frame = pc.build_frame_named("MOON_ME_DE421")
    t = load.timescale().utc(2026, 11, 15)
    for lat, lon in [(-89.45, -137.16), (-80.13, 1.44), (-89.7849, -156.03)]:
        site = eph["moon"] + pc.build_latlon_degrees(frame, lat, lon)
        for az in (0.0, 37.0, 90.0, 200.0, 300.0):
            d = 20000.0
            tl, tn = offset_point(lat, lon, d * np.sin(np.radians(az)), d * np.cos(np.radians(az)))
            tgt = eph["moon"] + pc.build_latlon_degrees(frame, float(tl), float(tn))
            alt_s, az_s, _ = site.at(t).observe(tgt).apparent().altaz()
            diff = (az_s.degrees - az + 180) % 360 - 180
            assert abs(diff) < 0.05, (lat, lon, az, az_s.degrees)
