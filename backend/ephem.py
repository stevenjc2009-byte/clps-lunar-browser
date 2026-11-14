"""Shared ephemeris layer: time grid, lunar ME frame, site alt/az, body distances.

Frame: MOON_ME. In moon_de440_250416.tf, MOON_ME (31001) is an identity-matrix alias of
MOON_ME_DE440_ME421 (31009), a fixed rotation from MOON_PA_DE440 (31008, binary PCK).
Skyfield's PlanetaryConstants resolves only ONE text-kernel hop to a PCK frame, so we
build MOON_ME_DE440_ME421 directly after asserting the alias really is the identity.
"""
from datetime import datetime, timedelta, timezone

import numpy as np
from skyfield.api import Loader, PlanetaryConstants
from skyfield.constants import AU_KM

from kernels import DATA_DIR, KERNEL_SETS, ensure

# Data range (sky.json v2 contract): hourly, both ends included.
START_UTC = datetime(2026, 9, 1, tzinfo=timezone.utc)
END_UTC = datetime(2029, 1, 1, tzinfo=timezone.utc)
STEP_HOURS = 1
# Supported landing dates shown in the UI (decision in docs/decisions/data-v2.md):
# from submission day; last = END - 365 d (longest look-ahead) - 30 d (pad that lets a
# night still running at the window end be followed for > one synodic month, 29.53 d).
LANDING_MIN_UTC = datetime(2026, 11, 15, tzinfo=timezone.utc)
LANDING_MAX_UTC = END_UTC - timedelta(days=365 + 30)

R_SUN_KM = 695_700.0     # IAU 2015 nominal solar radius (spec 4.4)
R_EARTH_KM = 6_371.0     # mean Earth radius (spec 4.4)

EPHEMERIS_TEXT = {
    "de440": "JPL DE440s + NAIF moon_pa_de440_200625.bpc PCK, frame MOON_ME "
             "(= MOON_ME_DE440_ME421, moon_de440_250416.tf), via Skyfield",
    "de421": "JPL DE421 + NAIF moon_pa_de421_1900-2050.bpc, frame MOON_ME_DE421, via Skyfield",
}


def n_samples() -> int:
    return int((END_UTC - START_UTC) / timedelta(hours=STEP_HOURS)) + 1


def hours_grid() -> np.ndarray:
    """Hours since START_UTC of every sample (0, 1, ..., n-1) * STEP_HOURS."""
    return np.arange(n_samples()) * STEP_HOURS


def time_grid(ts, hours=None):
    """Skyfield Time array for the hourly grid (UTC, leap seconds handled by Skyfield)."""
    h = hours_grid() if hours is None else hours
    return ts.utc(START_UTC.year, START_UTC.month, START_UTC.day, h)


def make_loader():
    load = Loader(str(DATA_DIR), verbose=False)
    return load, load.timescale()


def _path(set_name: str, name: str) -> str:
    rel = next(r for n, r, _ in KERNEL_SETS[set_name] if n == name)
    return str(ensure(name, rel))


def _read_text(pc, path: str) -> None:
    with open(path, "rb") as f:
        pc.read_text(f)


def _jd(dt: datetime) -> float:
    return 2440587.5 + dt.timestamp() / 86400.0


def _covering_segment(pc, body_id: int):
    """The binary PCK segment for body_id whose span covers START_UTC..END_UTC (+-2 d)."""
    lo, hi = _jd(START_UTC) - 2, _jd(END_UTC) + 2
    for seg in pc._segment_list:
        if seg.body == body_id and seg.initial_jd <= lo and seg.final_jd >= hi:
            return seg
    raise LookupError(f"no PCK segment for {body_id} covers {START_UTC}..{END_UTC}")


def load_moon_frame(load=None, set_name: str = "de440"):
    """(eph, pc, frame) for the chosen kernel set. `load` is accepted for old callers."""
    from skyfield.api import load_file

    files = {n: _path(set_name, n) for n, _, _ in KERNEL_SETS[set_name]}
    pc = PlanetaryConstants()
    if set_name == "de440":
        eph = load_file(files["de440s.bsp"])
        _read_text(pc, files["moon_de440_250416.tf"])
        _read_text(pc, files["pck00011.tpc"])
        pc.read_binary(open(  # kept open: read lazily
            files["moon_pa_de440_200625.bpc"], "rb"))
        v = pc.variables
        assert v["TKFRAME_31001_RELATIVE"] == "MOON_ME_DE440_ME421", "MOON_ME alias changed"
        assert np.allclose(v["TKFRAME_31001_MATRIX"], np.eye(3).ravel()), "MOON_ME not identity"
        # The bpc holds two MOON_PA_DE440 segments (1549-2426, 2426-2650) and Skyfield's
        # segment map keeps the LAST one, so pick the one covering our grid explicitly.
        frame = pc.build_frame(v["FRAME_MOON_ME_DE440_ME421"], _segment=_covering_segment(pc, 31008))
    elif set_name == "de421":
        eph = load_file(files["de421.bsp"])
        _read_text(pc, files["moon_080317.tf"])
        _read_text(pc, files["pck00008.tpc"])
        pc.read_binary(open(  # kept open: read lazily
            files["moon_pa_de421_1900-2050.bpc"], "rb"))
        frame = pc.build_frame_named("MOON_ME_DE421")
    else:
        raise ValueError(f"unknown kernel set {set_name!r}")
    return eph, pc, frame


def moon_radius_km(pc, frame) -> float:
    """The sphere radius Skyfield's build_latlon_degrees uses for this frame."""
    return float(pc._get_assignment(f"BODY{frame.center}_RADII")[0])


def site_altaz(site, eph, pc, frame, t) -> dict:
    """{body: (alt_deg, az_deg, distance_km)} of the apparent Sun/Earth centre at a site.

    Apparent = light-time + aberration + light deflection (Skyfield .apparent()), no
    atmosphere. Site on the 1737.4 km sphere at selenographic lat/lon in MOON_ME.
    """
    place = eph["moon"] + pc.build_latlon_degrees(frame, site["lat"], site["lon"])
    obs = place.at(t)
    out = {}
    for body in ("sun", "earth"):
        alt, az, dist = obs.observe(eph[body]).apparent().altaz()
        out[body] = (alt.degrees, az.degrees, dist.km)
    return out


def centre_vectors_km(eph, frame, t, body: str) -> np.ndarray:
    """Apparent vector Moon centre -> body in the body-fixed frame, shape (N, 3), km."""
    apparent = eph["moon"].at(t).observe(eph[body]).apparent()
    rot = frame.rotation_at(t)  # ICRF -> body-fixed, shape (3, 3, N)
    return np.einsum("ijn,jn->ni", rot, apparent.position.au * AU_KM)


def angular_radius_deg(body_radius_km: float, dist_km) -> np.ndarray:
    return np.degrees(np.arcsin(body_radius_km / np.asarray(dist_km)))


def centre_radii_deg(eph, t) -> tuple[np.ndarray, np.ndarray]:
    """(sun_radius_deg, earth_radius_deg) from the instantaneous Moon-centre distances."""
    moon = eph["moon"].at(t)
    d_sun = moon.observe(eph["sun"]).apparent().distance().km
    d_earth = moon.observe(eph["earth"]).apparent().distance().km
    return angular_radius_deg(R_SUN_KM, d_sun), angular_radius_deg(R_EARTH_KM, d_earth)
