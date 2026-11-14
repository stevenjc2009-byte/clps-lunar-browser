// Numbers for one window [start, start + len) (hours from the first sample), cut from a
// site's timeline. Percentages come from interval time, not sample counts.

import type { Timeline } from './engine'
import { clip, coveredIn, indexAt, overlapping, total, type Intervals } from './intervals'

export const SYNODIC_MONTH_H = 29.530589 * 24

export type Censor = 'exact' | 'at_least'

export interface Run {
  hours: number          // full length of the longest run overlapping the window
  status: Censor         // 'at_least' only when that run touches the start or end of the data
  insideHours: number    // longest run counted only inside the window (clipped)
  startedBefore: boolean // that longest run was already going when the window starts (landing)
}

export interface WindowMetrics {
  sunPct: number
  earthPct: number
  linkPct: number          // = earthPct when commsKind is 'earth'
  bothPct: number          // Sun visible AND comms available
  commsKind: 'link' | 'earth'
  dsnMissing: boolean
  terrain: boolean
  darkCount: number        // distinct dark intervals overlapping the window
  darkAtLanding: boolean   // the window (landing) starts inside a night
  longestDark: Run
  longestCommsGap: Run
}

const round1 = (x: number) => Math.round(x * 10) / 10

// Longest run (full length, followed outside the window up to the data edges) among the
// runs overlapping the window. insideHours is the longest run measured only inside the
// window — usually the same run, clipped, but reported separately so the two numbers are
// never confused.
export function longestRun(runs: Intervals, lo: number, hi: number, dataEnd: number): Run {
  const over = overlapping(runs, lo, hi)
  let best: Run = { hours: 0, status: 'exact', insideHours: 0, startedBefore: false }
  for (const [a, b] of over) {
    const len = b - a
    const censored = a <= 0 || b >= dataEnd
    // Longer wins; on equal length a censored run wins (it might be longer still).
    if (len > best.hours || (len === best.hours && censored && best.status === 'exact')) {
      best = { hours: len, status: censored ? 'at_least' : 'exact', insideHours: 0, startedBefore: a < lo }
    }
  }
  best.insideHours = over.reduce((m, iv) => Math.max(m, total(clip([iv], lo, hi))), 0)
  return best
}

// Clamp a window into the data. Returns [lo, hi).
export function clampWindow(tl: Timeline, startH: number, lenH: number): [number, number] {
  const len = Math.min(Math.max(0, lenH), tl.end)
  const lo = Math.min(Math.max(0, startH), tl.end - len)
  return [lo, lo + len]
}

export function windowMetrics(tl: Timeline, startH: number, lenH: number): WindowMetrics {
  const [lo, hi] = clampWindow(tl, startH, lenH)
  const L = hi - lo
  const pct = (c: Parameters<typeof coveredIn>[0]) => (L > 0 ? round1((100 * coveredIn(c, lo, hi)) / L) : 0)
  return {
    sunPct: pct(tl.sunCum),
    earthPct: pct(tl.earthCum),
    linkPct: pct(tl.linkCum),
    bothPct: pct(tl.bothCum),
    commsKind: tl.commsKind,
    dsnMissing: tl.dsnMissing,
    terrain: tl.terrain,
    darkCount: overlapping(tl.dark, lo, hi).length,
    darkAtLanding: indexAt(tl.dark, lo) >= 0,
    longestDark: longestRun(tl.dark, lo, hi, tl.end),
    longestCommsGap: longestRun(tl.commsGap, lo, hi, tl.end),
  }
}

export interface Survival {
  enduranceHours: number          // battery Wh / night load W
  marginHours: number             // endurance - longest night (negative = runs out)
  survives: boolean | null        // null = cannot say: night is only a lower bound and the battery outlasts it
}

// Illustrative only: constant load, no heaters' extra draw, no battery ageing or cold losses.
export function survivalCheck(dark: Run, batteryWh: number, nightLoadW: number): Survival {
  const enduranceHours = nightLoadW > 0 ? batteryWh / nightLoadW : Infinity
  const marginHours = enduranceHours - dark.hours
  const survives = marginHours < 0 ? false : dark.status === 'exact' ? true : null
  return { enduranceHours, marginHours, survives }
}
