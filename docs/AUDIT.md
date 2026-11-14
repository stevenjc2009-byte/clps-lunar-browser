# Phase 0 audit of the CLPS Lunar Mission Browser (code at commit 724192e)

Scope: read-only audit of the current code. No feature edits. Everything below was read from the code or produced by
running the real functions (`tests/fixtures/make-baseline.mjs`, `tests/fixtures/audit-probes.mjs`).
Not verified: anything needing the Python backend (Skyfield and the kernels are not installed in this worktree and the kernels
are not in the repo). Command to finish: `cd backend; py -3 -m venv .venv; .venv/Scripts/pip install -r requirements.txt; .venv/Scripts/python compute.py`.

## 1. Repository map

```
clps-lunar-browser/
  .github/workflows/pages.yml   on push to main: npm ci, npm test, npm run build, upload frontend/dist, deploy-pages
  .claude/launch.json           dev-server launch config
  backend/                      Python 3 (requirements.txt: skyfield==1.55, numpy==2.5.4, pytest==9.2.0)
    compute.py        sites.json -> frontend/public/sky.json  (the ephemeris step)
    export_vectors.py Sun/Earth vectors from the Moon centre -> frontend/public/vectors.bin + vectors.json (custom sites)
    sites.json        3 sites: shackleton, im2, im1 (lat, lon, note, source)
    test_compute.py   16 pytest tests of the pure helpers only (percent, longest_run, round_keep_sign); no ephemeris
    check_vectors.py, window_stats.py, next_events.py, validate_horizons.py   manual cross-check scripts (not in CI)
    data/ (gitignored; Skyfield's Loader downloads the kernels on first run)
  frontend/                     React 19.3, Vite 8.3, TypeScript 7.0, plotly.js-dist-min 4.3 (lazy), vitest 5.1, oxlint
    src/metrics.ts    window, percentages, darkness, verdicts          src/landing.ts   Sun % per landing day
    src/events.ts     "after landing" next rise/set                    src/ephem.ts     in-browser sky for custom lat/lon
    src/App.tsx (171 lines) page state/layout   Compare.tsx (cards, stars, banners)   SkyChart.tsx   LandingChart.tsx
    src/CustomSite.tsx, Explain.tsx, explanations.ts, plotly.ts, types.ts, index.css
    src/*.test.ts     52 vitest tests (metrics 43, events 8, landing 3), from `npx vitest run`: 52 passed
    scripts/check_ephem.ts   manual: custom-site maths vs sky.json (not in CI); run here: OK
    public/sky.json (1,171,377 B), vectors.bin (421,056 B), vectors.json (429 B), favicon.svg (395 B)
  docs/  project-page.md, video-script.md, video-subtitles.srt, demo-video.mp4 (9.9 MB), slides.pptx (0.8 MB), slides.pdf (0.6 MB)
  slides/ (pptx builder, Node), video/ (Playwright recorder, Node)   entry assets, not part of the site
  README.md (14 KB)
```

- Languages: TypeScript/TSX (about 1,150 lines in frontend/src excluding tests), Python (about 590 lines), CSS, small Node scripts.
- Build: `cd frontend; npm ci; npm run build` (`tsc -b && vite build`, `base: './'` so it works at any URL). Test: `npm test` (vitest run).
- Deploy: GitHub Pages via `pages.yml`. CI runs `npm test` and `npm run build` only. **Not run in CI:** `oxlint`, pytest, `check_ephem.ts`, any Python.
- Absent: LICENSE, CITATION.cff, DECISIONS.md, a Method page, a validation table in the app (spec P7).
- Runtime data: the page fetches `sky.json` (1.1 MB) at start; `vectors.bin` (0.4 MB) only when a custom location is added.
- `sky.json` is **v1**: meta has only start_utc, end_utc, step_hours, samples, ephemeris, horizon. No version, radii, DSN array, kernel hashes.
  Per site: stats, sun_alt, sun_az, earth_alt, earth_az, each 17,544 hourly values.

