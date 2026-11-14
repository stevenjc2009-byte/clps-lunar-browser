// Sun % for every possible landing day, for one look-ahead length.
// Same rule as siteMetrics (Sun counts as up above 0°), done with a running total so
// the whole two years costs one pass per site.
const round1 = (x: number) => Math.round(x * 10) / 10

export function sunPctByDay(sunAlt: number[], windowLen: number, samplesPerDay: number): number[] {
  const pre = new Int32Array(sunAlt.length + 1)
  for (let i = 0; i < sunAlt.length; i++) pre[i + 1] = pre[i] + (sunAlt[i] > 0 ? 1 : 0)
  const out: number[] = []
  for (let s = 0; s + windowLen <= sunAlt.length; s += samplesPerDay) {
    out.push(round1((100 * (pre[s + windowLen] - pre[s])) / windowLen))
  }
  return out
}
