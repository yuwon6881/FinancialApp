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
  await expect(page.getByRole('region', { name: 'Investment groups' }).getByRole('combobox')).toHaveCount(0)
  await expect(page.getByText(/50% and the group holds 55%/)).toBeVisible()
  await expect(page.getByRole('slider', { name: /Off-target alert/ })).toHaveAttribute('aria-valuetext', '10 percentage points')
  await page.getByRole('button', { name: 'Locked', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Bonds group' })).toBeEnabled()
  await page.getByRole('button', { name: 'Add group' }).click()
  await page.getByRole('textbox', { name: 'Group name' }).fill('Real estate')
  await page.getByRole('button', { name: 'Add group' }).click()
  await expect(page.getByRole('slider', { name: 'Real estate target' })).toHaveValue('5')
  await expect(page.getByText('Total: 100%')).toBeVisible()
  const save = page.getByRole('button', { name: 'Save investment plan' })
  await save.click()
  await expect.poll(() => overview.plan.groups?.find(group => group.label === 'Real estate')?.targetPercentage).toBe(5)
  await expect(page.getByRole('combobox', { name: 'Classify VNQ' })).toBeEnabled()
  await page.getByRole('combobox', { name: 'Classify VNQ' }).click()
  await page.getByRole('option', { name: 'Real estate', exact: true }).click()
  await expect.poll(() => instrument.sleeve).toBe(overview.plan.groups!.find(group => group.label === 'Real estate')!.key)
  // Removing a group that still holds an investment says what the save will do, then allows it.
  await page.getByRole('button', { name: 'Remove Real estate group' }).click()
  await expect(page.getByText(/Saving moves VNQ to Not sorted/)).toBeVisible()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('button', { name: 'Remove Real estate group' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Bonds group' }).click()
  await expect(page.getByRole('slider', { name: 'Bonds target' })).toHaveCount(0)
  await expect(page.getByText('Total: 100%')).toBeVisible()
  await save.click()
  await expect.poll(() => overview.plan.groups?.some(group => group.key === 'Bonds')).toBe(false)
  await page.getByRole('switch', { name: 'Use portfolio targets' }).click()
  await expect(page.getByRole('slider', { name: 'Real estate target' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Classify VNQ' })).toBeVisible()
  await page.getByRole('switch', { name: 'Group investments' }).click()
  await expect(page.getByRole('switch', { name: 'Use portfolio targets' })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: 'Classify VNQ' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add group' })).toHaveCount(0)
  await save.click()
  await expect.poll(() => overview.plan).toMatchObject({ groupingEnabled: false, targetsEnabled: false })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('a new account starts with no groups and builds a plan from nothing', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  const overview: InvestmentAllocationOverview = {
    status: 'NotStarted', appCurrency: 'MYR',
    plan: { groups: [], groupingEnabled: false, targetsEnabled: false, watchDrift: 3, alertDrift: 5 },
    assignments: [{ instrumentId: 'a771aff3-5101-4a98-8a5e-9e72bbf119d9', symbol: 'VOO', name: 'S&P 500 ETF', order: 0 }],
    sleeves: [], recommendations: [], incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  }
  await page.route('**/api/investments/allocation', route => route.fulfill({ json: overview }))
  await page.route('**/api/investments/allocation/plan', async route => {
    overview.plan = route.request().postDataJSON() as InvestmentPlan
    await route.fulfill({ json: overview.plan })
  })
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Investment plan' }).click()
  await expect(page.getByText('Off. Turn it on to add your first group.')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Use portfolio targets' })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: 'Classify VOO' })).toHaveCount(0)
  await page.getByRole('switch', { name: 'Group investments' }).click()
  for (const name of ['Shares', 'Bonds']) {
    await page.getByRole('button', { name: 'Add group' }).click()
    await page.getByRole('textbox', { name: 'Group name' }).fill(name)
    await page.getByRole('button', { name: 'Add group' }).click()
  }
  await page.getByRole('switch', { name: 'Use portfolio targets' }).click()
  await expect(page.getByRole('slider', { name: 'Shares target' })).toHaveValue('50')
  await expect(page.getByRole('slider', { name: 'Shares target' })).toBeEnabled()
  await page.getByRole('button', { name: 'Save investment plan' }).click()
  await expect.poll(() => overview.plan).toMatchObject({ groupingEnabled: true, targetsEnabled: true })
  expect(overview.plan.groups?.map(group => group.targetPercentage)).toEqual([50, 50])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('the investment forecast accepts assumptions for a custom group', async ({ page }) => {
  const allocation: InvestmentAllocationOverview = {
    status: 'OnTrack', appCurrency: 'MYR',
    plan: {
      groups: [{ key: 'property', label: 'Property', targetPercentage: 100, forecastClass: null }],
      groupingEnabled: true, targetsEnabled: true, watchDrift: 3, alertDrift: 5,
    },
    assignments: [], recommendations: [], incompleteReasons: [],
    sleeves: [{ sleeve: 'property', label: 'Property', status: 'OnTrack', value: 10000, targetPercentage: 100, currentPercentage: 100 }],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  }
  await establishSession(page)
  await mockApi(page, { investmentPortfolio: {
    summary: { growthLedgerBalance: 0, totalValue: 10000 }, allocation,
    accounts: [{ id: 'broker', name: 'Broker', baseCurrency: 'MYR', isArchived: false }],
  } })
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Investment forecast/ }).click()
  await page.getByRole('button', { name: 'Apply assumptions' }).click()
  await expect(page.getByRole('dialog', { name: 'Investment forecast' }).getByRole('alert')).toContainText('Property needs an annual return')
  await page.getByRole('spinbutton', { name: 'Property annual return (%)' }).fill('6')
  await page.getByRole('spinbutton', { name: 'Property annual volatility (%)' }).fill('12')
  await page.getByRole('button', { name: 'Apply assumptions' }).click()
  await expect(page.getByRole('table', { name: 'Investment forecast data' })).toBeAttached({ timeout: 15000 })
  await expect(page.getByRole('slider', { name: /Years ahead/ })).toBeVisible()
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