## 2. Ephemeris source (backend/compute.py, export_vectors.py)

| Item | Value |
|---|---|
| Library | Skyfield 1.55 (+ numpy 2.5.4) |
| Planetary ephemeris | JPL **DE421** (`de421.bsp`), not DE440 |
| Lunar orientation | NAIF `moon_pa_de421_1900-2050.bpc` + `moon_080317.tf` + `pck00008.tpc`; frame `MOON_ME_DE421` (mean-Earth/rotation), `PlanetaryConstants.build_frame_named` |
| Site position | `eph["moon"] + pc.build_latlon_degrees(frame, lat, lon)`: a point on a **sphere**; no DEM height, no observer height |
| Quantity | `observe(sun or earth).apparent().altaz()`: light-time, deflection and aberration included; no refraction (no temperature/pressure passed) |
| Alt/az frame | Skyfield local frame of `build_latlon_degrees`: up = sphere normal, azimuth clockwise from local north |
| Time | `ts.utc(2026, 11, 15, hours)`, `hours = arange(0, 731*24)`: UTC inputs; Skyfield applies leap seconds and converts to TT/TDB itself. start 2026-11-15T00:00:00Z, end 2028-11-14T23:00:00Z, 17,544 samples |
| Step | **1 hour** (`STEP_HOURS = 1`), uniform; no interpolation anywhere except the linear crossing time in "after landing" |
| Output rounding | alt 2 decimals via `round_keep_sign` (a positive never becomes 0.00, so `> 0` survives rounding); az **1** decimal; stats min/max alt taken before rounding |
| Sun/Earth | centres only. No angular radius in sky.json v1, so no limb or disc logic is possible |
| Custom sites | `export_vectors.py` stores apparent vectors (km, MOON_ME_DE421, float32, origin Moon centre, 6 floats/hour); `ephem.ts` rebuilds alt/az for any lat/lon with the same spherical local basis. Moon radius in the browser: 1737.4 km (vectors.json) |
| Check run here | `node frontend/scripts/check_ephem.ts`: max altitude error 0.01 deg (Earth), 0.00 (Sun), 0 visibility-hour differences, exit OK |
| Horizons validation | `validate_horizons.py` (needs internet) is manual. The footer claims agreement "to within 0.00001 deg". No recorded output of that run is in the repo, so the claim is **unverified here** (command: `py -3 backend/validate_horizons.py` inside the backend venv) |

## 3. How each metric is computed

All metrics run in the browser from the hourly arrays; nothing is recomputed from the ephemeris.

**Window** (`spanFor`, metrics.ts): start = round((UTC midnight of the chosen date - data start) / 1 h), length = days*24 samples
(30 d = 720, 365 d = 8,760), start clamped to [0, samples - length]. Window = samples [start, end). A landing "date" always means 00:00 UTC.
Invalid date strings silently become index 0 and out-of-range dates silently clamp (bug B3).

**Visibility predicate:** Sun up = `sun_alt[i] > 0`, Earth up = `earth_alt[i] > 0`: the altitude of the body **centre** above a flat 0 deg horizon
(no limb, no terrain, no observer height, no DSN station). Exactly 0 counts as down.

**Percentages** (`siteMetrics`): `round1(100 * count(up) / n)`, n = samples in the window. They are by **sample count**, not by time-integrated interval,
and quantised to 1/n: 0.139 points for 30 d, 0.0114 points for 1 year (then rounded to 0.1). `landing.ts sunPctByDay` uses the same rule with a running sum.

