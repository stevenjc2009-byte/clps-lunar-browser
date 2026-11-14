"""Spherical geometry for the horizon march (Moon as a sphere of radius 1737.4 km).

Conventions (checked against Skyfield in test_geometry.py):
- Moon body-fixed Cartesian frame: +X toward 0 N 0 E, +Y toward 0 N 90 E, +Z north pole
  (the MEAN EARTH/POLAR AXIS frame named in the LOLA labels).
- Local ENU basis at a surface point u: Up = u, East = normalise(Z x u),
  North = Up x East. This is how Skyfield's altaz() defines "north" for a
  latitude/longitude position: the direction toward the +Z (north) pole along
  the meridian. At a south-polar site that points AWAY from the south pole.
- Azimuth: degrees clockwise from local north toward east (0 N, 90 E, 180 S, 270 W).
- Polar stereographic (south), from the PDS catalogue file dsmap_polar.cat:
  X = rho*sin(lon), Y = rho*cos(lon), rho = 2R*tan((90-|lat|)/2); lon 0 points
  "up" (Earthward, toward smaller line numbers), lon 90 E points right.
  0-based column c = X/s + N/2 - 0.5, 0-based row r = -Y/s + N/2 - 0.5.
  (The catalogue's inverse formula multiplies X by SIGN(LAT) too, which contradicts
  its own forward formula and its text "Longitude 90 East extends to the right";
  we follow the forward formula and verify it on real terrain in test_dem_real.py.)
"""
import numpy as np

from .products import MOON_RADIUS_M

R = MOON_RADIUS_M


def unit_from_latlon(lat_deg, lon_deg):
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], -1)


def latlon_from_unit(p):
    p = np.asarray(p)
    lat = np.degrees(np.arcsin(np.clip(p[..., 2], -1.0, 1.0)))
    lon = np.degrees(np.arctan2(p[..., 1], p[..., 0]))
    return lat, lon


def enu_basis(lat_deg, lon_deg):
    """(east, north, up) unit vectors at a surface point (not defined exactly at a pole)."""
    up = unit_from_latlon(lat_deg, lon_deg)
    east = np.cross([0.0, 0.0, 1.0], up)
    east /= np.linalg.norm(east)
    north = np.cross(up, east)
    return east, north, up


def ray_directions(lat_deg, lon_deg, az_deg):
    """Unit tangent vectors at the site for each azimuth (clockwise from north)."""
    east, north, up = enu_basis(lat_deg, lon_deg)
    a = np.radians(np.asarray(az_deg, dtype=float))[:, None]
    return np.cos(a) * north + np.sin(a) * east, up


def great_circle_points(up, tangents, theta):
    """Unit vectors at central angles theta (radians, shape S) along each tangent (A,3).

    Returns array (A, S, 3): p = cos(theta)*up + sin(theta)*t, exact great circles.
    """
    c, s = np.cos(theta)[None, :, None], np.sin(theta)[None, :, None]
    return c * up[None, None, :] + s * tangents[:, None, :]


def offset_point(lat_deg, lon_deg, dx_m, dy_m):
    """Surface point reached by moving dx_m east and dy_m north (great-circle, exact)."""
    dist = np.hypot(dx_m, dy_m)
    if dist == 0:
        return lat_deg, lon_deg
    az = np.degrees(np.arctan2(dx_m, dy_m))
    t, up = ray_directions(lat_deg, lon_deg, [az])
    p = great_circle_points(up, t, np.array([dist / R]))[0, 0]
    return latlon_from_unit(p)


def stereo_xy_from_unit(p):
    """South polar stereographic X, Y (metres) of unit vectors p (..., 3).

    rho = 2R tan(alpha/2) with alpha the angle from the south pole;
    tan(alpha/2) = sqrt(px^2+py^2) / (1 - pz), and (sin lon, cos lon) = (py, px)/|.|,
    so X = 2R py / (1 - pz), Y = 2R px / (1 - pz). No singularity at the pole.
    """
    d = 1.0 - p[..., 2]
    return 2.0 * R * p[..., 1] / d, 2.0 * R * p[..., 0] / d


def stereo_xy_from_latlon(lat_deg, lon_deg):
    """Same projection written the way dsmap_polar.cat writes it (used for the tests)."""
    rho = 2.0 * R * np.tan(np.radians(90.0 - np.abs(lat_deg)) / 2.0)
    lon = np.radians(lon_deg)
    return rho * np.sin(lon), rho * np.cos(lon)


def latlon_from_stereo_xy(x, y):
    """Inverse south polar stereographic (catalogue forward formula)."""
    rho = np.hypot(x, y)
    lat = -90.0 + np.degrees(2.0 * np.arctan(0.5 * rho / R))
    lon = np.degrees(np.arctan2(x, y))
    return lat, lon


def elevation_angle_deg(r_obs, r_terrain, theta):
    """Exact elevation angle of a terrain point above the observer's local horizontal.

    Observer at radius r_obs on unit vector u; terrain point at radius r_terrain on a
    unit vector at central angle theta from u. Vector from observer to point has
    components (along u) r_t*cos(theta) - r_o and (perpendicular) r_t*sin(theta).
    No small-angle or d^2/2R approximation.
    """
    return np.degrees(np.arctan2(r_terrain * np.cos(theta) - r_obs, r_terrain * np.sin(theta)))


def curvature_dip_deg(h_obs_m, radius=R):
    """Dip of the geometric horizon of a bare sphere for an observer h above it."""
    return -np.degrees(np.arccos(radius / (radius + h_obs_m)))
