# Terrain horizons from LOLA

`frontend/public/horizons.json` gives, for every landing site, the elevation angle of the
local skyline (the terrain horizon) in every direction. The app uses it to decide when the
Sun is really above the hills, not just above a flat horizon.

## How to rebuild

```
cd backend
py -3 -m horizon.download                       # once: 8.4 GB of LOLA grids, MD5-checked
py -3 -m horizon.run --sites <sites-v2.json>    # writes frontend/public/horizons.json
py -3 -m horizon.validate                       # plots + Sun statistics + literature check
py -3 -m pytest horizon -q                      # tests (real-DEM tests skip without the grids)
```

`horizon.run` caches each finished site in `<data>/horizon-cache/`, keyed by the site
coordinates and every algorithm parameter, so a re-run only computes new or changed sites.

## Data

Four LOLA polar elevation grids from the PDS Geosciences Node (data set
LRO-L-LOLA-4-GDR-V1.0, 2017): float32 grids (product version 2.1) at 5 m/px (87.5-90 S),
20 m (80-90 S) and 60 m (75-90 S), and the int16 240 m grid (60-90 S, version 2.0).
Heights are radii minus 1737.4 km. Exact file names,
sizes, MD5 sums, projection, datum and nodata handling: [`data/README.md`](../data/README.md).

**Bug found by validation, fixed.** The first full run used the int16 versions of the
5/20/60 m grids. They store height in 0.5 m steps, and right next to the observer a 0.5 m
step looks like a slope of up to 5.7 deg (0.5 m at 5 m range). That run put the 0 m horizon at
exactly 0.00 deg on 62 % of azimuths at Shackleton rim and gave Shackleton S 52.9 % Sun
visible (Glaser: 85.5 %). The near and mid bands now read the float32 grids, which hold
the same data without the rounding. Details: `docs/decisions/lola.md` item 16.

## Method

- **Rays.** For each azimuth (every 0.25 deg, 1440 rays) a true great circle is walked
  outward from the site in the Moon-fixed frame: p = cos(theta) u + sin(theta) t.
  No map-plane azimuths are used, so the pole and the map distortion cannot bend a ray.
- **Elevation angle, exact.** For a terrain point at radius r_t and central angle theta,
  seen from radius r_o = 1737.4 km + ground + observer height:
  `angle = atan2(r_t cos(theta) - r_o, r_t sin(theta))`. No small-angle or flat-Moon
  approximation; Moon curvature is built in.
- **Resolution bands.** 0-10 km: the finest float grid covering the site (5 m inside
  87.5 S, else 20 m); 10-60 km: 60 m float; beyond 60 km: 240 m int16 (its 0.5 m height
  step is < 0.0005 deg there). The ray step equals the pixel size, so
  every pixel along the ray is visited. Points missing from a grid fall back to the next
  coarser one.
- **Interpolation.** Bilinear between the four nearest pixel centres.
- **Projection.** Our own polar-stereographic transform from the PDS catalogue, checked by
  a round-trip test and on real terrain: Shackleton crater's floor is found at the IAU
  gazetteer centre in all seven grids (int16 and float), and the east-west mirror point is high ground.
- **Azimuth.** Clockwise from local north (toward the lunar north pole), the same as
  Skyfield's `altaz()` and `sky.json`; a test checks agreement with Skyfield to < 0.05 deg.
- **Observer heights.** 0, 2 and 5 m above the DEM ground at the site.
- **R_max (how far to look).** Per ray, not a fixed number: the march stops once even the
  highest terrain in the data (7027 m above the reference sphere) at that range would sit
  below the horizon already found on every ray, and is dropping further with range. This
  is exact: nothing farther out can change the answer. The check runs every 256 steps, so
  stop distances come in 61.44 km steps of the 240 m band. Hard cap 600 km (never reached).
- **Position ring.** The same horizon for a 2 m observer at 50 m and 100 m from the site
  on 8 bearings (0.5 deg azimuth step), to show how sensitive the answer is to exactly
  where a lander sits.
- **Speed.** Per site, one contiguous read of a window of each grid into RAM, then
  vectorised NumPy over all azimuths. Window sampling is tested to be bit-identical to
  reading the full grid.

## Run time and output (measured 2026-11-14)

