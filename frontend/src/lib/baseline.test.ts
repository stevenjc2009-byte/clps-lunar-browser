// Before/after check against the pre-engine app (audit baseline, tests/fixtures/baseline.json
// on branch audit, copied to __fixtures__/baseline-v1.json). Runs only while
// public/sky.json is the same v1 file the baseline was made from.
//
// With the LEGACY params (flat 0 deg, centre of disc, no observer height, no DSN) the engine
// must reproduce the old numbers to within what 1-hour sample counting could resolve:
// percentages within 0.3 points, night lengths within 2 h (the old method had up to ±1 h
// per boundary: audit section 5).

import { readFileSync, writeFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkyData } from '../types'
import baseline from './__fixtures__/baseline-v1.json'
import { engineData, siteTimeline } from './engine'
import { DEFAULT_PARAMS } from './params'
import { LEGACY } from './testFixtures'
import { windowFor } from './window'
import { windowMetrics } from './windowMetrics'

const sky = JSON.parse(readFileSync(new URL('../../public/sky.json', import.meta.url), 'utf8')) as SkyData
const sameData = sky.meta.start_utc === baseline.sky_json_meta.start_utc && sky.meta.samples === baseline.sky_json_meta.samples
  && sky.meta.ephemeris === baseline.sky_json_meta.ephemeris

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe.skipIf(!sameData)('engine vs pre-engine baseline (sky.json v1)', () => {
  const d = engineData(sky)
  for (const [key, cfg] of Object.entries(baseline.configs)) {
    const [date, daysS] = key.split('+')
    const days = parseInt(daysS, 10)
    it(`${key}: legacy params reproduce the old Sun %, Earth % and nights`, () => {
      const w = windowFor(sky, date, days)
      expect(w.startH).toBe(cfg.window.startIndex)
      for (const [id, old] of Object.entries(cfg.sites)) {
        const site = sky.sites.find(s => s.id === id)!
        const m = windowMetrics(siteTimeline(d, site, LEGACY), w.startH, w.lenH)
        expect(Math.abs(m.sunPct - old.sunPct), `${id} sun`).toBeLessThanOrEqual(0.3)
        expect(Math.abs(m.earthPct - old.earthPct), `${id} earth`).toBeLessThanOrEqual(0.3)
        // The old app counted a night already going at landing only from landing; the engine
        // counts it in full (spec 6.1), so compare only when the night started after landing.
        if (!m.longestDark.startedBefore && m.longestDark.status === 'exact' && !old.darkCut) {
          expect(Math.abs(m.longestDark.hours - old.longestDarkHours), `${id} dark`).toBeLessThanOrEqual(2)
        }
      }
    })
  }
  it('prints default-params numbers for the decisions file (always passes)', () => {
    const rows: string[] = []
    for (const key of Object.keys(baseline.configs)) {
      const [date, daysS] = key.split('+')
      const w = windowFor(sky, date, parseInt(daysS, 10))
      for (const site of sky.sites) {
        for (const [label, p] of [['legacy', LEGACY], ['default', DEFAULT_PARAMS]] as const) {
          const m = windowMetrics(siteTimeline(d, site, p), w.startH, w.lenH)
          rows.push(`${key} ${site.id} ${label}: sun ${m.sunPct} earth ${m.earthPct} link ${m.linkPct} dark ${m.longestDark.hours.toFixed(2)} h ${m.longestDark.status}${m.longestDark.startedBefore ? ' (started before landing)' : ''} inside ${m.longestDark.insideHours.toFixed(2)} nights ${m.darkCount}`)
        }
      }
    }
    if (process.env.ENGINE_BASELINE_PRINT) writeFileSync(process.env.ENGINE_BASELINE_PRINT, rows.join('\n'))
    expect(rows.length).toBeGreaterThan(0)
  })
})
