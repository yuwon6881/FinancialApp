import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

// Runs once per configured project, so compact, medium and expanded, light and dark, all apply.
test('the accounts total leads with worth today beside money in, without overflowing', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await mockApi(page, { investmentPortfolio: {
    appCurrency: 'MYR',
    accounts: [{ id: 'a1', name: 'Broker', baseCurrency: 'USD', isArchived: false }],
    summary: { growthLedgerBalance: 3988.5, netDeposits: 3988.5, totalValue: 4500 },
  } })
  await establishSession(page)
  await page.goto('/wealth/accounts', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const total = page.locator('#accounts-total-card')
  await expect(total.getByText('Worth today')).toBeVisible()
  await expect(total.getByText('Money in accounts')).toBeVisible()
  await expect(total.getByText(/RM\s?511\.50 above money in/)).toBeVisible()
  // The Growth card repeats the pairing in its header and must contain it at every width.
  const growth = page.locator('#bucket-account-group-Growth')
  await expect(growth.getByText('Worth today')).toBeVisible()
  await expect(growth.getByText('Money in', { exact: true })).toBeVisible()
  await expect(growth.getByText(/RM\s?511\.50 above money in/)).toBeVisible()
  expect(await growth.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
