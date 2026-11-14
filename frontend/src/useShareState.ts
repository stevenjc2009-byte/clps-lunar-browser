// Page state that a shared link carries (dates, sites, sky-graph site, params, custom
// location), read from the URL hash on load and written back as it changes.

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeSite, loadVectors, vectorsMismatch } from './ephem'
import { DEFAULT_PARAMS, type Params } from './lib/params'
import { defaultLandingDay } from './lib/window'
import type { Site, SkyData } from './types'
import { defaultPicks, encodeUrlState, parseUrlState, type ShareState, type UrlState } from './url'

const LINK_NOTE = 'Your own coordinates (from a shared link), worked out in your browser from the same NASA JPL ephemeris'

export function useShareState() {
  const [siteId, setSiteId] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [startDay, setStartDay] = useState('')
  const [days, setDays] = useState(365)
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS })
  const [custom, setCustom] = useState<Site | null>(null)
  const [linkNote, setLinkNote] = useState<string | null>(null)
  const written = useRef('')

  const apply = useCallback((d: SkyData, u: UrlState) => {
    const ids = d.sites.map(s => s.id)
    const known = (id: string) => ids.includes(id) || (id === 'custom' && !!u.custom)
    const sites = (u.sites ?? []).filter(known)
    setStartDay(u.day ?? defaultLandingDay(d))
    setDays(u.days ?? 365)
    setParams({ ...DEFAULT_PARAMS, ...u.params })
    setPicked(sites.length >= 2 ? sites : defaultPicks(ids))
    setSiteId(u.sky && known(u.sky) ? u.sky : (ids[0] ?? ''))
    setLinkNote(null)
    if (!u.custom) { setCustom(null); return }
    const { lat, lon } = u.custom
    loadVectors(`${import.meta.env.BASE_URL}vectors.bin`).then(v => {
      const bad = vectorsMismatch(v.header, d.meta)
      if (bad) throw new Error(bad)
      setCustom({ ...computeSite(v, lat, lon, 'Your location'), note: LINK_NOTE })
    }).catch(e => {
      setCustom(null)
      setPicked(p => { const f = p.filter(id => id !== 'custom'); return f.length >= 2 ? f : defaultPicks(ids) })
      setLinkNote(`The link's own location could not be loaded (${String(e)}).`)
    })
  }, [])

  // First load, and a new link pasted into the same tab (hashchange).
  const init = useCallback((d: SkyData) => {
    apply(d, parseUrlState(location.hash))
    const onHash = () => { if (location.hash.replace(/^#/, '') !== written.current) apply(d, parseUrlState(location.hash)) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [apply])

  const addCustom = useCallback((s: Site) => {
    setCustom(s)
    setPicked(p => (p.includes(s.id) ? p : [...p, s.id]))
    setSiteId(s.id)
  }, [])

  const toggle = useCallback((id: string) => setPicked(p =>
    p.includes(id) ? (p.length > 2 ? p.filter(x => x !== id) : p) : [...p, id]), [])

  // Remembers what this page wrote, so its own writes are not read back as a new link.
  const markWritten = useCallback((enc: string) => { written.current = enc }, [])

  return { siteId, setSiteId, picked, toggle, startDay, setStartDay, days, setDays, params, setParams, custom, addCustom, linkNote, init, markWritten }
}

// Keeps the address bar equal to what is on screen, so copying it also shares the view.
export function useUrlSync(s: ShareState | null, markWritten: (enc: string) => void) {
  const enc = s ? encodeUrlState(s) : ''
  useEffect(() => {
    if (!enc || enc === location.hash.replace(/^#/, '')) return
    markWritten(enc)
    history.replaceState(null, '', `${location.pathname}${location.search}#${enc}`)
  }, [enc, markWritten])
}

