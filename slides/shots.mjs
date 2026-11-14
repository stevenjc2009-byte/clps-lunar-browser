// Screenshots of the live site for the slides (the slides show only our own page).
//   node shots.mjs [url]   -> img/*.png
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const URL_ = process.argv[2] ?? 'https://stevenjc2009-byte.github.io/clps-lunar-browser/'
const IMG = new URL('./img/', import.meta.url)
mkdirSync(IMG, { recursive: true })
const out = name => new URL(name, IMG).pathname.replace(/^\/(\w:)/, '$1').replace(/%20/g, ' ')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' })
await page.goto(URL_, { waitUntil: 'networkidle' })
await page.waitForSelector('.compare-card')
await page.waitForSelector('.sky-chart .main-svg')
await page.waitForTimeout(800)

// The sky graph panel (Shackleton rim, default 1-year window)
await page.locator('section.panel', { has: page.locator('.sky-chart') }).screenshot({ path: out('sky.png') })
// The three comparison cards
await page.locator('.compare-grid').screenshot({ path: out('compare.png') })
// After adding a custom location: four cards
await page.click('.custom-go')
await page.waitForSelector('.compare-card:nth-child(4)')
await page.waitForTimeout(400)
await page.locator('form.custom').screenshot({ path: out('custom-form.png') })
await page.locator('.compare-grid').screenshot({ path: out('compare4.png') })

// The favicon, large, for the title slide
const svg = readFileSync(new URL('../frontend/public/favicon.svg', import.meta.url), 'utf8')
const icon = await browser.newPage({ viewport: { width: 512, height: 512 } })
await icon.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg', '<svg width="512" height="512"')}</body>`)
await icon.locator('svg').screenshot({ path: out('icon.png'), omitBackground: true })
await browser.close()
console.log('shots done')
