import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLedgerView } from './useLedgerView'
import type { Transaction } from '../../../types'

describe('useLedgerView highlighted transaction navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const generateTransactions = (count: number): Transaction[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `tx-${i + 1}`,
      date: '2026-08-29',
      description: `Transaction ${i + 1}`,
      category: 'General',
      ledgerCategory: 'Essentials',
      amount: -10,
    }))
  }

  it('selects the correct page directly when highlightedTxId is on page 2 or higher', () => {
    const transactions = generateTransactions(25)
    const targetId = 'tx-15'

    const onClearHighlightedTx = vi.fn()
    const { result } = renderHook(() =>
      useLedgerView({
        transactions,
        categories: [],
        selectedMonth: 'Aug',
        selectedYear: 2026,
        cycleDay: 28,
        isMobile: false,
        highlightedTxId: targetId,
        onClearHighlightedTx,
        showAllCycles: false,
        onDeleteTransaction: vi.fn(),
        hideSensitive: false,
        formRef: { current: null },
      })
    )

    expect(result.current.currentPage).toBe(2)
    expect(result.current.displayTransactions.map(t => t.id)).toContain('tx-15')
  })

  it('applies the highlight class to the row element on page 2 and clears it after delay', () => {
    const transactions = generateTransactions(25)
    const targetId = 'tx-15'

    const rowEl = document.createElement('tr')
    rowEl.id = `tx-row-desktop-${targetId}`
    rowEl.scrollIntoView = vi.fn()
    document.body.appendChild(rowEl)

    const onClearHighlightedTx = vi.fn()
    renderHook(() =>
      useLedgerView({
        transactions,
        categories: [],
        selectedMonth: 'Aug',
        selectedYear: 2026,
        cycleDay: 28,
        isMobile: false,
        highlightedTxId: targetId,
        onClearHighlightedTx,
        showAllCycles: false,
        onDeleteTransaction: vi.fn(),
        hideSensitive: false,
        formRef: { current: null },
      })
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(rowEl.scrollIntoView).toHaveBeenCalled()
    expect(rowEl.classList.contains('ledger-transaction-highlight')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(3600)
    })

    expect(rowEl.classList.contains('ledger-transaction-highlight')).toBe(false)
    expect(onClearHighlightedTx).toHaveBeenCalled()

    document.body.removeChild(rowEl)
  })

  it('retains the current page when highlightedTxId clears and only resets to page 1 on filter changes', () => {
    const transactions = generateTransactions(25)
    const targetId = 'tx-15'
    const onClearHighlightedTx = vi.fn()

    const { result, rerender } = renderHook(
      ({ highlightId, search }: { highlightId: string | null; search?: string }) =>
        useLedgerView({
          transactions,
          categories: [],
          selectedMonth: 'Aug',
          selectedYear: 2026,
          cycleDay: 28,
          isMobile: false,
          highlightedTxId: highlightId,
          incomingSearch: search,
          onClearHighlightedTx,
          showAllCycles: false,
          onDeleteTransaction: vi.fn(),
          hideSensitive: false,
          formRef: { current: null },
        }),
      {
        initialProps: { highlightId: targetId as string | null, search: '' },
      }
    )

    expect(result.current.currentPage).toBe(2)

    // Simulate timer expiring and highlightedTxId clearing to null
    act(() => {
      vi.advanceTimersByTime(3600)
    })
    expect(onClearHighlightedTx).toHaveBeenCalled()

    // Rerender with highlightedTxId = null
    rerender({ highlightId: null, search: '' })

    // MUST remain on page 2, not reset to page 1!
    expect(result.current.currentPage).toBe(2)

    // Now simulate user actively typing a search filter
    act(() => {
      result.current.setSearchTerm('Transaction 1')
    })

    // Now it should reset to page 1
    expect(result.current.currentPage).toBe(1)
  })
})

