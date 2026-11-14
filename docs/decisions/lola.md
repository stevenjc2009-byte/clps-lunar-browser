# Decisions: LOLA terrain horizons (agent "lola", branch lola-terrain)

1. **DEM products** (superseded in part by item 16: the near and mid bands now use the
   float versions of the same grids). Options: the float32 grids (2x size), the 10 m 85 S
   grid, the 30 m 75 S grid, or the int16 set 5 m (87.5 S) + 20 m (80 S) + 60 m (75 S) +
   240 m (60 S). First chose the int16 set (4.3 GB total), reasoning that 0.5 m steps are
   fine for horizons (0.5 m at 1 km is 0.03 deg) -- true far out, wrong at 5-50 m (item
   16). Coverage reasoning still holds: the 5 m grid covers every site within
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
16. **Float grids for the near and mid bands (bug found in validation, fixed).** The first
   full run (int16 grids) gave Shackleton S at surface level 52.9 % Sun visible against
   Glaser et al.'s 85.5 %, and the panoramas showed the 0 m horizon at exactly 0.00 deg on
   62 % of azimuths at Shackleton rim. Cause, measured: the int16 grids store heights in
   0.5 m steps (truncated); around the site the 5 m grid is flat 0.5 m plateaus, and a
   0.5 m step at 5 m range is a 5.7 deg fake slope. Options: smooth the DEM, skip the first
   N metres, or use the float32 versions of the same grids (PDS float_img/, V2.1). Chose
   the floats: same data without rounding, no tunable parameter. Cost: 8.3 GB download
   (5, 20, 60 m floats). The 240 m int16 grid stays for > 60 km (0.5 m there is < 0.0005
   deg). The literature numbers were NOT the target: the fix was chosen from the cause,
   and the after-fix comparison is reported as it comes out (docs/TERRAIN.md).
17. **Second, independent reference: the LOLA team's average-visibility map**
   (AVGVISIB_85S_060M_201608, PDS extras, 51 MB, MD5-checked; Mazarico et al. 2011 method,
   60 m DEM, surface level, "sunlit by any fraction of the disc"). Options: literature
   tables only, or also this map. Chose to add it: it is cheap, covers every site south
   of ~85 S, and was produced by different code from a different DEM, so agreement with it
   is real corroboration. It is read by `horizon.mazarico_ref` and only reported; nothing
   is fitted to it. Its period is not stated in the label, so differences of a few percent
   are expected for that reason alone.
18. **Sabotage check found a test gap (fixed).** Breaking "upper limb" to "Sun centre"
   (`vis = a > h`) left every test green. Added test_visible_means_upper_limb_not_centre
   (Sun centre 0.1 deg below a flat horizon must count as visible); that arm is now red.
19. **Keep the 5 m near band, even though 20 m matches the literature better at 0 m.**
   Validation found 0 m results are resolution-dependent: Glaser's points at 0 m give
   71.7 / 40.7 / 43.4 % Sun-visible with the 5 m near band and 83.9 / 74.4 / 78.6 % with a
   20 m near band (Glaser: 85.5 / 81.3 / 80.6 %). Options: switch the shipped near band to
   20 m, or keep 5 m and report it. Kept 5 m: switching after seeing the comparison would
   be tuning toward the expected number, and 5 m is the more detailed data. The 2 m and
   5 m results move much less with resolution, so docs/TERRAIN.md recommends them; the
   20 m variant is in docs/terrain-validation.json for anyone who wants it.
