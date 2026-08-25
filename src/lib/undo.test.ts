import { describe, expect, it, vi } from 'vitest'
import type { QueuedOp } from './outbox'
import { buildUndoAction, releaseUndoSnapshot, remapUndoSnapshotTarget, snapshotForUndo, type UndoSnapshot } from './undo'

const op = (entity: QueuedOp['entity'], type: QueuedOp['type'], targetId = '1', payload?: QueuedOp['payload']): QueuedOp => ({
  id: 'op-1', entity, type, targetId, payload, createdAt: 1, retryCount: 0,
})

describe('undo helpers', () => {
  it('captures the first clean snapshot only', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    snapshotForUndo(snapshots, 'transaction', '1', {
      id: '1', date: '2026-01-01', description: 'Before', category: 'Food',
      ledgerCategory: 'Essentials', amount: -10, isPendingSync: true,
    })
    snapshotForUndo(snapshots, 'transaction', '1', {
      id: '1', date: '2026-01-01', description: 'After', category: 'Food',
      ledgerCategory: 'Essentials', amount: -20,
    })

    expect(snapshots.get('transaction:1')).toMatchObject({ description: 'Before' })
    expect(snapshots.get('transaction:1')).not.toHaveProperty('isPendingSync')
  })

  it('restores a deleted transaction and consumes its snapshot', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    snapshotForUndo(snapshots, 'transaction', '1', {
      id: '1', date: '2026-01-01', description: 'Lunch', category: 'Food',
      ledgerCategory: 'Essentials', amount: -10,
    })
    const enqueue = vi.fn()
    const action = buildUndoAction(snapshots, op('transaction', 'delete'), undefined, enqueue)

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('transaction', 'add', '1', expect.objectContaining({ description: 'Lunch' }))
    expect(snapshots.size).toBe(0)
  })

  it('uses the server id when undoing a wishlist add', () => {
    const enqueue = vi.fn()
    const action = buildUndoAction(new Map(), op('wishlistItem', 'add', '-1'), { id: 42 } as never, enqueue)
    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('wishlistItem', 'delete', '42', undefined)
  })

  it('does not offer category-delete undo when replacement migration was requested', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    snapshotForUndo(snapshots, 'category', '1', { id: '1', name: 'Food' })
    expect(buildUndoAction(snapshots, op('category', 'delete', '1', { replacementCategoryId: '2' }), undefined, vi.fn()))
      .toBeUndefined()
  })

  it('uses the authoritative server snapshot when undoing investment activity deletion', () => {
    const enqueue = vi.fn()
    const persisted = { transactions: [{ id: 'buy', type: 'Buy' }] }
    const serverSnapshot = {
      transactions: [
        { id: 'buy', type: 'Buy' },
      ],
    }
    const action = buildUndoAction(
      new Map(),
      op('investmentActivity', 'delete', 'buy', { undoSnapshot: persisted }),
      serverSnapshot as never,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith(
      'investmentActivity',
      'restore',
      'buy',
      serverSnapshot,
    )
  })

  it('uses the normalized server record when undoing cash-flow deletion', () => {
    const enqueue = vi.fn()
    const serverSnapshot = {
      id: 'flow-1',
      accountId: 'account-1',
      currency: 'USD',
      type: 'Withdrawal',
      amount: -25,
      date: '2026-07-24',
    }
    const action = buildUndoAction(
      new Map(),
      op('investmentCashFlow', 'delete', 'flow-1', {
        undoSnapshot: { ...serverSnapshot, amount: 25 },
      }),
      serverSnapshot as never,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith(
      'investmentCashFlow',
      'restore',
      'flow-1',
      serverSnapshot,
    )
  })

  it('undoes investment plan updates from the persisted pre-change values', () => {
    const enqueue = vi.fn()
    const previous = {
      usEquityTarget: 60,
      internationalExUsTarget: 20,
      bondsTarget: 20,
      watchDrift: 5,
      alertDrift: 10,
    }
    const action = buildUndoAction(
      new Map(),
      op('investmentPlan', 'update', 'three-fund', { undoSnapshot: previous }),
      undefined,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('investmentPlan', 'update', 'three-fund', previous)
  })

  it('undoes a persisted settings preference change', () => {
    const enqueue = vi.fn()
    const action = buildUndoAction(
      new Map(),
      op('settings', 'update', 'darkMode', {
        darkMode: true,
        undoSnapshot: { darkMode: false },
      }),
      undefined,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('settings', 'update', 'darkMode', { darkMode: false })
  })

  it('restores a deleted savings goal from its persisted outbox snapshot', () => {
    const enqueue = vi.fn()
    const deletedGoal = {
      id: 7,
      name: 'Car service',
      targetAmount: 1200,
      earmarkedAmount: 300,
      targetDate: '2026-12-20',
      priority: 'Medium',
      status: 'active',
      isRecurring: false,
      recurrenceMonths: 12,
      cycleFundedAmount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const action = buildUndoAction(
      new Map(),
      op('savingsGoal', 'delete', '7', { undoSnapshot: deletedGoal }),
      undefined,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith(
      'savingsGoal',
      'restore',
      expect.any(String),
      expect.objectContaining({ name: 'Car service', earmarkedAmount: 300 }),
    )
  })

  it('opens the sensitive reveal prompt when undoing sensitive mode', () => {
    const enqueue = vi.fn()
    const requestSensitiveReveal = vi.fn()
    const action = buildUndoAction(
      new Map(),
      op('settings', 'update', 'hideSensitive', {
        hideSensitive: true,
        undoSnapshot: { hideSensitive: false },
      }),
      undefined,
      enqueue,
      requestSensitiveReveal,
    )

    action?.onAction()
    expect(requestSensitiveReveal).toHaveBeenCalledOnce()
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('re-enables sensitive mode directly when undoing a manual reveal', () => {
    const enqueue = vi.fn()
    const requestSensitiveReveal = vi.fn()
    const action = buildUndoAction(
      new Map(),
      op('settings', 'update', 'hideSensitive', {
        hideSensitive: false,
        undoSnapshot: { hideSensitive: true },
      }),
      undefined,
      enqueue,
      requestSensitiveReveal,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('settings', 'update', 'hideSensitive', { hideSensitive: true })
    expect(requestSensitiveReveal).not.toHaveBeenCalled()
  })

  it('undoes a queued reminder update from the original reminder snapshot', () => {
    const enqueue = vi.fn()
    const previous = {
      id: 'rp-1', name: 'Streaming', amount: 50, frequency: 'Monthly' as const,
      category: 'Bills', ledgerCategory: 'Needs', nextDueDate: '2026-08-01', dueDate: 1,
      startDate: '2026-01-01', active: true, reminderEnabled: false,
      reminderMode: 'Once' as const, reminderLeadDays: 3,
    }
    const action = buildUndoAction(
      new Map(),
      op('recurringPayment', 'reminder', 'rp-1', {
        name: previous.name,
        reminderEnabled: true,
        reminderMode: 'Daily',
        reminderLeadDays: 7,
        undoSnapshot: previous,
      }),
      undefined,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('recurringPayment', 'reminder', 'rp-1', expect.objectContaining({
      reminderEnabled: false,
      reminderMode: 'Once',
      reminderLeadDays: 3,
    }))
  })

  it('queues server-provided category cleanup undo actions', () => {
    const enqueue = vi.fn()
    const action = buildUndoAction(
      new Map(),
      op('category', 'cleanup', 'cleanup-1', { description: 'Old → New' }),
      { appliedCount: 1, undoActions: [{ type: 'deleteByName', categories: ['New'] }] } as never,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('category', 'cleanup', 'cleanup-1:undo', expect.objectContaining({
      actions: [{ type: 'deleteByName', categories: ['New'] }],
      description: 'Old → New',
    }))
  })

  // Loans queued both snapshot tiers long before buildUndoAction had a case for them, so every
  // loan mutation toasted without an Undo button. These pin the three cases down.
  it('offers Undo for a loan add by deleting the row it created', () => {
    const enqueue = vi.fn()
    const action = buildUndoAction(new Map(), op('loan', 'add', 'loan-1', { name: 'Car loan' }), undefined, enqueue)

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('loan', 'delete', 'loan-1', expect.objectContaining({ name: 'Car loan' }))
  })

  it('restores the previous terms when undoing a loan update', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    snapshotForUndo(snapshots, 'loan', 'loan-1', {
      id: 'loan-1', name: 'Car loan', recurringPaymentId: 'rp-1', openingPrincipal: 30000,
      trackingStartDate: '2026-01-01', annualRatePercent: 4.5, termPeriods: 60,
      interestMethod: 'ReducingBalance', snapshot: { outstandingBalance: 25000 },
    } as unknown as UndoSnapshot)
    const enqueue = vi.fn()
    const action = buildUndoAction(snapshots, op('loan', 'update', 'loan-1', { annualRatePercent: 9 }), undefined, enqueue)

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('loan', 'update', 'loan-1', expect.objectContaining({
      annualRatePercent: 4.5,
      termPeriods: 60,
    }))
  })

  it('recreates a deleted loan from the persisted payload snapshot', () => {
    const enqueue = vi.fn()
    // No in-memory snapshot: this is the post-reload path, served by op.payload.undoSnapshot.
    const action = buildUndoAction(new Map(), op('loan', 'delete', 'loan-1', {
      name: 'Car loan',
      undoSnapshot: { id: 'loan-1', name: 'Car loan', openingPrincipal: 30000 },
    }), undefined, enqueue)

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('loan', 'add', 'loan-1', expect.objectContaining({ openingPrincipal: 30000 }))
  })

  // A loan repayment is server-authoritative and reversible through its own endpoint, but the
  // success toast used to offer nothing -- so the only way back from a mis-entered advance
  // repayment was to find the rows and unpick them by hand.
  it('offers Undo for an advance repayment through the returned repayment action', () => {
    const enqueue = vi.fn()
    const action = buildUndoAction(
      new Map(),
      op('loan', 'advanceRepayment', 'loan-1', { cycles: 2, name: 'Car loan' }),
      { actionId: 'action-7', kind: 'AdvanceCycles' } as never,
      enqueue,
    )

    action?.onAction()
    // Keyed by the repayment action; the loan id rides in the payload because the projection
    // attributes the pending undo by loanId, not by targetId.
    expect(enqueue).toHaveBeenCalledWith('loan', 'undoRepayment', 'action-7', expect.objectContaining({
      loanId: 'loan-1',
      name: 'Car loan',
    }))
  })

  it('offers Undo for a full settlement through the returned repayment action', () => {
    const enqueue = vi.fn()
    const action = buildUndoAction(
      new Map(),
      op('loan', 'fullSettlement', 'loan-2', { amount: 1200, name: 'Bike loan' }),
      { actionId: 'action-9', kind: 'FullSettlement' } as never,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('loan', 'undoRepayment', 'action-9', expect.objectContaining({
      loanId: 'loan-2',
    }))
  })

  // Without an action id there is nothing to reverse. Offering an Undo button that cannot work is
  // worse than offering none.
  it('offers no repayment Undo when the server returned no action id', () => {
    expect(buildUndoAction(
      new Map(),
      op('loan', 'advanceRepayment', 'loan-1', { cycles: 1 }),
      { kind: 'AdvanceCycles' } as never,
      vi.fn(),
    )).toBeUndefined()
    expect(buildUndoAction(
      new Map(),
      op('loan', 'fullSettlement', 'loan-1', { amount: 10 }),
      undefined,
      vi.fn(),
    )).toBeUndefined()
  })

  it('releases a snapshot so a failed op cannot supply the next edit with a stale before-state', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    const v0 = { id: '1', name: 'v0', limit: 1 } as unknown as UndoSnapshot
    const v1 = { id: '1', name: 'v1', limit: 2 } as unknown as UndoSnapshot
    snapshotForUndo(snapshots, 'taxReliefCategory', '1', v0)

    // Capture is first-write-wins, so without the release the second edit keeps pointing at v0
    // and its Undo would revert past the edit the user actually kept.
    releaseUndoSnapshot(snapshots, 'taxReliefCategory', '1')
    snapshotForUndo(snapshots, 'taxReliefCategory', '1', v1)

    expect(snapshots.get('taxReliefCategory:1')).toMatchObject({ name: 'v1' })
  })

  it('follows a server-assigned id so an in-flight edit keeps its Undo', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    snapshotForUndo(snapshots, 'savingsGoal', '-5', { id: -5, name: 'Before' } as unknown as UndoSnapshot)

    remapUndoSnapshotTarget(snapshots, 'savingsGoal', '-5', '42')

    expect(snapshots.has('savingsGoal:-5')).toBe(false)
    const enqueue = vi.fn()
    buildUndoAction(snapshots, op('savingsGoal', 'update', '42'), undefined, enqueue)?.onAction()
    expect(enqueue).toHaveBeenCalledWith('savingsGoal', 'update', '42', expect.objectContaining({ name: 'Before' }))
  })

  it('restores the previous due date when undoing a bill toggle', () => {
    const snapshots = new Map<string, UndoSnapshot>()
    snapshotForUndo(snapshots, 'recurringPayment', 'rp-1', {
      id: 'rp-1', name: 'Rent', active: false, nextDueDate: '2026-03-01',
    } as unknown as UndoSnapshot)
    const enqueue = vi.fn()
    const action = buildUndoAction(
      snapshots,
      op('recurringPayment', 'toggle', 'rp-1', { active: true, name: 'Rent', nextDueDate: '2026-09-01' }),
      undefined,
      enqueue,
    )

    action?.onAction()
    expect(enqueue).toHaveBeenCalledWith('recurringPayment', 'toggle', 'rp-1', expect.objectContaining({
      active: false,
      nextDueDate: '2026-03-01',
    }))
  })
})
