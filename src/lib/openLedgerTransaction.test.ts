import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../types'
import { openLedgerTransaction } from './openLedgerTransaction'

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-08-04',
  description: 'Headphones',
  category: 'Wishlist',
  ledgerCategory: 'Rewards',
  amount: -250,
  ...overrides,
})

describe('openLedgerTransaction', () => {
  it('uses an optimistic current-cycle row without fetching', async () => {
    const fetchTransactionById = vi.fn()
    const navigate = vi.fn()

    await expect(openLedgerTransaction({
      transactionId: 'tx-1',
      transactions: [transaction()],
      cycleDay: 28,
      fetchTransactionById,
      navigate,
    })).resolves.toBe(true)

    expect(fetchTransactionById).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({
      highlightedTxId: 'tx-1',
      targetMonth: 'Jul',
      targetYear: 2026,
      range: 'monthly',
      showAllCycles: false,
    })
  })

  it('fetches a historical linked purchase before choosing its cycle', async () => {
    const fetchTransactionById = vi.fn().mockResolvedValue(transaction({ id: 'old-tx', date: '2026-01-27' }))
    const navigate = vi.fn()

    await expect(openLedgerTransaction({
      transactionId: 'old-tx',
      transactionDate: '2026-01-27',
      transactions: [],
      cycleDay: 28,
      fetchTransactionById,
      navigate,
    })).resolves.toBe(true)

    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ targetMonth: 'Dec', targetYear: 2025 }))
  })

  it('fails closed when the linked transaction is unavailable', async () => {
    const navigate = vi.fn()
    await expect(openLedgerTransaction({
      transactionId: 'missing',
      transactions: [],
      cycleDay: 28,
      fetchTransactionById: vi.fn().mockRejectedValue(new Error('offline')),
      navigate,
    })).resolves.toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})
