import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContextValue } from '../../contexts/AppContext'
import { AppProvider } from '../../contexts/AppProvider'
import type { InvestmentAllocationOverview } from '../../types'
import * as api from '../../lib/api'
import { InvestmentPlanSection } from './InvestmentPlanSection'

vi.mock('../../lib/api', () => ({
  readCachedInvestmentAllocation: vi.fn(),
  fetchInvestmentAllocation: vi.fn(),
}))

const allocation: InvestmentAllocationOverview = {
  status: 'OnTrack',
  appCurrency: 'USD',
  plan: {
    usEquityTarget: 66,
    internationalExUsTarget: 10,
    bondsTarget: 24,
    watchDrift: 3,
    alertDrift: 5,
  },
  assignments: [],
  sleeves: [],
  recommendations: [],
  incompleteReasons: [],
  freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  availableCash: 0,
}

const context: AppContextValue = {
  hideSensitive: false,
  currency: 'USD',
  darkMode: false,
  activeSyncId: null,
  deletingId: null,
  isSyncing: false,
  isOffline: false,
  formatSensitive: value => `$${value}`,
  showToast: vi.fn(),
  guardSensitive: () => true,
  operations: [],
  queueMutation: vi.fn(),
}

describe('InvestmentPlanSection sliders', () => {
  beforeEach(() => {
    vi.mocked(api.readCachedInvestmentAllocation).mockReturnValue(allocation)
    vi.mocked(api.fetchInvestmentAllocation).mockResolvedValue(allocation)
  })

  it('keeps the first sleeve lock and uses a distinct slider color per sleeve', async () => {
    render(
      <AppProvider value={context}>
        <InvestmentPlanSection />
      </AppProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Locked' }))
    await waitFor(() => expect(api.fetchInvestmentAllocation).toHaveBeenCalled())
    const usLock = screen.getByRole('button', { name: 'Lock US Equity target' })
    fireEvent.click(usLock)

    expect(screen.getByRole('button', { name: 'Unlock US Equity target' })).toBeTruthy()
    const internationalLock = screen.getByRole('button', { name: 'Lock International ex-US target' }) as HTMLButtonElement
    expect(internationalLock.disabled).toBe(true)
    fireEvent.click(internationalLock)
    expect(screen.getByRole('button', { name: 'Unlock US Equity target' })).toBeTruthy()

    expect(screen.getByRole('slider', { name: 'US Equity target' }).className).toContain('accent-blue-500')
    expect(screen.getByRole('slider', { name: 'International ex-US target' }).className).toContain('accent-amber-500')
    expect(screen.getByRole('slider', { name: 'Bonds target' }).className).toContain('accent-emerald-500')
  })

  it('lets a keyboard user reorder classifications with the grip arrow keys', async () => {
    const withAssignments: InvestmentAllocationOverview = {
      ...allocation,
      assignments: [
        { instrumentId: 'fund-a', symbol: 'AAA', name: 'Fund A', sleeve: 'USEquity', order: 0 },
        { instrumentId: 'fund-b', symbol: 'BBB', name: 'Fund B', sleeve: 'Bonds', order: 1 },
      ],
    }
    const queueMutation = vi.fn(() => true)
    vi.mocked(api.readCachedInvestmentAllocation).mockReturnValue(withAssignments)
    vi.mocked(api.fetchInvestmentAllocation).mockResolvedValue(withAssignments)

    render(
      <AppProvider value={{ ...context, queueMutation }}>
        <InvestmentPlanSection />
      </AppProvider>,
    )

    await waitFor(() => expect(api.fetchInvestmentAllocation).toHaveBeenCalled())
    const firstGrip = screen.getByRole('button', { name: /Reorder AAA\. Position 1 of 2/i })
    fireEvent.keyDown(firstGrip, { key: 'ArrowDown' })

    expect(queueMutation).toHaveBeenCalledWith(
      'investmentAllocationOrder',
      'update',
      'classification',
      expect.objectContaining({ instrumentIds: ['fund-b', 'fund-a'] }),
    )
    expect(screen.getByRole('button', { name: /Reorder BBB\. Position 1 of 2/i })).toBeTruthy()
  })

  it('shows an offline explanation instead of an endless spinner without a cached plan', () => {
    vi.mocked(api.readCachedInvestmentAllocation).mockReturnValue(null)

    render(
      <AppProvider value={{ ...context, isOffline: true }}>
        <InvestmentPlanSection />
      </AppProvider>,
    )

    expect(screen.getByText(/connect once to load your investment plan/i)).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('locks both drift sliders by default and unlocks individually', async () => {
    render(
      <AppProvider value={context}>
        <InvestmentPlanSection />
      </AppProvider>,
    )

    await waitFor(() => expect(api.fetchInvestmentAllocation).toHaveBeenCalled())

    const watchSlider = screen.getByRole('slider', { name: 'Watch when off by, in percentage points' }) as HTMLInputElement
    const alertSlider = screen.getByRole('slider', { name: 'Alert when off by, in percentage points' }) as HTMLInputElement

    expect(watchSlider.disabled).toBe(true)
    expect(alertSlider.disabled).toBe(true)
    fireEvent.change(alertSlider, { target: { value: '7' } })
    expect(alertSlider.value).toBe('5')

    const unlockWatchBtn = screen.getByRole('button', { name: 'Unlock watch drift threshold' })
    const unlockAlertBtn = screen.getByRole('button', { name: 'Unlock alert drift threshold' })

    expect(unlockWatchBtn).toBeTruthy()
    expect(unlockAlertBtn).toBeTruthy()

    fireEvent.click(unlockWatchBtn)
    expect(watchSlider.disabled).toBe(false)
    expect(alertSlider.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Lock watch drift threshold' })).toBeTruthy()

    fireEvent.change(watchSlider, { target: { value: '4' } })
    expect(watchSlider.value).toBe('4')

    fireEvent.click(screen.getByRole('button', { name: 'Lock watch drift threshold' }))
    expect(watchSlider.disabled).toBe(true)

    fireEvent.click(unlockAlertBtn)
    expect(alertSlider.disabled).toBe(false)
    expect(watchSlider.disabled).toBe(true)
    fireEvent.change(alertSlider, { target: { value: '7' } })
    expect(alertSlider.value).toBe('7')

    fireEvent.click(screen.getByRole('button', { name: 'Lock alert drift threshold' }))
    expect(alertSlider.disabled).toBe(true)
  })
})
