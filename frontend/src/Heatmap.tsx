import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import Explain from './Explain'
import { cellX, drawHeatmap, hitTest, makeLayout, ROW_H, type CellRef } from './heatmapDraw'
import { cellLabel, fmtDay, fmtValue, HEAT_EXPLAIN, lookLabel, metricName } from './heatmapText'
import type { EngineData } from './lib/engine'
import { colorAt, legendTicks } from './lib/heatmapColor'
import { bestDays, heatmapGrid, marginFor, type HeatGrid, type HeatMetric } from './lib/heatmapData'
import type { Params } from './lib/params'
import { FLAT_WARNING } from './lib/verdict'
import type { Site } from './types'
import './heatmap.css'

export interface HeatmapProps {
  ed: EngineData
  sites: Site[]                     // one row each, in this order
  params: Params
  landingDay: string                // ISO date now picked in the app (marked with a line)
  onPickDate: (iso: string) => void // "use this date"
  siteId?: string                   // row the keyboard cursor and recommendation start on
  explainAll?: boolean
}

const LOOKS = [30, 365]
const METRICS: { id: HeatMetric; label: (link: boolean) => string }[] = [
  { id: 'sun', label: () => 'Sun visible' },
  { id: 'link', label: link => (link ? 'Link available' : 'Earth visible') },
  { id: 'dark', label: () => 'Longest darkness' },
]

function Legend({ g, link }: { g: HeatGrid; link: boolean }) {
  const ticks = legendTicks(g.metric, g.domain)
  const stops = Array.from({ length: 11 }, (_, k) => colorAt(k / 10)).join(', ')
  const title = g.metric === 'sun' ? 'Sun visible (% of the look-ahead)'
    : g.metric === 'link' ? `${link ? 'Link available' : 'Earth visible'} (% of the look-ahead)`
      : 'Longest darkness (days, counted in full)'
  // The bar always runs worse -> better, left to right; for darkness that is long -> short.
  const sorted = [...ticks].sort((a, b) => a.t - b.t)
  return (
    <div className="hm-legend" aria-label={`Colour key: ${title}`}>
      <span className="hm-legend-title">{title}</span>
      <div className="hm-legend-row">
        <span className="hm-legend-end">{g.metric === 'dark' ? 'longer' : 'less'}</span>
        <div className="hm-legend-bar-wrap">
          <div className="hm-legend-bar" style={{ background: `linear-gradient(90deg, ${stops})` }} />
          <div className="hm-legend-ticks">
            {sorted.map(t => <span key={t.label} style={{ left: `${t.t * 100}%` }}>{t.label}</span>)}
          </div>
        </div>
        <span className="hm-legend-end">{g.metric === 'dark' ? 'shorter' : 'more'} · better</span>
      </div>
      <div className="hm-legend-keys">
        <span><i className="hm-key-best" /> best 10% for that site</span>
        {g.metric === 'dark' && <span><i className="hm-key-hatch" /> night runs past our data (at least)</span>}
        <span><i className="hm-key-now" /> landing date now picked</span>
      </div>
    </div>
  )
}

function Recommendation({ g, r, look, onPickDate }: { g: HeatGrid; r: number; look: number; onPickDate: (iso: string) => void }) {
  const row = g.rows[r]
  if (!row) return null
  const name = metricName(g.metric, row.commsKind)
  const margin = g.metric === 'dark' ? '1 day' : `${marginFor(g.metric)} points`
  const picks = bestDays(row, g.metric)
  const allCensored = g.metric === 'dark' && row.censored.every(c => c === 1)
  return (
    <div className="hm-reco" role="note">
      {allCensored
        ? <p>At <b>{row.site.name}</b>, for every landing date the longest night runs past the edge of our data, so it
            can only be called "at least" that long and the dates cannot be ranked.</p>
        : row.flatRow || !picks.length
        ? <p>At <b>{row.site.name}</b>, every landing date here gives {name} within {margin} of the same value over
            the next {lookLabel(look)}, so for this measure the date makes little difference.</p>
        : <>
            <p>Best landing dates for <b>{row.site.name}</b> ({name}, next {lookLabel(look)}):</p>
            <ul>
              {picks.map(i => {
                const iso = g.days.isos[i]
                return (
                  <li key={iso}>
                    <span>{fmtDay(iso)}: {fmtValue(g.metric, row.values[i], false)}</span>
                    <button type="button" className="hm-use" onClick={() => onPickDate(iso)}>Use this date</button>
                  </li>
                )
              })}
            </ul>
          </>}
      {!row.terrain && <p className="hm-flat"><b>Provisional.</b> {FLAT_WARNING}</p>}
      {row.dsnMissing && g.metric === 'link' && <p className="hm-flat"><b>DSN data not loaded.</b> Showing Earth in view only.</p>}
    </div>
  )
}

