import { describe, expect, it } from 'vitest'
import { buildTimeline, engineData } from '../lib/engine'
import { DEFAULT_PARAMS, paramsKey, type Params } from '../lib/params'
import { makeSite, makeSky } from '../lib/testFixtures'
import { verdict } from '../lib/verdict'
import { windowMetrics } from '../lib/windowMetrics'
import { EngineClient } from './client'
import { runSensitivity, sensRow, timelinesFor, variants, type SensRow } from './compute'
import { handleMessage, newWorkerState, type FromWorker } from './protocol'

const N = 3000
// Sun skimming the horizon once a month (amplitude in degrees), Earth always fairly high.
const wave = (amp: number, phase = 0) => Array.from({ length: N }, (_, i) => amp * Math.sin((2 * Math.PI * (i + phase)) / 708))
const A = makeSite('a', wave(1.5), wave(4, 100).map(x => x + 3))
const B = makeSite('b', wave(1.2, 40), wave(2, 300).map(x => x + 1))
const sky = makeSky([A, B], { sunR: 0.27, earthR: 0.95, dsn: Array.from({ length: N }, (_, i) => 30 * Math.sin(i / 3.8)) })
const ed = engineData(sky)
const WIN = { startH: 500, lenH: 720 }

describe('sensitivity variants', () => {
  it('tries mask 0/3/5/10, height 0/2/5, three Earth rules and DSN 5/10/15', () => {
    const vs = variants(DEFAULT_PARAMS)
    expect(vs.map(v => `${v.group}:${v.value}`)).toEqual([
      'mask:0', 'mask:3', 'mask:5', 'mask:10', 'height:0', 'height:2', 'height:5',
      'earth:centre', 'earth:any_part', 'earth:whole_disc', 'dsn:5', 'dsn:10', 'dsn:15'])
  })

  it('changes one setting at a time and marks exactly one "now" row per group', () => {
    const p: Params = { ...DEFAULT_PARAMS, maskOffsetDeg: 5, observerHeightM: 0, earthRule: 'any_part', dsnMinElDeg: 15 }
    const vs = variants(p)
    for (const g of ['mask', 'height', 'earth', 'dsn']) {
      expect(vs.filter(v => v.group === g && v.current)).toHaveLength(1)
    }
    const field = { mask: 'maskOffsetDeg', height: 'observerHeightM', earth: 'earthRule', dsn: 'dsnMinElDeg' } as const
    for (const v of vs) {
      const k = field[v.group]
      expect({ ...v.params, [k]: p[k] }).toEqual(p)        // nothing else changed
      expect(v.params[k]).toBe(v.value)
      expect(v.current).toBe(paramsKey(v.params) === paramsKey(p))
    }
  })

  it('skips the DSN angle when the DSN switch is off', () => {
    const vs = variants({ ...DEFAULT_PARAMS, dsnOn: false })
    expect(vs.some(v => v.group === 'dsn')).toBe(false)
    expect(vs).toHaveLength(10)
  })
})

describe('sensitivity rows', () => {
  it('match the engine computed directly', () => {
    for (const v of variants(DEFAULT_PARAMS)) {
      const row = sensRow(ed, [A, B], v, WIN)
      const ms = [A, B].map(s => windowMetrics(buildTimeline(ed, s, v.params), WIN.startH, WIN.lenH))
      row.cells.forEach((c, i) => {
        expect(c.sunPct).toBe(ms[i].sunPct)
        expect(c.linkPct).toBe(ms[i].linkPct)
        expect(c.darkHours).toBe(ms[i].longestDark.hours)
        expect(c.darkStatus).toBe(ms[i].longestDark.status)
      })
      const vd = verdict([A, B].map((s, i) => ({ id: s.id, name: s.name, sunPct: ms[i].sunPct, commsPct: ms[i].linkPct,
        dark: { hours: ms[i].longestDark.hours, status: ms[i].longestDark.status }, terrain: ms[i].terrain })), ms[0].commsKind)
      const want = vd.outcomes.energy.state === 'winner' ? `winner:${vd.outcomes.energy.winner}` : vd.outcomes.energy.state
      expect(row.picks.energy).toBe(want)
    }
  })

  it('a higher safety margin never gives more Sun, and 3° removes this skimming Sun entirely', () => {
    const sun = variants(DEFAULT_PARAMS).filter(v => v.group === 'mask').map(v => sensRow(ed, [A], v, WIN).cells[0].sunPct)
    for (let i = 1; i < sun.length; i++) expect(sun[i]).toBeLessThanOrEqual(sun[i - 1])
    expect(sun[0]).toBeGreaterThan(30)
    expect(sun[1]).toBe(0)
  })

  it('runs progressively and stops when cancelled', async () => {
    const got: SensRow[] = []
    const done = await runSensitivity(ed, [A, B], DEFAULT_PARAMS, WIN, r => got.push(r), () => got.length >= 2)
    expect(done).toBe(false)
    expect(got).toHaveLength(2)
    const all: number[] = []
    expect(await runSensitivity(ed, [A], DEFAULT_PARAMS, WIN, (_r, d, t) => all.push(d / t), () => false)).toBe(true)
    expect(all).toHaveLength(13)
    expect(all[12]).toBe(1)
  })
})

