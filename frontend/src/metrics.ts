import type { Site, SkyData } from './types'

const HOUR_MS = 3_600_000

// A slice of the hourly samples: indices [start, end).
export interface Span { start: number; end: number }

export interface Metrics {
  sunPct: number            // % of hours with the Sun's centre above the flat horizon
  earthPct: number          // % of hours with Earth's centre above the flat horizon
  longestDarkHours: number  // longest unbroken run of hours with the Sun at or below 0°
  darkCut: boolean          // that run touches the edge of the window, so the real night may be longer
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
  let sunUp = 0, earthUp = 0, run = 0, best = 0, bestEndsAt = -1, bestStartsAt = -1
  let sunMin = Infinity, sunMax = -Infinity, earthMin = Infinity, earthMax = -Infinity
  for (let i = start; i < end; i++) {
    const s = site.sun_alt[i], e = site.earth_alt[i]
    if (s > 0) { sunUp++; run = 0 } else {
      run++
      if (run > best) { best = run; bestEndsAt = i; bestStartsAt = i - run + 1 }
    }
    if (e > 0) earthUp++
    if (s < sunMin) sunMin = s
    if (s > sunMax) sunMax = s
    if (e < earthMin) earthMin = e
    if (e > earthMax) earthMax = e
  }
  const n = end - start
  return {
    sunPct: round1((100 * sunUp) / n),
    earthPct: round1((100 * earthUp) / n),
    longestDarkHours: best * stepHours,
    // `run` is now the dark run still going at the window's end; if it ties the longest, the real night may be longer.
    darkCut: best > 0 && (bestStartsAt === start || bestEndsAt === end - 1 || run === best),
    sunMin, sunMax, earthMin, earthMax,
  }
}

export type Verdict = 'energy' | 'comms' | 'both' | 'balanced'

export const VERDICT_TEXT: Record<Verdict, string> = {
  energy: 'Best for energy',
  comms: 'Best for communication',
  both: 'Best for energy & communication',
  balanced: 'Balanced',
}

// Energy: most Sun (ties -> shorter darkness). Comms: most Earth (ties share it).
// Balanced: of the sites with no other label, the best worst-case of Sun % and Earth %.
// Compared on the 0.1 %-rounded values the page shows, so an on-screen tie is a tie.
export function verdicts(rows: { id: string; m: Metrics }[]): Record<string, Verdict | null> {
  const out: Record<string, Verdict | null> = Object.fromEntries(rows.map(r => [r.id, null]))
  if (rows.length < 2) return out

  const maxSun = Math.max(...rows.map(r => r.m.sunPct))
  const sunTop = rows.filter(r => r.m.sunPct === maxSun)
  const minDark = Math.min(...sunTop.map(r => r.m.longestDarkHours))
  const energy = new Set(sunTop.filter(r => r.m.longestDarkHours === minDark).map(r => r.id))

  const maxEarth = Math.max(...rows.map(r => r.m.earthPct))
  const comms = new Set(rows.filter(r => r.m.earthPct === maxEarth).map(r => r.id))

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
