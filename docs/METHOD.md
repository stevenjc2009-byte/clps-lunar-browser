# Method

How the CLPS Lunar Mission Browser turns NASA ephemeris files into the numbers on the page.
Every number below is quoted from a file in this repository, and the file is named next to it.
Where something is not built or not verified, this page says so.

Not an official NASA product.

## 1. Pipeline in one picture

1. `backend/` (Python, Skyfield) reads NASA NAIF kernels and writes `frontend/public/sky.json` and `vectors.bin`.
2. The browser (`frontend/src/lib/`) reads `sky.json`, adds a horizon (flat, or terrain if `horizons.json` exists), and computes everything else: visible intervals, percentages, nights, verdicts.
3. Nothing is computed on a server. The site is static files.

## 2. Ephemeris (where the Sun, Earth and Moon are)

Source: `backend/kernels.py`, `backend/ephem.py`, `backend/data/MANIFEST.json`, `docs/decisions/data-v2.md` section 1.

| Item | Value |
|---|---|
| Planetary ephemeris | JPL **DE440** (`de440s.bsp`, short-span file, 1849-2150) |
| Moon orientation | `moon_pa_de440_200625.bpc` (principal-axes frame `MOON_PA_DE440`) |
| Frame kernel | `moon_de440_250416.tf`. `MOON_ME` is an alias of `MOON_ME_DE440_ME421`, the mean-Earth / polar-axis frame |
| Moon radius | `pck00011.tpc`: 1737.4 km sphere. Sites sit on this sphere (no terrain height in sky.json) |
| Library | Skyfield 1.55 |
| Light effects | Apparent positions: light-time, aberration and deflection included. No atmosphere, so no refraction |
| Integrity | Each kernel's NAIF URL, size and sha256 are in `backend/data/MANIFEST.json` and `sky.json` `meta.kernels` |

Two Skyfield limits were worked around, both in `docs/decisions/data-v2.md` section 1: Skyfield follows only one text-kernel hop, so the `MOON_ME` alias is checked to be the identity and the target frame is built directly; and the `.bpc` has two time segments, so the segment that covers 2026-2029 is passed explicitly.

DE421 (used in the first version of the tool) was replaced. The DE421 to DE440 change is at most 0.0008 arcmin in Sun altitude over the whole grid (`docs/validation/ephemeris-checks.md`, table 1).

## 3. Sampling and 10-minute interpolation

- **Grid:** hourly, 2026-09-01T00:00Z to 2029-01-01T00:00Z, both ends included: 20473 samples (`sky.json` `meta`, `docs/decisions/data-v2.md` section 2).
- **Supported landing dates:** 2026-11-15 to 2027-12-03 (`meta.landing_min_utc`, `meta.landing_max_utc`). The last date is the data end minus a 365-day window minus a 30-day pad, so a night still running at the window's end can be followed for more than one synodic month (29.53 d).
- **Stored precision:** altitude 3 decimals, azimuth 1 decimal (`meta.alt_decimals`, `meta.az_decimals`). Why: with 2 decimals, the polar Sun's 0 degree crossings shift by up to 35.4 min; with 3 decimals by at most 2.4 min (`docs/validation/interpolation.md`).
- **Sub-steps:** the engine cuts each hour into 6 steps of 10 min (`frontend/src/lib/interp.ts`, `SUBSTEPS`). Altitude and azimuth use a Catmull-Rom cubic (azimuth unwrapped across 0/360). Disc radii and DSN elevation change slowly and use straight lines (`docs/decisions/engine.md`, "Model choices").
- **Crossing times:** where a quantity changes sign between two sub-steps, the crossing is placed on the straight line between them (`visibility.ts`, `positiveIntervals`). Percentages come from interval time, not from counting samples.
- **Measured interpolation error** (`docs/validation/interpolation.md`: 60 days from 2027-01-01, truth computed every 10 min with DE440):
  - Hourly data at full precision: max altitude error 6.76e-07 arcmin (Sun, peak-near-shackleton) and 9.60e-06 arcmin (Earth); cubic crossing time error 0.00 min.
  - Hourly data rounded to 3 decimals, as shipped: max altitude error 3.61e-02 arcmin; cubic crossing time error up to 2.42 min (Sun, peak-near-shackleton).
  - Rounded to 2 decimals (the old format, not shipped): up to 35.41 min.
  - The engine's own check (`docs/decisions/engine.md`, "10-minute interpolation error") finds cubic and linear interpolation indistinguishable at this accuracy. The error comes from rounding, not from the interpolation shape.

