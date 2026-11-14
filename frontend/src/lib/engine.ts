// Per-site visibility timeline over the WHOLE loaded data range, for one set of params.
// Every window metric, the landing-date chart and the after-landing times are cut from
// this one timeline, so they always agree. Results are memoised by
// (data version, site, params).

import type { Site, SkyData } from '../types'
import { makeMask, type HorizonsFile } from './horizon'
import { complement, cumulative, intersect, type Cumulative, type Intervals } from './intervals'
import { SUBSTEPS, upsampleAz, upsampleCubic, upsampleLinear } from './interp'
import { paramsKey, type Params } from './params'
import { EARTH_POINT, margins, positiveIntervals, SUN_POINT } from './visibility'

// Used only when sky.json has no radius arrays (v1). Mean apparent radii seen from the Moon.
export const FALLBACK_SUN_RADIUS_DEG = 0.2666
export const FALLBACK_EARTH_RADIUS_DEG = 0.95

export interface EngineData {
  sky: SkyData
  horizons: HorizonsFile | null
  version: string           // changes whenever either file changes
  radiiFromData: boolean    // false = v1 file, constant radii used
  dsnLoaded: boolean        // false = no dsn_moon_el_max array
}

const fullLength = (a: unknown, n: number): a is number[] => Array.isArray(a) && a.length === n

export function engineData(sky: SkyData, horizons: HorizonsFile | null = null): EngineData {
  const n = sky.meta.samples
  const radiiFromData = fullLength(sky.sun_radius_deg, n) && fullLength(sky.earth_radius_deg, n)
  const dsnLoaded = fullLength(sky.dsn_moon_el_max, n)
  if (!radiiFromData) {
    console.warn(`sky.json has no Sun/Earth radius arrays: using constant radii ${FALLBACK_SUN_RADIUS_DEG}° / ${FALLBACK_EARTH_RADIUS_DEG}°`)
  }
  const version = [
    sky.meta.version ?? 1, sky.meta.generated_utc ?? '', sky.meta.start_utc, n,
    horizons?.meta?.generated_utc ?? (horizons ? 'h' : 'noh'), horizons?.meta?.algorithm_version ?? '',
  ].join('/')
  return { sky, horizons, version, radiiFromData, dsnLoaded }
}

export interface Timeline {
  end: number              // hours from the first sample to the last; data covers [0, end]
  stepHours: number
  sun: Intervals           // Sun visible (per params.sunRule)
  earth: Intervals         // Earth visible (per params.earthRule)
  link: Intervals          // comms available: earth AND DSN (or just earth, see commsKind)
  both: Intervals          // Sun visible AND comms available
  dark: Intervals          // complement of sun over [0, end]
  commsGap: Intervals      // complement of link over [0, end]
  sunCum: Cumulative; earthCum: Cumulative; linkCum: Cumulative; bothCum: Cumulative
  terrain: boolean         // horizon from LOLA terrain (false = flat approximation)
  commsKind: 'link' | 'earth'   // 'earth' when DSN is off or not loaded
  dsnMissing: boolean      // DSN switched on but the data has no DSN array
}

const LRU_MAX = 48
const cache = new Map<string, Timeline>()

export function timelineKey(d: EngineData, site: Site, p: Params): string {
  return `${d.version}|${site.id}|${site.lat},${site.lon}|${site.sun_alt.length}|${paramsKey(p)}`
}

export function siteTimeline(d: EngineData, site: Site, p: Params): Timeline {
  const key = timelineKey(d, site, p)
  const hit = cache.get(key)
  if (hit) { cache.delete(key); cache.set(key, hit); return hit }
  const tl = buildTimeline(d, site, p)
  cache.set(key, tl)
  if (cache.size > LRU_MAX) cache.delete(cache.keys().next().value as string)
  return tl
}

export function clearEngineCache() { cache.clear() }

export function buildTimeline(d: EngineData, site: Site, p: Params): Timeline {
  const step = d.sky.meta.step_hours
  const n = site.sun_alt.length
  const end = (n - 1) * step
  const dt = step / SUBSTEPS
  const mask = makeMask(d.horizons, site.id, p.observerHeightM, p.maskOffsetDeg)

  const radius = (arr: number[] | undefined, fallback: number) =>
    d.radiiFromData && arr && arr.length === n ? upsampleLinear(arr) : fallback

  const sunM = margins(upsampleCubic(site.sun_alt), upsampleAz(site.sun_az),
    radius(d.sky.sun_radius_deg, FALLBACK_SUN_RADIUS_DEG), SUN_POINT[p.sunRule], mask)
  const sun = positiveIntervals(sunM, 0, dt)
  const earthM = margins(upsampleCubic(site.earth_alt), upsampleAz(site.earth_az),
    radius(d.sky.earth_radius_deg, FALLBACK_EARTH_RADIUS_DEG), EARTH_POINT[p.earthRule], mask)
  const earth = positiveIntervals(earthM, 0, dt)

  const dsnArr = d.sky.dsn_moon_el_max
  const useDsn = p.dsnOn && d.dsnLoaded && !!dsnArr && dsnArr.length === n
  let link = earth
  if (useDsn) {
    const el = upsampleLinear(dsnArr)
    for (let k = 0; k < el.length; k++) el[k] -= p.dsnMinElDeg
    // >= min elevation counts; shift by a hair so an exact hit is "on" like the contract says.
    for (let k = 0; k < el.length; k++) if (el[k] === 0) el[k] = Number.MIN_VALUE
    link = intersect(earth, positiveIntervals(el, 0, dt))
  }
  const both = intersect(sun, link)
  return {
    end, stepHours: step, sun, earth, link, both,
    dark: complement(sun, 0, end),
    commsGap: complement(link, 0, end),
    sunCum: cumulative(sun), earthCum: cumulative(earth), linkCum: cumulative(link), bothCum: cumulative(both),
    terrain: mask.terrain,
    commsKind: useDsn ? 'link' : 'earth',
    dsnMissing: p.dsnOn && !useDsn,
  }
}
