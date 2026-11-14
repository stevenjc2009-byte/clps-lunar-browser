// Pure computations shared by the Web Worker and the main-thread fallback, so both paths
// give identical numbers. No DOM, no worker API here.

import { buildTimeline, siteTimeline, type EngineData, type Timeline } from '../lib/engine'
import { paramsKey, type Params } from '../lib/params'
import { verdict, type RuleOutcome } from '../lib/verdict'
import { windowMetrics, type Censor } from '../lib/windowMetrics'
import type { Site } from '../types'

export interface Win { startH: number; lenH: number }

// Timelines for the given sites with one set of params (memoised inside the engine).
export function timelinesFor(ed: EngineData, sites: Site[], p: Params): Timeline[] {
  return sites.map(s => siteTimeline(ed, s, p))
}

// ---- Sensitivity ("How sure are these numbers?") ----------------------------------------

export type SensGroup = 'mask' | 'height' | 'earth' | 'dsn'

export interface Variant {
  group: SensGroup
  value: number | string   // the value tried for that one parameter
  params: Params
  current: boolean          // equals the params in use on the page
}

const MASKS = [0, 3, 5, 10]
const HEIGHTS = [0, 2, 5]
const EARTH = ['centre', 'any_part', 'whole_disc'] as const
const DSN_EL = [5, 10, 15]

// One parameter changed at a time; the others stay at the current values. When the DSN
// link is switched off, the DSN elevation cannot change anything, so it is not tried.
export function variants(p: Params): Variant[] {
  const out: Variant[] = []
  const add = (group: SensGroup, value: number | string, q: Params) =>
    out.push({ group, value, params: q, current: paramsKey(q) === paramsKey(p) })
  for (const m of MASKS) add('mask', m, { ...p, maskOffsetDeg: m })
  for (const h of HEIGHTS) add('height', h, { ...p, observerHeightM: h })
  for (const e of EARTH) add('earth', e, { ...p, earthRule: e })
  if (p.dsnOn) for (const d of DSN_EL) add('dsn', d, { ...p, dsnMinElDeg: d })
  return out
}

export interface SensCell {
  sunPct: number
  linkPct: number
  commsKind: 'link' | 'earth'
  darkHours: number
  darkStatus: Censor
}

// Who wins "best for energy" / "best for communication" under one variant. A rule that is
// too close to call reads as "comparable", so a flip from a winner to a near-tie counts.
export interface Picks { energy: string; comms: string }

const pickOf = (o: RuleOutcome) => (o.state === 'winner' ? `winner:${o.winner}` : o.state)

export interface SensRow { variant: Variant; cells: SensCell[]; picks: Picks }

// Timelines built for the table, kept apart from the engine's LRU so the table cannot
// evict the timelines the cards are using.
const LRU_MAX = 160
const cache = new Map<string, Timeline>()

function variantTimeline(ed: EngineData, site: Site, p: Params): Timeline {
  const key = `${ed.version}|${site.id}|${site.lat},${site.lon}|${site.sun_alt.length}|${paramsKey(p)}`
  const hit = cache.get(key)
  if (hit) return hit
  const tl = buildTimeline(ed, site, p)
  cache.set(key, tl)
  if (cache.size > LRU_MAX) cache.delete(cache.keys().next().value as string)
  return tl
}

export function sensRow(ed: EngineData, sites: Site[], v: Variant, win: Win): SensRow {
  const metrics = sites.map(s => windowMetrics(variantTimeline(ed, s, v.params), win.startH, win.lenH))
  const vd = verdict(sites.map((s, i) => ({
    id: s.id, name: s.name, sunPct: metrics[i].sunPct, commsPct: metrics[i].linkPct,
    dark: { hours: metrics[i].longestDark.hours, status: metrics[i].longestDark.status }, terrain: metrics[i].terrain,
  })), metrics[0]?.commsKind ?? 'earth')
  return {
    variant: v,
    cells: metrics.map(m => ({
      sunPct: m.sunPct, linkPct: m.linkPct, commsKind: m.commsKind,
      darkHours: m.longestDark.hours, darkStatus: m.longestDark.status,
    })),
    picks: { energy: pickOf(vd.outcomes.energy), comms: pickOf(vd.outcomes.comms) },
  }
}

const tick = () => new Promise<void>(r => setTimeout(r, 0))

// Works through the variants one at a time, yielding between them so the page (or the
// worker's message queue) stays responsive. `cancelled()` lets a newer request replace
// this one; `onRow` gets each row as soon as it is ready (progressive results).
export async function runSensitivity(
  ed: EngineData, sites: Site[], p: Params, win: Win,
  onRow: (row: SensRow, done: number, total: number) => void,
  cancelled: () => boolean,
): Promise<boolean> {
  const vs = variants(p)
  for (let i = 0; i < vs.length; i++) {
    await tick()
    if (cancelled()) return false
    onRow(sensRow(ed, sites, vs[i], win), i + 1, vs.length)
  }
  return true
}
