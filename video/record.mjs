// Records the 30-second demo (voiceover added by render.sh) of the live site, headless, at 1920x1080 (page 1920x900 + caption band).
// Every action is pinned to a time (ms after the page is ready) so it lines up
// with captions.srt. Output: out/raw.webm and out/t0.txt (seconds to trim off
// the start, while the page was still loading). render.sh does the rest.
//
//   node record.mjs [url]
import { chromium } from 'playwright'
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const URL_ = process.argv[2] ?? 'http://localhost:5197/#d=2026-11-15&w=365&s=shackleton-rim,connecting-ridge,peak-near-shackleton,im2,im1&g=shackleton-rim'
const OUT = new URL('./out/', import.meta.url)
mkdirSync(OUT, { recursive: true })
// Empty it rather than delete it: deleting fails if a shell has it open, and a
// stale raw.webm left behind would quietly be rendered again.
for (const f of readdirSync(OUT)) rmSync(new URL(f, OUT), { recursive: true, force: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  // A 1920-wide page with the app zoomed 1.5x: laid out like a 1280-px-wide
  // screen but drawn at full 1080p sharpness. (deviceScaleFactor does not reach
  // the video: the recording only filled the top-left 1280x720.)
  viewport: { width: 1920, height: 900 }, // render.sh adds a 180-px caption band below
  colorScheme: 'dark',
  recordVideo: { dir: fileURLToPath(OUT), size: { width: 1920, height: 900 } },
})

// Headless Chromium draws no mouse pointer, so draw one that follows the mouse.
await context.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const z = document.createElement('style')
    z.textContent = '#root{zoom:1.5}.demo-hl{outline:3px solid #ffd54a!important;outline-offset:4px;border-radius:8px;transition:outline-color .2s}' // zoom the app only, so the pointer below keeps real pixels
    document.head.appendChild(z)
    const c = document.createElement('div')
    c.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;' +
      'background:rgba(255,255,255,.85);border:2px solid #0c1222;box-shadow:0 0 0 3px rgba(77,163,255,.6);' +
      'pointer-events:none;z-index:99999;transition:transform .12s'
    document.body.appendChild(c)
    // Plotly's hover ignores the CSS zoom, so for the Sun tooltip the real mouse sits at Plotly's
    // unzoomed spot while this pointer is parked on the dot itself (__ptr); the next real move frees it.
    // The heatmap has the same blind spot, so there __map draws the pointer at x0 + (mouse - x0) * k.
    let parked = false, map = null
    window.__ptr = (x, y) => { parked = true; c.style.transition = 'transform .12s,left .5s,top .5s'; c.style.left = x + 'px'; c.style.top = y + 'px' }
    window.__map = (x0, y0, k) => { map = { x0, y0, k }; c.style.transition = 'transform .12s,left .15s,top .15s' }
    window.__unpark = () => { parked = false; map = null; c.style.transition = 'transform .12s' }
    addEventListener('mousemove', e => {
      if (parked) return
      const x = map ? map.x0 + (e.clientX - map.x0) * map.k : e.clientX, y = map ? map.y0 + (e.clientY - map.y0) * map.k : e.clientY
      c.style.left = x + 'px'; c.style.top = y + 'px'
    })
    addEventListener('mousedown', () => { c.style.transform = 'scale(.7)' })
    addEventListener('mouseup', () => { c.style.transform = '' })
  })
})

const page = await context.newPage()
page.on('pageerror', e => console.log('pageerror', e.message))
const tStart = Date.now()
await page.goto(URL_, { waitUntil: 'networkidle' })
await page.waitForSelector('.compare-card')
await page.waitForSelector('.sky-chart .main-svg')
// Compare all seven sites (before the clock starts).
for (const n of ['Nobile Rim 2', 'de Gerlache Rim 2']) await page.locator('.site-picks label', { hasText: n }).locator('input').check()
await page.waitForFunction(() => document.querySelectorAll('.compare-card').length === 7)
await page.waitForTimeout(1500)
await page.evaluate(() => scrollTo(0, 0))  // scene 1 starts at the top of the page
await page.mouse.move(900, 300)
await page.waitForTimeout(600) // let fonts and the chart settle
const t0 = Date.now()
writeFileSync(new URL('t0.txt', OUT), String((t0 - tStart) / 1000))

