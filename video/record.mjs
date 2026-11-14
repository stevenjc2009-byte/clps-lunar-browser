// Records the silent 30-second demo of the live site, headless, at 1920x1080 (page 1920x900 + caption band).
// Every action is pinned to a time (ms after the page is ready) so it lines up
// with captions.srt. Output: out/raw.webm and out/t0.txt (seconds to trim off
// the start, while the page was still loading). render.sh does the rest.
//
//   node record.mjs [url]
import { chromium } from 'playwright'
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const URL_ = process.argv[2] ?? 'https://stevenjc2009-byte.github.io/clps-lunar-browser/'
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
await page.mouse.move(900, 300)
await page.waitForTimeout(600) // let fonts and the chart settle
const t0 = Date.now()
writeFileSync(new URL('t0.txt', OUT), String((t0 - tStart) / 1000))

const at = async ms => { const wait = t0 + ms - Date.now(); if (wait > 0) await page.waitForTimeout(wait) }
const scrollTo = (sel, block = 'start') =>
  page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: b }), [sel, block])
async function moveTo(sel, steps = 25) {
  const box = await page.locator(sel).first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
}

// 0-3 s: title (caption 1). 3-8 s: the sky graph (caption 2)
await at(3000)
await scrollTo('.sky-chart', 'center')
await at(4600)
await page.mouse.move(700, 420, { steps: 40 })

// 8-11 s: back up to the comparison (caption 3)
await at(8000)
await scrollTo('.controls')

// 11-18 s: change the date and look-ahead, cards update (caption 4)
await at(9800)
await moveTo('input[type=date]')
await at(11300)
await page.locator('input[type=date]').fill('2027-06-10')
await at(13000)
await moveTo('.seg button:first-child') // "30 days" (1 year is the default)
await at(14000)
await page.click('.seg button:first-child')
await at(15500)
await scrollTo('.compare-grid', 'center')
await at(16500)
await moveTo('.compare-card .verdict')

// 18-22 s: after-landing lines (caption 5)
await at(18000)
await page.addStyleTag({ content: '.compare-card .after{outline:2px solid #ffb627;outline-offset:4px;border-radius:6px;transition:outline-color .3s}' })
await at(18800)
await moveTo('.compare-card .after')

// 22-26 s: add your own location (caption 6)
await at(21800)
await page.addStyleTag({ content: '.compare-card .after{outline-color:transparent}' })
await scrollTo('form.custom', 'center')
await at(22800)
await moveTo('.custom-go')
await at(23600)
await page.click('.custom-go')
await page.waitForSelector('.compare-card:nth-child(4)')
await scrollTo('.compare-grid', 'center')

// 26-29.5 s: Explain it to me (caption 7)
await at(26000)
await scrollTo('header')
await at(26700)
await moveTo('.explain-all', 15)
await page.click('.explain-all')
await at(27400)
await scrollTo('.compare-grid', 'start')
await at(30200) // a little spare; render.sh cuts at exactly 29.5 s

await page.close()
await context.close()
await browser.close()
const webm = readdirSync(OUT).find(f => f.endsWith('.webm'))
renameSync(new URL(webm, OUT), new URL('raw.webm', OUT))
console.log(`recorded out/raw.webm, trim ${(t0 - tStart) / 1000} s`)
