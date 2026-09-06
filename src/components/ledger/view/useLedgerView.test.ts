import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLedgerView } from './useLedgerView'
import type { Transaction } from '../../../types'
import type { QueuedOp } from '../../../lib/outboxTypes'

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
    expect(rowEl.classList.contains('search-target-highlight')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2600)
    })

    expect(rowEl.classList.contains('search-target-highlight')).toBe(false)
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
    expect(result.current.pageSize).toBe(10)
    act(() => result.current.setPageSize(50))
    rerender({ showAllCycles: false })
    expect(result.current.pageSize).toBe(25)
  })

  it('refetches when the scoped range narrows the window without changing a filter', async () => {
    const onFetchPagedTransactions = vi.fn().mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const { rerender } = renderHook(
      ({ cyclesRange }: { cyclesRange: '3month' | '6month' }) => useLedgerView({
        transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
        cycleDay: 28, isMobile: false, showAllCycles: true, cyclesRange,
        onFetchPagedTransactions, onDeleteTransaction: vi.fn(),
        hideSensitive: false, formRef: { current: null },
      }),
      { initialProps: { cyclesRange: '3month' } },
    )

    await waitFor(() => expect(onFetchPagedTransactions).toHaveBeenCalledTimes(1))
    const threeCycleStart = onFetchPagedTransactions.mock.calls[0][0].startDate

    rerender({ cyclesRange: '6month' })

    await waitFor(() => expect(onFetchPagedTransactions).toHaveBeenCalledTimes(2))
    expect(onFetchPagedTransactions.mock.calls[1][0].startDate).not.toBe(threeCycleStart)
  })

  it('refetches when the selected cycle moves the window in a scoped range', async () => {
    const onFetchPagedTransactions = vi.fn().mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const { rerender } = renderHook(
      ({ selectedYear }) => useLedgerView({
        transactions: [], categories: [], selectedMonth: 'Aug', selectedYear,
        cycleDay: 28, isMobile: false, showAllCycles: true, cyclesRange: 'yearly',
        onFetchPagedTransactions, onDeleteTransaction: vi.fn(),
        hideSensitive: false, formRef: { current: null },
      }),
      { initialProps: { selectedYear: 2026 } },
    )

    await waitFor(() => expect(onFetchPagedTransactions).toHaveBeenCalledTimes(1))
    expect(onFetchPagedTransactions.mock.calls[0][0].startDate).toContain('2026')

    rerender({ selectedYear: 2025 })

    await waitFor(() => expect(onFetchPagedTransactions).toHaveBeenCalledTimes(2))
    expect(onFetchPagedTransactions.mock.calls[1][0].startDate).toContain('2025')
  })

  it('shows matching unsynced entries separately and keeps saved rows authoritative', async () => {
    const pending = baseTransaction('pending', true)
    const saved = baseTransaction('saved')
    const onFetchPagedTransactions = vi.fn().mockResolvedValue({
      items: [pending, saved], total: 2, page: 1, pageSize: 10,
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
      incomingReloadFilter: 'partly-repaid',
      onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
    }))

    await waitFor(() => expect(result.current.serverError).toContain('try again'))
    await act(() => result.current.retryServerFetch())
    expect(onFetchPagedTransactions).toHaveBeenCalledTimes(2)
    expect(onFetchPagedTransactions).toHaveBeenLastCalledWith(expect.objectContaining({
      reloadFilter: 'partly-repaid',
    }))
  })

  it('withdraws the superseded page instead of showing it while the next one loads', async () => {
    const pageOne = baseTransaction('page-1-row')
    const pageTwo = baseTransaction('page-2-row')
    let releaseSecondPage: ((value: unknown) => void) | undefined
    const onFetchPagedTransactions = vi.fn()
      // Total spans more than one page at the all-cycles page size, so page 2 is real and the
      // out-of-range clamp cannot pull the request back to page 1.
      .mockResolvedValueOnce({ items: [pageOne], total: 250, page: 1, pageSize: 10 })
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
      releaseSecondPage?.({ items: [pageTwo], total: 250, page: 2, pageSize: 10 })
    })

    await waitFor(() => expect(result.current.displayTransactions.map(t => t.id)).toEqual(['page-2-row']))
    expect(result.current.serverIsReplacingRows).toBe(false)
  })

  it('shows loading for a rows-per-page change as well as a page turn', async () => {
    const row = baseTransaction('row')
    let releaseResize: ((value: unknown) => void) | undefined
    const onFetchPagedTransactions = vi.fn()
      .mockResolvedValueOnce({ items: [row], total: 1, page: 1, pageSize: 10 })
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
      .mockResolvedValueOnce({ items: [row], total: 1, page: 1, pageSize: 10 })
      .mockImplementationOnce(() => new Promise(resolve => {
        releaseRevalidation = resolve
      }))

    const { result, rerender } = renderHook(
      ({ activeSyncId }) => useLedgerView({
        transactions: [], categories: [], selectedMonth: 'Aug', selectedYear: 2026,
        cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
        incomingReloadFilter: 'complete',
        onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
        activeSyncId,
      }),
      { initialProps: { activeSyncId: null as string | null } },
    )

    await waitFor(() => expect(result.current.displayTransactions.map(t => t.id)).toEqual(['row']))

    rerender({ activeSyncId: 'op-1' })
    rerender({ activeSyncId: null })

    await waitFor(() => expect(result.current.serverIsFetching).toBe(true))
    expect(onFetchPagedTransactions).toHaveBeenLastCalledWith(expect.objectContaining({
      reloadFilter: 'complete',
    }))
    expect(result.current.serverIsReplacingRows).toBe(false)
    expect(result.current.displayTransactions.map(t => t.id)).toEqual(['row'])

    await act(async () => {
      releaseRevalidation?.({ items: [row], total: 1, page: 1, pageSize: 10 })
    })
  })

  // A bulk move's targetId is synthetic, so retention keyed on it matched no row and the moved
  // salary plus its four generated children blinked out between dispatch and the refresh.
  it('holds a moved parent and its split rows on screen until the refresh lands', async () => {
    const parent = baseTransaction('tx-1')
    const children = ['Essentials', 'Growth', 'Stability', 'Rewards']
      .map(bucket => baseTransaction(`tx-1-split-${bucket}`))
    const movedRows = [parent, ...children].map(row => ({ ...row, date: '2026-08-25' }))

    let releaseRevalidation: ((value: unknown) => void) | undefined
    const onFetchPagedTransactions = vi.fn()
      .mockResolvedValueOnce({ items: [parent, ...children], total: 5, page: 1, pageSize: 10 })
      .mockImplementationOnce(() => new Promise(resolve => {
        releaseRevalidation = resolve
      }))

    const moveOp: QueuedOp = {
      id: 'op-move-1',
      entity: 'transaction',
      type: 'bulkMove',
      targetId: 'move-123',
      createdAt: 1,
      retryCount: 0,
      payload: {
        moves: [{ id: 'tx-1', targetDate: '2026-08-25' }],
        beforeSnapshots: [{ id: 'tx-1', date: '2026-08-20' }],
      },
    }

    const { result, rerender } = renderHook(
      ({ activeSyncId, operations }) => useLedgerView({
        transactions: movedRows, categories: [], selectedMonth: 'Aug', selectedYear: 2026,
        cycleDay: 28, isMobile: false, showAllCycles: true, onFetchPagedTransactions,
        onDeleteTransaction: vi.fn(), hideSensitive: false, formRef: { current: null },
        activeSyncId, operations,
      }),
      { initialProps: { activeSyncId: null as string | null, operations: [] as typeof moveOp[] } },
    )

    await waitFor(() => expect(result.current.displayTransactions.length).toBe(5))

    // Dispatch in flight, then completed-but-not-yet-refreshed: the operation stays in activeOps
    // with isCompleted, which is exactly the window the rows used to vanish in.
    rerender({ activeSyncId: 'move-123', operations: [moveOp] })
    rerender({ activeSyncId: null, operations: [{ ...moveOp, isCompleted: true }] })

    await waitFor(() => expect(result.current.serverIsFetching).toBe(true))
    expect(result.current.serverIsReplacingRows).toBe(false)
    expect(result.current.syncingTransactions.map(t => String(t.id)).sort()).toEqual(
      ['tx-1', 'tx-1-split-Essentials', 'tx-1-split-Growth', 'tx-1-split-Rewards', 'tx-1-split-Stability'],
    )

    await act(async () => {
      releaseRevalidation?.({ items: movedRows, total: 5, page: 1, pageSize: 10 })
    })

    // The refresh succeeded, so the outbox drops the completed operation. The rows hand over from
    // the retained list to the server list without passing through a frame that shows neither.
    rerender({ activeSyncId: null, operations: [] })
    expect(result.current.syncingTransactions).toEqual([])
    expect(result.current.displayTransactions.length).toBe(5)
  })

  it('supports multi-type filtering and resets to All Types when all 3 are selected', () => {
    const inflow: Transaction = {
      id: 'tx-inflow',
      date: '2026-08-29',
      description: 'Income',
      category: 'Salary',
      ledgerCategory: 'Income',
      amount: 1000,
    }
    const outflow: Transaction = {
      id: 'tx-outflow',
      date: '2026-08-30',
      description: 'Groceries',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -50,
    }
    const transfer: Transaction = {
      id: 'tx-transfer',
      date: '2026-08-31',
      description: 'Fund move',
      category: 'Transfer',
      ledgerCategory: 'Transfer:Essentials->Rewards',
      amount: 50,
    }

    const { result } = renderHook(() =>
      useLedgerView({
        transactions: [inflow, outflow, transfer],
        categories: [],
        selectedMonth: 'Aug',
        selectedYear: 2026,
        cycleDay: 28,
        isMobile: false,
        showAllCycles: false,
        onDeleteTransaction: vi.fn(),
        hideSensitive: false,
        formRef: { current: null },
      })
    )

    // Initially all 3 displayed
    expect(result.current.displayTransactions.length).toBe(3)

    // Select inflow
    act(() => {
      result.current.handleToggleTxType('inflow')
    })
    expect(result.current.displayTransactions.map(t => t.id)).toEqual(['tx-inflow'])

    // Select outflow as well (inflow + outflow)
    act(() => {
      result.current.handleToggleTxType('outflow')
    })
    expect(result.current.displayTransactions.map(t => t.id).sort()).toEqual(['tx-inflow', 'tx-outflow'])

    // Select transfer as well (all 3 selected -> resets to all 3 deselected / All types)
    act(() => {
      result.current.handleToggleTxType('transfer')
    })
    expect(result.current.selectedTxTypeFilter).toEqual([])
    expect(result.current.displayTransactions.length).toBe(3)
  })

  it('filters by stability put-back records in useLedgerView', () => {
    const putBack: Transaction = {
      id: 'tx-putback',
      date: '2026-08-29',
      description: 'Emergency repair',
      category: 'Emergency',
      ledgerCategory: 'Stability',
      amount: -300,
      stabilityReloadIntent: 'Required',
    }
    const spentForGood: Transaction = {
      id: 'tx-spent',
      date: '2026-08-30',
      description: 'Permanent spend',
      category: 'Emergency',
      ledgerCategory: 'Stability',
      amount: -200,
      stabilityReloadIntent: 'NotRequired',
    }

    const { result } = renderHook(() =>
      useLedgerView({
        transactions: [putBack, spentForGood],
        categories: [],
        selectedMonth: 'Aug',
        selectedYear: 2026,
        cycleDay: 28,
        isMobile: false,
        incomingReloadFilter: 'put-back',
        showAllCycles: false,
        onDeleteTransaction: vi.fn(),
        hideSensitive: false,
        formRef: { current: null },
      })
    )

    expect(result.current.displayTransactions.map(t => t.id)).toEqual(['tx-putback'])
  })
})
