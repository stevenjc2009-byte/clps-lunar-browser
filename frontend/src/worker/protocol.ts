// Messages between the page and the engine worker, and the worker's message handler.
// The handler is plain code (no worker API) so the tests can drive it directly.

import { engineData, type EngineData, type Timeline } from '../lib/engine'
import type { HorizonsFile } from '../lib/horizon'
import type { Params } from '../lib/params'
import type { Site, SkyData } from '../types'
import { runSensitivity, timelinesFor, type SensRow, type Win } from './compute'

// Sites travel by id; a custom site (not in sky.json) travels whole.
export interface SiteRef { siteIds: string[]; custom: Site | null }

export type ToWorker =
  | { type: 'init'; sky: SkyData; horizons: HorizonsFile | null }
  | ({ type: 'timelines'; id: number; params: Params } & SiteRef)
  | ({ type: 'sens'; id: number; params: Params; win: Win } & SiteRef)
  | { type: 'sens-cancel'; id: number }

export type FromWorker =
  | { type: 'timelines'; id: number; timelines: Timeline[] }
  | { type: 'sens-row'; id: number; row: SensRow; done: number; total: number }
  | { type: 'sens-done'; id: number }
  | { type: 'error'; id: number; message: string }

export function resolveSites(ed: EngineData, ref: SiteRef): Site[] {
  return ref.siteIds.map(id => {
    const s = id === ref.custom?.id ? ref.custom : ed.sky.sites.find(x => x.id === id)
    if (!s) throw new Error(`unknown site ${id}`)
    return s
  })
}

export interface WorkerState { ed: EngineData | null; sensId: number }

export function newWorkerState(): WorkerState { return { ed: null, sensId: 0 } }

export function handleMessage(st: WorkerState, msg: ToWorker, post: (m: FromWorker) => void): void {
  if (msg.type === 'init') { st.ed = engineData(msg.sky, msg.horizons); return }
  if (msg.type === 'sens-cancel') { if (st.sensId === msg.id) st.sensId = 0; return }
  const ed = st.ed
  if (!ed) { post({ type: 'error', id: msg.id, message: 'engine not initialised' }); return }
  try {
    if (msg.type === 'timelines') {
      post({ type: 'timelines', id: msg.id, timelines: timelinesFor(ed, resolveSites(ed, msg), msg.params) })
      return
    }
    // A new table request replaces any older one still running.
    st.sensId = msg.id
    const sites = resolveSites(ed, msg)
    runSensitivity(ed, sites, msg.params, msg.win,
      (row, done, total) => post({ type: 'sens-row', id: msg.id, row, done, total }),
      () => st.sensId !== msg.id)
      .then(finished => { if (finished) post({ type: 'sens-done', id: msg.id }) })
      .catch(e => post({ type: 'error', id: msg.id, message: String(e) }))
  } catch (e) {
    post({ type: 'error', id: msg.id, message: String(e) })
  }
}
