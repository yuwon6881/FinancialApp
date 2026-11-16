import { expect, test } from '@playwright/test'
import { establishSession, mockApi, vaultDocuments, waitForStableLayout } from './visualTestSupport'

test('receipt currency remains readable and editable with a different app currency', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  await mockApi(page, { documents: vaultDocuments, setting: { currency: 'USD' } })
  await page.goto('/vault', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  await expect(page.getByText('2026-tax-return.pdf').filter({ visible: true })).toBeVisible()
  const details = page.getByRole('button', { name: 'Details for 2026-tax-return.pdf' }).filter({ visible: true })
  if (await details.isVisible() && await details.getAttribute('aria-expanded') !== 'true') await details.click()
  const edit = page.getByRole('button', { name: /Edit amount RM.*1,250.*2026-tax-return.pdf/ }).filter({ visible: true })
  await expect(edit).toBeVisible()
  await edit.click()
  const currency = page.getByRole('combobox', { name: 'Currency for 2026-tax-return.pdf' }).filter({ visible: true })
  await expect(currency).toBeVisible()
  await currency.click()
  await expect(page.getByRole('option', { name: 'Other currency' })).toBeVisible()
  await page.getByRole('option', { name: 'Other currency' }).click()
  await expect(currency).toContainText('Other currency')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
