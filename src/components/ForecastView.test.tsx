import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      <ForecastView account="test-account" />
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

    expect(screen.getByRole('note').textContent).toContain('without changing your records')
    expect(screen.getByLabelText('Income per cycle').getAttribute('placeholder')).toBe('Optional')
    const spending = screen.getByLabelText('Everyday spending per cycle')
    expect(document.getElementById(spending.getAttribute('aria-describedby')!)?.textContent)
      .toContain('total Essentials spending for one budgeting cycle, excluding bills and loan instalments')
    expect(await screen.findByText('What’s included')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Dec 2026' })).toBeTruthy()
    expect(screen.queryByText(/runs short/)).toBeNull()
  })

  it('supports calculator expressions in scenario and what-if amount inputs', async () => {
    renderView()
    await screen.findByRole('heading', { name: 'Dec 2026' })

    const incomeInput = screen.getByLabelText('Income per cycle') as HTMLInputElement
    fireEvent.change(incomeInput, { target: { value: '4000+800' } })
    expect(screen.getByText('4800.00')).toBeTruthy()
    fireEvent.keyDown(incomeInput, { key: '=' })
    expect(incomeInput.value).toBe('4800.00')
    await waitFor(() => expect(lastScenario().incomePerCycle).toBe(4800))

    fireEvent.click(screen.getByRole('button', { name: /Add what-if/ }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Tooth crown' } })
    const amountInput = screen.getByLabelText('Amount (MYR)') as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '900*2' } })
    expect(screen.getByText('1800.00')).toBeTruthy()
    fireEvent.blur(amountInput)
    expect(amountInput.value).toBe('1800.00')
    fireEvent.click(screen.getByRole('button', { name: 'Add to forecast' }))

    await waitFor(() => expect(lastScenario().items).toHaveLength(1))
    expect(lastScenario().items[0]).toMatchObject({ label: 'Tooth crown', amount: -1800, bucket: 'Essentials' })
    expect(screen.getByRole('button', { name: /Reset what-ifs/ })).toHaveProperty('disabled', false)
  })

  it('swaps categories in adjust and resets adjustments separately from what-ifs', async () => {
    renderView()
    await screen.findByRole('heading', { name: 'Dec 2026' })

    fireEvent.click(screen.getByRole('button', { name: /Add what-if/ }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Tooth crown' } })
    fireEvent.change(screen.getByLabelText('Amount (MYR)'), { target: { value: '1800' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to forecast' }))
    await waitFor(() => expect(lastScenario().items).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Adjust Dec 2026' }))
    expect(await screen.findByRole('dialog', { name: 'Adjust Dec 2026' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Swap Direction/i }))
    fireEvent.change(screen.getByLabelText('Amount (MYR)'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to forecast' }))

    await waitFor(() => expect(lastScenario().items).toHaveLength(3))
    expect(lastScenario().items.slice(1)).toEqual([
      expect.objectContaining({ label: 'Move Essentials to Rewards', amount: -1000, bucket: 'Essentials', origin: 'adjust' }),
      expect.objectContaining({ label: 'Move Essentials to Rewards', amount: 1000, bucket: 'Rewards', origin: 'adjust' }),
    ])
    expect(screen.getByText(/Essentials → Rewards/)).toBeTruthy()

    // Resetting what-ifs keeps cycle adjustments intact.
    fireEvent.click(screen.getByRole('button', { name: /Reset what-ifs/ }))
    await waitFor(() => expect(lastScenario().items).toHaveLength(2))
    expect(screen.queryByText('Tooth crown')).toBeNull()
    expect(screen.getByText(/Essentials → Rewards/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reset what-ifs/ })).toBeNull()

    // Reset adjustments clears the remaining cycle adjustment.
    fireEvent.click(screen.getByRole('button', { name: /Reset adjustments/ }))
    await waitFor(() => expect(lastScenario().items).toHaveLength(0))
    expect(screen.queryByText(/Essentials → Rewards/)).toBeNull()
  })

  it('updates a bill toggle in the activity dialog while the server response is pending', async () => {
    vi.useFakeTimers()
    try {
      renderView()
      await act(() => vi.advanceTimersByTimeAsync(0))
      fireEvent.click(screen.getByRole('button', { name: /Activity · 1/ }))
      expect(screen.getByRole('dialog', { name: 'Cycle activity' })).toBeTruthy()
      fetchCashFlowForecast.mockImplementationOnce(() => new Promise(() => {}))

      fireEvent.click(screen.getByRole('button', { name: 'Skip Gym on 2026-12-05 in this forecast' }))
      expect(screen.getByText('1 skipped')).toBeTruthy()
      const include = screen.getByRole('button', { name: /Include again: Gym/ })
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(lastScenario().skippedBills).toEqual(['gym:2026-12-05'])
      const pendingSignal = fetchCashFlowForecast.mock.calls.at(-1)![1]

      fireEvent.click(include)
      expect(screen.queryByText('1 skipped')).toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(lastScenario().skippedBills).toEqual([])
      expect(pendingSignal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks a shortfall on the cycle card without summary prose', async () => {
    fetchCashFlowForecast.mockResolvedValue(response({
      forecast: { cycles: [cycle({ closing: buckets(-800), shortBuckets: ['Essentials'] })], incomeKnown: true, everydaySpendingIncluded: false, stabilityTargetReachedOn: null },
    }))
    renderView()

    expect(await screen.findByText('Shortfall')).toBeTruthy()
    expect(screen.queryByText(/runs short/)).toBeNull()
    expect(screen.queryByRole('list', { name: 'Shortfalls' })).toBeNull()
  })

  it('hides amounts and scenario inputs in sensitive mode', async () => {
    renderView(true)
    await screen.findByRole('heading', { name: 'Dec 2026' })

    expect(screen.queryByLabelText('Income per cycle')).toBeNull()
    expect(screen.getByText(/Amounts are hidden/)).toBeTruthy()
    expect(screen.queryByText(/830/)).toBeNull()
    expect(screen.queryByText('Gym')).toBeNull()
    expect(screen.queryByRole('button', { name: /Activity ·/ })).toBeNull()
    expect(screen.queryByText(/runs short/)).toBeNull()
  })

  it('shows a retry when the forecast cannot load', async () => {
    fetchCashFlowForecast.mockRejectedValueOnce(new Error('Service waking up'))
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Dec 2026' })).toBeTruthy()
  })
})
