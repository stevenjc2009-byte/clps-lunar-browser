# Project Page text: ready to paste

These are the fields of the Space Apps 2026 Project Page form, in the form's order (from the official Project Submission Guide). Paste each block into the field with the same name.

**Deadline: 22:59 UK time, Sunday 15 Nov 2026** (23:59 Casablanca). The page stays editable until then.

**Two fields need the team** before submitting:

- **Link to Project Demo:** the public video link, once uploaded.
- **Link to Final Project:** the GitHub link, or the deployed site.

Both links must open without a login.

---

## Project Name

CLPS Lunar Mission Browser

## High-Level Project Summary

CLPS Lunar Mission Browser is a web tool that compares landing sites at the Moon's south pole. For any landing date, it shows how often each site sees the Sun (for solar power) and Earth (for direct radio contact), and how long its longest night lasts. It then gives a plain-language verdict: best for energy, best for communication, or balanced.

Near the pole the Sun never rises high. It skims round the horizon once a month, so small changes in place or date decide whether a lander has power and a link home. Our positions come from NASA JPL's DE421 ephemeris and NAIF lunar kernels, and match NASA JPL Horizons to within 0.00001°. An "Explain it to me" mode makes every number understandable to a student.

## Link to Project Demo

(the team adds the public link to the 30-second video)

## Link to Final Project

https://github.com/stevenjc2009-byte/clps-lunar-browser

Live site: https://stevenjc2009-byte.github.io/clps-lunar-browser/

## Detailed Project Description

**What it does**

- Pick 2 or 3 south-pole sites, a landing date, and a look-ahead of 30 days (one lunar day-night cycle) or 1 year (the Moon's seasons).
- For each site the tool shows:
  - **Sun visible:** % of hours the Sun is above the horizon. This decides solar power.
  - **Earth visible:** % of hours Earth is above the horizon. This decides direct-to-Earth communication.
  - **Longest darkness:** the longest unbroken night the lander must survive on batteries.
  - **A verdict.** The site with the most sunlight is "best for energy". The one with the most Earth time is "best for communication". Of the rest, the one with the best weaker score is "balanced".
- A sky graph plots every hourly position of the Sun and Earth: compass direction across, height above the horizon up the side. It shows why polar sites are hard. The Sun circles just above and below the horizon, while Earth hangs in nearly the same patch of sky.
- "Explain it to me" puts a plain-language note on every number, for students and the public.

**How it works**

1. A Python back end uses the Skyfield library with NASA JPL's DE421 ephemeris and NASA NAIF's lunar orientation kernels (frame MOON_ME_DE421).
2. It computes the apparent elevation and azimuth of the Sun and Earth from each site every hour for two years: 17,544 samples per site, 15 Nov 2026 to 14 Nov 2028.
3. The React web page loads those positions and computes the comparison for whatever window the user picks.
4. The site is static files only, so it loads fast and can be hosted anywhere.

**Validation**

- Every position was checked against NASA JPL Horizons: 13 dates × 2 bodies × 3 sites.
- The largest difference was 0.0000083°.
- We confirmed the check fails when it should: shifting a site by 5° is caught.
- We compared Shackleton with a published LOLA-terrain study (Mazarico et al. 2011). Our flat-horizon model shows much longer nights than the real raised rim does: 112 days versus about 1.5 days. We explain why on the page and in the README rather than hide it.

**Benefits**

- One page answers the two questions every south-pole lander faces: will it have power, and can it call home?
- Planners can compare candidate sites and landing dates in seconds.
- Students and the public can see why the Moon's south pole is so hard, and so valuable.

**What we hope to achieve**

A clear, honest first look at a site before detailed terrain studies. Next steps would be:

- add real terrain horizons from LRO LOLA elevation data;
- allow custom coordinates;
- add a timeline of the next sunrise, sunset, Earthrise and Earthset.

**Tools**

- Python 3.13, Skyfield 1.55, NumPy.
- React 19, TypeScript, Vite, Plotly.js.
- NASA JPL Horizons API for validation.
- Git.

**Assumptions and limitations (stated openly)**

- Flat horizon: hills and crater walls are not modelled.
- A body counts as visible when its centre is above 0°.
- Hourly samples.
- "Communication" means Earth is in view. It does not cover antenna power or relay satellites.

## Use of Super Intelligence (SI)

(Not shown to judges. **Check it is true for your team before pasting.**)

- The project idea, scope and plan are the team's own: what to build, which metrics, the flat horizon, and what to leave out.
- We used an SI coding assistant (Claude, by Anthropic), under the team's direction, to:
  - write and debug the Python and TypeScript code;
  - look up published reference values and site coordinates;
  - draft the README, the plain-language explanations and this text.
- The team reviewed the output, and every computed position was checked against NASA JPL Horizons.
- The favicon (a simple drawn icon: Sun, Earth and lunar ground) was written as SVG code by the SI assistant. No other SI-generated images, video or audio are used.

## NASA Data

- **JPL DE421 planetary and lunar ephemeris** (`de421.bsp`): positions of the Sun, Earth and Moon.
- **NASA NAIF SPICE kernels**: the Moon's orientation, so a lunar latitude and longitude becomes a real place in space.
  - `moon_pa_de421_1900-2050.bpc`
  - `moon_080317.tf`
  - `pck00008.tpc`
- **NASA JPL Horizons system/API**: independent validation of every computed Sun and Earth position.
- **Mazarico et al. 2011, LOLA (Lunar Reconnaissance Orbiter) illumination study**, NASA NTRS 20120010094: published Shackleton reference values.
- **NASA Scientific Visualization Studio 5038** and **JPL IPN Progress Report 42-176**: published polar Sun-elevation and availability figures used for comparison.

## Space Agency Partner Data and Other References

Data and science:

- Folkner, Williams, Boggs (2008), *The Planetary and Lunar Ephemeris DE 421*, JPL IOM 343R-08-003. Kernels: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- Mazarico et al. (2011), Icarus 211: https://ntrs.nasa.gov/citations/20120010094
- JPL IPN Progress Report 42-176: https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html
- NASA SVS 5038: https://svs.gsfc.nasa.gov/5038
- Site coordinates:
  - Shackleton: arXiv:2406.19863, https://arxiv.org/html/2406.19863v1
  - IM-2: LROC, https://lroc.im-ldi.com/images/1401
  - IM-1: https://en.wikipedia.org/wiki/IM-1

Software (open source):

- Skyfield (MIT): https://rhodesmill.org/skyfield/
- NumPy (BSD-3-Clause)
- React (MIT)
- Vite (MIT)
- TypeScript (Apache-2.0)
- Plotly.js (MIT)

No Space Agency Partner data was used.
