import type { Site, SkyData } from './types'

const HOUR_MS = 3_600_000

// A slice of the hourly samples: indices [start, end).
export interface Span { start: number; end: number }

export interface Metrics {
  sunPct: number            // % of hours with the Sun's centre above the flat horizon
  earthPct: number          // % of hours with Earth's centre above the flat horizon
  longestDarkHours: number  // longest unbroken run of hours with the Sun at or below 0°
  darkCut: boolean          // that night runs to the end of the data, so it may really be longer
  sunMin: number; sunMax: number
  earthMin: number; earthMax: number
}

export function dataStartMs(data: SkyData) { return Date.parse(data.meta.start_utc) }

// Window of `days` days starting at UTC midnight of `isoDate`, clamped to the data.
export function spanFor(data: SkyData, isoDate: string, days: number): Span {
  const step = data.meta.step_hours
  const len = Math.round((days * 24) / step)
  const raw = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - dataStartMs(data)) / (step * HOUR_MS))
  const start = Math.max(0, Math.min(data.meta.samples - len, Number.isFinite(raw) ? raw : 0))
  return { start, end: start + len }
}

export function isoDay(ms: number) { return new Date(ms).toISOString().slice(0, 10) }

const round1 = (x: number) => Math.round(x * 10) / 10

export function siteMetrics(site: Site, span: Span, stepHours: number): Metrics {
  const { start, end } = span
  let sunUp = 0, earthUp = 0, run = 0, best = 0
  let sunMin = Infinity, sunMax = -Infinity, earthMin = Infinity, earthMax = -Infinity
  for (let i = start; i < end; i++) {
    const s = site.sun_alt[i], e = site.earth_alt[i]
    if (s > 0) { sunUp++; run = 0 } else {
      run++
      if (run > best) best = run
    }
    if (e > 0) earthUp++
    if (s < sunMin) sunMin = s
    if (s > sunMax) sunMax = s
    if (e < earthMin) earthMin = e
    if (e > earthMax) earthMax = e
  }
  // A night still going when the window ends is followed into the rest of the data, so its
  // real length counts. Only a night that reaches the end of the data is cut off ("≥").
  // A night already going at the landing hour counts from landing: that is what the lander lives through.
  let darkCut = false
  if (run > 0) {
    let j = end
    while (j < site.sun_alt.length && site.sun_alt[j] <= 0) { run++; j++ }
    if (run >= best) { best = run; darkCut = j >= site.sun_alt.length }
  }
  const n = end - start
  return {
    sunPct: round1((100 * sunUp) / n),
    earthPct: round1((100 * earthUp) / n),
    longestDarkHours: best * stepHours,
    darkCut,
    sunMin, sunMax, earthMin, earthMax,
  }
}

// Shortest full night among the sites. A cut-off ("≥") night may really be longer,
// so it can never be the best; null when every night is cut off.
export function bestDarkHours(ms: Metrics[]): number | null {
  const full = ms.filter(m => !m.darkCut).map(m => m.longestDarkHours)
  return full.length ? Math.min(...full) : null
}

// Two sites closer than this (percentage points) are "too close to call": with a flat
// horizon and centre-of-disk visibility, the model cannot honestly rank them.
export const CLOSE_PTS = 2

export interface CloseCall { close: boolean; top: number; next: number }

// Is `value` within CLOSE_PTS of the leader's `top`?
export function nearTop(top: number, value: number) { return round1(top - value) < CLOSE_PTS }

// Is the leader on this score less than CLOSE_PTS ahead of the runner-up?
export function closeCall(values: number[]): CloseCall {
  const v = [...values].sort((a, b) => b - a)
  if (v.length < 2) return { close: false, top: v[0] ?? 0, next: v[0] ?? 0 }
  return { close: nearTop(v[0], v[1]), top: v[0], next: v[1] }
}

export type Verdict = 'energy' | 'comms' | 'both' | 'balanced'

export const VERDICT_TEXT: Record<Verdict, string> = {
  energy: 'Best for energy',
  comms: 'Best for communication',
  both: 'Best for energy & communication',
  balanced: 'Balanced',
}

// Energy: most Sun. Comms: most Earth. Either label goes only to a leader at least CLOSE_PTS
// ahead of the runner-up; otherwise that score is too close to call and nobody gets it.
// Balanced: of the sites with no other label, the best worst-case of Sun % and Earth %.
// Compared on the 0.1 %-rounded values the page shows.
export function verdicts(rows: { id: string; m: Metrics }[]): Record<string, Verdict | null> {
  const out: Record<string, Verdict | null> = Object.fromEntries(rows.map(r => [r.id, null]))
  if (rows.length < 2) return out

  const leader = (score: (m: Metrics) => number) => {
    const c = closeCall(rows.map(r => score(r.m)))
    return new Set(c.close ? [] : rows.filter(r => score(r.m) === c.top).map(r => r.id))
  }
  const energy = leader(m => m.sunPct)
  const comms = leader(m => m.earthPct)

  for (const r of rows) {
    if (energy.has(r.id) && comms.has(r.id)) out[r.id] = 'both'
    else if (energy.has(r.id)) out[r.id] = 'energy'
    else if (comms.has(r.id)) out[r.id] = 'comms'
  }
  const rest = rows.filter(r => out[r.id] === null)
  if (rest.length) {
    const score = (m: Metrics) => Math.min(m.sunPct, m.earthPct)
    const top = Math.max(...rest.map(r => score(r.m)))
    for (const r of rest) if (score(r.m) === top) out[r.id] = 'balanced'
  }
  return out
}

export function fmtDuration(hours: number) {
  if (hours < 48) return `${hours} h`
  return `${(hours / 24).toFixed(1)} days`
}
