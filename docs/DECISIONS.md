# Decisions

Every open call made during the autonomous upgrade run, with options, choice and reason, grouped by area.
Merged from `docs/decisions/*.md` by `py -3 docs/tools/merge_decisions.py`; the originals are kept and remain the source of truth.

Contents: Data and ephemeris; Visibility engine and verdicts; Terrain (LOLA horizons); Controls and parameters (UI); Heatmap (UI); Sky chart (UI); Documentation, CI and licensing.


## Data and ephemeris

_Source: `docs/decisions/data-v2.md`_

### Decisions — data-v2 (2026-11-14, autonomous run)

Every choice made without asking, with the reason. Numbers are measured; sources named.

#### 1. Ephemeris, kernels, frame
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

#### 2. Data range and landing window
- Hourly 2026-09-01T00Z → 2029-01-01T00Z, both ends included: 20473 samples.
- landing_min = 2026-11-15T00Z (brief). landing_max = end − 365 d − 30 d = **2027-12-03T00Z**
  (a 1-year window plus a 30-day pad must fit inside the data).
- Data starts 75 d before landing_min (> 1 synodic month) so charts have context.

#### 3. Sites
- `backend/sites.json` replaced with the 7 entries of the lead's `sites-v2.json`, fields unchanged
  ("shackleton" → "peak-near-shackleton").
- `status` and `uncertainty_m` pass straight through. Default mapping only when a site lacks
  `status` (`compute.DEFAULT_STATUS`): shackleton / peak-near-shackleton → candidate, im1/im2 →
  landing, anything else → candidate. Missing `uncertainty_m` → null. Status validated against
  candidate/target/landing. All 7 v2 entries carry both fields, so the defaults are unused today.
- Regenerate: `cd backend && .venv/Scripts/python.exe compute.py` (~8 s).

#### 4. New hourly arrays
- `sun_radius_deg`, `earth_radius_deg`: angular radius seen from the **Moon's centre** (one array for
  all sites). Measured site-vs-centre difference: Sun ≤ 0.002", Earth 2.1–4.9" (IM-1 largest) —
  negligible against the 1-dp chart and the 0.25° horizon mask. R_sun 695700 km, R_earth 6371 km.
