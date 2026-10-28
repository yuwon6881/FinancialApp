import { expect, test } from '@playwright/test'
import { establishSession, mockApi, openTransactionForm } from './visualTestSupport'

test('switching to Transfer dismisses AI notes immediately and keeps them closed on return', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.route('**/api/categories/suggest-notes', route => route.fulfill({ json: { suggestions: [{ note: 'Coffee at the cafe', reason: 'Clear description' }] } }))
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await openTransactionForm(page)
  const form = page.getByRole('dialog')
  await form.getByLabel('Transaction description', { exact: false }).fill('Coffee')
  await form.getByRole('button', { name: 'AI', exact: true }).click()
  const suggestion = page.getByRole('button', { name: /Coffee at the cafe/ })
  await expect(suggestion).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('ai-notes.png') })
  await form.getByRole('radio', { name: 'Transfer', exact: true }).click()
  expect(await suggestion.count()).toBe(0)
  await form.getByRole('radio', { name: /Outflow/ }).click()
  await expect(suggestion).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('suggestions-dismissed.png') })
})

test('Commitments uses the clipboard check icon', async ({ page }) => {
  // Pinned to the fixtures' cycle: on a later real date the page waits for a cycle the mock never serves.
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  // One commitment, so the Commitments section renders, and free Rewards money, because the icon
  // lives on the pool's "Set aside" action and that action only appears when there is money to move.
  await mockApi(page, {
    dashboard: {
      categories: [{ id: 'rewards', name: 'Rewards', allocation: 0.1, target: 600, incomeAllocated: 600, budget: 600, netChange: 600, spent: 0, remaining: 600 }],
    },
    savingsGoals: [{
      id: 1, name: 'Emergency laptop', targetAmount: 2_400, earmarkedAmount: 300, fundingBucket: 'Rewards',
      targetDate: '2027-03-15', priority: 'Medium', status: 'active', isRecurring: false, recurrenceMonths: 0,
      cycleFundedAmount: 0, createdAt: '2026-07-01',
    }],
  })
  await page.goto('/commitments-rewards', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Goals', level: 1 })).toBeVisible()
  await expect(page.locator('svg.lucide-clipboard-check').first()).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('commitments-icon.png'), fullPage: true })
})

test('switching type dismisses focused description autocomplete', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, { autocomplete: [{ description: 'Coffee house', category: 'Food', ledgerCategory: 'Essentials', txType: 'outflow' }] })
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await openTransactionForm(page)
  const form = page.getByRole('dialog')
  const description = form.getByLabel('Transaction description', { exact: false })
  await description.fill('Coffee')
  const suggestion = page.locator('[data-suggestion]').filter({ hasText: 'Coffee house' })
  await expect(suggestion).toBeVisible()
  await form.getByRole('radio', { name: 'Transfer', exact: true }).click()
  expect(await suggestion.count()).toBe(0)
  await form.getByRole('radio', { name: /Outflow/ }).click()
  await expect(suggestion).toHaveCount(0)
})
