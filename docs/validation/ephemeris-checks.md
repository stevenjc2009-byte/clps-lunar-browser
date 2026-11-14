# Ephemeris checks (data-v2)

Generated 2026-11-14 21:45 UTC by `backend/compare_ephem.py`, commit 4b859a8. Grid: hourly 2026-09-01 to 2029-01-01 (20473 samples). All values are maxima over the whole grid.

## 1. DE421 -> DE440 change (arcminutes)

Old: DE421 + moon_pa_de421_1900-2050.bpc, frame MOON_ME_DE421. New: DE440s + moon_pa_de440_200625.bpc, frame MOON_ME_DE440_ME421 (= MOON_ME).

| site | Sun alt | Sun az | Earth alt | Earth az |
|---|---|---|---|---|
| peak-near-shackleton | 0.0008 | 0.0005 | 0.0007 | 0.0006 |
| shackleton-rim | 0.0008 | 0.0005 | 0.0007 | 0.0006 |
| connecting-ridge | 0.0008 | 0.0005 | 0.0007 | 0.0006 |
| nobile-rim-2 | 0.0008 | 0.0005 | 0.0007 | 0.0006 |
| de-gerlache-rim-2 | 0.0008 | 0.0005 | 0.0007 | 0.0006 |
| im2 | 0.0008 | 0.0005 | 0.0007 | 0.0006 |
| im1 | 0.0008 | 0.0006 | 0.0007 | 0.0006 |

Azimuth near the pole is sensitive to tiny shifts of the site itself, so the az change can exceed the alt change.

## 2. Disc radius: site vs Moon centre (arcseconds)

sky.json `sun_radius_deg` / `earth_radius_deg` use the Moon-centre distance. Max difference from the radius seen at each site:

| site | Sun | Earth |
|---|---|---|
| peak-near-shackleton | 0.001 | 2.219 |
| shackleton-rim | 0.000 | 2.119 |
| connecting-ridge | 0.000 | 2.187 |
| nobile-rim-2 | 0.001 | 2.723 |
| de-gerlache-rim-2 | 0.001 | 2.200 |
| im2 | 0.001 | 3.277 |
| im1 | 0.002 | 4.896 |

Range of the shipped arrays: Sun 0.2614-0.2717 deg, Earth 0.8978-1.0235 deg.
