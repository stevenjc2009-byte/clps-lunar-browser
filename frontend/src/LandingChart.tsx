import { useEffect, useMemo, useRef } from 'react'
import type { Timeline } from './lib/engine'
import { isoDay } from './lib/format'
import { sunPctByDay } from './lib/landingSeries'
import { loadPlotly, plotlyLoaded } from './plotly'

const LINE = ['#ffb627', '#7ee0a0', '#c79bff', '#ff7a7a']
const HOUR_MS = 3_600_000

interface Props {
  lines: { name: string; tl: Timeline }[]
  days: number          // look-ahead length
  firstH: number        // first and last landing day (UTC midnight), hours from the first sample
  lastH: number
  t0Ms: number          // time of the first sample
  landingDay: string    // ISO date currently picked
  onPick: (isoDate: string) => void
}

// Sun % for every possible landing date, one line per compared site, from the same engine
// timelines as the cards. Clicking the chart picks that landing date.
export default function LandingChart({ lines, days, firstH, lastH, t0Ms, landingDay, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const pickRef = useRef(onPick)
  useEffect(() => { pickRef.current = onPick }, [onPick])

  const series = useMemo(() => lines.map(l => {
    const d = sunPctByDay(l.tl, days * 24, firstH, lastH)
    return { name: l.name, x: d.startsH.map(h => isoDay(t0Ms + h * HOUR_MS)), y: d.sunPct }
  }), [lines, days, firstH, lastH, t0Ms])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const data: Partial<Plotly.Data>[] = series.map((s, i) => ({
      type: 'scatter',
      mode: 'lines',
      name: s.name,
      x: s.x,
      y: s.y,
      line: { color: LINE[i % LINE.length], width: 2 },
      hovertemplate: `${s.name}: %{y:.1f}%<extra></extra>`,
    }))
    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#070b16',
      font: { color: '#c9d3e6', family: 'Inter, system-ui, sans-serif' },
      margin: { l: 60, r: 20, t: 26, b: 40 },
      xaxis: { type: 'date', gridcolor: '#1b2438', tickformat: '%b %Y', hoverformat: '%-d %b %Y' },
      yaxis: { title: { text: 'Sun visible (%)' }, gridcolor: '#1b2438', zeroline: false, ticksuffix: '%' },
      hovermode: 'x unified',
      hoverlabel: { bgcolor: '#0c1222', bordercolor: '#1d2840', font: { color: '#e6ecf7' } },
      shapes: [
        { type: 'line', xref: 'x', yref: 'paper', x0: landingDay, x1: landingDay, y0: 0, y1: 1,
          line: { color: '#e8dcc0', width: 1.5, dash: 'dot' } },
      ],
      annotations: [
        { x: landingDay, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: 'your landing date',
          showarrow: false, font: { size: 11, color: '#e8dcc0' } },
      ],
      legend: { orientation: 'h', x: 0, y: -0.18 },
      dragmode: false,
    }
    let cancelled = false
    loadPlotly()
      .then(P => {
        if (cancelled) return
        P.react(el, data, layout, { responsive: true, displaylogo: false, displayModeBar: false })
        const gd = el as unknown as Plotly.PlotlyHTMLElement
        gd.removeAllListeners?.('plotly_click')
        gd.on('plotly_click', ev => {
          const x = ev.points[0]?.x
          if (typeof x === 'string') pickRef.current(x.slice(0, 10))
        })
      })
      .catch(() => { if (!cancelled) el.textContent = 'The chart library could not be loaded. Reload the page to try again.' })
    return () => { cancelled = true }
  }, [series, landingDay])

  useEffect(() => {
    const el = ref.current
    return () => { const p = plotlyLoaded(); if (el && p) p.then(P => P.purge(el)).catch(() => {}) }
  }, [])

  return <div ref={ref} className="landing-chart" role="figure"
    aria-label={`Sun visible for each possible landing date, ${days}-day look-ahead`} />
}
