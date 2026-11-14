// Intent of the pre-engine tests (metrics/landing/events.test.ts) that is not already covered
// by the other engine tests. Each block names the old test it replaces.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTimeline, engineData } from './engine'
import { nextChange } from './events'
import { sunPctByDay } from './landingSeries'
import { LEGACY, makeSite, makeSky } from './testFixtures'
import { verdict } from './verdict'
import { spanOf, windowFor } from './window'
import { windowMetrics } from './windowMetrics'

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

const timeline = (sun: number[], earth?: number[], stepHours = 1) => {
  const site = makeSite('a', sun, earth)
  return buildTimeline(engineData(makeSky([site], {}, { step_hours: stepHours })), site, LEGACY)
}

describe('altitude exactly 0 is not visible (old: "alt exactly 0 counts as not visible", "counts exactly 0° as not up")', () => {
  it('a body sitting exactly on the horizon is never counted as up', () => {
    const tl = timeline(Array(24).fill(0), Array(24).fill(0))
    const m = windowMetrics(tl, 0, 23)
    expect(m.sunPct).toBe(0)
    expect(m.earthPct).toBe(0)
    expect(sunPctByDay(tl, 23, 0, 0).sunPct).toEqual([0])
  })
  it('a rise from exactly 0 is placed at the 0 sample (old: "a rise from exactly 0° ...")', () => {
    const tl = timeline([-1, -1, 0, 2, 2])
    const n = nextChange(tl.sun, 0.5, tl.end)
    expect(n.up).toBe(false)
    expect(n.atH).toBeCloseTo(2, 6)
  })
})

describe('step_hours (old: "respects step_hours", "multiplies longest run by stepHours")', () => {
  it('windows are in hours, sample spans in steps', () => {
    const sky = makeSky([makeSite('a', Array(40).fill(1))], {}, { step_hours: 6 }) // 10 days at 6 h
    const w = windowFor(sky, '2026-11-17', 2)
    expect(w).toEqual({ startH: 48, lenH: 48, clamped: null })
    expect(spanOf(sky, w)).toEqual({ start: 8, end: 17 })
  })
  it('night length scales with the step', () => {
    const sun = [3, 3, -1, -1, 3, 3]
    const h1 = windowMetrics(timeline(sun, undefined, 1), 0, 5).longestDark.hours
    const h6 = windowMetrics(timeline(sun, undefined, 6), 0, 30).longestDark.hours
    expect(h1).toBeGreaterThan(1)
    expect(h6).toBeCloseTo(6 * h1, 9)
  })
})

describe('verdict (old: "one site winning both gets both")', () => {
  it('one site can hold several badges', () => {
    const D = 24
    const row = (id: string, sun: number, comms: number, dark: number) =>
      ({ id, name: id, sunPct: sun, commsPct: comms, dark: { hours: dark, status: 'exact' as const }, terrain: true })
    const v = verdict([row('a', 80, 90, 2 * D), row('b', 40, 30, 12 * D), row('c', 50, 50, 10 * D)])
    expect(v.badges.a).toEqual(['energy', 'comms', 'night', 'balanced'])
    expect(v.cardState.b).toBe('none')
  })
})
