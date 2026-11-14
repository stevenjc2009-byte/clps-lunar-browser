// The page's handle on the engine. Uses a Web Worker when the browser can start one, and
// otherwise (or if the worker fails) computes the same thing on the main thread.
// Add ?engine=sync to the page address to force the main-thread path (for measuring).

import type { EngineData, Timeline } from '../lib/engine'
import type { Params } from '../lib/params'
import type { Site } from '../types'
import { runSensitivity, timelinesFor, type SensRow, type Win } from './compute'
import type { FromWorker, ToWorker } from './protocol'

export type EngineMode = 'worker' | 'sync'

export interface SensHandlers {
  onRow: (row: SensRow, done: number, total: number) => void
  onDone: () => void
  onError: (message: string) => void
}

interface Pending {
  resolve: (t: Timeline[]) => void
  reject: (e: Error) => void
  replay: () => void          // rerun on the main thread if the worker dies
}

const isCustom = (ed: EngineData, s: Site) => !ed.sky.sites.some(x => x.id === s.id)

export class EngineClient {
  mode: EngineMode
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private sens = new Map<number, SensHandlers & { replay: () => void }>()
  private readonly ed: EngineData

  constructor(ed: EngineData, preferWorker = true) {
    this.ed = ed
    this.mode = 'sync'
    if (!preferWorker || typeof Worker === 'undefined') return
    try {
      const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<FromWorker>) => this.receive(e.data)
      w.onerror = e => { e.preventDefault(); this.fallBack(`worker error: ${e.message || 'the worker script could not start'}`) }
      this.post(w, { type: 'init', sky: ed.sky, horizons: ed.horizons })
      this.worker = w
      this.mode = 'worker'
    } catch (e) {
      console.warn('Engine worker unavailable, computing on the main thread:', e)
    }
  }

  private post(w: Worker, m: ToWorker) { w.postMessage(m) }

  private ref(sites: Site[]) {
    const custom = sites.find(s => isCustom(this.ed, s)) ?? null
    return { siteIds: sites.map(s => s.id), custom }
  }

  timelines(sites: Site[], params: Params): Promise<Timeline[]> {
    const sync = () => timelinesFor(this.ed, sites, params)
    if (!this.worker) {
      try { return Promise.resolve(sync()) } catch (e) { return Promise.reject(e as Error) }
    }
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const replay = () => { try { resolve(sync()) } catch (e) { reject(e as Error) } }
      this.pending.set(id, { resolve, reject, replay })
      this.post(this.worker as Worker, { type: 'timelines', id, params, ...this.ref(sites) })
    })
  }

  // Starts the sensitivity table. Returns a function that cancels it.
  sensitivity(sites: Site[], params: Params, win: Win, h: SensHandlers): () => void {
    const id = this.nextId++
    let stopped = false
    const runSync = () => {
      runSensitivity(this.ed, sites, params, win, h.onRow, () => stopped)
        .then(done => { if (done) h.onDone() })
        .catch(e => h.onError(String(e)))
    }
    if (!this.worker) { runSync(); return () => { stopped = true } }
    this.sens.set(id, { ...h, replay: runSync })
    this.post(this.worker, { type: 'sens', id, params, win, ...this.ref(sites) })
    return () => {
      stopped = true
      if (this.sens.delete(id) && this.worker) this.post(this.worker, { type: 'sens-cancel', id })
    }
  }

  private receive(m: FromWorker) {
    if (m.type === 'timelines') {
      const p = this.pending.get(m.id)
      this.pending.delete(m.id)
      p?.resolve(m.timelines)
      return
    }
    if (m.type === 'error') {
      const p = this.pending.get(m.id)
      if (p) { this.pending.delete(m.id); p.reject(new Error(m.message)); return }
      const s = this.sens.get(m.id)
      if (s) { this.sens.delete(m.id); s.onError(m.message) }
      return
    }
    const s = this.sens.get(m.id)
    if (!s) return   // cancelled or replaced
    if (m.type === 'sens-row') s.onRow(m.row, m.done, m.total)
    else { this.sens.delete(m.id); s.onDone() }
  }

  // The worker failed: finish everything outstanding on the main thread from now on.
  private fallBack(reason: string) {
    console.warn(`${reason}; computing on the main thread instead`)
    this.worker?.terminate()
    this.worker = null
    this.mode = 'sync'
    const pend = [...this.pending.values()], sens = [...this.sens.values()]
    this.pending.clear(); this.sens.clear()
    for (const p of pend) p.replay()
    for (const s of sens) s.replay()
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
    this.sens.clear()
  }
}
