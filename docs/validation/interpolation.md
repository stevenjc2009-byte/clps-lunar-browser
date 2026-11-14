# Hourly interpolation vs 10-minute truth

Generated 2026-11-14 21:58 UTC by `backend/tenmin.py`, commit bd259a8. Window: 60 days from 2027-01-01, truth computed directly every 10 min with DE440 (fixtures in `frontend/src/lib/__fixtures__/`).

Method: take every 6th truth sample (= the hourly grid), optionally round it like sky.json, interpolate with a uniform Catmull-Rom spline, compare with the truth (alt error over all 10-min points except the first and last hour, which lack a neighbour sample). Crossing times: 0 deg sign changes, linearly refined, interpolated curve searched at 1 min; 'linear' = straight line between the hourly samples.

| site | body | hourly data | max alt error (arcmin) | 0 deg crossings | cubic max timing error (min) | linear max timing error (min) |
|---|---|---|---|---|---|---|
| peak-near-shackleton | sun | full precision | 6.76e-07 | 3 | 0.00 | 0.03 |
| peak-near-shackleton | sun | rounded 3 dp | 3.61e-02 | 3 | 2.42 | 2.09 |
| peak-near-shackleton | sun | rounded 2 dp | 4.21e-01 | 3 | 35.41 | 35.41 |
| peak-near-shackleton | earth | full precision | 9.60e-06 | 4 | 0.00 | 0.00 |
| peak-near-shackleton | earth | rounded 3 dp | 3.45e-02 | 4 | 0.52 | 0.47 |
| peak-near-shackleton | earth | rounded 2 dp | 5.08e-01 | 4 | 6.94 | 6.23 |
| im2 | sun | full precision | 3.35e-06 | 4 | 0.00 | 0.01 |
| im2 | sun | rounded 3 dp | 3.53e-02 | 4 | 0.51 | 0.51 |
| im2 | sun | rounded 2 dp | 3.65e-01 | 4 | 2.39 | 1.54 |
| im2 | earth | full precision | 9.47e-06 | 4 | 0.00 | 0.07 |
| im2 | earth | rounded 3 dp | 3.34e-02 | 4 | 0.37 | 0.37 |
| im2 | earth | rounded 2 dp | 3.35e-01 | 4 | 4.82 | 3.85 |
