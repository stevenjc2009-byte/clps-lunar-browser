import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import type { Site } from './types'

const SUN = '#ffb627'
const EARTH = '#4da3ff'

// Azimuth 0..360 -> -180..180 so north sits mid-chart. At south-pole sites Earth is
// usually near north, and a 0..360 axis would split its trace across both edges.
const wrap = (az: number[]) => az.map(a => (a > 180 ? a - 360 : a))

// Sky graph: azimuth (deg from lunar north, clockwise) vs elevation above a flat horizon.
export default function SkyChart({ site }: { site: Site }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const lo = Math.min(site.stats.sun_alt_min, site.stats.earth_alt_min) - 1
    const hi = Math.max(site.stats.sun_alt_max, site.stats.earth_alt_max) + 1

    const data: Partial<Plotly.Data>[] = [
      {
        type: 'scattergl',
        mode: 'markers',
        name: 'Sun',
        x: wrap(site.sun_az),
        y: site.sun_alt,
        marker: { color: SUN, size: 3, opacity: 0.5 },
        hovertemplate: 'Sun<br>az %{x:.1f}°<br>el %{y:.2f}°<extra></extra>',
      },
      {
        type: 'scattergl',
        mode: 'markers',
        name: 'Earth',
        x: wrap(site.earth_az),
        y: site.earth_alt,
        marker: { color: EARTH, size: 3, opacity: 0.5 },
        hovertemplate: 'Earth<br>az %{x:.1f}°<br>el %{y:.2f}°<extra></extra>',
      },
    ]

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#070b16',
      font: { color: '#c9d3e6', family: 'Inter, system-ui, sans-serif' },
      margin: { l: 60, r: 20, t: 10, b: 50 },
      xaxis: {
        title: { text: 'Azimuth (° from lunar north, clockwise)' },
        range: [-180, 180],
        tickvals: [-180, -135, -90, -45, 0, 45, 90, 135, 180],
        ticktext: ['S 180', '225', 'W 270', '315', 'N 0', '45', 'E 90', '135', 'S 180'],
        gridcolor: '#1b2438',
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Elevation above flat horizon (°)' },
        range: [lo, hi],
        gridcolor: '#1b2438',
        zeroline: false,
      },
      shapes: [
        // ground below the flat horizon
        { type: 'rect', xref: 'x', yref: 'y', x0: -180, x1: 180, y0: lo, y1: 0,
          fillcolor: '#3a3326', opacity: 0.55, line: { width: 0 }, layer: 'below' },
        { type: 'line', xref: 'x', yref: 'y', x0: -180, x1: 180, y0: 0, y1: 0,
          line: { color: '#e8dcc0', width: 1.5 } },
      ],
      annotations: [
        { x: 178, y: 0, xanchor: 'right', yanchor: 'bottom', text: 'flat horizon (0°)',
          showarrow: false, font: { size: 11, color: '#e8dcc0' } },
      ],
      legend: { orientation: 'h', x: 0, y: 1.08, itemsizing: 'constant' },
      dragmode: 'zoom',
    }

    Plotly.react(el, data, layout, { responsive: true, displaylogo: false })
  }, [site])

  useEffect(() => {
    const el = ref.current
    return () => { if (el) Plotly.purge(el) }
  }, [])

  return <div ref={ref} className="sky-chart" aria-label={`Sky graph for ${site.name}`} />
}
