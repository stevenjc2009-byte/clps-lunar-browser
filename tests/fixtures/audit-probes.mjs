// Phase-0 audit probes: run `node tests/fixtures/audit-probes.mjs`. Uses the REAL frontend code on sky.json.
// Brute-force checks use an independent night list (maximal runs of Sun centre <= 0 over the whole data).
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const M = await import(pathToFileURL(path.join(root, 'frontend/src/metrics.ts')).href)
const E = await import(pathToFileURL(path.join(root, 'frontend/src/events.ts')).href)
const sky = JSON.parse(readFileSync(path.join(root, 'frontend/public/sky.json'), 'utf8'))
const N = sky.meta.samples

// 1. Brute-force longest night per window vs siteMetrics (documented rule: counts from window start, follows past the end).
for (const days of [30, 365]) {
  for (const site of sky.sites) {
    const len = days * 24
    let mism = 0, leftCensored = 0, windows = 0, cutWins = 0
    for (let s = 0; s + len <= N; s += 24) {
      windows++
      const m = M.siteMetrics(site, { start: s, end: s + len }, 1)
      // brute: nights as [a,b) over whole data
      let best = 0, bestCut = false
      for (let i = 0; i < N;) {
        if (site.sun_alt[i] > 0) { i++; continue }
        let j = i; while (j < N && site.sun_alt[j] <= 0) j++
        const a = Math.max(i, s)
        if (a < s + len) { const L = j - a; if (L > best) { best = L; bestCut = j >= N } }
        i = j
      }
      if (best !== m.longestDarkHours) mism++
      if (site.sun_alt[s] <= 0) leftCensored++
      if (m.darkCut) cutWins++
    }
    console.log(`brute ${days}d ${site.id}: windows ${windows}, longest-dark mismatches ${mism}, windows starting inside a night ${leftCensored}, darkCut windows ${cutWins}`)
  }
}

// 2. Sampling consequence: sampled night length vs linear-interpolated crossing length.
for (const site of sky.sites) {
  const d = []
  const a = site.sun_alt
  const cross = i => a[i - 1] / (a[i - 1] - a[i]) + (i - 1)
  let lastRise = null
  for (let i = 1; i < N; i++) {
    const down = a[i] <= 0, was = a[i - 1] <= 0
    if (!was && down) lastRise = cross(i)              // sunset
    if (was && !down && lastRise !== null) {           // sunrise
      const interp = cross(i) - lastRise, sampled = (() => { let k = i - 1, n = 0; while (k >= 0 && a[k] <= 0) { n++; k-- } return n })()
      d.push(sampled - interp); lastRise = null
    }
  }
  d.sort((x, y) => x - y)
  const abs = d.map(Math.abs)
  console.log(`sampling ${site.id}: ${d.length} nights, sampled-minus-interpolated hours min ${d[0].toFixed(2)} median ${d[d.length >> 1].toFixed(2)} max ${d[d.length - 1].toFixed(2)}, max|diff| ${Math.max(...abs).toFixed(2)}`)
  // altitude rate at crossings
  const rates = []
  for (let i = 1; i < N; i++) if ((a[i] > 0) !== (a[i - 1] > 0)) rates.push(Math.abs(a[i] - a[i - 1]))
  rates.sort((x, y) => x - y)
  console.log(`  |d alt| per hour at crossings: median ${rates[rates.length >> 1].toFixed(3)} deg, max ${rates[rates.length - 1].toFixed(3)} deg (${rates.length} crossings)`)
}

// 3. Percent quantisation
for (const days of [30, 365]) console.log(`percent step for ${days} d = ${(100 / (days * 24)).toFixed(4)} points`)

// 4. Window clamping: out-of-range dates move silently
for (const [d, n] of [['2030-01-01', 30], ['2020-01-01', 30], ['not-a-date', 30], ['2028-06-01', 365]]) {
  const sp = M.spanFor(sky, d, n)
  console.log(`spanFor(${d}, ${n}) -> start ${sp.start} = ${M.isoDay(Date.parse(sky.meta.start_utc) + sp.start * 3600000)}`)
}

// 5. "Balanced" is relative, not absolute
const fake = [
  { id: 'a', m: { sunPct: 10, earthPct: 90, darkCut: false, longestDarkHours: 600 } },
  { id: 'b', m: { sunPct: 11, earthPct: 12, darkCut: false, longestDarkHours: 600 } },
  { id: 'c', m: { sunPct: 30, earthPct: 14, darkCut: false, longestDarkHours: 600 } },
]
console.log('verdicts synthetic (b has 11% Sun, 12% Earth):', JSON.stringify(M.verdicts(fake)))

// 6. nextChange vs hourly: sunrise/sunset times are interpolated, but 'up' uses the sampled hour
console.log('nextChange(shackleton sun, 0):', JSON.stringify(E.nextChange(sky.sites[0].sun_alt, 0)))
