import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../../types'
import { useLedgerBulkSelection } from './useLedgerBulkSelection'

const transaction = (id: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-08-08',
  description: id,
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -10,
  ...overrides,
})

const options = (transactions: Transaction[], resetKey = 'one') => ({
  transactions,
  isDeleting: () => false,
  isSyncing: () => false,
  hideSensitive: false,
  resetKey,
})

describe('useLedgerBulkSelection', () => {
  it('selects a split parent once and protects commitment completions', () => {
    const rows = [
      transaction('salary'),
      transaction('salary-split-essentials', { ledgerCategory: 'Transfer: Essentials', amount: 5 }),
      transaction('completion', { savingsGoalId: 4 }),
    ]
    const { result } = renderHook(() => useLedgerBulkSelection(options(rows)))

    act(() => result.current.startSelection())
    act(() => result.current.toggleSelected(rows[1]))

    expect(result.current.selectedCount).toBe(1)
    expect(result.current.selectedIds.has('salary')).toBe(true)
    expect(result.current.canSelect(rows[2])).toBe(false)
    expect(result.current.isSelected(rows[0])).toBe(true)

    const parentFirst = renderHook(() => useLedgerBulkSelection(options([rows[0], rows[1]])))
    act(() => parentFirst.result.current.startSelection())
    act(() => parentFirst.result.current.toggleSelectAll())
    expect(parentFirst.result.current.selectedTransactions[0].id).toBe('salary')
  })

  it('protects a split child when its parent is a commitment completion', () => {
    const parent = transaction('completion', { savingsGoalId: 4 })
    const child = transaction('completion-split-Rewards', { ledgerCategory: 'Transfer:Income->Rewards' })
    const { result } = renderHook(() => useLedgerBulkSelection({
      ...options([child]),
      allTransactions: [parent, child],
    }))

    expect(result.current.canSelect(child)).toBe(false)
    act(() => result.current.startSelection())
    act(() => result.current.toggleSelectAll())
    expect(result.current.selectedCount).toBe(0)
  })

  it('caps selection at 100 and clears on a filter/cycle reset', () => {
    const rows = Array.from({ length: 101 }, (_, index) => transaction(`tx-${index}`))
    const { result, rerender } = renderHook(({ resetKey }) => useLedgerBulkSelection(options(rows, resetKey)), {
      initialProps: { resetKey: 'one' },
    })

    act(() => {
      result.current.startSelection()
      result.current.toggleSelectAll()
    })
    expect(result.current.selectedCount).toBe(100)
    expect(result.current.exceedsLimit).toBe(false)

    rerender({ resetKey: 'two' })
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.isSelecting).toBe(false)
  })
})
