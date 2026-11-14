// Sun % for every possible landing day, cut from the same timeline as the cards, so the
// chart's value on the picked date equals the Sun % on the cards.

import type { Timeline } from './engine'
import { coveredIn } from './intervals'
import { clampWindow } from './windowMetrics'

const round1 = (x: number) => Math.round(x * 10) / 10

export interface DaySeries {
  startsH: number[]   // window start of each landing day (hours from the first sample)
  sunPct: number[]
}

// Landing days run from firstH to lastH (inclusive, both hours from the first sample) in
// steps of `everyH`. A day whose window would run past the data is left out, never
// clamped, so a point always means "landing that day".
export function sunPctByDay(tl: Timeline, lenH: number, firstH: number, lastH: number, everyH = 24): DaySeries {
  const startsH: number[] = [], sunPct: number[] = []
  for (let s = Math.max(0, firstH); s <= lastH + 1e-9 && s + lenH <= tl.end + 1e-9; s += everyH) {
    const [lo, hi] = clampWindow(tl, s, lenH)
    startsH.push(s)
    sunPct.push(hi > lo ? round1((100 * coveredIn(tl.sunCum, lo, hi)) / (hi - lo)) : 0)
  }
  return { startsH, sunPct }
}
