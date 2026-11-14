// Records the silent 30-second demo of the live site, headless, at 1920x1080 (page 1920x900 + caption band).
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
    z.textContent = '#root{zoom:1.5}' // zoom the app only, so the pointer below keeps real pixels
    document.head.appendChild(z)
    const c = document.createElement('div')
    c.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;' +
      'background:rgba(255,255,255,.85);border:2px solid #0c1222;box-shadow:0 0 0 3px rgba(77,163,255,.6);' +
      'pointer-events:none;z-index:99999;transition:transform .12s'
    document.body.appendChild(c)
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' })
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
await page.mouse.move(900, 300)
await page.waitForTimeout(600) // let fonts and the chart settle
const t0 = Date.now()
writeFileSync(new URL('t0.txt', OUT), String((t0 - tStart) / 1000))

const at = async ms => { const wait = t0 + ms - Date.now(); if (wait > 0) await page.waitForTimeout(wait) }
const scrollTo = (sel, block = 'start') =>
  page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: b }), [sel, block])
async function moveTo(sel, steps = 25) {
  for (let last = -1, y = await page.evaluate(() => scrollY); y !== last; ) {
    last = y; await page.waitForTimeout(80); y = await page.evaluate(() => scrollY)
  }
  const box = await page.locator(sel).first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
}

// 0-3 s: title. 3-9 s: sky graph with the real terrain skyline
await at(3000)
await scrollTo('section[aria-label="Sky graph"] .sky-chart', 'center')
await at(5000)
await page.mouse.move(700, 420, { steps: 40 })
await at(7500)
await page.mouse.move(1100, 500, { steps: 40 })

// 9-15.5 s: seven sites compared
await at(9000)
await scrollTo('.compare-grid', 'start')
await at(12500)
await moveTo('.compare-card:nth-child(2) .verdict', 40)

// 15.5-19.5 s: the honest "too close to call" notes
await at(15500)
await scrollTo('.caveats', 'center')
await at(17000)
await moveTo('.caveats .close-call', 25)

// 19.5-25 s: best landing dates heatmap, click a day
await at(19500)
await scrollTo('section[aria-label="Best landing dates"]', 'start')
await at(22000)
await moveTo('.hm-use >> nth=1', 30)
await at(23800)
await page.click('.hm-use >> nth=1')

// 25-27.5 s: model settings
await at(25000)
await scrollTo('section[aria-label="Model settings"]', 'start')
await at(26200)
await moveTo('.preset select, .preset', 30)

// 27.5-29.5 s: shareable link
await at(27500)
await scrollTo('.copy-btn', 'center')
await at(28300)
await moveTo('.copy-btn', 20)
await page.click('.copy-btn')
await at(30200) // a little spare; render.sh cuts at exactly 29.5 s

await page.close()
await context.close()
await browser.close()
const webm = readdirSync(OUT).find(f => f.endsWith('.webm'))
renameSync(new URL(webm, OUT), new URL('raw.webm', OUT))
console.log(`recorded out/raw.webm, trim ${(t0 - tStart) / 1000} s`)
