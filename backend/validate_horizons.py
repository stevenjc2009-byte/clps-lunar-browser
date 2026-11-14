"""Cross-check compute.py against NASA JPL Horizons (independent ephemeris service).

For each site in sites.json, asks Horizons for the apparent azimuth/elevation of
the Sun (10) and Earth (399) seen from that lunar surface point (CENTER=coord@301)
at a few times, and compares with our Skyfield result at the same instants.

Usage: python validate_horizons.py   (needs internet)
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from skyfield.api import Loader

from compute import DATA_DIR, compute_site, load_moon_frame

HERE = Path(__file__).resolve().parent
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
START, STOP, STEP = "2027-01-01 00:00", "2027-12-31 00:00", "30 d"


def horizons_azel(body: str, lat: float, lon: float):
    params = {
        "format": "json",
        "COMMAND": f"'{body}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon % 360:.6f},{lat:.6f},0'",
        "START_TIME": f"'{START}'",
        "STOP_TIME": f"'{STOP}'",
        "STEP_SIZE": f"'{STEP}'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "APPARENT": "'AIRLESS'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        text = json.load(r)["result"]
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    times, az, el = [], [], []
    for row in rows:
        cols = [c.strip() for c in row.split(",")]
        times.append(cols[0])
        az.append(float(cols[3]))
        el.append(float(cols[4]))
    return times, np.array(az), np.array(el)


def ang_diff(a, b):
    return (a - b + 180.0) % 360.0 - 180.0


def main():
    load = Loader(str(DATA_DIR), verbose=False)
    ts = load.timescale()
    eph, pc, frame = load_moon_frame(load)
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    worst = 0.0
    for site in sites:
        for body, code in (("sun", "10"), ("earth", "399")):
            times, h_az, h_el = horizons_azel(code, site["lat"], site["lon"])
            # Horizons times look like "2027-Jan-01 00:00"; it reports UT (TDB for
            # coord-centre ephemerides is noted in the header; difference ~69 s).
            t = ts.utc([int(x[:4]) for x in times],
                       [["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
                         "Sep", "Oct", "Nov", "Dec"].index(x[5:8]) + 1 for x in times],
                       [int(x[9:11]) for x in times],
                       [int(x[12:14]) for x in times],
                       [int(x[15:17]) for x in times])
            s_el, s_az = compute_site(site, eph, pc, frame, t)[body]
            d_el = np.abs(s_el - h_el)
            d_az = np.abs(ang_diff(s_az, h_az))
            worst = max(worst, d_el.max())
            print(f"{site['id']:11s} {body:5s} n={len(t):2d}  "
                  f"max|d_el|={d_el.max():.4f} deg  max|d_az|={d_az.max():.4f} deg  "
                  f"(e.g. {times[0]}: ours {s_el[0]:+.3f}, Horizons {h_el[0]:+.3f})")
    print(f"worst elevation difference: {worst:.4f} deg")
    return 0 if worst < 0.05 else 1


if __name__ == "__main__":
    sys.exit(main())
