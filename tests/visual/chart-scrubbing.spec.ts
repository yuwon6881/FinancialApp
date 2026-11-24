import { expect, test, type Locator, type Page } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

async function checkScrubbing(page: Page, chart: Locator, readout: Locator) {
  await expect(chart).toBeVisible({ timeout: 15_000 })
  await chart.scrollIntoViewIfNeeded()
  const plotBottom = async () => chart.evaluate(element => element.getBoundingClientRect().bottom)
  const hover = async (fraction: number) => {
    const position = await chart.evaluate((svg: SVGSVGElement, fraction) => {
      const { x, y, width, height } = svg.viewBox.baseVal
      const point = new DOMPoint(x + width * fraction, y + height * 0.15).matrixTransform(svg.getScreenCTM()!)
      return { x: point.x, y: point.y }
    }, fraction)
    await page.mouse.move(position.x, position.y)
  }
  const before = await plotBottom()
  await hover(0.1)
  await expect(readout).not.toBeEmpty()
  const first = await readout.textContent()
  expect((await readout.boundingBox())!.y).toBeGreaterThanOrEqual(before - 1)
  await hover(0.9)
  await expect(readout).not.toHaveText(first!)
  expect(await plotBottom()).toBeCloseTo(before, 0)
  expect(await readout.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')
}

test('line chart readouts stay outside the plot while the pointer scrubs', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, {
    dashboard: { trendPoints: [
      { month: 'Oct', cycleKey: '2026-10', balance: 1050 },
      { month: 'Nov', cycleKey: '2026-11', balance: 1250 },
    ] },
    investmentPortfolio: {
      accounts: [{ id: 'chart-broker', name: 'Broker', baseCurrency: 'USD', isArchived: false }],
      summary: {
        growthLedgerBalance: 0, netDeposits: 3000, marketValue: 4000, costBasis: 3000,
        unrealisedProfitLoss: 1000, unrealisedPercent: 33.3, realisedProfitLoss: 0,
        netDividends: 0, dailyChange: 0, cashValue: 0, totalValue: 4000,
      },
      chart: [
        { date: '2026-11-10', totalValue: 3200, netDeposits: 3000 },
        { date: '2026-11-20', totalValue: 4000, netDeposits: 3000 },
      ],
    },
  })

  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  const portfolio = page.getByRole('region', { name: 'Portfolio value' })
  const portfolioReadout = portfolio.locator('[data-chart-point-readout]')
  await checkScrubbing(page, portfolio.getByRole('img'), portfolioReadout)
  await expect(portfolioReadout).toContainText('2026-11-20')

  await page.getByRole('button', { name: /Investment forecast/ }).click()
  const forecast = page.getByRole('dialog', { name: 'Investment forecast' })
  await checkScrubbing(page, forecast.getByRole('img', { name: /middle estimate/ }), forecast.locator('[data-chart-point-readout]'))
  await page.keyboard.press('Escape')
  await expect(forecast).toHaveCount(0)

  await page.goto('/reports', { waitUntil: 'domcontentloaded' })
  const trend = page.getByRole('region', { name: 'Growth ledger balance' })
  await checkScrubbing(page, trend.getByRole('img'), trend.locator('[data-chart-point-readout]'))
})
