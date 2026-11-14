"""Print % Sun, % Earth and longest darkness for one window, straight from the ephemeris.

Used to cross-check the numbers the web page computes from sky.json.
Usage: python window_stats.py 2027-06-10 30
"""
import json
import sys
from datetime import date

import numpy as np
from skyfield.api import Loader

from compute import DATA_DIR, HERE, compute_site, load_moon_frame, longest_run


def main(start_iso: str, days: int) -> int:
    d = date.fromisoformat(start_iso)
    load = Loader(str(DATA_DIR), verbose=False)
    ts = load.timescale()
    eph, pc, frame = load_moon_frame(load)
    t = ts.utc(d.year, d.month, d.day, np.arange(0, days * 24))
    for site in json.loads((HERE / "sites.json").read_text(encoding="utf-8")):
        pos = compute_site(site, eph, pc, frame, t)
        sun, earth = pos["sun"][0], pos["earth"][0]
        dark = longest_run(sun <= 0)
        print(f"{site['id']:12s} sun {100 * np.mean(sun > 0):5.1f}%  "
              f"earth {100 * np.mean(earth > 0):5.1f}%  dark {dark} h ({dark / 24:.1f} d)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], int(sys.argv[2])))
