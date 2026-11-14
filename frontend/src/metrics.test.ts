import { describe, expect, it } from 'vitest'
import { bestDarkHours, fmtDuration, siteMetrics, spanFor, verdicts, type Metrics } from './metrics'
import type { Site, SkyData } from './types'

const START = '2026-11-15T00:00:00Z'

function makeData(samples: number, stepHours = 1): SkyData {
  return {
    meta: {
      start_utc: START, end_utc: START, step_hours: stepHours, samples,
      ephemeris: 'test', horizon: 'flat',
    },
    sites: [],
  }
}

function makeSite(sun: number[], earth: number[] = sun.map(() => 1)): Site {
  return {
    id: 's', name: 's', lat: 0, lon: 0, note: '', source: '',
    stats: {
      sun_visible_pct: 0, earth_visible_pct: 0, longest_dark_hours: 0,
      sun_alt_max: 0, sun_alt_min: 0, earth_alt_max: 0, earth_alt_min: 0,
    },
    sun_alt: sun, sun_az: sun.map(() => 0), earth_alt: earth, earth_az: earth.map(() => 0),
  }
}

function m(sunPct: number, earthPct: number, longestDarkHours = 0, darkCut = false): Metrics {
  return {
    sunPct, earthPct, longestDarkHours, darkCut,
    sunMin: 0, sunMax: 0, earthMin: 0, earthMax: 0,
  }
}

describe('spanFor', () => {
  const data = makeData(240) // 10 days of hourly samples

  it('picks the window starting at the requested date', () => {
    expect(spanFor(data, '2026-11-18', 2)).toEqual({ start: 72, end: 120 })
  })
  it('starts at 0 for the first data day', () => {
    expect(spanFor(data, '2026-11-15', 1)).toEqual({ start: 0, end: 24 })
  })
  it('clamps a date before the data to the start', () => {
    expect(spanFor(data, '2020-01-01', 2)).toEqual({ start: 0, end: 48 })
  })
  it('clamps a date after the data so the window ends at the last sample', () => {
    expect(spanFor(data, '2030-01-01', 2)).toEqual({ start: 192, end: 240 })
  })
  it('clamps a window that would overrun the end', () => {
    expect(spanFor(data, '2026-11-24', 3)).toEqual({ start: 168, end: 240 })
  })
  it('falls back to the start for an unparseable date', () => {
    expect(spanFor(data, 'not-a-date', 2)).toEqual({ start: 0, end: 48 })
  })
  it('respects step_hours', () => {
    const d = makeData(40, 6) // 10 days at 6 h
    expect(spanFor(d, '2026-11-17', 2)).toEqual({ start: 8, end: 16 })
  })
})

describe('siteMetrics', () => {
  it('all up: 100% sun, no darkness, no cut', () => {
    const r = siteMetrics(makeSite([5, 5, 5, 5]), { start: 0, end: 4 }, 1)
    expect(r.sunPct).toBe(100)
    expect(r.longestDarkHours).toBe(0)
    expect(r.darkCut).toBe(false)
  })
  it('all down: 0% sun, whole window dark and cut', () => {
    const r = siteMetrics(makeSite([-1, -2, -3, -4], [-1, -1, -1, -1]), { start: 0, end: 4 }, 1)
    expect(r.sunPct).toBe(0)
    expect(r.earthPct).toBe(0)
    expect(r.longestDarkHours).toBe(4)
    expect(r.darkCut).toBe(true)
  })
  it('dark run in the middle is not cut and takes the longest run', () => {
    const r = siteMetrics(makeSite([3, -1, -1, -1, 3, -1, 3]), { start: 0, end: 7 }, 1)
    expect(r.longestDarkHours).toBe(3)
    expect(r.darkCut).toBe(false)
    expect(r.sunPct).toBe(42.9) // 3 of 7
  })
  it('dark run touching the start is cut', () => {
    const r = siteMetrics(makeSite([-1, -1, 3, 3, 3]), { start: 0, end: 5 }, 1)
    expect(r.longestDarkHours).toBe(2)
    expect(r.darkCut).toBe(true)
  })
  it('dark run touching the end is cut', () => {
    const r = siteMetrics(makeSite([3, 3, 3, -1, -1]), { start: 0, end: 5 }, 1)
    expect(r.longestDarkHours).toBe(2)
    expect(r.darkCut).toBe(true)
  })
  it('equal-longest dark run touching the end is cut even after an earlier tie', () => {
    const r = siteMetrics(makeSite([3, -1, -1, 3, -1, -1]), { start: 0, end: 6 }, 1)
    expect(r.longestDarkHours).toBe(2)
    expect(r.darkCut).toBe(true)
  })
  it('a shorter dark run at the end does not mark the longest as cut', () => {
    const r = siteMetrics(makeSite([3, -1, -1, -1, 3, -1]), { start: 0, end: 6 }, 1)
    expect(r.longestDarkHours).toBe(3)
    expect(r.darkCut).toBe(false)
  })
  it('edge is the window edge, not the array edge', () => {
    const r = siteMetrics(makeSite([-1, 3, -1, -1, 3, -1]), { start: 1, end: 5 }, 1) // [3,-1,-1,3]
    expect(r.longestDarkHours).toBe(2)
    expect(r.darkCut).toBe(false)
  })
  it('alt exactly 0 counts as not visible (dark / Earth down)', () => {
    const r = siteMetrics(makeSite([0, 0, 1, 1], [0, 0, 0, 1]), { start: 0, end: 4 }, 1)
    expect(r.sunPct).toBe(50)
    expect(r.earthPct).toBe(25)
    expect(r.longestDarkHours).toBe(2)
  })
  it('multiplies longest run by stepHours', () => {
    const r = siteMetrics(makeSite([3, -1, -1, 3]), { start: 0, end: 4 }, 6)
    expect(r.longestDarkHours).toBe(12)
  })
  it('rounds percentages to 0.1', () => {
    const r = siteMetrics(makeSite([1, 1, -1]), { start: 0, end: 3 }, 1)
    expect(r.sunPct).toBe(66.7)
  })
  it('reports min/max altitudes within the window only', () => {
    const r = siteMetrics(makeSite([90, -5, 7, 2, -90], [10, -3, 4, 1, 50]), { start: 1, end: 4 }, 1)
    expect([r.sunMin, r.sunMax]).toEqual([-5, 7])
    expect([r.earthMin, r.earthMax]).toEqual([-3, 4])
  })
})

