"""Export Sun and Earth apparent position vectors as seen from the Moon's centre.

Writes ../frontend/public/vectors.bin (+ vectors.json header). The vectors are in
the MOON_ME body-fixed frame (DE440, see ephem.py), in km, so the browser can derive the sky of
ANY lunar latitude/longitude without Skyfield (see frontend/src/ephem.ts).

Same hourly times as compute.py / sky.json (ephem.time_grid).
"""
import json
import sys
from pathlib import Path

import numpy as np
import ephem

PUBLIC = Path(__file__).resolve().parent.parent / "frontend" / "public"
BIN_FILE = PUBLIC / "vectors.bin"
JSON_FILE = PUBLIC / "vectors.json"
LAYOUT = "sunX,sunY,sunZ,earthX,earthY,earthZ"


def main():
    _, ts = ephem.make_loader()
    eph, pc, frame = ephem.load_moon_frame()
    t = ephem.time_grid(ts)

    data = np.hstack([ephem.centre_vectors_km(eph, frame, t, b) for b in ("sun", "earth")])
    data = np.ascontiguousarray(data, dtype="<f4")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    BIN_FILE.write_bytes(data.tobytes())
    header = {
        "start_utc": ephem.START_UTC.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "step_hours": ephem.STEP_HOURS,
        "count": len(t),
        "layout": LAYOUT,
        "dtype": "float32 little-endian",
        "units": "km",
        "frame": "MOON_ME = MOON_ME_DE440_ME421 (body-fixed, origin Moon centre)",
        "moon_radius_km": ephem.moon_radius_km(pc, frame),
        "vector": "apparent (light-time, deflection, aberration) from Moon centre",
        "source": ephem.EPHEMERIS_TEXT["de440"],
    }
    JSON_FILE.write_text(json.dumps(header, indent=1), encoding="utf-8")
    print(f"wrote {BIN_FILE} ({BIN_FILE.stat().st_size} bytes), {JSON_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
