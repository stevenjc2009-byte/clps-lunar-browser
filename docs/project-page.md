# Project Page text: ready to paste

These are the fields of the Space Apps 2026 Project Page form, in the form's order (from the official Project Submission Guide). Paste each block into the field with the same name.

**Deadline: 22:59 UK time, Sunday 15 Nov 2026** (23:59 Casablanca). The page stays editable until then.

**Both links are filled in below** and open without a login:

- **Link to Project Demo:** https://stevenjc2009-byte.github.io/clps-lunar-browser/demo-video.mp4 (the video served by the project site).
- **Link to Final Project:** the GitHub link, or the deployed site.

---

## Project Name

CLPS Lunar Mission Browser

## High-Level Project Summary

CLPS Lunar Mission Browser is a web tool that compares landing sites at the Moon's south pole. For any landing date it shows how often each site sees the Sun (for solar power) and Earth (for direct radio contact), and how long its longest night lasts. It then gives a plain-language verdict: best for energy, best for communication, shortest night, balanced, or "too close to call" when the difference is small.

Near the pole the Sun never rises high. It skims round the horizon once a month, so a small change in place or date decides whether a lander has power and a link home. Our Sun and Earth positions come from NASA JPL's DE440 ephemeris and match NASA JPL Horizons. The skyline at each of the seven listed sites comes from real NASA LOLA laser-altimeter terrain data. An "Explain it to me" mode makes every number understandable to a student.

Not an official NASA product.

## Link to Project Demo

Demo video: https://stevenjc2009-byte.github.io/clps-lunar-browser/demo-video.mp4

(The file is `docs/demo-video.mp4` in the repository. Backup slides, if a slide deck is used instead: `docs/slides.pdf`, 7 slides.)

## Link to Final Project

https://github.com/stevenjc2009-byte/clps-lunar-browser

Live site: https://stevenjc2009-byte.github.io/clps-lunar-browser/

## Detailed Project Description

**What it does**

- Compare seven south-pole sites for a chosen landing date (15 Nov 2026 to 3 Dec 2027) and a look-ahead of 30 days or 1 year.
- For each site the tool shows:
  - **Sun visible:** % of the time the Sun is above the skyline. This decides solar power.
  - **Earth visible** and **Link:** % of the time Earth is in view, and in view while a NASA Deep Space Network dish can see the Moon.
  - **Longest darkness:** the longest unbroken night.
  - **A verdict.** A badge is given only when a site leads by a clear margin. A smaller lead is shown as "too close to call".
  - **After landing:** whether the Sun and Earth are up at the landing hour, and when that next changes.
- **Real terrain.** The skyline at each listed site is built from NASA LOLA elevation data.
- **Model settings and presets:** observer height, a skyline safety margin, how Earth counts as in view, and the Deep Space Network limit.
- **"How sure are these numbers?"** shows how the answers change when those settings change.
- **Charts:** Sun % by landing date, a best-landing-dates heatmap, a compare-two-dates panel, and a sky graph of the Sun and Earth.
- **Your own location:** type any latitude and longitude and it joins the comparison. It has no terrain data, so it is marked provisional.
- **Look at the site:** links to LROC QuickMap and NASA Moon Trek, centred on each site.
- **Shareable URL:** the page address holds your whole view. There are no file exports.
- "Explain it to me" puts a plain-language note on every number. The page works with the keyboard.

**How it works**

1. A Python back end uses the Skyfield library with NASA JPL's DE440 ephemeris and NASA NAIF's lunar orientation kernels. It computes the Sun and Earth height and compass direction from each site every hour from 1 Sep 2026 to 1 Jan 2029 (20,473 samples).
2. A second Python tool turns NASA LOLA elevation grids into a terrain skyline for each site, in every compass direction, for observer heights of 0, 2 and 5 m.
3. The React web page loads those files, smooths the hourly data to 10-minute steps, and works out every percentage, night and verdict from the time intervals when the Sun or Earth is above the skyline.
4. The site is static files only, so it loads fast and can be hosted anywhere.

**Validation**

- Every computed Sun and Earth position was checked against NASA JPL Horizons: 218 instants for each of the 7 sites. The largest difference was 2.7e-05 arcminutes (`docs/validation/horizons.md`).
- We confirmed the check can fail: moving a site by about 60 m made one row miss its limit.
- Terrain check: with LOLA terrain at 2 m observer height over one year, Shackleton rim gets 86.7 % Sun and Connecting Ridge 86.6 % (`docs/terrain-validation.json`). Published values are 85.5 % and 81.3 % (Glaser et al.), but those are at ground level over 20 years, so this is a rough agreement. Before terrain, our flat-horizon model gave only 60.5 % and 57.8 %, and we showed that gap rather than hide it.
- Automated tests: 207 front-end tests pass (4 skipped), 6 browser tests pass (including an accessibility check), and 73 back-end tests pass (2 skipped).
- Stated openly: our 2 m longest nights are longer than the published ones (Connecting Ridge 259 h vs 112 h). The longest night hangs on a few thousandths of a degree of ground within 0.5 km and on fractions of a metre of eye height; ignoring that nearby ground gives 104 h and 65 h against the published 112 h and 65 h. We found no bug.

