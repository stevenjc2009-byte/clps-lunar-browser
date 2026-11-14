import { describe, expect, it } from 'vitest'
import { cellColor, colorAt, legendTicks, scaleT, VIRIDIS } from './heatmapColor'

const hex = (h: string) => `rgb(${[1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)).join(',')})`

describe('heatmap colours', () => {
  it('ends of the scale are the viridis ends; out of range is clamped', () => {
    expect(colorAt(0)).toBe(hex(VIRIDIS[0]))
    expect(colorAt(1)).toBe(hex(VIRIDIS[8]))
    expect(colorAt(-3)).toBe(colorAt(0))
    expect(colorAt(7)).toBe(colorAt(1))
    expect(colorAt(NaN)).toBe(colorAt(0))
    expect(colorAt(0.5)).toBe(hex(VIRIDIS[4]))
  })
  it('bright = better: more Sun is brighter, a longer night is darker', () => {
    expect(cellColor(100, 'sun', [0, 100])).toBe(hex(VIRIDIS[8]))
    expect(cellColor(0, 'link', [0, 100])).toBe(hex(VIRIDIS[0]))
    expect(scaleT(0, 'dark', [0, 240])).toBe(1)
    expect(scaleT(240, 'dark', [0, 240])).toBe(0)
  })
  it('legend ticks are in % or days, across the whole bar', () => {
    expect(legendTicks('sun', [0, 100]).map(t => t.label)).toEqual(['0%', '25%', '50%', '75%', '100%'])
    const d = legendTicks('dark', [0, 15 * 24])
    expect(d[0]).toEqual({ t: 1, label: '0 d' })
    expect(d.map(t => t.label)).toEqual(['0 d', '2 d', '4 d', '6 d', '8 d', '10 d', '12 d', '15 d'])
    expect(d.at(-1)).toEqual({ t: 0, label: '15 d' })
    expect(legendTicks('dark', [0, 120]).map(t => t.label)).toEqual(['0 d', '1 d', '2 d', '3 d', '4 d', '5 d'])
  })
})
