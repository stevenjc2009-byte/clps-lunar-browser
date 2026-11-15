import { useEffect, useMemo, useRef } from 'react'
import type { Span } from './lib/window'
import { loadPlotly, plotlyLoaded } from './plotly'
import SkyLegend from './SkyLegend'
import { elevationRange, EARTH_RAMP, plotlyScale, skyline, SUN_RAMP, wrapAz } from './skyModel'
import SkyTable from './SkyTable'
import type { Site } from './types'

export interface SkyChartProps {
  site: Site
  span: Span
  // Terrain skyline in degrees, index i <-> azimuth i*horizonStep. Omit for the flat-horizon line.
  horizon?: number[]
  horizonStep?: number
  // Height of the flat horizon line (deg) when there is no terrain table: the engine's own level
  // (minus the dip for the observer height, plus any safety margin). Default 0.
  flatDeg?: number
  // Angular radii (deg), hourly, same length as site.sun_alt (sky.json v2). Used for the size legend.
  sunRadiusDeg?: number[]
  earthRadiusDeg?: number[]
  // Time of sample 0 (ms since 1970 UTC) and hours per sample: used to label the time colour and the table.
  t0Ms?: number
  stepHours?: number
  // The header switch that opens every "?" note.
  explainAll?: boolean
}

const TEXT = '#c9d3e6'
const GRID = '#1b2438'
const SKYLINE_FILL = 'rgba(150, 138, 112, 0.55)'

// Sky graph: azimuth (compass direction, clockwise from lunar north) vs elevation above the horizon.
// Dots are the samples inside `span`; their colour gets paler with time. The grey silhouette is the
// terrain skyline when horizon data is given, otherwise a flat 0 deg line.
export default function SkyChart({ site, span, horizon, horizonStep, flatDeg = 0, sunRadiusDeg, earthRadiusDeg, t0Ms, stepHours = 1, explainAll = false }: SkyChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const win = useMemo(() => {
    const cut = (a: number[]) => a.slice(span.start, span.end)
    const sky = skyline(horizon, horizonStep, flatDeg)
    const sunAlt = cut(site.sun_alt), earthAlt = cut(site.earth_alt)
    const { range, widened, below } = elevationRange([sunAlt, earthAlt], Math.max(...sky.y))
    return { sunAlt, earthAlt, sunAz: cut(site.sun_az), earthAz: cut(site.earth_az), sky, range, widened, below }
  }, [site, span.start, span.end, horizon, horizonStep, flatDeg])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const { sunAlt, earthAlt, sunAz, earthAz, sky, range } = win
    const idx = (n: number) => Array.from({ length: n }, (_, i) => i)
    const marker = (ramp: string[], n: number, symbol: 'circle' | 'diamond') => ({
      color: idx(n), colorscale: plotlyScale(ramp), cmin: 0, cmax: Math.max(1, n - 1),
      size: 4, opacity: 0.75, symbol, showscale: false,
    })
    const narrow = el.clientWidth < 520
    const skyName = sky.flat ? `Flat horizon (${sky.y[0].toFixed(1)}°), no terrain data` : 'Terrain skyline'

    const data: Partial<Plotly.Data>[] = [
      // invisible floor so the skyline trace can fill down to the bottom of the chart
      { type: 'scatter', mode: 'lines', x: [-180, 180], y: [range[0], range[0]], line: { width: 0 },
        hoverinfo: 'skip', showlegend: false },
      { type: 'scatter', mode: 'lines', name: skyName, x: sky.x, y: sky.y, fill: 'tonexty', fillcolor: SKYLINE_FILL,
        line: { color: '#e8dcc0', width: sky.flat ? 1.5 : 1.2, dash: sky.flat ? 'dash' : 'solid' },
        hovertemplate: `${skyName}<br>az %{x:.1f}°<br>%{y:.2f}°<extra></extra>` },
      { type: 'scattergl', mode: 'markers', name: 'Sun', x: sunAz.map(wrapAz), y: sunAlt,
        marker: marker(SUN_RAMP, sunAlt.length, 'circle'),
        hovertemplate: 'Sun<br>az %{x:.1f}°<br>el %{y:.2f}°<extra></extra>' },
      { type: 'scattergl', mode: 'markers', name: 'Earth', x: earthAz.map(wrapAz), y: earthAlt,
        marker: marker(EARTH_RAMP, earthAlt.length, 'diamond'),
        hovertemplate: 'Earth<br>az %{x:.1f}°<br>el %{y:.2f}°<extra></extra>' },
    ]

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#070b16',
      font: { color: TEXT, family: 'Inter, system-ui, sans-serif' },
      // narrow screens: room above the plot for the toolbar, a shorter axis title, legend below
      margin: { l: 56, r: 16, t: narrow ? 34 : 10, b: 56 },
      xaxis: {
        title: { text: narrow ? 'Compass direction (° from north)' : 'Compass direction (° clockwise from lunar north)' },
        range: [-180, 180],
        // narrow screens: only N, E, S, W so the labels do not overlap
        tickvals: narrow ? [-180, -90, 0, 90, 180] : [-180, -135, -90, -45, 0, 45, 90, 135, 180],
        ticktext: narrow ? ['S', 'W', 'N', 'E', 'S'] : ['S 180°', 'SW 225°', 'W 270°', 'NW 315°', 'N 0°', 'NE 45°', 'E 90°', 'SE 135°', 'S 180°'],
        gridcolor: GRID, zeroline: false,
      },
      yaxis: {
        title: { text: 'Height above level (°)' },
        range, gridcolor: GRID, zeroline: false,
      },
      legend: narrow ? { orientation: 'h', x: 0, y: -0.27, yanchor: 'top', itemsizing: 'constant' }
        : { orientation: 'h', x: 0, y: 1.1, itemsizing: 'constant' },
      dragmode: 'zoom',
    }

    let cancelled = false
    loadPlotly()
      .then(P => { if (!cancelled) P.react(el, data, layout, { responsive: true, displaylogo: false, modeBarButtons: [['zoom2d', 'pan2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']] }) })
      .catch(() => { if (!cancelled) el.textContent = 'The chart library could not be loaded. Reload the page to try again.' })
    return () => { cancelled = true }
  }, [win])

  useEffect(() => {
    const el = ref.current
    return () => { const p = plotlyLoaded(); if (el && p) p.then(P => P.purge(el)).catch(() => {}) }
  }, [])

  const n = win.sunAlt.length
  const t = (i: number) => (t0Ms === undefined ? undefined : t0Ms + (span.start + i) * stepHours * 3_600_000)
  return (
    <>
      <div ref={ref} className="sky-chart" role="figure"
        aria-label={`Sky graph for ${site.name}: Sun and Earth positions, one dot per hour, ${win.sky.flat ? 'against a flat horizon' : 'against the terrain skyline'}. A table of the numbers follows the chart.`} />
      <SkyLegend startMs={n ? t(0) : undefined} endMs={n ? t(n - 1) : undefined} flat={win.sky.flat} widened={win.widened} below={win.below}
        range={win.range} sunRadius={sunRadiusDeg} earthRadius={earthRadiusDeg} start={span.start} end={span.end}
        explainAll={explainAll} />
      <SkyTable siteName={site.name} sunAz={win.sunAz} sunAlt={win.sunAlt} earthAz={win.earthAz} earthAlt={win.earthAlt}
        t0Ms={t(0)} stepHours={stepHours} />
    </>
  )
}
