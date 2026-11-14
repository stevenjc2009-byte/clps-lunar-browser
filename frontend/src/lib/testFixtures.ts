// Small synthetic data for the engine tests (not used by the app).

import type { Site, SkyData } from '../types'
import { DEFAULT_PARAMS, type Params } from './params'

// The old app's model: flat 0 deg, centre of disc, no observer height, no DSN.
export const LEGACY: Params = { ...DEFAULT_PARAMS, observerHeightM: 0, sunRule: 'centre', earthRule: 'centre', dsnOn: false }

export const T0 = '2026-11-15T00:00:00Z'

export function makeSite(id: string, sunAlt: number[], earthAlt: number[] = sunAlt.map(() => 5), az = 0): Site {
  return {
    id, name: id.toUpperCase(), lat: -89, lon: 0, note: '', source: '',
    stats: { sun_visible_pct: 0, earth_visible_pct: 0, longest_dark_hours: 0, sun_alt_max: 0, sun_alt_min: 0, earth_alt_max: 0, earth_alt_min: 0 },
    sun_alt: sunAlt, sun_az: sunAlt.map(() => az), earth_alt: earthAlt, earth_az: earthAlt.map(() => az),
  }
}

export interface V2Extras { sunR?: number; earthR?: number; dsn?: number[] }

// v1 file when no extras are given; v2 arrays added when they are.
export function makeSky(sites: Site[], extras: V2Extras = {}, meta: Partial<SkyData['meta']> = {}): SkyData {
  const n = sites[0]?.sun_alt.length ?? 0
  const sky: SkyData = {
    meta: { start_utc: T0, end_utc: T0, step_hours: 1, samples: n, ephemeris: 'test', horizon: 'flat', ...meta },
    sites,
  }
  if (extras.sunR !== undefined) sky.sun_radius_deg = Array(n).fill(extras.sunR)
  if (extras.earthR !== undefined) sky.earth_radius_deg = Array(n).fill(extras.earthR)
  if (extras.dsn) sky.dsn_moon_el_max = extras.dsn
  if (extras.sunR !== undefined || extras.dsn) sky.meta.version = 2
  return sky
}

// Altitude that is +amp for `upH` hours then -amp for `downH` hours, repeating, as a
// smooth-ish trapezoid (straight ramps of 2 h) so crossings sit at known half-hours.
export function squareWave(n: number, upH: number, downH: number, amp = 1, phase = 0): number[] {
  const P = upH + downH
  return Array.from({ length: n }, (_, i) => (((i + phase) % P) < upH ? amp : -amp))
}
