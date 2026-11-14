"""Sun visibility statistics against a terrain horizon.

- Hourly Sun centre alt/az is linearly interpolated to 10-minute sub-steps
  (azimuth unwrapped first so 359 -> 1 deg does not sweep backwards).
- Horizon at the Sun's azimuth: linear interpolation in the profile, wrapping at 360.
- "Sun visible" = upper limb above the horizon: alt + r_sun > h(az).
- "Average sunlit" = mean fraction of the solar disc area above the horizon, with the
  horizon treated as a straight line across the disc (the disc is 0.53 deg wide).
- Longest darkness = longest run of sub-steps with the Sun not visible (10 min grain).
"""
import numpy as np

SUN_RADIUS_DEG = 0.2666     # v1 sky.json constant (sky.json v2 has per-hour values)
SUB = 6                     # 10-minute sub-steps per hour


def interp_track(alt, az, sub=SUB):
    alt, az = np.asarray(alt, float), np.asarray(az, float)
    t = np.arange(alt.size)
    tf = np.arange(0, alt.size - 1 + 1e-9, 1.0 / sub)
    a = np.interp(tf, t, alt)
    z = np.interp(tf, t, np.degrees(np.unwrap(np.radians(az)))) % 360.0
    return a, z


def horizon_at(profile, az_step, az):
    prof = np.asarray(profile, float)
    x = np.arange(prof.size + 1) * az_step
    return np.interp(np.asarray(az) % 360.0, x, np.append(prof, prof[0]))


def disc_fraction(alt, h, r):
    """Fraction of the disc area above a straight horizon at elevation h."""
    c = np.clip((h - alt) / r, -1.0, 1.0)       # horizon height relative to disc centre
    return (np.arccos(c) - c * np.sqrt(1.0 - c * c)) / np.pi


def longest_run(mask):
    if not mask.any():
        return 0
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    return int((ends - starts).max())


def sun_stats(alt_h, az_h, profile, az_step, sun_r=SUN_RADIUS_DEG, sub=SUB):
    """Stats from hourly Sun centre alt/az against a horizon profile."""
    a, z = interp_track(alt_h, az_h, sub)
    h = horizon_at(profile, az_step, z)
    vis = a + sun_r > h
    dark = ~vis
    run = longest_run(dark)
    return {
        "sun_visible_pct": round(100.0 * vis.mean(), 1),
        "avg_sunlit_pct": round(100.0 * disc_fraction(a, h, sun_r).mean(), 1),
        "longest_dark_h": round(run / sub, 1),
        "dark_run_censored": bool(run and (dark[:run].all() or dark[-run:].all())),
    }
