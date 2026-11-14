import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTimeline, engineData, type Timeline } from './engine'
import type { Intervals } from './intervals'
import { longestRun, survivalCheck, windowMetrics } from './windowMetrics'
import { LEGACY, makeSite, makeSky, squareWave } from './testFixtures'

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

// Timeline from hourly Sun/Earth altitudes, legacy model (crossings at half-hours for square waves).
function tl(sun: number[], earth?: number[]): Timeline {
  const site = makeSite('a', sun, earth)
  return buildTimeline(engineData(makeSky([site])), site, LEGACY)
}

describe('windowMetrics: percentages from interval time', () => {
  it('all up: 100% Sun, no darkness', () => {
    const m = windowMetrics(tl(Array(30).fill(5)), 0, 24)
    expect(m.sunPct).toBe(100)
    expect(m.darkCount).toBe(0)
    expect(m.longestDark).toEqual({ hours: 0, status: 'exact', insideHours: 0, startedBefore: false })
  })
  it('all down: 0% Sun and the night runs to both data edges, so it is "at least"', () => {
    const m = windowMetrics(tl(Array(30).fill(-5), Array(30).fill(-5)), 2, 24)
    expect(m.sunPct).toBe(0)
    expect(m.earthPct).toBe(0)
    expect(m.longestDark.status).toBe('at_least')
    expect(m.longestDark.hours).toBe(29)
    expect(m.longestDark.insideHours).toBe(24)
  })
  it('10 h up / 14 h down: Sun % is the refined visible time over the window', () => {
    // visible [0,9.5) [23.5,33.5) [47.5,57.5) ...; window [24,48) has 9.5 + 0.5 = 10 h
    const m = windowMetrics(tl(squareWave(96, 10, 14)), 24, 24)
    expect(m.sunPct).toBe(41.7)
  })
  it('a percentage is not rounded to whole samples (a crossing at 9.5 h counts 9.5 h)', () => {
    expect(windowMetrics(tl(squareWave(96, 10, 14)), 0, 24).sunPct).toBe(41.7) // 9.5 + 0.5 = 10 of 24
    expect(windowMetrics(tl(squareWave(96, 10, 14)), 0, 12).sunPct).toBe(79.2) // 9.5 of 12
  })
  it('a night crossing the window end is followed to its real end (exact)', () => {
    // dark [9.5, 23.5): window [0, 12) cuts it at 12 but its full length 14 h counts
    const m = windowMetrics(tl(squareWave(96, 10, 14)), 0, 12)
    expect(m.longestDark.hours).toBeCloseTo(14, 9)
    expect(m.longestDark.status).toBe('exact')
    expect(m.longestDark.insideHours).toBeCloseTo(2.5, 9)
    expect(m.longestDark.startedBefore).toBe(false)
    expect(m.darkCount).toBe(1)
  })
  it('a night already going at landing counts in full and is flagged (audit B4)', () => {
    const m = windowMetrics(tl(squareWave(96, 10, 14)), 20, 10) // landing inside the night [9.5, 23.5)
    expect(m.darkAtLanding).toBe(true)
    expect(m.longestDark.hours).toBeCloseTo(14, 9)
    expect(m.longestDark.startedBefore).toBe(true)
    expect(m.longestDark.insideHours).toBeCloseTo(3.5, 9)
    expect(m.darkCount).toBe(1)
    expect(windowMetrics(tl(squareWave(96, 10, 14)), 0, 10).darkAtLanding).toBe(false)
  })
  it('a night touching the end of the data is "at least"', () => {
    const sun = [...Array(20).fill(5), ...Array(10).fill(-5)]
    const m = windowMetrics(tl(sun), 0, 24)
    expect(m.longestDark.status).toBe('at_least')
    expect(m.longestDark.hours).toBeCloseTo(29 - 19.5, 9)
  })
  it('sunPct + dark share = 100 for any window', () => {
    const sun = Array.from({ length: 400 }, (_, i) => Math.sin(i / 13) + 0.3 * Math.sin(i / 3.1))
    const t = tl(sun)
    for (let s = 0; s < 300; s += 17) {
      const m = windowMetrics(t, s, 72)
      let dark = 0
      for (const [a, b] of t.dark) dark += Math.max(0, Math.min(b, s + 72) - Math.max(a, s))
      expect(m.sunPct + Math.round(1000 * dark / 72) / 10).toBeCloseTo(100, 0)
    }
  })
  it('windows are clamped into the data', () => {
    const t = tl(Array(30).fill(5))
    expect(windowMetrics(t, -10, 24).sunPct).toBe(100)
    expect(windowMetrics(t, 100, 24).sunPct).toBe(100)
  })
  it('bothPct needs Sun and comms at the same time', () => {
    const m = windowMetrics(tl(squareWave(96, 12, 12), squareWave(96, 12, 12, 1, 6)), 0, 48)
    // Sun up [0,11.5)+[23.5,35.5)+[47.5..); Earth shifted 6 h earlier -> overlap 6 h per 24 h
    expect(m.bothPct).toBeCloseTo(25, 0)
    expect(m.linkPct).toBe(m.earthPct)
  })
  it('longest comms gap uses the same rules', () => {
    const m = windowMetrics(tl(Array(48).fill(5), squareWave(48, 6, 18)), 0, 24)
    expect(m.longestCommsGap.hours).toBeCloseTo(18, 9)
    expect(m.longestCommsGap.status).toBe('exact')
  })
})

describe('longestRun: censoring rules', () => {
  const runs: Intervals = [[0, 5], [10, 30], [40, 41], [50, 60]]
  it('a run at the data start is "at least"', () => {
    expect(longestRun(runs, 0, 8, 60)).toMatchObject({ hours: 5, status: 'at_least' })
  })
  it('longer exact run wins over a shorter censored one', () => {
    expect(longestRun(runs, 2, 15, 60)).toMatchObject({ hours: 20, status: 'exact', startedBefore: false })
  })
  it('on equal length the censored run wins (it may be longer still)', () => {
    expect(longestRun([[0, 10], [20, 30]], 0, 25, 40).status).toBe('at_least')
    expect(longestRun([[5, 15], [20, 30]], 0, 25, 40).status).toBe('exact')
  })
  it('a run touching the data end is "at least"', () => {
    expect(longestRun(runs, 45, 55, 60)).toMatchObject({ hours: 10, status: 'at_least' })
  })
  it('no run in the window: 0 h exact', () => {
    expect(longestRun(runs, 31, 39, 60)).toEqual({ hours: 0, status: 'exact', insideHours: 0, startedBefore: false })
  })
})

describe('survivalCheck (illustrative)', () => {
  it('margin = battery / load - night', () => {
    const s = survivalCheck({ hours: 100, status: 'exact', insideHours: 100, startedBefore: false }, 2000, 10)
    expect(s).toEqual({ enduranceHours: 200, marginHours: 100, survives: true })
  })
  it('runs out when the night is longer', () => {
    expect(survivalCheck({ hours: 300, status: 'exact', insideHours: 0, startedBefore: false }, 2000, 10).survives).toBe(false)
  })
  it('an "at least" night: can say it fails, cannot promise it survives', () => {
    expect(survivalCheck({ hours: 300, status: 'at_least', insideHours: 0, startedBefore: false }, 2000, 10).survives).toBe(false)
    expect(survivalCheck({ hours: 100, status: 'at_least', insideHours: 0, startedBefore: false }, 2000, 10).survives).toBeNull()
  })
})
