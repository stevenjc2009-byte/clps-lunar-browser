# Sanity checks

Generated 2026-11-14 21:58 UTC by `backend/sanity.py`, commit bd259a8, from `frontend/public/sky.json` (2026-09-01 to 2029-01-01, hourly, flat 0 deg horizon, body centre).

## 1. Periodicity (autocorrelation peak between 20 and 40 days)

Expected: Sun ~29.530589 d (synodic month: the lunar day-night cycle); Earth ~27.2-27.6 d (Earth's height at a fixed site is driven by libration, which follows the draconic 27.21 d and anomalistic 27.55 d months, not the synodic one).

Each hourly series first has its centred 29.53-day running mean subtracted (removes the slow polar 'seasonal' drift, keeps the monthly cycle); the peak lag is refined with a parabola through the three highest hourly lags. 'no peak' = the maximum sits on the edge of the 20-40 d search range.

| site | lat | Sun altitude | Sun visible (0/1) | Earth altitude |
|---|---|---|---|---|
| peak-near-shackleton | -89.01 | 29.53 d | 26.06 d | 27.21 d |
| shackleton-rim | -89.78 | 29.53 d | 29.52 d | 27.21 d |
| connecting-ridge | -89.45 | 29.54 d | 23.57 d | 27.22 d |
| nobile-rim-2 | -84.20 | 29.56 d | 29.51 d | 27.19 d |
| de-gerlache-rim-2 | -88.52 | 29.51 d | 27.11 d | 27.22 d |
| im2 | -84.79 | 29.54 d | 29.53 d | 27.20 d |
| im1 | -80.13 | 29.52 d | 29.54 d | 27.21 d |

Result: the Sun-altitude peak lies within 0.03 d of 29.53 d at every site, including the near-polar ones. The yes/no visibility flag is a much weaker monthly signal near the pole: there the Sun is either up or down for whole 'seasons' and only flickers across the horizon around the transitions, so its peak wanders (finding, documented, not tuned).

Longer cycles (the ~346.6 d eclipse year that sets polar 'seasons', and the 18.6-year nodal cycle of the lunar orbit) are outside this check; the 18.6-year cycle is a stated limit of a 2.3-year data range.

## 2. Sun visibility vs published polar illumination

Ours: % of hours with the Sun's centre above a FLAT 0 deg horizon over the whole data range. Published: Glaser et al. 2018 (NTRS 20170007365, opened and read: Table 1, 'This study' rows, 20 m/px LOLA terrain, 20-year average, surface level).

| site | ours (flat) | published Sun visibility | published avg illumination | source |
|---|---|---|---|---|
| shackleton-rim | 60.5 % | 85.5 % | 81.0 % | Glaser et al. 2018 Table 1, Shackleton S |
| connecting-ridge | 57.8 % | 81.3 % | 76.0 % | Glaser et al. 2018 Table 1, Connecting Ridge C1 |

**Finding, not a failure:** the flat-horizon model gives far less Sun than the terrain-aware study at these rim/ridge points. Elevated rims see the Sun over a horizon that lies BELOW 0 deg in most directions, which a flat 0 deg horizon cannot represent; the averaging period also differs (2.3 vs 20 years). The terrain horizon (horizons.json, LOLA branch) is what should close this gap.
