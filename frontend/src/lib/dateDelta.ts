// Differences between two landing dates for one site (date B minus date A), judged with
// the same margins the site verdict uses to call a lead "too close" (lib/verdict.ts).

import { fmtDuration } from './format'
import { NIGHT_MARGIN_H } from './verdict'
import type { Run } from './windowMetrics'

export type DeltaVerdict = 'better' | 'worse' | 'same' | 'unknown'
export interface DeltaLine { name: string; cls?: string; a: string; b: string; delta: string; v: DeltaVerdict }

const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±')

// Percentages: higher is better. Differences under `margin` points are "about the same".
export function pctLine(name: string, cls: string, a: number, b: number, margin: number): DeltaLine {
  const d = Math.round((b - a) * 10) / 10
  const v: DeltaVerdict = Math.abs(d) < margin ? 'same' : d > 0 ? 'better' : 'worse'
  return { name, cls, a: `${a.toFixed(1)}%`, b: `${b.toFixed(1)}%`, delta: `${sign(d)}${Math.abs(d).toFixed(1)} points`, v }
}

// Longest darkness: shorter is better. A censored night ("at least") is only a lower
// bound, so the call is "unknown" unless the bounds already settle it.
export function darkLine(a: Run, b: Run): DeltaLine {
  const show = (r: Run) => `${r.status === 'at_least' ? '≥ ' : ''}${fmtDuration(r.hours)}`
  const d = b.hours - a.hours
  let v: DeltaVerdict = Math.abs(d) < NIGHT_MARGIN_H ? 'same' : d < 0 ? 'better' : 'worse'
  if ((a.status === 'at_least' && d > -NIGHT_MARGIN_H) || (b.status === 'at_least' && d < NIGHT_MARGIN_H)) v = 'unknown'
  return { name: 'Longest darkness', a: show(a), b: show(b), delta: `${sign(d)}${fmtDuration(Math.abs(d))}`, v }
}

export const DELTA_TEXT: Record<DeltaVerdict, string> = {
  better: 'date B better', worse: 'date B worse', same: 'about the same', unknown: 'cannot say: the night runs past our data',
}
