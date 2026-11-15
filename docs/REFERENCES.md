# References

Only references that were opened and checked during this project are listed as verified. Anything else is marked **unverified** or left out.
"Used for" says what the project actually does with it. Verification notes come from the research files of the upgrade run (2026-11-14) and from the repository's own docs.

## NASA data and services

| Reference | URL | Used for | Status |
|---|---|---|---|
| NASA/JPL NAIF SPICE generic kernels | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ | `de440s.bsp` (Sun, Earth, Moon positions), `moon_pa_de440_200625.bpc` (Moon orientation), `moon_de440_250416.tf` (frame), `pck00011.tpc` (Moon radius). Exact URLs and sha256 in `backend/data/MANIFEST.json`. | Directory listings opened; file names read from them (`backend/kernels.py`). |
| NAIF usage rules | https://naif.jpl.nasa.gov/naif/rules.html | Acknowledgement of the kernels. | Cited in `backend/data/MANIFEST.json`; page not re-opened in this run. |
| JPL Horizons System, API | https://ssd.jpl.nasa.gov/horizons/ , https://ssd-api.jpl.nasa.gov/doc/horizons.html | Independent check of every computed Sun and Earth position (`docs/validation/horizons.md`). | Verified; listed as a resource on the challenge page. |
| JPL Deep Space Network, Telecommunications Link Design Handbook 810-005, Module 301 Rev K (2016-09-13), Table 5 (WGS 84 geodetic coordinates) | https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf | Coordinates of DSS 14, DSS 43, DSS 63 (`backend/dsn.py`). Checked against Table 2 to under 1 m (`backend/test_dsn.py`). | Verified (document opened, tables read). |
| NASA Open Data Portal | https://data.nasa.gov/ | Searched for datasets. Its LOLA entries are raw altimetry or catalogue pointers, not DEMs, so it is not cited as a source of any data we use. | Opened. |
| PDS Geosciences Node, LOLA data page | https://pds-geosciences.wustl.edu/missions/lro/lola.htm | Where LOLA elevation products are archived. | Page opened. |
| LOLA polar elevation grids (data set LRO-L-LOLA-4-GDR-V1.0): `LDEM_875S_5M_FLOAT`, `LDEM_80S_20M_FLOAT`, `LDEM_75S_60M_FLOAT` (float32, product V2.1) and `LDEM_60S_240M` (int16, V2.0) | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ (checksums: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx_261020.md5) | Terrain horizons in `frontend/public/horizons.json` (`backend/horizon/products.py`). Sizes and MD5 in `data/README.md`. Catalogue citation: Neumann, G.A., 2009, Lunar Orbiter Laser Altimeter Raw Data Set, LRO-L-LOLA-4-GDR-V1.0; instrument: Smith et al. 2009. | Directory listings, labels and checksums read 2026-11-14. Licence: the PDS Geosciences Node FAQ (https://pds-geosciences.wustl.edu/faq.html, read 15 Nov 2026) says "Data sets archived in the PDS are in the public domain" and asks that they be cited like published research. No LOLA-specific licence text was found. |
| LOLA average-visibility map `AVGVISIB_85S_060M_201608` (PDS LOLA extras) | PDS Geosciences Node, LOLA illumination extras (`backend/horizon/mazarico_ref.py`) | Independent cross-check of our terrain results (`docs/TERRAIN.md`, Validation 2). Not shipped in the app. | File read and MD5 checked (`docs/decisions/lola.md`); the period it covers is not stated in its label. |
| LRO Camera (LROC), IM-2 Athena landing | https://lroc.im-ldi.com/images/1408 | IM-2 position 84.7906 S, 29.1957 E. | Opened. |
| NASA LRO page on IM-1 Odysseus | https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ | IM-1 position 80.13 S, 1.44 E. | Opened. |
| LROC QuickMap | https://quickmap.lroc.im-ldi.com/ (old address https://quickmap.lroc.asu.edu/ redirects) | Deep links from each site card (`frontend/src/siteLinks.ts`), checked in a browser 2026-11-14. | Used as links only, not as data. |
| NASA Moon Trek | https://trek.nasa.gov/moon/ | Deep links from each site card, checked in a browser 2026-11-14. | Used as links only, not as data. |

## Published studies

| Reference | URL | Used for | Status |
|---|---|---|---|
| Pena-Asensio, Neira-Acosta, Sanchez-Lozano, arXiv:2406.19863 (v1) | https://arxiv.org/html/2406.19863v1 | Coordinates of the Peak Near Shackleton (Table 3, ID 1223, rank 15 of 20), Nobile Rim 2 (ID 358, rank 1) and de Gerlache Rim 2 (ID 726, rank 18) candidate points. The paper reports no sunlit percentage for them. | Verified (tables read). |
| Glaser, Oberst, Neumann, Mazarico, Speyerer, Robinson, "Illumination conditions at the lunar poles: Implications for future exploration" | https://ntrs.nasa.gov/citations/20170007365 | Published illumination values we compare against (`docs/SANITY.md`, Table 1 "This study" rows; `docs/TERRAIN.md`, Validation 1; 20 m/px LOLA terrain, 2017 to 2037). | PDF opened. Tables 1 and 2 read row by row from PDF word positions (15 Nov 2026); the values we quote are confirmed. Journal volume and pages were not verified; `docs/SANITY.md` calls it "Glaser et al. 2018". |
| Mazarico, Neumann, Smith, Zuber, Torrence (2011), "Illumination conditions of the lunar polar regions using LOLA topography", Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030 | https://ntrs.nasa.gov/citations/20120010094 | A location near the Shackleton crater rim is sunlit continuously for 240 days, longest total darkness about 1.5 days (abstract). Its ray-based method is the model for our horizon code and for the cross-check map (`docs/TERRAIN.md`). The per-site values in `docs/TERRAIN.md` are Mazarico's as reprinted in Glaser et al. 2018, Table 1: Shackleton (89.740 S, 201.2 E) 86.7 % average illumination, 90.5 % Sun visible, no night length given; Connecting Ridge C1 89.0 %, 92.7 %, longest shadow 141.12 h. | Abstract read. The full text is paywalled (Icarus) and NTRS has no PDF, so the paper's own tables were not read. |

## Cited in the earlier README, not re-checked

These were cited by the first version of the README. They were **not opened** during the upgrade run, so treat them as unverified. They are not used for any number in the app.

- NASA Scientific Visualization Studio 5038: https://svs.gsfc.nasa.gov/5038
- JPL Interplanetary Network Progress Report 42-176: https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html
- Folkner, Williams, Boggs (2008), *The Planetary and Lunar Ephemeris DE 421*, JPL IOM 343R-08-003 (the DE421 ephemeris is no longer used).

## The challenge

- Lunar Landing Site Navigator: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ (opened)
- Project Submission guide: https://www.spaceappschallenge.org/resources/project-submission-guide/ (opened; the rules for the two data fields)

## Software

Licences are read from the lockfiles by `.github/scripts/gen_third_party_notices.py` and listed in `THIRD_PARTY_NOTICES.md`.

- Skyfield, Brandon Rhodes: https://rhodesmill.org/skyfield/ (opened). Not a NASA product.
- NumPy: https://numpy.org/ ; React: https://react.dev/ ; Vite: https://vite.dev/ ; TypeScript: https://www.typescriptlang.org/ ; Plotly.js: https://plotly.com/javascript/ ; Vitest: https://vitest.dev/ ; pytest: https://pytest.org/ (project home pages, listed in the earlier README; licences per `THIRD_PARTY_NOTICES.md`).
- Demo video only: Playwright https://playwright.dev/ (recording), ffmpeg https://ffmpeg.org/ (editing, subtitles), edge-tts https://github.com/rany2/edge-tts (synthetic voiceover, Microsoft neural voice "en-GB-RyanNeural"; no person's voice).

## Left out on purpose

- A DE440 reference paper: no file in this repository or its research notes verifies a citation, so none is given. The kernels' own URLs are cited above instead.
- Wikipedia's IM-1 page (used by the first README for coordinates): replaced by the NASA LRO page above.
