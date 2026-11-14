// Numbers for the annual landing-window heatmap: one row per site, one column per landing
// day, each cell = one metric for the window that starts at 00:00 UTC that day.
//
// Every cell is cut from the same per-site timeline (siteTimeline) as the comparison cards,
// with the same clamping and rounding, so a cell always equals the card value for that
// landing date and look-ahead (tested in heatmapData.test.ts).

import type { Site, SkyData } from '../types'
import { siteTimeline, type EngineData, type Timeline } from './engine'
import { isoDay } from './format'
import { coveredIn } from './intervals'
import type { Params } from './params'
import { COMMS_MARGIN_PTS, ENERGY_MARGIN_PTS, NIGHT_MARGIN_H } from './verdict'
import { dataEndH, dataStartMs, defaultLandingDay, landingRangeH } from './window'
import { clampWindow, longestRun } from './windowMetrics'

export type HeatMetric = 'sun' | 'link' | 'dark'

const HOUR_MS = 3_600_000
const round1 = (x: number) => Math.round(x * 10) / 10

export interface LandingDays {
  startsH: number[]   // window start of each landing day, hours from the first sample
  isos: string[]      // the same days as YYYY-MM-DD (UTC)
}

// Landing days from the first whole UTC day of the supported landing range to the last
// start that still leaves room for the look-ahead. Same rule as the landing-date chart:
// a day whose window would run past the data is left out, never clamped.
export function landingDays(data: SkyData, lenH: number): LandingDays {
  const t0 = dataStartMs(data)
  const firstH = (Date.parse(`${defaultLandingDay(data)}T00:00:00Z`) - t0) / HOUR_MS
  const { maxH } = landingRangeH(data, lenH)
  const end = dataEndH(data)
  const startsH: number[] = [], isos: string[] = []
  for (let s = firstH; s <= maxH + 1e-9 && s + lenH <= end + 1e-9; s += 24) {
    startsH.push(s)
    isos.push(isoDay(t0 + s * HOUR_MS))
  }
  return { startsH, isos }
}

export interface Cell { value: number; censored: boolean }

// One cell. Percentages are rounded to 0.1 exactly like windowMetrics; darkness is hours,
// the full length of the longest night touching the window (censored = runs past the data).
export function cellValue(tl: Timeline, metric: HeatMetric, startH: number, lenH: number): Cell {
  const [lo, hi] = clampWindow(tl, startH, lenH)
  const L = hi - lo
  if (metric === 'dark') {
    const r = longestRun(tl.dark, lo, hi, tl.end)
    return { value: r.hours, censored: r.status === 'at_least' }
  }
  const cum = metric === 'sun' ? tl.sunCum : tl.linkCum
  return { value: L > 0 ? round1((100 * coveredIn(cum, lo, hi)) / L) : 0, censored: false }
}

export interface HeatRow {
  site: Site
  values: Float64Array     // one per landing day
  censored: Uint8Array     // 1 = darkness is only a lower bound ("at least")
  best: Uint8Array         // 1 = among this row's best 10% (see bestMask)
  spread: number           // best minus worst value in the row (always >= 0)
  flatRow: boolean         // spread is under the verdict margin: the date barely matters
  terrain: boolean
  commsKind: 'link' | 'earth'
  dsnMissing: boolean
}

export interface HeatGrid {
  metric: HeatMetric
  lenH: number
  days: LandingDays
  rows: HeatRow[]
  domain: [number, number] // colour scale range: 0-100 for %, 0-longest night (whole days) for darkness
}

// Higher is better for Sun and link; lower is better for darkness.
export const higherIsBetter = (m: HeatMetric) => m !== 'dark'

// Same margins the verdict uses to call a lead "too close": 2 points, or 1 day of night.
export function marginFor(m: HeatMetric): number {
  return m === 'sun' ? ENERGY_MARGIN_PTS : m === 'link' ? COMMS_MARGIN_PTS : NIGHT_MARGIN_H
}

// The best `frac` of the row (at least one cell), ties included. Censored darkness cells
// are never "best": they are only a lower bound and could be longer. Rows whose spread
// is under the verdict margin get no highlight at all (the date makes no real difference).
export function bestMask(values: Float64Array, censored: Uint8Array, metric: HeatMetric, frac = 0.1): Uint8Array {
  const out = new Uint8Array(values.length)
  const usable: number[] = []
  values.forEach((v, i) => { if (!censored[i]) usable.push(v) })
  if (!usable.length) return out
  const hi = higherIsBetter(metric)
  usable.sort((a, b) => (hi ? b - a : a - b))
  if (Math.abs(usable[0] - usable[usable.length - 1]) < marginFor(metric)) return out
  const k = Math.max(1, Math.ceil(frac * usable.length))
  const cut = usable[k - 1]
  values.forEach((v, i) => { if (!censored[i] && (hi ? v >= cut : v <= cut)) out[i] = 1 })
  return out
}

// Up to `n` recommended days: the single best day of each separate run of "best" cells,
// best runs first. Separate runs keep the list from being three neighbouring days.
export function bestDays(row: Pick<HeatRow, 'values' | 'best'>, metric: HeatMetric, n = 3): number[] {
  const picks: number[] = []
  const hi = higherIsBetter(metric)
  const better = (a: number, b: number) => (hi ? row.values[a] > row.values[b] : row.values[a] < row.values[b])
  let cur = -1
  for (let i = 0; i <= row.best.length; i++) {
    if (i < row.best.length && row.best[i]) { if (cur < 0 || better(i, cur)) cur = i }
    else if (cur >= 0) { picks.push(cur); cur = -1 }
  }
  picks.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : a - b))
  return picks.slice(0, n)
}

export function heatRow(ed: EngineData, site: Site, params: Params, metric: HeatMetric, days: LandingDays, lenH: number): HeatRow {
  const tl = siteTimeline(ed, site, params)
  const n = days.startsH.length
  const values = new Float64Array(n), censored = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const c = cellValue(tl, metric, days.startsH[i], lenH)
    values[i] = c.value
    censored[i] = c.censored ? 1 : 0
  }
  let lo = Infinity, hiV = -Infinity
  for (const v of values) { lo = Math.min(lo, v); hiV = Math.max(hiV, v) }
  const spread = n ? hiV - lo : 0
  return {
    site, values, censored, best: bestMask(values, censored, metric), spread,
    flatRow: spread < marginFor(metric),
    terrain: tl.terrain, commsKind: tl.commsKind, dsnMissing: tl.dsnMissing,
  }
}

export function heatmapGrid(ed: EngineData, sites: Site[], params: Params, metric: HeatMetric, lookDays: number): HeatGrid {
  const lenH = lookDays * 24
  const days = landingDays(ed.sky, lenH)
  const rows = sites.map(s => heatRow(ed, s, params, metric, days, lenH))
  let domain: [number, number] = [0, 100]
  if (metric === 'dark') {
    let mx = 0
    for (const r of rows) for (const v of r.values) mx = Math.max(mx, v)
    domain = [0, Math.max(24, Math.ceil(mx / 24) * 24)]
  }
  return { metric, lenH, days, rows, domain }
}
