import { useEffect, useMemo, useState } from 'react'
import Compare, { type Row } from './Compare'
import CustomSite from './CustomSite'
import Explain from './Explain'
import LandingChart from './LandingChart'
import { EXPLAIN } from './explanations'
import { engineData, siteTimeline } from './lib/engine'
import { isoDay } from './lib/format'
import type { HorizonsFile } from './lib/horizon'
import { DEFAULT_PARAMS, type Params } from './lib/params'
import { dataEndH, dataStartMs, defaultLandingDay, landingRangeH, spanOf, windowFor, type Span } from './lib/window'
import { windowMetrics } from './lib/windowMetrics'
import SkyChart from './SkyChart'
import type { Site, SkyData } from './types'

function fmtLat(lat: number) { return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}` }
function fmtLon(lon: number) { return `${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}` }
function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const WINDOWS = [{ days: 30, label: '30 days' }, { days: 365, label: '1 year' }]
const HOUR_MS = 3_600_000

// Lowest and highest value inside the sample span (for the sky graph caption).
function range(a: number[], span: Span): [number, number] {
  let lo = Infinity, hi = -Infinity
  for (let i = span.start; i < span.end; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]) }
  return [lo, hi]
}

// horizons.json is optional: without it every site uses the flat horizon (provisional).
async function loadHorizons(): Promise<HorizonsFile | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}horizons.json`)
    if (!r.ok) return null
    const h = await r.json() as HorizonsFile
    return h && typeof h === 'object' && h.sites ? h : null
  } catch { return null }
}