**Darkness run:** consecutive samples with `sun_alt <= 0`. Rules in `siteMetrics`:
1. The longest run inside the window, counted from the window start (a night already in progress at landing counts from landing, not from its true start).
2. A night still going at the window's last sample is **followed past the window** into later data (`while sun_alt[j] <= 0`), so its real length counts.
3. `darkCut` ("≥") is set only when that followed night reaches the end of the whole dataset (2028-11-14 23:00 UTC) and is at least as long as every other night.
4. Result hours = run length in samples * step (1 h).
Brute-force check (probe 1, independent night list): longest-dark hours match in all 702 30-day and 367 one-year windows for each of the 3 sites (0 mismatches).
`darkCut` is true in 1 of 3,207 window/site cases (im2, a 30-day window near the end of the data).

**Verdict, badges, stars** (`verdicts`, `closeCall`, `bestDarkHours`, Compare.tsx):
- `CLOSE_PTS = 2` percentage points. `nearTop(top, v)` is `round1(top - v) < 2`.
- `leader(score)`: sort the scores; if the top is less than 2 points above the runner-up, **nobody** leads that score (an exact tie also counts as close); otherwise the site(s) equal to the top lead.
- The Sun leader gets "Best for energy", the Earth leader "Best for communication", both gives "Best for energy & communication".
- Other sites: `score = min(sunPct, earthPct)`; the site(s) with the highest score among the *unlabelled* sites get "Balanced". This is relative: the best of the leftovers is Balanced even when it is poor (probe 5: an 11% Sun / 12% Earth site is "Balanced").
- No label and (Sun is a close call and the site is within 2 points of the Sun top, or the same for Earth): "Too close to call". Any other unlabelled card: "No top score".
- Stars (`best` class, Compare.tsx): Sun star only if Sun is not a close call and the value equals the top; Earth likewise; darkness star only on an **uncut** night equal to `bestDarkHours` (shortest uncut night; null if every night is cut). Ties share the star.
- Darkness no longer affects any verdict (it did before 0041d7b).
- Everything compares the 0.1 %-rounded values the page shows, so it is as quantised as the percentages.

**"After landing"** (`events.ts nextChange`): `up = alt[landingIndex] > 0`; scan forward to the end of the data for the first sample whose state differs;
the crossing time is linearly interpolated between the two hourly samples, using the 2-decimal rounded altitudes. If none: "never ... before the data ends".
`landingIndex` is the window start.

**Sky graph** (`SkyChart.tsx`): Plotly `scattergl`, markers (size 3, opacity 0.5), one dot per hourly sample inside the window; x = azimuth wrapped to -180..180
(north in the middle), y = centre elevation. The y-range is [min(sun,earth) - 1, max + 1] taken from the **whole 2-year stats**, so axes do not move with the window.
Brown rectangle below 0 and a "flat horizon (0°)" line. No decimation (up to 8,760 points per body). Plotly is loaded lazily and `React` re-plots on site/window change.

## 4. Architecture and data flow

```
 JPL/NAIF kernels (de421.bsp, moon_pa_de421 bpc, tf, tpc)        backend/sites.json
          |                                                            |
          v                                                            v
  backend/compute.py  (Skyfield 1.55; hourly 2026-11-15 .. 2028-11-14; flat 0 deg; centre alt/az)
          |                                  \
          | sky.json (1.1 MB, v1)             \  backend/export_vectors.py -> vectors.bin/json (0.4 MB, float32 km)
          v                                    v
  +--------------------------- browser: static React app on GitHub Pages ---------------------------+
  | App.tsx state: site tab, picked sites, landing date, look-ahead 30/365 d, custom site            |
  |   spanFor ----------------------> Span{start,end}                                                 |
  |   metrics.siteMetrics(site,span) -> sunPct, earthPct, longestDarkHours, darkCut, min/max          |
  |   metrics.verdicts / closeCall / bestDarkHours --> Compare.tsx cards, banners, stars              |
  |   events.nextChange ------------------------------> "after landing" lines                        |
  |   landing.sunPctByDay ----------------------------> LandingChart (Plotly lines)                  |
  |   SkyChart (Plotly scattergl) <-- sun_az/alt, earth_az/alt in span                                |
  |   CustomSite -> ephem.computeSite(vectors.bin) -> same Site shape -> same metrics path            |
  +---------------------------------------------------------------------------------------------------+
  CI: push main -> npm ci -> vitest (52) -> vite build -> Pages.   Not in CI: oxlint, pytest, check_ephem, Horizons check.
```