## 4. Visibility rules

Source: `frontend/src/lib/visibility.ts`, `params.ts`, `horizon.ts`, `docs/decisions/engine.md`.

A body is **visible** while its *margin* is above zero. Margin = how many degrees the chosen point of the disc is above the skyline.

| Setting | Default | Choices | Meaning |
|---|---|---|---|
| Sun rule | upper limb | upper limb, centre | The Sun counts as up when its top edge clears the skyline (first light on a panel). |
| Earth rule | centre | centre, any part, whole disc | Earth counts when its centre clears the skyline. "Any part" uses the top edge, "whole disc" the bottom edge. |
| Observer height | 2 m | 0, 2, 5 m | Height of the eye or antenna above the ground. |
| Mask offset | 0 degrees | 0, 3, 5, 10 | Extra degrees added to the skyline everywhere (a safety margin for local slopes). |

Details:

- **Disc size.** The Sun and Earth angular radii are stored hour by hour in `sky.json` (`sun_radius_deg`, `earth_radius_deg`), from the Moon's centre. At each site the difference is at most 0.002 arcsec for the Sun and 2.1 to 4.9 arcsec for Earth (`docs/validation/ephemeris-checks.md`, table 2). Shipped ranges: Sun 0.2614 to 0.2717 degrees, Earth 0.8978 to 1.0235 degrees (same file). If a file has no radius arrays, constants 0.2666 (Sun) and 0.95 (Earth) are used with a console warning (`engine.ts`).
- **Skyline across a disc.** For the top-edge and bottom-edge rules, the skyline is the highest point across the disc's full width. A disc partly behind a peak counts as hidden (conservative; `horizon.ts`, `maskOverDisc`).
- **Observer-height dip.** With no terrain, the skyline is a flat line lowered by the dip of a smooth sphere seen from the observer height: `acos(R / (R + h))`, R = 1737.4 km (`horizon.ts`, `dipDeg`). That gives 0 degrees at 0 m, 0.0869 degrees at 2 m and 0.1375 degrees at 5 m (evaluated from that formula).
- **Mask offset** is added to the skyline in every direction, flat or terrain.
- **Exactly 0 is down.** A margin of exactly 0 is not visible (`ported.test.ts`).

## 5. DSN link rule

Source: `backend/dsn.py`, `backend/test_dsn.py`, `engine.ts`, `docs/decisions/data-v2.md` section 4.

- **Link available = Earth visible AND at least one Deep Space Network 70 m dish sees the Moon at 10 degrees or more** (toggle, default on; threshold choices 5, 10, 15 degrees).
- `sky.json` `dsn_moon_el_max` holds, hour by hour, the highest Moon-centre elevation over the three complexes DSS 14 (Goldstone), DSS 63 (Madrid) and DSS 43 (Canberra). It is geometric, with no refraction.
- **Coordinates** come from JPL 810-005 Module 301 Rev K, Table 5 (WGS 84 geodetic): https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf. Table 6 of the same module lists geocentric latitudes; using them as geodetic misses Table 2 by 20,145 m. `test_dsn.py` checks Table 5 against Table 2 to under 1 m and goes red with the Table 6 values (`docs/decisions/data-v2.md` section 4).
- If the file has no DSN array, link % falls back to Earth % and the page says DSN data is not loaded (`engine.ts`, `dsnMissing`).
- **Not modelled:** the DSN schedule, antenna power, relays, or any antenna on the lander. It is a geometry rule only.