- `dsn_moon_el_max`: max geometric Moon elevation over DSS 14 / 43 / 63, **no refraction**
  (it gates a ≥ 10° coverage rule; refraction at 10° is ~5', irrelevant at 1-dp storage).
- **DSN coordinates:** the lead's decimals (e.g. DSS-14 35.2443523) are 810-005 Module 301 Rev K
  **Table 6 geocentric** latitudes. Fed to WGS 84 as geodetic they miss Table 2 XYZ by 20,145 m.
  Used **Table 5 geodetic** DMS instead (`backend/dsn.py`); `test_dsn.py` proves < 1 m against
  Table 2 and goes red (20 km miss) with the lead's values. Heights are the lead's (they match Table 5).

#### 5. Storage precision / size
- alt 3 dp, az 1 dp. Reason (`docs/validation/interpolation.md`): 2 dp alt shifts polar Sun 0°
  crossings by up to 35.4 min; 3 dp by ≤ 2.4 min. Az only selects a 0.25° horizon column.
- sky.json = 3.85 MB raw (over the 3 MB guideline), ~0.9 MB gzip; GitHub Pages serves it gzip
  (checked: Content-Encoding gzip). Accepted for the accuracy.

#### 6. vectors.bin / ephem.ts
- Regenerated (start 2026-09-01, 20473 records, 491,352 bytes); layout unchanged, so `ephem.ts`
  not touched. `check_vectors.py`: OK, max |Δalt| 0.00003°, 0 visibility hours differ.
- **Flag for the engine agent:** `ephem.ts computeSite` still rounds alt to 2 dp (35-min crossing
  error at the pole, see §5). Left alone per the brief.

#### 7. 10-minute fixtures
- `tenmin-peak-near-shackleton.json`, `tenmin-im2.json` (~238 KB each, 3 dp): 60 d from
  **2027-01-01**, not 2026-11-15, because from 15 Nov the polar Sun never sets for ~60 d (no
  crossings to time). Catmull-Rom on full-precision hourly data: alt error < 0.0001', crossing
  timing 0.00 min; on 3-dp data ≤ 0.036' and ≤ 2.42 min.

#### 8. Horizons validation
- 218 instants per site and body (200 regular + perigee/apogee, Sun-latitude and libration
  extremes), all 7 sites. Max difference 2.7e-05' (1.6e-03"). PASS.
- Tolerance 0.05' el / 1' az fixed **before** the run: polar Sun rises at a median 0.0070°/h, so
  0.05' ≈ 7 min of sunrise timing; az only picks a 0.25° mask column.
- Horizons silently truncates long TLISTs (218 → 80 rows): requests chunked at 50 with a row-count
  check; 1 s between requests; raw replies cached and committed (`backend/data/horizons-cache/`,
  70 files, 824 KB) so `--offline` re-runs exactly.
- Sensitivity: site moved 0.002° lat → 0.082' → FAIL (the check can go red).

#### 9. Sanity (docs/SANITY.md)
- Sun-altitude autocorrelation peaks 29.51–29.56 d at every site (pytest asserts 29.53 ± 0.1 at
  the polar ones). Series are high-passed with a 709 h boxcar first; without it the polar drift
  gave nonsense lags. Sun-visible flag near the pole peaks at 23.6–29.5 d — documented finding,
  not tuned.
- Flat-horizon Sun % is far below Glaser et al. 2018 Table 1 (shackleton-rim 60.5 % vs 85.5 %,
  connecting-ridge 57.8 % vs 81.3 %): expected, terrain horizon not in this data.

#### 10. Frontend (minimal, brief item 9)
- App.tsx assumed sample 0 = earliest landing date. Now: default/min landing date =
  `meta.landing_min_utc`, max = min(`landing_max_utc`, last date a window fits); date input and
  landing-chart clicks are clamped to that range. Footer says DE440 and the real ranges.
- `types.ts`: optional `version`, `landing_min_utc`, `landing_max_utc`, site `status`, `uncertainty_m`.
- Not changed: LandingChart's x-axis now starts 2026-09-01 (clicks before 15 Nov clamp to 15 Nov).


## Visibility engine and verdicts

_Source: `docs/decisions/engine.md`_

### Engine branch: decisions

Branch `engine`. Made during an unattended run with no questions asked, so each choice and its reason is recorded here.
Code is in `frontend/src/lib`. Verdict rules are in `docs/VERDICT.md`.

#### Defaults (`lib/params.ts`, `DEFAULT_PARAMS`)

| Setting | Default | Why |
|---|---|---|
| Observer height | 2 m | Typical lander deck or antenna height (spec 4.3). Choices: 0, 2 and 5 m. |
| Mask offset | 0° | The raw skyline. Choices: 0, 3, 5 and 10°. |
| Sun rule | upper limb | First light reaches panels when the top edge of the Sun clears the skyline. |
| Earth rule | centre | Matches the old app and the usual line-of-sight definition. |
| DSN | on, 10° | A link needs a Deep Space Network dish that sees the Moon at 10° or more. |

- App state holds one `Params` object. There is no parameter UI yet: the brief asked for none.
- `LEGACY` in `lib/testFixtures.ts` is the old app's model: flat 0°, centre of disc, no height, no DSN. It is used only for the before/after check.

#### Model choices

- **Interpolation.**
  - Altitude uses Catmull-Rom at 6 substeps (10 min).
  - Azimuth uses the same method, unwrapped across 0/360.
  - Radii and DSN elevation are interpolated linearly: they change slowly, so linear is enough.
  - The last hourly segment uses a clamped end point.
- **Horizon.** A disc's skyline is the highest point across its full width (`maxMaskOverDisc`). This is the conservative choice: a disc partly behind a peak counts as hidden.
- **Heights.**
  - `horizons.json` gives tables for a few observer heights.
  - Between two tables the skyline is interpolated in a straight line.
  - Outside the range, the nearest table is used (clamped, not extrapolated).
- **Flat fallback.**
  - A site without a terrain mask gets a flat skyline, lowered by the dip for its observer height, plus the offset.
  - That site is marked `terrain: false`. The verdict is then provisional and the card chip shows "Flat horizon · provisional".
  - The spec 6.4 warning appears in the chip's title and aria-label, and in the caveats banner.
- **Whole-data timeline.**
  - Each site's intervals are computed once over the whole data range. Cards, the landing chart and the after-landing lines are all cut from that one timeline, so they always agree.
  - Results are memoised (LRU of 48) by data version, site and params.
- **Censoring.**
  - A run that touches either edge of the data is `at_least`.
  - A night already going at landing is counted in full (spec 6.1).
  - The card flags that night with "already dark at landing; X of it after landing" (audit B4).
- **Radii.**
  - The Sun and Earth radius arrays from sky.json v2 are used hour by hour.
  - v1 files fall back to the mean radii (Sun 0.2666°), with one console warning.
- **Time-axis guard.**
  - `vectorsMismatch` refuses custom sites when vectors.json and sky.json differ in start, step or count.
  - It names both start times in the message.

#### Verdict choices (detail in `docs/VERDICT.md`)

- **Margins:** 2 points for energy, comms and Balanced; 24 h for nights. Margins are compared on the 0.1-rounded values the cards show.
- **Balanced floor (audit B2):** no Balanced badge below a worst-case score of 25.
- **Night score:** measured against one synodic month (708.7 h), never against the other sites, so scores are independent of who is on the page.
- **Censored nights:** an `at_least` night blocks a night call unless its bound is already 24 h longer than the leader. It scores 0 in Balanced and is never starred.
- **Balanced eligibility:** open to every site. The old rule was "sites without another badge only". With an absolute floor, that exclusion is no longer needed.
- **Too-close banner:** comes from the `comparable` and `undetermined` outcomes, with the group named.
- **Site-agnostic:** no site ids appear in the engine or the verdict. A test runs 7 sites (`verdict.test.ts` case 17, and `v2data.test.ts`).

#### Audit items

- **B2:** Balanced floor, above.
- **B3: no silent date clamping.**
  - `windowFor` returns `clamped: 'before_range' | 'after_range' | 'invalid'`. The page then shows a note saying which date was used.
  - data-v2's `pickDay` silently clamped a picked date. It is not adopted, because it conflicts with B3.
- **B4:** night already in progress, above.
- **B5: no false precision.**
  - Durations go through `fmtDuration`.
  - Clock times go through `fmtUtcHour`, rounded to the hour ("about 03:00 UTC").
  - The 'next' explanation says why: 0.1° of horizon moves a Shackleton crossing about 10 h.
- **B10: latitude at ±90.**
  - `computeSite` throws beyond ±89.99° (`MAX_ABS_LAT_DEG`), because azimuth is undefined at the pole.
  - The input's native min/max blocks submit first, so the engine's message is not shown in the browser. The headless render confirmed this: no message appeared.
- **Shackleton sensitivity:**
  - The Sun climbs about 0.010°/h there, so 0.1° of horizon is about 10 h of crossing time.
  - The old 'close' text compared our site with Mazarico's real Shackleton rim. It was replaced with this sensitivity statement.
  - A new 'flat' text explains LOLA versus the flat fallback.

#### ephem.ts: full altitude precision

- Custom-site altitude used to be rounded to 2 dp. Near the pole that moves a crossing by up to 35 min (0.005° ÷ 0.009°/h).
- Altitude is now kept at full precision. Azimuth is still rounded to 1 dp.
- The test compares against an analytic asin to 1e-6. It was red on the old code.

#### 10-minute interpolation error (`lib/tenmin.test.ts`)

- **Fixtures:** data-v2 `backend/tenmin.py`. Sun and Earth positions every 10 min for 60 days, at im2 and peak-near-shackleton, written to 3 dp.
- **Method:** take every 6th sample, round it the way sky.json does, upsample, then compare.

| Hourly input | Altitude max | Azimuth inside | Azimuth last hour | Crossing max |
|---|---|---|---|---|
| Full / 3 dp (sky.json v2) | 0.0031° | ≤ 0.001° | ≤ 0.038° | 2.8 min |
| az rounded to 1 dp (v1 and v2) | — | 0.056° | 0.084° | — |
| alt 2 dp (sky.json v1) | 0.0087° | — | — | up to 35 min (Sun at pns, 0.009°/h) |

- The fixtures hold only 3 dp, so error below about 0.0005° cannot be measured.
- Cubic and linear interpolation cannot be told apart at this accuracy. A linear-interpolation sabotage stayed green. A one-substep time shift went red.
- The v1 crossing error comes from rounding, not from interpolation. Its bound scales with the local rate.

#### Before / after numbers

**v1 sky.json** (audit baseline, `lib/baseline.test.ts`):

- With `LEGACY` params the engine reproduces the old Sun % and Earth % within 0.3 points, and night lengths within 2 h, for every baseline config.
- Default params, 1 year from 2026-11-15:
  - Shackleton: Sun 59.8 %, longest dark 1368 h.
  - Verdict: energy Shackleton; comms, night and Balanced IM-1.
- Legacy params, same window:
  - energy too close to call;
  - comms, night and Balanced IM-1.

**v2 sky.json** (data-v2 934292e, 7 sites, flat horizon; `lib/v2data.test.ts`):

- Building 7 timelines takes 112 ms.
- Default params, 365 d from 2026-11-15:

  | Site | Sun % | Link % | Longest dark |
  |---|---|---|---|
  | de-gerlache-rim-2 | 61.9 | — | 560.5 h |
  | peak-near-shackleton | 59.6 | 46.1 | 1372 h |
  | shackleton-rim | 57.0 | — | 3765 h |
  | im2 | 53.8 | 73.6 | 404.6 h |
  | im1 | 52.4 | 99.0 | 380 h |

  - Verdict: energy de-gerlache-rim-2; comms im1; night too close [im1, nobile-rim-2]; Balanced im1.
  - Provisional, because every site is flat.
- Default params, 30 d:
  - energy too close between 4 rim sites (each at 100 %);
  - comms im1;
  - Balanced too close [im2, nobile-rim-2].
- Rerun: `ENGINE_SKY_V2=<path to v2 sky.json> ENGINE_V2_PRINT=<out.txt> npx vitest run src/lib/v2data.test.ts`.

#### Headless render (Playwright, vite preview)

- **v1 data:**
  - cards, badges, DSN-missing caveat and provisional banner present;
  - clamp note shown for 2020-01-01;
  - 30-day view shows "already dark at landing";
  - custom site added;
  - no page errors.
- **v2 data** (copied in temporarily, not committed):
  - period "15 Nov 2026 → 15 Nov 2027";
  - the too-close banner names groups;
  - link rows and after-landing times present;
  - no page errors.
  - With the old v1 `vectors.json`, custom sites are correctly refused (start time mismatch).
  - With data-v2's `vectors.json`/`vectors.bin`, a custom site was added (4 cards).

#### Merge notes for the lead

- **App.tsx:**
  - Take engine's version.
  - data-v2's `landingRange` is superseded by `lib/window` (`landingRangeH`, `defaultLandingDay`), which already reads `landing_min_utc`/`landing_max_utc`.
  - Drop `pickDay`: B3 requires a visible note, not a silent clamp.
- **Footer:**
  - Take data-v2's text: DE440, "within 0.002 arcseconds", landing dates.
  - Engine kept the DE421 wording because this branch still ships the v1 data, and the DE440 claim would be false here.
- **public/vectors.\*:** must come from data-v2 together with its sky.json. Otherwise custom sites are refused by the guard.

#### Other notes

- `npx tsc --noEmit -p .` checks nothing: the root tsconfig only holds references. Use `npx tsc -b`.
- Commit 9b6e75f also contains the deletion of the old `metrics.ts`, `landing.ts` and `events.ts`, so it does not build on its own. d87a258 builds. History was not rewritten.
- Default compared sites are still `d.sites.slice(0, 3)`, as before.
- SkyChart's own "flat horizon" labels were left for the lola-terrain agent.
- Old tests were ported by intent into `lib/ported.test.ts`:
  - altitude exactly 0 is never up;
  - a rise from 0 is placed correctly;
  - non-1 h `step_hours`;
  - one site can hold all four badges.
- **Break-one-thing checks** (each went red, then was restored):
  - margin `>=` changed to `>`;
  - censored nights never block;
  - data-end run not censored;
  - data-start run not censored;
  - old ephem 2-dp rounding;
  - a one-substep interpolation shift.


## Terrain (LOLA horizons)

_Source: `docs/decisions/lola.md`_

### Decisions: LOLA terrain horizons (agent "lola", branch lola-terrain)

1. **DEM products** (superseded in part by item 16: the near and mid bands now use the
   float versions of the same grids). Options: the float32 grids (2x size), the 10 m 85 S
   grid, the 30 m 75 S grid, or the int16 set 5 m (87.5 S) + 20 m (80 S) + 60 m (75 S) +
   240 m (60 S). First chose the int16 set (4.3 GB total), reasoning that 0.5 m steps are
   fine for horizons (0.5 m at 1 km is 0.03 deg) -- true far out, wrong at 5-50 m (item
   16). Coverage reasoning still holds: the 5 m grid covers every site within
   1.5 deg of the pole, the 20 m grid covers all 80-90 S sites, and the two coarse grids
   cover the long sight lines. The 30 m 75 S grid (1.86 GB) would only help the
   northern half of IM-1's first 10 km; skipped, IM-1 falls back to 60 m there and its
   landing position is itself uncertain by ~1.5 km.
2. **Range bands.** Near 0-10 km: finest grid covering the site (step 5 or 20 m).
   10-60 km: 60 m. Beyond: 240 m. Ray step = pixel size of the band's grid, so every
   pixel along the ray is visited and the coarse grids are not under-sampled. A point
   missing from the band's first grid falls back to the next coarser grid.
3. **R_max: per-ray stopping rule, not one fixed number.** A ray stops when a worst-case
   peak at 7027 m (the highest DN in any product used) at that range would sit below
   the horizon already found on every ray, and that worst-case angle is falling with
   range. This is exact (no terrain beyond can matter) and covers the spec's criterion
   "curvature drop exceeds the highest terrain". Hard cap 600 km (inside the 240 m
   grid's coverage); reaching it is reported as a warning. horizons.json meta.r_max_km
   is the largest stop distance over all sites.
4. **Exact geometry, 3-D.** Rays are built as true great circles in the Moon-fixed
   frame (p = cos(theta) u + sin(theta) t), elevation angle =
   atan2(r_t cos(theta) - r_o, r_t sin(theta)). Rays never use map-plane azimuths, so
   the pole singularity and map distortion cannot enter the azimuth.
5. **Azimuth convention** = Skyfield altaz (north toward the lunar north pole along
   the meridian, clockwise). Verified to < 0.05 deg against Skyfield's own altaz of a
   surface point 20 km away, at three sites (test_geometry.py).
6. **Projection.** Own forward/inverse (no pyproj: not installed, and the LOLA sphere
   projection is 4 lines). Followed the catalogue's forward formula; its printed inverse
   is inconsistent for X (documented in data/README.md) and the choice is checked on
   real terrain (Shackleton floor at the gazetteer position, mirror point high).
7. **Interpolation**: bilinear (4 pixel centres). Bicubic would overshoot at crater
   rims; at one-pixel ray steps bilinear is the standard choice (Mazarico et al. 2011
   use bilinear-type horizon sampling as far as we know; not verified).
8. **Datum**: heights are radius - 1737400 m, as in the labels; the observer is at
   R + ground + h_obs. No geoid applied (horizon geometry needs radii, not potential).
9. **Observer heights**: 0, 2, 5 m precomputed (no height-correction model).
10. **Rounding**: 2 decimals to nearest (0.005 deg is 0.4 m at 5 km); file < 1.5 MB.
11. **No multiprocessing.** NumPy vectorised over all azimuths at once; extra processes
   would each map the DEMs and the machine often has ~1 GB free. Run time is measured
   and reported in docs/TERRAIN.md instead.
12. **Site ids.** horizons.json holds every id from backend/sites.json and the lead's
   sites-v2.json (7 verified sites). The old id "shackleton" (-89.0051, 125.3093) is the
   same point as "peak-near-shackleton" (-89.00506, 125.3093; 4 m apart from rounding);
   both are computed and written so main's current UI and the v2 list both find a
   profile. backend/sites.json itself is not edited here (the lead owns the site list);
   run with `--sites <path to sites-v2.json>`.
13. **Sun statistics for validation** use the v1 constant Sun radius 0.2666 deg and
   linear 10-min interpolation (as the brief says); the engine's cubic interpolation
   may differ by a few tenths of a percent.
14. **Literature comparison** uses Glaser et al.'s exact points and period (2017-2037)
   computed with the same Skyfield method as sky.json, so period differences cannot
   explain disagreements. No parameter was adjusted after seeing the comparison.
15. **Per-site in-RAM DEM windows.** The DEMs sit on a spinning disk; random memmap
   reads made one cold horizon take 224 s (Shackleton rim). Options: multiprocessing
   (more RAM, same disk), downsampled caches (changes the data), or one contiguous read
   per site of a square window around it (band radius + 2 km margin, scaled by the
   stereographic scale factor so map distance always covers ground distance). Chose
   windows (~150 MB per site). Measured: windows 98 s cold read, horizon 1.2 s; result
   identical to the full-grid memmap path (max |diff| 0.000000 deg at Shackleton rim),
   and test_dem_real checks bit-identical sampling plus NaN outside the window.
16. **Float grids for the near and mid bands (bug found in validation, fixed).** The first
   full run (int16 grids) gave Shackleton S at surface level 52.9 % Sun visible against
   Glaser et al.'s 85.5 %, and the panoramas showed the 0 m horizon at exactly 0.00 deg on
   62 % of azimuths at Shackleton rim. Cause, measured: the int16 grids store heights in
   0.5 m steps (truncated); around the site the 5 m grid is flat 0.5 m plateaus, and a
   0.5 m step at 5 m range is a 5.7 deg fake slope. Options: smooth the DEM, skip the first
   N metres, or use the float32 versions of the same grids (PDS float_img/, V2.1). Chose
   the floats: same data without rounding, no tunable parameter. Cost: 8.3 GB download
   (5, 20, 60 m floats). The 240 m int16 grid stays for > 60 km (0.5 m there is < 0.0005
   deg). The literature numbers were NOT the target: the fix was chosen from the cause,
   and the after-fix comparison is reported as it comes out (docs/TERRAIN.md).
17. **Second, independent reference: the LOLA team's average-visibility map**
   (AVGVISIB_85S_060M_201608, PDS extras, 51 MB, MD5-checked; Mazarico et al. 2011 method,
   60 m DEM, surface level, "sunlit by any fraction of the disc"). Options: literature
   tables only, or also this map. Chose to add it: it is cheap, covers every site south
   of ~85 S, and was produced by different code from a different DEM, so agreement with it
   is real corroboration. It is read by `horizon.mazarico_ref` and only reported; nothing
   is fitted to it. Its period is not stated in the label, so differences of a few percent
   are expected for that reason alone.
18. **Sabotage check found a test gap (fixed).** Breaking "upper limb" to "Sun centre"
   (`vis = a > h`) left every test green. Added test_visible_means_upper_limb_not_centre
   (Sun centre 0.1 deg below a flat horizon must count as visible); that arm is now red.
19. **Keep the 5 m near band, even though 20 m matches the literature better at 0 m.**
   Validation found 0 m results are resolution-dependent: Glaser's points at 0 m give
   71.7 / 40.7 / 43.4 % Sun-visible with the 5 m near band and 83.9 / 74.4 / 78.6 % with a
   20 m near band (Glaser: 85.5 / 81.3 / 80.6 %). Options: switch the shipped near band to
   20 m, or keep 5 m and report it. Kept 5 m: switching after seeing the comparison would
   be tuning toward the expected number, and 5 m is the more detailed data. The 2 m and
   5 m results move much less with resolution, so docs/TERRAIN.md recommends them; the
   20 m variant is in docs/terrain-validation.json for anyone who wants it.


## Controls and parameters (UI)

_Source: `docs/decisions/controls.md`_

### Decisions: controls branch (parameter controls, worker, sensitivity, shareable URL, footer)

Branch `controls`, based on `integration` @ 55d5c59. Made during an unattended overnight run
with no questions asked; each open call, the options and the reason are recorded here.

#### Parameter controls (`frontend/src/Controls.tsx`)

- **Which params get a control:** observer height, mask offset, Earth rule, DSN switch, DSN minimum
  elevation (as the brief lists). The Sun rule (`upper_limb` / `centre`) gets **no** control and
  is not in the URL: the brief did not ask for it, and a link must not change a number the page
  gives no way to see or undo.
- **Choices** are exactly the engine's tested lists (`HEIGHT_CHOICES_M`, `MASK_OFFSET_CHOICES_DEG`,
  `DSN_EL_CHOICES_DEG`, three Earth rules). Defaults come from `DEFAULT_PARAMS` and are printed
  under the controls.
- **Segmented buttons, not sliders or selects:** every choice is visible at once, matches the
  existing "Look ahead" control, works with keyboard and touch, and `aria-pressed` states it.
- **DSN data missing (v1 sky.json):** the DSN switch is disabled and shows "Off" with a note; the
  DSN angle is disabled whenever the switch is off (it cannot change anything then).
- **Wording:** "Lander height" instead of "observer height", "Horizon safety margin" instead of
  "mask offset", "Lowest DSN dish angle" instead of "minimum DSN elevation". The "?" notes define
  DSN and say real links also need booked dish time and signal strength (not modelled).
- The claim in the margin note that "even 3° can remove a lot of sunlight" was checked on the
  real data before shipping: Shackleton rim, 1 year from 15 Nov 2026, flat horizon, Sun 57.0% at
  0° and 0.0% at 3° (headless render check, below).

#### Web Worker (`frontend/src/worker/`)

- **Layout:** `compute.ts` (pure, shared by both paths), `protocol.ts` (message types + the
  handler as plain code, so vitest drives it without a worker), `engine.worker.ts` (12-line shim),
  `client.ts` (`EngineClient`), `useEngine.ts` (React hooks).
- **Data transfer:** the parsed sky.json (and horizons.json) is posted to the worker **once** at
  start. Rejected: the worker fetching the file itself (a second parse, and two copies that could
  differ). Requests then carry only site ids + params; a custom site travels whole because it is
  not in sky.json.
- **Fallback:** `EngineClient` uses the same functions on the main thread when `Worker` is missing,
  when construction throws, or when the worker raises an error; outstanding requests are replayed
  on the main thread. Verified in headless Chromium by blocking the worker script: the cards,
  a param change and the full sensitivity table all still worked.
- **Replace, not queue:** each answer is tagged with the request key; a late answer for old
  params is dropped. The sensitivity runner yields between variants, so a newer table request
  (or a cancel) takes effect at the next variant, and rows appear progressively.
- **Separate cache for the table:** the table builds up to 13 timelines per site; it keeps its
  own LRU (160) so it cannot evict the cards' timelines from the engine's LRU (48).
- **`?engine=sync`** in the page address (query, not the shareable hash) forces the main-thread
  path. It exists for the measurement below and as a debugging switch.
- **Load:** `useSkyData` now loads sky.json/horizons.json and creates the client in the same
  promise callback (moved from App.tsx), so no state is set synchronously inside an effect.

##### Measurement (headless Chromium, built site via `vite preview`, 2026-11-14)

Time from clicking "Horizon safety margin 3°" to the new Sun % painted (first animation frame
after the cards change), 7 sites × 1 year, each run a fresh page (empty caches), median of 5.
Script: scratchpad `controls/perf.cjs`.

| Path | Runs (ms) | Median | Longest main-thread block (median) | Frames drawn while waiting |
|---|---|---|---|---|
| Worker | 121, 107, 124, 108, 97 | **108 ms** | **0 ms** (no long task) | 5–6 |
| Main thread (`?engine=sync`) | 139, 160, 126, 140, 146 | **140 ms** | **109 ms** | 2 |

The worker is both a little faster to the new numbers and, more importantly, never blocks the
page (no long task ≥ 50 ms; the page keeps drawing frames while it computes). Caveat: other
agents were running builds on the same PC, so absolute times are noisy; the comparison was run
back-to-back under the same load. The landing-date chart's Plotly redraw is not included in
either number (it happens after the cards update, in both paths).

#### Sensitivity table (`frontend/src/Sensitivity.tsx`)

- **Orientation:** rows = settings tried (grouped by parameter), columns = sites. The spec's
  "rows = sites, columns = variations" gives 13 columns × 3 numbers, unreadable on a phone. The
  table scrolls sideways inside its own box; the page itself has no horizontal scroll at 375 px
  (measured: 0 px overflow).
- **One parameter at a time**, the others at the current values; the current value's row in each
  group is marked "now". With the DSN switch off the DSN angle rows are not computed (they could
  not change anything) and a line says so.
- **Verdict marker:** a row is marked "Energy pick changes" / "Comms pick changes" when the
  "Best for energy" / "Best for communication" outcome differs from the current settings' outcome,
  including a change between a winner and "too close to call" (spec 6.6 names these two labels).
  A summary line lists the settings that flip them, or says they stay the same in every case.
- **Spread line per site:** lowest and highest Sun % and longest night across all rows, with "≥"
  kept for nights that run to the data edge.
- **Lazy:** computed only while the section is open (closed by default), so first load and the
  recompute measurement above do not pay for it.
- **The slow-Sun point:** the intro text uses the audit's figure (Sun crosses the skyline at about
  0.01°/h near Shackleton, so 0.1° of skyline moves a sunrise by about 10 h), the same figure
  already in `explanations.ts` (`close`). On the current flat-horizon data, Shackleton rim's
  longest night moves 159.4 → 156.9 → 155.3 days across lander height 0/2/5 m (horizon dip steps of about 0.09° and 0.05°
  ), and goes from 156.9 days to "≥ 853 days" (whole data range) with a 3° margin.

