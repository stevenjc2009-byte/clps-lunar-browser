import AfterLanding, { type Landing } from './AfterLanding'
import Explain from './Explain'
import { EXPLAIN } from './explanations'
import type { Timeline } from './lib/engine'
import { fmtDuration, listAnd } from './lib/format'
import type { Params } from './lib/params'
import { BADGE_TEXT, BADGES, FLAT_WARNING, verdict, type Badge, type Verdict } from './lib/verdict'
import type { WindowMetrics } from './lib/windowMetrics'
import { coordsText, siteLinks } from './siteLinks'
import type { Site } from './types'

export interface Row { site: Site; m: WindowMetrics; tl: Timeline }

// Pill colour: one badge -> its colour; energy + comms -> 'both'; more -> the first badge's.
function pillClass(b: Badge[]): string {
  if (b.includes('energy') && b.includes('comms')) return 'both'
  return b[0]
}

function Dark({ m }: { m: WindowMetrics }) {
  const d = m.longestDark
  return (
    <dd>
      {d.status === 'at_least' ? '≥ ' : ''}{fmtDuration(d.hours)}
      {d.status === 'at_least' && <span className="sub"> (at least)</span>}
      {d.startedBefore && <span className="sub block">already dark at landing; {fmtDuration(d.insideHours)} of it after landing</span>}
    </dd>
  )
}

// Links into NASA's LROC QuickMap and Moon Trek. If a deep link cannot be built, the tool's home page is used.
function MapLinks({ site }: { site: Site }) {
  const links = siteLinks(site.lat, site.lon)
  return (
    <p className="map-links">
      {links.map(l => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
          {l.label}<span className="sr-only"> for {site.name} (opens in a new tab)</span>
        </a>
      ))}
      {links.some(l => !l.deep) &&
        <span className="sub">Opens the tool's home page: search for {coordsText(site.lat, site.lon)}.</span>}
    </p>
  )
}

function Caveats({ v, rows, params, explainAll }: { v: Verdict; rows: Row[]; params: Params; explainAll: boolean }) {
  const open = BADGES.map(b => v.outcomes[b]).filter(o => o.state === 'comparable' || o.state === 'undetermined')
  const flat = rows.filter(r => !r.m.terrain).map(r => r.site.name)
  const dsnMissing = rows.some(r => r.m.dsnMissing)
  return (
    <div className="caveats" role="note">
      {open.map((o, i) => (
        <p key={o.rule} className="close-call">{o.sentence}
          {i === 0 && <Explain term="Too close to call" all={explainAll}>{EXPLAIN.close}</Explain>}</p>
      ))}
      {dsnMissing && <p className="close-call"><b>DSN data not loaded.</b> The comms figure shows Earth in view only;
        it cannot check whether a Deep Space Network dish can see the Moon.</p>}
      {flat.length > 0
        ? <p className="flat"><b>Provisional.</b> {listAnd(flat)}: {FLAT_WARNING} Hills and crater walls are not modelled there.
            <Explain term="Flat horizon" all={explainAll}>{EXPLAIN.flat}</Explain></p>
        : <p className="flat"><b>Terrain horizon.</b> Hills and crater walls from NASA LOLA elevation data, seen
            from {params.observerHeightM} m above the ground.
            <Explain term="Terrain horizon" all={explainAll}>{EXPLAIN.flat}</Explain></p>}
    </div>
  )
}

