import { expect, test } from '@playwright/test'
import type { VaultDocument } from '../../src/types'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

// A receipt the AI could not read an amount from, reviewed while the app counts in USD: it starts
// as another currency, and the reviewer can say it is ringgit before entering the amount.
const unread: VaultDocument = {
  id: 7,
  originalFileName: 'clinic-receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 64_000,
  taxYear: 2026,
  notes: null,
  transactionId: null,
  uploadedAt: '2026-07-28T00:00:00Z',
  retentionUntil: '2033-12-31',
  reliefCategory: 'medical',
  amount: null,
  amountCurrency: 'MYR',
  amountStatus: 'NeedsReview',
  amountConfidence: null,
  amountExtractionMessage: null,
}

test('receipt review lets the currency be chosen before an amount is entered', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  await mockApi(page, {
    documents: [unread],
    setting: { currency: 'USD' },
    reliefCategories: [{ id: 'medical', name: 'Medical', limit: 10_000 }],
  })
  // Registered after mockApi so it wins: one amount waits to be checked.
  await page.route('**/documents/overview**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      usage: { totalBytes: unread.sizeBytes, documentCount: 1 },
      availableYears: [2026],
      retention: { taxYears: [], noticeWindowDays: 180, keepYears: 7 },
      selectedTaxYear: 2026,
      summary: {
        taxYear: 2026, confirmedAmount: 0, pendingReviewAmount: 0, documentCount: 1,
        categories: [{ id: 'medical', name: 'Medical', limit: 10_000, confirmedAmount: 0, pendingReviewAmount: 0, documentCount: 1, pendingReviewCount: 1 }],
      },
      reliefCategories: [{ id: 'medical', name: 'Medical', limit: 10_000 }],
    }),
  }))
  await page.goto('/vault', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  await page.getByRole('button', { name: 'Review now' }).click()
  const currency = page.getByRole('combobox', { name: 'Currency for clinic-receipt.pdf' }).filter({ visible: true })
  await expect(currency).toBeVisible()
  await expect(currency).toContainText('Other currency')
  await currency.click()
  await page.getByRole('option', { name: 'MYR' }).click()
  await expect(currency).toContainText('MYR')
  await expect(page.getByText('Amount (RM)')).toBeVisible()

  const amount = page.getByRole('dialog', { name: 'Check amounts' }).getByRole('textbox', { name: /^Amount \(RM\)/ })
  await amount.fill('120.50')
  const box = await currency.boundingBox()
  // Compact and medium controls keep the 44px target; expanded may use 36px.
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(page.viewportSize()!.width < 1024 ? 44 : 36)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
