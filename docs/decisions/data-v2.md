# Decisions — data-v2 (2026-11-14, autonomous run)

Every choice made without asking, with the reason. Numbers are measured; sources named.

## 1. Ephemeris, kernels, frame
- **Kernels** (names checked against the NAIF generic_kernels listings on 2026-11-14):
  `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `pck00011.tpc`.
  URL, sha256 and byte size of each are in `backend/data/MANIFEST.json` and `sky.json meta.kernels`
  (`backend/kernels.py` writes/verifies both).
- `moon_de440_250416.tf` is used although its own comment names `moon_de440_200625.tf`: the 200625
  file is no longer in the NAIF listing; 250416 supersedes it.
- **Frame:** MOON_ME (31001) is an identity alias of MOON_ME_DE440_ME421 (31009), a fixed rotation
  from MOON_PA_DE440 (31008, the bpc). Skyfield follows only one text-kernel hop, so
  `ephem.load_moon_frame` asserts the alias is the identity and builds 31009 directly.
- **Skyfield workaround 2:** the bpc has two segments (JD 2287184.5–2607184.5 and 2607184.5–2688976.5);
  Skyfield keeps the last one, which does not cover 2026–2029. `_covering_segment` passes the
  covering segment explicitly (`_segment=`).
- DE421 fallback not needed; DE421 kept as a kernel set only for `compare_ephem.py`.
- **DE421 → DE440 change:** max 0.0008' Sun alt, 0.0007' Earth alt, ≤ 0.0006' az over the whole grid
  (`docs/validation/ephemeris-checks.md`). Far below anything visible.
- Skyfield 1.55 / numpy / jplephem were already pinned in `backend/requirements.txt`.

## 2. Data range and landing window
- Hourly 2026-09-01T00Z → 2029-01-01T00Z, both ends included: 20473 samples.
- landing_min = 2026-11-15T00Z (brief). landing_max = end − 365 d − 30 d = **2027-12-03T00Z**
  (a 1-year window plus a 30-day pad must fit inside the data).
- Data starts 75 d before landing_min (> 1 synodic month) so charts have context.

## 3. Sites
- `backend/sites.json` replaced with the 7 entries of the lead's `sites-v2.json`, fields unchanged
  ("shackleton" → "peak-near-shackleton").
- `status` and `uncertainty_m` pass straight through. Default mapping only when a site lacks
  `status` (`compute.DEFAULT_STATUS`): shackleton / peak-near-shackleton → candidate, im1/im2 →
  landing, anything else → candidate. Missing `uncertainty_m` → null. Status validated against
  candidate/target/landing. All 7 v2 entries carry both fields, so the defaults are unused today.
- Regenerate: `cd backend && .venv/Scripts/python.exe compute.py` (~8 s).

## 4. New hourly arrays
- `sun_radius_deg`, `earth_radius_deg`: angular radius seen from the **Moon's centre** (one array for
  all sites). Measured site-vs-centre difference: Sun ≤ 0.002", Earth 2.1–4.9" (IM-1 largest) —
  negligible against the 1-dp chart and the 0.25° horizon mask. R_sun 695700 km, R_earth 6371 km.
- `dsn_moon_el_max`: max geometric Moon elevation over DSS 14 / 43 / 63, **no refraction**
  (it gates a ≥ 10° coverage rule; refraction at 10° is ~5', irrelevant at 1-dp storage).
- **DSN coordinates:** the lead's decimals (e.g. DSS-14 35.2443523) are 810-005 Module 301 Rev K
  **Table 6 geocentric** latitudes. Fed to WGS 84 as geodetic they miss Table 2 XYZ by 20,145 m.
  Used **Table 5 geodetic** DMS instead (`backend/dsn.py`); `test_dsn.py` proves < 1 m against
  Table 2 and goes red (20 km miss) with the lead's values. Heights are the lead's (they match Table 5).

## 5. Storage precision / size
- alt 3 dp, az 1 dp. Reason (`docs/validation/interpolation.md`): 2 dp alt shifts polar Sun 0°
  crossings by up to 35.4 min; 3 dp by ≤ 2.4 min. Az only selects a 0.25° horizon column.
- sky.json = 3.85 MB raw (over the 3 MB guideline), ~0.9 MB gzip; GitHub Pages serves it gzip
  (checked: Content-Encoding gzip). Accepted for the accuracy.

## 6. vectors.bin / ephem.ts
- Regenerated (start 2026-09-01, 20473 records, 491,352 bytes); layout unchanged, so `ephem.ts`
  not touched. `check_vectors.py`: OK, max |Δalt| 0.00003°, 0 visibility hours differ.
- **Flag for the engine agent:** `ephem.ts computeSite` still rounds alt to 2 dp (35-min crossing
  error at the pole, see §5). Left alone per the brief.

## 7. 10-minute fixtures
- `tenmin-peak-near-shackleton.json`, `tenmin-im2.json` (~238 KB each, 3 dp): 60 d from
  **2027-01-01**, not 2026-11-15, because from 15 Nov the polar Sun never sets for ~60 d (no
  crossings to time). Catmull-Rom on full-precision hourly data: alt error < 0.0001', crossing
  timing 0.00 min; on 3-dp data ≤ 0.036' and ≤ 2.42 min.

## 8. Horizons validation
- 218 instants per site and body (200 regular + perigee/apogee, Sun-latitude and libration
  extremes), all 7 sites. Max difference 2.7e-05' (1.6e-03"). PASS.
- Tolerance 0.05' el / 1' az fixed **before** the run: polar Sun rises at a median 0.0070°/h, so
  0.05' ≈ 7 min of sunrise timing; az only picks a 0.25° mask column.
- Horizons silently truncates long TLISTs (218 → 80 rows): requests chunked at 50 with a row-count
  check; 1 s between requests; raw replies cached and committed (`backend/data/horizons-cache/`,
  70 files, 824 KB) so `--offline` re-runs exactly.
- Sensitivity: site moved 0.002° lat → 0.082' → FAIL (the check can go red).

## 9. Sanity (docs/SANITY.md)
- Sun-altitude autocorrelation peaks 29.51–29.56 d at every site (pytest asserts 29.53 ± 0.1 at
  the polar ones). Series are high-passed with a 709 h boxcar first; without it the polar drift
  gave nonsense lags. Sun-visible flag near the pole peaks at 23.6–29.5 d — documented finding,
  not tuned.
- Flat-horizon Sun % is far below Glaser et al. 2018 Table 1 (shackleton-rim 60.5 % vs 85.5 %,
  connecting-ridge 57.8 % vs 81.3 %): expected, terrain horizon not in this data.

## 10. Frontend (minimal, brief item 9)
- App.tsx assumed sample 0 = earliest landing date. Now: default/min landing date =
  `meta.landing_min_utc`, max = min(`landing_max_utc`, last date a window fits); date input and
  landing-chart clicks are clamped to that range. Footer says DE440 and the real ranges.
- `types.ts`: optional `version`, `landing_min_utc`, `landing_max_utc`, site `status`, `uncertainty_m`.
- Not changed: LandingChart's x-axis now starts 2026-09-01 (clicks before 15 Nov clamp to 15 Nov).