// Annual landing-window heatmap: rows = sites, columns = landing days, colour = the chosen
// measure for the look-ahead starting that day. Click or Enter = use that landing date.
export default function Heatmap({ ed, sites, params, landingDay, onPickDate, siteId, explainAll = false }: HeatmapProps) {
  const [metric, setMetric] = useState<HeatMetric>('sun')
  const [look, setLook] = useState(30)
  const [active, setActive] = useState<CellRef | null>(null)
  const [hover, setHover] = useState<CellRef | null>(null)
  const [focused, setFocused] = useState(false)
  const [availW, setAvailW] = useState(800)
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveId = useId()

  const g = useMemo(() => heatmapGrid(ed, sites, params, metric, look), [ed, sites, params, metric, look])
  const nDays = g.days.isos.length
  const link = g.rows.some(r => r.commsKind === 'link')
  const landingIdx = g.days.isos.indexOf(landingDay)
  const startRow = Math.max(0, sites.findIndex(s => s.id === siteId))
  // The keyboard cursor: kept inside the grid when sites or days change.
  const cur: CellRef | null = nDays && g.rows.length
    ? {
        r: Math.min(active?.r ?? startRow, g.rows.length - 1),
        i: Math.min(active?.i ?? Math.max(0, landingIdx), nDays - 1),
      }
    : null
  const shown = hover ?? (focused ? cur : null)
  const layout = makeLayout(nDays, g.rows.length, availW)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth))
    ro.observe(el)
    setAvailW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const shownR = shown?.r ?? -1, shownI = shown?.i ?? -1, kbd = focused && !hover
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const l = makeLayout(g.days.isos.length, g.rows.length, availW)
    const act = shownR >= 0 ? { r: shownR, i: shownI } : null
    drawHeatmap(c, g, l, { landingIdx, active: act, focused: kbd, dpr: window.devicePixelRatio || 1 })
  }, [g, availW, landingIdx, shownR, shownI, kbd])

  const label = (c: CellRef | null) => {
    if (!c) return ''
    const row = g.rows[c.r]
    const best = row.best[c.i] ? ' (best 10%)' : ''
    return `${cellLabel(row.site.name, g.days.isos[c.i], g.metric, row.values[c.i], row.censored[c.i] === 1, row.commsKind)}${best}`
  }

  const moveTo = (c: CellRef) => {
    setActive(c)
    const el = scrollRef.current
    if (!el) return
    const x = cellX(layout, c.i)
    if (x < el.scrollLeft + 20) el.scrollLeft = Math.max(0, x - 40)
    else if (x > el.scrollLeft + el.clientWidth - 20) el.scrollLeft = x - el.clientWidth + 40
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!cur) return
    const last = nDays - 1
    const step: Record<string, CellRef> = {
      ArrowLeft: { r: cur.r, i: Math.max(0, cur.i - 1) },
      ArrowRight: { r: cur.r, i: Math.min(last, cur.i + 1) },
      ArrowUp: { r: Math.max(0, cur.r - 1), i: cur.i },
      ArrowDown: { r: Math.min(g.rows.length - 1, cur.r + 1), i: cur.i },
      PageUp: { r: cur.r, i: Math.max(0, cur.i - 30) },
      PageDown: { r: cur.r, i: Math.min(last, cur.i + 30) },
      Home: { r: cur.r, i: 0 },
      End: { r: cur.r, i: last },
    }
    if (step[e.key]) { e.preventDefault(); setHover(null); moveTo(step[e.key]) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickDate(g.days.isos[cur.i]) }
  }

  const at = (e: MouseEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return hitTest(layout, e.clientX - box.left, e.clientY - box.top)
  }

  if (!nDays || !g.rows.length) {
    return <p className="hm-empty">No landing days fit inside the data for this look-ahead.</p>
  }

  return (
    <div className="heatmap">
      <div className="hm-controls">
        <div className="field">
          <span>Measure</span>
          <div className="seg" role="group" aria-label="Measure to colour by">
            {METRICS.map(m => (
              <button key={m.id} type="button" aria-pressed={metric === m.id} className={metric === m.id ? 'active' : ''}
                onClick={() => setMetric(m.id)}>{m.label(link)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Look ahead from each landing day</span>
          <div className="seg" role="group" aria-label="Look ahead from each landing day">
            {LOOKS.map(d => (
              <button key={d} type="button" aria-pressed={look === d} className={look === d ? 'active' : ''}
                onClick={() => setLook(d)}>{lookLabel(d)}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="how-read">Landing days {fmtDay(g.days.isos[0])} to {fmtDay(g.days.isos[nDays - 1])}.
        {' '}<b>Click a day, or use the arrow keys and Enter, to use that landing date.</b>
        <Explain term="Landing heatmap" all={explainAll}>{HEAT_EXPLAIN.heatmap}</Explain>
</p>
      {look === 365 && <p className="hm-note">{HEAT_EXPLAIN.oneYear}</p>}

      <div className="hm-body">
        <ul className="hm-labels" aria-hidden="true">
          {g.rows.map((row, r) => (
            <li key={row.site.id} style={{ height: ROW_H }} className={cur?.r === r ? 'on' : ''}
              title={row.terrain ? row.site.name : `${row.site.name}. ${FLAT_WARNING}`}>
              <span className="hm-name">{row.site.name}</span>{!row.terrain && <span className="hm-prov" aria-hidden="true">*</span>}
            </li>
          ))}
        </ul>
        <div ref={scrollRef} className="hm-scroll" tabIndex={0} role="application" aria-roledescription="heatmap"
          aria-label={`Landing heatmap: ${METRICS.find(m => m.id === metric)!.label(link)}, ${g.rows.length} sites by ${nDays} landing days. Arrow keys move, Page Up and Page Down jump 30 days, Enter uses that date.`}
          aria-describedby={liveId} onKeyDown={onKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <canvas ref={canvasRef} aria-hidden="true"
            onPointerMove={e => setHover(at(e))} onPointerLeave={() => setHover(null)}
            onClick={e => { const c = at(e); if (c) { moveTo(c); onPickDate(g.days.isos[c.i]) } }} />
        </div>
      </div>
      <p className="hm-readout" aria-hidden="true">{shown ? label(shown) : 'Point at a cell, or tab to the heatmap, to read its value.'}</p>
      <p id={liveId} className="hm-sr" aria-live="polite">{focused && cur ? label(cur) : ''}</p>
      {g.rows.some(r => !r.terrain) && <p className="hm-note">* Flat horizon: provisional, not reliable for ranking.</p>}

      <Legend g={g} link={link} />
      <p className="hm-note">
        Best 10% <Explain term="Best 10%" all={explainAll}>{HEAT_EXPLAIN.best}</Explain>
        {g.metric === 'dark' && <> · Striped cells <Explain term="Striped cells" all={explainAll}>{HEAT_EXPLAIN.hatched}</Explain></>}
      </p>
      {cur && <Recommendation g={g} r={cur.r} look={look} onPickDate={onPickDate} />}
    </div>
  )
}
