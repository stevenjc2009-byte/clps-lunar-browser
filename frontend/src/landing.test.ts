import { describe, expect, it } from 'vitest'
import { sunPctByDay } from './landing'
import { siteMetrics } from './metrics'
import type { Site } from './types'

function site(sun: number[]): Site {
  return {
    id: 's', name: 's', lat: 0, lon: 0, note: '', source: '',
    stats: { sun_visible_pct: 0, earth_visible_pct: 0, longest_dark_hours: 0, sun_alt_max: 0, sun_alt_min: 0, earth_alt_max: 0, earth_alt_min: 0 },
    sun_alt: sun, sun_az: sun.map(() => 0), earth_alt: sun, earth_az: sun.map(() => 0),
  }
}

describe('sunPctByDay', () => {
  it('matches siteMetrics for every landing day', () => {
    // 10 days of hourly samples with an uneven day/night pattern
    const sun = Array.from({ length: 240 }, (_, i) => Math.sin(i / 17) + Math.sin(i / 5) * 0.4)
    const len = 72
    const got = sunPctByDay(sun, len, 24)
    expect(got.length).toBe(8) // days 0..7 fit a 3-day window in 10 days
    got.forEach((v, d) => {
      expect(v).toBe(siteMetrics(site(sun), { start: d * 24, end: d * 24 + len }, 1).sunPct)
    })
  })
  it('counts exactly 0° as not up', () => {
    expect(sunPctByDay([0, 0, 1, 1], 4, 1)).toEqual([50])
  })
  it('returns nothing when the window is longer than the data', () => {
    expect(sunPctByDay([1, 1], 3, 1)).toEqual([])
  })
})
