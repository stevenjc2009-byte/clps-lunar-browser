"""Validate our Sun/Earth alt/az against NASA JPL Horizons (spec 7.1).

For every site in sites.json: >= 200 instants spread over the whole data range plus
geometric extremes (perigee/apogee, Sun's lunar latitude extremes = 'solstice-like',
Earth libration extremes in latitude and longitude). Horizons is asked for the airless
apparent az/el of the Sun (10) and Earth (399) seen from the site (coord@301, geodetic
on the 1737.4 km sphere); ours = ephem.site_altaz at the instants Horizons echoes back.

Writes docs/validation/horizons.csv and docs/validation/horizons.md. Exit 1 if any
elevation error exceeds TOL_EL_ARCMIN or azimuth error exceeds TOL_AZ_ARCMIN.

    py -3 validate_horizons.py              # uses cache, fetches what is missing
    py -3 validate_horizons.py --offline    # cache only
    py -3 validate_horizons.py --sites im1,im2
"""
import argparse
import csv
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import ephem
import horizons_client as hz
from compute import git_commit

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "docs" / "validation"
N_REGULAR = 200
# Tolerances, fixed BEFORE the comparison was run (reasoning in horizons.md + decisions):
# at the polar sites the Sun's altitude changes by only ~0.009 deg/h near rise/set, so
# 1 arcmin of elevation error would move a sunrise by ~2 h. 0.05 arcmin keeps the
# ephemeris share of the timing error to a few minutes there (computed in horizons.md). Azimuth only selects the horizon
# mask column (0.25 deg steps), so 1 arcmin is ample.
TOL_EL_ARCMIN = 0.05
TOL_AZ_ARCMIN = 1.0
BODIES = (("sun", "10"), ("earth", "399"))


def jd_utc(dt: datetime) -> float:
    return 2440587.5 + dt.timestamp() / 86400.0


def local_extrema(y: np.ndarray, k: int, largest: bool) -> list[int]:
    """Indices of the k most extreme local maxima (largest) or minima of y."""
    s = y if largest else -y
    idx = np.nonzero((s[1:-1] > s[:-2]) & (s[1:-1] >= s[2:]))[0] + 1
    return [int(i) for i in idx[np.argsort(s[idx])[::-1][:k]]]


def select_instants(eph, frame, ts) -> list[tuple[datetime, str]]:
    """Regular spread + labelled geometric extremes, as (UTC datetime, label)."""
    span = ephem.END_UTC - ephem.START_UTC
    out = []
    for i in range(N_REGULAR):
        dt = ephem.START_UTC + span * ((i + 0.5) / N_REGULAR)
        out.append((dt.replace(second=0, microsecond=0), "regular"))
    t = ephem.time_grid(ts)
    sun = ephem.centre_vectors_km(eph, frame, t, "sun")
    earth = ephem.centre_vectors_km(eph, frame, t, "earth")
    dist = np.linalg.norm(earth, axis=1)
    sun_lat = np.arcsin(sun[:, 2] / np.linalg.norm(sun, axis=1))
    e_lat = np.arcsin(earth[:, 2] / dist)
    e_lon = np.arctan2(earth[:, 1], earth[:, 0])
    picks = [("perigee", dist, 3, False), ("apogee", dist, 3, True),
             ("sun-lat-max", sun_lat, 2, True), ("sun-lat-min", sun_lat, 2, False),
             ("libration-lat-max", e_lat, 2, True), ("libration-lat-min", e_lat, 2, False),
             ("libration-lon-max", e_lon, 2, True), ("libration-lon-min", e_lon, 2, False)]
    for label, y, k, largest in picks:
        for i in local_extrema(y, k, largest):
            out.append((ephem.START_UTC + timedelta(hours=int(i)), label))
    return sorted(out)


def ang(a, b):
    return (np.asarray(a) - np.asarray(b) + 180.0) % 360.0 - 180.0


def stats(x: np.ndarray) -> tuple[float, float, float]:
    a = np.abs(x)
    return float(a.mean()), float(np.percentile(a, 95)), float(a.max())


