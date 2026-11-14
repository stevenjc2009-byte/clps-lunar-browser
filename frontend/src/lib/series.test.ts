// Landing-date series, after-landing events, date windows and formatting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTimeline, engineData } from './engine'
import { nextChange } from './events'
import { fmtDuration, fmtWait, listAnd } from './format'
import { sunPctByDay } from './landingSeries'
import { LEGACY, makeSite, makeSky, squareWave } from './testFixtures'
import { landingRangeH, spanOf, windowFor } from './window'
import { windowMetrics } from './windowMetrics'

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('sunPctByDay', () => {
  const sun = Array.from({ length: 240 }, (_, i) => Math.sin(i / 17) + Math.sin(i / 5) * 0.4)
  const site = makeSite('a', sun)
  const tl = buildTimeline(engineData(makeSky([site])), site, LEGACY)
  it('equals the cards\' Sun % for every landing day (same engine)', () => {
    const got = sunPctByDay(tl, 72, 0, 239)
    expect(got.sunPct.length).toBe(7) // starts 0..144 fit a 72 h window ending by hour 239
    got.startsH.forEach((s, d) => {
      expect(s).toBe(d * 24)
      expect(got.sunPct[d]).toBe(windowMetrics(tl, s, 72).sunPct)
    })
  })
  it('leaves out days whose window would run past the data', () => {
    expect(sunPctByDay(tl, 300, 0, 239).sunPct).toEqual([])
  })
})

describe('nextChange (from intervals)', () => {
  const ivs: [number, number][] = [[0, 9.5], [23.5, 33.5]]
  it('up at landing: next set is the end of the current interval', () => {
    expect(nextChange(ivs, 2, 48)).toEqual({ up: true, atH: 9.5 })
  })
  it('down at landing: next rise is the start of the next interval', () => {
    expect(nextChange(ivs, 12, 48)).toEqual({ up: false, atH: 23.5 })
  })
  it('null when nothing changes before the data ends', () => {
    expect(nextChange(ivs, 40, 48)).toEqual({ up: false, atH: null })
    expect(nextChange([[0, 48]], 3, 48)).toEqual({ up: true, atH: null })
  })
  it('the landing moment exactly at a rise counts as up', () => {
    expect(nextChange(ivs, 23.5, 48)).toEqual({ up: true, atH: 33.5 })
  })
  it('is refined between samples (minutes, not whole hours)', () => {
    const site = makeSite('a', [2, 1, -1, -2, -2, -3, 3])
    const tl = buildTimeline(engineData(makeSky([site])), site, LEGACY)
    const n = nextChange(tl.sun, 0, tl.end)
    expect(n.up).toBe(true)
    expect(n.atH).toBeCloseTo(1.5, 1) // centre crosses 0 between hours 1 and 2
  })
})

describe('windowFor (audit B3: never clamps silently)', () => {
  const sky = makeSky([makeSite('a', Array(240).fill(1))]) // 10 days from 15 Nov 2026
  it('picks the window starting at the requested date', () => {
    expect(windowFor(sky, '2026-11-18', 2)).toEqual({ startH: 72, lenH: 48, clamped: null })
  })
  it('flags a date before the range, after it, or unreadable', () => {
    expect(windowFor(sky, '2020-01-01', 2)).toEqual({ startH: 0, lenH: 48, clamped: 'before_range' })
    expect(windowFor(sky, '2030-01-01', 2)).toEqual({ startH: 239 - 48, lenH: 48, clamped: 'after_range' })
    expect(windowFor(sky, 'not-a-date', 2)).toEqual({ startH: 0, lenH: 48, clamped: 'invalid' })
  })
  it('uses the supported landing range from sky.json v2 meta', () => {
    const v2 = makeSky([makeSite('a', Array(240).fill(1))], {}, { landing_min_utc: '2026-11-17T00:00:00Z', landing_max_utc: '2026-11-19T00:00:00Z' })
    expect(landingRangeH(v2, 24)).toEqual({ minH: 48, maxH: 96 })
    expect(windowFor(v2, '2026-11-16', 1).clamped).toBe('before_range')
    expect(windowFor(v2, '2026-11-20', 1)).toMatchObject({ startH: 96, clamped: 'after_range' })
  })
  it('spanOf covers the window in whole samples', () => {
    expect(spanOf(sky, { startH: 72, lenH: 48 })).toEqual({ start: 72, end: 121 })
  })
})

describe('format', () => {
  it('fmtDuration: whole hours below 48 h, days to 0.1 above (audit B5)', () => {
    expect(fmtDuration(0)).toBe('0 h')
    expect(fmtDuration(17.3)).toBe('17 h')
    expect(fmtDuration(47)).toBe('47 h')
    expect(fmtDuration(48)).toBe('2.0 days')
    expect(fmtDuration(100)).toBe('4.2 days')
    expect(fmtDuration(354)).toBe('14.8 days')
  })
  it('fmtWait: whole hours under two days, days above', () => {
    expect(fmtWait(27.6)).toBe('28 h')
    expect(fmtWait(48)).toBe('2.0 days')
  })
  it('listAnd joins names', () => {
    expect(listAnd(['a'])).toBe('a')
    expect(listAnd(['a', 'b', 'c'])).toBe('a, b and c')
  })
})
