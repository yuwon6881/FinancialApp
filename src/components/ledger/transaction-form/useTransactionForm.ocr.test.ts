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

  it('opens a fresh outflow prefilled from a confirmed receipt share', () => {
    const { result } = renderHook(() => useTransactionForm(createOptions()))

    act(() => {
      result.current.openWithDraft({
        description: 'Shared Dinner',
        amount: 23.2,
        date: '2026-07-28',
        category: 'Food',
        ledgerCategory: 'Essentials',
        txType: 'outflow',
      })
    })

    expect(result.current.state.showAddForm).toBe(true)
    expect(result.current.state.mode).toBe('create')
    expect(result.current.state.description).toBe('Shared Dinner')
    expect(result.current.state.amount).toBe('23.20')
    expect(result.current.state.date).toBe('2026-07-28')
    expect(result.current.state.category).toBe('Food')
    expect(result.current.state.ledgerCategory).toBe('Essentials')
    expect(result.current.state.transactionType).toBe('outflow')
  })
})
