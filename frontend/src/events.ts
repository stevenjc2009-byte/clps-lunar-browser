// "What happens after landing": is the Sun / Earth up at the landing hour, and
// when does that next change (sunrise/sunset, Earthrise/Earthset)?

export interface NextChange {
  up: boolean           // centre above the flat horizon at the landing hour
  at: number | null     // fractional sample index of the next rise/set, null if none in the data
}

// Searches forward from sample `from` to the end of the data. The crossing time is
// interpolated linearly between the two hourly samples either side of 0°.
export function nextChange(alt: number[], from: number): NextChange {
  const up = alt[from] > 0
  for (let i = from + 1; i < alt.length; i++) {
    const a0 = alt[i - 1], a1 = alt[i]
    if ((a1 > 0) !== up) {
      const frac = a0 === a1 ? 0 : a0 / (a0 - a1)
      return { up, at: i - 1 + Math.min(1, Math.max(0, frac)) }
    }
  }
  return { up, at: null }
}

export function fmtUtc(ms: number) {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'UTC',
  }) + ' UTC'
}

export function fmtWait(hours: number) {
  if (hours < 48) return `${Math.round(hours)} h`
  return `${(hours / 24).toFixed(1)} days`
}
