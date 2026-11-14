// Horizon mask: how high the skyline is (degrees) in each compass direction at a site.
// Terrain masks come from horizons.json (lola-terrain branch). A site without one gets a
// flat skyline lowered by the observer-height dip, and is flagged as not reliable.

export const MOON_RADIUS_KM = 1737.4

export interface RingProfile { dx_m: number; dy_m: number; h: number[] }

export interface SiteHorizon {
  az_step_deg: number
  heights: Record<string, number[]>   // observer height (m, as text) -> skyline, index i <-> az = i * step
  ring?: { radius_m: number[]; az_step_deg: number; height_m: number; profiles: RingProfile[] }
}

export interface HorizonsFile {
  meta: {
    dem_products?: { name: string; url: string; resolution_m: number; sha256?: string }[]
    algorithm_version?: string
    r_max_km?: number
    az_step_deg?: number
    interpolation?: string
    heights_m?: number[]
    generated_utc?: string
    script_commit?: string
    notes?: string
  }
  sites: Record<string, SiteHorizon>
}

// How far below the level line the edge of a smooth sphere sits, seen from heightM above it.
export function dipDeg(heightM: number): number {
  const R = MOON_RADIUS_KM * 1000
  return (Math.acos(R / (R + Math.max(0, heightM))) * 180) / Math.PI
}

export interface Mask {
  terrain: boolean          // true = LOLA skyline, false = flat approximation
  heightM: number
  offsetDeg: number
  step: number              // table azimuth step (deg); 0 for flat
  table: Float64Array | null
  flatDeg: number           // skyline height used when table is null (already includes offset)
}

// Skyline for a non-standard height: straight line between the nearest heights given.
function tableForHeight(h: SiteHorizon, heightM: number): number[] | null {
  const byH = new Map<number, number[]>()
  for (const [k, v] of Object.entries(h.heights ?? {})) if (Number.isFinite(Number(k)) && Array.isArray(v)) byH.set(Number(k), v)
  const keys = [...byH.keys()].sort((a, b) => a - b)
  if (!keys.length) return null
  const get = (k: number) => byH.get(k)
  if (keys.includes(heightM)) return get(heightM) ?? null
  if (heightM <= keys[0]) return get(keys[0]) ?? null
  if (heightM >= keys[keys.length - 1]) return get(keys[keys.length - 1]) ?? null
  const hi = keys.findIndex(k => k > heightM)
  const k0 = keys[hi - 1], k1 = keys[hi]
  const a = get(k0), b = get(k1), f = (heightM - k0) / (k1 - k0)
  if (!a || !b || a.length !== b.length) return null
  return a.map((v, i) => v + (b[i] - v) * f)
}

export function makeMask(horizons: HorizonsFile | null | undefined, siteId: string, heightM: number, offsetDeg: number): Mask {
  const h = horizons?.sites?.[siteId]
  const t = h && h.az_step_deg > 0 ? tableForHeight(h, heightM) : null
  // The table must cover exactly one full turn, or wrapping at 0/360 would be wrong.
  const fullTurn = !!h && !!t && Math.abs(t.length * h.az_step_deg - 360) < 1e-6
  if (h && t && !fullTurn) console.warn(`horizons.json: ${siteId} table does not cover 360°; using a flat horizon`)
  if (h && t && fullTurn && t.every(Number.isFinite)) {
    const table = Float64Array.from(t, v => v + offsetDeg)
    return { terrain: true, heightM, offsetDeg, step: h.az_step_deg, table, flatDeg: 0 }
  }
  return { terrain: false, heightM, offsetDeg, step: 0, table: null, flatDeg: -dipDeg(heightM) + offsetDeg }
}

// Skyline height at one azimuth: straight line between table points, wrapping at 0/360.
export function maskAt(m: Mask, azDeg: number): number {
  const t = m.table
  if (!t) return m.flatDeg
  const n = t.length
  let x = azDeg / m.step
  x -= n * Math.floor(x / n)
  const i = Math.floor(x)
  const f = x - i
  const a = t[i % n], b = t[(i + 1) % n]
  return a + (b - a) * f
}

// Highest skyline across a disc's width: [az - r, az + r]. Checks both edges and every
// table point in between, which is the exact maximum of the straight-line skyline.
export function maskOverDisc(m: Mask, azDeg: number, rDeg: number): number {
  const t = m.table
  if (!t) return m.flatDeg
  let best = Math.max(maskAt(m, azDeg - rDeg), maskAt(m, azDeg), maskAt(m, azDeg + rDeg))
  const n = t.length
  const first = Math.ceil((azDeg - rDeg) / m.step), last = Math.floor((azDeg + rDeg) / m.step)
  for (let k = first; k <= last; k++) {
    const v = t[((k % n) + n) % n]
    if (v > best) best = v
  }
  return best
}
