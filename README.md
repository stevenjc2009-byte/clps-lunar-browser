# CLPS Lunar Mission Browser

**NASA Space Apps Challenge 2026: Lunar Landing Site Navigator**

Compare Moon south-pole landing sites. For each site, see when the Sun is up (solar power) and when Earth is in view with a Deep Space Network dish able to hear it (radio contact with home), then get a plain-language verdict that says when two sites are too close to call.

**Not an official NASA product.** It is a student project for the NASA Space Apps Challenge. NASA has not reviewed or endorsed it, and it uses no NASA logo.

**Live site:** https://stevenjc2009-byte.github.io/clps-lunar-browser/ · **30-second demo video:** [`docs/demo-video.mp4`](docs/demo-video.mp4) (silent, English subtitles; how it was made: [`docs/video-script.md`](docs/video-script.md)) · **Backup slides (7):** [`docs/slides.pdf`](docs/slides.pdf) / [`docs/slides.pptx`](docs/slides.pptx)

Method in full: [`docs/METHOD.md`](docs/METHOD.md) · Verdict rules: [`docs/VERDICT.md`](docs/VERDICT.md) · Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md) · References: [`docs/REFERENCES.md`](docs/REFERENCES.md) · Build journal: [`docs/JOURNAL.md`](docs/JOURNAL.md)

## The problem

Landers at the lunar south pole live or die by two things:

- **Sunlight.** Solar panels need it. Lunar nights are long and colder than −150 °C.
- **A line of sight to Earth.** Without it, the lander can't radio home directly.

Near the pole the Sun never climbs high. It circles round the horizon once a month, so a small change in place or date can decide whether a lander has power and radio contact. Mission planners, students and the public need a simple way to compare sites side by side.

## What it does

- **Compare sites side by side** for a chosen landing date (15 Nov 2026 to 3 Dec 2027) and look-ahead window (**30 days** or **1 year**):
  - **Sun visible:** % of the window with the Sun's upper edge above the horizon.
  - **Earth visible** and **Link:** % of the window with Earth in view, and with Earth in view *and* a Deep Space Network dish seeing the Moon at 10° or more.
  - **Longest darkness:** the longest unbroken night, counted in full even if it began before landing or ends after the window. "≥" means it runs past the end of the loaded data, so its true length is unknown.
  - **Verdict:** a badge (best for energy, best for communication, shortest night, balanced) only when a site leads by a clear margin. A smaller lead is shown as *too close to call*. Rules: [`docs/VERDICT.md`](docs/VERDICT.md).
  - **After landing:** whether the Sun and Earth are up at the landing hour, and when that next changes.
- **Your own location.** Type any latitude and longitude on the Moon (between 89.99° S and 89.99° N; azimuth is undefined at the exact pole) and it joins the comparison, worked out in your browser from the same NASA ephemeris.
- **Sunlight by landing date.** A chart of the Sun % every possible landing date would give, one line per site.
- **Sky graph** for each site: the Sun's and Earth's height and compass direction over time.
- **"Explain it to me"** mode: every metric has a "?" note in plain language for students.
- **Honest about terrain.** A site without a terrain horizon uses a flat horizon and is flagged *provisional*. See Limitations.

Built-in sites (`backend/sites.json`; sources are in `sky.json`):

| Site | Latitude, longitude | Source | Status |
|---|---|---|---|
| Peak near Shackleton | 89.0051° S, 125.3093° E | arXiv:2406.19863, Table 3 (rank 15 of 20). About 1° from the pole, **not** on the crater rim | candidate |
| Shackleton rim | 89.7849° S, 156.03° W | Glaser et al., NASA NTRS 20170007365, Table 1 | candidate |
| Connecting Ridge | 89.4505° S, 137.16° W | Glaser et al., Table 1 | candidate |
| Nobile Rim 2 | 84.2016° S, 60.6999° E | arXiv:2406.19863, Table 3 (rank 1) | candidate |
| de Gerlache Rim 2 | 88.5157° S, 61.1673° W | arXiv:2406.19863, Table 3 (rank 18) | candidate |
| IM-2 Athena (Mons Mouton) | 84.7906° S, 29.1957° E | LROC image 1408 (actual resting place) | landing, 2025 |
| IM-1 Odysseus (Malapert A) | 80.13° S, 1.44° E | NASA LRO page | landing, 2024 |

No site has a stated position uncertainty (`uncertainty_m` is null for all seven).