## 5. Sampling step and its consequence

The only ephemeris sampling is **1 hour**; there is no sub-step interpolation except the linear crossing time in "after landing".
- A rise/set is only known to within one sample: the predicate flips at the first sample on the other side, so the true crossing is up to 1 h earlier. Each night boundary carries up to 1 h error, a night length up to ±1 h of error (two boundaries), and a rise/set time up to ±1 h.
- Measured (probe 2: sampled run length minus linearly interpolated length, every night in 2 years): Shackleton 11 nights, difference +0.50 to +1.00 h (sampled always longer);
  IM-2 24 nights, -0.55 to +0.55 h; IM-1 24 nights, -0.67 to +1.00 h. The ±1 h bound is reached.
- Percentages are quantised to 1/N samples: 0.139 points (30 d, N=720) and 0.0114 points (1 year, N=8,760).
- The altitude rate at crossings is tiny, which magnifies any horizon or timing error: median |change| per hour at 0° crossings is 0.010° (Shackleton), 0.050° (IM-2), 0.090° (IM-1).
  At 0.010°/h the stored 0.01° rounding alone is worth up to ±0.5 h, and a 0.1° change of effective horizon (terrain, observer height, mask) moves a Shackleton crossing by about 10 h (0.1 / 0.010).
  The 112-day Shackleton night is therefore extremely sensitive to the horizon assumption (consistent with spec P1/P2).
- Landing is quantised to whole UTC midnights.

## 6. Spec section 1 numbers reproduced

Run: `node tests/fixtures/make-baseline.mjs --metrics <path to metrics.ts>` loads the real `siteMetrics`/`verdicts` on `frontend/public/sky.json`.
Historical files were extracted with `git show <commit>:frontend/src/metrics.ts` into a scratch dir (nothing added to the repo). Before ccaf310 the darkness-star rule lived
inline in Compare.tsx (`longestDarkHours === Math.min(...)`); the script repeats only that one comparison, everything else is the real function.

**15 Nov 2026 + 1 year** (Sun, Earth and darkness identical in d70b4a3, ccaf310 and main):

| Site | Sun % | Earth % | Longest darkness | Spec | Match |
|---|---|---|---|---|---|
| Shackleton | 53.0 | 45.8 | 2692 h = 112.2 d | 53.0 / 45.8 / 112.2 d | yes |
| IM-2 | 51.6 | 73.3 | 420 h = 17.5 d | 51.6 / 73.3 / 17.5 d | yes |
| IM-1 | 51.3 | 100.0 | 388 h = 16.2 d | 51.3 / 100.0 / 16.2 d | yes |

Badges: before the fixes Shackleton "Best for energy", IM-2 "Balanced", IM-1 "Best for communication". On main Shackleton is **"Too close to call"**
(1.4 points ahead of IM-2, under CLOSE_PTS 2). Darkness star: IM-1 (16.2 d) in all versions.

**23 Jun 2027 + 30 days:**

