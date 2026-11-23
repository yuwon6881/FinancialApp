import { expect, test } from '@playwright/test'
import type { CashFlowForecast, ForecastCycle, ForecastScenario } from '../../src/types'
import { establishSession, mockApi } from './visualTestSupport'

const buckets = (essentials: number, growth = 0, stability = 0, rewards = 0) =>
  ({ Essentials: essentials, Growth: growth, Stability: stability, Rewards: rewards })

function forecastFor(scenario: ForecastScenario): CashFlowForecast {
  const income = scenario.incomePerCycle ?? 0
  const skipped = scenario.skippedBills.includes('gym:2026-12-05')
  const crown = scenario.items.find(item => item.label === 'Tooth crown')
  const december: ForecastCycle = {
    start: '2026-11-28', end: '2026-12-27', label: 'Dec 2026', isCurrent: false,
    opening: buckets(1000, 5000, 9500, 300),
    moneyIn: buckets(income * 0.5, income * 0.25, income * 0.15, income * 0.1),
    moneyOut: buckets(skipped ? 0 : 170),
    closing: buckets(1000 + income * 0.5 - (skipped ? 0 : 170), 5000 + income * 0.25, 9500 + income * 0.15, 300 + income * 0.1),
    lines: [
      ...(skipped ? [] : [{ date: '2026-12-05', label: 'Gym', bucket: 'Essentials' as const, amount: -170, kind: 'Bill' as const, sourceId: 'gym:2026-12-05' }]),
    ],
    shortBuckets: [],
    stabilityTargetReached: false,
  }
  if (december.closing.Essentials < 0) december.shortBuckets = ['Essentials']
  return {
    today: '2026-11-24',
    stabilityTarget: 10000,
    skippedBills: skipped ? [{ date: '2026-12-05', amount: -170, bucket: 'Essentials', label: 'Gym', sourceId: 'gym:2026-12-05' }] : [],
    forecast: {
      cycles: [
        {
          ...december, start: '2026-11-24', end: '2026-11-27', label: 'Rest of this cycle', isCurrent: true,
          moneyIn: buckets(0), moneyOut: buckets(crown ? 1800 : 0),
          closing: buckets(crown ? -800 : 1000, 5000, 9500, 300),
          lines: crown ? [{ date: crown.date, label: crown.label, bucket: crown.bucket, amount: crown.amount, kind: 'Scenario', sourceId: null }] : [],
          shortBuckets: crown ? ['Essentials'] : [],
        },
        december,
      ],
      incomeKnown: income > 0,
      everydaySpendingIncluded: false,
      stabilityTargetReachedOn: null,
    },
  }
}

test('the forecast workspace opens from the profile menu and keeps what-ifs out of the records', async ({ page }, testInfo) => {
  await establishSession(page)
  await mockApi(page)
  const requests: ForecastScenario[] = []
  // Writes are recorded only once the workspace is open; the session heartbeat is not a record.
  const writes: string[] = []
  let recording = false
  page.on('request', request => {
    const url = request.url()
    if (!recording || request.method() === 'GET' || !url.includes('/api/')) return
    if (url.includes('/api/forecast/') || url.includes('/api/auth/sessions/heartbeat')) return
    writes.push(`${request.method()} ${url}`)
  })
  await page.route('**/api/forecast/cash-flow', async route => {
    const scenario = route.request().postDataJSON() as ForecastScenario
    requests.push(scenario)
    await route.fulfill({ json: forecastFor(scenario) })
  })

  await page.goto('/today', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Forecast' }).click()
  await expect(page).toHaveURL(/\/forecast(\?|$)/)
  await expect(page.getByRole('heading', { name: 'Forecast', level: 1 })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('without changing your records')
  await expect(page.getByRole('heading', { name: 'Dec 2026' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'End-of-cycle balances' })).toBeInViewport()
  await expect(page.getByRole('heading', { name: 'Rest of this cycle' })).toBeInViewport()
  await testInfo.attach('forecast', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  recording = true

  await page.getByRole('textbox', { name: 'Income per cycle' }).fill('4800')
  await expect.poll(() => requests.at(-1)?.incomePerCycle).toBe(4800)

  await page.getByRole('button', { name: 'Add what-if' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add a what-if' })
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Tooth crown')
  await sheet.getByRole('textbox', { name: 'Amount (MYR)' }).fill('1800')
  const addToForecast = sheet.getByRole('button', { name: 'Add to forecast' })
  await expect(addToForecast).toBeInViewport({ ratio: 1 })
  if (testInfo.project.name.startsWith('mobile')) {
    // The sheet slides up on a tween: measure only once it has come to rest.
    await expect.poll(async () => {
      const before = (await addToForecast.boundingBox())?.y
      await page.waitForTimeout(120)
      return before === (await addToForecast.boundingBox())?.y
    }).toBe(true)
    const bounds = await addToForecast.boundingBox()
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 8)
  }
  await testInfo.attach('what-if', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  await addToForecast.click()
  await expect.poll(() => requests.at(-1)?.items.map(item => item.label)).toEqual(['Tooth crown'])

  const december = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Dec 2026' }) })
  await december.getByText('Activity · 1').click()
  await expect(december.getByText('Gym')).toBeVisible()
  await page.getByRole('button', { name: 'Skip Gym on 2026-12-05 in this forecast' }).click()
  await expect(december.getByText('1 skipped')).toBeVisible()
  await december.getByRole('button', { name: /Include again: Gym/ }).click()
  await expect(december.getByText('1 skipped')).toHaveCount(0)
  await expect.poll(() => requests.at(-1)?.skippedBills).toEqual([])

  await page.getByRole('button', { name: 'Reset what-ifs' }).click()
  await expect.poll(() => requests.at(-1)?.items.length).toBe(0)
  await expect.poll(() => requests.at(-1)?.incomePerCycle).toBe(4800)

  expect(writes).toEqual([])
  const assertNoOverflow = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  }
  await assertNoOverflow()
  const viewport = page.viewportSize()!
  if (viewport.width === 390 || viewport.width === 1440) {
    await page.setViewportSize({ ...viewport, width: viewport.width === 390 ? 320 : 1024 })
    await assertNoOverflow()
    const toggle = december.locator('summary')
    expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(viewport.width === 390 ? 44 : 36)
  }
})
