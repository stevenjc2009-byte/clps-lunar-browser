# CLPS Lunar Mission Browser

**NASA Space Apps Challenge 2026: Lunar Landing Site Navigator**

Compare Moon south-pole landing sites. For each site, see when the Sun is up (solar power) and when Earth is in view (direct radio contact with home), then get a plain-language verdict.

## The problem

Landers at the lunar south pole live or die by two things:

- **Sunlight.** Solar panels need it. Lunar nights are long and colder than −150 °C.
- **A line of sight to Earth.** Without it, the lander can't radio home directly.

Near the pole, the Sun never climbs high. It circles round the horizon once a month, so a small change in place or date can decide whether a lander has power and radio contact. Mission planners, students and the public need a simple way to compare sites side by side.

## What it does

- **Compare 2 or 3 sites side by side** for a chosen landing date and look-ahead window (**30 days** or **1 year**):
  - **Sun visible:** % of hours the Sun's centre is above the horizon.
  - **Earth visible:** % of hours Earth's centre is above the horizon.
  - **Longest darkness:** the longest unbroken stretch with no Sun. "≥" means the night runs past the edge of the window.
  - **Verdict:**
    - most sunlight = *best for energy* (a tie goes to the shorter darkness);
    - most Earth time = *best for communication*;
    - of the remaining sites, the best weaker score = *balanced*.
- **Sky graph** for each site. Every hourly position of the Sun and Earth is plotted, with compass direction across and height above the horizon up the side.
- **"Explain it to me"** mode for students. Every metric has a "?" button with a plain-language note, and the header button opens all of them.

The built-in sites are:

| Site | Latitude, longitude | Why it's included |
|---|---|---|
| Shackleton rim (Peak Near Shackleton) | 89.0051° S, 125.3093° E | Artemis III candidate region; top-ranked point in arXiv:2406.19863, Table 3 |
| IM-2 Athena (Mons Mouton) | 84.791° S, 29.196° E | CLPS landing target, 2025 |
| IM-1 Odysseus (Malapert A) | 80.13° S, 1.44° E | CLPS landing site, 22 Feb 2024 |

## How it works

1. **Backend: `backend/compute.py`** (Python, Skyfield).
   - Loads NASA JPL's DE421 planetary ephemeris and the NAIF lunar orientation kernels.
   - Uses the Moon's mean-Earth/polar-axis body-fixed frame, `MOON_ME_DE421`.
   - For each site, computes the apparent elevation and azimuth of the Sun and Earth **every hour for two years**, from 15 Nov 2026 to 14 Nov 2028 (17,544 samples per site).
   - Writes the results to `frontend/public/sky.json`.
2. **Frontend: `frontend/`** (React, TypeScript, Vite, Plotly).
   - Loads `sky.json`.
   - Cuts out the window you picked and computes the comparison metrics in the browser (`src/metrics.ts`).

Only static files are served, so the site can be hosted anywhere.

## NASA data used

- **JPL DE421 planetary and lunar ephemeris** (`de421.bsp`): positions of the Sun, Earth and Moon.
- **NASA NAIF SPICE kernels**: the Moon's orientation, so a latitude and longitude on the Moon becomes a real place in space.
  - `moon_pa_de421_1900-2050.bpc`
  - `moon_080317.tf`
  - `pck00008.tpc`
- **JPL Horizons** (ssd.jpl.nasa.gov): independent check of every computed position (see Validation).
- **LRO / LOLA-based published illumination study** (Mazarico et al. 2011, NASA NTRS): the published reference value for Shackleton.

## Validation

### 1. Against NASA JPL Horizons

`backend/validate_horizons.py` asks the JPL Horizons API for the Sun's and Earth's elevation at each site, every 30 days through 2027. It then compares those values with ours. That is 13 dates × 2 bodies × 3 sites.

- **Largest difference: 0.0000083°.**
- The script exits with an error if any difference reaches 0.05°.
- We confirmed the check can fail. Moving a site 5° in longitude gives a 0.087° difference, which the script flags.

### 2. Against a published Shackleton value, and why ours differs

| | This tool (flat horizon), Peak Near Shackleton, 15 Nov 2026 to 15 Nov 2027 | Published, with real terrain |
|---|---|---|
| Sunlight | Sun up 53.0% of hours | A location near the Shackleton rim is sunlit **continuously for 240 days** each year (Mazarico et al. 2011). The best south-pole site has **92%** solar availability (JPL IPN Progress Report 42-176). |
| Longest darkness | 112.2 days | **About 1.5 days** (Mazarico et al. 2011) |
| Highest Sun | 2.54° above the horizon | Sun never more than about 1.5° above the horizon *at the pole* (NASA SVS 5038). Our site is 1.0° from the pole, so 1.54° tilt + 1.0° = 2.54°, which matches. |

