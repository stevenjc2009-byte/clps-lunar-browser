"""Compute Sun and Earth positions above a flat local horizon for lunar sites.

Reads sites.json, writes ../frontend/public/sky.json.

Method: JPL DE421 ephemeris + NAIF lunar orientation kernels (MOON_ME_DE421
body-fixed frame) via Skyfield. For each site and each hourly time step we get
the apparent altitude/azimuth of the Sun and Earth centres. "Visible" means the
body's centre is above 0 deg on a flat horizon (no terrain, no atmosphere).
"""
import json
import sys
from pathlib import Path

import numpy as np
from skyfield.api import Loader, PlanetaryConstants

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
OUT_FILE = HERE.parent / "frontend" / "public" / "sky.json"

START = (2027, 1, 1)   # UTC
DAYS = 365
STEP_HOURS = 1


def load_moon_frame(load):
    eph = load("de421.bsp")
    pc = PlanetaryConstants()
    pc.read_text(load("moon_080317.tf"))
    pc.read_text(load("pck00008.tpc"))
    pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
    frame = pc.build_frame_named("MOON_ME_DE421")
    return eph, pc, frame


def compute_site(site, eph, pc, frame, t):
    place = eph["moon"] + pc.build_latlon_degrees(frame, site["lat"], site["lon"])
    obs = place.at(t)
    out = {}
    for body in ("sun", "earth"):
        alt, az, _ = obs.observe(eph[body]).apparent().altaz()
        out[body] = (alt.degrees, az.degrees)
    return out


def percent(mask):
    return round(100.0 * float(np.mean(mask)), 1)


def main():
    DATA_DIR.mkdir(exist_ok=True)
    load = Loader(str(DATA_DIR), verbose=False)
    ts = load.timescale()
    eph, pc, frame = load_moon_frame(load)

    hours = np.arange(0, DAYS * 24, STEP_HOURS)
    t = ts.utc(START[0], START[1], START[2], hours)

    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    result = {
        "meta": {
            "start_utc": t[0].utc_iso(),
            "end_utc": t[-1].utc_iso(),
            "step_hours": STEP_HOURS,
            "samples": len(hours),
            "ephemeris": "JPL DE421 + NAIF moon_pa_de421_1900-2050.bpc, frame MOON_ME_DE421",
            "horizon": "flat, 0 deg elevation mask, body centre",
        },
        "sites": [],
    }
    for site in sites:
        pos = compute_site(site, eph, pc, frame, t)
        sun_alt, sun_az = pos["sun"]
        earth_alt, earth_az = pos["earth"]
        stats = {
            "sun_visible_pct": percent(sun_alt > 0),
            "earth_visible_pct": percent(earth_alt > 0),
            "sun_alt_max": round(float(sun_alt.max()), 2),
            "sun_alt_min": round(float(sun_alt.min()), 2),
            "earth_alt_max": round(float(earth_alt.max()), 2),
            "earth_alt_min": round(float(earth_alt.min()), 2),
        }
        result["sites"].append({
            **site,
            "stats": stats,
            "sun_alt": np.round(sun_alt, 2).tolist(),
            "sun_az": np.round(sun_az, 1).tolist(),
            "earth_alt": np.round(earth_alt, 2).tolist(),
            "earth_az": np.round(earth_az, 1).tolist(),
        })
        print(f"{site['id']:12s} sun {stats['sun_visible_pct']:5.1f}%  "
              f"earth {stats['earth_visible_pct']:5.1f}%  "
              f"sun alt [{stats['sun_alt_min']}, {stats['sun_alt_max']}]  "
              f"earth alt [{stats['earth_alt_min']}, {stats['earth_alt_max']}]")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_FILE} ({OUT_FILE.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
