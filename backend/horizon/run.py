"""Compute LOLA terrain horizons for every site and write frontend/public/horizons.json.

One command, from backend/:
    py -3 -m horizon.download          # once: ~4.3 GB of DEMs to D:\\clps-lola-data
    py -3 -m horizon.run [--sites extra.json ...]

Sites: backend/sites.json plus any --sites files (default also reads
$CLPS_SITES_V2 if set). Results are cached per site in <data>/horizon-cache, keyed
by coordinates and algorithm parameters, so re-runs only compute new sites.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from .dem import PolarDEM, chained_sampler
from .download import DEFAULT_DEST
from .geometry import offset_point, stereo_xy_from_latlon, unit_from_latlon
from .march import compute_horizon
from .products import BANDS, H_MAX_M, PRODUCTS

ALGORITHM_VERSION = "lola-horizon-1"
HEIGHTS = (0, 2, 5)
AZ_STEP = 0.25
RING_RADII = (50, 100)
RING_BEARINGS = tuple(range(0, 360, 45))
RING_HEIGHT, RING_AZ_STEP = 2, 0.5
R_CAP = 600e3
WINDOW_MARGIN_M = 2000.0
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
OUT = BACKEND.parent / "frontend" / "public" / "horizons.json"


class Terrain:
    def __init__(self, data_dir):
        self.dems = {n: PolarDEM(n, data_dir) for n in PRODUCTS}
        self.band_samplers = [chained_sampler([self.dems[n] for n in names])
                              for _, names in BANDS]

    def bands_for(self, lat, lon, samplers=None):
        """(r_outer, step, sampler) per band; step = finest product covering the site."""
        u = unit_from_latlon(lat, lon)[None, :]
        out = []
        for i, (r_outer, names) in enumerate(BANDS):
            step = next((self.dems[n].scale for n in names
                         if np.isfinite(self.dems[n].sample_unit(u)[0])), None)
            if step is None:
                raise ValueError(f"no DEM covers {lat}, {lon}")
            out.append((r_outer, step, (samplers or self.band_samplers)[i]))
        return out

    def site_height(self, lat, lon):
        return float(self.band_samplers[0](unit_from_latlon(lat, lon)[None, :])[0])

    def windowed_samplers(self, lat, lon, margin_m=WINDOW_MARGIN_M):
        """Per-band samplers over in-RAM DEM windows around a site (same values, fast).

        Each window covers the band's outer radius (the last band: R_CAP) plus a margin
        that holds the ring offsets and a few ray steps, so no ray sample ever falls
        outside its window where the full grid would have had data.
        """
        x, y = stereo_xy_from_latlon(lat, lon)
        cache, samplers = {}, []
        for r_outer, names in BANDS:
            rad = (R_CAP if np.isinf(r_outer) else r_outer) + margin_m
            # stereographic scale k = 1/cos^2(colat/2) >= 1: map distance >= ground distance
            rad *= 1.0 / np.cos(np.radians(90 + R_CAP / 1737400 * 180 / np.pi + lat) / 2) ** 2
            wins = []
            for n in names:
                key = (n, round(rad))
                if key not in cache:
                    cache[key] = self.dems[n].window(float(x), float(y), rad)
                wins.append(cache[key])
            samplers.append(chained_sampler(wins))
        return samplers


def horizon(terrain, lat, lon, heights, az_step, samplers=None):
    return compute_horizon(lat, lon, terrain.bands_for(lat, lon, samplers), heights,
                           az_step=az_step, h_site=terrain.site_height(lat, lon),
                           h_max=H_MAX_M, r_cap=R_CAP)


def cache_key(site):
    params = [ALGORITHM_VERSION, site["lat"], site["lon"], HEIGHTS, AZ_STEP, RING_RADII,
              RING_BEARINGS, RING_HEIGHT, RING_AZ_STEP, R_CAP, H_MAX_M, repr(BANDS)]
    return hashlib.sha1(json.dumps(params, default=str).encode()).hexdigest()[:16]


def compute_site(terrain, site, cache_dir):
    f = cache_dir / f"{site['id']}-{cache_key(site)}.json"
    if f.exists():
        return json.loads(f.read_text()), 0.0
    t0 = time.perf_counter()
    win = terrain.windowed_samplers(site["lat"], site["lon"])
    main = horizon(terrain, site["lat"], site["lon"], HEIGHTS, AZ_STEP, win)
    profiles = []
    for r in RING_RADII:
        for b in RING_BEARINGS:
            dx, dy = r * np.sin(np.radians(b)), r * np.cos(np.radians(b))
            lat, lon = offset_point(site["lat"], site["lon"], dx, dy)
            rh = horizon(terrain, float(lat), float(lon), (RING_HEIGHT,), RING_AZ_STEP, win)
            profiles.append({"dx_m": round(float(dx), 1), "dy_m": round(float(dy), 1),
                             "h_site_m": round(rh["h_site"], 1),
                             "h": rh["h"][float(RING_HEIGHT)].tolist()})
    res = {
        "lat": site["lat"], "lon": site["lon"], "h_site_m": round(main["h_site"], 1),
        "stop_km": round(main["stop_m"] / 1000, 1), "capped": bool(main["capped"]),
        "near_step_m": terrain.bands_for(site["lat"], site["lon"])[0][1],
        "argmax_km_p95": round(float(np.percentile(main["argmax_m"], 95)) / 1000, 1),
        "argmax_km_max": round(float(main["argmax_m"].max()) / 1000, 1),
        "nodata_frac_max": float(main["nodata_frac"].max()),
        "heights": {str(h): main["h"][float(h)].tolist() for h in HEIGHTS},
        "ring": profiles,
    }
    cache_dir.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(res))
    return res, time.perf_counter() - t0


def load_sites(extra):
    sites = {}
    for path in [BACKEND / "sites.json", *extra]:
        for s in json.loads(Path(path).read_text(encoding="utf-8")):
            sites[s["id"]] = s
    return list(sites.values())


def r2(a):
    return [round(float(v), 2) for v in a]


def git_commit():
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=BACKEND,
                              capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def build_json(results, max_stop_km):
    meta = {
        "dem_products": [{"name": p.name.upper(), "url": p.img_url, "resolution_m": p.scale_m,
                          "md5": p.img_md5} for p in PRODUCTS.values()],
        "algorithm_version": ALGORITHM_VERSION,
        "r_max_km": max_stop_km,
        "az_step_deg": AZ_STEP,
        "interpolation": "bilinear between the 4 nearest DEM pixel centres",
        "heights_m": list(HEIGHTS),
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "script_commit": git_commit(),
        "notes": ("Horizon = max exact elevation angle of LOLA terrain along great-circle rays "
                  "(sphere R=1737.4 km, heights relative to it). Azimuth clockwise from local "
                  "north (toward the lunar north pole), same as sky.json. Ray steps: 5 or 20 m "
                  "to 10 km, 60 m to 60 km, 240 m beyond; each ray stops when even a "
                  f"{H_MAX_M:.0f} m peak could not rise above the horizon found (r_max_km = "
                  "largest such stop). Site ground height from the DEM. Ring: 2 m observer at "
                  "50 and 100 m offsets, 8 bearings. Values in degrees, 2 decimals. "
                  "See docs/TERRAIN.md."),
    }
    sites = {}
    for sid, r in results.items():
        sites[sid] = {
            "az_step_deg": AZ_STEP, "lat": r["lat"], "lon": r["lon"], "h_site_m": r["h_site_m"],
            "stop_km": r["stop_km"],
            "heights": {k: r2(v) for k, v in r["heights"].items()},
            "ring": {"radius_m": list(RING_RADII), "az_step_deg": RING_AZ_STEP,
                     "height_m": RING_HEIGHT,
                     "profiles": [{"dx_m": p["dx_m"], "dy_m": p["dy_m"], "h": r2(p["h"])}
                                  for p in r["ring"]]},
        }
    return {"meta": meta, "sites": sites}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Compute LOLA horizons for all sites")
    ap.add_argument("--sites", nargs="*", default=[os.environ["CLPS_SITES_V2"]]
                    if os.environ.get("CLPS_SITES_V2") else [])
    ap.add_argument("--data", type=Path, default=DEFAULT_DEST)
    ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args(argv)
    terrain = Terrain(a.data)
    results, t_all = {}, time.perf_counter()
    for site in load_sites(a.sites):
        res, dt = compute_site(terrain, site, a.data / "horizon-cache")
        results[site["id"]] = res
        h2 = np.array(res["heights"]["2"])
        print(f"{site['id']:22s} ground {res['h_site_m']:8.1f} m  stop {res['stop_km']:6.1f} km"
              f"  2 m horizon {h2.min():6.2f}..{h2.max():5.2f} deg  "
              f"{'cached' if dt == 0 else f'{dt:6.1f} s'}", flush=True)
        if res["capped"]:
            print(f"  WARNING {site['id']}: rays reached the {R_CAP / 1e3:.0f} km cap")
    max_stop = max(r["stop_km"] for r in results.values())
    out = build_json(results, max_stop)
    a.out.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {a.out} ({a.out.stat().st_size / 1e6:.2f} MB), "
          f"total {time.perf_counter() - t_all:.1f} s, r_max {max_stop} km")
    return 0


if __name__ == "__main__":
    sys.exit(main())
