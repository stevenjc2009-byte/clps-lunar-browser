import { describe, expect, it } from 'vitest'
import { fmtWait, nextChange } from './events'

describe('nextChange', () => {
  it('finds the next sunset and interpolates between hours', () => {
    // 1° then -1°: crosses 0 half-way between samples 1 and 2
    expect(nextChange([2, 1, -1, -2], 0)).toEqual({ up: true, at: 1.5 })
  })
  it('finds the next rise when down at landing', () => {
    expect(nextChange([-3, -1, 3], 0)).toEqual({ up: false, at: 1.25 })
  })
  it('starts searching at the landing index, not the array start', () => {
    expect(nextChange([5, -1, -1, 1], 1)).toEqual({ up: false, at: 2.5 })
  })
  it('a rise from exactly 0° is placed at the 0° sample', () => {
    expect(nextChange([-1, 0, 2], 1)).toEqual({ up: false, at: 1 })
  })
  it('returns null when nothing changes before the data ends', () => {
    expect(nextChange([1, 2, 3], 0)).toEqual({ up: true, at: null })
  })
})

describe('fmtWait', () => {
  it('shows hours under two days and days above', () => {
    expect(fmtWait(27.6)).toBe('28 h')
    expect(fmtWait(48)).toBe('2.0 days')
  })
})
