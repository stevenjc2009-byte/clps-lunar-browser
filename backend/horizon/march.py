"""Horizon march: max terrain elevation angle along great-circle rays.

For each azimuth the ray starts one step from the observer and walks outward
through range bands; each band has its own step (= pixel size of its DEM) and its
own sampler. Every sample's elevation angle is computed exactly
(geometry.elevation_angle_deg). The horizon is the maximum over all samples.

Stopping rule (this is how R_max is justified numerically, per ray):
a point at range d can be at most H_MAX metres above the reference sphere (the
highest DN in any product used). Once the elevation angle of such a worst-case
point at range d is below the horizon already found on every ray, and that worst-
case angle is decreasing with range, no terrain farther out can raise any horizon,
so the march stops. A hard cap r_cap stops runaway rays; reaching it is reported.
"""
import numpy as np

from .geometry import R, elevation_angle_deg, great_circle_points, ray_directions

CHUNK_STEPS = 256


def _bound_deg(r_obs, d, h_max):
    return elevation_angle_deg(r_obs, R + h_max, d / R)


def compute_horizon(lat, lon, bands, obs_heights, az_step=0.25, h_site=None,
                    site_sampler=None, h_max=7027.0, r_cap=600e3):
    """Horizon elevation (deg) per azimuth for each observer height.

    bands: sequence of (r_outer_m, step_m, sampler); sampler(p[...,3]) -> metres or NaN.
    h_site: ground height (m above R); if None it is sampled with site_sampler.
    Returns dict with az, h {height: array}, stop_m, argmax_m, nodata_frac, h_site, capped.
    """
    if abs(lat) > 89.9999:
        raise ValueError("site too close to the pole for a defined north direction")
    az = np.arange(0.0, 360.0, az_step)
    tangents, up = ray_directions(lat, lon, az)
    if h_site is None:
        h_site = float(site_sampler(up[None, :])[0])
        if not np.isfinite(h_site):
            raise ValueError(f"no DEM height at site {lat}, {lon}")
    heights = [float(h) for h in obs_heights]
    r_obs = {h: R + h_site + h for h in heights}
    best = {h: np.full(az.size, -90.0) for h in heights}
    argmax = np.zeros(az.size)
    n_total = np.zeros(az.size)
    n_nodata = np.zeros(az.size)
    r_prev, d_stop, capped = 0.0, None, False

    for r_outer, step, sampler in bands:
        r_end = min(r_outer, r_cap)
        if r_end <= r_prev:
            continue
        d_all = np.arange(r_prev + step, r_end + 0.5 * step, step)
        for k in range(0, d_all.size, CHUNK_STEPS):
            d = d_all[k:k + CHUNK_STEPS]
            pts = great_circle_points(up, tangents, d / R)
            ht = sampler(pts)                                    # (A, S)
            nod = np.isnan(ht)
            n_total += d.size
            n_nodata += nod.sum(1)
            for h in heights:
                ang = elevation_angle_deg(r_obs[h], R + ht, (d / R)[None, :])
                ang = np.where(nod, -90.0, ang)
                i = ang.argmax(1)
                m = ang[np.arange(az.size), i]
                if h == heights[0]:
                    argmax = np.where(m > best[h], d[i], argmax)
                best[h] = np.maximum(best[h], m)
            dl = d[-1]
            done = True
            for h in heights:
                b, b_next = _bound_deg(r_obs[h], dl, h_max), _bound_deg(r_obs[h], dl + step, h_max)
                if not (b_next < b and b < best[h].min()):
                    done = False
            if done:
                d_stop = dl
                break
        r_prev = r_end
        if d_stop is not None:
            break
    if d_stop is None:
        d_stop, capped = r_prev, True
    return {"az": az, "h": best, "stop_m": d_stop, "argmax_m": argmax,
            "nodata_frac": n_nodata / np.maximum(n_total, 1), "h_site": h_site,
            "capped": capped}
