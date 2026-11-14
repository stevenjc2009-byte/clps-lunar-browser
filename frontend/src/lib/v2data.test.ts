/// <reference types="node" />
// The engine on a real sky.json v2 (7 sites, radius and DSN arrays). Runs only when
// ENGINE_SKY_V2 names such a file, e.g. data-v2's frontend/public/sky.json; it is not
// committed here. ENGINE_V2_PRINT, if set, receives a numbers table.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SkyData } from '../types'
import { engineData, siteTimeline } from './engine'
import { sunPctByDay } from './landingSeries'
import { DEFAULT_PARAMS } from './params'
import { LEGACY } from './testFixtures'
import { verdict } from './verdict'
import { defaultLandingDay, landingRangeH, windowFor } from './window'
import { windowMetrics } from './windowMetrics'

const path = process.env.ENGINE_SKY_V2
const have = !!path && existsSync(path)

describe.skipIf(!have)('engine on sky.json v2', () => {
  if (!have) { it.skip('needs ENGINE_SKY_V2', () => {}); return } // skipIf still runs this body
  const sky = JSON.parse(readFileSync(path!, 'utf8')) as SkyData
  const t = performance.now()
  const d = engineData(sky)
  const tls = sky.sites.map(s => siteTimeline(d, s, DEFAULT_PARAMS))
  const buildMs = performance.now() - t

  it('reads the v2 arrays: per-hour radii and DSN, no fallback', () => {
    expect(sky.meta.version).toBe(2)
    expect(d.radiiFromData).toBe(true)
    expect(d.dsnLoaded).toBe(true)
    expect(tls.every(tl => tl.commsKind === 'link' && !tl.dsnMissing)).toBe(true)
  })
  it('no hardcoded sites: every site in the file gets a timeline, flat without horizons.json', () => {
    expect(tls).toHaveLength(sky.sites.length)
    expect(tls.every(tl => !tl.terrain)).toBe(true)
  })
  it('landing range from meta; default day is landing_min_utc', () => {
    expect(defaultLandingDay(sky)).toBe(sky.meta.landing_min_utc!.slice(0, 10))
    expect(windowFor(sky, '2026-09-10', 30).clamped).toBe('before_range')
    const { minH } = landingRangeH(sky, 0)
    expect(minH).toBeGreaterThan(29.5 * 24) // data starts > 1 synodic month before the first landing
  })
  it('metrics are consistent for every site and both look-aheads', () => {
    for (const days of [30, 365]) {
      const w = windowFor(sky, defaultLandingDay(sky), days)
      sky.sites.forEach((_s, i) => {
        const m = windowMetrics(tls[i], w.startH, w.lenH)
        for (const p of [m.sunPct, m.earthPct, m.linkPct, m.bothPct]) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(100) }
        expect(m.linkPct).toBeLessThanOrEqual(m.earthPct)
        expect(m.bothPct).toBeLessThanOrEqual(Math.min(m.sunPct, m.linkPct))
        expect(sunPctByDay(tls[i], w.lenH, w.startH, w.startH).sunPct[0]).toBe(m.sunPct)
      })
      const v = verdict(sky.sites.map((s, i) => {
        const m = windowMetrics(tls[i], w.startH, w.lenH)
        return { id: s.id, name: s.name, sunPct: m.sunPct, commsPct: m.linkPct, dark: m.longestDark, terrain: m.terrain }
      }))
      expect(v.provisional).toBe(true)
      expect(Object.keys(v.cardState)).toHaveLength(sky.sites.length)
    }
  })
  it('prints the numbers table (always passes)', () => {
    const rows = [`build ${sky.sites.length} timelines: ${buildMs.toFixed(0)} ms`]
    for (const days of [30, 365]) {
      const w = windowFor(sky, defaultLandingDay(sky), days)
      for (const [label, p] of [['default', DEFAULT_PARAMS], ['legacy', LEGACY]] as const) {
        const ms = sky.sites.map(s => windowMetrics(siteTimeline(d, s, p), w.startH, w.lenH))
        sky.sites.forEach((s, i) => rows.push(`${days}d ${label} ${s.id}: sun ${ms[i].sunPct} earth ${ms[i].earthPct} link ${ms[i].linkPct} dark ${ms[i].longestDark.hours.toFixed(1)} h ${ms[i].longestDark.status}${ms[i].longestDark.startedBefore ? ' started-before' : ''}`))
        const v = verdict(sky.sites.map((s, i) => ({ id: s.id, name: s.name, sunPct: ms[i].sunPct, commsPct: ms[i].linkPct, dark: ms[i].longestDark, terrain: ms[i].terrain })), ms[0].commsKind)
        rows.push(`${days}d ${label} verdict: ${Object.values(v.outcomes).map(o => `${o.rule}=${o.state}${o.winner ? ':' + o.winner : ''}${o.group.length ? '[' + o.group.join(',') + ']' : ''}`).join(' ')}`)
      }
    }
    if (process.env.ENGINE_V2_PRINT) writeFileSync(process.env.ENGINE_V2_PRINT, rows.join('\n'))
    expect(rows.length).toBeGreaterThan(1)
  })
})