`py -3 -m horizon.run --sites sites-v2.json`, 8 site ids (the 7 verified sites plus the
old id `shackleton`), cold cache, DEMs on a spinning disk (D:), 16 GB PC with other jobs
running: **1700 s wall** (1698.5 s inside the script). Per site 38-472 s; almost all of it
is the one-time window read from disk (the horizon maths is about 1-2 s per site, ring
included). Output `frontend/public/horizons.json` = **0.68 MB** (limit 1.5 MB).

| site | DEM ground (m) | ray stop (km) | 2 m horizon min..max (deg) | time (s) |
|---|---|---|---|---|
| shackleton (old id) | 1182.1 | 244.3 | -1.89 .. 4.36 | 140.6 |
| im2 | 5322.2 | 182.9 | -1.47 .. 4.06 | 472.1 |
| im1 | 2594.5 | 182.9 | -0.25 .. 10.95 | 38.4 |
| peak-near-shackleton | 1182.1 | 244.3 | -1.90 .. 4.36 | 115.0 |
| shackleton-rim | 1737.4 | 244.3 | -2.66 .. 1.03 | 235.2 |
| connecting-ridge | 1957.2 | 305.8 | -2.77 .. 10.69 | 430.0 |
| nobile-rim-2 | 1122.5 | 244.3 | -1.82 .. 7.15 | 127.8 |
| de-gerlache-rim-2 | 579.2 | 244.3 | -2.12 .. 22.69 | 139.0 |

`meta.r_max_km` = 305.8 (connecting-ridge). Stop distances come in steps of 61.44 km
(256 steps of 240 m) because the stopping test runs every 256 steps; the 600 km cap was
never reached. A finished site is cached, so a re-run with unchanged inputs takes seconds.

## Tests

`cd backend && py -3 -m pytest horizon -q -p no:cacheprovider` -> **38 passed** (with all
grids present; the real-DEM tests skip when a grid is missing). 178 s, mostly cold DEM reads.

- **Synthetic terrain** (`test_horizon.py`): flat sphere gives exactly the curvature dip
  -acos(R/(R+h)) to 2e-5 deg, a cone gives its analytic angle, a ridge covers the right azimuth
  range, a pit raises the horizon, a peak at azimuth 359.9 deg shows up on both sides of
  0/360, and the stopping rule reports its distance.
- **Geometry** (`test_geometry.py`): stereographic round trip, orientation against the
  catalogue formula, ENU right-handed, azimuth vs Skyfield `altaz()` < 0.05 deg at three
  sites, exact elevation formula vs 3-D vectors.
- **Real DEMs** (`test_dem_real.py`): Shackleton's floor at the gazetteer centre in all 7
  grids (mirror point high); grids agree where they overlap; window sampling bit-identical
  to the full grid; float = unrounded int16 (< 0.5 m apart); the near band uses floats.
- **Sun statistics** (`test_sunstats.py`): disc fraction limits, 0/360 interpolation wrap,
  azimuth unwrapping, longest run, a terrain block, upper limb (not centre) decides "visible".

**Each test can fail.** Seven sabotage arms, each run in a scratch copy, broke one thing
at a time; every arm turned the suite red: east axis flipped (2 failed), observer height
dropped (2), stereographic mirror (6), small-angle elevation (4), upper limb -> centre (1;
this arm was green at first, which exposed a missing test, now added), window offset by
one pixel (2), float grid read in int16 units (2).

## Validation

`py -3 -m horizon.validate` (363 s) writes `docs/terrain-validation.json` and the plots
below. `py -3 -m horizon.mazarico_ref <sites.json>` gives the independent map values.
Nothing below was tuned: the bands, steps and grids were fixed before any comparison
(decisions 2, 3, 16), and stayed fixed after it.

### 1. Literature, same points and same period

Glaser et al. (NTRS 20170007365) used a 20 m LOLA DTM and 2017-01-01 .. 2037-01-01. We
use their exact points and period, with Sun positions from the same Skyfield method as
`sky.json`. "vis" = % of time any part of the Sun is above the horizon; "dark" = longest
continuous time with none of it visible.

