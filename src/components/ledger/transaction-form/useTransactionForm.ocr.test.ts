import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionForm, type UseTransactionFormOptions } from './useTransactionForm'

const apiMocks = vi.hoisted(() => ({
  startReceiptScan: vi.fn(),
}))

vi.mock('../../../lib/api', () => ({
  startReceiptScan: apiMocks.startReceiptScan,
  suggestTransactionCategories: vi.fn(),
  suggestTransactionNotes: vi.fn(),
}))

function createOptions(overrides: Partial<UseTransactionFormOptions> = {}): UseTransactionFormOptions {
  return {
    categories: [{ id: 'food', name: 'Food' }],
    currency: 'MYR',
    hideSensitive: false,
    autocompleteSuggestions: [],
    transactions: [],
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    stabilityBalance: 0,
    stabilityTarget: 10_000,
    stabilityOverflowRedirect: 'Rewards',
    onAddTransaction: vi.fn(),
    onUpdateTransaction: vi.fn(),
    onReceiptScanStarted: vi.fn(),
    onReceiptScanCleared: vi.fn(),
    activeScanJobIds: [],
    ...overrides,
  }
}

describe('useTransactionForm receipt cleanup', () => {
  beforeEach(() => {
    apiMocks.startReceiptScan.mockReset()
  })

  it('issues one clear callback when cancelling an active scan', async () => {
    apiMocks.startReceiptScan.mockResolvedValue({ scanId: 'scan-pending', status: 'queued' })
    const onReceiptScanCleared = vi.fn()
    const options = createOptions({ onReceiptScanCleared })
    const { result } = renderHook(() => useTransactionForm(options))

    await act(async () => {
      await result.current.scanner.handleScanReceipt(
        new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      )
    })

    act(() => {
      result.current.handleCloseForm()
    })

    expect(onReceiptScanCleared).toHaveBeenCalledTimes(1)
    expect(onReceiptScanCleared).toHaveBeenCalledWith('scan-pending')
  })
})
