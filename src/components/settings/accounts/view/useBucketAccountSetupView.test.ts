import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BucketAccountReconciliation } from '../../../../lib/accountReconciliation'
import type { LedgerAccount } from '../../../../types'
import {
  canReviewBucketAccountSetup,
  hasBucketAccountSetupChanged,
  useBucketAccountSetupView,
  type BucketSetupSessionSnapshot,
} from './useBucketAccountSetupView'

const account = (overrides: Partial<BucketSetupSessionSnapshot['accounts'][number]> = {}) => ({
  id: 'main',
  name: 'Main account',
  kind: 'Bank' as const,
  isArchived: false,
  isDefault: true,
  remaining: 100,
  ...overrides,
})

const sessionSnapshot: BucketSetupSessionSnapshot = {
  bucketTotal: 100,
  accounts: [account()],
}

const ledgerAccount = (remaining: number): LedgerAccount => ({
  id: 'main',
  name: 'Main account',
  bucket: 'Stability',
  kind: 'Bank',
  interestEnabled: false,
  interestRatePercent: 0,
  interestFrequency: 'Monthly',
  isDefault: true,
  isArchived: false,
  remaining,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

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

describe('hasBucketAccountSetupChanged', () => {
  it('accepts the same account snapshot', () => {
    expect(hasBucketAccountSetupChanged(sessionSnapshot, 100, [account()])).toBe(false)
  })

  it('detects a changed bucket total or account balance', () => {
    expect(hasBucketAccountSetupChanged(sessionSnapshot, 101, [account()])).toBe(true)
    expect(hasBucketAccountSetupChanged(sessionSnapshot, 100, [account({ remaining: 101 })])).toBe(true)
  })

  it('detects an account row being added or changed', () => {
    expect(hasBucketAccountSetupChanged(sessionSnapshot, 100, [account(), account({ id: 'cash', name: 'Cash' })])).toBe(true)
    expect(hasBucketAccountSetupChanged(sessionSnapshot, 100, [account({ isDefault: false })])).toBe(true)
  })
})

describe('useBucketAccountSetupView review flow', () => {
  it('allows a review to correct an inconsistent starting total', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(150)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('150.00'))
    act(() => result.current.updateTarget('main', '100.00'))
    act(() => result.current.prepareReview())

    expect(result.current.errors.form).toBeUndefined()
    expect(result.current.pending?.preview.bucketDifference).toBe(0)
  })

  it('lets a new row take the default over from the account the migration created', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    expect(result.current.hasLiveDefault).toBe(true)
    // Nothing is promoted until the user asks for it, so an ordinary added row leaves the
    // existing default alone and says nothing about moving it.
    act(() => result.current.addDraft())
    expect(result.current.defaultMovesFrom).toBeNull()

    const draftId = result.current.drafts[0].id
    act(() => result.current.updateDraftDefault(draftId, true))

    expect(result.current.promotedDraftId).toBe(draftId)
    expect(result.current.defaultMovesFrom?.name).toBe('Main account')

    act(() => result.current.updateDraftDefault(draftId, false))
    expect(result.current.promotedDraftId).toBeNull()
    expect(result.current.defaultMovesFrom).toBeNull()
  })

  it('still blocks a review when the live account changed during editing', async () => {
    const { result, rerender } = renderHook(
      ({ remaining }: { remaining: number }) => useBucketAccountSetupView({
        isOpen: true,
        bucket: 'Stability',
        accounts: [ledgerAccount(remaining)],
        bucketTotal: 100,
      }),
      { initialProps: { remaining: 150 } },
    )

    await waitFor(() => expect(result.current.targetInputs.main).toBe('150.00'))
    rerender({ remaining: 155 })
    act(() => result.current.updateTarget('main', '100.00'))
    act(() => result.current.prepareReview())

    expect(result.current.pending).toBeNull()
    expect(result.current.errors.form).toContain('changed while this form was open')
  })
})
