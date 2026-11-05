import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

const history = {
  currency: 'USD',
  lifetime: {
  firstMonth: '2024-01-31', asOf: '2026-09-30',
  netContributions: 36000, value: 42850.5, growth: 6850.5,
  cumulativeReturnPercent: 17.9, annualisedReturnPercent: 6.2, isComplete: true,
  segments: [
      { segment: 'USEquity', netContributions: 24000, closingValue: 29400, growth: 5400, returnPercent: 21.3, isComplete: true },
      { segment: 'Bonds', netContributions: 12000, closingValue: 13450.5, growth: 1450.5, returnPercent: 11.4, isComplete: true },
  ],
  },
  years: [
    { year: 2026, periodEnd: '2026-09-30', isFullYear: false, openingValue: 27000, closingValue: 42850.5, netContributions: 12000, dividends: 310, realisedProfitLoss: 0, growth: 3850.5, returnPercent: 9.8, isComplete: true, missingReasons: [],
      segments: [{ segment: 'USEquity', netContributions: 8000, closingValue: 29400, growth: 3100, returnPercent: 12.1, isComplete: true }] },
    { year: 2025, periodEnd: '2025-12-31', isFullYear: true, openingValue: 12500, closingValue: 27000, netContributions: 12000, dividends: 220, realisedProfitLoss: -45.2, growth: 2500, returnPercent: 12.4, isComplete: true, missingReasons: [], segments: [] },
    { year: 2024, periodEnd: '2024-12-31', isFullYear: true, openingValue: 0, closingValue: 12500, netContributions: 12000, dividends: 80, realisedProfitLoss: 0, growth: 500, returnPercent: -3.6, isComplete: true, missingReasons: [], segments: [] },
  ],
  months: [],
}

const portfolio = {
  instruments: [
    { id: 'vti', symbol: 'VTI', name: 'US market', type: 'ETF', currency: 'USD', allocationSleeve: 'USEquity', isCustom: false, isArchived: false },
  ],
}

// Runs once per configured project, so compact, medium and expanded, light and dark, all apply.
test('year-by-year history reads and opens from anywhere on a year row', async ({ page }) => {
  await mockApi(page, { investmentPortfolio: portfolio, investmentHistory: history })
  await establishSession(page)
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  // History is its own view: the tab sits under the summary, ahead of every panel.
  const historyTab = page.getByRole('tab', { name: 'History' })
  await historyTab.click()
  await expect(historyTab).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('region', { name: 'Year by year' })
  await panel.scrollIntoViewIfNeeded()
  await expect(panel.getByText('up to the end of Sep 2026', { exact: false })).toBeVisible()
  await expect(panel.getByText('+6.2%')).toBeVisible()
  await expect(panel.getByText('Jan–Sep 2026')).toBeVisible()

  // The whole row is the target: a click anywhere on it, not only the label, opens the year.
  const year = panel.locator('details').filter({ has: page.locator('summary', { hasText: '2025' }) })
  const row = year.locator('summary')
  const box = await row.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  await row.click({ position: { x: box!.width - 8, y: box!.height / 2 } })
  await expect(year.getByText('Gain or loss on sales')).toBeVisible()
  await expect(year.getByText('Started at')).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'By market, since the start' })).toBeVisible()
  await expect(panel.getByText('US shares').last()).toBeVisible()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
