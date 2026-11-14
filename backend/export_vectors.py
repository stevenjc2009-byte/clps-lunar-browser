"""Export Sun and Earth apparent position vectors as seen from the Moon's centre.

Writes ../frontend/public/vectors.bin (+ vectors.json header). The vectors are in
the MOON_ME_DE421 body-fixed frame, in km, so the browser can derive the sky of
ANY lunar latitude/longitude without Skyfield (see frontend/src/ephem.ts).

Same hourly times as compute.py (START, DAYS, STEP_HOURS).
"""
import json
import sys
from pathlib import Path

import numpy as np
from skyfield.api import Loader
from skyfield.constants import AU_KM

from compute import DATA_DIR, DAYS, START, STEP_HOURS, load_moon_frame

PUBLIC = Path(__file__).resolve().parent.parent / "frontend" / "public"
BIN_FILE = PUBLIC / "vectors.bin"
JSON_FILE = PUBLIC / "vectors.json"
LAYOUT = "sunX,sunY,sunZ,earthX,earthY,earthZ"


def moon_radius_km(pc, frame):
    """The sphere radius Skyfield's build_latlon_degrees uses for this frame."""
    return float(pc._get_assignment("BODY{0}_RADII".format(frame.center))[0])


def body_vectors_km(eph, frame, t, body):
    """Apparent vector Moon centre -> body, in the body-fixed frame, shape (N, 3)."""
    apparent = eph["moon"].at(t).observe(eph[body]).apparent()
    rot = frame.rotation_at(t)  # ICRF -> MOON_ME_DE421, shape (3, 3, N)
    return np.einsum("ijn,jn->ni", rot, apparent.position.au * AU_KM)


def main():
    load = Loader(str(DATA_DIR), verbose=False)
    ts = load.timescale()
    eph, pc, frame = load_moon_frame(load)

    hours = np.arange(0, DAYS * 24, STEP_HOURS)
    t = ts.utc(START[0], START[1], START[2], hours)

    data = np.hstack([body_vectors_km(eph, frame, t, b) for b in ("sun", "earth")])
    data = np.ascontiguousarray(data, dtype="<f4")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    BIN_FILE.write_bytes(data.tobytes())
    header = {
        "start_utc": t[0].utc_iso(),
        "step_hours": STEP_HOURS,
        "count": len(hours),
        "layout": LAYOUT,
        "dtype": "float32 little-endian",
        "units": "km",
        "frame": "MOON_ME_DE421 (body-fixed, origin Moon centre)",
        "moon_radius_km": moon_radius_km(pc, frame),
        "vector": "apparent (light-time, deflection, aberration) from Moon centre",
        "source": "JPL DE421 + NAIF moon_080317.tf, pck00008.tpc, moon_pa_de421_1900-2050.bpc",
    }
    JSON_FILE.write_text(json.dumps(header, indent=1), encoding="utf-8")
    print(f"wrote {BIN_FILE} ({BIN_FILE.stat().st_size} bytes), {JSON_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
