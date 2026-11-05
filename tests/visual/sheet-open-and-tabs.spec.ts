import { expect, test, type Page } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

// Many investments and one account, so the Manage portfolio sheet is much taller on one tab.
const instruments = Array.from({ length: 14 }, (_, index) => ({
  id: `i${index}`, symbol: `SYM${index}`, name: `Fund ${index}`, type: 'ETF', currency: 'USD',
  allocationSleeve: 'USEquity', isCustom: false, isArchived: false,
}))
const portfolio = {
  accounts: [{ id: 'a1', name: 'Broker', baseCurrency: 'USD', isArchived: false }],
  instruments,
  // A known value, which the forecast needs before it offers to open.
  summary: {
    growthLedgerBalance: 0, netDeposits: 20000, marketValue: 25000, costBasis: 20000,
    unrealisedProfitLoss: 5000, unrealisedPercent: 25, realisedProfitLoss: 0, netDividends: 0,
    dailyChange: 0, cashValue: 0, totalValue: 25000,
  },
}

async function openInvestments(page: Page) {
  await mockApi(page, { investmentPortfolio: portfolio })
  await establishSession(page)
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
}

/**
 * Clicks an option and samples the sliding marker against its own row on every frame of the
 * slide, returning how far it moved vertically. A marker that follows the row stays put.
 */
async function verticalDriftWhileSelecting(page: Page, rowSelector: string, option: ReturnType<Page['getByRole']>) {
  const sampling = page.evaluate(selector => new Promise<number>(resolve => {
    const row = document.querySelector(selector)!
    const offsets: number[] = []
    const started = performance.now()
    const frame = () => {
      const marker = row.querySelector('[data-sliding-marker]')
      if (marker) offsets.push(marker.getBoundingClientRect().top - row.getBoundingClientRect().top)
      if (performance.now() - started < 700) requestAnimationFrame(frame)
      else resolve(offsets.length ? Math.max(...offsets) - Math.min(...offsets) : Number.NaN)
    }
    requestAnimationFrame(frame)
  }), rowSelector)
  await option.click()
  return sampling
}

// Runs once per configured project, so compact, medium and expanded, light and dark, all apply.
test('a tall sheet opens at its title', async ({ page }) => {
  await openInvestments(page)
  await page.getByRole('button', { name: /Investment forecast/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Investment forecast' })
  await expect(dialog).toBeVisible()
  // Past the 40 ms initial focus, which used to scroll the sheet's tall body into view.
  await page.waitForTimeout(400)
  expect(await dialog.evaluate(element => element.scrollTop)).toBe(0)
  await expect(dialog.getByRole('heading', { name: 'Investment forecast' })).toBeInViewport()
})

test('the tab marker slides sideways when the sheet changes height', async ({ page }) => {
  await openInvestments(page)
  await page.getByRole('button', { name: /Manage portfolio/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage portfolio' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(500)

  for (const name of [/^Investments/, /^Accounts/]) {
    const tab = dialog.getByRole('tab', { name })
    const drift = await verticalDriftWhileSelecting(page, '[role="tablist"][aria-label="Portfolio sections"]', tab)
    expect(drift).toBeLessThan(1.5)
    await expect(tab).toHaveAttribute('aria-selected', 'true')
  }
})

test('the transaction type pill slides sideways when the form changes height', async ({ page }) => {
  await mockApi(page)
  await establishSession(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  await page.getByRole('button', { name: /New transaction|Quick add/ }).first().click()
  // Phones open the quick-add menu first; wider screens go straight to the form.
  const expense = page.getByRole('menuitem', { name: /^Expense/ })
  if (await expense.waitFor({ timeout: 2000 }).then(() => true, () => false)) await expense.click()
  const group = page.getByRole('radiogroup', { name: 'Transaction type' })
  await expect(group).toBeVisible()
  await page.waitForTimeout(500)

  for (const name of ['Transfer', 'Outflow']) {
    const option = group.getByRole('radio', { name })
    const drift = await verticalDriftWhileSelecting(page, '[role="radiogroup"][aria-label="Transaction type"]', option)
    expect(drift).toBeLessThan(1.5)
    await expect(option).toHaveAttribute('aria-checked', 'true')
  }
})
