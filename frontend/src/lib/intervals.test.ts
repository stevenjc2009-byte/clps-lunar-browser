import { describe, expect, it } from 'vitest'
import {
  clip, complement, coveredBefore, coveredIn, cumulative, indexAt, intersect, merge, overlapping, total, union,
  type Interval, type Intervals,
} from './intervals'

// Small deterministic random generator so property tests are repeatable.
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}
function randomIntervals(r: () => number, n: number, span = 100): Interval[] {
  return Array.from({ length: n }, () => { const a = r() * span; return [a, a + r() * 15] as const })
}
// Brute-force membership on a fine grid, to check the fast operations against.
const inside = (ivs: Intervals, t: number) => ivs.some(([a, b]) => t >= a && t < b)
const isNormal = (ivs: Intervals) => ivs.every(([a, b], k) => b > a && (k === 0 || a > ivs[k - 1][1]))

describe('merge', () => {
  it('sorts, merges overlapping and touching pieces, drops empty ones', () => {
    expect(merge([[5, 6], [1, 3], [2, 4], [4, 4.5], [7, 7]])).toEqual([[1, 4.5], [5, 6]])
  })
  it('property: result is normal and covers exactly the same points', () => {
    const r = rng(1)
    for (let trial = 0; trial < 200; trial++) {
      const raw = randomIntervals(r, 1 + Math.floor(r() * 12))
      const m = merge(raw)
      expect(isNormal(m)).toBe(true)
      for (let t = 0; t < 120; t += 0.37) expect(inside(m, t)).toBe(inside(raw, t))
    }
  })
})

describe('clip / complement / total', () => {
  it('clips to a window', () => {
    expect(clip([[0, 2], [3, 6], [8, 9]], 1, 5)).toEqual([[1, 2], [3, 5]])
  })
  it('complement inside a window', () => {
    expect(complement([[1, 2], [3, 6]], 0, 5)).toEqual([[0, 1], [2, 3]])
    expect(complement([], 0, 5)).toEqual([[0, 5]])
    expect(complement([[0, 5]], 0, 5)).toEqual([])
  })
  it('property: visible + hidden = window length, and they never overlap', () => {
    const r = rng(2)
    for (let trial = 0; trial < 300; trial++) {
      const v = merge(randomIntervals(r, Math.floor(r() * 10)))
      const lo = r() * 50, hi = lo + r() * 80
      const shown = clip(v, lo, hi), hidden = complement(v, lo, hi)
      expect(total(shown) + total(hidden)).toBeCloseTo(hi - lo, 9)
      expect(total(intersect(shown, hidden))).toBe(0)
    }
  })
})

describe('intersect / union', () => {
  it('intersects two lists', () => {
    expect(intersect([[0, 5], [6, 10]], [[4, 7], [9, 12]])).toEqual([[4, 5], [6, 7], [9, 10]])
  })
  it('property: |A| + |B| = |A or B| + |A and B|, membership matches brute force', () => {
    const r = rng(3)
    for (let trial = 0; trial < 200; trial++) {
      const A = merge(randomIntervals(r, Math.floor(r() * 8))), B = merge(randomIntervals(r, Math.floor(r() * 8)))
      const I = intersect(A, B), U = union(A, B)
      expect(total(A) + total(B)).toBeCloseTo(total(U) + total(I), 9)
      expect(isNormal(I)).toBe(true)
      for (let t = 0; t < 120; t += 0.53) expect(inside(I, t)).toBe(inside(A, t) && inside(B, t))
    }
  })
})

describe('overlapping / indexAt', () => {
  const ivs: Intervals = [[0, 2], [3, 6], [8, 9]]
  it('returns whole pieces that overlap a window', () => {
    expect(overlapping(ivs, 1, 3.5)).toEqual([[0, 2], [3, 6]])
    expect(overlapping(ivs, 2, 3)).toEqual([]) // touching at the edges is not overlapping
  })
  it('finds the piece containing a time (start inclusive, end exclusive)', () => {
    expect(indexAt(ivs, 0)).toBe(0)
    expect(indexAt(ivs, 2)).toBe(-1)
    expect(indexAt(ivs, 5.9)).toBe(1)
    expect(indexAt(ivs, 8.5)).toBe(2)
    expect(indexAt(ivs, 10)).toBe(-1)
  })
})

describe('cumulative', () => {
  it('covered time in any window matches clip + total', () => {
    const r = rng(4)
    for (let trial = 0; trial < 100; trial++) {
      const v = merge(randomIntervals(r, Math.floor(r() * 15)))
      const c = cumulative(v)
      const a = r() * 100, b = a + r() * 40
      expect(coveredIn(c, a, b)).toBeCloseTo(total(clip(v, a, b)), 9)
    }
  })
  it('covered before the first piece is 0', () => {
    expect(coveredBefore(cumulative([[5, 6]]), 4)).toBe(0)
    expect(coveredIn(cumulative([[5, 6]]), 3, 2)).toBe(0)
  })
})
