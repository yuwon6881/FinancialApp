import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import { useInvestmentRefreshCoordinator } from './useInvestmentRefreshCoordinator'

vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) },
}))

const freshAllocation = {
  freshness: { isStale: false, hasMissingData: false },
} as Awaited<ReturnType<typeof api.fetchInvestmentAllocation>>

const staleAllocation = {
  freshness: { isStale: true, hasMissingData: false },
} as Awaited<ReturnType<typeof api.fetchInvestmentAllocation>>

describe('useInvestmentRefreshCoordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does not spend a market refresh request when allocation data is fresh', async () => {
    vi.spyOn(api, 'fetchInvestmentAllocation').mockResolvedValue(freshAllocation)
    const refresh = vi.spyOn(api, 'refreshInvestmentMarketDataAutomatically')

    renderHook(() => useInvestmentRefreshCoordinator(true, false))

    await waitFor(() => expect(api.fetchInvestmentAllocation).toHaveBeenCalledTimes(1))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes stale data and coalesces immediate resume events behind a cooldown', async () => {
    vi.spyOn(api, 'fetchInvestmentAllocation')
      .mockResolvedValueOnce(staleAllocation)
      .mockResolvedValue(freshAllocation)
    vi.spyOn(api, 'refreshInvestmentMarketDataAutomatically').mockResolvedValue({
      complete: true,
      updated: 1,
      total: 1,
    } as never)

    renderHook(() => useInvestmentRefreshCoordinator(true, false))

    await waitFor(() => expect(api.fetchInvestmentAllocation).toHaveBeenCalledTimes(2))
    expect(api.refreshInvestmentMarketDataAutomatically).toHaveBeenCalledTimes(1)

    act(() => window.dispatchEvent(new Event('pageshow')))
    await act(async () => Promise.resolve())

    expect(api.fetchInvestmentAllocation).toHaveBeenCalledTimes(2)
    expect(api.refreshInvestmentMarketDataAutomatically).toHaveBeenCalledTimes(1)
  })
})