| point | Glaser vis / dark | ours (5 m near band) | ours, 20 m near band | ours, 240 m only |
|---|---|---|---|---|
| Shackleton S, 0 m | 85.5 % / 221 h | 71.7 % / 645 h | **83.9 % / 230 h** | 68.3 % / 376 h |
| Connecting Ridge C1, 0 m | 81.3 % / 268 h | 40.7 % / 512 h | **74.4 % / 308 h** | 82.8 % / 185 h |
| Connecting Ridge C2, 0 m | 80.6 % / 166 h | 43.4 % / 557 h | **78.6 % / 166 h** | 78.2 % / 166 h |
| C1, 2 m | 92.1 % / 112 h | 79.7 % / 241 h | 89.8 % / 259 h | 88.9 % / 216 h |
| Shackleton, 2 m (low confidence: table text scrambled in the PDF) | 89.8 % / 65 h | 85.1 % / 137 h | 83.8 % / 198 h | 90.4 % / 65 h |

Average sunlit (mean disc fraction), Glaser vs ours (5 m): Shackleton S 81.0 vs 64.1 %,
C1 76.0 vs 38.2 %, C2 75.6 vs 38.1 %, C1 2 m 88.0 vs 76.3 %, Shackleton 2 m 82.1 vs 78.3 %.
Mazarico et al. 2011 (240 m DEM, different period): Shackleton 86.7 %, C1 89.0 % with a
141 h longest night.

**What this shows.**
- **At Glaser's own resolution the engine matches them.** With a 20 m near band it
  reproduces their surface numbers to within 1.6-6.9 points of Sun-visible time. C2's
  longest night matches to the hour. This is the cleanest test of the engine itself,
  and it passes.
- **On the 5 m grid, a 0 m observer sees much less Sun.** C1 drops from 74 % to 41 %.
  The connecting-ridge polar plot shows why: at 0 m the horizon is raised by a few tens
  of metres of nearby ground. It drops by several degrees once the eye is 2 m up. An eye
  at ground level on a 5 m DEM sees every metre-sized bump next to it, and a 20 m DTM
  smooths those away.
- **So at 0 m the answer depends on DEM resolution, not just on the terrain.** The 2 m
  and 5 m results are the robust ones, and the app should prefer them.
- **This is not the int16 bug coming back.** The float grids have no 0.5 m steps, and the
  20 m near band, read through the same code, agrees with Glaser.
- **Our 2 m longest nights are longer than Glaser's in every variant** (C1 216-259 h vs
  112 h). This is not explained. Their Table 2 point may differ (it is 1.2 km from C1),
  or the table may be misread from the PDF. Not investigated further.

### 2. Independent map: LOLA team average visibility (Mazarico et al. method)

`AVGVISIB_85S_060M_201608` (60 m DEM, surface level, fraction of time any part of the
disc is up; period not stated in the label). Our numbers cover the year from 2026-11-15,
so the periods differ.

| site | map, nearest pixel | map, bilinear | map, 3x3 pixel range | ours 0 m | ours 2 m |
|---|---|---|---|---|---|
| shackleton-rim (= Glaser S) | 85.5 % | 74.9 % | 43.2-85.5 % | 72.5 % | 86.7 % |
| connecting-ridge (= Glaser C1) | 86.4 % | 65.5 % | 0.0-86.4 % | 40.2 % | 86.6 % |
| peak-near-shackleton | 14.4 % | 15.2 % | 14.4-38.6 % | 21.7 % | 41.4 % |
| de-gerlache-rim-2 | 19.2 % | 19.7 % | 15.8-23.1 % | 17.5 % | 20.4 % |
| im2 | 45.1 % | 46.0 % | 40.3-46.9 % | 48.1 % | 48.5 % |
| nobile-rim-2, im1 | outside the map | | | 30.0 / 36.5 % | 34.4 / 40.0 % |

At the connecting ridge the map's own 60 m neighbours range from 0 % to 86 %. The ridge
crest is narrower than one pixel. On the crest the site is best-lit; 60 m off it, the
ground can be permanently dark. Our position ring shows the same thing (below).

### 3. Every site: one year from 2026-11-15 (sky.json Sun track, 10-min steps)

