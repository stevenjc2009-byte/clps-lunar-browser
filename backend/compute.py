"""Compute Sun and Earth positions above a flat local horizon for lunar sites.

Reads sites.json, writes ../frontend/public/sky.json (contract v2, see
docs/decisions/data-v2.md) and backend/data/MANIFEST.json.

    py -3 compute.py          # one command: kernels -> manifest -> sky.json

Method: JPL DE440 ephemeris + NAIF lunar orientation kernels (MOON_ME frame) via
Skyfield (ephem.py). For each site and each hourly step: apparent alt/az of the Sun and
Earth centres on a flat horizon (no terrain, no atmosphere). Site-independent hourly
arrays: Sun/Earth angular radius from the Moon centre, and the Moon's elevation from
the best-placed Deep Space Network complex (dsn.py).
"""
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
DATA_DIR = HERE / "data"
OUT_FILE = HERE.parent / "frontend" / "public" / "sky.json"

# Old names kept for next_events.py / window_stats.py: grid start and whole days.
START = (2026, 9, 1)     # = ephem.START_UTC
DAYS = 853               # 2026-09-01 -> 2029-01-01 (the grid also holds the end instant)
STEP_HOURS = 1

# status when a sites.json entry has none (documented in docs/decisions/data-v2.md)
DEFAULT_STATUS = {"shackleton": "candidate", "peak-near-shackleton": "candidate",
                  "im1": "landing", "im2": "landing"}
STATUSES = ("candidate", "target", "landing")
AZ_DECIMALS = 1          # size decision: 7 sites x 4 arrays; see decisions file
ALT_DECIMALS = 3         # 2 dp gave up to 35 min Sun rise/set error at the pole (tenmin.py)


def load_moon_frame(load=None, set_name="de440"):
    from ephem import load_moon_frame as _lmf
    return _lmf(load, set_name)


def compute_site(site, eph, pc, frame, t):
    """{body: (alt_deg, az_deg)} -- the old interface, used by the check scripts."""
    from ephem import site_altaz
    return {b: v[:2] for b, v in site_altaz(site, eph, pc, frame, t).items()}


def percent(mask):
    return round(100.0 * float(np.mean(mask)), 1)


def round_keep_sign(a, nd):
    """Round to nd decimals, but never turn a positive value into 0.

    The page counts "above horizon" as alt > 0, so 0.004 must not become 0.00.
    """
    r = np.round(a, nd)
    r[(a > 0) & (r <= 0)] = 10.0 ** -nd
    return r


def longest_run(mask):
    """Length of the longest run of consecutive True samples."""
    best = run = 0
    for v in mask:
        run = run + 1 if v else 0
        best = max(best, run)
    return best


def site_record(site: dict) -> dict:
    """The descriptive fields of one sky.json site, with status/uncertainty defaults."""
    status = site.get("status") or DEFAULT_STATUS.get(site["id"], "candidate")
    if status not in STATUSES:
        raise ValueError(f"site {site['id']}: status {status!r} not in {STATUSES}")
    unc = site.get("uncertainty_m")
    return {
        "id": site["id"], "name": site["name"],
        "lat": float(site["lat"]), "lon": float(site["lon"]),
        "status": status, "source": site.get("source", ""), "note": site.get("note", ""),
        "uncertainty_m": None if unc is None else float(unc),
    }


def site_stats(sun_alt, earth_alt) -> dict:
    return {
        "sun_visible_pct": percent(sun_alt > 0),
        "earth_visible_pct": percent(earth_alt > 0),
        "longest_dark_hours": longest_run(sun_alt <= 0) * STEP_HOURS,
        "sun_alt_max": round(float(sun_alt.max()), 2),
        "sun_alt_min": round(float(sun_alt.min()), 2),
        "earth_alt_max": round(float(earth_alt.max()), 2),
        "earth_alt_min": round(float(earth_alt.min()), 2),
    }


def git_commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=HERE,
                              capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def build(sites: list[dict], set_name: str = "de440") -> dict:
    import ephem
    from dsn import dsn_moon_el_max
    from kernels import kernel_entries, write_manifest

    load, ts = ephem.make_loader()
    eph, pc, frame = ephem.load_moon_frame(None, set_name)
    t = ephem.time_grid(ts)
    assert len(t) == ephem.n_samples()
    kernels = write_manifest(set_name)["kernels"] if set_name == "de440" else kernel_entries(set_name)
    sun_r, earth_r = ephem.centre_radii_deg(eph, t)
    result = {
        "meta": {
            "version": 2,
            "start_utc": iso(ephem.START_UTC),
            "end_utc": iso(ephem.END_UTC),
            "step_hours": ephem.STEP_HOURS,
            "samples": len(t),
            "ephemeris": ephem.EPHEMERIS_TEXT[set_name],
            "kernels": [{k: e[k] for k in ("name", "url", "sha256", "bytes")} for e in kernels],
            "generated_utc": iso(datetime.now(timezone.utc)),
            "script_commit": git_commit(),
            "horizon": "flat 0 deg (terrain in horizons.json)",
            "landing_min_utc": iso(ephem.LANDING_MIN_UTC),
            "landing_max_utc": iso(ephem.LANDING_MAX_UTC),
            "az_decimals": AZ_DECIMALS,
            "alt_decimals": ALT_DECIMALS,
        },
        "sun_radius_deg": np.round(sun_r, 4).tolist(),
        "earth_radius_deg": np.round(earth_r, 4).tolist(),
        "dsn_moon_el_max": np.round(dsn_moon_el_max(eph, t), 1).tolist(),
        "sites": [],
    }
    for site in sites:
        pos = ephem.site_altaz(site, eph, pc, frame, t)
        (sun_alt, sun_az, _), (earth_alt, earth_az, _) = pos["sun"], pos["earth"]
        stats = site_stats(sun_alt, earth_alt)
        result["sites"].append({
            **site_record(site),
            "stats": stats,
            "sun_alt": round_keep_sign(sun_alt, ALT_DECIMALS).tolist(),
            "sun_az": np.round(sun_az, AZ_DECIMALS).tolist(),
            "earth_alt": round_keep_sign(earth_alt, ALT_DECIMALS).tolist(),
            "earth_az": np.round(earth_az, AZ_DECIMALS).tolist(),
        })
        print(f"{site['id']:22s} sun {stats['sun_visible_pct']:5.1f}%  "
              f"earth {stats['earth_visible_pct']:5.1f}%  "
              f"dark {stats['longest_dark_hours'] / 24:5.1f} d  "
              f"sun alt [{stats['sun_alt_min']}, {stats['sun_alt_max']}]  "
              f"earth alt [{stats['earth_alt_min']}, {stats['earth_alt_max']}]")
    return result


def main():
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    result = build(sites)
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_FILE} ({OUT_FILE.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