describe('verdicts', () => {
  it('returns all null for fewer than two sites', () => {
    expect(verdicts([{ id: 'a', m: m(50, 50) }])).toEqual({ a: null })
    expect(verdicts([])).toEqual({})
  })
  it('clear winners: energy, comms, balanced', () => {
    const v = verdicts([
      { id: 'sun', m: m(90, 10, 5) },
      { id: 'earth', m: m(10, 90, 50) },
      { id: 'mid', m: m(60, 60, 20) },
    ])
    expect(v).toEqual({ sun: 'energy', earth: 'comms', mid: 'balanced' })
  })
  it('energy tie on Sun % is broken by shorter darkness', () => {
    const v = verdicts([
      { id: 'a', m: m(80, 10, 40) },
      { id: 'b', m: m(80, 20, 10) },
      { id: 'c', m: m(10, 90, 99) },
    ])
    expect(v.b).toBe('energy')
    expect(v.a).not.toBe('energy')
    expect(v.c).toBe('comms')
  })
  it('energy tie on both Sun % and darkness shares the label', () => {
    const v = verdicts([
      { id: 'a', m: m(80, 10, 10) },
      { id: 'b', m: m(80, 20, 10) },
      { id: 'c', m: m(10, 90, 99) },
    ])
    expect(v.a).toBe('energy')
    expect(v.b).toBe('energy')
  })
  it('comms tie is shared', () => {
    const v = verdicts([
      { id: 'a', m: m(90, 50, 1) },
      { id: 'b', m: m(10, 70, 9) },
      { id: 'c', m: m(20, 70, 9) },
    ])
    expect(v).toEqual({ a: 'energy', b: 'comms', c: 'comms' })
  })
  it('one site winning both gets "both"', () => {
    const v = verdicts([
      { id: 'a', m: m(90, 90, 1) },
      { id: 'b', m: m(50, 40, 9) },
      { id: 'c', m: m(30, 60, 9) },
    ])
    expect(v.a).toBe('both')
    expect(v.b).toBe('balanced') // min 40 beats c's 30
    expect(v.c).toBeNull()
  })
  it('balanced goes only to unlabelled sites, highest min(Sun, Earth)', () => {
    const v = verdicts([
      { id: 'sun', m: m(95, 5, 1) },
      { id: 'earth', m: m(5, 95, 9) },
      { id: 'x', m: m(50, 45, 9) },
      { id: 'y', m: m(30, 80, 9) },
    ])
    expect(v.x).toBe('balanced')
    expect(v.y).toBeNull()
  })
  it('two sites: each gets a label, no balanced', () => {
    const v = verdicts([
      { id: 'a', m: m(70, 20, 5) },
      { id: 'b', m: m(30, 60, 5) },
    ])
    expect(v).toEqual({ a: 'energy', b: 'comms' })
  })
  it('two sites, one wins both: the other is balanced', () => {
    const v = verdicts([
      { id: 'a', m: m(70, 60, 5) },
      { id: 'b', m: m(30, 20, 5) },
    ])
    expect(v).toEqual({ a: 'both', b: 'balanced' })
  })
  it('identical sites all share "both"', () => {
    const v = verdicts([{ id: 'a', m: m(50, 50, 5) }, { id: 'b', m: m(50, 50, 5) }])
    expect(v).toEqual({ a: 'both', b: 'both' })
  })
})

describe('bestDarkHours', () => {
  it('ignores a cut-off "≥" night, which may really be longer', () => {
    // Live case, 30 days from 24 Dec 2026: Shackleton "≥ 17 h" must not beat a full 13.1-day night.
    expect(bestDarkHours([m(50, 50, 17, true), m(50, 50, 314), m(50, 50, 334)])).toBe(314)
  })
  it('picks the shortest full night', () => {
    expect(bestDarkHours([m(50, 50, 40), m(50, 50, 30)])).toBe(30)
  })
  it('has no best when every night is cut off', () => {
    expect(bestDarkHours([m(50, 50, 40, true), m(50, 50, 30, true)])).toBeNull()
  })
})

describe('energy tie-break with a cut-off night', () => {
  it('does not award energy to a tied site only because its night was cut off', () => {
    const v = verdicts([{ id: 'a', m: m(50, 10, 5, true) }, { id: 'b', m: m(50, 20, 100) }])
    expect(v.b === 'energy' || v.b === 'both').toBe(true)
    expect(v.a).not.toBe('energy')
  })
})

describe('fmtDuration', () => {
  it('shows hours below 48', () => {
    expect(fmtDuration(0)).toBe('0 h')
    expect(fmtDuration(1)).toBe('1 h')
    expect(fmtDuration(47)).toBe('47 h')
  })
  it('switches to days at exactly 48 h', () => {
    expect(fmtDuration(48)).toBe('2.0 days')
  })
  it('formats days to one decimal', () => {
    expect(fmtDuration(72)).toBe('3.0 days')
    expect(fmtDuration(100)).toBe('4.2 days')
    expect(fmtDuration(354)).toBe('14.8 days')
  })
})
