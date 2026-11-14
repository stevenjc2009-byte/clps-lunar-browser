import { describe, expect, it } from 'vitest'
import { makeMask, type HorizonsFile } from './horizon'
import { margins, positiveIntervals } from './visibility'

describe('positiveIntervals', () => {
  it('places crossings by a straight line between samples', () => {
    // +1 at t=0, -1 at t=1 -> set at 0.5; -1 at t=2, +3 at t=3 -> rise at 2.25
    expect(positiveIntervals([1, -1, -1, 3], 0, 1)).toEqual([[0, 0.5], [2.25, 3]])
  })
  it('uses t0 and dt', () => {
    expect(positiveIntervals([-1, 1], 10, 0.5)).toEqual([[10.25, 10.5]])
  })
  it('exactly 0 counts as not visible; a rise from 0 starts at the 0 sample', () => {
    expect(positiveIntervals([0, 0, 1, 1], 0, 1)).toEqual([[1, 3]])
    expect(positiveIntervals([1, 0, 1], 0, 1)).toEqual([[0, 2]]) // an instant at 0 does not split a day
  })
  it('all up gives one interval over the whole range; all down gives none', () => {
    expect(positiveIntervals([2, 2, 2], 0, 1)).toEqual([[0, 2]])
    expect(positiveIntervals([-2, -2], 0, 1)).toEqual([])
    expect(positiveIntervals([], 0, 1)).toEqual([])
  })
})

describe('margins: disc rules', () => {
  const flat = makeMask(null, 'x', 0, 0)
  const alt = Float64Array.from([0.1, -0.1, -0.3, -1])
  const az = new Float64Array(4)
  it('centre: altitude minus skyline', () => {
    expect(Array.from(margins(alt, az, 0.27, 'centre', flat))).toEqual(Array.from(alt))
  })
  it('top (upper limb / any part): adds the radius', () => {
    const m = margins(alt, az, 0.27, 'top', flat)
    expect(m[1]).toBeCloseTo(0.17, 12) // centre below, upper limb above -> visible
    expect(m[2]).toBeCloseTo(-0.03, 12)
  })
  it('bottom (whole disc): subtracts the radius', () => {
    expect(margins(alt, az, 0.27, 'bottom', flat)[0]).toBeCloseTo(-0.17, 12)
  })
  it('reads a per-sample radius array', () => {
    expect(margins(Float64Array.from([0]), new Float64Array(1), Float64Array.from([0.5]), 'top', flat)[0]).toBe(0.5)
  })
  it('limb rules see a terrain peak across the disc width; centre rule does not', () => {
    const t = Array.from({ length: 360 }, (_, i) => (i === 11 ? 3 : 0))
    const hz: HorizonsFile = { meta: {}, sites: { s: { az_step_deg: 1, heights: { '2': t } } } }
    const m = makeMask(hz, 's', 2, 0)
    const a1 = Float64Array.from([1]), z = Float64Array.from([10.2])
    expect(margins(a1, z, 0.95, 'centre', m)[0]).toBeCloseTo(1 - 0.6, 12) // skyline at 10.2 = 0.6
    expect(margins(a1, z, 0.95, 'top', m)[0]).toBeCloseTo(1 + 0.95 - 3, 12) // peak at 11 inside [9.25, 11.15]
  })
})
