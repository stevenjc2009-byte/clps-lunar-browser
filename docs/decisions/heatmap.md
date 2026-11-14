# Heatmap branch: decisions

Branch `heatmap`, from `integration` @ 55d5c59. Spec Phase 2 (8.1 heatmap, 8.3 mission framing, 8.4 compare
dates, 8.5 presets). Made during an unattended run, so each open call and its reason is written here.
Only new files were added; nothing existing was edited. The lead mounts the components in `App.tsx`.

## Files

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

## Heatmap (spec 8.1)

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

## Compare dates (spec 8.4)

- Props: `{ ed, site, params, days, dateA, dateB, onChange(dateA, dateB), explainAll? }`. A `site`
  object rather than `siteId` + `data`, so the custom site works too; `data` is `ed.sky`. `days` is
  passed in so it can follow the app's look-ahead.
- Rows: Sun visible, link (or Earth) visible, Sun and link at the same time (`bothPct`), longest
  darkness, dark at landing. B minus A, with "about the same" under the verdict margins (2 points, 1 day).
  A censored night only decides the call when its lower bound already settles it, else "cannot say".
- A date outside the landing range is moved by `windowFor` and the panel says which date was used
  (audit B3: no silent clamping).

## Presets (spec 8.5)

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

## Mission framing (spec 8.3)

- Three short boxes: what a lander needs (power from sunlight, batteries through the night, radio needs
  Earth in view and a DSN dish), what this tool is (a "what if" comparison; not an official NASA product),
  and what it is not (no heat, battery, panel-size or link-budget modelling; no landing or driving safety).
  No mission numbers.

## Verification

- `ENGINE_SKY_V2=$PWD/public/sky.json npx vitest run`, `npx tsc -b`, `npx oxlint src`, `npm run build`:
  counts are in the agent report.
- Sabotage arms: removing the 0.1 rounding in `cellValue` turned the two percent "cells agree" tests red;
  flipping higher/lower-is-better in `bestMask` turned both best-10% tests red. Both restored.
- Visual check through a throwaway harness page (not committed): desktop 1200 px and phone 390 px
  (page `scrollWidth` 390 = no sideways page scroll; the heatmap scrolls inside its own box), no console
  errors. Not checked: a real screen reader (only the live-region text was read back).
