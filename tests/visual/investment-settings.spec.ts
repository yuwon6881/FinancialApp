import { expect, test } from '@playwright/test'
import type { InvestmentAllocationOverview, InvestmentPlan } from '../../src/types'
import { establishSession, mockApi } from './visualTestSupport'

test('portfolio groups can be added, assigned, and removed from Settings', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  const instrument = { instrumentId: 'a771aff3-5101-4a98-8a5e-9e72bbf119d8', symbol: 'VNQ', name: 'Real estate ETF', order: 0, sleeve: 'Bonds' }
  const overview: InvestmentAllocationOverview = {
    status: 'OnTrack', appCurrency: 'MYR',
    plan: { usEquityTarget: 75, internationalExUsTarget: 10, bondsTarget: 15, watchDrift: 5, alertDrift: 10 },
    assignments: [instrument], sleeves: [], recommendations: [], incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  }
  await page.route('**/api/investments/allocation', route => route.fulfill({ json: overview }))
  await page.route('**/api/investments/allocation/plan', async route => {
    overview.plan = route.request().postDataJSON() as InvestmentPlan
    await route.fulfill({ json: overview.plan })
  })
  await page.route('**/api/investments/instruments/*/allocation-sleeve', async route => {
    instrument.sleeve = route.request().postDataJSON().sleeve
    await route.fulfill({ status: 204 })
  })
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Investment plan' }).click()
  await expect(page.getByText(/50% and the group holds 55%/)).toBeVisible()
  await expect(page.getByRole('slider', { name: /Off-target alert/ })).toHaveAttribute('aria-valuetext', '10 percentage points')
  await page.getByRole('button', { name: 'Locked', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Bonds group' })).toBeDisabled()
  await page.getByRole('button', { name: 'Add group' }).click()
  await page.getByRole('textbox', { name: 'Group name' }).fill('Real estate')
  await page.getByRole('button', { name: 'Add group' }).click()
  await expect(page.getByRole('slider', { name: 'Real estate target' })).toHaveValue('5')
  await expect(page.getByText('Total: 100%')).toBeVisible()
  const save = page.getByRole('button', { name: 'Save targets' })
  await save.click()
  await expect.poll(() => overview.plan.groups?.find(group => group.label === 'Real estate')?.targetPercentage).toBe(5)
  await expect(save).toBeEnabled()
  await page.getByRole('combobox', { name: 'Classify VNQ' }).click()
  await page.getByRole('option', { name: 'Real estate', exact: true }).click()
  await expect.poll(() => instrument.sleeve).toBe(overview.plan.groups!.find(group => group.label === 'Real estate')!.key)
  await expect(page.getByRole('button', { name: 'Remove Real estate group' })).toBeDisabled()
  await page.getByRole('button', { name: 'Remove Bonds group' }).click()
  await expect(page.getByRole('slider', { name: 'Bonds target' })).toHaveCount(0)
  await expect(page.getByText('Total: 100%')).toBeVisible()
  await save.click()
  await expect.poll(() => overview.plan.groups?.some(group => group.key === 'Bonds')).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('the notification roster names another device by browser and OS', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.route('**/api/push/devices?*', route => route.fulfill({ json: [{
    id: 'android-device', isCurrent: false, deviceLabel: 'Chrome on Android', billRemindersEnabled: true,
    categoryAlertsEnabled: true, enrolledAt: '2026-09-24T00:00:00Z', lastUpdatedAt: '2026-11-23T00:00:00Z',
  }] }))
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await page.getByText('Devices set up', { exact: true }).click()
  await expect(page.getByText('Chrome on Android', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop notifications for Chrome on Android' })).toBeVisible()
})
