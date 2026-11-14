import { nextChange } from './lib/events'
import { fmtUtcHour, fmtWait } from './lib/format'
import type { Intervals } from './lib/intervals'

// Where the landing sits on the data time axis (hours from the first sample).
export interface Landing { startH: number; t0Ms: number; endH: number }

// "Sun up at landing, sets in 31 h (16 Dec 2027, about 14:00 UTC)". Read off the same visible
// intervals as the cards; times are given to the hour only (see EXPLAIN.next).
export default function AfterLanding({ ivs, body, cls, landing }: { ivs: Intervals; body: string; cls: 'sun' | 'earth'; landing: Landing }) {
  const { up, atH } = nextChange(ivs, landing.startH, landing.endH)
  const isLink = body === 'Link'
  const verb = up ? (isLink ? 'drops' : 'sets') : (isLink ? 'returns' : 'rises')
  const state = up ? (isLink ? 'available' : 'up') : (isLink ? 'unavailable' : 'down')
  if (atH === null) {
    return <li><b className={cls}>{body}</b> {state} at landing, never {verb} before the data ends</li>
  }
  const ms = landing.t0Ms + atH * 3_600_000
  return <li><b className={cls}>{body}</b> {state} at landing, {verb} in {fmtWait(atH - landing.startH)} <span className="when">({fmtUtcHour(ms)})</span></li>
}
