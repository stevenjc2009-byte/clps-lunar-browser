import { useEffect, useMemo, useState } from 'react'
import Compare from './Compare'
import CustomSite from './CustomSite'
import Explain from './Explain'
import { EXPLAIN } from './explanations'
import { dataStartMs, isoDay, siteMetrics, spanFor } from './metrics'
import SkyChart from './SkyChart'
import type { Site, SkyData } from './types'

function fmtLat(lat: number) { return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}` }
function fmtLon(lon: number) { return `${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}` }
function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const WINDOWS = [{ days: 30, label: '30 days' }, { days: 365, label: '1 year' }]
const HOUR_MS = 3_600_000

export default function App() {
  const [data, setData] = useState<SkyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [startDay, setStartDay] = useState('')
  const [days, setDays] = useState(365)
  const [explainAll, setExplainAll] = useState(false)
  const [custom, setCustom] = useState<Site | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}sky.json`)
      .then(r => { if (!r.ok) throw new Error(`sky.json: HTTP ${r.status}`); return r.json() })
      .then((d: SkyData) => {
        setData(d)
        setSiteId(d.sites[0]?.id ?? '')
        setPicked(d.sites.slice(0, 3).map(s => s.id))
        setStartDay(isoDay(dataStartMs(d)))
      })
      .catch(e => setError(String(e)))
  }, [])

  const sites = useMemo(() => (data ? [...data.sites, ...(custom ? [custom] : [])] : []), [data, custom])
  const span = useMemo(() => (data && startDay ? spanFor(data, startDay, days) : null), [data, startDay, days])
  const rows = useMemo(() => {
    if (!data || !span) return []
    return sites.filter(s => picked.includes(s.id))
      .map(site => ({ site, m: siteMetrics(site, span, data.meta.step_hours) }))
  }, [data, sites, span, picked])

  if (error) return <main className="app"><p className="error">Could not load data: {error}</p></main>
  if (!data || !span) return <main className="app"><p className="loading">Loading ephemeris data…</p></main>

  const step = data.meta.step_hours * HOUR_MS
  const t0 = dataStartMs(data)
  const minDay = isoDay(t0)
  const maxDay = isoDay(t0 + (data.meta.samples - (days * 24) / data.meta.step_hours) * step)
  const fromDay = isoDay(t0 + span.start * step)
  const toDay = isoDay(t0 + span.end * step)
  const site = sites.find(s => s.id === siteId) ?? sites[0]
  const chartM = siteMetrics(site, span, data.meta.step_hours)

  const toggle = (id: string) => setPicked(p =>
    p.includes(id) ? (p.length > 2 ? p.filter(x => x !== id) : p) : [...p, id])
  const addCustom = (s: Site) => {
    setCustom(s)
    setPicked(p => (p.includes(s.id) ? p : [...p, s.id]))
    setSiteId(s.id)
  }

  return (
    <main className="app">
      <header>
        <div>
          <h1>CLPS Lunar Mission Browser</h1>
          <p className="tagline">Compare Moon south-pole landing sites: when is the Sun up for power, and when can you see Earth to phone home?</p>
        </div>
        <button type="button" className={`explain-all ${explainAll ? 'on' : ''}`} aria-pressed={explainAll}
          onClick={() => setExplainAll(x => !x)}>
          {explainAll ? 'Hide explanations' : 'Explain it to me'}
        </button>
      </header>

      <section className="panel controls" aria-label="Dates">
        <label className="field">
          <span>Landing date (UTC)</span>
          <input type="date" value={fromDay} min={minDay} max={maxDay}
            onChange={e => e.target.value && setStartDay(e.target.value)} />
        </label>
        <div className="field">
          <span>Look ahead</span>
          <div className="seg" role="group" aria-label="Look ahead">
            {WINDOWS.map(w => (
              <button key={w.days} type="button" aria-pressed={days === w.days}
                className={days === w.days ? 'active' : ''} onClick={() => setDays(w.days)}>{w.label}</button>
            ))}
          </div>
        </div>
        <p className="period">{fmtDay(fromDay)} → {fmtDay(toDay)}
          <Explain term="Dates" all={explainAll}>{EXPLAIN.dates}</Explain></p>
      </section>

      <section className="panel" aria-label="Compare sites">
        <div className="section-head">
          <h2>Compare sites</h2>
          <div className="site-picks" role="group" aria-label="Sites to compare (pick at least 2)">
            {sites.map(s => {
              const on = picked.includes(s.id)
              return (
                <label key={s.id} className={`pick ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} disabled={on && picked.length <= 2}
                    onChange={() => toggle(s.id)} />
                  {s.name}
                </label>
              )
            })}
          </div>
        </div>
        <CustomSite onSite={addCustom} explainAll={explainAll} />
        <Compare rows={rows} explainAll={explainAll} landing={{ index: span.start, t0Ms: t0, stepHours: data.meta.step_hours }} />
      </section>

      <section className="panel" aria-label="Sky graph">
        <div className="section-head">
          <h2>Sky graph <Explain term="Sky graph" all={explainAll}>{EXPLAIN.graph}</Explain></h2>
          <nav className="site-tabs" role="tablist">
            {sites.map(s => (
              <button key={s.id} role="tab" aria-selected={s.id === site.id}
                className={s.id === site.id ? 'active' : ''} onClick={() => setSiteId(s.id)}>
                {s.name}
              </button>
            ))}
          </nav>
        </div>
        <p className="coords">{fmtLat(site.lat)}, {fmtLon(site.lon)} · {site.note}</p>
        <SkyChart site={site} span={span} />
        <p className="caption">
          Each dot is one hour, {fmtDay(fromDay)} → {fmtDay(toDay)} UTC. Sun height {chartM.sunMin.toFixed(1)}° to {chartM.sunMax.toFixed(1)}°,
          Earth height {chartM.earthMin.toFixed(1)}° to {chartM.earthMax.toFixed(1)}°.
          <Explain term="Why the Sun stays low" all={explainAll}>{EXPLAIN.low}</Explain>
        </p>
      </section>

      <section className="panel note" aria-label="Assumption">
        <p><b>Flat horizon.</b> Local hills and crater walls are not modelled, so real sunlight on high rims is higher and nights shorter than shown.
          <Explain term="Flat horizon" all={explainAll}>{EXPLAIN.flat}</Explain></p>
      </section>

      <footer>
        <p>Positions: NASA JPL DE421 ephemeris and NAIF lunar orientation kernels via Skyfield, checked against NASA JPL Horizons. {data.meta.horizon}. Hourly samples.</p>
      </footer>
    </main>
  )
}
