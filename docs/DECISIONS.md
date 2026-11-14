# Decisions

Every open call made during the autonomous upgrade run, with options, choice and reason, grouped by area.
Merged from `docs/decisions/*.md` by `py -3 docs/tools/merge_decisions.py`; the originals are kept and remain the source of truth.

Contents: Data and ephemeris; Visibility engine and verdicts; Documentation, CI and licensing.


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
