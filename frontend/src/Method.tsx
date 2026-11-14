// "Method & limits" panel: plain-language summary of docs/METHOD.md, the validation numbers,
// and an honest list of what the tool is and is not. The lead mounts it; it needs no other
// frontend file. Text is written for a school student: jargon is explained where it appears.
//
// VALIDATION below is HARD-CODED (not read at build time). Every number is copied from a
// report in the repository; the source file is named next to it. If a report is regenerated,
// update these by hand:
//   docs/validation/horizons.md          (JPL Horizons comparison)
//   docs/validation/interpolation.md     (hourly data vs 10-minute truth)
//   docs/validation/ephemeris-checks.md  (DE421 -> DE440)
//   docs/SANITY.md                       (monthly-cycle check, flat horizon vs published study)

import './method.css'

interface ValidationRow { what: string; result: string; limit: string; source: string }

const VALIDATION: ValidationRow[] = [
  {
    what: 'Sun and Earth direction vs NASA JPL Horizons (218 moments at each of 7 sites)',
    result: 'Biggest height error 0.0000047 arcminutes; biggest compass error 0.000027 arcminutes. All 14 site/body checks pass.',
    limit: 'Pass limit set before the run: 0.05 arcminutes (height), 1 arcminute (compass).',
    source: 'docs/validation/horizons.md',
  },
  {
    what: 'Hourly data turned into 10-minute steps vs directly computed 10-minute truth (60 days)',
    result: 'Biggest height error 0.036 arcminutes. A sunrise or sunset is placed within 2.42 minutes at worst (full-precision data: 0.00 minutes).',
    limit: 'The shipped file stores heights to 3 decimals. With 2 decimals the error was up to 35.41 minutes, so 3 were kept.',
    source: 'docs/validation/interpolation.md',
  },
  {
    what: 'Older NASA ephemeris (DE421) vs the one now used (DE440)',
    result: 'Biggest change 0.0008 arcminutes over the whole 2026 to 2029 range.',
    limit: 'Far too small to move any badge.',
    source: 'docs/validation/ephemeris-checks.md',
  },
  {
    what: 'Does the Sun repeat every lunar day (29.53 days)?',
    result: 'Sun height repeats every 29.51 to 29.56 days at all 7 sites.',
    limit: 'Expected 29.530589 days.',
    source: 'docs/SANITY.md',
  },
]

// docs/SANITY.md section 2: flat 0 degree horizon vs Glaser et al. (NASA NTRS 20170007365), Table 1.
// terrain = docs/terrain-validation.json sites.<id>["2"].sun_visible_pct (any part of the Sun, 2 m, 1 year from 15 Nov 2026).
const FLAT_VS_PUBLISHED = [
  { site: 'Shackleton rim point', ours: '60.5 %', terrain: '86.7 %', published: '85.5 %' },
  { site: 'Connecting Ridge point', ours: '57.8 %', terrain: '86.6 %', published: '81.3 %' },
]

const IS = [
  'A comparison of when the Sun and Earth are above the horizon at chosen Moon sites, using NASA’s own position files.',
  'Checked against NASA’s JPL Horizons service, with the error sizes shown above.',
  'Repeatable: the same inputs always give the same numbers and labels.',
  'Honest about doubt: a night that runs past the end of the data is shown as “at least”, and close calls are shown as “too close to call”.',
]

const ISNT = [
  'Not a tool for choosing a real landing site or date.',
  'Not a power, battery or temperature model. A battery check, where shown, is only an illustration.',
  'Not a radio simulation. “Link” only means Earth is in view and a big NASA Deep Space Network dish can see the Moon.',
  'Not terrain-accurate for every site yet. A site with no terrain data uses a flat horizon and is marked provisional.',
  'Not aware of shadows from the lander, rocks or dust.',
  'Not valid outside its data: 1 Sep 2026 to 1 Jan 2029. It does not cover the 18.6-year wobble of the Moon’s orbit.',
  'Not exact about where a lander sits. No site has a stated position error, and 60 m of latitude near the pole already changes an Earth height by 0.082 arcminutes.',
  'Not an official NASA product. NASA has not reviewed or endorsed it.',
]