const at = async ms => { const wait = t0 + ms - Date.now(); if (wait > 0) await page.waitForTimeout(wait) }
const scrollTo = (sel, block = 'start') =>
  page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: b }), [sel, block])
async function settle() {  // wait for a smooth scroll to finish
  for (let last = -1, y = await page.evaluate(() => scrollY); y !== last; ) {
    last = y; await page.waitForTimeout(80); y = await page.evaluate(() => scrollY)
  }
}
async function moveTo(sel, steps = 25) {
  await settle()
  const box = await page.locator(sel).first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
}

// Highlight ring for the part the voice is talking about.
const hl = sel => page.evaluate(s => {
  document.querySelectorAll('.demo-hl').forEach(e => e.classList.remove('demo-hl'))
  if (s) document.querySelector(s)?.classList.add('demo-hl')
}, sel)

// Sky graph geometry: plot box in screen pixels plus the terrain skyline and Sun dots in data units.
async function skyPoints() {
  await settle()
  // The plot area's own client rect (checked under the 1.5x zoom: it matches Plotly's margins x 1.5;
  // Playwright's boundingBox and the chart div's width did not).
  const d = await page.evaluate(() => {
    const gd = document.querySelector('.sky-chart'), fl = gd._fullLayout
    const b = gd.querySelector('.nsewdrag').getBoundingClientRect()
    const t = gd.data.find(x => x.name === 'Terrain skyline'), sun = gd.data.find(x => x.name === 'Sun')
    return { pw: fl._size.w, xr: fl.xaxis.range, yr: fl.yaxis.range, b: { x: b.x, y: b.y, w: b.width, h: b.height }, tx: t.x, ty: t.y, sx: sun.x, sy: sun.y }
  })
  const px = (x, y) => ({ x: d.b.x + (x - d.xr[0]) / (d.xr[1] - d.xr[0]) * d.b.w,
                          y: d.b.y + (d.yr[1] - y) / (d.yr[1] - d.yr[0]) * d.b.h })
  const sky = x => { let best = 0, bd = 1e9; d.tx.forEach((v, i) => { const dd = Math.abs(v - x); if (dd < bd) { bd = dd; best = i } }); return d.ty[best] }
  const trace = []
  for (let x = -170; x <= 170; x += 20) trace.push(px(x, sky(x)))
  // A Sun dot just above the skyline, near the middle of the graph.
  let pick = null
  for (let i = 0; i < d.sx.length; i++) {
    const x = d.sx[i], y = d.sy[i], h = y - sky(x)
    if (Math.abs(x) < 120 && h > 0.2 && h < 0.8 && (!pick || Math.abs(x) < Math.abs(pick.x))) pick = { x, y }
  }
  const sun = pick ? px(pick.x, pick.y) : px(0, 2), k = d.b.w / d.pw  // k = 1.5, the zoom
  return { trace, sun, hover: { x: d.b.x + (sun.x - d.b.x) / k, y: d.b.y + (sun.y - d.b.y) / k } }
}

// Scene 1, 0-6 s: the question (top of the page).
await at(1200)
await page.mouse.move(700, 250, { steps: 40 })

