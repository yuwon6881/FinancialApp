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
    expect(hasBucketAccountSetupChanged(sessionSnapshot, 100, [account({ name: 'Renamed account' })])).toBe(true)
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

  it('lets a new row receive a balance correction without an account selector', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    act(() => result.current.addDraft())
    const draftId = result.current.drafts[0].id
    act(() => result.current.updateDraft(draftId, { name: 'Cash jar' }))
    act(() => result.current.updateDraftTarget(draftId, '100.00'))
    act(() => result.current.prepareReview())

    expect(result.current.pending).not.toBeNull()
    expect(result.current.pending).not.toHaveProperty('adjustmentAccountId')
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

  it('allows review when an account balance is updated to 0', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    act(() => result.current.updateTarget('main', '0.00'))
    expect(result.current.canReview).toBe(true)
    act(() => result.current.prepareReview())

    expect(result.current.errors.main).toBeUndefined()
    expect(result.current.pending).not.toBeNull()
    expect(result.current.pending?.preview.targetAccountTotal).toBe(0)
    expect(result.current.pending?.preview.bucketDifference).toBe(-100)
  })

  it('allows review when typing 0 on empty input', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    // Simulate clearing then typing 0
    act(() => result.current.updateTarget('main', ''))
    act(() => result.current.updateTarget('main', '0'))
    expect(result.current.targetInputs.main).toBe('0.00')
    expect(result.current.canReview).toBe(true)
    act(() => result.current.prepareReview())

    expect(result.current.errors.main).toBeUndefined()
    expect(result.current.pending).not.toBeNull()
  })

  it('disallows review when an account balance is negative', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    act(() => result.current.updateTarget('main', '-50.00'))
    // Review is disabled, so the reason must be visible before any review attempt.
    expect(result.current.errors.main).toBe('Account balance cannot be negative.')
    expect(result.current.canReview).toBe(false)
    act(() => result.current.prepareReview())

    expect(result.current.errors.main).toBe('Account balance cannot be negative.')
    expect(result.current.pending).toBeNull()

    act(() => result.current.updateTarget('main', '50.00'))
    expect(result.current.errors.main).toBe('')
  })

  it('does not flag a half-typed calculator expression as negative', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    act(() => result.current.updateTarget('main', '100.00-'))
    expect(result.current.errors.main).toBe('')
  })

  it('shows the negative-balance message on a new account draft as the user types', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    act(() => result.current.addDraft())
    const draftId = result.current.drafts[0].id
    act(() => result.current.updateDraftTarget(draftId, '-5.00'))

    expect(result.current.errors[`${draftId}-target`]).toBe('Account balance cannot be negative.')
    expect(result.current.canReview).toBe(false)
  })

  it('allows adding a new account draft with 0 balance', async () => {
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Stability',
      accounts: [ledgerAccount(100)],
      bucketTotal: 100,
    }))

    await waitFor(() => expect(result.current.targetInputs.main).toBe('100.00'))
    act(() => result.current.addDraft())
    const draftId = result.current.drafts[0].id
    act(() => result.current.updateDraft(draftId, { name: 'Cash jar' }))
    act(() => result.current.updateDraftTarget(draftId, '0.00'))
    expect(result.current.canReview).toBe(true)
    act(() => result.current.prepareReview())

    expect(result.current.pending).not.toBeNull()
  })

  // A credit card's balance is below zero while money is owed on it, so only its row may go negative.
  it('accepts a negative balance on a credit card row and on a prefilled card draft', async () => {
    const card: LedgerAccount = { ...ledgerAccount(-100), id: 'visa', name: 'Visa', bucket: 'Essentials', kind: 'CreditCard' }
    const bank: LedgerAccount = { ...ledgerAccount(500), bucket: 'Essentials' }
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Essentials',
      accounts: [bank, card],
      bucketTotal: 400,
      initialDraft: { name: 'Amex', kind: 'CreditCard', target: -50, creditLimit: 2000 },
    }))

    await waitFor(() => expect(result.current.targetInputs.visa).toBe('-100.00'))
    act(() => result.current.updateTarget('visa', '-250.00'))
    expect(result.current.errors.visa).toBe('')
    act(() => result.current.updateTarget('main', '-1.00'))
    expect(result.current.errors.main).toBe('Account balance cannot be negative.')
    act(() => result.current.updateTarget('main', '500.00'))

    const draft = result.current.drafts[0]
    expect(draft.target).toBe('-50.00')
    expect(draft.creditLimit).toBe(2000)
    act(() => result.current.prepareReview())
    expect(result.current.pending).not.toBeNull()
  })

  // The negative-balance error belongs to the row's type, so changing the type re-judges the amount.
  it('re-checks a draft balance when its type changes', async () => {
    const bank: LedgerAccount = { ...ledgerAccount(500), bucket: 'Essentials' }
    const { result } = renderHook(() => useBucketAccountSetupView({
      isOpen: true,
      bucket: 'Essentials',
      accounts: [bank],
      bucketTotal: 500,
    }))

    act(() => result.current.addDraft())
    const id = result.current.drafts[0].id
    act(() => result.current.updateDraftTarget(id, '-40.00'))
    expect(result.current.errors[`${id}-target`]).toBe('Account balance cannot be negative.')

    act(() => result.current.updateDraft(id, { kind: 'CreditCard' }))
    expect(result.current.errors[`${id}-target`]).toBe('')

    act(() => result.current.updateDraft(id, { kind: 'Cash' }))
    expect(result.current.errors[`${id}-target`]).toBe('Account balance cannot be negative.')
  })
})
