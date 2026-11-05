import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

// Runs once per configured project, so compact, medium and expanded, light and dark, all apply.
test('the accounts total adds investments at today’s prices without overflowing', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await mockApi(page, { investmentPortfolio: {
    appCurrency: 'MYR',
    accounts: [{ id: 'a1', name: 'Broker', baseCurrency: 'USD', isArchived: false }],
    summary: { growthLedgerBalance: 3988.5, netDeposits: 3988.5, totalValue: 4500 },
  } })
  await establishSession(page)
  await page.goto('/wealth/accounts', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const total = page.locator('#settings-panel-accounts')
  await expect(total.getByText('With investments at today’s prices')).toBeVisible()
  await expect(total.getByText(/RM\s?511\.50 more than the RM\s?3,988\.50 you sent the broker/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
