// "What happens after landing": is the body visible at the landing moment, and when does
// that next change? Read straight off the visible intervals, so the times carry the same
// 10-minute interpolation and crossing refinement as every other number (a few minutes).

import { indexAt, type Intervals } from './intervals'

export interface NextChange {
  up: boolean          // visible at the landing moment
  atH: number | null   // hours from the first sample of the next rise/set; null if none before the data ends
}

export function nextChange(ivs: Intervals, fromH: number, dataEndH: number): NextChange {
  const k = indexAt(ivs, fromH)
  if (k >= 0) {
    const end = ivs[k][1]
    return { up: true, atH: end >= dataEndH ? null : end }
  }
  const next = ivs.find(([a]) => a > fromH)
  return { up: false, atH: next ? next[0] : null }
}
