"""Validation of the LOLA horizons (spec 5.4).

From backend/:   py -3 -m horizon.validate
1. Plots docs/img/horizon-<id>-polar.png and -panorama.png for every site in horizons.json.
2. Sun visible % (upper limb, 0 offset), average sunlit %, longest darkness over one
   year from 2026-11-15 (sky.json hourly Sun alt/az where the site is in it, otherwise
   the same Skyfield method as compute.py), for 0/2/5 m and the 2 m position ring.
3. Literature check against Glaser et al. (NTRS 20170007365): same points, same
   period (2017-01-01 to 2037-01-01, hourly), same definitions.
Writes docs/terrain-validation.json.
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

from .plots import panorama, polar
from .run import OUT, Terrain, horizon
from .download import DEFAULT_DEST
from .geometry import unit_from_latlon
from .march import compute_horizon
from .products import H_MAX_M
from .sunstats import sun_stats

BACKEND = Path(__file__).resolve().parents[1]
DOCS = BACKEND.parent / "docs"
SKY = BACKEND.parent / "frontend" / "public" / "sky.json"
YEAR_H = 8760

# Glaser et al., NTRS 20170007365, Tables 1-2 as read from the PDF text (see docs/TERRAIN.md).
GLASER = [
    # name, lat, lon(E), height m, avg sunlit %, sun visible %, longest shadow h, note
    ("Shackleton S", -89.7849, 203.97, 0, 81.0, 85.5, 221, "Table 1"),
    ("Connecting Ridge C1", -89.4505, 222.84, 0, 76.0, 81.3, 268, "Table 1"),
    ("Connecting Ridge C2", -89.3157, 245.94, 0, 75.6, 80.6, 166, "Table 1"),
    ("Connecting Ridge C1 (2 m)", -89.4398, 222.83, 2, 88.0, 92.1, 112,
     "Table 2; 88.0/92.1 confirmed by the paper's text, 112 h from scrambled table text"),
    ("Shackleton (2 m)", -89.7815, 204.70, 2, 82.1, 89.8, 65,
     "Table 2; column order inferred from scrambled PDF text (low confidence)"),
]


def sun_track(load_state, lat, lon, start, hours):
    """Hourly Sun centre alt/az (deg) with the compute.py method (DE421, MOON_ME_DE421)."""
    eph, pc, frame, ts = load_state
    t = ts.utc(start[0], start[1], start[2], np.arange(hours))
    obs = (eph["moon"] + pc.build_latlon_degrees(frame, lat, lon)).at(t)
    alt, az, _ = obs.observe(eph["sun"]).apparent().altaz()
    return alt.degrees, az.degrees


def skyfield_state():
    from skyfield.api import Loader
    import compute
    load = Loader(str(compute.DATA_DIR), verbose=False)
    eph, pc, frame = compute.load_moon_frame(load)
    return eph, pc, frame, load.timescale()


def year_track(sky, state, sid, site):
    for s in sky["sites"]:
        if s["id"] == sid and sky["meta"]["start_utc"].startswith("2026-11-15T00"):
            return np.array(s["sun_alt"][:YEAR_H]), np.array(s["sun_az"][:YEAR_H]), "sky.json"
    alt, az = sun_track(state, site["lat"], site["lon"], (2026, 11, 15), YEAR_H)
    return alt, az, "skyfield (compute.py method)"


def site_stats(sid, site, alt, az):
    out = {h: sun_stats(alt, az, site["heights"][h], site["az_step_deg"]) for h in ("0", "2", "5")}
    ring = site["ring"]
    rs = [sun_stats(alt, az, p["h"], ring["az_step_deg"]) for p in ring["profiles"]]
    vis = np.array([r["sun_visible_pct"] for r in rs])
    dark = np.array([r["longest_dark_h"] for r in rs])
    out["ring_2m"] = {"sun_visible_pct_min": float(vis.min()), "sun_visible_pct_max": float(vis.max()),
                      "sun_visible_pct_sd": round(float(vis.std()), 1),
                      "longest_dark_h_min": float(dark.min()), "longest_dark_h_max": float(dark.max())}
    return out


def literature(terrain, state):
    rows = []
    start, hours = (2017, 1, 1), 24 * (365 * 20 + 5)        # 2017-01-01 .. 2037-01-01
    for name, lat, lone, hgt, g_avg, g_vis, g_dark, note in GLASER:
        lon = lone - 360.0 if lone > 180 else lone
        alt, az = sun_track(state, lat, lon, start, hours)
        res = horizon(terrain, lat, lon, (hgt,), 0.25, terrain.windowed_samplers(lat, lon))
        ours = sun_stats(alt, az, res["h"][float(hgt)], 0.25)
        # same point, 240 m/px DEM only (the resolution Mazarico et al. 2011 used)
        d240 = terrain.dems["ldem_60s_240m"]
        w240 = terrain.windowed_samplers(lat, lon)[-1]          # the 240 m-only far band
        coarse = compute_horizon(lat, lon, [(600e3, 240.0, w240)], (hgt,),
                                 h_site=float(d240.sample_unit(unit_from_latlon(lat, lon)[None, :])[0]),
                                 h_max=H_MAX_M)
        ours240 = sun_stats(alt, az, coarse["h"][float(hgt)], 0.25)
        rows.append({"site": name, "lat": lat, "lon_e": lone, "height_m": hgt, "source": note,
                     "glaser": {"avg_sunlit_pct": g_avg, "sun_visible_pct": g_vis,
                                "longest_dark_h": g_dark},
                     "ours": ours, "ours_240m_dem": ours240,
                     "ground_m": round(res["h_site"], 1)})
        print(f"{name:28s} Glaser avg {g_avg:5.1f} vis {g_vis:5.1f} dark {g_dark:4d} h | ours avg "
              f"{ours['avg_sunlit_pct']:5.1f} vis {ours['sun_visible_pct']:5.1f} dark "
              f"{ours['longest_dark_h']:6.1f} h | 240 m-only vis {ours240['sun_visible_pct']:5.1f}"
              f" dark {ours240['longest_dark_h']:6.1f} h", flush=True)
    return rows


def main():
    t0 = time.perf_counter()
    hz = json.loads(OUT.read_text(encoding="utf-8"))
    sky = json.loads(SKY.read_text(encoding="utf-8"))
    state = skyfield_state()
    (DOCS / "img").mkdir(parents=True, exist_ok=True)
    report = {"sites": {}, "literature": []}
    for sid, site in hz["sites"].items():
        alt, az, src = year_track(sky, state, sid, site)
        panorama(DOCS / "img" / f"horizon-{sid}-panorama.png", sid, site, (alt, az))
        polar(DOCS / "img" / f"horizon-{sid}-polar.png", sid, site)
        st = site_stats(sid, site, alt, az)
        st["sun_track_source"] = src
        report["sites"][sid] = st
        r = st["ring_2m"]
        print(f"{sid:22s} vis% 0/2/5 m {st['0']['sun_visible_pct']:5.1f} {st['2']['sun_visible_pct']:5.1f}"
              f" {st['5']['sun_visible_pct']:5.1f} | dark h {st['0']['longest_dark_h']:6.1f} "
              f"{st['2']['longest_dark_h']:6.1f} {st['5']['longest_dark_h']:6.1f} | ring 2 m vis "
              f"{r['sun_visible_pct_min']}-{r['sun_visible_pct_max']} dark "
              f"{r['longest_dark_h_min']}-{r['longest_dark_h_max']} h", flush=True)
    report["literature"] = literature(Terrain(DEFAULT_DEST), state)
    report["period_sites"] = "2026-11-15T00Z + 8760 h, 10-min linear interpolation"
    report["period_literature"] = "2017-01-01T00Z to 2037-01-01T00Z hourly, 10-min interpolation"
    (DOCS / "terrain-validation.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(f"validation done in {time.perf_counter() - t0:.0f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
