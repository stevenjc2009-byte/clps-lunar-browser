/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SkyData } from '../types'
import { clearEngineCache, engineData, siteTimeline } from './engine'
import { bestDays, bestMask, cellValue, heatmapGrid, landingDays, type HeatMetric } from './heatmapData'
import { DEFAULT_PARAMS } from './params'
import { LEGACY, makeSite, makeSky, squareWave } from './testFixtures'
import { windowMetrics } from './windowMetrics'

const DAY = 24
const N = 120 * DAY + 1
// Sun up 200 h, down 150 h; Earth up 100 h, down 60 h. Landing range: day 10 to day 80.
const meta = { landing_min_utc: '2026-11-25T00:00:00Z', landing_max_utc: '2027-02-03T00:00:00Z' }
const a = makeSite('a', squareWave(N, 200, 150), squareWave(N, 100, 60))
const b = makeSite('b', squareWave(N, 300, 50, 1, 77), squareWave(N, 50, 30, 1, 5))
const sky = makeSky([a, b], {}, meta)
const ed = engineData(sky)

describe('landingDays', () => {
  it('starts on the first landing day, steps one day, never runs past the data', () => {
    const d = landingDays(sky, 30 * DAY)
    expect(d.isos[0]).toBe('2026-11-25')
    expect(d.startsH[0]).toBe(10 * DAY)
    expect(d.startsH[1] - d.startsH[0]).toBe(DAY)
    expect(d.isos.at(-1)).toBe('2027-02-03')
    const long = landingDays(sky, 60 * DAY)
    expect(long.startsH.at(-1)! + 60 * DAY).toBeLessThanOrEqual(N - 1)
    expect(long.isos.at(-1)).toBe('2027-01-14') // day 60: day 61 + 60 d would pass the last sample
  })
})

describe('cells agree with the comparison cards', () => {
  const metrics: HeatMetric[] = ['sun', 'link', 'dark']
  for (const metric of metrics) {
    it(`${metric}: every cell equals windowMetrics for that landing day`, () => {
      const g = heatmapGrid(ed, [a, b], LEGACY, metric, 30)
      expect(g.rows).toHaveLength(2)
      g.rows.forEach((row, r) => {
        const tl = siteTimeline(ed, [a, b][r], LEGACY)
        g.days.startsH.forEach((s, i) => {
          const m = windowMetrics(tl, s, 30 * DAY)
          const want = metric === 'sun' ? m.sunPct : metric === 'link' ? m.linkPct : m.longestDark.hours
          expect(row.values[i]).toBe(want)
          expect(row.censored[i] === 1).toBe(metric === 'dark' && m.longestDark.status === 'at_least')
        })
      })
    })
  }
  it('dark domain is whole days covering the longest night', () => {
    const g = heatmapGrid(ed, [a, b], LEGACY, 'dark', 30)
    const mx = Math.max(...g.rows.flatMap(r => [...r.values]))
    expect(g.domain[0]).toBe(0)
    expect(g.domain[1] % DAY).toBe(0)
    expect(g.domain[1]).toBeGreaterThanOrEqual(mx)
    expect(g.domain[1] - mx).toBeLessThan(DAY)
    expect(heatmapGrid(ed, [a], LEGACY, 'sun', 30).domain).toEqual([0, 100])
  })
})

describe('censored darkness', () => {
  // Dark for the last 30 days of data: that night runs off the end, so it is "at least".
  const sun = squareWave(N, 200, 150).map((v, i) => (i > N - 30 * DAY ? -1 : v))
  const c = makeSite('c', sun)
  const edC = engineData(makeSky([c], {}, meta))
  it('cells whose longest night touches the data end are censored', () => {
    const tl = siteTimeline(edC, c, LEGACY)
    const late = cellValue(tl, 'dark', N - 1 - 30 * DAY, 30 * DAY)
    expect(late.censored).toBe(true)
    const early = cellValue(tl, 'dark', 10 * DAY, 30 * DAY)
    expect(early.censored).toBe(false)
  })
})

describe('best 10%', () => {
  const v = (xs: number[]) => Float64Array.from(xs)
  const none = (n: number) => new Uint8Array(n)
  it('higher is better for Sun: marks the top tenth (ties included)', () => {
    const vals = v([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 95])
    expect([...bestMask(vals, none(11), 'sun')]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1])
  })
  it('lower is better for darkness, and censored cells are never best', () => {
    const vals = v([100, 50, 300, 400, 500, 600, 700, 800, 900, 1000])
    const cen = Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0])
    expect([...bestMask(vals, cen, 'dark')]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
  it('no highlight when the whole row is inside the verdict margin', () => {
    expect([...bestMask(v([60, 60.5, 61, 61.9]), none(4), 'sun')]).toEqual([0, 0, 0, 0])
    expect([...bestMask(v([100, 110, 123]), none(3), 'dark')]).toEqual([0, 0, 0])
  })
  it('bestDays picks one day per separate run, best run first', () => {
    const values = v([1, 9, 8, 1, 1, 7, 10, 1, 6])
    const best = Uint8Array.from([0, 1, 1, 0, 0, 1, 1, 0, 1])
    expect(bestDays({ values, best }, 'sun')).toEqual([6, 1, 8])
    expect(bestDays({ values, best }, 'sun', 2)).toEqual([6, 1])
    expect(bestDays({ values, best: none(9) }, 'sun')).toEqual([])
  })
})

const path = process.env.ENGINE_SKY_V2
const have = !!path && existsSync(path)

describe.skipIf(!have)('heatmap on sky.json v2', () => {
  if (!have) { it.skip('needs ENGINE_SKY_V2', () => {}); return }
  const real = JSON.parse(readFileSync(path!, 'utf8')) as SkyData
  const d = engineData(real)
  it('7 sites x every landing day, cells equal the cards; prints the time taken', () => {
    clearEngineCache()
    const t = performance.now()
    const g = heatmapGrid(d, real.sites, DEFAULT_PARAMS, 'sun', 30)
    const cold = performance.now() - t
    const t2 = performance.now()
    heatmapGrid(d, real.sites, DEFAULT_PARAMS, 'dark', 365)
    const warm = performance.now() - t2
    console.log(`heatmap: ${g.rows.length} sites x ${g.days.isos.length} days, cold ${cold.toFixed(0)} ms, warm (1 yr dark) ${warm.toFixed(0)} ms`)
    expect(g.rows).toHaveLength(real.sites.length)
    expect(g.days.isos[0]).toBe(real.meta.landing_min_utc!.slice(0, 10))
    for (let r = 0; r < g.rows.length; r++) {
      const tl = siteTimeline(d, real.sites[r], DEFAULT_PARAMS)
      for (let i = 0; i < g.days.startsH.length; i += 37) {
        expect(g.rows[r].values[i]).toBe(windowMetrics(tl, g.days.startsH[i], 30 * DAY).sunPct)
      }
    }
  })
})
