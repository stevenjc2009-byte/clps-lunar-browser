import { describe, expect, it } from 'vitest'
import { dipDeg, makeMask, maskAt, maskOverDisc, type HorizonsFile } from './horizon'

// Skyline with one sharp peak at az 90 (2 deg high), 0 elsewhere, 1 deg steps.
function horizons(): HorizonsFile {
  const h0 = Array.from({ length: 360 }, (_, i) => (i === 90 ? 2 : 0))
  const h2 = h0.map(v => v - 0.1)
  const h5 = h0.map(v => v - 0.4)
  h0[359] = 1 // something near the wrap point
  return { meta: {}, sites: { s: { az_step_deg: 1, heights: { '0': h0, '2': h2, '5': h5 } } } }
}

describe('dipDeg', () => {
  it('is 0 at ground level and about 0.087 deg at 2 m on a 1737.4 km Moon', () => {
    expect(dipDeg(0)).toBe(0)
    // acos(R/(R+h)) ~ sqrt(2h/R) rad
    expect(dipDeg(2)).toBeCloseTo((Math.sqrt(4 / 1737400) * 180) / Math.PI, 5)
    expect(dipDeg(2)).toBeCloseTo(0.0869, 3)
  })
})

describe('makeMask', () => {
  it('uses terrain when the site is in horizons.json', () => {
    const m = makeMask(horizons(), 's', 2, 0)
    expect(m.terrain).toBe(true)
    expect(maskAt(m, 90)).toBeCloseTo(1.9, 12)
  })
  it('falls back to a flat skyline lowered by the dip, plus the offset', () => {
    for (const hz of [null, undefined, horizons()]) {
      const m = makeMask(hz, 'missing', 2, 3)
      expect(m.terrain).toBe(false)
      expect(maskAt(m, 123)).toBeCloseTo(3 - dipDeg(2), 12)
    }
  })
  it('adds the offset to a terrain skyline', () => {
    expect(maskAt(makeMask(horizons(), 's', 0, 5), 10)).toBe(5)
  })
  it('interpolates between the given observer heights', () => {
    const m = makeMask(horizons(), 's', 3.5, 0) // half way between 2 m (1.9) and 5 m (1.6)
    expect(maskAt(m, 90)).toBeCloseTo(1.75, 12)
  })
  it('refuses a table that does not cover a full turn', () => {
    const bad: HorizonsFile = { meta: {}, sites: { s: { az_step_deg: 1, heights: { '2': [0, 1, 2] } } } }
    expect(makeMask(bad, 's', 2, 0).terrain).toBe(false)
  })
})

describe('maskAt', () => {
  const m = makeMask(horizons(), 's', 0, 0)
  it('interpolates linearly between table points', () => {
    expect(maskAt(m, 89.5)).toBeCloseTo(1, 12)
    expect(maskAt(m, 90.25)).toBeCloseTo(1.5, 12)
  })
  it('wraps around at 0/360 and for negative or large azimuths', () => {
    expect(maskAt(m, 359.5)).toBeCloseTo(0.5, 12) // between 359 (1) and 0 (0)
    expect(maskAt(m, -0.5)).toBeCloseTo(0.5, 12)
    expect(maskAt(m, 360 + 90)).toBeCloseTo(2, 12)
  })
})

describe('maskOverDisc', () => {
  const m = makeMask(horizons(), 's', 0, 0)
  it('finds a peak inside the disc that centre and edges both miss', () => {
    // disc centred at 90.5 with radius 0.4: edges at 90.1 and 90.9, peak at 90.0 just outside...
    expect(maskOverDisc(m, 90.5, 0.6)).toBe(2) // ...and with radius 0.6 the peak at 90 is inside
    expect(maskAt(m, 90.5)).toBeCloseTo(1, 12)
  })
  it('is the max of the three points when no table point lies inside', () => {
    expect(maskOverDisc(m, 90.5, 0.2)).toBeCloseTo(Math.max(maskAt(m, 90.3), maskAt(m, 90.5), maskAt(m, 90.7)), 12)
  })
  it('wraps across north', () => {
    expect(maskOverDisc(m, 0.3, 0.95)).toBeCloseTo(0.65, 12) // left edge 359.35, between 359 (1) and 0 (0)
    expect(maskOverDisc(m, 0.3, 1.4)).toBe(1) // now reaches the 359 table point
  })
  it('flat mask is the same everywhere', () => {
    const f = makeMask(null, 's', 0, 0)
    expect(maskOverDisc(f, 42, 0.95)).toBe(0)
  })
})
