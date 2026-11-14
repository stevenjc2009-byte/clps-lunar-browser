"""Cross-check the vector method (vectors.bin) against Skyfield for a custom site.

Skyfield direct = compute.py's compute_site; vector method = the maths in
frontend/src/ephem.ts, here on the float32 data actually shipped. Exit 1 if off.
"""
import json
import sys

import numpy as np
from skyfield.api import Loader

from compute import DATA_DIR, DAYS, START, compute_site, load_moon_frame
from export_vectors import BIN_FILE, JSON_FILE

SITE = {"lat": -87.5, "lon": 45.0}
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
    load = Loader(str(DATA_DIR), verbose=False)
    ts = load.timescale()
    eph, pc, frame = load_moon_frame(load)
    t = ts.utc(START[0], START[1], START[2], np.arange(0, DAYS * 24))

    ref = compute_site(SITE, eph, pc, frame, t)
    got = vector_method(vecs, header["moon_radius_km"], SITE["lat"], SITE["lon"])
    ok = True
    for body in ("sun", "earth"):
        d_alt = np.abs(got[body][0] - ref[body][0]).max()
        d_az = np.abs((got[body][1] - ref[body][1] + 180) % 360 - 180).max()
        vis = int(((got[body][0] > 0) != (ref[body][0] > 0)).sum())
        print(f"{body:5s} max|dalt| {d_alt:.5f}  max|daz| {d_az:.5f}  visibility hours differing {vis}")
        ok &= d_alt <= MAX_ALT_ERR and vis <= 2
    print("OK" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