// Scene 2, 6-14.6 s: one site's sky; the grey terrain skyline; the Sun going behind it.
await at(5600)
await scrollTo('section[aria-label="Sky graph"] .sky-chart', 'center')
await at(6600)
await hl('.sky-chart')
const sp = await skyPoints()
await page.mouse.move(sp.trace[0].x, sp.trace[0].y - 30, { steps: 30 })
await at(8500)
await hl(null)
for (let i = 0; i < sp.trace.length; i++) {               // pointer runs along the skyline, 8.6-11.1 s
  await at(8600 + i * 2500 / sp.trace.length)
  await page.mouse.move(sp.trace[i].x, sp.trace[i].y - 4, { steps: 6 })
}
await at(11300)
await page.evaluate(([x, y]) => window.__ptr(x, y), [sp.sun.x, sp.sun.y])  // pointer glides onto a Sun dot
await page.mouse.move(sp.hover.x, sp.hover.y, { steps: 4 })                  // ...and its tooltip shows
await page.waitForTimeout(400)
console.log('sky', JSON.stringify(sp.trace[0]), JSON.stringify(sp.sun), 'tooltip:', await page.evaluate(() => document.querySelector('.sky-chart .hoverlayer')?.textContent ?? 'none'))

// Scene 3, 14.6-20.6 s: the score card, row by row.
await at(14500)
await page.evaluate(() => window.__unpark())
await page.mouse.move(960, 120, { steps: 10 })
await scrollTo('.compare-grid', 'start')
await at(15000)
await hl('.compare-card:nth-child(2)')
await at(16100)
await hl('.compare-card:nth-child(2) dl > div:nth-child(1)'); await moveTo('.compare-card:nth-child(2) dl > div:nth-child(1)', 25)
await at(17100)
await hl('.compare-card:nth-child(2) dl > div:nth-child(2)'); await moveTo('.compare-card:nth-child(2) dl > div:nth-child(2)', 25)
await at(18400)
await hl('.compare-card:nth-child(2) dl > div:nth-child(3)'); await moveTo('.compare-card:nth-child(2) dl > div:nth-child(3)', 25)

// Scene 4, 20.6-26 s: the heatmap; click a day; the cards update.
await at(20400)
await hl(null)
await scrollTo('section[aria-label="Best landing dates"]', 'start')
await at(21000)
await hl('.hm-scroll')
{
  await page.waitForTimeout(150)
  const c = await page.locator('.hm-scroll canvas').first().boundingBox()
  const r = await page.locator('.hm-labels .hm-name').nth(1).boundingBox()  // second row: Shackleton rim
  // The canvas reads the mouse without the 1.5x zoom: aim the real mouse at the unzoomed spot,
  // and __map draws the pointer on the cell that is actually hit.
  const k = 1.5, real = (vx, vy) => [c.x + (vx - c.x) / k, c.y + (vy - c.y) / k]
  const rowY = r.y + r.height / 2
  await page.evaluate(([x0, y0, kk]) => window.__map(x0, y0, kk), [c.x, c.y, k])
  await page.mouse.move(...real(c.x + c.width * 0.05, rowY), { steps: 15 })
  await page.mouse.move(...real(c.x + c.width * 0.45, rowY), { steps: 60 })  // sweep along the year
  await at(23400)
  await hl(null)
  await page.mouse.click(...real(c.x + c.width * 0.45, rowY))
  console.log('heatmap readout:', await page.evaluate(() => document.querySelector('.heatmap')?.innerText.split(String.fromCharCode(10)).find(l => l.includes(': Sun')) ?? 'none'))
  await page.evaluate(() => window.__unpark())
}
await at(24300)
await scrollTo('.compare-grid', 'start')
await at(24900)
await hl('.compare-card:nth-child(2) dl')

// Scene 5, 26-29.5 s: too close to call.
await at(25900)
await hl(null)
await scrollTo('.caveats', 'center')
await at(26500)
await hl('.caveats .close-call')
await moveTo('.caveats .close-call', 25)
await at(30200) // a little spare; render.sh cuts at exactly 29.5 s

await page.close()
await context.close()
await browser.close()
const webm = readdirSync(OUT).find(f => f.endsWith('.webm'))
renameSync(new URL(webm, OUT), new URL('raw.webm', OUT))
console.log(`recorded out/raw.webm, trim ${(t0 - tStart) / 1000} s`)
