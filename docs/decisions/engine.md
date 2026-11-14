# Engine branch: decisions

Branch `engine`. Made during an unattended run with no questions asked, so each choice and its reason is recorded here.
Code is in `frontend/src/lib`. Verdict rules are in `docs/VERDICT.md`.

## Defaults (`lib/params.ts`, `DEFAULT_PARAMS`)

| Setting | Default | Why |
|---|---|---|
| Observer height | 2 m | Typical lander deck or antenna height (spec 4.3). Choices: 0, 2 and 5 m. |
| Mask offset | 0° | The raw skyline. Choices: 0, 3, 5 and 10°. |
| Sun rule | upper limb | First light reaches panels when the top edge of the Sun clears the skyline. |
| Earth rule | centre | Matches the old app and the usual line-of-sight definition. |
| DSN | on, 10° | A link needs a Deep Space Network dish that sees the Moon at 10° or more. |

- App state holds one `Params` object. There is no parameter UI yet: the brief asked for none.
- `LEGACY` in `lib/testFixtures.ts` is the old app's model: flat 0°, centre of disc, no height, no DSN. It is used only for the before/after check.

## Model choices

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

## Verdict choices (detail in `docs/VERDICT.md`)

- **Margins:** 2 points for energy, comms and Balanced; 24 h for nights. Margins are compared on the 0.1-rounded values the cards show.
- **Balanced floor (audit B2):** no Balanced badge below a worst-case score of 25.
- **Night score:** measured against one synodic month (708.7 h), never against the other sites, so scores are independent of who is on the page.
- **Censored nights:** an `at_least` night blocks a night call unless its bound is already 24 h longer than the leader. It scores 0 in Balanced and is never starred.
- **Balanced eligibility:** open to every site. The old rule was "sites without another badge only". With an absolute floor, that exclusion is no longer needed.
- **Too-close banner:** comes from the `comparable` and `undetermined` outcomes, with the group named.
- **Site-agnostic:** no site ids appear in the engine or the verdict. A test runs 7 sites (`verdict.test.ts` case 17, and `v2data.test.ts`).

## Audit items

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

## ephem.ts: full altitude precision

- Custom-site altitude used to be rounded to 2 dp. Near the pole that moves a crossing by up to 35 min (0.005° ÷ 0.009°/h).
- Altitude is now kept at full precision. Azimuth is still rounded to 1 dp.
- The test compares against an analytic asin to 1e-6. It was red on the old code.

## 10-minute interpolation error (`lib/tenmin.test.ts`)

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

## Before / after numbers

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

## Headless render (Playwright, vite preview)

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

## Merge notes for the lead

- **App.tsx:**
  - Take engine's version.
  - data-v2's `landingRange` is superseded by `lib/window` (`landingRangeH`, `defaultLandingDay`), which already reads `landing_min_utc`/`landing_max_utc`.
  - Drop `pickDay`: B3 requires a visible note, not a silent clamp.
- **Footer:**
  - Take data-v2's text: DE440, "within 0.002 arcseconds", landing dates.
  - Engine kept the DE421 wording because this branch still ships the v1 data, and the DE440 claim would be false here.
- **public/vectors.\*:** must come from data-v2 together with its sky.json. Otherwise custom sites are refused by the guard.

## Other notes

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
