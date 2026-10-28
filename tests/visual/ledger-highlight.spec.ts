import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

test('desktop ledger row highlight maintains stable row height and cell borders', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('desktop'), 'Desktop projects only')

  const transactions = Array.from({ length: 6 }, (_, index) => ({
    id: `tx-probe-${index + 1}`,
    accountId: 'account-visual-essentials',
    date: '2026-08-01',
    description: `Probe row ${index + 1}`,
    category: 'Food',
    ledgerCategory: 'Essentials',
    amount: -10 - (index + 1),
  }))

  await mockApi(page, { transactions })
  await establishSession(page)
  await page.goto('/ledger?tx=tx-probe-1', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Probe row 1')

  const row = page.locator('tr').filter({ hasText: 'Probe row 1' })
  await expect(row).toBeVisible()

  const readMetrics = () =>
    page.evaluate(() => {
      const targetRow = Array.from(document.querySelectorAll('tr')).find(r => r.textContent?.includes('Probe row 1'))
      if (!targetRow) return null
      const firstCell = targetRow.querySelector('td')
      if (!firstCell) return null
      const card = targetRow.closest('table')?.parentElement?.parentElement
      if (!card) return null
      return {
        height: targetRow.getBoundingClientRect().height,
        borderBottomWidth: getComputedStyle(firstCell).borderBottomWidth,
        cardBottom: card.getBoundingClientRect().bottom,
      }
    })

  // Sample before highlight class is applied (poll briefly while class is not yet present)
  let before = await readMetrics()
  for (let i = 0; i < 20; i++) {
    const hasHighlight = await row.evaluate(el => el.classList.contains('search-target-highlight'))
    if (!hasHighlight && before) {
      break
    }
    await page.waitForTimeout(10)
    before = await readMetrics()
  }

  expect(before).not.toBeNull()

  // Wait for the highlight to be applied
  await expect(row).toHaveClass(/search-target-highlight/, { timeout: 3000 })
  const during = await readMetrics()
  expect(during).not.toBeNull()

  // Wait for the highlight to be removed (2600ms lifetime)
  await expect(row).not.toHaveClass(/search-target-highlight/, { timeout: 6000 })
  const after = await readMetrics()
  expect(after).not.toBeNull()

  if (!before || !during || !after) {
    throw new Error('Failed to sample row metrics during all phases')
  }

  // The jump this guards against happens when the highlight ends, so compare the highlighted
  // state with the settled one. The 'before' sample can still be inside the list's entrance
  // animation, whose transform moves bounding boxes without any layout change, so it is only
  // trusted for what an animation cannot affect: the cell border width.
  expect(Math.abs(after.height - during.height)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(after.cardBottom - during.cardBottom)).toBeLessThanOrEqual(0.5)

  // Cell border bottom width must never change
  expect(during.borderBottomWidth).toBe(before.borderBottomWidth)
  expect(after.borderBottomWidth).toBe(before.borderBottomWidth)

  await waitForStableLayout(page)
})
