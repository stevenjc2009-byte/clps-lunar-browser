// Turning the date picker into a window on the data time axis (hours from the first sample).

import type { SkyData } from '../types'

const HOUR_MS = 3_600_000

export function dataStartMs(data: SkyData) { return Date.parse(data.meta.start_utc) }

// Last sample time, in hours from the first.
export function dataEndH(data: SkyData) { return (data.meta.samples - 1) * data.meta.step_hours }

// The supported landing range (sky.json v2 meta), or the whole data if not given.
// Returned in hours from the first sample; the latest start also leaves room for the window.
export function landingRangeH(data: SkyData, lenH: number): { minH: number; maxH: number } {
  const t0 = dataStartMs(data)
  const toH = (iso: string | undefined, fallback: number) => {
    const ms = iso ? Date.parse(iso) : NaN
    return Number.isFinite(ms) ? (ms - t0) / HOUR_MS : fallback
  }
  const end = dataEndH(data)
  const minH = Math.max(0, toH(data.meta.landing_min_utc, 0))
  const maxH = Math.max(minH, Math.min(toH(data.meta.landing_max_utc, end), end - lenH))
  return { minH, maxH }
}

// The date the picker starts on: the first whole UTC day inside the landing range.
export function defaultLandingDay(data: SkyData): string {
  const ms = dataStartMs(data) + landingRangeH(data, 0).minH * HOUR_MS
  const day = new Date(ms).toISOString().slice(0, 10)
  return Date.parse(`${day}T00:00:00Z`) < ms ? new Date(ms + 86_400_000 - (ms % 86_400_000)).toISOString().slice(0, 10) : day
}

export interface Window { startH: number; lenH: number }

// Why the window is not where the date picker asked (null = exactly as asked).
export type Clamp = 'invalid' | 'before_range' | 'after_range' | null

export interface WindowPick extends Window { clamped: Clamp }

// Window of `days` days starting at UTC midnight of `isoDate`, kept inside the landing range.
// Never moves the window silently: `clamped` says why it differs from the request.
export function windowFor(data: SkyData, isoDate: string, days: number): WindowPick {
  const lenH = days * 24
  const { minH, maxH } = landingRangeH(data, lenH)
  const raw = (Date.parse(`${isoDate}T00:00:00Z`) - dataStartMs(data)) / HOUR_MS
  if (!Number.isFinite(raw)) return { startH: minH, lenH, clamped: 'invalid' }
  if (raw < minH) return { startH: minH, lenH, clamped: 'before_range' }
  if (raw > maxH) return { startH: maxH, lenH, clamped: 'after_range' }
  return { startH: raw, lenH, clamped: null }
}

// Sample indices [start, end) covering a window, for charts that draw the hourly dots.
export interface Span { start: number; end: number }

export function spanOf(data: SkyData, w: Window): Span {
  const step = data.meta.step_hours
  const start = Math.max(0, Math.floor(w.startH / step))
  return { start, end: Math.min(data.meta.samples, start + Math.round(w.lenH / step) + 1) }
}
