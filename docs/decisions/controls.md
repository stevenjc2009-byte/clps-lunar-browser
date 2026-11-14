# Decisions: controls branch (parameter controls, worker, sensitivity, shareable URL, footer)

Branch `controls`, based on `integration` @ 55d5c59. Made during an unattended overnight run
with no questions asked; each open call, the options and the reason are recorded here.

## Parameter controls (`frontend/src/Controls.tsx`)

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

## Web Worker (`frontend/src/worker/`)

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

### Measurement (headless Chromium, built site via `vite preview`, 2026-11-14)

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

## Sensitivity table (`frontend/src/Sensitivity.tsx`)

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

## Shareable URL (`frontend/src/url.ts`, `frontend/src/useShareState.ts`)

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

## Default comparison

`shackleton-rim`, `im2`, `im1` (looked up by id). If any is missing, the first three sites. The
sky-graph site default is unchanged (first site in sky.json): the brief did not ask to change it.

## Footer

- "Horizon: flat horizon" or "Horizon: LOLA terrain horizons", decided by whether horizons.json
  loaded (replaces the raw `meta.horizon` string).
- Version stamp: `Build <short commit> · data version <meta.version> · data generated <date>`.
  The commit comes from `git rev-parse --short HEAD` at build time via a Vite `define`
  (`__BUILD_COMMIT__`, declared in `src/build.d.ts`), "dev" if git fails. Note: it is the commit
  checked out when the site was built, so a deploy built from main shows main's commit.
- Disclaimer: "Not an official NASA product. Built for the NASA Space Apps Challenge 2026."

## Files touched outside the brief's list

- `frontend/vite.config.ts` (the `define` for the build commit; there is no other way to inject
  it) and new `frontend/src/build.d.ts`, `frontend/src/useShareState.ts` (hook extracted to keep
  App.tsx small), `frontend/src/controls.css`. Compare.tsx, SkyChart.tsx, explanations.ts and
  index.css are untouched.
