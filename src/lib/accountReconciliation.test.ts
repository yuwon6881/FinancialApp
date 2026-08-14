import { describe, expect, it } from 'vitest'
import { calculateBucketAccountReconciliation } from './accountReconciliation'

describe('calculateBucketAccountReconciliation', () => {
  it('moves an existing bucket balance between explicit accounts without changing the bucket', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Essentials',
      bucketTotal: 100,
      existingAccounts: [{ id: 'a', name: 'Main bank', current: 100, target: 60, isArchived: false }],
      newAccounts: [{ id: 'b', name: 'Cash', target: 40 }],
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

  it('requires an explicit account for a bucket-total correction', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Rewards',
      bucketTotal: 100,
      existingAccounts: [{ id: 'a', name: 'Wallet', current: 100, target: 130, isArchived: false }],
      newAccounts: [],
    })

    expect(result.bucketDifference).toBe(30)
    expect(result.accountAdjustmentTotal).toBe(30)
    expect(result.accountAdjustments[0]).toMatchObject({ id: 'a', diff: 30 })
  })

  it('keeps archived history fixed and flags account/bucket drift', () => {
    const result = calculateBucketAccountReconciliation({
      bucket: 'Stability',
      bucketTotal: 100,
      existingAccounts: [{ id: 'closed', name: 'Old bank', current: 30, target: 0, isArchived: true }],
      newAccounts: [{ id: 'new', name: 'New bank', target: 20 }],
    })

    expect(result.lines[0]).toMatchObject({ id: 'closed', current: 30, target: 30, diff: 0 })
    expect(result.currentAccountTotal).toBe(30)
    expect(result.targetAccountTotal).toBe(50)
    expect(result.isCurrentTotalTally).toBe(false)
    expect(result.isAdjustmentTally).toBe(false)
  })
})