#### Shareable URL (`frontend/src/url.ts`, `frontend/src/useShareState.ts`)

- **Hash, not query:** `#d=2026-11-15&w=365&s=shackleton-rim,im2,im1&g=...&h=2&m=0&e=centre&dsn=1&del=10[&lat=..&lon=..]`.
  The hash never reaches the server (GitHub Pages) and never triggers a reload.
- **Always live:** the address bar is kept equal to the screen with `history.replaceState` (no
  history entries), so copying the address bar also works; "Copy link" copies it, with a
  read-only text box fallback when the clipboard is blocked. A new link pasted into the same tab
  is applied on `hashchange`.
- **Every field written** (not only non-defaults), so a link keeps its meaning if defaults change.
- **Strict parsing, never throws:** unknown keys ignored; numbers must be plain integers with no
  leading zeros and in the whitelist; Earth rule whitelisted; DSN `0`/`1` only; dates must match
  `YYYY-MM-DD`, lie in 2000–2100 and round-trip (rejects 2027-02-30); site ids must match
  `^[a-z0-9][a-z0-9-]{0,47}$`, at most 12, deduplicated, and are then matched against the loaded
  sites (fewer than 2 known → default comparison); lat/lon must be plain decimals (no exponent,
  hex, Infinity) inside the custom-site limits; hashes over 2000 characters are ignored. A bad
  value falls back to its default; the rest of the link still applies. The landing date is then
  clamped by the existing `windowFor`, which shows its usual note.
