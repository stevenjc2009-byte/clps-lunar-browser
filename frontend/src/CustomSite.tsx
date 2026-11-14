import { useState, type FormEvent } from 'react'
import { computeSite, loadVectors, type Vectors } from './ephem'
import Explain from './Explain'
import { EXPLAIN } from './explanations'
import type { Site } from './types'

// vectors.bin (~400 KB) is only fetched the first time someone adds a location.
let cache: Promise<Vectors> | null = null
const vectors = () => (cache ??= loadVectors(`${import.meta.env.BASE_URL}vectors.bin`))

const NOTE = 'Your own coordinates, worked out in your browser from the same NASA JPL ephemeris'

export default function CustomSite({ onSite, explainAll }: { onSite: (s: Site) => void; explainAll: boolean }) {
  const [lat, setLat] = useState('-87.5')
  const [lon, setLon] = useState('45')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const la = Number(lat), lo = Number(lon)
    if (lat.trim() === '' || !Number.isFinite(la) || la < -90 || la > 90) { setStatus('Latitude must be a number from −90 to 90.'); return }
    if (lon.trim() === '' || !Number.isFinite(lo) || lo < -180 || lo > 360) { setStatus('Longitude must be a number from −180 to 360.'); return }
    setBusy(true)
    setStatus('Working it out…')
    try {
      const site = computeSite(await vectors(), la, lo, 'Your location')
      onSite({ ...site, note: NOTE })
      setStatus(null)
    } catch (err) {
      cache = null
      setStatus(`Could not load the data: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="custom" onSubmit={submit} aria-label="Add your own location">
      <p className="custom-title">Try your own spot <Explain term="Your own location" all={explainAll}>{EXPLAIN.custom}</Explain></p>
      <label className="field">
        <span>Latitude (°, minus = south)</span>
        <input type="number" step="any" min={-90} max={90} value={lat} onChange={e => setLat(e.target.value)} />
      </label>
      <label className="field">
        <span>Longitude (° east)</span>
        <input type="number" step="any" min={-180} max={360} value={lon} onChange={e => setLon(e.target.value)} />
      </label>
      <button type="submit" className="custom-go" disabled={busy}>Add to comparison</button>
      {status && <p className="custom-status" role="status">{status}</p>}
    </form>
  )
}
