import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
        onClearAllCycles: vi.fn(),
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
        onClearAllCycles: vi.fn(),
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
          onClearAllCycles: vi.fn(),
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
