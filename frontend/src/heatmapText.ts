// Plain-language text for the heatmap, compare-dates, presets and mission panels.
// Kept apart from explanations.ts so these components need no edits to shared files.

import { fmtDuration } from './lib/format'
import type { HeatMetric } from './lib/heatmapData'

export function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export const lookLabel = (days: number) => (days === 365 ? '1 year' : `${days} days`)

// Short name of the metric as it reads in a sentence.
export function metricName(m: HeatMetric, commsKind: 'link' | 'earth'): string {
  return m === 'sun' ? 'Sun' : m === 'dark' ? 'longest darkness' : commsKind === 'link' ? 'link' : 'Earth in view'
}

export function fmtValue(m: HeatMetric, value: number, censored: boolean): string {
  if (m === 'dark') return `${censored ? 'at least ' : ''}${fmtDuration(value)}`
  return `${value.toFixed(1)}%`
}

// "Shackleton rim, 3 Jan 2027: Sun 61.0%" (the aria label and readout for one cell).
export function cellLabel(site: string, iso: string, m: HeatMetric, value: number, censored: boolean, commsKind: 'link' | 'earth'): string {
  return `${site}, ${fmtDay(iso)}: ${metricName(m, commsKind)} ${fmtValue(m, value, censored)}`
}

export const HEAT_EXPLAIN = {
  heatmap: 'Each row is one landing site and each thin column is one landing day. The colour shows how good things would be over the look-ahead if you landed at 00:00 UTC that day. Bright yellow is better (more Sun, more link time, or a shorter longest night); dark purple is worse. Click a column, or move with the arrow keys and press Enter, to use that landing date.',
  best: 'A white strip under a cell means that day is in the best 10% of landing days for that site, for the measure shown. If every day at a site is within the same small margin the page uses for "too close to call" (2 points, or 1 day for nights), no day is marked: the landing date makes little difference there.',
  hatched: 'Striped cells: the longest night there runs past the edge of our data, so the real night is at least that long and may be longer. These days are never marked as best.',
  oneYear: 'With a 1-year look-ahead every window covers almost the same full year, so the colours hardly change from day to day. Use 30 days to see which time of the month or season is best to arrive.',
  compare: 'Pick two landing dates for one site to see how much the date matters. The difference column is the second date minus the first. Differences smaller than the page\'s "too close to call" margins (2 points, or 1 day for nights) are marked as about the same, because the model is not precise enough to rank them.',
  presets: 'Ready-made sets of model settings. They are illustrative "what if" choices, not settings from a real mission. Each one changes only the settings it names.',
}
