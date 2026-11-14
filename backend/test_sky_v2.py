"""Tests on the generated sky.json v2 and the 10-min fixtures (the files actually shipped)."""
import json
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
SKY = ROOT / "frontend" / "public" / "sky.json"
FIX = ROOT / "frontend" / "src" / "lib" / "__fixtures__"


def ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


@pytest.fixture(scope="module")
def sky():
    return json.loads(SKY.read_text(encoding="utf-8"))


def test_meta_contract(sky):
    m = sky["meta"]
    assert m["version"] == 2
    for k in ("start_utc", "end_utc", "step_hours", "samples", "ephemeris", "kernels",
              "generated_utc", "script_commit", "horizon", "landing_min_utc", "landing_max_utc"):
        assert k in m, k
    assert m["start_utc"] == "2026-09-01T00:00:00Z" and m["end_utc"] == "2029-01-01T00:00:00Z"
    for k in m["kernels"]:
        assert set(k) == {"name", "url", "sha256", "bytes"} and len(k["sha256"]) == 64


def test_time_grid_is_consistent_and_monotonic(sky):
    m = sky["meta"]
    start, end = ts(m["start_utc"]), ts(m["end_utc"])
    assert end > start
    assert (end - start) / timedelta(hours=m["step_hours"]) + 1 == m["samples"]
    lmin, lmax = ts(m["landing_min_utc"]), ts(m["landing_max_utc"])
    assert start < lmin < lmax < end
    # landing window (<= 365 d) + 30 d pad must fit before the end; > 1 synodic month before
    assert lmax + timedelta(days=395) <= end
    assert lmin - start > timedelta(days=29.53)


def test_all_arrays_have_sample_length(sky):
    n = sky["meta"]["samples"]
    for k in ("sun_radius_deg", "earth_radius_deg", "dsn_moon_el_max"):
        assert len(sky[k]) == n, k
    for s in sky["sites"]:
        for k in ("sun_alt", "sun_az", "earth_alt", "earth_az"):
            assert len(s[k]) == n, (s["id"], k)


def test_sun_radius_physically_plausible(sky):
    r = np.array(sky["sun_radius_deg"])
    assert 0.26 < r.min() and r.max() < 0.28
    assert r.max() - r.min() > 0.005  # Earth-Moon orbit eccentricity ~1.7 %: must vary


def test_earth_radius_physically_plausible(sky):
    r = np.array(sky["earth_radius_deg"])
    assert 0.88 < r.min() and r.max() < 1.03
    assert r.max() - r.min() > 0.08  # perigee vs apogee (~12 % distance change)


def test_dsn_range_and_coverage(sky):
    d = np.array(sky["dsn_moon_el_max"])
    assert -90 <= d.min() and d.max() <= 90
    assert 0.5 < np.mean(d >= 10) < 1.0  # mostly covered, never trivially always


def test_dsn_has_lunar_day_rhythm(sky):
    """Autocorrelation peak between 20 and 30 h lag sits at the ~24.8 h lunar day."""
    d = np.array(sky["dsn_moon_el_max"][: 24 * 120])
    d = d - d.mean()
    ac = [np.dot(d[:-k], d[k:]) for k in range(20, 31)]
    best = 20 + int(np.argmax(ac))
    assert best in (24, 25)


def test_sites_have_v2_fields(sky):
    assert len(sky["sites"]) >= 3
    ids = [s["id"] for s in sky["sites"]]
    assert len(set(ids)) == len(ids)
    for s in sky["sites"]:
        assert s["status"] in ("candidate", "target", "landing")
        assert s["uncertainty_m"] is None or isinstance(s["uncertainty_m"], (int, float))
        assert -90 <= s["lat"] <= 90 and -180 <= s["lon"] <= 360


def test_site_angles_in_range(sky):
    for s in sky["sites"]:
        for b in ("sun", "earth"):
            alt, az = np.array(s[f"{b}_alt"]), np.array(s[f"{b}_az"])
            assert np.abs(alt).max() <= 90 and az.min() >= 0 and az.max() <= 360


@pytest.mark.parametrize("name", ["tenmin-peak-near-shackleton.json", "tenmin-im2.json"])
def test_tenmin_fixture(name, sky):
    f = json.loads((FIX / name).read_text(encoding="utf-8"))
    assert f["step_minutes"] == 10 and f["samples"] == 60 * 144 + 1
    for k in ("sun_alt", "sun_az", "earth_alt", "earth_az"):
        assert len(f[k]) == f["samples"]
    # every 6th 10-min sample is an hourly sky.json sample (alt to 3 dp, az to 1 dp)
    site = next(s for s in sky["sites"] if s["id"] == f["site"])
    h0 = f["hourly_index_of_start"]
    assert ts(sky["meta"]["start_utc"]) + timedelta(hours=h0) == ts(f["start_utc"])
    hourly = np.array(site["sun_alt"][h0:h0 + 61])
    assert np.abs(np.array(f["sun_alt"][::6][:61]) - hourly).max() <= 0.0011


def test_fixtures_small():
    assert sum(p.stat().st_size for p in FIX.glob("tenmin-*.json")) <= 1_000_000


def test_polar_sun_periodicity_is_synodic_month(sky):
    """Spec 7.3: autocorrelation of the Sun altitude at polar sites peaks at ~29.53 d."""
    from sanity import acf_peak_days
    polar = [s for s in sky["sites"] if abs(s["lat"]) > 88]
    assert polar
    for s in polar:
        assert acf_peak_days(np.array(s["sun_alt"]), 20, 40) == pytest.approx(29.53, abs=0.1), s["id"]
