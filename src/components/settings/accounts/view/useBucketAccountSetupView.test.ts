import { describe, expect, it } from 'vitest'
import type { BucketAccountReconciliation } from '../../../../lib/accountReconciliation'
import { canReviewBucketAccountSetup } from './useBucketAccountSetupView'

const preview = (overrides: Partial<BucketAccountReconciliation> = {}): BucketAccountReconciliation => ({
  bucket: 'Stability',
  bucketTotal: 4228.98,
  currentAccountTotal: 4278.98,
  targetAccountTotal: 4278.98,
  bucketDifference: 50,
  accountAdjustmentTotal: 0,
  unassignedBalance: -50,
  lines: [],
  accountAdjustments: [],
  isCurrentTotalTally: false,
  isAdjustmentTally: false,
  hasChanges: false,
  ...overrides,
})

describe('canReviewBucketAccountSetup', () => {
  it('keeps review available when the starting bucket and account totals disagree', () => {
    expect(canReviewBucketAccountSetup(preview(), 0)).toBe(true)
  })

  it('stays disabled for a valid unchanged setup', () => {
    expect(canReviewBucketAccountSetup(preview({
      currentAccountTotal: 4228.98,
      targetAccountTotal: 4228.98,
      bucketDifference: 0,
      accountAdjustmentTotal: 0,
      unassignedBalance: 0,
      isCurrentTotalTally: true,
      isAdjustmentTally: true,
    }), 0)).toBe(false)
  })
})
