"""10-minute truth vs interpolated hourly data (spec 4.3; engine interpolation choice).

1. Writes frontend/src/lib/__fixtures__/tenmin-<site>.json: Sun/Earth alt/az computed
   DIRECTLY (Skyfield, DE440) every 10 min for 60 days from the landing minimum, 3 dp.
   The engine agent tests its cubic interpolation of hourly sky.json data against them.
2. Measures, for the same sites/days, the error of Catmull-Rom interpolation of the
   hourly altitude (full precision, and rounded to 2 / 3 decimals as shipped) against
   the 10-min truth, and the resulting timing error of 0 deg crossings, and writes
   docs/validation/interpolation.md.

    py -3 tenmin.py
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import ephem
from compute import git_commit, round_keep_sign

HERE = Path(__file__).resolve().parent
FIX_DIR = HERE.parent / "frontend" / "src" / "lib" / "__fixtures__"
REPORT = HERE.parent / "docs" / "validation" / "interpolation.md"
FIXTURE_SITES = ("peak-near-shackleton", "im2")
DAYS = 60
STEP_MIN = 10
FINE_MIN = 1  # resolution at which interpolated curves are searched for crossings
# Window start: chosen so the polar fixture site has Sun set/rise events inside the 60
# days (from the landing minimum, 15 Nov 2026, the Sun never sets there for 60 days).
FIX_START = datetime(2027, 1, 1, tzinfo=timezone.utc)


def catmull_rom(y: np.ndarray, x: np.ndarray) -> np.ndarray:
    """Uniform Catmull-Rom spline through y[0..n-1] (sample i at x = i), evaluated at x.

    End intervals use a mirrored ghost point (clamped tangents)."""
    n = len(y)
    i = np.clip(np.floor(x).astype(int), 0, n - 2)
    u = x - i
    p0 = y[np.maximum(i - 1, 0)]
    p1, p2 = y[i], y[i + 1]
    p3 = y[np.minimum(i + 2, n - 1)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u ** 2
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


def crossings(y: np.ndarray, step_min: float) -> np.ndarray:
    """Times (minutes from y[0]) where y changes sign through 0, linearly refined."""
    i = np.nonzero((y[:-1] > 0) != (y[1:] > 0))[0]
    frac = y[i] / (y[i] - y[i + 1])
    return (i + frac) * step_min


def match_errors(truth: np.ndarray, got: np.ndarray) -> tuple[float, int]:
    """Max |dt| (min) from each truth crossing to the nearest found one; count mismatch."""
    if len(truth) == 0:
        return 0.0, len(got)
    if len(got) == 0:
        return float("inf"), len(truth)
    d = np.abs(truth[:, None] - got[None, :]).min(axis=1)
    return float(d.max()), abs(len(truth) - len(got))


def compute_truth(site, eph, pc, frame, ts, start: datetime):
    n = DAYS * 24 * 60 // STEP_MIN + 1
    minutes = np.arange(n) * STEP_MIN
    t = ts.utc(start.year, start.month, start.day, 0, minutes)
    return minutes, ephem.site_altaz(site, eph, pc, frame, t)


def write_fixture(site, start, minutes, pos) -> Path:
    out = {
        "site": site["id"], "lat": site["lat"], "lon": site["lon"],
        "start_utc": start.strftime("%Y-%m-%dT%H:%M:%SZ"), "step_minutes": STEP_MIN,
        "samples": len(minutes),
        "hourly_index_of_start": int((start - ephem.START_UTC) / timedelta(hours=1)),
        "source": ephem.EPHEMERIS_TEXT["de440"] + "; computed directly, not interpolated",
        "decimals": 3,
    }
    for body in ("sun", "earth"):
        out[f"{body}_alt"] = np.round(pos[body][0], 3).tolist()
        out[f"{body}_az"] = np.round(pos[body][1], 3).tolist()
    FIX_DIR.mkdir(parents=True, exist_ok=True)
    path = FIX_DIR / f"tenmin-{site['id']}.json"
    path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    return path


def evaluate(alt_truth: np.ndarray, label: str, prep) -> dict:
    """Interpolate prep(hourly) back to 10-min and to 1-min; compare with truth."""
    per_h = 60 // STEP_MIN
    hourly = prep(alt_truth[::per_h])
    x10 = np.arange(len(alt_truth)) / per_h
    inner = (x10 >= 1) & (x10 <= len(hourly) - 2)  # skip the 2 end hours (no neighbour)
    err = np.abs(catmull_rom(hourly, x10) - alt_truth)[inner]
    x1 = np.arange(0, (len(hourly) - 1) * 60 + 1, FINE_MIN) / 60.0
    fine = catmull_rom(hourly, x1)
    t_truth = crossings(alt_truth, STEP_MIN)
    dt, mism = match_errors(t_truth, crossings(fine, FINE_MIN))
    lin_dt, lin_mism = match_errors(t_truth, crossings(hourly, 60))
    return {"label": label, "max_alt_err_deg": float(err.max()), "n_cross": len(t_truth),
            "cubic_dt_min": dt, "cubic_mismatch": mism, "linear_dt_min": lin_dt,
            "linear_mismatch": lin_mism}


def main() -> int:
    sites = {s["id"]: s for s in json.loads((HERE / "sites.json").read_text(encoding="utf-8"))}
    _, ts = ephem.make_loader()
    eph, pc, frame = ephem.load_moon_frame()
    start = FIX_START
    preps = [("full precision", lambda a: a),
             ("rounded 3 dp", lambda a: round_keep_sign(a.copy(), 3)),
             ("rounded 2 dp", lambda a: round_keep_sign(a.copy(), 2))]
    rows = []
    for sid in FIXTURE_SITES:
        site = sites[sid]
        minutes, pos = compute_truth(site, eph, pc, frame, ts, start)
        path = write_fixture(site, start, minutes, pos)
        print(f"wrote {path} ({path.stat().st_size // 1024} KB)")
        for body in ("sun", "earth"):
            for label, prep in preps:
                r = evaluate(pos[body][0], label, prep)
                rows.append({"site": sid, "body": body, **r})
                print(f"{sid:22s} {body:5s} {label:15s} max|alt err| {r['max_alt_err_deg'] * 60:.2e}'  "
                      f"crossings {r['n_cross']:3d}  cubic max dt {r['cubic_dt_min']:.2f} min "
                      f"(mismatch {r['cubic_mismatch']})  linear max dt {r['linear_dt_min']:.2f} min")
    lines = [
        "# Hourly interpolation vs 10-minute truth", "",
        f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC by `backend/tenmin.py`, commit "
        f"{git_commit()}. Window: {DAYS} days from {start:%Y-%m-%d}, truth computed directly every "
        f"{STEP_MIN} min with DE440 (fixtures in `frontend/src/lib/__fixtures__/`).", "",
        "Method: take every 6th truth sample (= the hourly grid), optionally round it like "
        "sky.json, interpolate with a uniform Catmull-Rom spline, compare with the truth (alt error over "
        "all 10-min points except the first and last hour, which lack a neighbour sample). "
        f"Crossing times: 0 deg sign changes, linearly refined, interpolated curve searched at "
        f"{FINE_MIN} min; 'linear' = straight line between the hourly samples.", "",
        "| site | body | hourly data | max alt error (arcmin) | 0 deg crossings | cubic max timing error (min) | linear max timing error (min) |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        mm = f" ({r['cubic_mismatch']} unmatched)" if r["cubic_mismatch"] else ""
        lines.append(f"| {r['site']} | {r['body']} | {r['label']} | {r['max_alt_err_deg'] * 60:.2e} | "
                     f"{r['n_cross']} | {r['cubic_dt_min']:.2f}{mm} | {r['linear_dt_min']:.2f} |")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