## How it works (summary)

Full detail with every number cited to a file: [`docs/METHOD.md`](docs/METHOD.md).

1. **Backend** (`backend/`, Python + Skyfield) reads NASA NAIF kernels (JPL **DE440** ephemeris, DE440 Moon-orientation kernels, `MOON_ME` frame) and writes `frontend/public/sky.json`: hourly Sun and Earth altitude and azimuth for every site from 2026-09-01 to 2029-01-01 (20,473 samples), plus hourly Sun and Earth disc radius and the best Moon elevation seen from the three Deep Space Network complexes (Goldstone, Madrid, Canberra). `backend/export_vectors.py` writes `vectors.bin`, which lets the browser compute any custom location.
2. **Frontend** (`frontend/`, React 19, TypeScript, Vite, Plotly) loads those files and runs a visibility engine (`frontend/src/lib`): hourly data is smoothed to 10-minute steps, horizon crossings are placed to the minute, and every percentage, night and badge is computed from visible time intervals.
3. **Horizon.** The Sun counts as up when its top edge clears the skyline; Earth when its centre does. Defaults: observer height 2 m, mask offset 0°. The skyline comes from `horizons.json` (terrain) if that file is present, otherwise it is flat.
4. Only static files are served, so the site can be hosted anywhere.

## Data

