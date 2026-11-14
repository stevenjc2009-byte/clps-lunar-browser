// Text formatting shared by the cards, the verdict sentences and the after-landing lines.

// Under two days: whole hours; otherwise days to 0.1 day (2.4 h). No finer: a 0.1° change
// in the horizon can move a polar sunrise by hours (docs/decisions/engine.md, B5).
export function fmtDuration(hours: number) {
  if (Math.round(hours) < 48) return `${Math.round(hours)} h`
  return `${(hours / 24).toFixed(1)} days`
}

// Waiting times: whole hours under two days, else days.
export function fmtWait(hours: number) {
  if (hours < 48) return `${Math.round(hours)} h`
  return `${(hours / 24).toFixed(1)} days`
}

export function fmtUtc(ms: number) {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'UTC',
  }) + ' UTC'
}

// To the nearest hour, said as "about": rise/set times near the pole move by hours with a
// fraction of a degree of horizon, so minutes would be false precision (audit B5).
export function fmtUtcHour(ms: number) {
  const h = Math.round(ms / 3_600_000) * 3_600_000
  const d = new Date(h)
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${day}, about ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC`
}

export function isoDay(ms: number) { return new Date(ms).toISOString().slice(0, 10) }

// "a", "a and b", "a, b and c"
export function listAnd(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? '')
}