export default function App() {
  const [data, setData] = useState<SkyData | null>(null)
  const [horizons, setHorizons] = useState<HorizonsFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [startDay, setStartDay] = useState('')
  const [days, setDays] = useState(365)
  const [explainAll, setExplainAll] = useState(false)
  const [custom, setCustom] = useState<Site | null>(null)
  // Model parameters (spec 6.2). No controls yet; the defaults are the engine's.
  const [params] = useState<Params>(DEFAULT_PARAMS)

  useEffect(() => {
    const sky = fetch(`${import.meta.env.BASE_URL}sky.json`)
      .then(r => { if (!r.ok) throw new Error(`sky.json: HTTP ${r.status}`); return r.json() as Promise<SkyData> })
    Promise.all([sky, loadHorizons()])
      .then(([d, h]) => {
        setHorizons(h)
        setData(d)
        setSiteId(d.sites[0]?.id ?? '')
        setPicked(d.sites.slice(0, 3).map(s => s.id))
        setStartDay(defaultLandingDay(d))
      })
      .catch(e => setError(String(e)))
  }, [])

  const ed = useMemo(() => (data ? engineData(data, horizons) : null), [data, horizons])
  const sites = useMemo(() => (data ? [...data.sites, ...(custom ? [custom] : [])] : []), [data, custom])
  const pick = useMemo(() => (data && startDay ? windowFor(data, startDay, days) : null), [data, startDay, days])
  const rows: Row[] = useMemo(() => {
    if (!ed || !pick) return []
    return sites.filter(s => picked.includes(s.id)).map(site => {
      const tl = siteTimeline(ed, site, params)
      return { site, tl, m: windowMetrics(tl, pick.startH, pick.lenH) }
    })
  }, [ed, sites, pick, picked, params])

  if (error) return <main className="app"><p className="error">Could not load data: {error}</p></main>
  if (!data || !pick || !ed) return <main className="app"><p className="loading">Loading ephemeris data…</p></main>

  const t0 = dataStartMs(data)
  const { minH, maxH } = landingRangeH(data, days * 24)
  const minDay = defaultLandingDay(data)
  const firstH = (Date.parse(`${minDay}T00:00:00Z`) - t0) / HOUR_MS
  const maxDay = isoDay(t0 + maxH * HOUR_MS)
  const fromDay = isoDay(t0 + pick.startH * HOUR_MS)
  const toDay = isoDay(t0 + (pick.startH + pick.lenH) * HOUR_MS)
  const span = spanOf(data, pick)
  const site = sites.find(s => s.id === siteId) ?? sites[0]
  const [sunMin, sunMax] = range(site.sun_alt, span)
  const [earthMin, earthMax] = range(site.earth_alt, span)
  const clampNote = pick.clamped === 'before_range' ? `That date is before the supported landing range, so the dates start on ${fmtDay(isoDay(t0 + minH * HOUR_MS))}.`
    : pick.clamped === 'after_range' ? `That date leaves too little data for the look-ahead, so the dates start on ${fmtDay(fromDay)}.`
      : pick.clamped === 'invalid' ? `That date could not be read, so the dates start on ${fmtDay(fromDay)}.` : null

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
          <p className="eyebrow">NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator</p>
          <h1>CLPS Lunar Mission Browser</h1>
          <p className="tagline">Compare Moon south-pole landing sites: when is the Sun up for power, and when can you see Earth to phone home?</p>
        </div>
        <button type="button" className={`explain-all ${explainAll ? 'on' : ''}`} aria-pressed={explainAll}
          onClick={() => setExplainAll(x => !x)}>
          {explainAll ? 'Hide explanations' : 'Explain it to me'}
        </button>
      </header>

      <ol className="intro" aria-label="How to use this page">
        <li><b>Pick a landing date</b> and how far ahead to look.</li>
        <li><b>Compare the sites:</b> time with sunlight for power, time with a radio link home, and the longest night.</li>
        <li><b>Read the verdict</b> on each card. New to this? Press <span className="q">?</span> next to anything, or "Explain it to me".</li>
      </ol>

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
        {clampNote && <p className="period clamp-note" role="status">{clampNote}</p>}
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
        <CustomSite onSite={addCustom} explainAll={explainAll} meta={data.meta} />
        <Compare rows={rows} params={params} explainAll={explainAll}
          landing={{ startH: pick.startH, t0Ms: t0, endH: dataEndH(data) }} />
      </section>

      <section className="panel" aria-label="Sunlight by landing date">
        <div className="section-head">
          <h2>Sunlight by landing date <Explain term="Sunlight by landing date" all={explainAll}>{EXPLAIN.landing}</Explain></h2>
        </div>
        <p className="how-read">How much Sun each site gets over the next {days === 365 ? 'year' : `${days} days`}, if you landed on
          that date. <b>Click the chart to pick that landing date.</b></p>
        <LandingChart lines={rows.map(r => ({ name: r.site.name, tl: r.tl }))} days={days} firstH={firstH} lastH={maxH}
          t0Ms={t0} landingDay={fromDay} onPick={setStartDay} />
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
        <p className="how-read"><b>What am I looking at?</b> The sky seen from this site. Each dot is where the
          <span className="sun"> Sun</span> or <span className="earth">Earth</span> was at one hour: across is compass direction,
          up is height. Dots in the brown band, below the 0° line, are under the horizon, so hidden.</p>
        <SkyChart site={site} span={span} />
        <p className="caption">
          Each dot is one hour, {fmtDay(fromDay)} → {fmtDay(toDay)} UTC. Sun height {sunMin.toFixed(1)}° to {sunMax.toFixed(1)}°,
          Earth height {earthMin.toFixed(1)}° to {earthMax.toFixed(1)}°.
          <Explain term="Why the Sun stays low" all={explainAll}>{EXPLAIN.low}</Explain>
        </p>
      </section>

      <footer>
        <p>Positions: NASA JPL DE440 ephemeris and NAIF lunar orientation kernels via Skyfield, checked against NASA JPL Horizons
          to within 0.002 arcseconds. Model: {data.meta.horizon}. Hourly samples, {fmtDay(data.meta.start_utc.slice(0, 10))} to{' '}
          {fmtDay(data.meta.end_utc.slice(0, 10))}; landing dates {fmtDay(minDay)} to {fmtDay(maxDay)}.</p>
        <p>Made by <b>The Big Four</b> ·{' '}
          <a href="https://github.com/stevenjc2009-byte/clps-lunar-browser#readme" target="_blank" rel="noreferrer">Method, sources and code</a></p>
      </footer>
    </main>
  )
}
