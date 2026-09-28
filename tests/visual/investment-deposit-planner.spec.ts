import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

test('deposit planner uses only the entered total and explains its funding', async ({ page }) => {
  const allocation = {
    status: 'OnTrack', appCurrency: 'MYR',
    plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
    assignments: [], recommendations: [], incompleteReasons: [],
    sleeves: [
      { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, currentPercentage: 66, value: 660, driftPercentagePoints: 0, status: 'OnTrack' },
      { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, currentPercentage: 10, value: 100, driftPercentagePoints: 0, status: 'OnTrack' },
      { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, currentPercentage: 24, value: 240, driftPercentagePoints: 0, status: 'OnTrack' },
    ],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    investedValue: 1000, availableCash: 1500, minimumContribution: 0,
  }
  await mockApi(page, { investmentPortfolio: {
    allocation,
    instruments: [
      { id: 'vti', symbol: 'VTI', name: 'US market', type: 'ETF', currency: 'MYR', allocationSleeve: 'USEquity', isCustom: false, isArchived: false },
      { id: 'vxus', symbol: 'VXUS', name: 'International market', type: 'ETF', currency: 'MYR', allocationSleeve: 'InternationalExUS', isCustom: false, isArchived: false },
      { id: 'bnd', symbol: 'BND', name: 'Bonds', type: 'ETF', currency: 'MYR', allocationSleeve: 'Bonds', isCustom: false, isArchived: false },
    ],
  } })
  await establishSession(page)
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  await page.getByRole('button', { name: /Plan money in or out/ }).click()
  const amount = page.getByRole('textbox', { name: 'Amount to invest in MYR' })
  await amount.fill('1000.00')
  await expect(page.getByText(/RM\s+1,000\.00 from spare broker cash/)).toBeVisible()
  await expect(page.getByText(/RM\s+500\.00 broker cash remaining/)).toBeVisible()
  await expect(page.getByText(/new funds required/)).toHaveCount(0)
  await expect(page.getByText(/RM\s+660\.00/).last()).toBeVisible()

  await amount.fill('2000.00')
  await expect(page.getByText(/RM\s+500\.00 new funds required/)).toBeVisible()
  await expect(page.getByText(/broker cash remaining/)).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
