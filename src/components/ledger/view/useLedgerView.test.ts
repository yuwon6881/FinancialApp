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
})
