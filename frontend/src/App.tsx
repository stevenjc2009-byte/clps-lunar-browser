import { useEffect, useState } from 'react'
import SkyChart from './SkyChart'
import type { SkyData } from './types'

function fmtLat(lat: number) { return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}` }
function fmtLon(lon: number) { return `${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}` }

export default function App() {
  const [data, setData] = useState<SkyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string>('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}sky.json`)
      .then(r => { if (!r.ok) throw new Error(`sky.json: HTTP ${r.status}`); return r.json() })
      .then((d: SkyData) => { setData(d); setSiteId(d.sites[0]?.id ?? '') })
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <main className="app"><p className="error">Could not load data: {error}</p></main>
  if (!data) return <main className="app"><p className="loading">Loading ephemeris data…</p></main>

  const site = data.sites.find(s => s.id === siteId) ?? data.sites[0]
  const period = `${data.meta.start_utc.slice(0, 10)} → ${data.meta.end_utc.slice(0, 10)}`

  return (
    <main className="app">
      <header>
        <h1>CLPS Lunar Mission Browser</h1>
        <p className="tagline">Sun and Earth above the horizon at Moon south pole landing sites</p>
      </header>

      <nav className="site-tabs" role="tablist">
        {data.sites.map(s => (
          <button key={s.id} role="tab" aria-selected={s.id === site.id}
            className={s.id === site.id ? 'active' : ''} onClick={() => setSiteId(s.id)}>
            {s.name}
          </button>
        ))}
      </nav>

      <section className="site-head">
        <h2>{site.name}</h2>
        <p className="coords">{fmtLat(site.lat)}, {fmtLon(site.lon)} · {site.note}</p>
      </section>

      <section className="stats">
        <div className="stat sun">
          <span className="value">{site.stats.sun_visible_pct.toFixed(1)}%</span>
          <span className="label">of time Sun above horizon</span>
          <span className="sub">power · elevation {site.stats.sun_alt_min}° to {site.stats.sun_alt_max}°</span>
        </div>
        <div className="stat earth">
          <span className="value">{site.stats.earth_visible_pct.toFixed(1)}%</span>
          <span className="label">of time Earth above horizon</span>
          <span className="sub">direct-to-Earth comms · elevation {site.stats.earth_alt_min}° to {site.stats.earth_alt_max}°</span>
        </div>
      </section>

      <section className="chart-card">
        <SkyChart site={site} />
        <p className="caption">
          Each dot is one hour, {period} UTC ({data.meta.samples.toLocaleString()} samples).
          Flat horizon: local terrain is not modelled.
        </p>
      </section>

      <footer>
        <p>Ephemeris: {data.meta.ephemeris}. Horizon: {data.meta.horizon}.</p>
      </footer>
    </main>
  )
}