// Side-by-side comparison of the selected sites for the chosen window.
export default function Compare({ rows, params, explainAll, landing }: { rows: Row[]; params: Params; explainAll: boolean; landing: Landing }) {
  const commsKind = rows[0]?.m.commsKind ?? 'earth'
  const v = verdict(rows.map(({ site, m }) => ({
    id: site.id, name: site.name, sunPct: m.sunPct, commsPct: m.linkPct,
    dark: { hours: m.longestDark.hours, status: m.longestDark.status }, terrain: m.terrain,
  })), commsKind)
  const link = commsKind === 'link'

  return (
    <div className="compare">
      <Caveats v={v} rows={rows} params={params} explainAll={explainAll} />
      <div className="compare-grid">
        {rows.map(({ site, m, tl }) => {
          const badges = v.badges[site.id]
          const state = v.cardState[site.id]
          return (
            <article key={site.id} className="compare-card">
              <h3>{site.name} <span className={`chip ${m.terrain ? 'terrain' : 'flat'}`}
                title={m.terrain ? 'Horizon from NASA LOLA terrain' : FLAT_WARNING}
                aria-label={m.terrain ? 'Terrain horizon' : `Flat horizon. ${FLAT_WARNING}`}>
                {m.terrain ? 'Terrain' : 'Flat horizon · provisional'}</span></h3>
              <p className={`verdict ${badges.length ? pillClass(badges) : state}`}>
                {badges.length ? badges.map(b => BADGE_TEXT[b]).join(' · ') : state === 'close' ? 'Too close to call' : 'No top score'}
              </p>
              <dl>
                <div className={v.stars.sun === site.id ? 'best' : ''}>
                  <dt>Sun visible</dt><dd className="sun">{m.sunPct.toFixed(1)}%</dd>
                </div>
                <div className={v.stars.comms === site.id ? 'best' : ''}>
                  <dt>{link ? 'Link available (DSN)' : 'Earth visible'}</dt>
                  <dd className="earth">{(link ? m.linkPct : m.earthPct).toFixed(1)}%
                    {link && <span className="sub block">Earth in view {m.earthPct.toFixed(1)}%</span>}
                    {m.dsnMissing && <span className="sub block">DSN data not loaded</span>}</dd>
                </div>
                <div className={v.stars.dark === site.id ? 'best' : ''}>
                  <dt>Longest darkness</dt><Dark m={m} />
                </div>
              </dl>
              <ul className="after" aria-label={`After landing at ${site.name}`}>
                <AfterLanding ivs={tl.sun} body="Sun" cls="sun" landing={landing} />
                <AfterLanding ivs={link ? tl.link : tl.earth} body={link ? 'Link' : 'Earth'} cls="earth" landing={landing} />
              </ul>
              <MapLinks site={site} />
            </article>
          )
        })}
      </div>
      <details className="why">
        <summary>Why these labels</summary>
        <ul>{v.sentences.map(s => <li key={s}>{s}</li>)}</ul>
      </details>
      <dl className="card-key" aria-label="How to read the cards">
        <div><dt className="sun">Sun visible <Explain term="Sun visible" all={explainAll}>{EXPLAIN.sun}</Explain></dt>
          <dd>Share of time the top of the Sun is above the horizon: solar power. Higher is better.</dd></div>
        <div><dt className="earth">{link ? 'Link available (DSN)' : 'Earth visible'} <Explain term="Link available" all={explainAll}>{EXPLAIN.earth}</Explain></dt>
          <dd>{link
            ? 'Share of time Earth is in view and a Deep Space Network dish can see the Moon: radio home.'
            : 'Share of time Earth is in view: direct radio home.'} Higher is better.</dd></div>
        <div><dt>Longest darkness <Explain term="Longest darkness" all={explainAll}>{EXPLAIN.dark}</Explain></dt>
          <dd>Longest night on batteries, counted in full. Shorter is better. ≥ (at least) means it runs past our data.</dd></div>
        <div><dt>Verdict <Explain term="Verdict" all={explainAll}>{EXPLAIN.verdict}</Explain></dt>
          <dd>Labels from fixed rules; "Why these labels" gives the numbers behind each.</dd></div>
        <div><dt>After landing <Explain term="After landing" all={explainAll}>{EXPLAIN.next}</Explain></dt>
          <dd>Sun and {link ? 'link' : 'Earth'} at the landing moment, and roughly when that next changes.</dd></div>
        <div><dt>★</dt><dd>Winner of that rule. Left off when it is too close to call or cannot be called.</dd></div>
      </dl>
    </div>
  )
}
