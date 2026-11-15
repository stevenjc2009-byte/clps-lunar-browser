// Screenshots of the live site for the slides (the slides show only our own page).
//   node shots.mjs [url]   -> img/*.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL_ = process.argv[2] ?? 'http://localhost:5197/#d=2026-11-15&w=365&s=shackleton-rim,connecting-ridge,peak-near-shackleton,im2,im1&g=shackleton-rim'
const IMG = new URL('./img/', import.meta.url)
mkdirSync(IMG, { recursive: true })
const out = name => new URL(name, IMG).pathname.replace(/^\/(\w:)/, '$1').replace(/%20/g, ' ')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' })
await page.goto(URL_, { waitUntil: 'networkidle' })
await page.waitForSelector('.compare-card')
await page.waitForSelector('.sky-chart .main-svg')
// All seven sites
for (const n of ['Nobile Rim 2', 'de Gerlache Rim 2']) await page.locator('.site-picks label', { hasText: n }).locator('input').check()
await page.waitForFunction(() => document.querySelectorAll('.compare-card').length === 7)
await page.waitForTimeout(1500)
const panel = label => page.locator(`section.panel[aria-label="${label}"]`)

// Sky graph with the NASA LOLA terrain skyline (Shackleton rim, 1 year)
await page.locator('.sky-chart').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await panel('Sky graph').screenshot({ path: out('sky.png') })
await page.locator('.sky-chart').screenshot({ path: out('sky-plot.png') })
// Comparison cards: first row of four, and the note boxes above them
const grid = await page.locator('.compare-grid').boundingBox()
const card = await page.locator('.compare-card').first().boundingBox()
await page.screenshot({ path: out('compare.png'), fullPage: true, clip: { x: grid.x, y: grid.y + await page.evaluate(() => scrollY), width: grid.width, height: card.height } })
await page.locator('.caveats').screenshot({ path: out('caveats.png') })
// Sun by landing date, and best landing dates heatmap
await panel('Sunlight by landing date').screenshot({ path: out('landing.png') })
await page.locator('.hm-use').first().waitFor()
await panel('Best landing dates').screenshot({ path: out('heatmap.png') })
await panel('Model settings').screenshot({ path: out('settings.png') })

await browser.close()
console.log('shots done')
