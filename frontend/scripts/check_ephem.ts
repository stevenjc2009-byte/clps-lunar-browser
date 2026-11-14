// Checks the in-browser vector method (src/ephem.ts) against Skyfield's sky.json.
// Run: node frontend/scripts/check_ephem.ts   (exit 1 if they disagree)
// Env CHECK_EPHEM_LON_SHIFT=<deg> shifts every site's longitude (to prove the check can fail).
import { readFileSync } from 'node:fs'
import { computeSite, parseVectors } from '../src/ephem.ts'
import type { VectorHeader } from '../src/ephem.ts'
import type { SkyData } from '../src/types.ts'

const MAX_ALT_ERR = 0.02 // deg
const MAX_VISIBILITY_DIFF = 2 // hours per site

const pub = new URL('../public/', import.meta.url)
const header: VectorHeader = JSON.parse(readFileSync(new URL('vectors.json', pub), 'utf8'))
const bin = readFileSync(new URL('vectors.bin', pub))
const vectors = parseVectors(header, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
const sky: SkyData = JSON.parse(readFileSync(new URL('sky.json', pub), 'utf8'))
const lonShift = Number(process.env.CHECK_EPHEM_LON_SHIFT ?? 0)

const maxAbs = (a: number[], b: number[], wrap360 = false) =>
  a.reduce((m, v, i) => {
    let d = Math.abs(v - b[i])
    if (wrap360 && d > 180) d = 360 - d
    return Math.max(m, d)
  }, 0)

const visDiff = (a: number[], b: number[]) => a.filter((v, i) => v > 0 !== b[i] > 0).length

let failed = false
for (const ref of sky.sites) {
  const got = computeSite(vectors, ref.lat, ref.lon + lonShift)
  const rows = {
    sun: [maxAbs(got.sun_alt, ref.sun_alt), maxAbs(got.sun_az, ref.sun_az, true), visDiff(got.sun_alt, ref.sun_alt)],
    earth: [maxAbs(got.earth_alt, ref.earth_alt), maxAbs(got.earth_az, ref.earth_az, true), visDiff(got.earth_alt, ref.earth_alt)],
  }
  console.log(`${ref.id} (${ref.lat}, ${ref.lon + lonShift})`)
  for (const [body, [dAlt, dAz, vis]] of Object.entries(rows)) {
    console.log(`  ${body.padEnd(5)} max|dalt| ${dAlt.toFixed(4)}  max|daz| ${dAz.toFixed(3)}  visibility hours differing ${vis}`)
    if (dAlt > MAX_ALT_ERR) failed = true
    if (vis > MAX_VISIBILITY_DIFF) failed = true
  }
}
console.log(failed ? 'FAIL' : 'OK')
process.exit(failed ? 1 : 0)
