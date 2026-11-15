# Final report: what changed overnight (14–15 Nov 2026)

Before = the site that was live on the evening of 14 Nov 2026 (commit 724192e).
After = branch `integration` (this release). Numbers were read off the page by a
headless browser script (`node beforeafter.cjs`, 14 Nov 2026 about 23:55 UK), not typed by hand.

## What changed

| Area | Before (724192e) | After |
|---|---|---|
| Ephemeris | DE421 | DE440 + NAIF lunar orientation kernels, checked against JPL Horizons |
| Sites | 3 | 7 cited sites (5 near Shackleton from published studies, IM-1 and IM-2 landing spots) |
| Horizon | Flat 0° everywhere | Real skyline from NASA LOLA elevation maps for all 7 sites; flat only for spots you type in |
| Sun rule | Centre of the Sun | Top edge of the Sun (any part visible), from 2 m up by default |
| Radio | Earth above the horizon | Earth above the skyline **and** a NASA Deep Space Network dish sees the Moon at 10° or more |
| Controls | Date, 30 days / 1 year | Plus presets, observer height, skyline margin, Sun/Earth rules, DSN limit |
| New panels | — | Sensitivity, Sun by landing date, best landing dates (heatmap), compare two landing dates, LROC QuickMap and Moon Trek links |
| Sharing | — | Every setting is kept in the page address (shareable URL) |
| Checks | 52 vitest + 16 pytest | 207 vitest (4 skipped), 6 Playwright browser tests with an accessibility scan, 37 terrain pytest (1 skipped) |

## Numbers: 15 Nov 2026, look ahead 1 year

| Site | Before: Sun / Earth / longest night | After: Sun / link (DSN) / Earth in view / longest night | After badge |
|---|---|---|---|
| Peak near Shackleton (was called "Shackleton rim") | 53.0 % / 45.8 % / 112.2 days | 40.9 % / 52.1 % / 52.1 % / 28.0 days | No top score |
| Shackleton rim (new, Gläser et al. point) | — | 86.2 % / 51.2 % / 51.3 % / 8.5 days | Too close to call |
| Connecting Ridge (new) | — | 86.1 % / 52.8 % / 52.9 % / 5.4 days | Shortest night |
| Nobile Rim 2 (new) | — | 34.3 % / 25.6 % / 25.6 % / 21.8 days | No top score |
| de Gerlache Rim 2 (new) | — | 20.2 % / 45.2 % / 45.3 % / 86.2 days | No top score |
| IM-2 Athena | 51.6 % / 73.3 % / 17.5 days | 48.4 % / 80.9 % / 81.5 % / 17.2 days | No top score |
| IM-1 Odysseus | 51.3 % / 100.0 % / 16.2 days | 40.0 % / 99.0 % / 100.0 % / 19.0 days | Best for communication |

Before, all three sites were "too close to call" on sunlight (53.0 / 51.6 / 51.3 %). After, the
terrain separates the sites clearly: the two rim and ridge points get about 86 % Sun, the rest 20–48 %.
Energy is still "too close to call" between Shackleton rim and Connecting Ridge (86.2 vs 86.1 %).

## Numbers: 23 Jun 2027 (southern winter), look ahead 30 days

| Site | Before: Sun / Earth / longest night | After: Sun / link / Earth in view / longest night | After badge |
|---|---|---|---|
| Peak near Shackleton | 25.6 % / 48.6 % / 18.3 days | 19.8 % / 55.8 % / 55.9 % / 26.6 days | No top score |
| Shackleton rim | — | 85.6 % / 54.5 % / 54.6 % / 41 h | Too close to call |
| Connecting Ridge | — | 92.2 % / 55.7 % / 55.7 % / 24 h | Best for energy |
| Nobile Rim 2 | — | 29.6 % / 22.7 % / 22.7 % / 20.8 days | No top score |
| de Gerlache Rim 2 | — | 15.3 % / 48.7 % / 48.7 % / 22.4 days | No top score |
| IM-2 Athena | 45.8 % / 74.7 % / 16.3 days | 45.3 % / 81.1 % / 81.5 % / 16.4 days | No top score |
| IM-1 Odysseus | 48.5 % / 100.0 % / 15.5 days | 38.3 % / 99.2 % / 100.0 % / 18.5 days | Best for communication |

Before, IM-1 was "Best for energy & communication" in midwinter, which is the flat-horizon error
the old page warned about. After, the high rim points keep the Sun through winter and win on energy.

## Why "Peak near Shackleton" got darker

The old "Shackleton rim" site was really the "Peak near Shackleton" point from Peña-Asensio et al.
(arXiv:2406.19863), about 30 km from the pole and not on the crater rim. With its real skyline it
sees less Sun than a flat horizon gave (40.9 % vs 53.0 %). The true rim point now in the tool
(Gläser et al. 2018) gets 86 %. Details: `docs/AUDIT.md`, `docs/TERRAIN.md`.

## Claims checklist

| Claim on the page or in the docs | Evidence | State |
|---|---|---|
| Sun and Earth positions match NASA JPL Horizons to within 0.002 arcseconds | `docs/validation/` Horizons check | checked |
| Terrain Sun numbers are close to a published terrain study | Shackleton rim 86.7 % vs Gläser 85.5 %; Connecting Ridge 86.6 % vs 81.3 % (`docs/terrain-validation.json`) | checked; ours is 2 m up, theirs ground level |
| Longest nights match the published study | ours are longer (C1 216–259 h vs 112 h); set by ground within 0.5 km (beyond it only: 104 h vs 112 h, Shackleton 65 h vs 65 h) and by fractions of a metre of eye height | **not matched, cause narrowed**; no bug found (`docs/TERRAIN.md`, Validation 1) |
| Gläser Table 2 numbers | read row by row from PDF word positions, page 12 | checked |
| LOLA data may be redistributed | PDS Geosciences Node FAQ: "Data sets archived in the PDS are in the public domain" | checked (node-wide statement; no LOLA-specific text) |
| Close calls are not ranked | 2-point rule, `docs/VERDICT.md`, unit tests | checked |
| No NASA logo, not an official NASA product | footer text; no logo files in the repo | checked |
| Built during the event | every file created 14–15 Nov 2026 (git history) | checked |
