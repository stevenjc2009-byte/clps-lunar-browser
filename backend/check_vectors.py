"""Cross-check the vector method (vectors.bin) against Skyfield for a custom site.

Skyfield direct = ephem.site_altaz; vector method = the maths in
frontend/src/ephem.ts, here on the float32 data actually shipped. Exit 1 if off.
"""
import json
import sys

import numpy as np

import ephem
from export_vectors import BIN_FILE, JSON_FILE

SITES = [{"lat": -87.5, "lon": 45.0}, {"lat": -89.7849, "lon": -156.03}, {"lat": -80.13, "lon": 1.44}]
MAX_ALT_ERR = 0.02  # deg


def vector_method(vecs, radius, lat_deg, lon_deg):
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    out = {}
    for body, col in (("sun", 0), ("earth", 3)):
        v = vecs[:, col:col + 3].astype(np.float64) - radius * up
        alt = np.degrees(np.arcsin(v @ up / np.linalg.norm(v, axis=1)))
        az = np.degrees(np.arctan2(v @ east, v @ north)) % 360
        out[body] = (alt, az)
    return out


def main():
    header = json.loads(JSON_FILE.read_text(encoding="utf-8"))
    vecs = np.fromfile(BIN_FILE, dtype="<f4").reshape(-1, 6)
    _, ts = ephem.make_loader()
    eph, pc, frame = ephem.load_moon_frame()
    assert header["count"] == len(vecs) == ephem.n_samples(), "vectors.bin length != grid"
    assert header["start_utc"] == ephem.START_UTC.strftime("%Y-%m-%dT%H:%M:%SZ"), "start moved"
    t = ephem.time_grid(ts)
    ok = True
    for site in SITES:
        ref = ephem.site_altaz(site, eph, pc, frame, t)
        got = vector_method(vecs, header["moon_radius_km"], site["lat"], site["lon"])
        for body in ("sun", "earth"):
            d_alt = np.abs(got[body][0] - ref[body][0]).max()
            d_az = np.abs((got[body][1] - ref[body][1] + 180) % 360 - 180).max()
            vis = int(((got[body][0] > 0) != (ref[body][0] > 0)).sum())
            print(f"({site['lat']:+.4f},{site['lon']:+.4f}) {body:5s} max|dalt| {d_alt:.5f} deg  "
                  f"max|daz| {d_az:.5f} deg  visibility hours differing {vis}")
            ok &= d_alt <= MAX_ALT_ERR and vis <= 2
    print("OK" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
