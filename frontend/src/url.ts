// Shareable link: the page state lives in the URL hash (#d=...&w=...), so a copied link
// opens the same view. The hash never reaches a server (static site on GitHub Pages).
//
// Parsing is strict and never throws: unknown keys are ignored, every value is checked
// against a whitelist or a range, and anything bad is simply left out so the page uses its
// default for it. Nothing from the URL is ever put into HTML; site ids are also matched
// against the loaded site list before use (see App).

import { MAX_ABS_LAT_DEG } from './ephem'
import { DSN_EL_CHOICES_DEG, HEIGHT_CHOICES_M, MASK_OFFSET_CHOICES_DEG, type Params } from './lib/params'
import type { EarthRule } from './lib/visibility'

export const LOOK_AHEAD_DAYS = [30, 365] as const
export const EARTH_RULES: readonly EarthRule[] = ['centre', 'any_part', 'whole_disc']
export const MAX_URL_SITES = 12
const MAX_HASH_CHARS = 2000
const SITE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
// Plain decimal number only: no hex, no exponent, no "Infinity", at most 8 decimals.
const DECIMAL = /^-?\d{1,3}(\.\d{1,8})?$/

// The parameters a link can set: exactly the ones with a control on the page. The Sun rule
// has no control, so a link cannot change it silently.
export type UrlParams = Partial<Pick<Params, 'observerHeightM' | 'maskOffsetDeg' | 'earthRule' | 'dsnOn' | 'dsnMinElDeg'>>

export interface UrlState {
  day?: string                          // landing date, YYYY-MM-DD (range is clamped later by windowFor)
  days?: (typeof LOOK_AHEAD_DAYS)[number]
  sites?: string[]                      // picked site ids (shape-checked only; App drops unknown ids)
  sky?: string                          // sky-graph site id
  params: UrlParams
  custom?: { lat: number; lon: number } // custom location
}

function pickNumber<T extends number>(raw: string | null, allowed: readonly T[]): T | undefined {
  if (raw === null || !/^(0|[1-9]\d{0,2})$/.test(raw)) return undefined
  const n = Number(raw)
  return allowed.find(a => a === n)
}

function parseDay(raw: string | null): string | undefined {
  const m = raw === null ? null : ISO_DAY.exec(raw)
  if (!m) return undefined
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 2000 || y > 2100) return undefined
  const t = Date.UTC(y, mo - 1, d)
  // Rejects 2026-02-30 and similar: the date must round-trip unchanged.
  return new Date(t).toISOString().slice(0, 10) === raw ? raw : undefined
}

function parseSiteId(raw: string | null): string | undefined {
  return raw !== null && SITE_ID.test(raw) ? raw : undefined
}

function parseSites(raw: string | null): string[] | undefined {
  if (raw === null) return undefined
  const ids: string[] = []
  for (const part of raw.split(',')) {
    if (SITE_ID.test(part) && !ids.includes(part)) ids.push(part)
    if (ids.length >= MAX_URL_SITES) break
  }
  return ids.length ? ids : undefined
}

function parseDecimal(raw: string | null, lo: number, hi: number): number | undefined {
  if (raw === null || !DECIMAL.test(raw)) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined
}

export function parseUrlState(hash: string): UrlState {
  const out: UrlState = { params: {} }
  if (typeof hash !== 'string' || hash.length > MAX_HASH_CHARS) return out
  let q: URLSearchParams
  try { q = new URLSearchParams(hash.replace(/^#/, '')) } catch { return out }
  // First value wins if a key is repeated.
  const get = (k: string) => q.get(k)

  const day = parseDay(get('d'))
  if (day) out.day = day
  const days = pickNumber(get('w'), LOOK_AHEAD_DAYS)
  if (days) out.days = days
  const sites = parseSites(get('s'))
  if (sites) out.sites = sites
  const sky = parseSiteId(get('g'))
  if (sky) out.sky = sky

  const h = pickNumber(get('h'), HEIGHT_CHOICES_M)
  if (h !== undefined) out.params.observerHeightM = h
  const m = pickNumber(get('m'), MASK_OFFSET_CHOICES_DEG)
  if (m !== undefined) out.params.maskOffsetDeg = m
  const e = get('e')
  const rule = EARTH_RULES.find(r => r === e)
  if (rule) out.params.earthRule = rule
  const dsn = get('dsn')
  if (dsn === '0' || dsn === '1') out.params.dsnOn = dsn === '1'
  const del = pickNumber(get('del'), DSN_EL_CHOICES_DEG)
  if (del !== undefined) out.params.dsnMinElDeg = del

  const lat = parseDecimal(get('lat'), -MAX_ABS_LAT_DEG, MAX_ABS_LAT_DEG)
  const lon = parseDecimal(get('lon'), -180, 360)
  if (lat !== undefined && lon !== undefined) out.custom = { lat, lon }
  return out
}

export interface ShareState {
  day: string
  days: number
  sites: string[]
  sky: string
  params: Params
  custom: { lat: number; lon: number } | null
}

// Always writes every field, so a link means the same thing even if defaults change later.
export function encodeUrlState(s: ShareState): string {
  const q = new URLSearchParams()
  q.set('d', s.day)
  q.set('w', String(s.days))
  q.set('s', s.sites.join(','))
  q.set('g', s.sky)
  q.set('h', String(s.params.observerHeightM))
  q.set('m', String(s.params.maskOffsetDeg))
  q.set('e', s.params.earthRule)
  q.set('dsn', s.params.dsnOn ? '1' : '0')
  q.set('del', String(s.params.dsnMinElDeg))
  if (s.custom) {
    q.set('lat', String(Math.round(s.custom.lat * 1e6) / 1e6))
    q.set('lon', String(Math.round(s.custom.lon * 1e6) / 1e6))
  }
  return q.toString().replace(/%2C/g, ',')
}

// The comparison shown on first visit: Shackleton rim against the two IM landing sites.
// If any of them is missing from the data, fall back to the first three sites.
export const DEFAULT_COMPARE = ['shackleton-rim', 'im2', 'im1']

export function defaultPicks(siteIds: string[]): string[] {
  return DEFAULT_COMPARE.every(id => siteIds.includes(id)) ? [...DEFAULT_COMPARE] : siteIds.slice(0, 3)
}