| site | Sun visible 0 / 2 / 5 m | longest dark 0 / 2 / 5 m | 2 m ring (50 and 100 m away): visible, longest dark |
|---|---|---|---|
| shackleton-rim | 72.5 / 86.7 / 90.8 % | 637 / 177 / 63 h | 40.2-82.7 %, 206-2083 h |
| connecting-ridge | 40.2 / 86.6 / 90.9 % | 509 / 128 / 89 h | 22.0-87.2 %, 122-682 h |
| peak-near-shackleton | 21.7 / 41.4 / 43.7 % | 700 / 670 / 668 h | 28.1-43.2 %, 670-2098 h |
| shackleton (old id, same point) | 21.6 / 41.4 / 43.7 % | 699 / 670 / 668 h | 28.6-43.2 %, 669-2099 h |
| de-gerlache-rim-2 | 17.5 / 20.4 / 23.5 % | 2113 / 2068 / 698 h | 16.1-26.5 %, 685-2708 h |
| nobile-rim-2 | 30.0 / 34.4 / 36.3 % | 563 / 522 / 493 h | 30.6-38.2 %, 472-557 h |
| im2 | 48.1 / 48.5 / 48.9 % | 413 / 412 / 409 h | 46.2-48.7 %, 409-445 h |
| im1 | 36.5 / 40.0 / 41.5 % | 478 / 455 / 445 h | 37.8-41.6 %, 445-469 h |

One year is only part of the 18.6-year lunar cycle, so these are not long-term averages.

**Findings.**
- **peak-near-shackleton and de-gerlache-rim-2 are poorly lit**: 41 % and 20 % at 2 m.
  The independent LOLA map agrees (14-39 % and 16-23 %).
- **This is a real result, not a coordinate or code error.** Both points come from
  Pena-Asensio et al. (arXiv:2406.19863, Table 3). That paper ranked points for a 40 m
  observer on a mix of visible area, illumination x PSR fraction, Earth visibility and
  geology. It did not pick them for sunlight at 2 m.
- **de-gerlache-rim-2 sits below a wall.** Terrain rises to 20-24 deg from west through
  north; the ground is at 579 m and is 1 km higher within a few km.
- **The two ridge sites are well lit only exactly on the crest.** 50-100 m away, the 2 m
  ring spans 22-87 % (connecting ridge) and 40-83 % (Shackleton rim). The map's pixel
  spread says the same.
- **im1 sits on a slope.** Terrain rises up to 11-13 deg from north-east to south. The
  low polar Sun (max about 10 deg at 80 S) is blocked there for much of each day.
- **The old id `shackleton` is the same point as `peak-near-shackleton`** (4 m apart).
  Their numbers agree to 0.1 %, which also shows that the cache and windows give the same
  answer twice.

### 4. Plots (looked at)

Panorama: terrain horizon against azimuth for 0, 2 and 5 m, with one year of hourly Sun
positions. Polar: horizon elevation against azimuth, with landmark directions.

- [shackleton-rim panorama](img/horizon-shackleton-rim-panorama.png) / [polar](img/horizon-shackleton-rim-polar.png)
- [connecting-ridge panorama](img/horizon-connecting-ridge-panorama.png) / [polar](img/horizon-connecting-ridge-polar.png)
- [peak-near-shackleton panorama](img/horizon-peak-near-shackleton-panorama.png) / [polar](img/horizon-peak-near-shackleton-polar.png)
- [de-gerlache-rim-2 panorama](img/horizon-de-gerlache-rim-2-panorama.png) / [polar](img/horizon-de-gerlache-rim-2-polar.png)
- [nobile-rim-2 panorama](img/horizon-nobile-rim-2-panorama.png) / [polar](img/horizon-nobile-rim-2-polar.png)
- [im2 panorama](img/horizon-im2-panorama.png) / [polar](img/horizon-im2-polar.png)
- [im1 panorama](img/horizon-im1-panorama.png) / [polar](img/horizon-im1-polar.png)
- [shackleton (old id) panorama](img/horizon-shackleton-panorama.png) / [polar](img/horizon-shackleton-polar.png)

What was checked by eye:
- The Sun track peaks toward north.
- The 0 m curve lies on or above the 2 m and 5 m curves.
- No flat stretches sit at exactly 0.00 deg any more (the int16 artefact).
- The de-gerlache-rim-2 wall is to the west and north.

### 5. Not verified

- **Glaser Table 2 values.** These were read from scrambled PDF text; the Shackleton 2 m
  row is low confidence.
- **The map's illumination period.** It is not stated in the map's label.
- **Why our 2 m nights are longer than Glaser's.** Not found.
- **Licence.** No licence text was found on the data pages. NASA data are generally
  public domain, but this was not confirmed with NASA.