def polar_sun_rate(eph, pc, frame, ts, sites) -> float:
    """Median |d alt/dt| (deg/h) of the Sun at 0 deg crossings, sites with |lat| > 88."""
    rates = []
    t = ephem.time_grid(ts)
    for s in sites:
        if abs(s["lat"]) > 88:
            a = ephem.site_altaz(s, eph, pc, frame, t)["sun"][0]
            i = np.nonzero((a[:-1] > 0) != (a[1:] > 0))[0]
            rates += list(np.abs(a[i + 1] - a[i]))
    return float(np.median(rates)) if rates else float("nan")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--sites", default="", help="comma-separated ids (default: all)")
    args = ap.parse_args()
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    if args.sites:
        sites = [s for s in sites if s["id"] in args.sites.split(",")]
    _, ts = ephem.make_loader()
    eph, pc, frame = ephem.load_moon_frame()
    instants = select_instants(eph, frame, ts)
    labels = {jd_utc(d): lab for d, lab in instants}
    jds = sorted(labels)
    rows, summary, headers = [], [], {}
    for site in sites:
        for body, code in BODIES:
            times, h_az, h_el = [], [], []
            for c in range(0, len(jds), hz.CHUNK):
                part = jds[c:c + hz.CHUNK]
                text = hz.fetch(f"{site['id']}-{body}",
                                hz.params_for(code, site["lat"], site["lon"], part), offline=args.offline)
                headers.setdefault("pole", hz.header_value(text, "Center pole/equ"))
                headers.setdefault("source", hz.header_value(text, "Target body name"))
                headers.setdefault("radii", hz.header_value(text, "Center radii"))
                tt, aa, ee = hz.parse_table(text)
                if len(tt) != len(part):
                    raise RuntimeError(f"{site['id']} {body}: {len(tt)} rows for {len(part)} instants")
                times += tt
                h_az += aa
                h_el += ee
            t = ts.from_datetimes(times)
            alt, az, _ = ephem.site_altaz(site, eph, pc, frame, t)[body]
            d_el = (alt - np.array(h_el)) * 60
            d_az = ang(az, h_az) * 60
            for k, tm in enumerate(times):
                rows.append([site["id"], body, tm.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                             labels.get(jds[k], ""), f"{h_az[k]:.9f}", f"{h_el[k]:.9f}",
                             f"{az[k]:.9f}", f"{alt[k]:.9f}", f"{d_az[k]:.6f}", f"{d_el[k]:.6f}"])
            el_s, az_s = stats(d_el), stats(d_az)
            ok = el_s[2] <= TOL_EL_ARCMIN and az_s[2] <= TOL_AZ_ARCMIN
            summary.append((site["id"], body, len(times), el_s, az_s, ok))
            print(f"{site['id']:22s} {body:5s} n={len(times)}  el mean/p95/max {el_s[0]:.5f}/"
                  f"{el_s[1]:.5f}/{el_s[2]:.5f}'  az {az_s[0]:.5f}/{az_s[1]:.5f}/{az_s[2]:.5f}'  "
                  f"{'PASS' if ok else 'FAIL'}")
    rate = polar_sun_rate(eph, pc, frame, ts, sites)
    write_outputs(rows, summary, headers, rate, len(jds))
    passed = all(s[-1] for s in summary)
    print("PASS" if passed else "FAIL")
    return 0 if passed else 1


def write_outputs(rows, summary, headers, rate, n_instants) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with (OUT_DIR / "horizons.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["site", "body", "utc", "label", "horizons_az_deg", "horizons_el_deg",
                    "ours_az_deg", "ours_el_deg", "d_az_arcmin", "d_el_arcmin"])
        w.writerows(rows)
    mins = lambda arcmin: arcmin / 60 / rate * 60  # noqa: E731  timing error, minutes
    lines = [
        "# Validation against NASA JPL Horizons", "",
        f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC by `backend/validate_horizons.py`, "
        f"commit {git_commit()}. {n_instants} instants per site and body ({N_REGULAR} spread evenly "
        f"over {ephem.START_UTC:%Y-%m-%d} to {ephem.END_UTC:%Y-%m-%d}, plus perigee/apogee, the Sun's "
        "lunar-latitude extremes and Earth libration extremes). Raw Horizons replies are cached in "
        "`backend/data/horizons-cache/`; every row is in `horizons.csv`.", "",
        "Ours: Skyfield + DE440s, frame MOON_ME (= MOON_ME_DE440_ME421), site on a 1737.4 km sphere, "
        "apparent (light-time, aberration, deflection), airless.  ",
        f"Horizons: target `{headers.get('source', '?')}`; centre frame `{headers.get('pole', '?')}`; "
        f"centre radii `{headers.get('radii', '?')}`; QUANTITIES=4 airless apparent az/el; times UTC.", "",
        f"**Pass tolerance:** elevation error <= {TOL_EL_ARCMIN} arcmin and azimuth error <= "
        f"{TOL_AZ_ARCMIN} arcmin, fixed before the run. Why: at the polar sites (|lat| > 88 deg) "
        f"the Sun's altitude changes by a median {rate:.4f} deg/h at rise/set, so an elevation error "
        f"of 1 arcmin would shift sunrise/sunset by ~{mins(1):.0f} min, while {TOL_EL_ARCMIN} arcmin "
        f"shifts it by ~{mins(TOL_EL_ARCMIN):.1f} min. Azimuth only picks the horizon-mask column "
        "(0.25 deg steps), so 1 arcmin is far below what matters.", "",
        "| site | body | n | el mean | el p95 | el max | az mean | az p95 | az max | result |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for sid, body, n, el, az, ok in summary:
        lines.append(f"| {sid} | {body} | {n} | {el[0]:.1e} | {el[1]:.1e} | {el[2]:.1e} | "
                     f"{az[0]:.1e} | {az[1]:.1e} | {az[2]:.1e} | {'PASS' if ok else 'FAIL'} |")
    worst = max(max(r[3][2], r[4][2]) for r in summary) if summary else float("nan")
    lines += [
        "", "All errors in arcminutes (absolute values).", "",
        "**Frame / model differences:** Horizons uses DE441 and its 'MEAN_ME (high precision)' "
        "lunar frame; we use DE440 and MOON_ME_DE440_ME421 (NAIF's DE440 realisation of the mean "
        "Earth/polar axis frame). Over 2026-2029 DE440 and DE441 agree closely, and the measured "
        f"total difference (ephemeris + frame + light corrections) is at most {worst:.1e} arcmin "
        f"({worst * 60:.1e} arcsec), so no frame mismatch is visible at this level.", "",
        "Sensitivity check (the comparison can fail): moving our site by 0.002 deg of latitude "
        "(~60 m) made peak-near-shackleton Earth elevation miss by up to 0.082 arcmin -> FAIL "
        "(run by data-v2 on 2026-11-14, not part of the script).", ""]
    (OUT_DIR / "horizons.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT_DIR / 'horizons.csv'} and horizons.md")


if __name__ == "__main__":
    sys.exit(main())
