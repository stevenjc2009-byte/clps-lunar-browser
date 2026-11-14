// React glue for the engine: load the data once, start one engine client for it, and
// recompute the compared sites' timelines (off the main thread when possible) whenever the
// sites or the params change. Older answers that arrive late are ignored (replace, not queue).

import { useEffect, useMemo, useState } from 'react'
import type { Row } from '../Compare'
import { engineData, type EngineData, type Timeline } from '../lib/engine'
import type { HorizonsFile } from '../lib/horizon'
import { paramsKey, type Params } from '../lib/params'
import { windowMetrics } from '../lib/windowMetrics'
import type { Site, SkyData } from '../types'
import { EngineClient } from './client'
import type { Win } from './compute'

// ?engine=sync in the page address forces the main-thread path (used for measuring).
const forceSync = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('engine') === 'sync'

// horizons.json is optional: without it every site uses the flat horizon (provisional).
async function loadHorizons(): Promise<HorizonsFile | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}horizons.json`)
    if (!r.ok) return null
    const h = await r.json() as HorizonsFile
    return h && typeof h === 'object' && h.sites ? h : null
  } catch { return null }
}

export interface SkyState {
  data: SkyData | null
  horizons: HorizonsFile | null
  ed: EngineData | null
  client: EngineClient | null
  error: string | null
}

// Loads sky.json (+ optional horizons.json) once and starts one engine client for it.
// `onLoad` runs with the data as soon as it arrives (the page uses it to apply the URL)
// and returns its own clean-up.
export function useSkyData(onLoad: (d: SkyData) => (() => void)): SkyState {
  const [st, setSt] = useState<SkyState>({ data: null, horizons: null, ed: null, client: null, error: null })
  useEffect(() => {
    let client: EngineClient | null = null
    let off = () => {}
    let live = true
    const sky = fetch(`${import.meta.env.BASE_URL}sky.json`)
      .then(r => { if (!r.ok) throw new Error(`sky.json: HTTP ${r.status}`); return r.json() as Promise<SkyData> })
    Promise.all([sky, loadHorizons()])
      .then(([data, horizons]) => {
        if (!live) return
        const ed = engineData(data, horizons)
        client = new EngineClient(ed, !forceSync())
        off = onLoad(data)
        setSt({ data, horizons, ed, client, error: null })
      })
      .catch(e => { if (live) setSt(s => ({ ...s, error: String(e) })) })
    return () => { live = false; off(); client?.dispose() }
  }, [onLoad])
  return st
}

const siteKey = (s: Site) => `${s.id}@${s.lat},${s.lon}`

export interface EngineRows { rows: Row[]; busy: boolean; error: string | null }

export function useEngineRows(client: EngineClient | null, compared: Site[], params: Params, win: Win | null): EngineRows {
  const [res, setRes] = useState<{ key: string; sites: Site[]; tls: Timeline[]; error: string | null } | null>(null)
  const key = `${compared.map(siteKey).join(',')}|${paramsKey(params)}`

  useEffect(() => {
    if (!client || compared.length === 0) return
    let live = true
    client.timelines(compared, params).then(
      tls => { if (live) setRes({ key, sites: compared, tls, error: null }) },
      e => { if (live) setRes(r => ({ key, sites: r?.sites ?? [], tls: r?.tls ?? [], error: String(e) })) },
    )
    return () => { live = false }
    // `key` covers `compared` and `params`; listing the objects would rerun on every render.
  }, [client, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (res && win
    ? res.sites.map((site, i) => ({ site, tl: res.tls[i], m: windowMetrics(res.tls[i], win.startH, win.lenH) }))
    : []), [res, win])
  return { rows, busy: !res || res.key !== key, error: res?.error ?? null }
}
