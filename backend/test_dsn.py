"""DSN station coordinates and the Moon-elevation function."""
import numpy as np
import pytest

pytest.importorskip("skyfield")

from dsn import DSN_STATIONS, dms, station_positions  # noqa: E402

# 810-005 Module 301 Rev K, Table 2: Cartesian (ITRF) station coordinates, metres.
TABLE2_XYZ = {
    "DSS 14 Goldstone": (-2353621.420, -4641341.472, 3677052.318),
    "DSS 63 Madrid": (4849092.518, -360180.3480, 4115109.251),
    "DSS 43 Canberra": (-4460894.917, 2682361.507, -3674748.152),
}


def test_dms_sign():
    assert dms(-35, 24, 8.72724) == pytest.approx(-35.4024242, abs=1e-7)
    assert dms(40, 25, 52.35510) == pytest.approx(40.4312097, abs=1e-7)


def test_geodetic_table5_matches_cartesian_table2():
    """Table 5 (geodetic) through WGS 84 must land within 1 m of Table 2 (XYZ).

    Using Table 6's GEOCENTRIC latitude by mistake would miss by ~21 km."""
    for (name, *_), pos in zip(DSN_STATIONS, station_positions()):
        xyz = np.array(pos.itrs_xyz.m)
        assert np.linalg.norm(xyz - np.array(TABLE2_XYZ[name])) < 1.0, name


def test_moon_elevation_needs_kernels():
    from kernels import DATA_DIR
    if not (DATA_DIR / "de440s.bsp").exists():
        pytest.skip("DE440 kernels not downloaded (run py -3 kernels.py)")
    import ephem
    from dsn import moon_elevations_deg
    _, ts = ephem.make_loader()
    eph, _, _ = ephem.load_moon_frame()
    t = ts.utc(2027, 3, 1, np.arange(0, 48))
    el = moon_elevations_deg(eph, t)
    assert el.shape == (3, 48)
    # each station sees the Moon rise and set within two days
    for row in el:
        assert row.max() > 0 > row.min()
