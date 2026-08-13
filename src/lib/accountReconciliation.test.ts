import { describe, expect, it } from 'vitest'
import { calculateBucketAccountReconciliation } from './accountReconciliation'

describe('calculateBucketAccountReconciliation', () => {
  it('moves an existing empty-bucket balance between newly added accounts without changing the bucket', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Essentials',
      bucketTotal: 100,
      existingAccounts: [],
      newAccounts: [
        { id: 'a', name: 'Main bank', target: 60, isDefault: true },
        { id: 'b', name: 'Cash', target: 40, isDefault: false },
      ],
      hasLiveDefault: false,
    })

    expect(result.currentAccountTotal).toBe(100)
    expect(result.targetAccountTotal).toBe(100)
    expect(result.bucketDifference).toBe(0)
    expect(result.accountAdjustments.map(account => [account.id, account.diff])).toEqual([
      ['a', -40],
      ['b', 40],
    ])
    expect(result.isCurrentTotalTally).toBe(true)
    expect(result.isAdjustmentTally).toBe(true)
  })

  it('requires a bucket adjustment when the requested account total differs', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Rewards',
      bucketTotal: 100,
      existingAccounts: [{ id: 'a', name: 'Wallet', current: 100, target: 130, isArchived: false }],
      newAccounts: [],
      hasLiveDefault: true,
    })

    expect(result.bucketDifference).toBe(30)
    expect(result.accountAdjustmentTotal).toBe(30)
    expect(result.accountAdjustments[0]).toMatchObject({ id: 'a', diff: 30 })
  })

  it('gives a new default account only the unassigned part when closed history remains', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Stability',
      bucketTotal: 100,
      existingAccounts: [{ id: 'closed', name: 'Old bank', current: 30, target: 0, isArchived: true }],
      newAccounts: [{ id: 'new', name: 'New bank', target: 70, isDefault: true }],
      hasLiveDefault: false,
    })

    expect(result.unassignedBalance).toBe(70)
    expect(result.currentAccountTotal).toBe(100)
    expect(result.accountAdjustments).toHaveLength(0)
    expect(result.isCurrentTotalTally).toBe(true)
  })

  it('flags an existing account partition that does not currently match its bucket', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Growth',
      bucketTotal: 100,
      existingAccounts: [{ id: 'a', name: 'Broker', current: 80, target: 80, isArchived: false }],
      newAccounts: [{ id: 'b', name: 'Cash', target: 20, isDefault: false }],
      hasLiveDefault: true,
    })

    expect(result.isCurrentTotalTally).toBe(false)
    expect(result.isAdjustmentTally).toBe(false)
  })
})