**The difference is large, and it is expected.**

- We assume a **flat horizon** at 0°.
- The Shackleton rim is a high ridge, so its real horizon dips *below* 0°. It can still see the Sun when the Sun is a degree or two "below" a flat horizon.
- During the Moon's southern winter, the Sun stays slightly below 0° for months. A flat-horizon model therefore counts months of night that a real rim-top lander would not have.
- Our point is also not the exact point Mazarico et al. studied.

Our Sun and Earth *positions* match JPL Horizons. The difference comes from the terrain we chose not to model, and it is the main limitation below.

## Assumptions and limitations

- **Flat horizon.** A body counts as visible when its centre is above 0° elevation. Hills, crater walls and peaks are not modelled. This understates sunlight and overstates darkness on high rims, and it can overstate visibility in low ground.
- **Body centre, not disc edge.** The Sun is about 0.5° wide, so a partly risen Sun counts as "down".
- **Hourly samples.** Durations are accurate to about one hour.
- **Communication** means Earth is above the horizon. It does not cover antenna power, relays or the Deep Space Network schedule.
- **Dates:** 15 Nov 2026 to 14 Nov 2028, UTC.
- No map, terrain or data export. These were left out on purpose to keep the tool small, accurate and easy to use.

## Run it locally

Windows PowerShell, from the repository root. Python 3.13 and Node 20+ are needed.

```
py -3 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
.\.venv\Scripts\python.exe compute.py               # writes ../frontend/public/sky.json
.\.venv\Scripts\python.exe validate_horizons.py     # needs internet; exit 0 = matches JPL Horizons
.\.venv\Scripts\python.exe window_stats.py 2027-06-10 30   # cross-check the page's numbers for one window
cd ..\frontend
npm install
npm run dev                                         # http://localhost:5173
npm run build                                       # static site in frontend/dist
```

The NAIF and JPL kernels (about 17 MB) download automatically into `backend/data/` on the first run.

## Tech stack

- **Backend:** Python 3.13, Skyfield 1.55, NumPy 2.5.
- **Frontend:** React 19, TypeScript, Vite 8, Plotly.js 4.3.
- **Hosting:** static files only.

## Use of Super Intelligence (SI)

- The project idea, scope and plan are the team's own: what to build, which metrics, flat horizon, what to leave out.
- An SI coding assistant (Claude, by Anthropic) was used under the team's direction to:
  - write and debug the Python and TypeScript code;
  - look up published reference values and site coordinates;
  - draft this README and the plain-language explanations.
- The team reviewed the results. Every computed position was checked against NASA JPL Horizons (see Validation).
- The favicon (a simple drawn icon: Sun, Earth and lunar ground) was written as SVG code by the SI assistant. No other SI-generated images, video or audio are used.

## References

Data and science:

- JPL DE421 ephemeris: Folkner, W. M., Williams, J. G., Boggs, D. H. (2008), *The Planetary and Lunar Ephemeris DE 421*, JPL IOM 343R-08-003. File `de421.bsp` from NASA NAIF: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- NASA NAIF SPICE kernels `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- NASA JPL Horizons system and API: https://ssd.jpl.nasa.gov/horizons/
- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011), *Illumination conditions of the lunar polar regions using LOLA topography*, Icarus 211: https://ntrs.nasa.gov/citations/20120010094
- JPL Interplanetary Network Progress Report 42-176: https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html
- NASA Scientific Visualization Studio 5038: https://svs.gsfc.nasa.gov/5038
- Site coordinates:
  - Shackleton: arXiv:2406.19863, https://arxiv.org/html/2406.19863v1
  - IM-2: LROC, https://lroc.im-ldi.com/images/1401
  - IM-1: https://en.wikipedia.org/wiki/IM-1
- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

Software (all open source):

- Skyfield, Brandon Rhodes (MIT): https://rhodesmill.org/skyfield/
- NumPy (BSD-3-Clause): https://numpy.org/
- React (MIT): https://react.dev/
- Vite (MIT): https://vite.dev/
- TypeScript (Apache-2.0): https://www.typescriptlang.org/
- Plotly.js (MIT): https://plotly.com/javascript/
- The favicon `frontend/public/favicon.svg` was drawn for this project (SVG code written by the SI assistant).