| Version | Shackleton | IM-2 | IM-1 |
|---|---|---|---|
| d70b4a3 (before ccaf310 and 0041d7b; the spec's screenshot) | 25.6 / 48.6, darkness "≥ 12.2 d" (293 h, cut), "No top score", **darkness starred** | 45.8 / 74.7 / 16.3 d, Balanced | 48.5 / 100 / 15.5 d, "Best for energy & communication" |
| ccaf310 (cut night cannot win the star) | same numbers, "≥ 12.2 d", "No top score", no star | same | same, **star moves to IM-1's 15.5 d** |
| main 724192e (0041d7b: darkness followed past the window) | 25.6 / 48.6, darkness **18.3 d** (438 h, not cut), "No top score" | 45.8 / 74.7 / 16.3 d | 48.5 / 100 / 15.5 d, "Best for energy & communication", darkness starred |

Differences explained: (1) the spec's starred "≥ 12.2 days" was a cut-off lower bound (the night ran to the window edge); being the smallest number it won the minimum
comparison. ccaf310 fixed that. (2) 0041d7b follows that night past the window end (23 Jul 2027, 00:00 UTC) into later data, where it really lasts 438 h (18.3 d), so the "≥" disappears and the exact length shows.
Sun %, Earth % and Sun/Earth verdicts are identical in all three versions for this window. Spec P3 (a cut value winning) is already fixed on main. Full numbers: `tests/fixtures/baseline.json`.

## 7. Hidden assumptions

1. Flat horizon at 0°, smooth sphere: no terrain, no DEM, no observer height, no mask. (The Moon has no atmosphere, so no refraction is correct.)
2. Visibility = **centre** of the Sun/Earth disc above 0°. The Sun's upper limb (about 0.27°) and Earth's disc (about 0.95°) are not modelled and no radii are stored.
3. "Earth visible" = Earth up, not "link available" (no DSN/ground-station check; spec P4).
4. Percentages are by samples, not time; windows are whole UTC days of 720 or 8,760 samples regardless of leap day.
5. A night in progress at landing counts from landing (left-censored, not flagged "≥").
6. A night at the window end is followed into later data; only the dataset end flags "≥".
7. Landing time is always 00:00 UTC, and the "after landing" lines use the same hour.
8. Data covers 2026-11-15 to 2028-11-14, so landing dates late in 2028 only support a 30-day look-ahead (max start = samples - length).
9. `CLOSE_PTS = 2` is a hard-coded threshold applied to rounded percentages; it has no sourced justification.
10. DE421 (not DE440), MOON_ME_DE421 from a 2008 frame kernel (`moon_080317.tf`) and the 1900-2050 PCK.
11. Only 3 sites; their coordinates come from the cited sources and were not independently re-verified in this audit.
12. Sky-chart axes come from the whole 2-year stats; the custom-site id is always `custom` (a second custom location replaces the first).
13. Footer strings "within 0.00001°" and "15 Nov 2026 to 14 Nov 2028" are hard-coded in App.tsx.
14. `stats.sun_visible_pct`, `earth_visible_pct`, `longest_dark_hours` in sky.json (2-year values, e.g. Shackleton 2717 h) are **not used** by the UI; only the four `*_alt_min/max` values are (SkyChart axes).
15. Interpolated rise/set times use altitudes already rounded to 0.01°.

## 8. Reproducible bugs and defects

Severity: A = wrong output, B = misleading or surprising, C = latent or minor. Repro: `node tests/fixtures/audit-probes.mjs` unless stated.

- **B1 (A, fixed on main).** A cut-off night won the darkness star. Repro on d70b4a3: `node tests/fixtures/make-baseline.mjs --metrics <d70b4a3 metrics.ts>` shows Shackleton starred "≥ 12.2 days" on 23 Jun 2027 + 30 d. Not reproducible on main.
- **B2 (B) "Balanced" is relative.** Probe 5: `verdicts` on sites (Sun/Earth) 10/90, 11/12, 30/14 labels the 11%/12% site "Balanced". There is no absolute floor.
- **B3 (B) Silent date clamping.** Probe 4: `spanFor(data,'2030-01-01',30)` starts 2028-10-16; `'2020-01-01'` and `'not-a-date'` start 2026-11-15, with no message. In App.tsx `startDay` keeps the typed value while the displayed date is the clamped one, so switching 365 d to 30 d can move the window.
- **B4 (B) Nights in progress at landing are not flagged.** Probe 1: 350 of 702 30-day Shackleton windows begin inside a night; only the part after landing is counted and the card shows no "≥" or note. By design (rule 5), but not explained.
- **B5 (B) False precision.** Cards show "17.5 days", "112.2 days" and rise/set times to the minute while the data are ±1 h (section 5).
- **B6 (B) Sky chart range.** The y-range comes from the 2-year stats (SkyChart.tsx lines 25-26), not the window, so a 30-day window can fill a thin band; no density handling for the Earth trace (spec P6).
- **B7 (C) Test gaps.** The 52 vitest tests cover metrics.ts, events.ts and landing.ts only. Nothing covers `spanFor` clamping, `computeSite` (only the manual `check_ephem.ts`), or the React components; compute.py's ephemeris use is untested (pytest covers helpers only); CI runs neither pytest nor oxlint nor check_ephem.
- **B8 (C) float32 vectors.** Sun vectors (about 1.5e8 km) in float32 have 8-16 km granularity, about 6e-6°. Safe at this resolution, not at a much finer one.
- **B9 (C) Azimuth stored to 1 decimal** in compute.py (the v2 data contract says 2); near the pole 0.1° is a visible jump.
- **B10 (C) Custom latitude ±90** gives an arbitrary azimuth (altitude is fine). Not exercised by a test.
- No bug found in percentages, the longest dark run, the `>=`/follow rule, window slicing or `sunPctByDay` (brute-force probe and the 52 unit tests agree).

## 9. Risks for the upgrade (ordered, riskiest first)

1. **LOLA horizon masks (branch lola-terrain).** The biggest scientific change: Shackleton's flat-horizon 53% Sun and 112-day night will very likely change a lot (spec P1/P2); it must be reported as a finding, never tuned toward a number. DEM processing is RAM-heavy on a 16 GB machine; raw DEMs must stay out of git.
2. **Engine rewrite to interval time (10-minute sub-steps, limb/disc, link availability).** Moves every percentage and verdict; hour-sampled and interval-timed results differ by up to 1 h per boundary and by about 0.01-0.14 points of percent quantisation. Shackleton's night length is the most sensitive (0.010°/h). Needs property tests (sample vs interval time) and a deliberately broken run to prove the tests can fail.
3. **sky.json v2 (DE440, range to 2029, radii, DSN, az precision).** Every baseline number can move slightly; the 52 tests and `Metrics` shape assume v1. Keep the v1 fallbacks working and compare old vs new altitudes before touching metrics.
4. **Verdict/star logic changes.** `verdicts`, `closeCall`, `bestDarkHours` and Compare.tsx are tied to the 43 metrics tests; a careless change lets a censored or close value win again (the bug fixed in ccaf310). Keep "censored never wins" as a tested invariant.
5. **New inputs (observer height, mask offset, Earth rule, DSN toggle) and a shareable URL.** Multiplies the cases the verdict logic and the sensitivity table must cover; URL state must round-trip; avoid silent clamping (B3) producing wrong links.
6. **Custom-location path (`ephem.ts`, vectors.bin).** Must use the same engine and mask rules as built-in sites but has no terrain; needs a clear "terrain data not loaded" flag and its own automated test (currently manual only).
7. **File size and performance.** Plotly scattergl with 8,760 to 17,544 points per body already needs lazy load; heatmaps, sensitivity tables and per-site masks grow sky.json (1.1 MB) and App.tsx (171 lines); the 400-line file limit means new components must be split.
8. **Claims and assets.** Footer, README and slides state "within 0.00001° of Horizons" and the old verdicts; the demo video and slides (remade at 724192e) will go stale. The AI-assistance disclosure in index.html must stay truthful.
9. **CI.** `pages.yml` runs only vitest and the build; adding Python or data steps could break the main deploy (main must stay deployable). Add them as a separate job that does not gate the deploy until proven.
