import Explain from './Explain'
import { EXPLAIN } from './explanations'
import { fmtDuration, VERDICT_TEXT, verdicts, type Metrics } from './metrics'
import type { Site } from './types'

interface Row { site: Site; m: Metrics }

// Side-by-side comparison of the selected sites for the chosen window.
export default function Compare({ rows, explainAll }: { rows: Row[]; explainAll: boolean }) {
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
            </article>
          )
        })}
      </div>
    </div>
  )
}
