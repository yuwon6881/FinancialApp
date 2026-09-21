import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { establishSession, mockApi, seedDraftTransaction, waitForStableLayout } from './visualTestSupport'

const routes = [
  '/dashboard',
  '/reports',
  '/recurring',
  '/ledger',
  '/commitments-rewards',
  '/settings',
  '/investments',
  '/vault',
  '/drafts',
] as const

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  await seedDraftTransaction(page)
  await mockApi(page)
})

test('all primary routes have no serious or critical axe violations', async ({ page }) => {
  // Every route is scanned before asserting. Failing inside the loop would report only the
  // first bad route and hide the rest behind it, which turns one red run into many.
  const findings: string[] = []
  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await waitForStableLayout(page)

    const results = await new AxeBuilder({ page }).analyze()
    for (const violation of results.violations) {
      if (violation.impact !== 'serious' && violation.impact !== 'critical') continue
      findings.push(`${route} [${violation.impact}] ${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
    }
  }
  expect(findings, 'blocking accessibility violations').toEqual([])
})

// The allocation chip's out-of-balance state is the one the route sweep above could not be
// trusted to catch: the inputs start empty, so the chip renders "0%" for a moment on every load
// and then settles to "100%". Which of the two the sweep scanned came down to timing, so a
// genuine 4.33:1 on the red branch surfaced on a different viewport project each run and looked
// like flake. Seed allocations that really do not total 100 and scan the chip itself.
test('the out-of-balance allocation chip clears AA in both themes', async ({ page }) => {
  await mockApi(page, {
    setting: { essentialsAlloc: 0.3, growthAlloc: 0.25, stabilityAlloc: 0.15, rewardsAlloc: 0.1 },
  })
  await page.goto('/settings?section=model', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()
  await waitForStableLayout(page)

  // Guards the fixture as much as the colour: an allocation set that quietly totalled 100 would
  // render the blue branch and let the red one go unscanned again.
  await expect(page.getByText('80%', { exact: true })).toBeVisible()

  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  const blocking = results.violations
    .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    .flatMap(violation => violation.nodes.map(node => `${violation.id}: ${node.html}`))
  expect(blocking, 'contrast violations on the financial model tab').toEqual([])
})

test('representative dense pages remain contained at 200 percent text size', async ({ page }) => {
  const overflows: string[] = []
  for (const route of ['/dashboard', '/ledger', '/settings']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await waitForStableLayout(page)
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }))
    if (dimensions.page > dimensions.viewport + 1) {
      overflows.push(`${route} overflows at 200% text size: ${dimensions.page}px in ${dimensions.viewport}px`)
    }
  }
  expect(overflows, 'horizontal overflow at 200% text size').toEqual([])
})