## 6. Metrics, and censoring ("at least")

Source: `frontend/src/lib/windowMetrics.ts`, `intervals.ts`.

All metrics are cut from one timeline per site, built once over the whole loaded data range. Cards, landing chart and after-landing lines therefore always agree.

- **Sun %**, **Earth %**, **Link %**: share of the window's time inside visible intervals, rounded to 0.1.
- **Longest night:** the longest unbroken interval with the Sun not visible, among the nights that overlap the window.
  - It is counted in full: a night already going at landing counts from its true start, and a night still going at the window's end is followed on through the data. The card says how much of it falls after landing.
  - **Censoring.** If that night touches the first or last sample of the loaded data, its true length is unknown. It is flagged `at_least` and shown as "at least X" ("≥"). On equal length a censored night wins the tie, because it may be longer (`longestRun`).
- **Longest gap in the link** is computed the same way.
- **Night score** (used in the Balanced verdict): `100 * (1 - hours / 708.7)`, where 708.7 h is one synodic month (`SYNODIC_MONTH_H`), clamped to 0 to 100. A censored night scores 0 (`docs/VERDICT.md`).

## 7. Verdict rules

The full table and its 17 tested cases are in `docs/VERDICT.md` (code: `frontend/src/lib/verdict.ts`, tests: `verdict.test.ts`). In short:

- **Margins:** a badge for Best for energy, Best for communication and Balanced needs a lead of at least 2.0 points over the runner-up, compared on the 0.1-rounded values the cards show. Shortest night needs at least 24 h.
- Smaller leads are **comparable** ("too close to call"), and the group is named.
- A **censored night** cannot win the night badge unless its lower bound is already 24 h longer than the leader's. If a censored night blocks the call, the outcome is **undetermined**.
- **Balanced** = best worst-case score, where worst case = min(Sun %, link %, night score), and it must be at least 25 out of 100. Below that: `below_floor`, no badge.
- Scores never depend on which other sites are on the page.
- **Provisional:** if any compared site has no terrain horizon, the page says "Terrain data not loaded: flat-horizon approximation, not reliable for ranking."

## 8. Terrain (horizons.json): being built

Status when this was written: the terrain file is being built on a separate branch (`lola-terrain`) and is **not part of the shipped data on the branch this page describes**. Check whether `frontend/public/horizons.json` exists before relying on this section.

What it is, from the data contract and `frontend/src/lib/horizon.ts`:

- For each site, a skyline table (degrees above the local level, one value per 0.25 degrees of azimuth, for observer heights 0, 2 and 5 m), derived from NASA LOLA elevation models of the lunar south pole.
- The engine reads it if present (`engineData(sky, horizons)`). Heights between the tabulated ones are interpolated in a straight line; outside the range the nearest table is used.
- A table must cover exactly 360 degrees or it is ignored with a console warning.

What happens without it, and this is the case for every site until the terrain file is merged:

- That site uses the flat horizon (lowered by the observer-height dip, plus the mask offset).
- Its card is flagged "Flat horizon · provisional", and the verdict says its ranking is not reliable.
- The size of the effect is not small. Against the published terrain-aware study of Glaser et al. (NTRS 20170007365, Table 1), the flat model gives Sun visibility of 60.5 % at shackleton-rim (published 85.5 %) and 57.8 % at connecting-ridge (published 81.3 %). This is a finding, not a tuned result (`docs/SANITY.md`, section 2). The two time spans differ (2.3 vs 20 years).

## 9. Validation

Every number is from the named file. Regenerate with the scripts named there.

### Against NASA JPL Horizons (`docs/validation/horizons.md`)

