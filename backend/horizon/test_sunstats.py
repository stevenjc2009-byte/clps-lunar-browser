import numpy as np
import pytest

from horizon.sunstats import disc_fraction, horizon_at, interp_track, longest_run, sun_stats


def test_disc_fraction_limits():
    assert disc_fraction(0.0, 0.0, 0.25) == pytest.approx(0.5)
    assert disc_fraction(1.0, 0.0, 0.25) == pytest.approx(1.0)
    assert disc_fraction(-1.0, 0.0, 0.25) == pytest.approx(0.0)
    assert disc_fraction(0.1, 0.0, 0.25) > 0.5


def test_horizon_interp_wraps_at_360():
    prof = np.zeros(1440)
    prof[0], prof[-1] = 4.0, 2.0
    assert horizon_at(prof, 0.25, 359.875) == pytest.approx(3.0)
    assert horizon_at(prof, 0.25, 360.0) == pytest.approx(4.0)
    assert horizon_at(prof, 0.25, -0.125) == pytest.approx(3.0)


def test_track_unwraps_azimuth():
    a, z = interp_track([1.0, 1.0], [359.0, 1.0], sub=2)
    assert z.tolist() == pytest.approx([359.0, 0.0, 1.0])


def test_longest_run():
    assert longest_run(np.array([1, 1, 0, 1, 1, 1, 0], bool)) == 3
    assert longest_run(np.zeros(4, bool)) == 0


def test_stats_with_terrain_block():
    # Sun circles at 1 deg altitude; a 5-deg wall covers azimuths 90-180 (a quarter)
    hours = 240
    az = (np.arange(hours) * 15.0) % 360.0          # one turn per day
    alt = np.ones(hours)
    prof = np.where((np.arange(1440) * 0.25 >= 90) & (np.arange(1440) * 0.25 < 180), 5.0, 0.0)
    s = sun_stats(alt, az, prof, 0.25)
    assert s["sun_visible_pct"] == pytest.approx(75.0, abs=1.0)
    assert s["longest_dark_h"] == pytest.approx(6.0, abs=0.5)
