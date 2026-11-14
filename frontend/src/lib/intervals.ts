// Time intervals on one axis (hours from the first data sample).
// An Intervals value is always sorted, with no overlaps and no zero-length pieces.
// Each piece is half-open in meaning, [start, end): touching pieces are merged.

export type Interval = readonly [number, number]
export type Intervals = Interval[]

// Sort, drop empty pieces and merge overlapping or touching ones.
export function merge(ivs: readonly Interval[]): Intervals {
  const s = ivs.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0] || x[1] - y[1])
  const out: [number, number][] = []
  for (const [a, b] of s) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

// The parts of `ivs` inside [lo, hi).
export function clip(ivs: Intervals, lo: number, hi: number): Intervals {
  const out: Intervals = []
  for (const [a, b] of ivs) {
    if (b <= lo) continue
    if (a >= hi) break
    const s = Math.max(a, lo), e = Math.min(b, hi)
    if (e > s) out.push([s, e])
  }
  return out
}

// Everything in [lo, hi) that is NOT in `ivs`.
export function complement(ivs: Intervals, lo: number, hi: number): Intervals {
  const out: Intervals = []
  let t = lo
  for (const [a, b] of clip(ivs, lo, hi)) {
    if (a > t) out.push([t, a])
    t = b
  }
  if (hi > t) out.push([t, hi])
  return out
}

// Times in both A and B.
export function intersect(A: Intervals, B: Intervals): Intervals {
  const out: Intervals = []
  let i = 0, j = 0
  while (i < A.length && j < B.length) {
    const s = Math.max(A[i][0], B[j][0]), e = Math.min(A[i][1], B[j][1])
    if (e > s) out.push([s, e])
    if (A[i][1] < B[j][1]) i++
    else j++
  }
  return out
}

export function union(A: Intervals, B: Intervals): Intervals {
  return merge([...A, ...B])
}

export function total(ivs: Intervals): number {
  let t = 0
  for (const [a, b] of ivs) t += b - a
  return t
}

// Pieces that overlap [lo, hi) by a positive amount, returned whole (not clipped).
export function overlapping(ivs: Intervals, lo: number, hi: number): Intervals {
  const out: Intervals = []
  for (const iv of ivs) {
    if (iv[1] <= lo) continue
    if (iv[0] >= hi) break
    out.push(iv)
  }
  return out
}

// Index of the piece containing t (start <= t < end), or -1.
export function indexAt(ivs: Intervals, t: number): number {
  let lo = 0, hi = ivs.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ivs[mid][1] <= t) lo = mid + 1
    else if (ivs[mid][0] > t) hi = mid - 1
    else return mid
  }
  return -1
}

// Running total so the covered time inside any [a, b) costs two binary searches.
// prefix[k] = total length of pieces 0..k-1.
export interface Cumulative { ivs: Intervals; prefix: Float64Array }

export function cumulative(ivs: Intervals): Cumulative {
  const prefix = new Float64Array(ivs.length + 1)
  ivs.forEach(([a, b], k) => { prefix[k + 1] = prefix[k] + (b - a) })
  return { ivs, prefix }
}

// Covered time in [0... t): pieces fully before t plus the part of the one containing t.
export function coveredBefore(c: Cumulative, t: number): number {
  const { ivs, prefix } = c
  let lo = 0, hi = ivs.length // first piece with start >= t
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (ivs[mid][0] < t) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return 0
  const [a, b] = ivs[lo - 1]
  return prefix[lo - 1] + Math.min(b, t) - a
}

export function coveredIn(c: Cumulative, a: number, b: number): number {
  return b > a ? coveredBefore(c, b) - coveredBefore(c, a) : 0
}
