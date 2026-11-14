import Explain from './Explain'
import { EXPLAIN } from './explanations'
import { fmtUtc, fmtWait, nextChange } from './events'
import { fmtDuration, VERDICT_TEXT, verdicts, type Metrics } from './metrics'
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

// Side-by-side comparison of the selected sites for the chosen window.
export default function Compare({ rows, explainAll, landing }: { rows: Row[]; explainAll: boolean; landing: Landing }) {
  const verdict = verdicts(rows.map(r => ({ id: r.site.id, m: r.m })))
  const bestSun = Math.max(...rows.map(r => r.m.sunPct))
  const bestEarth = Math.max(...rows.map(r => r.m.earthPct))
  const bestDark = Math.min(...rows.map(r => r.m.longestDarkHours))

  return (
    <div className="compare">
      <div className="compare-legend">
        <span><b>Sun visible</b> <Explain term="Sun visible" all={explainAll}>{EXPLAIN.sun}</Explain></span>
        <span><b>Earth visible</b> <Explain term="Earth visible" all={explainAll}>{EXPLAIN.earth}</Explain></span>
        <span><b>Longest darkness</b> <Explain term="Longest darkness" all={explainAll}>{EXPLAIN.dark}</Explain></span>
        <span><b>Verdict</b> <Explain term="Verdict" all={explainAll}>{EXPLAIN.verdict}</Explain></span>
        <span><b>After landing</b> <Explain term="After landing" all={explainAll}>{EXPLAIN.next}</Explain></span>
      </div>
      <div className="compare-grid">
        {rows.map(({ site, m }) => {
          const v = verdict[site.id]
          return (
            <article key={site.id} className="compare-card">
              <h3>{site.name}</h3>
              <p className={`verdict ${v ?? 'none'}`}>{v ? VERDICT_TEXT[v] : 'No top score'}</p>
              <dl>
                <div className={m.sunPct === bestSun ? 'best' : ''}>
                  <dt>Sun visible</dt><dd className="sun">{m.sunPct.toFixed(1)}%</dd>
                </div>
                <div className={m.earthPct === bestEarth ? 'best' : ''}>
                  <dt>Earth visible</dt><dd className="earth">{m.earthPct.toFixed(1)}%</dd>
                </div>
                <div className={m.longestDarkHours === bestDark ? 'best' : ''}>
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
    </div>
  )
}
