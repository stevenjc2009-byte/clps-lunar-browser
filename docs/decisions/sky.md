# Sky branch: decisions

Branch `sky`. Unattended run, so each call is recorded here.

## New optional props (the lead wires them in App.tsx)

`<SkyChart site span ... />` also takes, all optional:
- `horizon?: number[]` and `horizonStep?: number`: terrain skyline in degrees, index i is azimuth i*step (horizons.json `sites[id].heights[String(h)]` and `az_step_deg`). Pick the table for `params.observerHeightM`. Missing: a flat 0° line, labelled as such.
- `sunRadiusDeg?: number[]`, `earthRadiusDeg?: number[]` (`data.sun_radius_deg`, `data.earth_radius_deg`): size legend. Missing: 0.2666° and 0.95°, labelled "typical values".
- `t0Ms?: number` (`dataStartMs(data)`), `stepHours?: number` (`data.meta.step_hours`): date labels for the time colour and the table.
- `explainAll?: boolean`: opens the new "?" note under the size legend.

App.tsx text to reword (not my file): the "What am I looking at?" paragraph says "Dots in the brown band, below the 0° line, are under the horizon". The chart now shows a grey skyline (or a dashed flat line when there is no terrain data).
App.tsx site tabs are `<nav role="tablist">` with `role="tab"` buttons and no arrow-key handling. axe did not flag it, but it is not a full tabs pattern.

## Sky graph
- Axis: -5..10° fixed (spec 11.1). Widened upward only (to the next multiple of 5) if a dot or the skyline is higher. Not widened downward: dots below -5° are counted in a note ("N dots are lower than -5°"). Rejected: widening both ways (a -7° Earth would squash the interesting 0..3° band). Audit B6 fixed: the range depends on the window and skyline, never on the 2-year stats.
- Colour by time: each body keeps its hue (Sun yellow, Earth blue) and goes darker (early) to paler (late). Rejected: one shared colour scale, because the page text and cards tie yellow to Sun and blue to Earth. Shape also differs (circle / diamond) so colour is not the only cue. Legend: two gradient bars plus the dates.
- Skyline: filled grey polygon from the table, linearly interpolated, wrapped to -180..180 with north in the middle. Without data: dashed flat line named "Flat horizon (0°), no terrain data" plus a note that hidden/visible is approximate.
- Disc sizes: chart dots are a fixed 4 px (the azimuth and height scales differ, so true-scale discs would be ellipses). A separate SVG legend draws Sun and Earth radius at 30 px per degree (same scale both ways), with window-mean radii when the arrays are given. A "?" explains it.
- Not done: time slider/animation and mini-panorama (spec: optional). Zoom stays (modebar reduced to zoom, pan, zoom in/out, autoscale, reset). The modebar PNG download and "Share chart" buttons are removed because the owner said no exports.
- Text alternative: a `<details>` with height ranges and 8 evenly spaced samples. The chart has `role="figure"` and an aria-label pointing to it (`role="img"` was tried: axe "nested-interactive", because the modebar is focusable).
- Narrow chart (< 520 px): only N/E/S/W tick labels, so they do not overlap.
- Plotly is still lazy-loaded through `plotly.ts`.

## Map links (Compare.tsx, siteLinks.ts)
Verified in the built-in browser on 2026-11-14:
- LROC QuickMap, https://quickmap.lroc.im-ldi.com (new host; the page says the old asu.edu host will be retired). It writes its view into the URL. Its bundle's view serializer stores `proj` and `prjExtent` (minX,minY,maxX,maxY in projection metres). Its own config (`/maps/lroc`) lists `proj=27` "Stereographic (South Pole)": `+proj=stere +a=1737400 +b=1737400 +lat_0=-90 +lon_0=0 +k=1`. I projected a real point with that formula, loaded `?proj=27&prjExtent=...`, and moved the mouse to the canvas centre. The tool's LAT/LON read-out gave -89.00522, 125.29495 for a request of -89.00506, 125.3093 (peak-near-shackleton): about 7 m apart, under one pixel (43 m/px). An earlier hover at the wrong pixel disagreed; that was my pixel offset (the canvas starts at x=36), not the formula. The formula is unit-tested against that point.
- Moon Trek, https://trek.nasa.gov/moon/. The hash is `#v=0.1&x=<lon>&y=<lat>&z=<zoom>&p=urn:ogc:def:crs:EPSG::104903&...&b=moon`. Loaded x=125.3093, y=-89.00506, z=7: the app re-centred on 125.31006, -89.00574 (rounding) and filled in the extent. A west longitude (-61.16732, -88.51566) also worked. Longitude is sent as -180..180.
- Not verified: QuickMap `proj=27` in a wide desktop window (tested in a 268 px wide pane: the centre was kept, the extent grew as expected). Links open in a new tab with `rel="noreferrer"`. Northern-hemisphere or NaN input falls back to the home page, with the text "search for these coordinates".
- No parameter was invented. Layers and other view settings are not set, so the tools open on their default layers.

