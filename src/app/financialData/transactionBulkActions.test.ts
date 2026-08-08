import { describe, expect, it } from 'vitest'
import { buildBulkTransactionDeleteRequest } from './transactionBulkActions'
import type { Transaction } from '../../types'

const transaction = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-08-08',
  description: id,
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -10,
  ...extra,
})

describe('buildBulkTransactionDeleteRequest', () => {
  it('deduplicates split children to one parent snapshot', () => {
    const request = buildBulkTransactionDeleteRequest([
      transaction('tx-1-split-Essentials'),
      transaction('tx-1'),
      transaction('tx-2'),
    ])

    expect(request?.payload.transactionIds).toEqual(['tx-1', 'tx-2'])
    expect(request?.payload.transactions).toEqual([
      expect.objectContaining({ id: 'tx-1' }),
      expect.objectContaining({ id: 'tx-2' }),
    ])

    const parentFirst = buildBulkTransactionDeleteRequest([
      transaction('tx-1'),
      transaction('tx-1-split-Essentials'),
    ])
    expect(parentFirst?.payload.transactions).toEqual([
      expect.objectContaining({ id: 'tx-1' }),
    ])
  })

  it('does not build a request for protected commitment rows', () => {
    expect(buildBulkTransactionDeleteRequest([
      transaction('tx-1', { savingsGoalId: 7 }),
    ])).toBeNull()
  })

  it('canonicalizes a split-only snapshot when its parent is on another page', () => {
    const request = buildBulkTransactionDeleteRequest([
      transaction('tx-1-split-Rewards', { ledgerCategory: 'Transfer:Income->Rewards', amount: 1 }),
    ])

    expect(request?.payload.transactionIds).toEqual(['tx-1'])
    expect(request?.payload.transactions).toEqual([
      expect.objectContaining({ id: 'tx-1' }),
    ])
  })
})
