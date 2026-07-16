import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { compareTransactionsNewestFirst, mergeTransactionsNewestFirst } from './transactionOrdering'

function transaction(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'postedAt'>): Transaction {
  return {
    date: '2026-07-16',
    description: partial.id,
    category: 'Other',
    ledgerCategory: 'Essentials',
    amount: -1,
    ...partial,
  }
}

describe('transaction ordering', () => {
  it('puts a newer manual transaction above an older optimistic AI transaction', () => {
    const aiTransaction = transaction({
      id: 'ai-transaction',
      postedAt: '2026-07-16T04:00:00.000Z',
      isPendingSync: true,
    })
    const manualTransaction = transaction({
      id: 'manual-transaction',
      postedAt: '2026-07-16T05:00:00.000Z',
    })

    expect(mergeTransactionsNewestFirst([manualTransaction], [aiTransaction]).map(item => item.id))
      .toEqual(['manual-transaction', 'ai-transaction'])
  })

  it('deduplicates a recently synced row and keeps its optimistic state', () => {
    const serverTransaction = transaction({
      id: 'same-id',
      postedAt: '2026-07-16T04:00:00.000Z',
    })
    const optimisticTransaction = { ...serverTransaction, isPendingSync: true }

    expect(mergeTransactionsNewestFirst([serverTransaction], [optimisticTransaction]))
      .toEqual([optimisticTransaction])
  })

  it('falls back to the calendar date when old records have no posting timestamp', () => {
    const older = transaction({ id: 'older', postedAt: undefined, date: '2026-07-15' })
    const newer = transaction({ id: 'newer', postedAt: undefined, date: '2026-07-16' })

    expect([older, newer].sort(compareTransactionsNewestFirst).map(item => item.id))
      .toEqual(['newer', 'older'])
  })

  it('keeps the selected calendar date primary over the creation timestamp', () => {
    const backdatedButNewlyCreated = transaction({
      id: 'backdated',
      date: '2026-07-15',
      postedAt: '2026-07-16T10:00:00.000Z',
    })
    const july16Transaction = transaction({
      id: 'july-16',
      date: '2026-07-16',
      postedAt: '2026-07-16T09:00:00.000Z',
    })

    expect([backdatedButNewlyCreated, july16Transaction]
      .sort(compareTransactionsNewestFirst)
      .map(item => item.id))
      .toEqual(['july-16', 'backdated'])
  })
})
