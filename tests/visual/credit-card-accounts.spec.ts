import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

test('credit card figures and balance fields keep long names contained', async ({ page }) => {
  const names = ['CIMB', 'CIMB Credit Card with a very long account name for household spending']
  const accounts = ['Essentials', 'Growth', 'Stability', 'Rewards'].map((bucket, index) => ({
    id: `account-${index}`, name: index === 0 ? names[0] : bucket, bucket, kind: 'Bank',
    interestEnabled: false, interestRatePercent: 0, interestFrequency: 'Monthly',
    isArchived: false, remaining: index === 0 ? 2000 : 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }))
  accounts.push({ ...accounts[0], id: 'visa', name: names[1], kind: 'CreditCard', remaining: -280 })
  await establishSession(page)
  await mockApi(page, { accounts: accounts.map(account => ({ ...account, ...(account.id === 'visa' ? { creditLimit: 4000 } : {}) })) })
  await page.goto('/settings?section=accounts', { waitUntil: 'domcontentloaded' })
  const card = page.locator('#account-row-visa')
  await expect(card.getByText('Available credit', { exact: true })).toBeVisible()
  await expect(card.getByText('Credit limit', { exact: true })).toBeVisible()
  await waitForStableLayout(page)
  expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await expect(card).toHaveScreenshot('credit-card-row.png')
  const edit = card.getByRole('button', { name: `Edit ${names[1]}`, exact: true })
  await edit.scrollIntoViewIfNeeded()
  expect(await edit.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
  })).toBe(true)
  const bucket = page.locator('#bucket-account-group-Essentials')
  await bucket.getByRole('button', { name: 'Update balances' }).click()
  const dialog = page.getByRole('dialog', { name: 'Update your Essentials account balances' })
  for (const name of names) {
    const input = dialog.getByRole('textbox', { name: `Current balance for ${name}`, exact: true })
    await expect(input).toBeVisible()
    await input.scrollIntoViewIfNeeded()
    expect(await input.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
    })).toBe(true)
  }
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await expect(dialog).toHaveScreenshot('credit-card-balances.png')
})