describe('worker message handler', () => {
  const run = () => {
    const out: FromWorker[] = []
    const st = newWorkerState()
    return { st, out, send: (m: Parameters<typeof handleMessage>[1]) => handleMessage(st, m, x => out.push(x)) }
  }

  it('refuses work before init, then answers with the same timelines as the main thread', () => {
    const w = run()
    w.send({ type: 'timelines', id: 1, params: DEFAULT_PARAMS, siteIds: ['a'], custom: null })
    expect(w.out[0]).toMatchObject({ type: 'error', id: 1 })
    w.send({ type: 'init', sky, horizons: null })
    w.send({ type: 'timelines', id: 2, params: DEFAULT_PARAMS, siteIds: ['b', 'a'], custom: null })
    const m = w.out[1]
    expect(m.type).toBe('timelines')
    if (m.type === 'timelines') expect(m.timelines).toEqual(timelinesFor(ed, [B, A], DEFAULT_PARAMS))
  })

  it('takes a custom site whole and reports an unknown id as an error', () => {
    const w = run()
    w.send({ type: 'init', sky, horizons: null })
    const custom = { ...A, id: 'custom', lat: -88 }
    w.send({ type: 'timelines', id: 3, params: DEFAULT_PARAMS, siteIds: ['custom'], custom })
    expect(w.out[0].type).toBe('timelines')
    w.send({ type: 'timelines', id: 4, params: DEFAULT_PARAMS, siteIds: ['nope'], custom: null })
    expect(w.out[1]).toMatchObject({ type: 'error', id: 4 })
  })

  it('a newer table request replaces an older one', async () => {
    const w = run()
    w.send({ type: 'init', sky, horizons: null })
    w.send({ type: 'sens', id: 5, params: DEFAULT_PARAMS, win: WIN, siteIds: ['a'], custom: null })
    w.send({ type: 'sens', id: 6, params: DEFAULT_PARAMS, win: WIN, siteIds: ['a', 'b'], custom: null })
    await new Promise(r => setTimeout(r, 300))
    expect(w.out.some(m => m.id === 5)).toBe(false)
    expect(w.out.filter(m => m.type === 'sens-row' && m.id === 6)).toHaveLength(13)
    expect(w.out.at(-1)).toEqual({ type: 'sens-done', id: 6 })
  })
})

describe('engine client without a worker (main-thread fallback)', () => {
  it('runs on the main thread when Worker is unavailable and gives the same numbers', async () => {
    const c = new EngineClient(ed)
    expect(c.mode).toBe('sync')
    expect(await c.timelines([A, B], DEFAULT_PARAMS)).toEqual(timelinesFor(ed, [A, B], DEFAULT_PARAMS))
    const rows: SensRow[] = []
    await new Promise<void>((resolve, reject) => c.sensitivity([A, B], DEFAULT_PARAMS, WIN,
      { onRow: r => rows.push(r), onDone: resolve, onError: reject }))
    expect(rows).toHaveLength(13)
  })

  it('cancel stops the table', async () => {
    const c = new EngineClient(ed, false)
    let n = 0
    const stop = c.sensitivity([A], DEFAULT_PARAMS, WIN, { onRow: () => { n++; if (n === 3) stop() }, onDone: () => { n = -100 }, onError: () => {} })
    await new Promise(r => setTimeout(r, 200))
    expect(n).toBe(3)
  })
})
