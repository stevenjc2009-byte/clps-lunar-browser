"""Moon elevation as seen from the three NASA Deep Space Network complexes.

Station coordinates: JPL DSN Telecommunications Link Design Handbook 810-005,
Module 301 Rev K (2016-09-13), Table 5 "Geodetic Coordinates for DSN Stations With
Respect to the WGS 84 Ellipsoid", 70 m antennas (one per complex):
https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf
Values are geodetic latitude, east longitude (0-360) and ellipsoidal height h.

NOTE: the same module's Table 6 lists GEOCENTRIC latitudes (e.g. DSS 14 35.2443523);
those must not be fed to a geodetic (WGS 84) model -- that would move a station by
~0.19 deg of latitude (~21 km). test_dsn.py checks Table 5 against the Table 2
Cartesian coordinates of the same document.
"""
import numpy as np
from skyfield.api import wgs84


def dms(d: float, m: float, s: float) -> float:
    sign = -1.0 if d < 0 else 1.0
    return sign * (abs(d) + m / 60.0 + s / 3600.0)


# name, geodetic lat (deg), east lon (deg, -180..180), ellipsoidal height (m)
DSN_STATIONS = [
    ("DSS 14 Goldstone", dms(35, 25, 33.24312), dms(243, 6, 37.66244) - 360.0, 1001.390),
    ("DSS 63 Madrid", dms(40, 25, 52.35510), dms(355, 45, 7.16924) - 360.0, 864.816),
    ("DSS 43 Canberra", dms(-35, 24, 8.72724), dms(148, 58, 52.56231), 688.867),
]
DSN_SOURCE = ("JPL 810-005 Module 301 Rev K, Table 5 (WGS 84 geodetic), 70 m antennas "
              "DSS 14/63/43: https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf")


def station_positions():
    return [wgs84.latlon(lat, lon, elevation_m=h) for _, lat, lon, h in DSN_STATIONS]


def moon_elevations_deg(eph, t) -> np.ndarray:
    """Apparent (no refraction) Moon-centre elevation from each station, shape (3, N)."""
    earth, moon = eph["earth"], eph["moon"]
    rows = []
    for pos in station_positions():
        alt, _, _ = (earth + pos).at(t).observe(moon).apparent().altaz()
        rows.append(alt.degrees)
    return np.vstack(rows)


def dsn_moon_el_max(eph, t) -> np.ndarray:
    """Max over Goldstone/Madrid/Canberra of the Moon-centre elevation, degrees."""
    return moon_elevations_deg(eph, t).max(axis=0)
