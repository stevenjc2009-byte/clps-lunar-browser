import { useMemo } from 'react'
import Explain from './Explain'
import { fmtDay, HEAT_EXPLAIN, lookLabel } from './heatmapText'
import { siteTimeline, type EngineData } from './lib/engine'
import { darkLine, DELTA_TEXT, pctLine, type DeltaLine } from './lib/dateDelta'
import { isoDay } from './lib/format'
import type { Params } from './lib/params'
import { COMMS_MARGIN_PTS, ENERGY_MARGIN_PTS, FLAT_WARNING } from './lib/verdict'
import { dataStartMs, defaultLandingDay, landingRangeH, windowFor, type WindowPick } from './lib/window'
import { windowMetrics } from './lib/windowMetrics'
import type { Site } from './types'
import './heatmap.css'

export interface CompareDatesProps {
  ed: EngineData
  site: Site                 // the one site to compare (any site, including a custom one)
  params: Params
  days: number               // look-ahead in days, e.g. the app's 30 or 365
  dateA: string              // ISO dates (YYYY-MM-DD, UTC)
  dateB: string
  onChange: (dateA: string, dateB: string) => void
  explainAll?: boolean
}

const HOUR_MS = 3_600_000

function clampText(p: WindowPick, used: string): string | null {
  if (p.clamped === 'before_range') return `before the landing range, so ${fmtDay(used)} is used`
  if (p.clamped === 'after_range') return `too late for the look-ahead, so ${fmtDay(used)} is used`
  if (p.clamped === 'invalid') return `not a date we could read, so ${fmtDay(used)} is used`
  return null
}

// Two landing dates for one site, side by side, with the difference (B minus A).
export default function CompareDates({ ed, site, params, days, dateA, dateB, onChange, explainAll = false }: CompareDatesProps) {
  const data = ed.sky
  const t0 = dataStartMs(data)
  const minDay = defaultLandingDay(data)
  const maxDay = isoDay(t0 + landingRangeH(data, days * 24).maxH * HOUR_MS)

  const res = useMemo(() => {
    const tl = siteTimeline(ed, site, params)
    const pa = windowFor(data, dateA, days), pb = windowFor(data, dateB, days)
    return {
      pa, pb, ma: windowMetrics(tl, pa.startH, pa.lenH), mb: windowMetrics(tl, pb.startH, pb.lenH),
      usedA: isoDay(t0 + pa.startH * HOUR_MS), usedB: isoDay(t0 + pb.startH * HOUR_MS),
    }
  }, [ed, site, params, data, dateA, dateB, days, t0])
  const { ma, mb, usedA, usedB } = res
  const link = ma.commsKind === 'link'

  const lines: DeltaLine[] = [
    pctLine('Sun visible', 'sun', ma.sunPct, mb.sunPct, ENERGY_MARGIN_PTS),
    pctLine(link ? 'Link available (DSN)' : 'Earth visible', 'earth', ma.linkPct, mb.linkPct, COMMS_MARGIN_PTS),
    pctLine(link ? 'Sun and link at the same time' : 'Sun and Earth at the same time', '', ma.bothPct, mb.bothPct, ENERGY_MARGIN_PTS),
    darkLine(ma.longestDark, mb.longestDark),
  ]
  const noteA = clampText(res.pa, usedA), noteB = clampText(res.pb, usedB)

  return (
    <div className="cd">
      <div className="cd-pick">
        <label className="field"><span>Date A (UTC)</span>
          <input type="date" value={usedA} min={minDay} max={maxDay} onChange={e => e.target.value && onChange(e.target.value, dateB)} />
        </label>
        <label className="field"><span>Date B (UTC)</span>
          <input type="date" value={usedB} min={minDay} max={maxDay} onChange={e => e.target.value && onChange(dateA, e.target.value)} />
        </label>
        <button type="button" className="cd-btn" onClick={() => onChange(dateB, dateA)}>Swap A and B</button>
      </div>
      <p className="how-read">{site.name}, looking {lookLabel(days)} ahead from each landing date.
        <Explain term="Compare dates" all={explainAll}>{HEAT_EXPLAIN.compare}</Explain></p>
      {(noteA || noteB) && <p className="cd-note" role="status">
        {noteA && <>Date A is {noteA}. </>}{noteB && <>Date B is {noteB}.</>}</p>}
      <div className="cd-scroll">
        <table className="cd-table">
          <caption className="hm-sr">{site.name}: {fmtDay(usedA)} compared with {fmtDay(usedB)}</caption>
          <thead>
            <tr><th scope="col">Measure</th><th scope="col">A: {fmtDay(usedA)}</th><th scope="col">B: {fmtDay(usedB)}</th><th scope="col">B minus A</th></tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.name}>
                <th scope="row">{l.name}</th>
                <td className={l.cls}>{l.a}</td>
                <td className={l.cls}>{l.b}</td>
                <td className={`cd-delta ${l.v === 'unknown' ? 'same' : l.v}`}>{l.delta} <span className="cd-note">({DELTA_TEXT[l.v]})</span></td>
              </tr>
            ))}
            <tr>
              <th scope="row">Dark at landing?</th>
              <td>{ma.darkAtLanding ? 'Yes' : 'No'}</td>
              <td>{mb.darkAtLanding ? 'Yes' : 'No'}</td>
              <td className="cd-delta same">{ma.darkAtLanding === mb.darkAtLanding ? 'same' : 'different'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!ma.terrain && <p className="cd-note"><b>Provisional.</b> {FLAT_WARNING}</p>}
      {ma.dsnMissing && <p className="cd-note"><b>DSN data not loaded.</b> The link row shows Earth in view only.</p>}
    </div>
  )
}