**Benefits**

- One page answers the two questions every south-pole lander faces: will it have power, and can it call home?
- Planners can compare candidate sites and landing dates in seconds.
- Students and the public can see why the Moon's south pole is so hard, and so valuable.

**What we hope to achieve**

A clear, honest first look at a site before detailed studies. Next steps would be:

- terrain for custom locations, not only the seven listed sites;
- a power and battery model, not just geometry;
- relay-satellite coverage in the communication score.

**Tools**

- Python 3.13, Skyfield 1.55, NumPy.
- React 19, TypeScript, Vite, Plotly.js.
- Vitest, pytest, Playwright and axe for automated tests; GitHub Pages for hosting.
- NASA JPL Horizons API for validation.
- Git.

**Assumptions and limitations (stated openly)**

- This is not a mission-planning tool: geometry only, no power, battery, thermal or radio model.
- A custom spot uses a flat horizon and is marked provisional.
- Near a ridge, 50 to 100 m can change the Sun % a lot, so results depend on exact site coordinates. No site position has a stated uncertainty.
- Data covers 1 Sep 2026 to 1 Jan 2029, UTC; the 18.6-year lunar orbit cycle is outside it.
- "Link" means Earth is in view and a Deep Space Network 70 m dish sees the Moon at 10 degrees or more. No schedule, relays or lander antenna.

## Use of Super Intelligence (SI)

(Not shown to judges. **Check it is true for your team before pasting.**)

- The project idea, scope and plan are the team's own: what to build, which metrics, which sites, and what to leave out.
- We used an SI coding assistant (Claude, by Anthropic), under the team's direction, to:
  - write and debug the Python and TypeScript code, including the LOLA terrain-horizon code and its validation;
  - look up published reference values and site coordinates;
  - draft the README, the plain-language explanations and this text.
- The team reviewed the output, and every computed position was checked against NASA JPL Horizons.
- The favicon (a simple drawn icon: Sun, Earth and lunar ground) was written as SVG code by the SI assistant.
- The 30-second demo video and the backup slides were also made by the SI assistant. The video is an automated, silent screen recording of the live site with subtitles; the slides use screenshots of the site. Both carry a visible "AI-made" watermark. There is no SI-generated photo, artwork, voice or person anywhere.

## NASA Data

- **NASA JPL DE440 planetary ephemeris** (`de440s.bsp`): positions of the Sun, Earth and Moon. https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- **NASA NAIF SPICE kernels**: the Moon's orientation and size, so a lunar latitude and longitude becomes a real place in space (`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `pck00011.tpc`).
- **NASA JPL Horizons system/API**: independent validation of every computed Sun and Earth position. https://ssd.jpl.nasa.gov/horizons/
- **NASA JPL Deep Space Network** station positions (DSS 14, DSS 43, DSS 63), from the DSN handbook 810-005 Module 301 Rev K, Table 5. https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf
- **LRO LOLA polar elevation grids** (LDEM_875S_5M_FLOAT, LDEM_80S_20M_FLOAT, LDEM_75S_60M_FLOAT, LDEM_60S_240M) from the NASA PDS Geosciences Node: terrain skylines for the seven sites. https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- **NASA LRO page and LROC (LRO Camera) page**: landing positions of IM-1 and IM-2. https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ , https://lroc.im-ldi.com/images/1408
- **Mazarico et al. 2011, LOLA illumination study**, NASA NTRS 20120010094, and **Glaser et al.**, NASA NTRS 20170007365: published values we compare with. https://ntrs.nasa.gov/citations/20120010094 , https://ntrs.nasa.gov/citations/20170007365

## Space Agency Partner Data and Other References

Data and science:

- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- Mazarico et al. (2011), Icarus 211: https://ntrs.nasa.gov/citations/20120010094
- Glaser et al., "Illumination conditions at the lunar poles": https://ntrs.nasa.gov/citations/20170007365
- Site coordinates:
  - Candidate points: arXiv:2406.19863, https://arxiv.org/html/2406.19863v1
  - Shackleton rim and Connecting Ridge: Glaser et al., as above
  - IM-2: LROC, https://lroc.im-ldi.com/images/1408
  - IM-1: NASA LRO page, link above
- Links only (not used as data): LROC QuickMap https://quickmap.lroc.im-ldi.com/ and NASA Moon Trek https://trek.nasa.gov/moon/

Software (open source; licences in `THIRD_PARTY_NOTICES.md`):

- Skyfield (MIT): https://rhodesmill.org/skyfield/
- NumPy, jplephem, sgp4, React, Vite, TypeScript, Plotly.js, Vitest, pytest, Playwright, axe-core

No Space Agency Partner data was used.
