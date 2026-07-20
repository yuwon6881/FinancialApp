import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import { useCycleNavigation } from './useCycleNavigation'

vi.mock('../lib/api', () => ({ selectPeriod: vi.fn() }))
vi.mock('../lib/cache', () => ({
  getCachedDashboardPeriod: () => ({ month: 'Jun', year: 2026 }),
  getCachedCycleSnapshot: () => null,
}))

describe('useCycleNavigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
  })

  it('invalidates the older cycle load as soon as a newer cycle is selected', async () => {
    const loadResolvers: Array<() => void> = []
    const committedCycles: string[] = []
    const loadAll = vi.fn((month?: string, _year?: number, _background?: boolean, shouldCommit?: () => boolean) => (
      new Promise<void>(resolve => loadResolvers.push(() => {
        if (shouldCommit?.() !== false && month) committedCycles.push(month)
        resolve()
      }))
    ))
    vi.mocked(api.selectPeriod).mockResolvedValue(undefined)
    const { result } = renderHook(() => useCycleNavigation({
      loadAll,
      handleLogout: vi.fn(),
      markSessionLocked: vi.fn(),
      setDashboardData: vi.fn(),
      setTransactions: vi.fn(),
      setActiveTab: vi.fn(),
      setLedgerCyclesRange: vi.fn(),
    }))

    let firstSwitch!: Promise<void>
    await act(async () => {
      firstSwitch = result.current.handleSelectPeriod('Jul', 2026)
      await Promise.resolve()
    })
    expect(loadAll).toHaveBeenCalledTimes(1)

    let secondSwitch!: Promise<void>
    await act(async () => {
      secondSwitch = result.current.handleSelectPeriod('Aug', 2026)
      await Promise.resolve()
    })
    expect(loadAll).toHaveBeenCalledTimes(2)

    const firstCommitGuard = loadAll.mock.calls[0][3]
    const secondCommitGuard = loadAll.mock.calls[1][3]
    expect(firstCommitGuard?.()).toBe(false)
    expect(secondCommitGuard?.()).toBe(true)

    await act(async () => {
      loadResolvers.forEach(resolve => resolve())
      await Promise.all([firstSwitch, secondSwitch])
    })
    expect(committedCycles).toEqual(['Aug'])
  })
})