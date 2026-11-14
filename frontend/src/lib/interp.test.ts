import { describe, expect, it } from 'vitest'
import { catmullRom, unwrapDeg, upsampleAz, upsampleCubic, upsampleLinear, wrap360 } from './interp'

describe('catmullRom', () => {
  it('passes through the two middle points', () => {
    expect(catmullRom(1, 2, 5, 3, 0)).toBe(2)
    expect(catmullRom(1, 2, 5, 3, 1)).toBe(5)
  })
  it('reproduces a straight line exactly', () => {
    expect(catmullRom(0, 1, 2, 3, 0.25)).toBeCloseTo(1.25, 12)
  })
})

describe('upsampleCubic', () => {
  it('has (n-1)*sub+1 points that hit every hourly value', () => {
    const v = [0, 3, -1, 4, 2]
    const u = upsampleCubic(v, 6)
    expect(u.length).toBe(25)
    v.forEach((x, i) => expect(u[i * 6]).toBeCloseTo(x, 12))
  })
  it('follows a smooth curve far better than straight lines do', () => {
    // hourly samples of a slow sine (period 30 h, like a fast polar elevation swing)
    const f = (t: number) => 2 * Math.sin((2 * Math.PI * t) / 30)
    const hourly = Array.from({ length: 61 }, (_, i) => f(i))
    const cubic = upsampleCubic(hourly, 6), lin = upsampleLinear(hourly, 6)
    let ec = 0, el = 0
    for (let k = 6; k < cubic.length - 6; k++) {
      ec = Math.max(ec, Math.abs(cubic[k] - f(k / 6)))
      el = Math.max(el, Math.abs(lin[k] - f(k / 6)))
    }
    expect(ec).toBeLessThan(el / 5)
    expect(ec).toBeLessThan(2e-3)
  })
  it('handles 0 and 1 samples', () => {
    expect(upsampleCubic([]).length).toBe(0)
    expect(Array.from(upsampleCubic([7]))).toEqual([7])
  })
})

describe('azimuth', () => {
  it('unwraps 359 -> 1 as +2, not -358', () => {
    expect(Array.from(unwrapDeg([358, 359, 1, 3]))).toEqual([358, 359, 361, 363])
    expect(Array.from(unwrapDeg([2, 1, 359]))).toEqual([2, 1, -1])
  })
  it('interpolates across north without swinging through south', () => {
    const u = upsampleAz([358, 0, 2, 4], 2)
    // midpoint between 358 and 0 must be ~359, not ~179
    expect(u[1]).toBeGreaterThan(358.5)
    expect(u[1]).toBeLessThan(359.5)
    for (const a of u) { expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(360) }
  })
  it('wrap360 maps any angle into 0..360', () => {
    expect(wrap360(-1)).toBe(359)
    expect(wrap360(721)).toBe(1)
  })
})
