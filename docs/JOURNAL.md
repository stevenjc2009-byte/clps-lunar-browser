# Build journal

Built from `git log` of `main` (first version, commits up to 724192e) and the `integration` branch (the upgrade, commits 8ca2d3a to 55d5c59). Times are the commit times in the log (UTC), all on 2026-11-14. Hashes let you look up the exact change: `git show <hash>`.
Much of the upgrade was written by AI agents working in parallel under the team's direction (see the AI disclosure in `README.md`).

## Day 1, first version (main)

- **18:12** `fc17780` First working page: a sky graph of the Sun's and Earth's height above the horizon for three south-pole sites.
- **18:51** `1b69a1d` Site comparison, date window (30 days or 1 year), "Explain it to me" mode, first README.
- **18:53** `0ba920b` Project-page text, 30-second video script and subtitles; the build was made host-anywhere (relative paths).
- **19:01** `eb0d930` GitHub Actions workflow: build and publish to GitHub Pages on every push to `main`.
- **19:26 to 19:38** `2b7eed7`, `d4de179` AI help acknowledged in the page metadata; template favicon replaced by a Sun, Earth and horizon icon.
- **19:46** `01ee130`, `15a44e3`, `c280d71`, `ac94171` After-landing lines (next sunrise, sunset, Earthrise, Earthset); any latitude and longitude computed in the browser; unit tests for the comparison maths (also fixed a missed "≥" on an equal-length final night); Plotly loaded separately so the cards appear first.
- **20:02 and 20:10** `dc68378`, `d70b4a3` 30-second silent demo video and 7-slide backup deck, both with a visible "AI-made" watermark.
- **20:23** `ccaf310` Fix: a night that was cut off by the end of the data ("≥") could win the longest-darkness star. It no longer can.
- **20:47** `0041d7b` "Too close to call" verdicts, darkness counted past the window, landing-date chart.
- **21:09** `724192e` Video and slides remade for the new verdicts. End of the first version: DE421 ephemeris, 3 sites, flat horizon, 52 frontend tests.

## Day 1 evening, upgrade run (integration)

- **21:35** `8ca2d3a` Phase 0 audit of the existing code (`docs/AUDIT.md`), with a frozen baseline of the old numbers and scripts that reproduce the audit probes.
- **21:45** `4b859a8` Backend moved to JPL DE440 with the matching Moon-orientation kernels. Data range widened to 2026-09-01 through 2029-01-01. Added the Deep Space Network elevation array and hourly Sun and Earth disc sizes.
- **21:46** `f564840` The visibility engine written as plain functions in `frontend/src/lib`: interval times, 10-minute interpolation, skyline handling.
- **21:51** `4833d7e` Tests comparing the engine with the old app's numbers and with 10-minute "truth".
- **21:54** `955c7de` Validation against JPL Horizons: 218 instants for each of 7 sites and both bodies, plus sanity checks and 10-minute test data.
- **21:57** `bd259a8` `sky.json` and `vectors.bin` regenerated for 7 sites (Peak Near Shackleton, Shackleton rim, Connecting Ridge, Nobile Rim 2, de Gerlache Rim 2, IM-2, IM-1).
- **21:58** `d87a258`, `9b6e75f`, `934292e` App switched to the new engine; default landing day and hour-rounded times; validation reports regenerated and stamped with the data commit.
- **22:08** `169d76c`, `2cb7a9a`, `41f282a` Custom locations keep full altitude precision (rounding to 2 decimals could move a polar crossing by up to 35 minutes); interpolation error measured per rounding level; engine run on the real v2 file.
- **22:08 and 22:09** `0d5dc50`, `1333271` Verdict rules (`docs/VERDICT.md`) and engine decisions written down.
- **22:10 to 22:12** `ad42fe1`, `99ae37e`, `55d5c59` Audit, data-v2 and engine branches merged into `integration`. Base state: 139 frontend tests passing, 4 skipped; types and lint clean.

## Still in progress when this journal was written

- **Terrain horizons.** A LOLA-based horizon engine exists on branch `lola-terrain` (`4a11961`) but is not merged. Until `horizons.json` ships, every site uses a flat horizon and is flagged provisional.
- **Phase B (UI).** Controls, heatmap, sky-chart and method-panel branches are being built in parallel; the docs branch (this file, `README.md`, `docs/METHOD.md`, licence files, CI) is one of them.
