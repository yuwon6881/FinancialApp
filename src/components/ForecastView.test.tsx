import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CashFlowForecast, ForecastCycle, ForecastScenario } from '../types'

const fetchCashFlowForecast = vi.fn<(scenario: ForecastScenario, signal?: AbortSignal) => Promise<CashFlowForecast>>()
vi.mock('../lib/api/forecast', () => ({ fetchCashFlowForecast: (...args: Parameters<typeof fetchCashFlowForecast>) => fetchCashFlowForecast(...args) }))

import { ForecastView } from './ForecastView'
import { AppPrefsContext } from '../contexts/AppContext'

const buckets = (essentials: number) => ({ Essentials: essentials, Growth: 0, Stability: 0, Rewards: 0 })

function cycle(overrides: Partial<ForecastCycle> = {}): ForecastCycle {
  return {
    start: '2026-11-28',
    end: '2026-12-27',
    label: 'Dec 2026',
    isCurrent: false,
    opening: buckets(1000),
    moneyIn: buckets(0),
    moneyOut: buckets(170),
    closing: buckets(830),
    lines: [{ date: '2026-12-05', label: 'Gym', bucket: 'Essentials', amount: -170, kind: 'Bill', sourceId: 'gym:2026-12-05' }],
    shortBuckets: [],
    stabilityTargetReached: false,
    ...overrides,
  }
}

const response = (overrides: Partial<CashFlowForecast> = {}): CashFlowForecast => ({
  today: '2026-11-23',
  stabilityTarget: 10000,
  skippedBills: [],
  forecast: { cycles: [cycle()], incomeKnown: false, everydaySpendingIncluded: false, stabilityTargetReachedOn: null },
  ...overrides,
})

function renderView(hideSensitive = false) {
  return render(
    <AppPrefsContext.Provider value={{ currency: 'MYR', hideSensitive } as never}>
      <ForecastView />
    </AppPrefsContext.Provider>,
  )
}

const lastScenario = () => fetchCashFlowForecast.mock.calls.at(-1)![0]

describe('ForecastView', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchCashFlowForecast.mockReset()
    fetchCashFlowForecast.mockResolvedValue(response())
  })

  it('says plainly that nothing here is saved, and explains what is assumed', async () => {
    renderView()

    expect(screen.getByRole('note').textContent).toContain('Nothing you change here is saved to your records.')
    expect(await screen.findByText(/No income is included yet/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Dec 2026' })).toBeTruthy()
  })

  it('sends a what-if item to the forecast without saving it anywhere else', async () => {
    renderView()
    await screen.findByRole('heading', { name: 'Dec 2026' })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Tooth crown' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1800' } })
    fireEvent.click(screen.getByRole('button', { name: /Add what-if/ }))

    await waitFor(() => expect(lastScenario().items).toHaveLength(1))
    expect(lastScenario().items[0]).toMatchObject({ label: 'Tooth crown', amount: -1800, bucket: 'Essentials' })
    expect(screen.getByRole('button', { name: /Reset what-ifs/ })).toHaveProperty('disabled', false)
  })

  it('skips a bill from the cycle card and offers to include it again', async () => {
    renderView()
    await screen.findByText('1 movement')
    fetchCashFlowForecast.mockResolvedValue(response({
      skippedBills: [{ date: '2026-12-05', amount: -170, bucket: 'Essentials', label: 'Gym', sourceId: 'gym:2026-12-05' }],
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Skip Gym on 2026-12-05 in this forecast' }))

    await waitFor(() => expect(lastScenario().skippedBills).toEqual(['gym:2026-12-05']))
    const skipped = await screen.findByRole('heading', { name: 'Skipped in this scenario' })
    fireEvent.click(within(skipped.parentElement!).getByRole('button', { name: 'Include again' }))
    await waitFor(() => expect(lastScenario().skippedBills).toEqual([]))
  })

  it('flags a bucket that runs short', async () => {
    fetchCashFlowForecast.mockResolvedValue(response({
      forecast: { cycles: [cycle({ closing: buckets(-800), shortBuckets: ['Essentials'] })], incomeKnown: true, everydaySpendingIncluded: false, stabilityTargetReachedOn: null },
    }))
    renderView()

    expect(await screen.findByText('Short in Essentials')).toBeTruthy()
  })

  it('hides amounts and scenario inputs in sensitive mode', async () => {
    renderView(true)
    await screen.findByRole('heading', { name: 'Dec 2026' })

    expect(screen.queryByLabelText('Income each cycle')).toBeNull()
    expect(screen.getByText(/Amounts are hidden/)).toBeTruthy()
    expect(screen.queryByText(/830/)).toBeNull()
  })

  it('shows a retry when the forecast cannot load', async () => {
    fetchCashFlowForecast.mockRejectedValueOnce(new Error('Service waking up'))
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Dec 2026' })).toBeTruthy()
  })
})
