import { describe, it, expect } from 'vitest'
import { collectOptimisticTransactionIds, isOptimisticRow } from './optimisticRowRetention'
import type { QueuedOp } from './outboxTypes'

const makeOp = (overrides: Partial<QueuedOp>): QueuedOp => ({
  id: 'op-1',
  entity: 'transaction',
  type: 'update',
  targetId: 'tx-1',
  createdAt: 0,
  retryCount: 0,
  ...overrides,
})

describe('collectOptimisticTransactionIds', () => {
  it('expands a bulk move into the row ids it actually touches', () => {
    const owned = collectOptimisticTransactionIds([makeOp({
      type: 'bulkMove',
      targetId: 'move-123',
      payload: {
        moves: [{ id: 'tx-1', targetDate: '2026-09-03' }, { id: 'tx-7', targetDate: '2026-09-03' }],
      },
    })])

    expect(owned.has('tx-1')).toBe(true)
    expect(owned.has('tx-7')).toBe(true)
    // The synthetic operation target is not a row and must never be treated as one.
    expect(owned.has('move-123')).toBe(false)
  })

  it('expands a bulk delete and keeps a plain single-row target', () => {
    const owned = collectOptimisticTransactionIds([
      makeOp({ type: 'bulkDelete', targetId: 'bulk-9', payload: { transactionIds: ['tx-2', 'tx-3'] } }),
      makeOp({ id: 'op-2', targetId: 'tx-4' }),
    ])

    expect([...owned].sort()).toEqual(['tx-2', 'tx-3', 'tx-4'])
  })

  it('carries the direct, non-outbox sync ids through unchanged', () => {
    const owned = collectOptimisticTransactionIds([], new Set(['tx-direct']))
    expect(owned.has('tx-direct')).toBe(true)
  })

  it('ignores operations belonging to other entities', () => {
    const owned = collectOptimisticTransactionIds([makeOp({ entity: 'savingsGoal', targetId: '12' })])
    expect(owned.size).toBe(0)
  })
})

describe('isOptimisticRow', () => {
  it('claims an income parent\'s generated split rows through the parent', () => {
    const owned = new Set(['tx-1'])
    expect(isOptimisticRow('tx-1', owned)).toBe(true)
    expect(isOptimisticRow('tx-1-split-Stability', owned)).toBe(true)
    expect(isOptimisticRow('tx-2', owned)).toBe(false)
    expect(isOptimisticRow('tx-2-split-Rewards', owned)).toBe(false)
  })
})
