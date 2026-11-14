# Validation against NASA JPL Horizons

Generated 2026-11-14 21:58 UTC by `backend/validate_horizons.py`, commit bd259a8. 218 instants per site and body (200 spread evenly over 2026-09-01 to 2029-01-01, plus perigee/apogee, the Sun's lunar-latitude extremes and Earth libration extremes). Raw Horizons replies are cached in `backend/data/horizons-cache/`; every row is in `horizons.csv`.

Ours: Skyfield + DE440s, frame MOON_ME (= MOON_ME_DE440_ME421), site on a 1737.4 km sphere, apparent (light-time, aberration, deflection), airless.  
Horizons: target `Sun (10) {source: DE441}`; centre frame `MEAN_ME (high precision) {East-longitude positive}`; centre radii `1737.4, 1737.4, 1737.4 km {Equator_a, b, pole_c}`; QUANTITIES=4 airless apparent az/el; times UTC.

**Pass tolerance:** elevation error <= 0.05 arcmin and azimuth error <= 1.0 arcmin, fixed before the run. Why: at the polar sites (|lat| > 88 deg) the Sun's altitude changes by a median 0.0070 deg/h at rise/set, so an elevation error of 1 arcmin would shift sunrise/sunset by ~142 min, while 0.05 arcmin shifts it by ~7.1 min. Azimuth only picks the horizon-mask column (0.25 deg steps), so 1 arcmin is far below what matters.

| site | body | n | el mean | el p95 | el max | az mean | az p95 | az max | result |
|---|---|---|---|---|---|---|---|---|---|
| peak-near-shackleton | sun | 218 | 7.5e-08 | 3.1e-07 | 2.0e-06 | 7.4e-07 | 1.5e-06 | 3.0e-06 | PASS |
| peak-near-shackleton | earth | 218 | 1.6e-06 | 2.7e-06 | 3.1e-06 | 2.2e-05 | 2.5e-05 | 2.7e-05 | PASS |
| shackleton-rim | sun | 218 | 7.4e-08 | 3.0e-07 | 2.0e-06 | 7.4e-07 | 1.5e-06 | 2.9e-06 | PASS |
| shackleton-rim | earth | 218 | 1.6e-06 | 2.8e-06 | 3.2e-06 | 2.2e-05 | 2.5e-05 | 2.7e-05 | PASS |
| connecting-ridge | sun | 218 | 7.4e-08 | 3.1e-07 | 2.0e-06 | 7.4e-07 | 1.5e-06 | 2.9e-06 | PASS |
| connecting-ridge | earth | 218 | 1.6e-06 | 2.9e-06 | 3.3e-06 | 2.2e-05 | 2.5e-05 | 2.7e-05 | PASS |
| nobile-rim-2 | sun | 218 | 1.0e-07 | 2.6e-07 | 1.9e-06 | 7.4e-07 | 1.5e-06 | 3.1e-06 | PASS |
| nobile-rim-2 | earth | 218 | 2.1e-06 | 4.1e-06 | 4.7e-06 | 2.2e-05 | 2.5e-05 | 2.6e-05 | PASS |
| de-gerlache-rim-2 | sun | 218 | 7.7e-08 | 2.9e-07 | 2.0e-06 | 7.4e-07 | 1.5e-06 | 2.9e-06 | PASS |
| de-gerlache-rim-2 | earth | 218 | 1.7e-06 | 3.3e-06 | 3.7e-06 | 2.2e-05 | 2.5e-05 | 2.6e-05 | PASS |
| im2 | sun | 218 | 1.0e-07 | 2.7e-07 | 2.0e-06 | 7.4e-07 | 1.5e-06 | 3.0e-06 | PASS |
| im2 | earth | 218 | 1.8e-06 | 3.2e-06 | 3.6e-06 | 2.2e-05 | 2.5e-05 | 2.6e-05 | PASS |
| im1 | sun | 218 | 1.4e-07 | 3.0e-07 | 2.0e-06 | 7.4e-07 | 1.5e-06 | 3.0e-06 | PASS |
| im1 | earth | 218 | 1.6e-06 | 2.7e-06 | 3.1e-06 | 2.2e-05 | 2.5e-05 | 2.7e-05 | PASS |

All errors in arcminutes (absolute values).

**Frame / model differences:** Horizons uses DE441 and its 'MEAN_ME (high precision)' lunar frame; we use DE440 and MOON_ME_DE440_ME421 (NAIF's DE440 realisation of the mean Earth/polar axis frame). Over 2026-2029 DE440 and DE441 agree closely, and the measured total difference (ephemeris + frame + light corrections) is at most 2.7e-05 arcmin (1.6e-03 arcsec), so no frame mismatch is visible at this level.

Sensitivity check (the comparison can fail): moving our site by 0.002 deg of latitude (~60 m) made peak-near-shackleton Earth elevation miss by up to 0.082 arcmin -> FAIL (run by data-v2 on 2026-11-14, not part of the script).
