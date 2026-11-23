import { expect, test } from '@playwright/test'
import { establishSession, mockApi, openTransactionForm } from './visualTestSupport'

test('queued transaction shows the retry reason and Retry resends the same transaction', async ({ page }) => {
  test.setTimeout(90_000)
  if (test.info().project.name === 'mobile-light') await page.setViewportSize({ width: 320, height: 844 })
  await page.clock.install({ time: new Date('2026-07-30T10:00:00+08:00') })
  await establishSession(page)
  await mockApi(page)
  const postedIds: string[] = []
  await page.route('**/api/transactions', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    const payload = route.request().postDataJSON()
    postedIds.push(payload.id)
    if (postedIds.length === 1) {
      return route.fulfill({ status: 500, json: { message: 'Internal error' } })
    }
    if (postedIds.length === 2) {
      return route.fulfill({ status: 429, headers: { 'Retry-After': '30' }, json: { message: 'Too many requests' } })
    }
    return route.fulfill({ status: 201, json: payload })
  })

  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer', { exact: true })).toBeVisible({ timeout: 25_000 })
  await openTransactionForm(page)
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  await dialog.getByLabel('Transaction description', { exact: false }).fill('Queued groceries')
  await dialog.getByRole('textbox', { name: /Amount/ }).fill('20.00')
  await dialog.getByRole('radiogroup', { name: 'Quick categories' }).getByRole('radio', { name: 'Food', exact: true }).click()
  await dialog.getByRole('radiogroup', { name: 'From bucket' }).getByRole('radio', { name: 'Essentials', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Add 1 draft to Ledger', exact: true }).click()

  const banner = page.getByRole('region', { name: 'Sync pending' })
  const countdown = banner.getByRole('button', { name: /Retrying in \d+s/ })
  const retry = banner.getByRole('button', { name: 'Retry', exact: true })
  await expect(countdown).toBeVisible()
  await expect(banner.getByText('The server returned an error. (HTTP 500)')).toBeHidden()

  const targetHeight = page.viewportSize()!.width < 1024 ? 44 : 36
  const [bannerBounds, countdownBounds, retryBounds] = await Promise.all([
    banner.boundingBox(), countdown.boundingBox(), retry.boundingBox(),
  ])
  for (const bounds of [countdownBounds!, retryBounds!]) {
    expect(bounds.height).toBeGreaterThanOrEqual(targetHeight)
    expect(bounds.x).toBeGreaterThan(bannerBounds!.x)
    expect(bounds.x + bounds.width).toBeLessThan(bannerBounds!.x + bannerBounds!.width)
  }
  expect(countdownBounds!.y).toBe(retryBounds!.y)
  await countdown.click()
  await expect(countdown).toHaveAttribute('aria-expanded', 'true')
  await expect(banner.getByText('The server returned an error. (HTTP 500)')).toBeVisible()
  await expect(banner.getByText(/will sync automatically/)).toBeVisible()
  const [transactionId] = postedIds
  expect(transactionId).toBeTruthy()
  expect(postedIds).toHaveLength(1)
  await banner.screenshot({ path: test.info().outputPath('sync-pending.png') })
  await retry.click()
  await expect.poll(() => postedIds).toEqual([transactionId, transactionId])
  await expect(banner.getByText('The server is receiving too many requests. (HTTP 429)')).toBeVisible()
  await expect(retry).toBeDisabled()
  await page.clock.fastForward(31_000)
  await expect.poll(() => postedIds).toEqual([transactionId, transactionId, transactionId])
  await expect(banner).toBeHidden()
})
