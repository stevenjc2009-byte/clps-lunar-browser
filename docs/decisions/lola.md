# Decisions: LOLA terrain horizons (agent "lola", branch lola-terrain)

1. **DEM products.** Options: the float32 grids (2x size), the 10 m 85 S grid, the 30 m
   75 S grid, or the int16 set 5 m (87.5 S) + 20 m (80 S) + 60 m (75 S) + 240 m (60 S).
   Chose the int16 set (4.3 GB total). Why: int16 at 0.5 m steps is far finer than the
   horizon needs (0.5 m at 1 km is 0.03 deg); the 5 m grid covers every site within
   1.5 deg of the pole, the 20 m grid covers all 80-90 S sites, and the two coarse grids
   cover the long sight lines. The 30 m 75 S grid (1.86 GB) would only help the
   northern half of IM-1's first 10 km; skipped, IM-1 falls back to 60 m there and its
   landing position is itself uncertain by ~1.5 km.
2. **Range bands.** Near 0-10 km: finest grid covering the site (step 5 or 20 m).
   10-60 km: 60 m. Beyond: 240 m. Ray step = pixel size of the band's grid, so every
   pixel along the ray is visited and the coarse grids are not under-sampled. A point
   missing from the band's first grid falls back to the next coarser grid.
3. **R_max: per-ray stopping rule, not one fixed number.** A ray stops when a worst-case
   peak at 7027 m (the highest DN in any product used) at that range would sit below
   the horizon already found on every ray, and that worst-case angle is falling with
   range. This is exact (no terrain beyond can matter) and covers the spec's criterion
   "curvature drop exceeds the highest terrain". Hard cap 600 km (inside the 240 m
   grid's coverage); reaching it is reported as a warning. horizons.json meta.r_max_km
   is the largest stop distance over all sites.
4. **Exact geometry, 3-D.** Rays are built as true great circles in the Moon-fixed
   frame (p = cos(theta) u + sin(theta) t), elevation angle =
   atan2(r_t cos(theta) - r_o, r_t sin(theta)). Rays never use map-plane azimuths, so
   the pole singularity and map distortion cannot enter the azimuth.
5. **Azimuth convention** = Skyfield altaz (north toward the lunar north pole along
   the meridian, clockwise). Verified to < 0.05 deg against Skyfield's own altaz of a
   surface point 20 km away, at three sites (test_geometry.py).
6. **Projection.** Own forward/inverse (no pyproj: not installed, and the LOLA sphere
   projection is 4 lines). Followed the catalogue's forward formula; its printed inverse
   is inconsistent for X (documented in data/README.md) and the choice is checked on
   real terrain (Shackleton floor at the gazetteer position, mirror point high).
7. **Interpolation**: bilinear (4 pixel centres). Bicubic would overshoot at crater
   rims; at one-pixel ray steps bilinear is the standard choice (Mazarico et al. 2011
   use bilinear-type horizon sampling as far as we know; not verified).
8. **Datum**: heights are radius - 1737400 m, as in the labels; the observer is at
   R + ground + h_obs. No geoid applied (horizon geometry needs radii, not potential).
9. **Observer heights**: 0, 2, 5 m precomputed (no height-correction model).
10. **Rounding**: 2 decimals to nearest (0.005 deg is 0.4 m at 5 km); file < 1.5 MB.
11. **No multiprocessing.** NumPy vectorised over all azimuths at once; extra processes
   would each map the DEMs and the machine often has ~1 GB free. Run time is measured
   and reported in docs/TERRAIN.md instead.
12. **Site ids.** horizons.json holds every id from backend/sites.json and the lead's
   sites-v2.json (7 verified sites). The old id "shackleton" (-89.0051, 125.3093) is the
   same point as "peak-near-shackleton" (-89.00506, 125.3093; 4 m apart from rounding);
   both are computed and written so main's current UI and the v2 list both find a
   profile. backend/sites.json itself is not edited here (the lead owns the site list);
   run with `--sites <path to sites-v2.json>`.
13. **Sun statistics for validation** use the v1 constant Sun radius 0.2666 deg and
   linear 10-min interpolation (as the brief says); the engine's cubic interpolation
   may differ by a few tenths of a percent.
14. **Literature comparison** uses Glaser et al.'s exact points and period (2017-2037)
   computed with the same Skyfield method as sky.json, so period differences cannot
   explain disagreements. No parameter was adjusted after seeing the comparison.
15. **Per-site in-RAM DEM windows.** The DEMs sit on a spinning disk; random memmap
   reads made one cold horizon take 224 s (Shackleton rim). Options: multiprocessing
   (more RAM, same disk), downsampled caches (changes the data), or one contiguous read
   per site of a square window around it (band radius + 2 km margin, scaled by the
   stereographic scale factor so map distance always covers ground distance). Chose
   windows (~150 MB per site). Measured: windows 98 s cold read, horizon 1.2 s; result
   identical to the full-grid memmap path (max |diff| 0.000000 deg at Shackleton rim),
   and test_dem_real checks bit-identical sampling plus NaN outside the window.
