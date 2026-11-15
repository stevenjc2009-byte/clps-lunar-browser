# Text for the Space Apps submission form

Two form fields (rules: https://www.spaceappschallenge.org/resources/project-submission-guide/ , opened 2026-11-14). The guide says a team must use at least one NASA data set or resource to be eligible for a Global Award, and that partner-agency data is encouraged.

How to use this page: paste the text between the lines into the form fields.

Truth notes (checked against the repository, `integration` branch):

- The ephemeris is **DE440** (`de440s.bsp`), not DE421.
- DSN antenna coordinates are verified: JPL 810-005 Module 301 Rev K, Table 5 (`backend/dsn.py`, `backend/test_dsn.py`).
- LOLA terrain is in the shipped data (`frontend/public/horizons.json`, all seven listed sites). Check on the day that it is also on `main` and that the live site shows terrain before submitting.
- QuickMap and Moon Trek links are in the app (`frontend/src/siteLinks.ts`). The app does not use them as data, only as links.
- No CSA data is used. CSA is not listed below.
- NASA data sources listed in Field 1: NAIF kernels, Horizons, DSN handbook, LRO page and LROC page for site positions, LOLA grids. Nothing else NASA-hosted is used as data.

---

## Field 1: "NASA Data"

The app uses NASA data throughout.

1. NASA JPL planetary ephemeris DE440 (file `de440s.bsp`) from NASA's NAIF (Navigation and Ancillary Information Facility), https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ . It gives the positions of the Sun, Earth and Moon from 1 September 2026 to 1 January 2029. With it, NAIF's lunar orientation kernels (`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`) and the Moon radius kernel (`pck00011.tpc`) turn a latitude and longitude on the Moon into a real place in space. The exact file URLs, sizes and sha256 checksums are published in `backend/data/MANIFEST.json` in our repository.
2. NASA JPL Horizons System, https://ssd.jpl.nasa.gov/horizons/ (a resource listed for this challenge). We compared every computed Sun and Earth elevation and azimuth with Horizons at 218 instants for each of our 7 sites. The largest difference was 2.7e-05 arcminutes, far inside our pass limit of 0.05 arcminutes for elevation (report: `docs/validation/horizons.md`).
3. NASA JPL Deep Space Network station positions for the Goldstone (DSS 14), Madrid (DSS 63) and Canberra (DSS 43) 70-metre antennas, from the DSN Telecommunications Link Design Handbook 810-005, Module 301 Rev K, Table 5, https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf . We count a "link" only when Earth is in view and one of these dishes sees the Moon at 10 degrees or more.
4. Landing-site positions: for IM-1 Odysseus, the NASA Lunar Reconnaissance Orbiter (LRO) page https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ ; for IM-2 Athena, the LRO Camera (LROC) page https://lroc.im-ldi.com/images/1408 .

5. Terrain horizons use elevation data from the Lunar Orbiter Laser Altimeter (LOLA) on NASA's Lunar Reconnaissance Orbiter, archived by the NASA Planetary Data System (PDS) Geosciences Node, https://pds-geosciences.wustl.edu/missions/lro/lola.htm (data set LRO-L-LOLA-4-GDR-V1.0, polar gridded elevation products under https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ ). The products used are LDEM_875S_5M_FLOAT (5 m per pixel), LDEM_80S_20M_FLOAT (20 m), LDEM_75S_60M_FLOAT (60 m) and LDEM_60S_240M (240 m). For each of our 7 sites we computed how high the skyline is in every compass direction and used it to decide when the Sun and Earth are visible. File names, sizes and MD5 checksums are in `data/README.md` and `frontend/public/horizons.json` (`meta.dem_products`) in our repository. We also read the LOLA team's average-visibility map `AVGVISIB_85S_060M_201608` from the same archive to cross-check our results (not shipped in the app).

---

## Field 2: "Space Agency Partner Data and Other References"

We used no space-agency partner data. Everything below is other data, software and references.

Published studies (all opened and read for this project):

- Pena-Asensio, Neira-Acosta and Sanchez-Lozano, arXiv:2406.19863, https://arxiv.org/html/2406.19863v1 : coordinates of three candidate south-pole points (Table 3).
- Glaser, Oberst, Neumann, Mazarico, Speyerer and Robinson, "Illumination conditions at the lunar poles: Implications for future exploration", https://ntrs.nasa.gov/citations/20170007365 : published sunlight values (Sun visible %, longest night) we compare our terrain results with (Tables 1 and 2, confirmed).
- Mazarico, Neumann, Smith, Zuber and Torrence (2011), Icarus 211, "Illumination conditions of the lunar polar regions using LOLA topography", https://ntrs.nasa.gov/citations/20120010094 (abstract read; per-site values quoted via Glaser et al. Table 1): the published method for sunlight from LOLA terrain, and a published figure for a site near the Shackleton rim. We also used its method for our cross-check map.

Challenge-listed resources: the NASA Horizons System (Field 1, item 2), LROC QuickMap and NASA Moon Trek (links only).

Software (all open source; licences in `THIRD_PARTY_NOTICES.md`): Skyfield (Brandon Rhodes, MIT), NumPy, jplephem, sgp4, React, Vite, TypeScript, Plotly.js, Vitest, pytest.

Cross-checks and links to NASA Moon Trek, https://trek.nasa.gov/moon/ , and LROC QuickMap, https://quickmap.lroc.im-ldi.com/ , are provided inside the app so users can look at each site on the Moon.

Everything the team wrote (code, text, explanations) is original and released under the MIT licence. The code, text and this submission text were written with AI coding assistants (Claude, by Anthropic) under the team's direction; see the README of https://github.com/stevenjc2009-byte/clps-lunar-browser . There is no AI-generated photo, voice or person in the project, and no NASA logo. This is not an official NASA product.

---

## Open items for the team (not part of the pasted text)

- Before submitting, open the live site and confirm it shows terrain (site cards without "Flat horizon" flags) and the QuickMap / Moon Trek links.
- LOLA licence: the PDS Geosciences Node FAQ (https://pds-geosciences.wustl.edu/faq.html, read 15 Nov 2026) says "Data sets archived in the PDS are in the public domain" and asks that they be cited like published research (`docs/TERRAIN.md`, "Not verified"). Nothing to do.
- The submission guide says the SI-use question is for data collection and is not shown to judges, but SI-generated code and data must still be acknowledged in descriptive text and metadata. The last paragraph above does that.