| Data | Source | Used for |
|---|---|---|
| `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `pck00011.tpc` | NASA JPL NAIF, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ (URLs, sizes and sha256 in `backend/data/MANIFEST.json`) | Positions of the Sun, Earth and Moon; Moon orientation and radius |
| JPL Horizons | https://ssd.jpl.nasa.gov/horizons/ | Independent check of every computed position |
| DSN antenna coordinates | JPL 810-005 Module 301 Rev K, Table 5 | Deep Space Network link rule |
| Site coordinates | arXiv:2406.19863; Glaser et al. (NTRS 20170007365); LROC; NASA LRO | Built-in sites |
| LOLA terrain (NASA LRO laser altimeter) | NASA PDS Geosciences Node | Terrain horizons. **Being built on a separate branch (`lola-terrain`); not part of the shipped data until `frontend/public/horizons.json` exists.** |

Every source is listed with its URL and verification status in [`docs/REFERENCES.md`](docs/REFERENCES.md). Third-party code licences: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Validation

All numbers are from the reports in `docs/validation/` and `docs/SANITY.md`; each report names the script that makes it.

- **Against JPL Horizons** (`docs/validation/horizons.md`): 218 instants per site and body, 7 sites. Largest elevation error 4.7e-06 arcminutes, largest azimuth error 2.7e-05 arcminutes. Pass limit, fixed before the run: 0.05 arcminutes elevation. All 14 rows pass. The check can fail: moving a site by about 60 m made one row miss by 0.082 arcminutes.
- **10-minute interpolation** (`docs/validation/interpolation.md`): with the shipped 3-decimal data, largest altitude error 0.036 arcminutes and a horizon crossing placed within 2.42 minutes at worst.
- **DE421 to DE440** (`docs/validation/ephemeris-checks.md`): largest change 0.0008 arcminutes.
- **Sanity checks** (`docs/SANITY.md`): the Sun's height repeats every 29.51 to 29.56 days at every site (expected 29.53 days).
- **Against a published terrain-aware study** (`docs/SANITY.md`, section 2): with a flat horizon we get far less Sun than Glaser et al. (Shackleton rim 60.5 % vs 85.5 %; Connecting Ridge 57.8 % vs 81.3 %). This is expected, not tuned away. A flat 0° horizon cannot represent a high rim whose skyline lies below 0°. The terrain horizon is what should close the gap.

### Tests

Counts from a run of this branch on 2026-11-14:

| Command | Result |
|---|---|
| `cd frontend; ENGINE_SKY_V2=$PWD/public/sky.json npx vitest run` (PowerShell: `$env:ENGINE_SKY_V2="$PWD\public\sky.json"`) | 139 passed, 4 skipped |
| `cd frontend; npx vitest run` (no `ENGINE_SKY_V2`, what `npm test` does) | 134 passed, 5 skipped |
| `cd backend; py -3 -m pytest -q` (with the DE440 kernels downloaded) | 37 passed |
| `cd frontend; npx tsc -b` and `npx oxlint src` | exit 0, no findings |

The skipped tests need data files that are not always present (the v2 sky.json path, or the kernels). GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, frontend tests, build, and the backend tests with the kernels downloaded and checked against `MANIFEST.json`. The deploy workflow (`pages.yml`) runs the frontend tests and the build before publishing.

## Limitations

The full list is in [`docs/METHOD.md`](docs/METHOD.md), section 10. In short, this tool is **not** a mission-planning tool.

- **Terrain.** Until `horizons.json` ships, every site uses a flat horizon (lowered a little for observer height) and is marked provisional. Rankings among them are not reliable.
- **Geometry only.** No power, battery, thermal or radio model. "Link" means Earth is in view and a Deep Space Network 70 m dish sees the Moon at 10° or more. No schedule, relays or lander antenna.
- **Dates.** Data covers 2026-09-01 to 2029-01-01, UTC. The 18.6-year lunar orbit cycle is outside it.
- **Site positions** carry no stated uncertainty, and near the pole 60 m matters.

## Run it locally

Windows PowerShell, from the repository root. Python 3.13 and Node 20+ are needed.

```
py -3 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
.\.venv\Scripts\python.exe kernels.py                 # downloads the NAIF kernels (about 46 MB) and checks MANIFEST.json
cd ..\frontend
npm ci
npm run dev                                           # http://localhost:5173
npm run build                                         # static site in frontend/dist
```

### Rebuild the data and the reports

```
cd backend
.\.venv\Scripts\python.exe compute.py                 # writes ../frontend/public/sky.json (v2)
.\.venv\Scripts\python.exe export_vectors.py          # writes ../frontend/public/vectors.bin + vectors.json
.\.venv\Scripts\python.exe validate_horizons.py       # JPL Horizons comparison (needs internet unless cached) -> docs/validation/horizons.md
.\.venv\Scripts\python.exe compare_ephem.py           # DE421 vs DE440 -> docs/validation/ephemeris-checks.md
.\.venv\Scripts\python.exe tenmin.py                  # 10-minute interpolation check -> docs/validation/interpolation.md
.\.venv\Scripts\python.exe sanity.py                  # monthly-cycle and published-value checks -> docs/SANITY.md
.\.venv\Scripts\python.exe window_stats.py 2027-06-10 30   # cross-check one window straight from the ephemeris
.\.venv\Scripts\python.exe -m pytest -q               # backend tests
cd ..
py -3 docs/tools/merge_decisions.py                   # regenerate docs/DECISIONS.md from docs/decisions/*.md
py -3 .github/scripts/gen_third_party_notices.py      # regenerate THIRD_PARTY_NOTICES.md
```

## Tech stack

- **Backend:** Python 3.13, Skyfield 1.55, NumPy, pytest.
- **Frontend:** React 19, TypeScript, Vite, Plotly.js, Vitest, oxlint.
- **Hosting:** static files on GitHub Pages.

## Use of Super Intelligence (SI)

- The project idea, scope and plan are the team's own: what to build, which metrics, which sites, what to leave out.
- An SI coding assistant (Claude, by Anthropic) was used under the team's direction from the start to:
  - write and debug the Python and TypeScript code;
  - look up published reference values and site coordinates;
  - draft this README and the plain-language explanations.
- **For the upgrade described here, AI agents built much of the work.** Several Claude agents, working in parallel on separate branches overnight under the team's direction, wrote the DE440 backend, the visibility engine and verdict rules, the validation scripts and reports, the tests, the CI workflows, the in-app method panel and these documents. Each agent recorded its choices in `docs/decisions/`; the build history is in [`docs/JOURNAL.md`](docs/JOURNAL.md).
- The team reviews and decides what ships. Computed positions are checked against NASA JPL Horizons (see Validation), not trusted because an AI wrote the code.
- The favicon (a simple drawn icon: Sun, Earth and lunar ground) was written as SVG code by the SI assistant.
- The 30-second demo video and the backup slides were made by the SI assistant. The video is an automated, silent screen recording of the live site with subtitles; the slides use screenshots of the site. Both carry a visible "AI-made" watermark. There is no SI-generated photo, artwork, voice or person anywhere, and no NASA logo.

## Licence

MIT, copyright The Big Four. See [`LICENSE`](LICENSE). To cite: [`CITATION.cff`](CITATION.cff). Third-party software and data terms: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## References

See [`docs/REFERENCES.md`](docs/REFERENCES.md) for every source, its URL, what it is used for, and whether it was verified.
