import { describe, expect, it } from 'vitest'
import type { QueuedOp } from '../../lib/outbox'
import { getActiveTransactionSyncIds } from './transactionSyncStatus'

function operation(overrides: Partial<QueuedOp>): QueuedOp {
  return {
    id: 'op-1',
    entity: 'transaction',
    type: 'update',
    targetId: 'tx-1',
    createdAt: 1,
    retryCount: 0,
    ...overrides,
  }
}

describe('getActiveTransactionSyncIds', () => {
  it('returns the target and operation ids for an active transaction operation', () => {
    expect(getActiveTransactionSyncIds([operation({})], 'tx-1')).toEqual(['tx-1', 'op-1'])
  })

  it('includes the synthetic purchase row for an active wishlist purchase', () => {
    expect(getActiveTransactionSyncIds([
      operation({ entity: 'wishlistItem', type: 'purchase', targetId: 'wish-1' }),
    ], 'wish-1')).toEqual(['wish-1', 'op-1', 'wishlist-purchase-wish-1'])
  })

  it('does not let a non-transaction direct mutation mark a Ledger row busy', () => {
    expect(getActiveTransactionSyncIds([
      operation({ entity: 'savingsGoal', targetId: '1' }),
    ], '1')).toEqual([])
  })

  it('clears the Ledger ids once the operation is completed', () => {
    expect(getActiveTransactionSyncIds([operation({ isCompleted: true })], 'tx-1')).toEqual([])
  })
})
