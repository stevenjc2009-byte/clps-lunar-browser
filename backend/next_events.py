"""Cross-check for the page's "after landing" lines, straight from the ephemeris.

For each site: is the Sun / Earth up at the landing time, and when does it next
rise or set? The hour is found from an hourly scan, then the minute by bisection.

    .venv/Scripts/python.exe next_events.py 2026-11-15
"""
import json
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
from skyfield.api import Loader

from compute import DATA_DIR, DAYS, HERE, START, load_moon_frame


def main() -> None:
    day = sys.argv[1] if len(sys.argv) > 1 else "2026-11-15"
    start = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    data_end = datetime(*START, tzinfo=timezone.utc) + timedelta(days=DAYS)
    load = Loader(str(DATA_DIR), verbose=False)
    ts = load.timescale()
    eph, pc, frame = load_moon_frame(load)
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    hours = int((data_end - start).total_seconds() // 3600)
    t = ts.from_datetime(start + timedelta(hours=0)) + np.arange(hours) / 24.0

    for site in sites:
        place = eph["moon"] + pc.build_latlon_degrees(frame, site["lat"], site["lon"])
        for body, name in (("sun", "Sun"), ("earth", "Earth")):
            def alt_at(dt: datetime) -> float:
                a, _, _ = place.at(ts.from_datetime(dt)).observe(eph[body]).apparent().altaz()
                return a.degrees

            alts = place.at(t).observe(eph[body]).apparent().altaz()[0].degrees
            up = alts[0] > 0
            flips = np.nonzero((alts[1:] > 0) != up)[0]
            if not len(flips):
                print(f"{site['id']:<12} {name:<5} {'up' if up else 'down'} at landing, never {'sets' if up else 'rises'} in the data")
                continue
            lo = start + timedelta(hours=int(flips[0]))
            hi = lo + timedelta(hours=1)
            while hi - lo > timedelta(seconds=30):
                mid = lo + (hi - lo) / 2
                if (alt_at(mid) > 0) == up:
                    lo = mid
                else:
                    hi = mid
            print(f"{site['id']:<12} {name:<5} {'up' if up else 'down'} at landing, "
                  f"{'sets' if up else 'rises'} {hi.strftime('%d %b %Y %H:%M UTC')}")


if __name__ == "__main__":
    main()
