import { describe, expect, it } from 'vitest'
import { elevationRange, evenIndices, meanRadius, skyline, wrapAz } from './skyModel'

describe('skyline', () => {
  it('flat when no table is given', () => {
    const s = skyline(undefined, undefined)
    expect(s.flat).toBe(true)
    expect(s.x[0]).toBe(-180); expect(s.x[s.x.length - 1]).toBe(180)
    expect(Math.max(...s.y)).toBe(0)
  })
  it('maps table index i to azimuth i*step, wrapped to -180..180', () => {
    const h = Array.from({ length: 360 }, (_, i) => i)          // height = azimuth, step 1
    const s = skyline(h, 1)
    expect(s.flat).toBe(false)
    expect(s.y[s.x.indexOf(0)]).toBe(0)                         // az 0
    expect(s.y[s.x.indexOf(90)]).toBe(90)                       // az 90
    expect(s.y[s.x.indexOf(-90)]).toBe(270)                     // az 270 sits at x = -90
    expect(s.y[0]).toBe(180)                                    // x = -180 is az 180
    expect(s.y[s.y.length - 1]).toBe(180)                       // x = +180 is az 180 too
  })
  it('interpolates between table entries', () => {
    const s = skyline([0, 100, 200, 300], 100)                  // az 0,100,200,300 (step does not divide 360)
    expect(s.y[s.x.indexOf(90)]).toBeCloseTo(90, 9)             // between az 0 and 100
  })
  it('rejects NaN tables (falls back to flat)', () => {
    expect(skyline([0, NaN, 1], 120).flat).toBe(true)
  })
})

describe('elevationRange', () => {
  it('defaults to -5..10 for polar-like data', () => {
    expect(elevationRange([[-1, 2, 3.5], [0, 1]]).range).toEqual([-5, 10])
  })
  it('does not depend on far-away stats, only on what is passed', () => {
    expect(elevationRange([[0.5]]).widened).toBe(false)
  })
  it('widens to multiples of 5 when data or skyline exceed it', () => {
    expect(elevationRange([[0, 11.5]]).range).toEqual([-5, 15])
    expect(elevationRange([[-7, -8, 1]])).toMatchObject({ range: [-5, 10], below: 2 })
    expect(elevationRange([[1]], 12).range).toEqual([-5, 15])
  })
})

describe('misc', () => {
  it('wrapAz', () => { expect(wrapAz(181)).toBe(-179); expect(wrapAz(180)).toBe(180); expect(wrapAz(10)).toBe(10) })
  it('meanRadius uses the window slice or the fallback', () => {
    expect(meanRadius([1, 2, 3, 4], 1, 3, 9)).toBe(2.5)
    expect(meanRadius(undefined, 0, 2, 9)).toBe(9)
  })
  it('evenIndices includes both ends', () => {
    expect(evenIndices(100, 5)).toEqual([0, 25, 50, 74, 99])
    expect(evenIndices(3, 5)).toEqual([0, 1, 2])
  })
})
