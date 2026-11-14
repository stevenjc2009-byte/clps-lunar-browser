// Interpolation against 10-minute truth. The fixtures (branch data-v2, backend/tenmin.py) hold
// Sun/Earth alt/az computed directly every 10 min for 60 days, written to 3 decimals. The
// hourly series is every 6th truth sample, rounded the way a sky.json ships it; the engine
// upsamples it back to 10 min and we compare with the truth.
//
// Error sources are kept apart (measured values in docs/decisions/engine.md):
//  - interpolation alone (3-decimal hourly input = sky.json v2 altitudes): altitude < 0.005 deg,
//    crossings < 5 min. The fixtures have 3 decimals, so nothing finer can be measured.
//  - sky.json v1 rounded altitude to 2 decimals: +-0.005 deg, which moves a crossing by
//    0.005 / rate. For the Sun near Shackleton (~0.01 deg/h) that is ~30 min, whatever the
//    interpolation, so that crossing bound scales with the local rate.
//  - both versions round azimuth to 1 decimal (+-0.05 deg); interpolation adds < 0.002 deg
//    inside the data and up to ~0.04 deg in the last hourly segment (clamped end point).

import { describe, expect, it } from 'vitest'
import im2 from './__fixtures__/tenmin-im2.json'
import pns from './__fixtures__/tenmin-peak-near-shackleton.json'
import { upsampleAz, upsampleCubic } from './interp'
import { positiveIntervals } from './visibility'

interface Fixture { site: string; sun_alt: number[]; sun_az: number[]; earth_alt: number[]; earth_az: number[] }

const keepSign = (nd: number) => (a: number) => { const f = 10 ** nd, r = Math.round(a * f) / f; return a > 0 && r <= 0 ? 1 / f : r }
const exact = (a: number) => a
const hourly = (a: number[], round: (x: number) => number) => a.filter((_, i) => i % 6 === 0).map(round)
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const crossings = (alt: number[], n: number) =>
  positiveIntervals(alt.slice(0, n), 0, 1 / 6).flat().filter(t => t > 0 && t < (n - 1) / 6)

function measure(f: Fixture, body: 'sun' | 'earth', altRound: (x: number) => number, azRound: (x: number) => number) {
  const truthAlt = f[`${body}_alt`], truthAz = f[`${body}_az`]
  const n = Math.floor((truthAlt.length - 1) / 6) * 6 + 1
  const alt = upsampleCubic(hourly(truthAlt, altRound))
  const az = upsampleAz(hourly(truthAz, azRound))
  let altErr = 0, azInner = 0, azEnds = 0
  for (let k = 0; k < n; k++) {
    altErr = Math.max(altErr, Math.abs(alt[k] - truthAlt[k]))
    const e = angDiff(az[k], truthAz[k])
    if (k >= 6 && k <= n - 7) azInner = Math.max(azInner, e); else azEnds = Math.max(azEnds, e)
  }
  const tTruth = crossings(truthAlt, n), tInterp = crossings(Array.from(alt), n)
  // local rate of the truth at each crossing, deg/h
  const rate = tTruth.map(t => { const k = Math.round(t * 6); return Math.abs(truthAlt[Math.min(k + 1, n - 1)] - truthAlt[Math.max(k - 1, 0)]) * 3 })
  return { altErr, azInner, azEnds, tTruth, tInterp, rate }
}

describe.each([im2, pns] as Fixture[])('10-min truth: $site', f => {
  for (const body of ['sun', 'earth'] as const) {
    it(`${body}: interpolation alone within 0.005 deg and 5 min; azimuth within 0.002 deg inside the data`, () => {
      const m = measure(f, body, exact, exact)
      expect(m.altErr).toBeLessThan(0.005)
      expect(m.azInner).toBeLessThan(0.002)
      expect(m.azEnds).toBeLessThan(0.05)
      expect(m.tInterp.length).toBe(m.tTruth.length)
      m.tTruth.forEach((t, i) => expect(Math.abs(t - m.tInterp[i]) * 60).toBeLessThan(5))
    })
    it(`${body}: sky.json v2 rounding (alt 3 dp, az 1 dp): altitude within 0.005 deg, azimuth within 0.06 deg, crossings within 5 min`, () => {
      const m = measure(f, body, keepSign(3), keepSign(1))
      expect(m.altErr).toBeLessThan(0.005)
      expect(m.azInner).toBeLessThan(0.06)
      expect(m.azEnds).toBeLessThan(0.09)
      expect(m.tInterp.length).toBe(m.tTruth.length)
      m.tTruth.forEach((t, i) => expect(Math.abs(t - m.tInterp[i]) * 60).toBeLessThan(5))
    })
    it(`${body}: sky.json v1 rounding (alt 2 dp): within 0.01 deg; crossings within 0.008 deg / rate + 5 min`, () => {
      const m = measure(f, body, keepSign(2), keepSign(1))
      expect(m.altErr).toBeLessThan(0.01)
      expect(m.tInterp.length).toBe(m.tTruth.length)
      m.tTruth.forEach((t, i) => {
        const boundMin = (0.008 / m.rate[i]) * 60 + 5
        expect(Math.abs(t - m.tInterp[i]) * 60, `crossing at ${t.toFixed(1)} h, rate ${m.rate[i].toFixed(3)}`).toBeLessThan(boundMin)
      })
    })
  }
})
