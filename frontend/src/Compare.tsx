import Explain from './Explain'
import { EXPLAIN } from './explanations'
import { fmtUtc, fmtWait, nextChange } from './events'
import { bestDarkHours, CLOSE_PTS, closeCall, fmtDuration, nearTop, VERDICT_TEXT, verdicts, type Metrics } from './metrics'
import type { Site } from './types'

interface Row { site: Site; m: Metrics }

// Where the landing hour sits in the data, for the "after landing" lines.
export interface Landing { index: number; t0Ms: number; stepHours: number }

function AfterLanding({ alt, body, landing }: { alt: number[]; body: 'Sun' | 'Earth'; landing: Landing }) {
  const { up, at } = nextChange(alt, landing.index)
  const verb = up ? 'sets' : 'rises'
  const state = up ? 'up' : 'down'
  if (at === null) {
    return <li><b className={body === 'Sun' ? 'sun' : 'earth'}>{body}</b> {state} at landing, never {verb} before the data ends</li>
  }
  const waitH = (at - landing.index) * landing.stepHours
  const ms = landing.t0Ms + at * landing.stepHours * 3_600_000
  return <li><b className={body === 'Sun' ? 'sun' : 'earth'}>{body}</b> {state} at landing, {verb} in {fmtWait(waitH)} <span className="when">({fmtUtc(ms)})</span></li>
}

// Names and values of the sites within CLOSE_PTS of the leader, e.g. "Shackleton rim 53.0%, IM-2 51.6% and IM-1 51.3%".
function closeList(rows: Row[], score: (m: Metrics) => number, top: number) {
  const items = rows.filter(r => nearTop(top, score(r.m)))
    .sort((a, b) => score(b.m) - score(a.m))
    .map(r => `${r.site.name} ${score(r.m).toFixed(1)}%`)
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0]
}

// Side-by-side comparison of the selected sites for the chosen window.
export default function Compare({ rows, explainAll, landing }: { rows: Row[]; explainAll: boolean; landing: Landing }) {
  const verdict = verdicts(rows.map(r => ({ id: r.site.id, m: r.m })))
  const sun = closeCall(rows.map(r => r.m.sunPct))
  const earth = closeCall(rows.map(r => r.m.earthPct))
  const bestDark = bestDarkHours(rows.map(r => r.m))
  const tooClose = (m: Metrics) =>
    (sun.close && nearTop(sun.top, m.sunPct)) || (earth.close && nearTop(earth.top, m.earthPct))

  return (
    <div className="compare">
      <div className="caveats" role="note">
        {sun.close && (
          <p className="close-call"><b>Too close to call on sunlight.</b> {closeList(rows, m => m.sunPct, sun.top)} are
            less than {CLOSE_PTS} points apart. A flat-horizon model cannot rank sites that close; real terrain decides it.
            <Explain term="Too close to call" all={explainAll}>{EXPLAIN.close}</Explain></p>
        )}
        {earth.close && (
          <p className="close-call"><b>Too close to call on Earth time.</b> {closeList(rows, m => m.earthPct, earth.top)} are
            less than {CLOSE_PTS} points apart, so no site is named best for communication.</p>
        )}
        <p className="flat"><b>Flat horizon.</b> Hills and crater walls are not modelled, so real sunlight on high rims is
          higher and nights shorter than shown.
          <Explain term="Flat horizon" all={explainAll}>{EXPLAIN.flat}</Explain></p>
      </div>
      <div className="compare-grid">
        {rows.map(({ site, m }) => {
          const v = verdict[site.id]
          const close = !v && tooClose(m)
          return (
            <article key={site.id} className="compare-card">
              <h3>{site.name}</h3>
              <p className={`verdict ${v ?? (close ? 'close' : 'none')}`}>
                {v ? VERDICT_TEXT[v] : close ? 'Too close to call' : 'No top score'}
              </p>
              <dl>
                <div className={!sun.close && m.sunPct === sun.top ? 'best' : ''}>
                  <dt>Sun visible</dt><dd className="sun">{m.sunPct.toFixed(1)}%</dd>
                </div>
                <div className={!earth.close && m.earthPct === earth.top ? 'best' : ''}>
                  <dt>Earth visible</dt><dd className="earth">{m.earthPct.toFixed(1)}%</dd>
                </div>
                <div className={!m.darkCut && m.longestDarkHours === bestDark ? 'best' : ''}>
                  <dt>Longest darkness</dt>
                  <dd>{m.darkCut ? '≥ ' : ''}{fmtDuration(m.longestDarkHours)}</dd>
                </div>
              </dl>
              <ul className="after" aria-label={`After landing at ${site.name}`}>
                <AfterLanding alt={site.sun_alt} body="Sun" landing={landing} />
                <AfterLanding alt={site.earth_alt} body="Earth" landing={landing} />
              </ul>
            </article>
          )
        })}
      </div>
      <dl className="card-key" aria-label="How to read the cards">
        <div><dt className="sun">Sun visible <Explain term="Sun visible" all={explainAll}>{EXPLAIN.sun}</Explain></dt>
          <dd>Share of hours the Sun is up: solar power. Higher is better.</dd></div>
        <div><dt className="earth">Earth visible <Explain term="Earth visible" all={explainAll}>{EXPLAIN.earth}</Explain></dt>
          <dd>Share of hours Earth is up: direct radio home. Higher is better.</dd></div>
        <div><dt>Longest darkness <Explain term="Longest darkness" all={explainAll}>{EXPLAIN.dark}</Explain></dt>
          <dd>Longest night on batteries. Shorter is better. ≥ means it runs past our data.</dd></div>
        <div><dt>Verdict <Explain term="Verdict" all={explainAll}>{EXPLAIN.verdict}</Explain></dt>
          <dd>One-line summary of the scores.</dd></div>
        <div><dt>After landing <Explain term="After landing" all={explainAll}>{EXPLAIN.next}</Explain></dt>
          <dd>Sun and Earth at the landing hour, and when that next changes.</dd></div>
        <div><dt>★</dt><dd>Best of the sites shown. Left off a score that is too close to call.</dd></div>
      </dl>
    </div>
  )
}
