// Pure helpers for the sky graph (no React, no Plotly), so they can be unit-tested.

export const DEFAULT_RANGE: [number, number] = [-5, 10]
export const SUN_MEAN_RADIUS_DEG = 0.2666
export const EARTH_MEAN_RADIUS_DEG = 0.95

// Azimuth 0..360 -> -180..180 so north sits mid-chart. At south-pole sites Earth is
// usually near north, and a 0..360 axis would split its trace across both edges.
export const wrapAz = (az: number): number => (az > 180 ? az - 360 : az)

// Skyline from a horizon table (index i <-> azimuth i*step, degrees) as a polyline over az -180..180.
// Values between table entries are interpolated linearly; the table wraps at 360.
// Without a usable table: a flat line at 0 deg.
export function skyline(horizon: number[] | undefined, step: number | undefined): { x: number[]; y: number[]; flat: boolean } {
  const usable = !!horizon && horizon.length >= 2 && !!step && step > 0 && horizon.every(Number.isFinite)
  const n = Math.max(1, Math.round(360 / (usable ? step! : 1)))
  const dAz = 360 / n
  const x: number[] = [], y: number[] = []
  for (let k = 0; k <= n; k++) {
    const az = -180 + k * dAz
    x.push(az)
    if (!usable) { y.push(0); continue }
    const len = horizon!.length
    const pos = ((((az % 360) + 360) % 360) / step!) % len
    const i0 = Math.floor(pos), f = pos - i0
    y.push(horizon![i0] * (1 - f) + horizon![(i0 + 1) % len] * f)
  }
  return { x, y, flat: !usable }
}

// y-axis range: -5..10 deg, widened upward (to the next multiple of 5) only if a dot in the window or the
// skyline is higher. Dots lower than the bottom are below any horizon here, so they are counted, not drawn.
// (Audit B6: the range used to come from the 2-year stats.)
export function elevationRange(values: number[][], skylineMax = 0): { range: [number, number]; widened: boolean; below: number } {
  let hi = skylineMax, below = 0
  const [rLo, baseHi] = DEFAULT_RANGE
  for (const v of values) for (const a of v) { if (a > hi) hi = a; if (a < rLo) below++ }
  const rHi = hi > baseHi ? Math.ceil(hi / 5) * 5 : baseHi
  return { range: [rLo, rHi], widened: rHi !== baseHi, below }
}

export const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN)

// Mean angular radius over the window, or the long-run mean when the array is missing.
export function meanRadius(arr: number[] | undefined, start: number, end: number, fallback: number): number {
  if (!arr || arr.length === 0) return fallback
  const m = mean(arr.slice(start, end))
  return Number.isFinite(m) ? m : fallback
}

export const SUN_RAMP = ['#a86a00', '#ffb627', '#fff0b3']      // early -> late, dark to pale
export const EARTH_RAMP = ['#2a6bc0', '#4da3ff', '#d4eaff']

export const rampCss = (ramp: string[]) => `linear-gradient(90deg, ${ramp.join(', ')})`
export const plotlyScale = (ramp: string[]): [number, string][] => ramp.map((c, i) => [i / (ramp.length - 1), c])

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

export const fmtDateTime = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

// At most `count` evenly spaced indices from 0..n-1 (always includes the first and last).
export function evenIndices(n: number, count: number): number[] {
  if (n <= 0) return []
  if (n <= count) return Array.from({ length: n }, (_, i) => i)
  return Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / (count - 1)))
}