describe('useLedgerView mode parity', () => {
  const baseTransaction = (id: string, pending = false): Transaction => ({
    id,
    date: '2026-08-20',
    description: id,
    category: 'General',
    ledgerCategory: 'Essentials',
    amount: -10,
    isPendingSync: pending,
  })

  it('keeps current-cycle and all-cycle page sizes independent', () => {
    const { result, rerender } = renderHook(
      ({ showAllCycles }) => useLedgerView({
        transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
        cycleDay: 28, isMobile: false, showAllCycles, onDeleteTransaction: vi.fn(),
        hideSensitive: false, formRef: { current: null },
      }),
      { initialProps: { showAllCycles: false } },
    )

    act(() => result.current.setPageSize(25))
    rerender({ showAllCycles: true })
    expect(result.current.pageSize).toBe(100)
    act(() => result.current.setPageSize(50))
    rerender({ showAllCycles: false })
    expect(result.current.pageSize).toBe(25)
  })

  it('shows matching unsynced entries separately and keeps saved rows authoritative', async () => {
    const pending = baseTransaction('pending', true)
    const saved = baseTransaction('saved')
    const onFetchPagedTransactions = vi.fn().mockResolvedValue({
      items: [pending, saved], total: 2, page: 1, pageSize: 100,
    })
    const { result } = renderHook(() => useLedgerView({
      transactions: [pending], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
      cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
      onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
    }))

    await waitFor(() => expect(result.current.serverResult).not.toBeNull())
    expect(result.current.syncingTransactions.map(transaction => transaction.id)).toEqual(['pending'])
    expect(result.current.displayTransactions.map(transaction => transaction.id)).toEqual(['saved'])
    expect(result.current.serverResult?.total).toBe(2)
  })

  it('retains a recoverable server error instead of rejecting the effect', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onFetchPagedTransactions = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useLedgerView({
      transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
      cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
      onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
    }))

    await waitFor(() => expect(result.current.serverError).toContain('try again'))
    await act(() => result.current.retryServerFetch())
    expect(onFetchPagedTransactions).toHaveBeenCalledTimes(2)
  })

  it('withdraws the superseded page instead of showing it while the next one loads', async () => {
    const pageOne = baseTransaction('page-1-row')
    const pageTwo = baseTransaction('page-2-row')
    let releaseSecondPage: ((value: unknown) => void) | undefined
    const onFetchPagedTransactions = vi.fn()
      // Total spans more than one page at the all-cycles page size, so page 2 is real and the
      // out-of-range clamp cannot pull the request back to page 1.
      .mockResolvedValueOnce({ items: [pageOne], total: 250, page: 1, pageSize: 100 })
      .mockImplementationOnce(() => new Promise(resolve => {
        releaseSecondPage = resolve
      }))

    const { result } = renderHook(() => useLedgerView({
      transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
      cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
      onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
    }))

    await waitFor(() => expect(result.current.displayTransactions.map(t => t.id)).toEqual(['page-1-row']))

    act(() => result.current.setCurrentPage(2))
    await waitFor(() => expect(result.current.serverIsFetching).toBe(true))

    expect(result.current.serverIsReplacingRows).toBe(true)
    expect(result.current.displayTransactions).toEqual([])

    await act(async () => {
      releaseSecondPage?.({ items: [pageTwo], total: 250, page: 2, pageSize: 100 })
    })

    await waitFor(() => expect(result.current.displayTransactions.map(t => t.id)).toEqual(['page-2-row']))
    expect(result.current.serverIsReplacingRows).toBe(false)
  })

  it('shows loading for a rows-per-page change as well as a page turn', async () => {
    const row = baseTransaction('row')
    let releaseResize: ((value: unknown) => void) | undefined
    const onFetchPagedTransactions = vi.fn()
      .mockResolvedValueOnce({ items: [row], total: 1, page: 1, pageSize: 100 })
      .mockImplementationOnce(() => new Promise(resolve => {
        releaseResize = resolve
      }))

    const { result } = renderHook(() => useLedgerView({
      transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
      cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
      onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
    }))

    await waitFor(() => expect(result.current.displayTransactions.map(t => t.id)).toEqual(['row']))

    act(() => result.current.setPageSize(25))
    await waitFor(() => expect(result.current.serverIsReplacingRows).toBe(true))
    expect(result.current.displayTransactions).toEqual([])
    expect(onFetchPagedTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ pageSize: 25 }))

    await act(async () => {
      releaseResize?.({ items: [row], total: 1, page: 1, pageSize: 25 })
    })
    expect(result.current.serverIsReplacingRows).toBe(false)
  })

  it('keeps rows on screen for a background revalidation after a sync', async () => {
    const row = baseTransaction('row')
    let releaseRevalidation: ((value: unknown) => void) | undefined
    const onFetchPagedTransactions = vi.fn()
      .mockResolvedValueOnce({ items: [row], total: 1, page: 1, pageSize: 100 })
      .mockImplementationOnce(() => new Promise(resolve => {
        releaseRevalidation = resolve
      }))

    const { result, rerender } = renderHook(
      ({ activeSyncId }) => useLedgerView({
        transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
        cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
        onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
        activeSyncId,
      }),
      { initialProps: { activeSyncId: null as string | null } },
    )

    await waitFor(() => expect(result.current.displayTransactions.map(t => t.id)).toEqual(['row']))

    rerender({ activeSyncId: 'op-1' })
    rerender({ activeSyncId: null })

    await waitFor(() => expect(result.current.serverIsFetching).toBe(true))
    expect(result.current.serverIsReplacingRows).toBe(false)
    expect(result.current.displayTransactions.map(t => t.id)).toEqual(['row'])

    await act(async () => {
      releaseRevalidation?.({ items: [row], total: 1, page: 1, pageSize: 100 })
    })
  })
})
