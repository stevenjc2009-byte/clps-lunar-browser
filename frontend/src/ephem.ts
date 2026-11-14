import type { Site, SiteStats } from './types.ts'

// In-browser sky for ANY lunar lat/lon. backend/export_vectors.py stores the apparent
// Sun and Earth vectors from the Moon's centre (km, MOON_ME_DE421 body-fixed frame) for
// every hour; the site's local horizon is derived from those here, mirroring compute.py.

export interface VectorHeader {
  start_utc: string
  step_hours: number
  count: number
  layout: string
  units: string
  frame: string
  moon_radius_km: number
  source: string
}

export interface Vectors {
  header: VectorHeader
  // count * 6 floats per hour: sunX,sunY,sunZ,earthX,earthY,earthZ
  data: Float32Array
}

const FLOATS_PER_HOUR = 6
const DEG = 180 / Math.PI

// Audit B10: at the pole "north" and "east" are undefined, so azimuth would be arbitrary.
// 89.99 deg is ~300 m from the pole on the Moon; closer than that is refused.
export const MAX_ABS_LAT_DEG = 89.99

// A custom site is compared hour by hour with the sky.json sites, so vectors.bin must use
// the same time axis. Returns a reason when it does not, else null.
export function vectorsMismatch(h: VectorHeader, meta: { start_utc: string; step_hours: number; samples: number }): string | null {
  if (Date.parse(h.start_utc) !== Date.parse(meta.start_utc)) return `vectors start ${h.start_utc}, sky data starts ${meta.start_utc}`
  if (h.step_hours !== meta.step_hours) return `vectors step ${h.step_hours} h, sky data step ${meta.step_hours} h`
  if (h.count !== meta.samples) return `vectors hold ${h.count} hours, sky data holds ${meta.samples}`
  return null
}

export function parseVectors(header: VectorHeader, buf: ArrayBuffer): Vectors {
  const data = new Float32Array(buf)
  if (data.length !== header.count * FLOATS_PER_HOUR) {
    throw new Error(`vectors.bin has ${data.length} floats, expected ${header.count * FLOATS_PER_HOUR}`)
  }
  return { header, data }
}

// url points at vectors.bin; the header sits beside it as vectors.json.
export async function loadVectors(url: string): Promise<Vectors> {
  const [binRes, headRes] = await Promise.all([fetch(url), fetch(url.replace(/\.bin$/, '.json'))])
  if (!binRes.ok || !headRes.ok) throw new Error(`could not load ${url}`)
  return parseVectors(await headRes.json(), await binRes.arrayBuffer())
}

// Same rule as compute.py round_keep_sign: a positive value never rounds down to 0.
function roundKeepSign(a: number, nd: number): number {
  const f = 10 ** nd
  const r = Math.round(a * f) / f
  return a > 0 && r <= 0 ? 1 / f : r
}

const round = (a: number, nd: number) => Math.round(a * 10 ** nd) / 10 ** nd

interface Basis {
  east: number[]
  north: number[]
  up: number[]
}

// Local axes in the body-fixed frame for a spherical Moon (as Skyfield's build_latlon_degrees).
function localBasis(latDeg: number, lonDeg: number): Basis {
  const lat = latDeg / DEG
  const lon = lonDeg / DEG
  const [sLat, cLat, sLon, cLon] = [Math.sin(lat), Math.cos(lat), Math.sin(lon), Math.cos(lon)]
  return {
    east: [-sLon, cLon, 0],
    north: [-sLat * cLon, -sLat * sLon, cLat],
    up: [cLat * cLon, cLat * sLon, sLat],
  }
}

// Altitude and azimuth (deg, az clockwise from north, 0..360) of body vectors at offset
// `at` in vectors.data, seen from a site at `siteKm` (Moon radius * up).
function skyOf(data: Float32Array, at: number, basis: Basis, radiusKm: number) {
  const n = data.length / FLOATS_PER_HOUR
  const alt = new Float64Array(n)
  const az = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * FLOATS_PER_HOUR + at
    const x = data[o] - radiusKm * basis.up[0]
    const y = data[o + 1] - radiusKm * basis.up[1]
    const z = data[o + 2] - radiusKm * basis.up[2]
    const e = x * basis.east[0] + y * basis.east[1] + z * basis.east[2]
    const nn = x * basis.north[0] + y * basis.north[1] + z * basis.north[2]
    const u = x * basis.up[0] + y * basis.up[1] + z * basis.up[2]
    alt[i] = Math.asin(u / Math.hypot(x, y, z)) * DEG
    az[i] = (Math.atan2(e, nn) * DEG + 360) % 360
  }
  return { alt, az }
}

const percent = (alt: Float64Array, test: (a: number) => boolean) =>
  round((100 * alt.filter(test).length) / alt.length, 1)

function longestRun(alt: Float64Array, test: (a: number) => boolean): number {
  let best = 0
  let run = 0
  for (const a of alt) {
    run = test(a) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

const maxOf = (a: Float64Array) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const minOf = (a: Float64Array) => a.reduce((m, v) => Math.min(m, v), Infinity)

// Same shape (and the same stats rules) as one site entry in sky.json.
export function computeSite(vectors: Vectors, latDeg: number, lonDeg: number, name = 'Custom location'): Site {
  const { data, header } = vectors
  if (!Number.isFinite(latDeg) || Math.abs(latDeg) > MAX_ABS_LAT_DEG) {
    throw new Error(`latitude must be within ±${MAX_ABS_LAT_DEG}° (azimuth is undefined at the pole)`)
  }
  const basis = localBasis(latDeg, lonDeg)
  const sun = skyOf(data, 0, basis, header.moon_radius_km)
  const earth = skyOf(data, 3, basis, header.moon_radius_km)
  const stats: SiteStats = {
    sun_visible_pct: percent(sun.alt, a => a > 0),
    earth_visible_pct: percent(earth.alt, a => a > 0),
    longest_dark_hours: longestRun(sun.alt, a => a <= 0) * header.step_hours,
    sun_alt_max: round(maxOf(sun.alt), 2),
    sun_alt_min: round(minOf(sun.alt), 2),
    earth_alt_max: round(maxOf(earth.alt), 2),
    earth_alt_min: round(minOf(earth.alt), 2),
  }
  return {
    id: 'custom',
    name,
    lat: latDeg,
    lon: lonDeg,
    note: 'Custom coordinates',
    source: 'computed in browser from vectors.bin',
    stats,
    sun_alt: Array.from(sun.alt, a => roundKeepSign(a, 2)),
    sun_az: Array.from(sun.az, a => round(a, 1)),
    earth_alt: Array.from(earth.alt, a => roundKeepSign(a, 2)),
    earth_az: Array.from(earth.az, a => round(a, 1)),
  }
}
