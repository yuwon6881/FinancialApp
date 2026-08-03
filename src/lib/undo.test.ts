import { describe, expect, it, vi } from 'vitest'
import type { QueuedOp } from './outbox'
import { buildUndoAction, snapshotForUndo, type UndoSnapshot } from './undo'

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
      'add',
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
})