- 218 instants per site and body, 7 sites, Sun and Earth: 200 spread evenly over 2026-09-01 to 2029-01-01, plus perigee/apogee, the Sun's lunar-latitude extremes and Earth libration extremes.
- Horizons query: target Sun with `{source: DE441}`, centre frame `MEAN_ME (high precision)`, airless apparent azimuth and elevation.
- **Pass tolerance, fixed before the run:** elevation error at most 0.05 arcmin, azimuth at most 1.0 arcmin. At the polar sites, 0.05 arcmin is about 7.1 min of sunrise timing; 1 arcmin would be about 142 min.
- **Result:** all 14 site/body rows PASS. Largest elevation error 4.7e-06 arcmin (nobile-rim-2, Earth); largest azimuth error 2.7e-05 arcmin. The file states the total difference, including DE440 vs DE441 and the frame, is at most 2.7e-05 arcmin (1.6e-03 arcsec).
- **The check can fail:** moving a site by 0.002 degrees of latitude (about 60 m) made peak-near-shackleton Earth elevation miss by up to 0.082 arcmin, a FAIL (run by the data-v2 agent, not part of the script).
- Raw Horizons replies are cached in `backend/data/horizons-cache/`, so the check re-runs offline.

### DE421 to DE440 (`docs/validation/ephemeris-checks.md`)

Largest change over the grid: 0.0008 arcmin (Sun altitude), 0.0007 (Earth altitude), 0.0006 (azimuth).

### Interpolation

See section 3 (`docs/validation/interpolation.md`).

### Sanity checks (`docs/SANITY.md`)

- Sun altitude repeats every 29.51 to 29.56 days at all 7 sites (expected 29.530589 d, the synodic month). Earth altitude repeats every 27.19 to 27.22 days (expected 27.21 to 27.55 d, libration months).
- The yes/no Sun-visible flag near the pole has a weaker monthly signal (23.57 to 29.54 d across sites). The file documents this as a finding.
- The 346.6-day eclipse year and the 18.6-year nodal cycle are outside this check; the latter is a stated limit of a 2.3-year data range.

### Tests (counts from a run on this branch)

- `frontend`: `ENGINE_SKY_V2=$PWD/public/sky.json npx vitest run` gave 139 passed, 4 skipped (12 files passed, 1 skipped). Without `ENGINE_SKY_V2`: 134 passed, 5 skipped.
- `backend`: `py -3 -m pytest -q` gave 37 passed (DE440 kernels present).
- `npx tsc -b` and `npx oxlint src` exit 0.

## 10. Limits: what this tool is, and what it is not

It is:

- A comparison of the **geometry** of Sun and Earth over chosen sites and dates, from NASA's own ephemeris, checked against JPL Horizons.
- Deterministic and reproducible: same inputs give the same numbers, badges and sentences.
- Honest about uncertainty: nights that run past the data are shown as "at least"; close calls are shown as "too close to call".

It is not:

- **A mission-planning or flight tool.** Do not use it to choose a real landing site or date.
- **A thermal, power or battery model.** Any battery check on the page is illustrative only (`windowMetrics.ts`, `survivalCheck`: constant load, no cold losses).
- **Terrain-accurate for every site yet.** Sites without `horizons.json` use a flat horizon and are flagged provisional (section 8).
- **A communications simulation.** The link rule is Earth in view plus a DSN dish seeing the Moon at 10 degrees. No schedule, power, relay, lander antenna or radio-frequency effects.
- **Aware of shadows cast by the lander, nearby objects, dust, or the real Sun's corona.**
- **Valid outside its data range.** Dates are 2026-09-01 to 2029-01-01 (landing dates 2026-11-15 to 2027-12-03). The 18.6-year lunar nodal cycle is not covered.
- **Exact about landing positions.** Site coordinates have no stated uncertainty (`uncertainty_m` is null for all seven sites). A tiny move matters near the pole: 0.002 degrees of latitude (about 60 m) already changes an elevation by 0.082 arcmin (section 9).
- **A statement about NASA.** It is not an official NASA product, and no NASA endorsement is implied.
