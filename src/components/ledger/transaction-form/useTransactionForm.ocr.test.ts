import { act, renderHook, waitFor } from '@testing-library/react'
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
    cycleDay: 28,
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
    const { result } = renderHook(() => useTransactionForm(createOptions({
      accounts: [
        { id: 'essentials-main', name: 'Main', bucket: 'Essentials', remaining: 0, isArchived: false },
        { id: 'essentials-card', name: 'Card', bucket: 'Essentials', remaining: 0, isArchived: false },
      ] as UseTransactionFormOptions['accounts'],
    })))

    act(() => {
      result.current.openWithDraft({
        description: 'Shared Dinner',
        amount: 23.2,
        date: '2026-07-28',
        category: 'Food',
        ledgerCategory: 'Essentials',
        txType: 'outflow',
        accountId: 'essentials-card',
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
    expect(result.current.state.accountId).toBe('essentials-card')
  })

  it('replaces a reserved category from a completed receipt scan before staging', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({
      autoOpenAddForm: true,
      categories: [
        { id: 'transfer', name: 'Transfer' },
        { id: 'food', name: 'Food' },
        { id: 'other', name: 'Other' },
      ],
      receiptScanDraft: {
        jobId: 'legacy-scan',
        result: {
          description: 'Lunch', amount: 12, date: '2026-07-28', category: 'Transfer',
          ledgerCategory: 'Income' as any, txType: 'transfer' as any, confidence: 0.9,
        },
      },
    })))

    await waitFor(() => expect(result.current.state.showAddForm).toBe(true))
    expect(result.current.state.transactionType).toBe('outflow')
    expect(result.current.state.category).toBe('Other')
    expect(result.current.state.ledgerCategory).toBe('Essentials')
  })

  // The completion toast's "Review" action flags autoOpenAddForm, which schedules a
  // deferred openFresh() on the next frame. That blank-create dispatch must not land on
  // top of the scan the same flag just caused to be applied.
  it('keeps a scanned receipt applied after the deferred auto-open frame runs', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({
      autoOpenAddForm: true,
      categories: [
        { id: 'food', name: 'Food' },
        { id: 'other', name: 'Other' },
      ],
      receiptScanDraft: {
        jobId: 'toast-review-scan',
        result: {
          description: 'Corner Cafe', amount: 42.5, date: '2026-07-28', category: 'Food',
          ledgerCategory: 'Essentials', txType: 'outflow', confidence: 0.9,
        },
      },
    })))

    await waitFor(() => expect(result.current.state.showAddForm).toBe(true))
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
    })

    expect(result.current.state.showAddForm).toBe(true)
    expect(result.current.state.description).toBe('Corner Cafe')
    expect(result.current.state.amount).toBe('42.50')
    expect(result.current.state.category).toBe('Food')
  })

  // Privacy mode closes any create-mode form on the next commit, and closing one clears its
  // scan job. Applying a draft while masked therefore both flashed the scanned amount and
  // destroyed the scan; it has to wait for the mask to come off instead.
  it('holds a scanned receipt back while sensitive mode is on, then applies it', async () => {
    const onReceiptScanCleared = vi.fn()
    const options = createOptions({
      hideSensitive: true,
      autoOpenAddForm: true,
      onReceiptScanCleared,
      receiptScanDraft: {
        jobId: 'masked-scan',
        result: {
          description: 'Corner Cafe', amount: 42.5, date: '2026-07-28', category: 'Food',
          ledgerCategory: 'Essentials', txType: 'outflow', confidence: 0.9,
        },
      },
    })
    const { result, rerender } = renderHook(props => useTransactionForm(props), { initialProps: options })

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
    })
    expect(result.current.state.showAddForm).toBe(false)
    expect(result.current.state.description).toBe('')
    expect(onReceiptScanCleared).not.toHaveBeenCalled()

    rerender({ ...options, hideSensitive: false })
    await waitFor(() => expect(result.current.state.showAddForm).toBe(true))
    expect(result.current.state.description).toBe('Corner Cafe')
  })

  it('opens the blank editor while the server privacy preference is pending', () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({
      hideSensitive: true,
      sensitivePreferenceStatus: 'pending',
    })))

    act(() => {
      result.current.openFresh('outflow')
    })

    expect(result.current.state.showAddForm).toBe(true)
    expect(result.current.state.transactionType).toBe('outflow')
  })

  it('preserves scanned category on inflow receipt instead of overwriting with Salary', () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({
      categories: [
        { id: 'salary', name: 'Salary' },
        { id: 'refund', name: 'Refund' },
      ],
    })))

    act(() => {
      result.current.dispatch({
        type: 'APPLY_RECEIPT',
        payload: {
          description: 'Store Refund',
          amount: 50,
          txType: 'inflow',
          category: 'Refund',
          date: '2026-07-28',
        },
        todayDate: '2026-07-28',
      })
    })

    expect(result.current.state.transactionType).toBe('inflow')
    expect(result.current.state.category).toBe('Refund')
    expect(result.current.state.ledgerCategory).toBe('Income')
  })

  // The inflow defaults are a one-time seed. Re-deriving them from the current category or ledger
  // category would make both fields impossible to change, which also takes direct bucket deposits
  // (an inflow filed straight to a bucket) off the table entirely.
  it('keeps a manually chosen category on an inflow', () => {
    const options = createOptions({
      categories: [
        { id: 'salary', name: 'Salary' },
        { id: 'bonus', name: 'Bonus' },
      ],
    })
    const { result } = renderHook(() => useTransactionForm(options))

    act(() => {
      result.current.openFresh('inflow')
    })
    expect(result.current.state.category).toBe('Salary')

    act(() => {
      result.current.dispatch({ type: 'SET_FIELD', field: 'category', value: 'Bonus' })
    })

    expect(result.current.state.category).toBe('Bonus')
  })

  it('keeps a direct bucket deposit ledger category on an inflow', () => {
    const options = createOptions()
    const { result } = renderHook(() => useTransactionForm(options))

    act(() => {
      result.current.openFresh('inflow')
    })
    expect(result.current.state.ledgerCategory).toBe('Income')

    act(() => {
      result.current.dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Rewards' })
    })

    expect(result.current.state.ledgerCategory).toBe('Rewards')
  })
})
