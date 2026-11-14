import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTimeline, engineData, FALLBACK_SUN_RADIUS_DEG, siteTimeline } from './engine'
import { dipDeg, type HorizonsFile } from './horizon'
import { total } from './intervals'
import { DEFAULT_PARAMS, type Params } from './params'
import { LEGACY, makeSite, makeSky, squareWave } from './testFixtures'


afterEach(() => vi.restoreAllMocks())
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('timeline (legacy model)', () => {
  it('square wave: crossings land half way between the hourly samples', () => {
    quiet()
    const site = makeSite('a', squareWave(72, 10, 14))
    const tl = buildTimeline(engineData(makeSky([site])), site, LEGACY)
    expect(tl.sun.length).toBe(3)
    expect(tl.sun[0][0]).toBe(0)
    expect(tl.sun[0][1]).toBeCloseTo(9.5, 9)
    expect(tl.sun[1][0]).toBeCloseTo(23.5, 9)
    expect(tl.sun[1][1]).toBeCloseTo(33.5, 9)
    expect(tl.end).toBe(71)
    // dark is exactly the rest of the data
    expect(total(tl.sun) + total(tl.dark)).toBeCloseTo(71, 9)
  })
  it('with DSN off, link is Earth and commsKind is earth', () => {
    quiet()
    const site = makeSite('a', squareWave(48, 10, 14), squareWave(48, 5, 5))
    const tl = buildTimeline(engineData(makeSky([site])), site, LEGACY)
    expect(tl.link).toEqual(tl.earth)
    expect(tl.commsKind).toBe('earth')
    expect(tl.dsnMissing).toBe(false)
    expect(tl.terrain).toBe(false)
  })
})

describe('timeline: v1 fallbacks and v2 arrays', () => {
  it('v1 file: warns and uses constant radii; upper limb sees a Sun whose centre is just below', () => {
    const warn = quiet()
    const site = makeSite('a', Array(10).fill(-0.2))
    const d = engineData(makeSky([site]))
    expect(warn).toHaveBeenCalled()
    expect(d.radiiFromData).toBe(false)
    const p = { ...DEFAULT_PARAMS, observerHeightM: 0 }
    expect(total(buildTimeline(d, site, p).sun)).toBe(9) // -0.2 + 0.2666 > 0
    expect(total(buildTimeline(d, site, { ...p, sunRule: 'centre' }).sun)).toBe(0)
    expect(FALLBACK_SUN_RADIUS_DEG).toBe(0.2666)
  })
  it('v2 file: uses the radius arrays (a small Sun is not seen)', () => {
    const warn = quiet()
    const site = makeSite('a', Array(10).fill(-0.2))
    const d = engineData(makeSky([site], { sunR: 0.1, earthR: 0.9 }))
    expect(warn).not.toHaveBeenCalled()
    expect(total(buildTimeline(d, site, { ...DEFAULT_PARAMS, observerHeightM: 0 }).sun)).toBe(0)
  })
  it('observer height lowers the flat skyline by the dip', () => {
    quiet()
    const site = makeSite('a', Array(10).fill(-0.05))
    const d = engineData(makeSky([site], { sunR: 0, earthR: 0 }))
    expect(dipDeg(2)).toBeGreaterThan(0.05)
    expect(total(buildTimeline(d, site, { ...LEGACY, observerHeightM: 2 }).sun)).toBe(9)
    expect(total(buildTimeline(d, site, { ...LEGACY, observerHeightM: 0 }).sun)).toBe(0)
  })
  it('mask offset raises the skyline', () => {
    quiet()
    const site = makeSite('a', Array(10).fill(4))
    const d = engineData(makeSky([site]))
    expect(total(buildTimeline(d, site, { ...LEGACY, maskOffsetDeg: 3 }).sun)).toBe(9)
    expect(total(buildTimeline(d, site, { ...LEGACY, maskOffsetDeg: 5 }).sun)).toBe(0)
  })
  it('DSN on: link = Earth visible AND best DSN elevation >= min', () => {
    // Earth always up; DSN elevation 0 for hours 0-4, 20 for 5-9 -> crosses 10 deg half way 4..5
    const site = makeSite('a', Array(10).fill(5), Array(10).fill(5))
    const dsn = [0, 0, 0, 0, 0, 20, 20, 20, 20, 20]
    const d = engineData(makeSky([site], { sunR: 0.27, earthR: 0.95, dsn }))
    const tl = buildTimeline(d, site, DEFAULT_PARAMS)
    expect(tl.commsKind).toBe('link')
    expect(tl.link).toHaveLength(1)
    expect(tl.link[0][0]).toBeCloseTo(4.5, 9)
    expect(total(tl.earth)).toBe(9)
    const lower = buildTimeline(d, site, { ...DEFAULT_PARAMS, dsnMinElDeg: 15 })
    expect(lower.link[0][0]).toBeCloseTo(4.75, 9)
  })
  it('DSN on but no DSN data: link falls back to Earth and says so', () => {
    quiet()
    const site = makeSite('a', Array(10).fill(5), squareWave(10, 3, 2))
    const tl = buildTimeline(engineData(makeSky([site])), site, DEFAULT_PARAMS)
    expect(tl.link).toEqual(tl.earth)
    expect(tl.commsKind).toBe('earth')
    expect(tl.dsnMissing).toBe(true)
  })
  it('terrain skyline is used and flagged when horizons.json has the site', () => {
    quiet()
    const site = makeSite('a', Array(10).fill(1)) // Sun 1 deg up, azimuth 0
    const hz: HorizonsFile = { meta: { generated_utc: 'x' }, sites: { a: { az_step_deg: 90, heights: { '2': [2, 0, 0, 0] } } } }
    const tl = buildTimeline(engineData(makeSky([site]), hz), site, DEFAULT_PARAMS)
    expect(tl.terrain).toBe(true)
    expect(total(tl.sun)).toBe(0) // 1 + 0.2666 < 2: hidden behind the ridge
  })
})

describe('earth rules', () => {
  it('any part >= centre >= whole disc', () => {
    quiet()
    const e = Array.from({ length: 200 }, (_, i) => 2 * Math.sin(i / 9))
    const site = makeSite('a', Array(200).fill(5), e)
    const d = engineData(makeSky([site], { sunR: 0.27, earthR: 0.95 }))
    const t = (earthRule: Params['earthRule']) => total(buildTimeline(d, site, { ...LEGACY, earthRule }).earth)
    expect(t('any_part')).toBeGreaterThan(t('centre'))
    expect(t('centre')).toBeGreaterThan(t('whole_disc'))
  })
})

describe('memo', () => {
  it('returns the same timeline for the same (data, site, params) and a new one otherwise', () => {
    quiet()
    const site = makeSite('a', squareWave(48, 10, 14))
    const d = engineData(makeSky([site]))
    const a = siteTimeline(d, site, DEFAULT_PARAMS)
    expect(siteTimeline(d, site, { ...DEFAULT_PARAMS })).toBe(a)
    expect(siteTimeline(d, site, { ...DEFAULT_PARAMS, maskOffsetDeg: 3 })).not.toBe(a)
    // a custom site moved to new coordinates is a different site even with the same id
    expect(siteTimeline(d, { ...site, lat: -88 }, DEFAULT_PARAMS)).not.toBe(a)
    // a new data version is a different result
    const d2 = engineData(makeSky([site], {}, { generated_utc: 'later' }))
    expect(siteTimeline(d2, site, DEFAULT_PARAMS)).not.toBe(a)
  })
})
