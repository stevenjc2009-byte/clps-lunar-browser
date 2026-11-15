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
  it('north of 60 S the Moon Trek hash uses x=lon, y=lat and wraps 0..360 to -180..180', () => {
    expect(moonTrekUrl(-45.5, -61.16732)).toContain('#v=0.1&x=-61.16732&y=-45.50000&z=7')
    expect(moonTrekUrl(-45.5, 300)).toContain('x=-60.00000&')
    expect(moonTrekUrl(-45.5, 0)).toContain('EPSG%3A%3A104903')
  })
  it('south of 60 S the Moon Trek hash uses polar stereographic metres (checked on Shackleton crater)', () => {
    const u = moonTrekUrl(-89.67, 129.2)
    const m = u.match(/#v=0\.1&x=(-?[\d.]+)&y=(-?[\d.]+)&/)
    expect(Math.abs(Number(m?.[1]) - 7754)).toBeLessThan(5)
    expect(Math.abs(Number(m?.[2]) + 6325)).toBeLessThan(5)
    expect(u).toContain('&z=10&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120')
    expect(moonTrekUrl(-89.7849, -156.03)).toContain('x=-2649.8&y=-5960.0&')
  })
  it('falls back to the home pages for bad input or the northern hemisphere', () => {
    expect(quickMapUrl(NaN, 0)).toBe('https://quickmap.lroc.im-ldi.com/')
    expect(quickMapUrl(10, 0)).toBe('https://quickmap.lroc.im-ldi.com/')
    expect(moonTrekUrl(NaN, 0)).toBe('https://trek.nasa.gov/moon/')
  })
})