export default function Method(props: { terrainLoaded: boolean }) {
  const { terrainLoaded } = props
  return (
    <details className="method" id="method">
      <summary>Method and limits: how the numbers are made, and what they cannot tell you</summary>
      <div className="method-body">
        <p className="method-note">Full write-up with file names: <code>docs/METHOD.md</code> in the project repository.</p>

        <p className={terrainLoaded ? 'method-flag ok' : 'method-flag'} role="status">
          {terrainLoaded
            ? 'Terrain data is loaded: the horizon follows real Moon terrain from NASA LOLA laser-altimeter maps for sites that have it.'
            : 'Terrain data is not loaded: every site uses a flat horizon, so rankings are provisional and not reliable.'}
        </p>

        <h3>Where the Sun and Earth are</h3>
        <p>
          Positions come from NASA JPL&rsquo;s planetary file DE440 and NASA NAIF&rsquo;s Moon-orientation files, read with the Skyfield
          library. A latitude and longitude on the Moon becomes a real point in space, and we ask how high the Sun and Earth are and in
          which compass direction. Light travel time and the bending of light are included. The Moon has no air, so there is no
          refraction.
        </p>

        <h3>From hourly data to 10-minute steps</h3>
        <p>
          The file holds one position per hour. The page fills in a position every 10 minutes with a smooth curve, then finds the exact
          moment a body crosses the horizon. Percentages count time, not samples.
        </p>

        <h3>When does the page say &ldquo;visible&rdquo;?</h3>
        <ul>
          <li><strong>Sun:</strong> up as soon as its top edge clears the horizon (first light on a solar panel).</li>
          <li><strong>Earth:</strong> up when its centre clears the horizon (other rules exist: any part, or the whole disc).</li>
          <li><strong>Eye or antenna height:</strong> 2 m by default. Standing higher lowers the horizon a little (0.087&deg; at 2 m, 0.137&deg; at 5 m).</li>
          <li><strong>Safety offset:</strong> 0&deg; by default. Raising it pretends the skyline is higher everywhere.</li>
        </ul>

        <h3>The radio link</h3>
        <p>
          A link counts only when Earth is in view <em>and</em> at least one NASA Deep Space Network dish (Goldstone, Madrid or
          Canberra) sees the Moon at 10&deg; or more above its own horizon. Dish positions come from JPL document 810-005, Module 301
          Rev K, Table 5.
        </p>

        <h3>Nights, and the &ldquo;at least&rdquo; sign</h3>
        <p>
          The longest night is counted in full, even if it started before landing or ends after the window. If a night touches the
          start or end of the loaded data, its true length is unknown, so the page shows &ldquo;at least&rdquo; (&ge;) and never lets
          that night win a &ldquo;shortest night&rdquo; badge by accident.
        </p>

        <h3>How labels are chosen</h3>
        <p>
          A site gets a badge only when it leads by at least 2 percentage points (24 hours for nights). A smaller lead is shown as
          &ldquo;too close to call&rdquo;. The Balanced badge needs a worst-case score of at least 25 out of 100. The rules are in
          <code> docs/VERDICT.md</code>.
        </p>

        <h3>Terrain</h3>
        <p>
          Real skylines come from NASA&rsquo;s LOLA laser altimeter on the Lunar Reconnaissance Orbiter. Without them, the flat-horizon
          model gives much less sunlight than a terrain-aware study at the same kind of point. With the LOLA skyline loaded, our numbers come close to the published ones:
        </p>
        <div className="method-tablewrap">
          <table>
            <caption className="method-note">
              Share of time with the Sun up. Flat column: the Sun's centre above a flat 0&deg; line over 2.3 years (docs/SANITY.md). Terrain column: any part of the Sun above the LOLA skyline, seen from 2 m, over 1 year from 15 Nov 2026 (docs/TERRAIN.md). Published: Gl&auml;ser et al., any part of the Sun, ground level, over 20 years. The cards can differ a little (top edge of the Sun, your dates).
            </caption>
            <thead><tr><th>Site</th><th>This tool, flat horizon</th><th>This tool, LOLA terrain</th><th>Published, with terrain</th></tr></thead>
            <tbody>
              {FLAT_VS_PUBLISHED.map(r => (
                <tr key={r.site}><td>{r.site}</td><td className="num">{r.ours}</td><td className="num">{r.terrain}</td><td className="num">{r.published}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="method-note">The flat-horizon gap is a finding, not a tuned result. It is why flat-horizon sites are flagged provisional. The terrain numbers were not tuned to match either.</p>

        <h3>How well does it match NASA?</h3>
        <div className="method-tablewrap">
          <table>
            <thead><tr><th>Check</th><th>Result</th><th>Limit or note</th><th>Source file</th></tr></thead>
            <tbody>
              {VALIDATION.map(r => (
                <tr key={r.what}>
                  <td>{r.what}</td><td>{r.result}</td><td>{r.limit}</td><td><code>{r.source}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="method-note">
          An arcminute is 1/60 of a degree. Near the pole the Sun climbs about 0.01&deg; an hour, so 0.05 arcminutes is about 5 minutes of
          sunrise timing.
        </p>

        <h3>What this tool is, and what it is not</h3>
        <div className="method-cols">
          <div className="method-is">
            <h3>It is</h3>
            <ul>{IS.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="method-isnt">
            <h3>It is not</h3>
            <ul>{ISNT.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </div>
    </details>
  )
}
