import { describe, expect, it } from 'vitest'
import { moonTrekUrl, quickMapUrl, southPolarXY } from './siteLinks'

describe('siteLinks', () => {
  it('matches the projected point checked in QuickMap (peak near Shackleton)', () => {
    const { x, y } = southPolarXY(-89.00506, 125.3093)
    expect(x).toBeCloseTo(24620.59, 1)
    expect(y).toBeCloseTo(-17438.35, 1)
    expect(quickMapUrl(-89.00506, 125.3093)).toBe('https://quickmap.lroc.im-ldi.com/?proj=27&prjExtent=19621%2C-22438%2C29621%2C-12438')
  })
  it('the pole maps to the origin', () => {
    const { x, y } = southPolarXY(-90, 40)
    expect(Math.abs(x) + Math.abs(y)).toBeLessThan(1e-6)
  })
  it('the Moon Trek hash uses x=lon, y=lat and wraps 0..360 to -180..180', () => {
    expect(moonTrekUrl(-88.51566, -61.16732)).toContain('#v=0.1&x=-61.16732&y=-88.51566&z=7')
    expect(moonTrekUrl(-84.7906, 29.1957)).toContain('x=29.19570&y=-84.79060')
    expect(moonTrekUrl(-89, 300)).toContain('x=-60.00000&')
  })
  it('falls back to the home pages for bad input or the northern hemisphere', () => {
    expect(quickMapUrl(NaN, 0)).toBe('https://quickmap.lroc.im-ldi.com/')
    expect(quickMapUrl(10, 0)).toBe('https://quickmap.lroc.im-ldi.com/')
    expect(moonTrekUrl(NaN, 0)).toBe('https://trek.nasa.gov/moon/')
  })
})
