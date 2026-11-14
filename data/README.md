# LOLA terrain data (not stored in git)

The terrain horizons in `frontend/public/horizons.json` are computed from NASA Lunar
Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) polar elevation grids.
The grids themselves (about 4.3 GB) are **not** committed. Download them with:

```
cd backend
py -3 -m horizon.download            # to D:\clps-lola-data (or set CLPS_LOLA_DATA / --dest)
py -3 -m horizon.run                 # writes frontend/public/horizons.json
```

Everything below was read from the PDS server on 2026-11-14 (directory listings, PDS3
`.lbl` labels, the catalogue file `dsmap_polar.cat`, and the volume checksum manifest).

## Source

- Archive: NASA Planetary Data System (PDS) Geosciences Node, LRO LOLA page
  <https://pds-geosciences.wustl.edu/missions/lro/lola.htm>
- Data set: `LRO-L-LOLA-4-GDR-V1.0` ("LRO MOON LASER ALTIMETER 4 GDR V1.0"), product version
  V2.0, created 2017-06-15, LOLA data from 2009-07-13 to 2017-02-02 (mission phase LRO_ES_54).
- Directory: <https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/>
- Checksums: <https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx_261020.md5>
  (MD5, PDS volume manifest dated 2026-10-20).
- Citation requested by the data set catalogue (`catalog/gdr_ds.cat`): Neumann, G.A., 2009,
  Lunar Orbiter Laser Altimeter Raw Data Set, LRO-L-LOLA-4-GDR-V1.0, NASA Planetary Data
  System, 2010. Instrument reference: Smith et al. 2009 (SMITHETAL2009).
- Licence: no licence text appears in the labels or on the LOLA product pages. The PDS page
  footer links NASA's copyright/image-use policy; NASA-produced data are generally not
  subject to US copyright. We cite the source as above. (Not verified with NASA directly.)

## Products used

| File | Size (bytes) | MD5 (PDS manifest) | Pixel | Grid | Full coverage | Used for |
|---|---|---|---|---|---|---|
| `ldem_875s_5m.img` | 1,840,545,792 | `1C0391292D2579A7DC5F21DE1B1DFC6A` | 5 m | 30336 x 30336 | 87.5 S - 90 S | first 10 km at sites inside it |
| `ldem_80s_20m.img` | 1,848,320,000 | `F1388507C1984D5C963DE1F4323E43E8` | 20 m | 30400 x 30400 | 80 S - 90 S | first 10 km at sites outside 87.5 S (and fallback) |
| `ldem_75s_60m.img` | 465,003,008 | `8FEBFB6DF92A5F0E4AAEAA68CCAA11F4` | 60 m | 15248 x 15248 | 75 S - 90 S | 10 - 60 km (and near-range fallback) |
| `ldem_60s_240m.img` | 120,435,200 | `63C6F18693041352F5810D8C0397090A` | 240 m | 7760 x 7760 | 60 S - 90 S | beyond 60 km |

Each `.img` has a PDS3 label of the same name (`.lbl`, also downloaded and MD5-checked).
"Full coverage" is `MAXIMUM_LATITUDE` in the label; the square images reach further at
their corners. IM-1 (80.13 S) is only ~4 km inside the 20 m grid's northern edge; points
beyond the edge fall back to the 60 m grid (see `docs/decisions/lola.md`).

Other products in the same directory, not used: `ldem_85s_10m` / `_20m` / `_40m`,
`ldem_875s_10m` / `_20m`, `ldem_80s_40m` / `_80m`, `ldem_75s_30m` / `_120m` / `_240m`,
`ldem_60s_60m` / `_120m`, `ldem_45s_*`, and float versions under `polar/float_img/`
(e.g. `ldem_80s_20m_float.img`, 3,696,640,000 bytes). The `ldec_*` files are the matching
data-count grids.

## Format (from the labels)

- `SAMPLE_TYPE = LSB_INTEGER`, `SAMPLE_BITS = 16`, row-major, no header (`^IMAGE` at byte 0).
- `HEIGHT (m) = DN * 0.5` (`SCALING_FACTOR = 0.5`), relative to a sphere of radius
  `OFFSET = 1737400 m`. Planetary radius = DN * 0.5 + 1737400 m. This is a radius,
  **not** a height above a geoid ("planetopotential topography" would subtract a geoid).
- No `MISSING_CONSTANT` is defined: the grids are gap-filled by GMT `surface`. We still
  treat DN -32768 as no-data; a sampled scan of `ldem_60s_240m` found none.
- `DERIVED_MAXIMUM` / `MINIMUM` (DN): 875s_5m 4744 / -8760; 80s_20m 14054 / -14594;
  75s_60m 14053 / -15524; 60s_240m 14049 / -18253. Highest terrain in any product used:
  14054 * 0.5 = 7027 m (used for the ray stopping rule).

## Projection (labels + `catalog/dsmap_polar.cat`)

- `MAP_PROJECTION_TYPE = "POLAR STEREOGRAPHIC"`, spherical, `A/B/C_AXIS_RADIUS = 1737.4 km`,
  `CENTER_LATITUDE = -90`, `CENTER_LONGITUDE = 0`, `MAP_PROJECTION_ROTATION = 0`,
  `KEYWORD_LATITUDE_TYPE = PLANETOCENTRIC`, `POSITIVE_LONGITUDE_DIRECTION = EAST`,
  frame `MEAN EARTH/POLAR AXIS OF DE421`.
- `MAP_SCALE` (m/pixel, exact at the pole) as in the table; `LINE/SAMPLE_PROJECTION_OFFSET`
  = N/2 - 0.5 (e.g. 15199.5 for the 20 m grid); pixel-registered.
- Forward (catalogue): `X = (I - N/2 - 0.5) * MAP_SCALE`, `Y = -(J - N/2 - 0.5) * MAP_SCALE`
  (south), `LON = atan2(X, Y)`, `LAT = -90 + 2 atan(R / (2 * 1737400))` with R = sqrt(X^2+Y^2);
  I = sample, J = line, 1-based. Longitude 0 points up (Earthward), 90 E to the right.
- The catalogue's printed inverse multiplies X by SIGN(LAT) as well, which contradicts its
  own forward formula and text. We use the forward formula's inverse
  (`X = rho sin(lon)`, `Y = rho cos(lon)`, rho = 2 * 1737400 * tan((90 - |lat|) / 2)) and
  verified it on real terrain: Shackleton crater's floor is found at the IAU gazetteer
  centre (-89.67, 129.78 E) in all four grids, while the east/west mirror point is high
  ground (`backend/horizon/test_dem_real.py`).
