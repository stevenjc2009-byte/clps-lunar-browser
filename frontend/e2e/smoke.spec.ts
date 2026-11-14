import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const SHARED = '/#d=2027-06-23&w=30&s=im1,im2&g=im2&h=2&m=0&e=centre&dsn=1&del=10'

// Collects every console error and uncaught page error while the page loads.
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  return errors
}

async function loaded(page: Page, url = '/') {
  await page.goto(url)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('[data-testid=compare] .compare-card').first()).toBeVisible({ timeout: 30_000 })
}

test('page loads with no console or page errors', async ({ page }) => {
  const errors = watchErrors(page)
  await loaded(page)
  await page.waitForLoadState('networkidle')
  expect(errors).toEqual([])
})

test('compare cards render with numeric percentages', async ({ page }) => {
  await loaded(page)
  const cards = page.locator('[data-testid=compare] .compare-card')
  expect(await cards.count()).toBeGreaterThanOrEqual(2)
  const pcts = await cards.locator('dd.sun, dd.earth').allTextContents()
  expect(pcts.length).toBeGreaterThanOrEqual(4)
  for (const t of pcts) expect(t).toMatch(/^\s*\d+(\.\d+)?%/)
})

test('main sections exist', async ({ page }) => {
  await loaded(page)
  for (const name of ['Dates', 'Model settings', 'Compare sites', 'Best landing dates', 'Compare two landing dates', 'Sky graph']) {
    await expect(page.locator(`section[aria-label="${name}"]`)).toHaveCount(1)
  }
  await expect(page.locator('details.method')).toHaveCount(1)
})

test('a shared URL restores the date and the look-ahead window', async ({ page }) => {
  await loaded(page, SHARED)
  await expect(page.locator('input[type=date]').first()).toHaveValue('2027-06-23')
  await expect(page.locator('section[aria-label="Dates"]').getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
})

test('arrow keys move between site tabs', async ({ page }) => {
  await loaded(page)
  const selected = page.locator('.site-tabs [role=tab][aria-selected=true]')
  const before = await selected.getAttribute('data-site')
  await selected.focus()
  await page.keyboard.press('ArrowRight')
  await expect(selected).not.toHaveAttribute('data-site', before ?? '')
})

test('no critical or serious accessibility violations', async ({ page }) => {
  await loaded(page)
  await page.waitForLoadState('networkidle')
  const { violations } = await new AxeBuilder({ page }).analyze()
  const bad = violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
  const summary = bad.map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).slice(0, 6).join(' | ')}`)
  expect(summary).toEqual([])
})
