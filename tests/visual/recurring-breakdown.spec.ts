import { expect, test } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

const tileName = /yearly total.*breakdown/i
const breakdownName = 'Yearly Bills Distribution'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-23T10:00:00+08:00'))
  await establishSession(page)
  await mockApi(page, {
    recurringPayments: Array.from({ length: 8 }, (_, index) => ({
      id: `bill-${index}`, name: index === 0 ? 'Xiaomi 18 pro installment' : `Household bill ${index}`,
      amount: 1271.33 - index, frequency: 'Monthly', category: 'Loan', ledgerCategory: 'Essentials',
      accountId: 'account-visual-essentials', nextDueDate: '2026-12-19', dueDate: 19,
      startDate: '2026-11-19', active: true, paymentMode: 'AutoDeduct',
    })),
  })
  await page.goto('/recurring', { waitUntil: 'domcontentloaded' })
})

test('mouse can move from the yearly total into the wider breakdown and scroll', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Requires a mouse.')
  const tile = page.getByRole('button', { name: tileName })
  const breakdown = page.getByRole('dialog', { name: breakdownName })
  await tile.hover()
  await expect(breakdown).toBeVisible()
  const tileBounds = (await tile.boundingBox())!
  const panelBounds = (await breakdown.boundingBox())!
  expect(panelBounds.width).toBeGreaterThanOrEqual(480)
  expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  const list = breakdown.getByLabel(`${breakdownName} list`)
  const listBounds = (await list.boundingBox())!
  const pointerX = Math.max(tileBounds.x, listBounds.x) + 24
  const tileBottom = tileBounds.y + tileBounds.height
  expect(panelBounds.y).toBeGreaterThan(tileBottom)
  await page.mouse.move(pointerX, tileBottom + (panelBounds.y - tileBottom) / 2)
  await page.mouse.move(pointerX, listBounds.y + 24, { steps: 4 })
  await page.mouse.wheel(0, 240)
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expect(breakdown).toBeVisible()

  await page.mouse.move(1, 1)
  await expect(breakdown).toBeHidden()
  await tile.click()
  await page.mouse.move(1, 1)
  await expect(breakdown).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(breakdown).toBeHidden()
})

test('tapping the yearly total opens the mobile breakdown sheet', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'Requires a touch viewport.')
  const tile = page.getByRole('button', { name: tileName })
  const sheet = page.getByRole('dialog', { name: breakdownName })
  await expect(sheet).toBeHidden()
  await tile.tap()
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Xiaomi 18 pro installment', { exact: true })).toBeVisible()
  await page.touchscreen.tap(8, 8)
  await expect(sheet).toBeHidden()
})
