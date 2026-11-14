// Interpolation against 10-minute truth. The fixtures (from branch data-v2, backend/tenmin.py)
// hold Sun/Earth alt/az computed directly every 10 min for 60 days. The hourly series the
// app ships is every 6th truth sample, rounded like sky.json (2 decimals, keep sign).
// We upsample that back to 10 min with the engine and compare with the truth.
//
// Two error sources are kept apart (measured values in docs/decisions/engine.md):
//  - interpolation alone (full-precision hourly input): altitude < 0.005 deg, crossings < 5 min;
//  - the shipped 2-decimal rounding: +-0.005 deg of altitude, which moves a crossing by
//    0.005 / rate. For the Sun near Shackleton (~0.01 deg/h) that is ~30 min and cannot be
//    removed by any interpolation, so the crossing bound scales with the local rate.
// Azimuth: the last hourly segment uses a clamped end point, so it is checked separately.

import { describe, expect, it } from 'vitest'
import im2 from './__fixtures__/tenmin-im2.json'
import pns from './__fixtures__/tenmin-peak-near-shackleton.json'
import { upsampleAz, upsampleCubic } from './interp'
import { positiveIntervals } from './visibility'

interface Fixture { site: string; sun_alt: number[]; sun_az: number[]; earth_alt: number[]; earth_az: number[] }

const keepSign = (a: number) => { const r = Math.round(a * 100) / 100; return a > 0 && r <= 0 ? 0.01 : r }
const hourly = (a: number[], round: (x: number) => number) => a.filter((_, i) => i % 6 === 0).map(round)
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const crossings = (alt: number[], n: number) =>
  positiveIntervals(alt.slice(0, n), 0, 1 / 6).flat().filter(t => t > 0 && t < (n - 1) / 6)

function measure(f: Fixture, body: 'sun' | 'earth', round: (x: number) => number) {
  const truthAlt = f[`${body}_alt`], truthAz = f[`${body}_az`]
  const n = Math.floor((truthAlt.length - 1) / 6) * 6 + 1
  const alt = upsampleCubic(hourly(truthAlt, round))
  const az = upsampleAz(hourly(truthAz, x => Math.round(x * 100) / 100))
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
    it(`${body}: interpolation alone within 0.005 deg and 5 min`, () => {
      const m = measure(f, body, x => x)
      expect(m.altErr).toBeLessThan(0.005)
      expect(m.tInterp.length).toBe(m.tTruth.length)
      m.tTruth.forEach((t, i) => expect(Math.abs(t - m.tInterp[i]) * 60).toBeLessThan(5))
    })
    it(`${body}: shipped 2-dp data within 0.01 deg; crossings within 0.008 deg / rate + 5 min`, () => {
      const m = measure(f, body, keepSign)
      expect(m.altErr).toBeLessThan(0.01)
      expect(m.azInner).toBeLessThan(0.01)
      expect(m.azEnds).toBeLessThan(0.05)
      expect(m.tInterp.length).toBe(m.tTruth.length)
      m.tTruth.forEach((t, i) => {
        const boundMin = (0.008 / m.rate[i]) * 60 + 5
        expect(Math.abs(t - m.tInterp[i]) * 60, `crossing at ${t.toFixed(1)} h, rate ${m.rate[i].toFixed(3)}`).toBeLessThan(boundMin)
      })
    })
  }
})
