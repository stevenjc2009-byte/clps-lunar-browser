# Text for the Space Apps submission form

Two form fields (rules: https://www.spaceappschallenge.org/resources/project-submission-guide/ , opened 2026-11-14). The guide says a team must use at least one NASA data set or resource to be eligible for a Global Award, and that partner-agency data is encouraged.

How to use this page: paste the text between the lines. Lines in **[square brackets]** are conditions. Keep a bracketed paragraph only if the condition is true on the day you submit, and delete the bracket tag. If it is not true, delete the whole paragraph.

Truth notes (checked against the repository on the docs branch):

- The ephemeris is **DE440** (`de440s.bsp`), not DE421. The old README said DE421; it is replaced.
- DSN antenna coordinates are verified: JPL 810-005 Module 301 Rev K, Table 5 (`backend/dsn.py`, `backend/test_dsn.py`). So the Deep Space Network can be claimed.
- LOLA terrain is **not** in the shipped data on this branch. Claim it only if `frontend/public/horizons.json` exists on `main` and the live site shows terrain.
- QuickMap and Moon Trek are challenge-listed resources, but the app does not use them as data. Claim them only if links to them have shipped in the app.
- No CSA data is used. CSA is not listed below.

---

## Field 1: "NASA Data"

The app uses NASA data throughout.

1. NASA JPL planetary ephemeris DE440 (file `de440s.bsp`) from NASA's NAIF (Navigation and Ancillary Information Facility), https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ . It gives the positions of the Sun, Earth and Moon from 1 September 2026 to 1 January 2029. With it, NAIF's lunar orientation kernels (`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`) and the Moon radius kernel (`pck00011.tpc`) turn a latitude and longitude on the Moon into a real place in space. The exact file URLs, sizes and sha256 checksums are published in `backend/data/MANIFEST.json` in our repository.
2. NASA JPL Horizons System, https://ssd.jpl.nasa.gov/horizons/ (a resource listed for this challenge). We compared every computed Sun and Earth elevation and azimuth with Horizons at 218 instants for each of our 7 sites. The largest difference was 2.7e-05 arcminutes, far inside our pass limit of 0.05 arcminutes for elevation (report: `docs/validation/horizons.md`).
3. NASA JPL Deep Space Network station positions for the Goldstone (DSS 14), Madrid (DSS 63) and Canberra (DSS 43) 70-metre antennas, from the DSN Telecommunications Link Design Handbook 810-005, Module 301 Rev K, Table 5, https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf . We count a "link" only when Earth is in view and one of these dishes sees the Moon at 10 degrees or more.
4. Landing-site positions: for IM-1 Odysseus, the NASA Lunar Reconnaissance Orbiter (LRO) page https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ ; for IM-2 Athena, the LRO Camera (LROC) page https://lroc.im-ldi.com/images/1408 .

**[only if terrain merged]** 5. Terrain horizons use elevation data from the Lunar Orbiter Laser Altimeter (LOLA) on NASA's Lunar Reconnaissance Orbiter, archived by the NASA Planetary Data System Geosciences Node, https://pds-geosciences.wustl.edu/missions/lro/lola.htm . For each site we computed how high the skyline is in every compass direction and used it to decide when the Sun and Earth are visible. The exact DEM files are listed in `horizons.json` under `meta.dem_products`. (Before pasting, check that list and name the products it really contains.)

---

## Field 2: "Space Agency Partner Data and Other References"

We used no space-agency partner data. Everything below is other data, software and references.

Published studies (all opened and read for this project):

- Pena-Asensio, Neira-Acosta and Sanchez-Lozano, arXiv:2406.19863, https://arxiv.org/html/2406.19863v1 : coordinates of three candidate south-pole points (Table 3).
- Glaser, Oberst, Neumann, Mazarico, Speyerer and Robinson, "Illumination conditions at the lunar poles: Implications for future exploration", https://ntrs.nasa.gov/citations/20170007365 : published sunlight values we compare our results with.
- Mazarico, Neumann, Smith, Zuber and Torrence (2011), Icarus 211, "Illumination conditions of the lunar polar regions using LOLA topography", https://ntrs.nasa.gov/citations/20120010094 (abstract read): the published figure for a site near the Shackleton rim.

Software (all open source; licences in `THIRD_PARTY_NOTICES.md`): Skyfield (Brandon Rhodes, MIT), NumPy, jplephem, sgp4, React, Vite, TypeScript, Plotly.js, Vitest, pytest.

**[only if links shipped]** Cross-checks and links to NASA Moon Trek, https://trek.nasa.gov/moon/ , and LROC QuickMap, https://quickmap.lroc.im-ldi.com/ , are provided inside the app so users can look at each site on the Moon. (Delete this paragraph if the app has no such links.)

Everything the team wrote (code, text, explanations) is original and released under the MIT licence. The code, text and this submission text were written with AI coding assistants (Claude, by Anthropic) under the team's direction; see the README of https://github.com/stevenjc2009-byte/clps-lunar-browser . There is no AI-generated photo, voice or person in the project, and no NASA logo. This is not an official NASA product.

---

## Open items for the team (not part of the pasted text)

- Decide on the day whether the **[only if terrain merged]** and **[only if links shipped]** paragraphs stay. Command to check terrain: `ls frontend/public/horizons.json` on `main`; to check links: open the live site and look for QuickMap / Moon Trek links.
- The submission guide says the SI-use question is for data collection and is not shown to judges, but SI-generated code and data must still be acknowledged in descriptive text and metadata. The last paragraph above does that.
- `docs/project-page.md` (the earlier project text, not edited by the docs branch) still says DE421, "13 dates x 2 bodies x 3 sites" and a 0.00001 degree match (lines 24, 53, 61, 113 at the time of writing). Do not paste from it until it is updated.
