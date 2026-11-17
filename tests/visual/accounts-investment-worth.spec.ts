import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

// Runs once per configured project, so compact, medium and expanded, light and dark, all apply.
test('the accounts total leads with worth today beside money in, without overflowing', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-30T10:00:00+08:00'))
  await mockApi(page, { currentCycleBills: [{
    id: 'current-reward', recurringPaymentId: 'reward-bill', name: 'Current Rewards bill',
    amount: 37.5, category: 'Subscriptions', ledgerCategory: 'Rewards', dueDate: '2026-08-29',
    isPaid: false, isDiscarded: false, status: 'Pending',
  }], investmentPortfolio: {
    appCurrency: 'MYR',
    accounts: [{ id: 'a1', name: 'Broker', baseCurrency: 'USD', isArchived: false }],
    summary: { growthLedgerBalance: 3988.5, netDeposits: 3988.5, totalValue: 4500 },
  } })
  await establishSession(page)
  await page.goto('/wealth/accounts?month=Jul&year=2026', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const total = page.locator('#accounts-total-card')
  await expect(total.getByText('Worth today')).toBeVisible()
  await expect(total.getByText('Money in accounts')).toBeVisible()
  await expect(page.getByText("Balances shown here are today's")).toHaveCount(0)
  const comparison = /RM\s?511\.50 above net broker deposits/
  await expect(total.getByText(comparison)).toBeVisible()
  // The Growth card repeats the pairing in its header and must contain it at every width.
  const growth = page.locator('#bucket-account-group-Growth')
  await expect(growth.getByText('Worth today')).toBeVisible()
  await expect(growth.getByText('Money in', { exact: true })).toBeVisible()
  await expect(growth.getByText(comparison)).toBeVisible()
  const rewards = page.locator('#bucket-account-group-Rewards')
  await expect(rewards.getByText('Committed', { exact: true })).toBeVisible()
  await expect(rewards.getByText(/RM\s?37\.50/)).toBeVisible()
  expect(await growth.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('navigation', { name: 'Wealth sections' }).getByRole('button', { name: 'Investments' }).click()
  await expect(page.getByRole('region', { name: 'Investment summary' }).getByText(comparison)).toBeVisible()
})

test('Loans hides the cycle selector and Bills keeps the selected cycle', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-30T10:00:00+08:00'))
  await mockApi(page)
  await establishSession(page)
  await page.goto('/plan/bills?month=Jul&year=2026', { waitUntil: 'domcontentloaded' })
  const sections = page.getByRole('navigation', { name: 'Plan sections' })
  const picker = page.getByRole('combobox', { name: 'Recurring cycle', exact: true })
  await expect(picker).toContainText('Jul 28th')
  await sections.getByRole('button', { name: 'Loans' }).click()
  await expect(page.getByRole('heading', { name: 'Loans', exact: true })).toBeVisible()
  await expect(picker).toHaveCount(0)
  await sections.getByRole('button', { name: 'Bills' }).click()
  await expect(picker).toContainText('Jul 28th')
})
