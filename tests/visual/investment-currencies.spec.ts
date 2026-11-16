import { expect, test } from '@playwright/test'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

// A portfolio holding a US fund while the app counts in ringgit. Every app-currency figure is the
// fund's own figure at today's rate (4.5), and the per-currency list shows the dollars untouched.
const summary = {
  growthLedgerBalance: 1000,
  growthContributions: 1000,
  netDeposits: 990,
  marketValue: 990,
  costBasis: 900,
  unrealisedProfitLoss: 90,
  unrealisedPercent: 10,
  realisedProfitLoss: 0,
  netDividends: 0,
  dailyChange: 9,
  cashValue: 90,
  totalValue: 1080,
  currencies: [
    {
      currency: 'USD', rateToAppCurrency: 4.5, rateDate: '2026-11-13', marketValue: 220, cashValue: 20,
      totalValue: 240, netDeposits: 220, costBasis: 200, unrealisedProfitLoss: 20, unrealisedPercent: 10,
      realisedProfitLoss: 0, netDividends: 0, dailyChange: 2,
    },
  ],
}

const holding = {
  accountId: 'broker', accountName: 'Broker', instrumentId: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF',
  type: 'ETF', currency: 'USD', units: 2, averageCostNative: 100, latestPriceNative: 110,
  costBasisNative: 200, valueNative: 220, dailyChangeNative: 2, unrealisedProfitLossNative: 20,
  realisedProfitLossNative: 0, netDividendsNative: 0,
  valueApp: 990, dailyChangeApp: 9, unrealisedProfitLossApp: 90, unrealisedPercent: 10,
  realisedProfitLossApp: 0, netDividendsApp: 0, priceDate: '2026-11-13', fxIncomplete: false,
  fxRate: 4.5, fxDate: '2026-11-13', fxSource: 'Test direct', priceSource: 'Test daily close', valuationAsOf: '2026-11-13',
}

test('foreign holdings read in their own currency, converted only at today’s rate', async ({ page }) => {
  await mockApi(page, { investmentPortfolio: {
    summary,
    holdings: [holding],
    accounts: [{ id: 'broker', name: 'Broker', baseCurrency: 'USD', isArchived: false, canDelete: false, canArchive: false }],
    instruments: [{ id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', currency: 'USD', isCustom: false, isArchived: false }],
    cashBalances: [{ accountId: 'broker', accountName: 'Broker', currency: 'USD', amount: 20, amountApp: 90 }],
  } })
  // Registered after mockApi so it wins: the shared mock has no per-fund price history.
  await page.route('**/investments/instruments/voo/history**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      instrumentId: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', currency: 'USD', units: 2,
      averageCostNative: 100, latestPriceNative: 110, firstBoughtOn: '2026-07-03',
      points: [{ date: '2026-07-03', price: 100 }, { date: '2026-09-01', price: 104 }, { date: '2026-11-13', price: 110 }],
    }),
  }))
  await establishSession(page)
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const currencies = page.getByRole('list', { name: 'Each currency' })
  await expect(currencies).toBeVisible()
  await expect(currencies).toContainText('1 USD = 4.5 MYR today')
  await expect(currencies).toContainText(/\$\s?240\.00/)
  await expect(currencies).toContainText('+10.0% on paper')
  await expect(page.getByText('From currency')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const hero = page.getByRole('region', { name: 'Investment summary' })
  // Centre the card in the viewport so the floating phone navigation stays outside the crop.
  await hero.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await expect(hero).toHaveScreenshot('investment-summary.png')

  const breakdown = hero.getByRole('button', { name: 'Show breakdown' })
  if (await breakdown.isVisible()) await breakdown.click()
  await hero.getByRole('button', { name: 'What is Yearly return?' }).click()
  await expect(page.getByRole('tooltip')).toContainText('the same current exchange rates for every date')
  await page.keyboard.press('Escape')

  // The fund's sheet leads with its own currency and says the exchange rate never moves it.
  await page.getByRole('button', { name: /VOO/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Details for VOO' })
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText(/About RM\s?990\.00 at today’s rate/)
  await expect(sheet).toContainText('the exchange rate never moves it')
  await expect(sheet.getByText(/\+\$\s?20\.00 · 10\.0%/)).toBeVisible()
})
