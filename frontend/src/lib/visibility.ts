// When is a body visible? Turns sub-step positions into visible time intervals.
// "Margin" = how far (degrees) the chosen point of the disc is above the skyline; the
// body counts as visible while margin > 0. Each change of sign between two sub-steps
// is placed by a straight line between them, so times are not rounded to the step.

import type { Intervals } from './intervals'
import { maskAt, maskOverDisc, type Mask } from './horizon'

export type SunRule = 'upper_limb' | 'centre'
export type EarthRule = 'centre' | 'any_part' | 'whole_disc'
export type DiscPoint = 'top' | 'centre' | 'bottom'

export const SUN_POINT: Record<SunRule, DiscPoint> = { upper_limb: 'top', centre: 'centre' }
export const EARTH_POINT: Record<EarthRule, DiscPoint> = { centre: 'centre', any_part: 'top', whole_disc: 'bottom' }

// centre: centre above the skyline at the centre's azimuth.
// top (any part / upper limb): top edge above the highest skyline across the disc's width.
// bottom (whole disc): bottom edge above the highest skyline across the disc's width.
export function margins(
  alt: Float64Array, az: Float64Array, radius: Float64Array | number, point: DiscPoint, mask: Mask,
): Float64Array {
  const out = new Float64Array(alt.length)
  for (let k = 0; k < alt.length; k++) {
    const r = typeof radius === 'number' ? radius : radius[k]
    if (point === 'centre') out[k] = alt[k] - maskAt(mask, az[k])
    else {
      const sky = maskOverDisc(mask, az[k], r)
      out[k] = point === 'top' ? alt[k] + r - sky : alt[k] - r - sky
    }
  }
  return out
}

// Intervals where f > 0. Sample k sits at time t0 + k * dt.
export function positiveIntervals(f: ArrayLike<number>, t0: number, dt: number): Intervals {
  const out: Intervals = []
  const n = f.length
  if (!n) return out
  let start: number | null = f[0] > 0 ? t0 : null
  for (let k = 1; k < n; k++) {
    const a = f[k - 1], b = f[k]
    const up = b > 0
    if (up === (start !== null)) continue
    // a and b sit on different sides of 0 (or b is exactly 0): place the crossing.
    const frac = a === b ? 1 : Math.min(1, Math.max(0, a / (a - b)))
    const t = t0 + (k - 1 + frac) * dt
    if (up) {
      // Touching the previous piece (dipped to exactly 0 for an instant): join them.
      const last = out[out.length - 1]
      if (last && last[1] >= t) { out.pop(); start = last[0] } else start = t
    } else {
      if (start !== null && t > start) out.push([start, t])
      start = null
    }
  }
  if (start !== null) {
    const end = t0 + (n - 1) * dt
    if (end > start) out.push([start, end])
  }
  return out
}