## Text (explanations.ts)
- `close` and `flat` rewritten. The only literature numbers: Glaser 2018 Shackleton rim 81.0% average sunlit and longest shadow 221 h; Mazarico 2011 abstract: sunlit about 240 days, darkness about 1.5 days. They are not turned into one comparison: different points and map detail (240 m vs 20 m), and 240 days is not 81%. The text names the split: "Shackleton rim" (Glaser point) vs "Peak near Shackleton" (about 30 km from the pole).
- `dark`: removed "far below -150 °C" (no verified source). `earth`: "middle of Earth", "at least one dish". `flat`: observer height is a choice (2 m default). `custom`: removed "to within 0.01°" (no test backs it). `dates`: says times are UTC. `graph` rewritten for the new chart; new `graphScale`.
- Checked against the engine and kept: `sun` (upper limb), `verdict` (2 points, 1 day, floor 25), `landing`, `low`, `next`.
- "Glaser 2018": sites.md could not verify the journal volume or pages (NTRS id 20170007365). Kept as the brief wrote it.

## Accessibility
Contrast ratios (script `scratchpad/sky/contrast.py`): body #e6ecf7 on #04060d 17.1, on panel 15.7; muted #8d9ab3 on bg 7.1, panel 6.6, card 6.9, note 6.2, best-row 5.7, none-badge 6.1; Sun #ffb627 on panel 10.6, card 11.2; Earth #4da3ff on panel 7.1, card 7.5; #cfdaf0 on panel 13.3; #04101f on Earth blue 7.3; green #7ee0a0 11.6; purple #c79bff 9.0; #e8dcc0 14.4. All text passes AA (4.5).
- Failures were non-text: control borders #1d2840 (1.3:1) and #3a4b72 (2.2:1) against the 3:1 needed for input boundaries. Now #667aa6 (4.3 to 4.7). Chart ramps start at #a86a00 (4.4) and #2a6bc0 (3.7) on the plot background (graphics rule is 3:1).
- Focus ring: 3 px white (was 2 px blue) with a dark halo. Checkboxes show the ring on the whole pill (`:focus-within`).
- Touch targets, measured for every link, button, input and summary at 1100 px (`targets.cjs`): under 44 px before: 31 of 35; after: 0 of 44. The "?" buttons look 22 px but have a 44 px hit area (::after).
- Keyboard: 79 tab stops in a full tab-through; every one shows an outline of 2 px or more except the native checkbox (its label shows the ring). Plotly removes the outline on modebar buttons, so an `!important` rule restores it. Not fixable from my files: the landing chart (LandingChart.tsx) is mouse-click only; the date field does the same job.
- ARIA: "?" buttons already had `aria-label="Explain: ..."` and `aria-expanded`; kept. Map links carry hidden text "(opens in a new tab)".
- `prefers-reduced-motion`: CSS transitions and animations off. Plotly draws without animation.
- No horizontal scroll at 360x800: `scrollWidth` 360 = `innerWidth` 360 for the full page, and for the sky graph with terrain and all notes open. Screenshots in scratchpad `sky/app360.png` and `sky/t360.png`.
- axe-core (tags wcag2a, wcag2aa, wcag21a/aa, wcag22aa, best-practice; headless Chromium; 1100 and 360 px wide): base 55d5c59: 0 violations at both widths. After: 0 at both. (One serious "nested-interactive" appeared with `role="img"` mid-development and was fixed.) The base page was already axe-clean, so the gains are in what axe does not test: 44 px targets, 3:1 borders, focus ring, table alternative.
