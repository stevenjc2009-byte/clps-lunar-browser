// Colour scale for the landing heatmap: viridis, a sequential palette designed to stay
// readable with the common kinds of colour blindness and in greyscale (dark = low).
// Bright always means "better": more Sun, more link time, or a SHORTER longest night.

import type { HeatMetric } from './heatmapData'

// matplotlib's viridis sampled at 9 even steps (0, 1/8, ..., 1).
export const VIRIDIS = ['#440154', '#472c7a', '#3b518b', '#2c718e', '#21908d', '#27ad81', '#5cc863', '#aadc32', '#fde725']

const rgb = (hex: string) => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16))
const STOPS = VIRIDIS.map(rgb)

// t in [0, 1] -> CSS colour, linear between the stops. Out-of-range t is clamped.
export function colorAt(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (STOPS.length - 1)
  const k = Math.min(STOPS.length - 2, Math.floor(x))
  const f = x - k
  const [r, g, b] = STOPS[k].map((c, j) => Math.round(c + (STOPS[k + 1][j] - c) * f))
  return `rgb(${r},${g},${b})`
}

// Position on the scale: 0 = worst end (dark), 1 = best end (bright).
export function scaleT(value: number, metric: HeatMetric, domain: [number, number]): number {
  const [lo, hi] = domain
  const t = hi > lo ? (value - lo) / (hi - lo) : 0
  return metric === 'dark' ? 1 - t : t
}

export function cellColor(value: number, metric: HeatMetric, domain: [number, number]): string {
  return colorAt(scaleT(value, metric, domain))
}

export interface Tick { t: number; label: string }

// Legend ticks in the metric's own unit: % for Sun and link, days for darkness.
export function legendTicks(metric: HeatMetric, domain: [number, number]): Tick[] {
  if (metric !== 'dark') return [0, 25, 50, 75, 100].map(v => ({ t: scaleT(v, metric, domain), label: `${v}%` }))
  const maxDays = domain[1] / 24
  // At most about 6 labels, so they never overlap on the bar.
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(st => maxDays / st <= 6) ?? 1000
  const out: Tick[] = []
  const tick = (d: number) => ({ t: scaleT(d * 24, metric, domain), label: `${Math.round(d)} d` })
  for (let d = 0; d <= maxDays + 1e-9; d += step) out.push(tick(d))
  // Label the far end of the bar too; replace the last tick if it would crowd it.
  const gap = maxDays - step * (out.length - 1)
  if (gap > 1e-9) { if (gap <= step / 2) out.pop(); out.push(tick(maxDays)) }
  return out
}
