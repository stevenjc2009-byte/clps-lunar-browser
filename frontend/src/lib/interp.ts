// Hourly samples -> finer sub-steps (default 10 minutes = 6 per hour).
// Elevations use a Catmull-Rom cubic through the hourly points; azimuths are unwrapped
// (no 359 -> 0 jumps) before interpolating and wrapped back to 0..360 after.
// Output index k sits at sample time k / sub (in sample steps), so with n samples the
// output has (n - 1) * sub + 1 points and its first and last points equal the input's.

export const SUBSTEPS = 6

// Catmull-Rom (uniform, tension 0.5) between p1 (t=0) and p2 (t=1).
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

// Cubic upsampling. End segments repeat the end point as the missing neighbour.
export function upsampleCubic(v: ArrayLike<number>, sub = SUBSTEPS): Float64Array {
  const n = v.length
  if (n === 0) return new Float64Array(0)
  const out = new Float64Array((n - 1) * sub + 1)
  for (let i = 0; i < n - 1; i++) {
    const p0 = v[i > 0 ? i - 1 : 0], p1 = v[i], p2 = v[i + 1], p3 = v[i + 2 < n ? i + 2 : n - 1]
    for (let k = 0; k < sub; k++) out[i * sub + k] = catmullRom(p0, p1, p2, p3, k / sub)
  }
  out[(n - 1) * sub] = v[n - 1]
  return out
}

// Straight-line upsampling, for series with kinks (for example a maximum over three
// stations) where a cubic would overshoot.
export function upsampleLinear(v: ArrayLike<number>, sub = SUBSTEPS): Float64Array {
  const n = v.length
  if (n === 0) return new Float64Array(0)
  const out = new Float64Array((n - 1) * sub + 1)
  for (let i = 0; i < n - 1; i++) {
    const a = v[i], d = v[i + 1] - a
    for (let k = 0; k < sub; k++) out[i * sub + k] = a + (d * k) / sub
  }
  out[(n - 1) * sub] = v[n - 1]
  return out
}

// Remove 360° jumps: each step is taken as the shorter way round.
export function unwrapDeg(az: ArrayLike<number>): Float64Array {
  const out = new Float64Array(az.length)
  if (!az.length) return out
  out[0] = az[0]
  for (let i = 1; i < az.length; i++) {
    let d = az[i] - az[i - 1]
    d -= 360 * Math.round(d / 360)
    out[i] = out[i - 1] + d
  }
  return out
}

export const wrap360 = (a: number) => ((a % 360) + 360) % 360

export function upsampleAz(az: ArrayLike<number>, sub = SUBSTEPS): Float64Array {
  const out = upsampleCubic(unwrapDeg(az), sub)
  for (let k = 0; k < out.length; k++) out[k] = wrap360(out[k])
  return out
}
