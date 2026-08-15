import { describe, expect, it } from 'vitest'
import type { LedgerAccount } from '../types'
import type { QueuedOp } from './outbox'
import { migrateAccountPlacementOperations } from './accountPlacementMigration'

const buckets = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const

function account(id: string, bucket: LedgerAccount['bucket'], overrides: Partial<LedgerAccount> = {}): LedgerAccount {
  return {
    id,
    name: id,
    bucket,
    kind: 'Bank',
    interestEnabled: false,
    interestRatePercent: 0,
    interestFrequency: 'Monthly',
    isArchived: false,
    remaining: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function op(overrides: Partial<QueuedOp>): QueuedOp {
  return {
    id: 'op-1',
    entity: 'transaction',
    type: 'add',
    targetId: 'tx-1',
    createdAt: 1,
    retryCount: 0,
    ...overrides,
  }
}

describe('migrateAccountPlacementOperations', () => {
  it('fills unambiguous placements for ordinary, income, recurring and reward operations', () => {
    const accounts = buckets.map(bucket => account(`acct-${bucket.toLowerCase()}`, bucket))
    const income = op({
      id: 'income-op',
      targetId: 'income-1',
      payload: { ledgerCategory: 'IncomeSplit:25,25,25,25', splitAccountIds: {} },
    })
    const recurring = op({
      id: 'recurring-op',
      entity: 'recurringPayment',
      targetId: 'bill-1',
      payload: { ledgerCategory: 'Essentials', accountId: undefined },
    })
    const reward = op({
      id: 'reward-op',
      entity: 'wishlistItem',
      type: 'purchase',
      targetId: '7',
      payload: { accountId: undefined },
    })

    const result = migrateAccountPlacementOperations([
      income,
      recurring,
      reward,
      op({
        id: 'ordinary-op',
        targetId: 'expense-1',
        payload: { ledgerCategory: 'Growth', accountId: undefined },
      }),
    ], [], accounts)

    expect(result.failedOps).toEqual([])
    expect(result.reviewCount).toBe(0)
    expect(result.pendingOps.find(item => item.id === 'ordinary-op')?.payload?.accountId).toBe('acct-growth')
    expect(result.pendingOps.find(item => item.id === 'recurring-op')?.payload?.accountId).toBe('acct-essentials')
    expect(result.pendingOps.find(item => item.id === 'reward-op')?.payload?.accountId).toBe('acct-rewards')
    expect(result.pendingOps.find(item => item.id === 'income-op')?.payload?.splitAccountIds).toEqual({
      Essentials: 'acct-essentials',
      Growth: 'acct-growth',
      Stability: 'acct-stability',
      Rewards: 'acct-rewards',
    })
  })

  it('moves ambiguous pending operations to failed review without changing their identity', () => {
    const accounts = [
      account('essentials-1', 'Essentials'),
      account('essentials-2', 'Essentials'),
      account('growth-1', 'Growth'),
      account('stability-1', 'Stability'),
      account('rewards-1', 'Rewards'),
    ]
    const original = op({
      id: 'ambiguous-op',
      targetId: 'expense-1',
      payload: { ledgerCategory: 'Essentials', accountId: undefined, date: '2026-08-10' },
    })

    const result = migrateAccountPlacementOperations([original], [], accounts)

    expect(result.pendingOps).toEqual([])
    expect(result.failedOps).toHaveLength(1)
    expect(result.failedOps[0]).toMatchObject({
      id: original.id,
      targetId: original.targetId,
      payload: original.payload,
      needsAccountReview: true,
      needsAccountReviewBuckets: ['Essentials'],
    })
    expect(result.failedOps[0].lastError).toContain('Needs account')
  })

  it('requeues a review-blocked operation once its account becomes unambiguous', () => {
    const blocked = op({
      id: 'blocked-op',
      targetId: 'expense-1',
      payload: { ledgerCategory: 'Rewards', date: '2026-08-10' },
      needsAccountReview: true,
      needsAccountReviewBuckets: ['Rewards'],
      lastError: 'Needs account: choose a live account for Rewards.',
    })

    const result = migrateAccountPlacementOperations(
      [],
      [blocked],
      [
        account('essentials-1', 'Essentials'),
        account('growth-1', 'Growth'),
        account('stability-1', 'Stability'),
        account('rewards-1', 'Rewards'),
      ],
    )

    expect(result.failedOps).toEqual([])
    expect(result.pendingOps).toHaveLength(1)
    expect(result.pendingOps[0]).toMatchObject({
      id: blocked.id,
      targetId: blocked.targetId,
      payload: { ...blocked.payload, accountId: 'rewards-1' },
      needsAccountReview: false,
    })
    expect(result.pendingOps[0].lastError).toBeUndefined()
  })

  it('leaves a server-refused operation in failedOps even when its placement is already valid', () => {
    const refused = op({
      id: 'reconcile-op',
      entity: 'ledgerAccountReconcile',
      type: 'add',
      targetId: 'reconcile-1',
      payload: {
        reconciliation: {
          bucket: 'Essentials',
          adjustmentAccountId: 'essentials-1',
          expectedBucketTotal: 100,
          targets: [{ id: 'essentials-1', expectedCurrent: 100, target: 250 }],
        },
      },
      lastError: 'Choose a live default account before reconciling.',
    })

    const result = migrateAccountPlacementOperations([], [refused], [account('essentials-1', 'Essentials')])

    expect(result.changed).toBe(false)
    expect(result.pendingOps).toEqual([])
    expect(result.failedOps).toEqual([refused])
  })
})
