import { describe, expect, it } from 'vitest'
import { computeSite, MAX_ABS_LAT_DEG, parseVectors, vectorsMismatch, type VectorHeader } from './ephem'

const header: VectorHeader = {
  start_utc: '2026-11-15T00:00:00Z', step_hours: 1, count: 2, layout: 'sunX,sunY,sunZ,earthX,earthY,earthZ',
  units: 'km', frame: 'test', moon_radius_km: 1737.4, source: 'test',
}
// Two identical hours: Sun far along +x (lon 0, equator plane), Earth along -z (toward the south pole).
const v = parseVectors(header, new Float32Array([1.5e8, 0, 0, 0, 0, -3.8e5, 1.5e8, 0, 0, 0, 0, -3.8e5]).buffer)

describe('computeSite (custom location)', () => {
  it('Earth straight "down" the south axis is overhead at the south pole region', () => {
    const s = computeSite(v, -89, 0)
    expect(s.earth_alt[0]).toBeGreaterThan(88)
    expect(s.sun_alt[0]).toBeCloseTo(1, 1) // Sun on the equator plane is ~1 deg up at -89
    expect(s.sun_az[0]).toBeCloseTo(0, 0) // toward lon 0 = north from there
  })
  it('refuses latitudes beyond ±89.99 deg, where azimuth is undefined (audit B10)', () => {
    expect(() => computeSite(v, -90, 0)).toThrow(/89\.99/)
    expect(() => computeSite(v, 90, 0)).toThrow(/89\.99/)
    expect(() => computeSite(v, NaN, 0)).toThrow()
    expect(() => computeSite(v, -MAX_ABS_LAT_DEG, 0)).not.toThrow()
  })
})

describe('vectorsMismatch (time axis guard)', () => {
  const meta = { start_utc: '2026-11-15T00:00:00Z', step_hours: 1, samples: 2 }
  it('null when start, step and count agree (any ISO spelling of the start)', () => {
    expect(vectorsMismatch(header, meta)).toBeNull()
    expect(vectorsMismatch(header, { ...meta, start_utc: '2026-11-15T00:00:00.000Z' })).toBeNull()
  })
  it('names the difference otherwise', () => {
    expect(vectorsMismatch(header, { ...meta, start_utc: '2026-09-01T00:00:00Z' })).toMatch(/start/)
    expect(vectorsMismatch(header, { ...meta, samples: 3 })).toMatch(/hold 2 hours/)
    expect(vectorsMismatch(header, { ...meta, step_hours: 2 })).toMatch(/step/)
  })
})