- **No HTML injection:** URL values are only ever used as React text or matched ids. Headless
  check with `<script>`, `<img onerror>`, `__proto__`, broken `%` escapes: defaults rendered, no
  dialog, no injected elements, no console errors.
- **Custom location in a link** is recomputed from vectors.bin on load (same code as "Add to
  comparison"); if that fails, it is dropped from the comparison and a note says why.

#### Default comparison

`shackleton-rim`, `im2`, `im1` (looked up by id). If any is missing, the first three sites. The
sky-graph site default is unchanged (first site in sky.json): the brief did not ask to change it.

#### Footer

- "Horizon: flat horizon" or "Horizon: LOLA terrain horizons", decided by whether horizons.json
  loaded (replaces the raw `meta.horizon` string).
- Version stamp: `Build <short commit> · data version <meta.version> · data generated <date>`.
  The commit comes from `git rev-parse --short HEAD` at build time via a Vite `define`
  (`__BUILD_COMMIT__`, declared in `src/build.d.ts`), "dev" if git fails. Note: it is the commit
  checked out when the site was built, so a deploy built from main shows main's commit.
- Disclaimer: "Not an official NASA product. Built for the NASA Space Apps Challenge 2026."

#### Files touched outside the brief's list

- `frontend/vite.config.ts` (the `define` for the build commit; there is no other way to inject
  it) and new `frontend/src/build.d.ts`, `frontend/src/useShareState.ts` (hook extracted to keep
  App.tsx small), `frontend/src/controls.css`. Compare.tsx, SkyChart.tsx, explanations.ts and
  index.css are untouched.


## Heatmap (UI)

_Source: `docs/decisions/heatmap.md`_

### Heatmap branch: decisions

Branch `heatmap`, from `integration` @ 55d5c59. Spec Phase 2 (8.1 heatmap, 8.3 mission framing, 8.4 compare
dates, 8.5 presets). Made during an unattended run, so each open call and its reason is written here.
Only new files were added; nothing existing was edited. The lead mounts the components in `App.tsx`.

#### Files

| File | What |
|---|---|
| `frontend/src/lib/heatmapData.ts` | Grid of one metric per site per landing day; best-10% mask; best-day picks |
| `frontend/src/lib/heatmapColor.ts` | Viridis scale, legend ticks |
| `frontend/src/heatmapDraw.ts` | Canvas drawing and hit-testing |
| `frontend/src/Heatmap.tsx` | The heatmap component |
| `frontend/src/CompareDates.tsx`, `lib/dateDelta.ts` | Two dates for one site, B minus A |
| `frontend/src/presets.ts`, `PresetPicker.tsx` | Named Params presets and the drop-down |
| `frontend/src/MissionFraming.tsx` | "What a lander needs / what this tool is and is not" |
| `frontend/src/heatmapText.ts`, `heatmap.css` | Plain-language strings and styles for all of the above |

#### Heatmap (spec 8.1)

- **Layout: rows = sites, columns = landing days** (the lead's brief), not one site with x = date / y = metric.
  All sites at once shows both "when" and "where" in one picture. The metric is a selector (Sun visible,
  link available, longest darkness), not three small multiples: three 7 x 384 grids would not fit a phone.
- **Landing days:** every whole UTC day from the first landing day (`defaultLandingDay`) to the last start
  that leaves room for the look-ahead. Same rule as the existing landing-date chart (`sunPctByDay`): a day
  whose window would run past the data is left out, never clamped. With sky.json v2 that is
  15 Nov 2026 to 3 Dec 2027, 384 days, for both look-aheads.
- **Look-ahead: 30 days (default) or 1 year,** its own control inside the heatmap. Default 30 days because
  a 1-year window from any day covers nearly the same year, so the 1-year colours hardly change along a
  row. The page says so in a note when 1 year is picked.
- **Same numbers as the cards.** Each cell is cut from `siteTimeline` with `clampWindow` and the same 0.1
  rounding as `windowMetrics`; darkness is `longestRun` (full night length, censored at the data edges).
  `heatmapData.test.ts` checks every cell against `windowMetrics` on synthetic data, and a sample of cells
  on the real sky.json v2.
- **Speed, measured.** 7 sites x 384 days, default params, timelines not yet cached:
  - headless Chromium (Vite dev build, harness page): 70 to 86 ms cold over 4 runs; 5 to 8 ms for a second
    metric once timelines are cached (1-year darkness); 1 to 2 ms for 30-day link.
  - Node (vitest, real sky.json v2): 95 ms cold, 8 ms warm.
  - So it runs in `useMemo` on the main thread. **Not done: Web Worker and IndexedDB cache (spec 8.1
    "Performance").** Under 0.1 s does not justify a worker plus cache-invalidation code. The timelines
    are shared with the cards through the engine's LRU (48 entries), so the app's own sites are usually
    already built.
- **Canvas, not SVG or Plotly.** ~2,700 cells: one canvas is the lightest. Plotly heatmap would add its
  hover machinery and still need a custom keyboard layer.
- **Keyboard and screen readers.** The canvas sits in one focusable wrapper (`role="application"`,
  `aria-roledescription="heatmap"`) so the arrow keys belong to the widget. Arrow keys move a cursor,
  Page Up/Down jump 30 days, Home/End go to the ends, Enter or Space calls `onPickDate(iso)`. A polite
  live region reads the cursor cell, e.g. "Connecting Ridge, 20 Nov 2026: Sun 100.0% (best 10%)".
  Percentages use one decimal, like the cards. A visible readout shows the hovered or cursor cell.
  Checked in headless Chromium: focus, 5 x ArrowRight, ArrowDown, Enter picked 2026-11-20 from a start
  of 2026-11-15; a mouse click on row 1, day 100 picked 2027-02-23.
- **Colour: viridis, bright = better.** Viridis is perceptually even and stays readable with the common
  colour-blindness types and in greyscale. More Sun or link is brighter; for darkness the scale is
  flipped so a shorter night is brighter (dark colour for a long night reads naturally). The legend says
  "less ... more · better" or "longer ... shorter · better" with ticks in % or days.
- **Fixed % scale, 0 to 100.** Not stretched to the data: stretching would make a 1-point difference
  look dramatic, and this project's own verdict calls anything under 2 points too close. Darkness runs
  from 0 to the longest night in the grid, rounded up to a whole day.
- **Best windows: best 10% of each row for the metric shown,** marked by a white strip under the cells.
  Not a composite score: a composite needs weights between Sun, link and night, which we would have to
  invent. Censored nights are never "best". A row whose best-to-worst spread is under the verdict margin
  (2 points, or 24 h for nights) gets no strip and the sentence says the date makes little difference.
- **Censored cells** (longest night touches the data edge) are hatched, legend item included. With the
  default params no cell is censored in the supported range; the Cautious preset shows them (below).
- **Recommendation** follows the cursor's row (starts on `siteId` if given): up to 3 dates, the best day
  of each separate best-10% run so it is not three neighbouring days, each with "Use this date". When
  every cell in the row is censored it says the dates cannot be ranked.
- **Flat horizon:** each flat-horizon row gets an orange `*` and the recommendation repeats
  `FLAT_WARNING`. When DSN data is missing, the link metric is labelled Earth visible.

#### Compare dates (spec 8.4)

- Props: `{ ed, site, params, days, dateA, dateB, onChange(dateA, dateB), explainAll? }`. A `site`
  object rather than `siteId` + `data`, so the custom site works too; `data` is `ed.sky`. `days` is
  passed in so it can follow the app's look-ahead.
- Rows: Sun visible, link (or Earth) visible, Sun and link at the same time (`bothPct`), longest
  darkness, dark at landing. B minus A, with "about the same" under the verdict margins (2 points, 1 day).
  A censored night only decides the call when its lower bound already settles it, else "cannot say".
- A date outside the landing range is moved by `windowFor` and the panel says which date was used
  (audit B3: no silent clamping).

#### Presets (spec 8.5)

- **Spec 8.5's scenarios are not used:** "Solar-powered, no battery", "Battery for one lunar night" and
  "Relay satellite available" need battery or relay modelling that `Params` does not have. A relay
  would also need a link that does not require Earth in view, which the engine cannot express. Showing
  those names over unchanged numbers would be false.
- Instead, 7 presets from real `Params` fields and only the choices the engine offers: Default; Cautious
  (5° mask, whole Earth disc); Tall mast 5 m; On the ground 0 m; Strict radio DSN ≥ 15°; Earth in view
  only (DSN off, an upper limit); Sun from its centre. Each changes only what its name says (tested).
- `PresetPicker` lives in `PresetPicker.tsx`, not `presets.ts`: a `.ts` file cannot hold JSX, and
  re-exporting it from `presets.ts` would create an import cycle.
- **Finding for the lead: any mask offset of 3° or more removes all sunlight at the sites nearest the
  pole.** The mask offset raises the skyline for the Sun as well as for Earth, and the Sun's centre never
  gets higher than 1.75° (Shackleton rim), 2.06° (Connecting Ridge), 2.55° (Peak near Shackleton) and
  3.04° (de Gerlache Rim 2) in sky.json v2 (`max(sun_alt)`, flat horizon). With the Cautious preset those
  four sites show Sun 0% and a longest night of at least 853 days (the whole data). That is what the
  engine computes for that setting, so the preset's sentence warns about it. Whether the mask offset was
  meant to apply to the Sun is an engine decision, not changed here.

#### Mission framing (spec 8.3)

- Three short boxes: what a lander needs (power from sunlight, batteries through the night, radio needs
  Earth in view and a DSN dish), what this tool is (a "what if" comparison; not an official NASA product),
  and what it is not (no heat, battery, panel-size or link-budget modelling; no landing or driving safety).
  No mission numbers.

#### Verification

- `ENGINE_SKY_V2=$PWD/public/sky.json npx vitest run`, `npx tsc -b`, `npx oxlint src`, `npm run build`:
  counts are in the agent report.
- Sabotage arms: removing the 0.1 rounding in `cellValue` turned the two percent "cells agree" tests red;
  flipping higher/lower-is-better in `bestMask` turned both best-10% tests red. Both restored.
- Visual check through a throwaway harness page (not committed): desktop 1200 px and phone 390 px
  (page `scrollWidth` 390 = no sideways page scroll; the heatmap scrolls inside its own box), no console
  errors. Not checked: a real screen reader (only the live-region text was read back).


## Sky chart (UI)

_Source: `docs/decisions/sky.md`_

### Sky branch: decisions

Branch `sky`. Unattended run, so each call is recorded here.

#### New optional props (the lead wires them in App.tsx)

`<SkyChart site span ... />` also takes, all optional:
- `horizon?: number[]` and `horizonStep?: number`: terrain skyline in degrees, index i is azimuth i*step (horizons.json `sites[id].heights[String(h)]` and `az_step_deg`). Pick the table for `params.observerHeightM`. Missing: a flat 0° line, labelled as such.
- `sunRadiusDeg?: number[]`, `earthRadiusDeg?: number[]` (`data.sun_radius_deg`, `data.earth_radius_deg`): size legend. Missing: 0.2666° and 0.95°, labelled "typical values".
- `t0Ms?: number` (`dataStartMs(data)`), `stepHours?: number` (`data.meta.step_hours`): date labels for the time colour and the table.
- `explainAll?: boolean`: opens the new "?" note under the size legend.

App.tsx text to reword (not my file): the "What am I looking at?" paragraph says "Dots in the brown band, below the 0° line, are under the horizon". The chart now shows a grey skyline (or a dashed flat line when there is no terrain data).
App.tsx site tabs are `<nav role="tablist">` with `role="tab"` buttons and no arrow-key handling. axe did not flag it, but it is not a full tabs pattern.

#### Sky graph
- Axis: -5..10° fixed (spec 11.1). Widened upward only (to the next multiple of 5) if a dot or the skyline is higher. Not widened downward: dots below -5° are counted in a note ("N dots are lower than -5°"). Rejected: widening both ways (a -7° Earth would squash the interesting 0..3° band). Audit B6 fixed: the range depends on the window and skyline, never on the 2-year stats.
- Colour by time: each body keeps its hue (Sun yellow, Earth blue) and goes darker (early) to paler (late). Rejected: one shared colour scale, because the page text and cards tie yellow to Sun and blue to Earth. Shape also differs (circle / diamond) so colour is not the only cue. Legend: two gradient bars plus the dates.
- Skyline: filled grey polygon from the table, linearly interpolated, wrapped to -180..180 with north in the middle. Without data: dashed flat line named "Flat horizon (0°), no terrain data" plus a note that hidden/visible is approximate.
- Disc sizes: chart dots are a fixed 4 px (the azimuth and height scales differ, so true-scale discs would be ellipses). A separate SVG legend draws Sun and Earth radius at 30 px per degree (same scale both ways), with window-mean radii when the arrays are given. A "?" explains it.
- Not done: time slider/animation and mini-panorama (spec: optional). Zoom stays (modebar reduced to zoom, pan, zoom in/out, autoscale, reset). The modebar PNG download and "Share chart" buttons are removed because the owner said no exports.
- Text alternative: a `<details>` with height ranges and 8 evenly spaced samples. The chart has `role="figure"` and an aria-label pointing to it (`role="img"` was tried: axe "nested-interactive", because the modebar is focusable).
- Narrow chart (< 520 px): only N/E/S/W tick labels, so they do not overlap.
- Plotly is still lazy-loaded through `plotly.ts`.

#### Map links (Compare.tsx, siteLinks.ts)
Verified in the built-in browser on 2026-11-14:
- LROC QuickMap, https://quickmap.lroc.im-ldi.com (new host; the page says the old asu.edu host will be retired). It writes its view into the URL. Its bundle's view serializer stores `proj` and `prjExtent` (minX,minY,maxX,maxY in projection metres). Its own config (`/maps/lroc`) lists `proj=27` "Stereographic (South Pole)": `+proj=stere +a=1737400 +b=1737400 +lat_0=-90 +lon_0=0 +k=1`. I projected a real point with that formula, loaded `?proj=27&prjExtent=...`, and moved the mouse to the canvas centre. The tool's LAT/LON read-out gave -89.00522, 125.29495 for a request of -89.00506, 125.3093 (peak-near-shackleton): about 7 m apart, under one pixel (43 m/px). An earlier hover at the wrong pixel disagreed; that was my pixel offset (the canvas starts at x=36), not the formula. The formula is unit-tested against that point.
- Moon Trek, https://trek.nasa.gov/moon/. The hash is `#v=0.1&x=<lon>&y=<lat>&z=<zoom>&p=urn:ogc:def:crs:EPSG::104903&...&b=moon`. Loaded x=125.3093, y=-89.00506, z=7: the app re-centred on 125.31006, -89.00574 (rounding) and filled in the extent. A west longitude (-61.16732, -88.51566) also worked. Longitude is sent as -180..180.
- Not verified: QuickMap `proj=27` in a wide desktop window (tested in a 268 px wide pane: the centre was kept, the extent grew as expected). Links open in a new tab with `rel="noreferrer"`. Northern-hemisphere or NaN input falls back to the home page, with the text "search for these coordinates".
- No parameter was invented. Layers and other view settings are not set, so the tools open on their default layers.

#### Text (explanations.ts)
- `close` and `flat` rewritten. The only literature numbers: Glaser 2018 Shackleton rim 81.0% average sunlit and longest shadow 221 h; Mazarico 2011 abstract: sunlit about 240 days, darkness about 1.5 days. They are not turned into one comparison: different points and map detail (240 m vs 20 m), and 240 days is not 81%. The text names the split: "Shackleton rim" (Glaser point) vs "Peak near Shackleton" (about 30 km from the pole).
- `dark`: removed "far below -150 °C" (no verified source). `earth`: "middle of Earth", "at least one dish". `flat`: observer height is a choice (2 m default). `custom`: removed "to within 0.01°" (no test backs it). `dates`: says times are UTC. `graph` rewritten for the new chart; new `graphScale`.
- Checked against the engine and kept: `sun` (upper limb), `verdict` (2 points, 1 day, floor 25), `landing`, `low`, `next`.
- "Glaser 2018": sites.md could not verify the journal volume or pages (NTRS id 20170007365). Kept as the brief wrote it.

#### Accessibility
Contrast ratios (script `scratchpad/sky/contrast.py`): body #e6ecf7 on #04060d 17.1, on panel 15.7; muted #8d9ab3 on bg 7.1, panel 6.6, card 6.9, note 6.2, best-row 5.7, none-badge 6.1; Sun #ffb627 on panel 10.6, card 11.2; Earth #4da3ff on panel 7.1, card 7.5; #cfdaf0 on panel 13.3; #04101f on Earth blue 7.3; green #7ee0a0 11.6; purple #c79bff 9.0; #e8dcc0 14.4. All text passes AA (4.5).
- Failures were non-text: control borders #1d2840 (1.3:1) and #3a4b72 (2.2:1) against the 3:1 needed for input boundaries. Now #667aa6 (4.3 to 4.7). Chart ramps start at #a86a00 (4.4) and #2a6bc0 (3.7) on the plot background (graphics rule is 3:1).
- Focus ring: 3 px white (was 2 px blue) with a dark halo. Checkboxes show the ring on the whole pill (`:focus-within`).
- Touch targets, measured for every link, button, input and summary at 1100 px (`targets.cjs`): under 44 px before: 31 of 35; after: 0 of 44. The "?" buttons look 22 px but have a 44 px hit area (::after).
- Keyboard: 79 tab stops in a full tab-through; every one shows an outline of 2 px or more except the native checkbox (its label shows the ring). Plotly removes the outline on modebar buttons, so an `!important` rule restores it. Not fixable from my files: the landing chart (LandingChart.tsx) is mouse-click only; the date field does the same job.
- ARIA: "?" buttons already had `aria-label="Explain: ..."` and `aria-expanded`; kept. Map links carry hidden text "(opens in a new tab)".
- `prefers-reduced-motion`: CSS transitions and animations off. Plotly draws without animation.
- No horizontal scroll at 360x800: `scrollWidth` 360 = `innerWidth` 360 for the full page, and for the sky graph with terrain and all notes open. Screenshots in scratchpad `sky/app360.png` and `sky/t360.png`.
- axe-core (tags wcag2a, wcag2aa, wcag21a/aa, wcag22aa, best-practice; headless Chromium; 1100 and 360 px wide): base 55d5c59: 0 violations at both widths. After: 0 at both. (One serious "nested-interactive" appeared with `role="img"` mid-development and was fixed.) The base page was already axe-clean, so the gains are in what axe does not test: 44 px targets, 3:1 borders, focus ring, table alternative.


## Documentation, CI and licensing

_Source: `docs/decisions/docs.md`_

### Decisions: documentation, licence, CI and the method panel (agent "docs", branch docs)

1. **Licence: MIT, "The Big Four".** Options: MIT, Apache-2.0, none. MIT matches the brief and the existing dependencies (Skyfield, React, Vite are MIT). The year is 2026.
2. **CITATION.cff has no `date-released`.** The release date is not known yet and an invented one would be false. Add it when a tag is cut. Author is an entity (`name: The Big Four`), no personal names or emails.
3. **THIRD_PARTY_NOTICES.md is generated** by `.github/scripts/gen_third_party_notices.py` from `package-lock.json` (all 119 packages) and from installed Python metadata for `backend/requirements.txt` (11 packages). Python versions are the ones installed where the script ran, which can differ from the pins (numpy installed 2.5.1 vs pin 2.5.4); the file says so. Back-ports needed only on old Pythons (tomli, exceptiongroup) are skipped. pytest and its dependencies are labelled dev/test only.
4. **Public-domain claim for NASA data left out.** The brief allowed it only where a cited page says so. No page verified in the research files states it for LOLA, NAIF or Horizons, so THIRD_PARTY_NOTICES.md links the terms pages and asserts nothing.
5. **REFERENCES.md lists only sources opened in the research notes.** SVS 5038, IPN 42-176 and the DE421 IOM (all from the old README) are listed separately as "not re-checked". No DE440 paper is cited because none is verified anywhere in the repo. Wikipedia IM-1 dropped in favour of the NASA LRO page (matches `sky.json`).
6. **DECISIONS.md is generated** by `docs/tools/merge_decisions.py` so the lead can rerun it after `lola`, `controls`, `heatmap` and `sky` decision files are merged; only `data-v2.md` and `engine.md` (plus this file) existed on the `integration` base. The audit branch has no decisions file; its findings are in `docs/AUDIT.md`. Originals are untouched.
7. **METHOD.md terrain section is conditional** as briefed: it describes the horizon contract from `horizon.ts` and says that, without `horizons.json`, a site is flat-horizon and provisional. It does not quote any LOLA numbers, because none are in the repo yet.
8. **Validation numbers are hard-coded in Method.tsx**, each with its source file named, rather than parsed from the markdown at build time. Why: the reports are tables in prose, parsing them would be fragile, and `docs/` is outside the Vite root. Cost: they go stale if a report is regenerated; the file header lists the four sources to re-copy.
9. **Method.tsx** is a native `<details>` element (keyboard and screen-reader friendly, no state). The terrain banner follows `terrainLoaded`. Renders with no console errors and no horizontal scroll at 375 px wide (headless Chromium, temporary harness page, removed afterwards).
10. **CI is a new `ci.yml`; `pages.yml` is untouched.** Options: add steps to pages.yml (would slow and risk the deploy) vs a separate workflow (chosen). Backend job: kernels cached by `hashFiles(MANIFEST.json)` and verified by sha256 (`.github/scripts/fetch_kernels.py`), so the kernel tests run instead of skipping. `ENGINE_SKY_V2` is set so the v2 engine tests run. Not run locally: GitHub itself (YAML parsed with PyYAML only, actionlint not installed); the fetch script was run locally against already-present kernels (4 files ok). Playwright and axe left as a TODO comment.
11. **README claims only what exists on the integration base**: no controls panel, heatmap or shareable-URL claims, since those branches were unmerged when it was written. The lead should add them to "What it does" after merging, and update the test counts.
12. **`docs/project-page.md` was not edited** (not in this agent's ownership). It still says DE421, 3 sites and a 0.00001 degree match; `docs/SUBMISSION-DATA.md` flags this.
