"""Two quantified approximations, written to docs/validation/ephemeris-checks.md:

1. DE421 -> DE440: max change in Sun/Earth alt and az per site over the whole grid.
2. Site vs Moon-centre disc radius: sky.json stores ONE hourly Sun/Earth angular radius
   computed from the Moon centre; how far is that from the radius seen at each site?

    py -3 compare_ephem.py
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import ephem
from compute import git_commit

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "docs" / "validation" / "ephemeris-checks.md"


def ang(a, b):
    return np.abs((a - b + 180.0) % 360.0 - 180.0)


def main() -> int:
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    _, ts = ephem.make_loader()
    t = ephem.time_grid(ts)
    new = ephem.load_moon_frame(None, "de440")
    old = ephem.load_moon_frame(None, "de421")
    sun_r, earth_r = ephem.centre_radii_deg(new[0], t)
    rows_ephem, rows_rad = [], []
    for s in sites:
        a = ephem.site_altaz(s, *new, t)
        b = ephem.site_altaz(s, *old, t)
        r = [s["id"]]
        for body in ("sun", "earth"):
            r += [np.abs(a[body][0] - b[body][0]).max() * 60, ang(a[body][1], b[body][1]).max() * 60]
        rows_ephem.append(r)
        d_sun = np.abs(ephem.angular_radius_deg(ephem.R_SUN_KM, a["sun"][2]) - sun_r).max()
        d_earth = np.abs(ephem.angular_radius_deg(ephem.R_EARTH_KM, a["earth"][2]) - earth_r).max()
        rows_rad.append([s["id"], d_sun * 3600, d_earth * 3600])
        print(f"{s['id']:22s} DE421->DE440 max |d alt| sun {r[1]:.4f}' earth {r[3]:.4f}'  "
              f"|d az| sun {r[2]:.4f}' earth {r[4]:.4f}'  radius site-centre sun "
              f"{d_sun * 3600:.3f}\" earth {d_earth * 3600:.3f}\"")

    lines = [
        "# Ephemeris checks (data-v2)", "",
        f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC by `backend/compare_ephem.py`, "
        f"commit {git_commit()}. Grid: hourly {ephem.START_UTC:%Y-%m-%d} to {ephem.END_UTC:%Y-%m-%d} "
        f"({len(t)} samples). All values are maxima over the whole grid.", "",
        "## 1. DE421 -> DE440 change (arcminutes)", "",
        "Old: DE421 + moon_pa_de421_1900-2050.bpc, frame MOON_ME_DE421. "
        "New: DE440s + moon_pa_de440_200625.bpc, frame MOON_ME_DE440_ME421 (= MOON_ME).", "",
        "| site | Sun alt | Sun az | Earth alt | Earth az |", "|---|---|---|---|---|",
    ]
    lines += [f"| {r[0]} | {r[1]:.4f} | {r[2]:.4f} | {r[3]:.4f} | {r[4]:.4f} |" for r in rows_ephem]
    lines += [
        "", "Azimuth near the pole is sensitive to tiny shifts of the site itself, so the az "
        "change can exceed the alt change.", "",
        "## 2. Disc radius: site vs Moon centre (arcseconds)", "",
        "sky.json `sun_radius_deg` / `earth_radius_deg` use the Moon-centre distance. "
        "Max difference from the radius seen at each site:", "",
        "| site | Sun | Earth |", "|---|---|---|",
    ]
    lines += [f"| {r[0]} | {r[1]:.3f} | {r[2]:.3f} |" for r in rows_rad]
    lines += ["", f"Range of the shipped arrays: Sun {sun_r.min():.4f}-{sun_r.max():.4f} deg, "
              f"Earth {earth_r.min():.4f}-{earth_r.max():.4f} deg.", ""]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
