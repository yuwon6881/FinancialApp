import { describe, it, expect, vi } from 'vitest'

// Mock the API layer so we can assert exactly what each DISPATCH handler forwards
// without loading the API client in this unit test.
vi.mock('./api', () => ({
  toggleRecurringPayment: vi.fn(async () => ({})),
  addWishlistItem: vi.fn(async () => ({ id: 1 })),
  addSavingsGoal: vi.fn(async () => ({ id: 1 })),
  updateSavingsGoal: vi.fn(async () => undefined),
  deleteSavingsGoal: vi.fn(async () => undefined),
}))

import { applyOpsToList, enqueue, DISPATCH, getSyncSuccessToast, projectFinancialSetting, projectSettingPreference, type QueuedOp } from './outbox'
import * as api from './api'

interface TestItem {
  id: string | number
  name: string
  date?: string
  postedAt?: string
  description?: string
  category?: string
  ledgerCategory?: string
  amount?: number
  wishlistItemId?: number
  recurringPaymentId?: string | null
  active?: boolean
  isPurchased?: boolean
  purchasedAt?: string
  purchaseTransactionId?: string | null
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

function makeOp(overrides: Partial<QueuedOp>): QueuedOp {
  return {
    id: 'op-1',
    entity: 'transaction',
    type: 'update',
    targetId: '1',
    createdAt: 0,
    retryCount: 0,
    ...overrides,
  }
}

describe('DISPATCH idempotency wiring', () => {
  it('forwards the absolute active state for a recurring toggle so retries are idempotent', async () => {
    await DISPATCH['recurringPayment:toggle'](makeOp({
      entity: 'recurringPayment', type: 'toggle', targetId: 'rec-1', payload: { active: false },
    }))
    expect(api.toggleRecurringPayment).toHaveBeenCalledWith('rec-1', false)
  })

  it('omits the active arg for a legacy toggle op with no payload (server relative-flips)', async () => {
    await DISPATCH['recurringPayment:toggle'](makeOp({
      entity: 'recurringPayment', type: 'toggle', targetId: 'rec-1', payload: undefined,
    }))
    expect(api.toggleRecurringPayment).toHaveBeenCalledWith('rec-1', undefined)
  })

  it('passes the stable op id as the wishlist add idempotency key', async () => {
    await DISPATCH['wishlistItem:add'](makeOp({
      id: 'op-stable-1', entity: 'wishlistItem', type: 'add', targetId: '-42', payload: { name: 'Camera' },
    }))
    expect(api.addWishlistItem).toHaveBeenCalledWith({ name: 'Camera' }, 'op-stable-1')
  })

  it('passes the stable op id as the savings goal add idempotency key', async () => {
    await DISPATCH['savingsGoal:add'](makeOp({
      id: 'op-stable-2', entity: 'savingsGoal', type: 'add', targetId: '-99', payload: { name: 'Car service' },
    }))
    expect(api.addSavingsGoal).toHaveBeenCalledWith({ name: 'Car service' }, 'op-stable-2')
  })

  it('coerces the savings goal target id to a number for update and delete', async () => {
    await DISPATCH['savingsGoal:update'](makeOp({
      entity: 'savingsGoal', type: 'update', targetId: '7', payload: { name: 'Car service' },
    }))
    await DISPATCH['savingsGoal:delete'](makeOp({
      entity: 'savingsGoal', type: 'delete', targetId: '7',
    }))
    expect(api.updateSavingsGoal).toHaveBeenCalledWith(7, { name: 'Car service' })
    expect(api.deleteSavingsGoal).toHaveBeenCalledWith(7)
  })

  it('registers a dispatch handler for every savings goal op the UI can queue', () => {
    // The three ops the goal UI enqueues. Money movement (contribute/fund/complete) is
    // deliberately online-only, so it must NOT appear here.
    for (const key of ['savingsGoal:add', 'savingsGoal:update', 'savingsGoal:delete']) {
      expect(typeof DISPATCH[key]).toBe('function')
    }
    expect(DISPATCH['savingsGoal:contribute']).toBeUndefined()
  })
})

describe('sync success toast copy', () => {
  it.each([
    ['category', 'add', { name: 'Food' }, 'Category Added', '"Food" was added.'],
    ['category', 'delete', { name: 'Food' }, 'Category Deleted', '"Food" was deleted.'],
    ['transaction', 'delete', { description: 'Lunch' }, 'Transaction Deleted', '"Lunch" was deleted.'],
    ['recurringPayment', 'delete', { name: 'Netflix' }, 'Recurring Payment Deleted', '"Netflix" was deleted.'],
    ['vaultDocumentType', 'add', { name: 'Invoice' }, 'Document Type Added', '"Invoice" was added.'],
  ] as const)('includes the item name for %s:%s', (entity, type, payload, title, message) => {
    expect(getSyncSuccessToast(makeOp({ entity, type, payload }))).toEqual({
      title,
      message,
      tone: 'success',
    })
  })

  it('keeps the item name in the undo confirmation', () => {
    expect(getSyncSuccessToast(makeOp({
      entity: 'transaction',
      type: 'add',
      payload: { description: 'Lunch' },
      isUndo: true,
    }))).toEqual({
      title: 'Undo successful',
      message: 'The change to "Lunch" was undone.',
      tone: 'success',
    })
  })
})

describe('projectSettingPreference', () => {
  it('keeps the latest queued privacy choice over a stale dashboard response', () => {
    const ops = [
      makeOp({
        id: 'privacy-old',
        entity: 'settings',
        type: 'update',
        targetId: 'hideSensitive',
        payload: { hideSensitive: true },
        createdAt: 10,
      }),
      makeOp({
        id: 'privacy-new',
        entity: 'settings',
        type: 'update',
        targetId: 'hideSensitive',
        payload: { hideSensitive: false },
        createdAt: 20,
      }),
    ]

    expect(projectSettingPreference('hideSensitive', true, ops)).toBe(false)
  })

  it('uses the server preference when no local privacy write is active', () => {
    expect(projectSettingPreference('hideSensitive', false, [
      makeOp({ entity: 'settings', targetId: 'darkMode', payload: { darkMode: true } }),
    ])).toBe(false)
  })
})

describe('projectFinancialSetting', () => {
  it('projects all queued settings in order over a stale server snapshot', () => {
    const server = {
      targetStabilityFund: 1000,
      selectedMonth: 'July',
      selectedYear: 2026,
      essentialsAlloc: 50,
      growthAlloc: 20,
      stabilityAlloc: 20,
      rewardsAlloc: 10,
      cycleDay: 1,
      darkMode: false,
      hideSensitive: true,
      currency: 'MYR',
      lastSummaryCycleSeen: null,
    }
    const ops = [
      makeOp({
        id: 'settings',
        entity: 'settings',
        type: 'update',
        targetId: 'settings',
        payload: { currency: 'USD', cycleDay: 15 },
        createdAt: 10,
      }),
      makeOp({
        id: 'theme',
        entity: 'settings',
        type: 'update',
        targetId: 'darkMode',
        payload: { darkMode: true },
        createdAt: 20,
      }),
      makeOp({
        id: 'summary',
        entity: 'settings',
        type: 'update',
        targetId: 'summarySeen',
        payload: { cycleKey: '2026-07' },
        createdAt: 30,
      }),
    ]

    expect(projectFinancialSetting(server, ops)).toMatchObject({
      currency: 'USD',
      cycleDay: 15,
      darkMode: true,
      hideSensitive: true,
      lastSummaryCycleSeen: '2026-07',
    })
  })
})

describe('applyOpsToList — savings goals', () => {
  it('gives an optimistically added goal a numeric id so pace math still works offline', () => {
    // The server generates the int PK, so an offline add carries a negative placeholder. Leaving
    // it a string would break every id comparison and the numeric sort in orderForFunding.
    const ops = [makeOp({
      entity: 'savingsGoal', type: 'add', targetId: '-42', payload: { name: 'Car service' },
    })]

    const result = applyOpsToList([] as TestItem[], ops, 'savingsGoal')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(-42)
    expect(result[0]).toMatchObject({ name: 'Car service', isPendingSync: true })
  })

  it('merges an update into the matching goal', () => {
    const base: TestItem[] = [{ id: 7, name: 'Car service' }]
    const ops = [makeOp({
      entity: 'savingsGoal', type: 'update', targetId: '7', payload: { name: 'Car service (major)' },
    })]

    const result = applyOpsToList(base, ops, 'savingsGoal')

    expect(result[0]).toMatchObject({ id: 7, name: 'Car service (major)', isPendingSync: true })
  })

  it('marks a deleted goal pending so its earmark stops counting against the pool immediately', () => {
    const base: TestItem[] = [{ id: 7, name: 'Car service' }]
    const ops = [makeOp({ entity: 'savingsGoal', type: 'delete', targetId: '7' })]

    const result = applyOpsToList(base, ops, 'savingsGoal')

    expect(result[0]).toMatchObject({ id: 7, isPendingDelete: true, isPendingSync: true })
  })

  it('collapses an update into an unsent add rather than queuing a second op', () => {
    const addOp = makeOp({
      id: 'op-add', entity: 'savingsGoal', type: 'add', targetId: '-42', payload: { name: 'Car service' },
    })

    const next = enqueue([addOp], 'savingsGoal', 'update', '-42', { name: 'Car service (major)' })

    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ type: 'add', payload: { name: 'Car service (major)' } })
  })

  it('drops an unsent add entirely when the goal is deleted before it syncs', () => {
    const addOp = makeOp({
      id: 'op-add', entity: 'savingsGoal', type: 'add', targetId: '-42', payload: { name: 'Car service' },
    })

    expect(enqueue([addOp], 'savingsGoal', 'delete', '-42')).toEqual([])
  })

  it('labels a savings goal sync toast with the goal name', () => {
    expect(getSyncSuccessToast(makeOp({
      entity: 'savingsGoal', type: 'add', payload: { name: 'Car service' },
    }))).toMatchObject({
      title: 'Savings Goal Added',
      message: '"Car service" was added.',
    })
  })
})

describe('applyOpsToList', () => {
  it('prepends a new item for an add op and marks it pending while uncompleted', () => {
    const base: TestItem[] = []
    const ops = [makeOp({ type: 'add', targetId: 'local-1', payload: { name: 'New tx' } })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'local-1', name: 'New tx', isPendingSync: true })
  })

  it('gives an optimistic transaction its actual UTC queue timestamp', () => {
    const createdAt = Date.parse('2026-07-11T05:06:07.890Z')
    const ops = [makeOp({
      type: 'add',
      targetId: 'local-1',
      createdAt,
      payload: { name: 'Backdated tx', date: '2026-06-10' }
    })]

    const result = applyOpsToList([] as TestItem[], ops, 'transaction')

    expect(result[0].postedAt).toBe('2026-07-11T05:06:07.890Z')
  })

  it('preserves an explicitly supplied transaction timestamp', () => {
    const ops = [makeOp({
      type: 'add',
      targetId: 'local-1',
      createdAt: Date.parse('2026-07-11T05:06:07.890Z'),
      payload: { name: 'Timestamped tx', date: '2026-06-10', postedAt: '2026-06-10T01:02:03.000Z' }
    })]

    const result = applyOpsToList([] as TestItem[], ops, 'transaction')

    expect(result[0].postedAt).toBe('2026-06-10T01:02:03.000Z')
  })

  it('does not mark an add as pending once the op is flagged completed', () => {
    const ops = [makeOp({ type: 'add', targetId: 'local-1', payload: { name: 'New tx' }, isCompleted: true })]
    const result = applyOpsToList([] as TestItem[], ops, 'transaction')
    expect(result[0].isPendingSync).toBe(false)
  })

  it('replaces an existing item in place when an add op targets an id already in the list', () => {
    const base: TestItem[] = [{ id: '1', name: 'Old' }]
    const ops = [makeOp({ type: 'add', targetId: '1', payload: { name: 'Replaced' } })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Replaced')
  })

  it('merges an update payload into the matching item', () => {
    const base: TestItem[] = [{ id: '1', name: 'Old' }]
    const ops = [makeOp({ type: 'update', targetId: '1', payload: { name: 'Updated' } })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result[0]).toMatchObject({ name: 'Updated', isPendingSync: true })
  })

  it('is a no-op for an update against an id not present in the list', () => {
    const base: TestItem[] = [{ id: '1', name: 'Old' }]
    const ops = [makeOp({ type: 'update', targetId: 'missing', payload: { name: 'Updated' } })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result).toEqual(base)
  })

  it('marks the exact-id match as pending delete', () => {
    const base: TestItem[] = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
    const ops = [makeOp({ type: 'delete', targetId: '1' })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result.find(i => i.id === '1')).toMatchObject({ isPendingDelete: true, isPendingSync: true })
    expect(result.find(i => i.id === '2')?.isPendingDelete).toBeFalsy()
  })

  it('cascades a delete to split-transaction rows sharing the parent id', () => {
    const base: TestItem[] = [
      { id: 'tx1', name: 'Parent' },
      { id: 'tx1-split-0', name: 'Split A' },
      { id: 'tx1-split-1', name: 'Split B' },
      { id: 'tx2', name: 'Unrelated' },
    ]
    const ops = [makeOp({ type: 'delete', targetId: 'tx1' })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result.filter(i => i.isPendingDelete).map(i => i.id)).toEqual(['tx1', 'tx1-split-0', 'tx1-split-1'])
  })

  it('flips active to the absolute payload state for a toggle op', () => {
    const base: TestItem[] = [{ id: '1', name: 'Sub', active: true }]
    const ops = [makeOp({ entity: 'recurringPayment', type: 'toggle', targetId: '1', payload: { active: false } })]
    const result = applyOpsToList(base, ops, 'recurringPayment')
    expect(result[0].active).toBe(false)
  })

  it('falls back to relatively flipping active when a toggle op has no payload', () => {
    const base: TestItem[] = [{ id: '1', name: 'Sub', active: true }]
    const ops = [makeOp({ entity: 'recurringPayment', type: 'toggle', targetId: '1', payload: undefined })]
    const result = applyOpsToList(base, ops, 'recurringPayment')
    expect(result[0].active).toBe(false)
  })

  it('marks an item purchased for a purchase op', () => {
    const base: TestItem[] = [{ id: '1', name: 'Item' }]
    const ops = [makeOp({ entity: 'wishlistItem', type: 'purchase', targetId: '1', payload: { purchasedAt: '2026-01-01', purchaseTransactionId: 'tx-1' } })]
    const result = applyOpsToList(base, ops, 'wishlistItem')
    expect(result[0]).toMatchObject({ isPurchased: true, purchasedAt: '2026-01-01', purchaseTransactionId: 'tx-1' })
  })

  it('marks a purchased item unpurchased for an unpurchase op', () => {
    const base: TestItem[] = [{ id: '1', name: 'Item', isPurchased: true, purchasedAt: '2026-01-01', purchaseTransactionId: 'tx-1' }]
    const ops = [makeOp({ entity: 'wishlistItem', type: 'unpurchase', targetId: '1' })]
    const result = applyOpsToList(base, ops, 'wishlistItem')
    expect(result[0]).toMatchObject({ isPurchased: false, purchaseTransactionId: null, isPendingSync: true })
    expect(result[0].purchasedAt).toBeUndefined()
  })

  it('projects a pending ledger transaction for a wishlist purchase op', () => {
    const ops = [makeOp({
      entity: 'wishlistItem',
      type: 'purchase',
      targetId: '1',
      payload: { name: 'Headphones', price: 99, date: '2026-07-09', postedAt: '2026-07-09T03:00:00.000Z' }
    })]
    const result = applyOpsToList([] as TestItem[], ops, 'transaction')
    expect(result[0]).toMatchObject({
      id: 'wishlist-purchase-1',
      date: '2026-07-09',
      postedAt: '2026-07-09T03:00:00.000Z',
      description: 'Purchased: Headphones (Wish List)',
      category: 'Other',
      ledgerCategory: 'Rewards',
      amount: -99,
      wishlistItemId: 1,
      isPendingSync: true
    })
  })

  it('marks a purchased wishlist ledger transaction pending delete for an unpurchase op', () => {
    const base: TestItem[] = [{ id: 'tx-1', name: 'Headphones', description: 'Purchased: Headphones (Wish List)' }]
    const ops = [makeOp({ entity: 'wishlistItem', type: 'unpurchase', targetId: '1', payload: { purchaseTransactionId: 'tx-1' } })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result[0]).toMatchObject({ isPendingDelete: true, isPendingSync: true })
  })

  it('marks a purchased wishlist ledger transaction pending delete for a wishlist delete op', () => {
    // Undo-add (delete) of a purchased item must cascade to its linked ledger row in the
    // optimistic projection -- keyed off wishlistItemId, not the op targetId -- so the
    // transaction disappears immediately rather than lingering until the next refresh.
    const base: TestItem[] = [
      { id: 'tx-guid', name: 'Headphones', description: 'Purchased: Headphones (Wish List)', wishlistItemId: 5 },
      { id: 'tx-other', name: 'Groceries' },
    ]
    const ops = [makeOp({ entity: 'wishlistItem', type: 'delete', targetId: '5' })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result[0]).toMatchObject({ id: 'tx-guid', isPendingDelete: true, isPendingSync: true })
    expect(result[1]).toMatchObject({ id: 'tx-other' })
    expect(result[1].isPendingDelete).toBeUndefined()
  })

  it('marks a transaction pending delete for a recurring payment delete op', () => {
    const base: TestItem[] = [
      { id: 'tx-1', name: 'Netflix', description: 'Netflix Payment', recurringPaymentId: 'rec-1' },
      { id: 'tx-2', name: 'Groceries' },
    ]
    const ops = [makeOp({ entity: 'recurringPayment', type: 'delete', targetId: 'rec-1' })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result[0]).toMatchObject({ id: 'tx-1', isPendingDelete: true, isPendingSync: true })
    expect(result[1]).toMatchObject({ id: 'tx-2' })
    expect(result[1].isPendingDelete).toBeUndefined()
  })

  it('ignores ops for a different entity', () => {
    const base: TestItem[] = [{ id: '1', name: 'A' }]
    const ops = [makeOp({ type: 'update', targetId: '1', payload: { name: 'Should not apply' }, entity: 'wishlistItem' })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result).toEqual(base)
  })

  it('reverts to the base list once its op is removed from the queue (rollback)', () => {
    const base: TestItem[] = [{ id: '1', name: 'Old' }]
    const op = makeOp({ type: 'update', targetId: '1', payload: { name: 'Optimistic' } })
    const withOp = applyOpsToList(base, [op], 'transaction')
    expect(withOp[0].name).toBe('Optimistic')

    // Simulates a failed dispatch being rolled back by dropping the op from the queue.
    const afterRollback = applyOpsToList(base, [], 'transaction')
    expect(afterRollback).toEqual(base)
  })
})

describe('enqueue', () => {
  it('collapses a delete against an unsent add into no-op (cascade removes all ops for that target)', () => {
    const queue = [makeOp({ id: 'op-add', type: 'add', targetId: 'local-1', payload: { name: 'Draft' } })]
    const next = enqueue(queue, 'transaction', 'delete', 'local-1')
    expect(next).toEqual([])
  })

  it('cascade removes unsent transactions linked to an unsent recurring payment when undoing/deleting recurring payment', () => {
    const queue = [
      makeOp({ id: 'op-rec-add', entity: 'recurringPayment', type: 'add', targetId: 'rec-1', payload: { name: 'Netflix' } }),
      makeOp({ id: 'op-tx-add', entity: 'transaction', type: 'add', targetId: 'tx-1', payload: { name: 'Netflix Payment', recurringPaymentId: 'rec-1' } }),
    ]
    const next = enqueue(queue, 'recurringPayment', 'delete', 'rec-1')
    expect(next).toEqual([])
  })

  it('does not collapse a delete against an add that is currently in flight', () => {
    const addOp = makeOp({ id: 'op-add', type: 'add', targetId: 'local-1', payload: { name: 'Draft' } })
    const next = enqueue([addOp], 'transaction', 'delete', 'local-1', undefined, false, 'op-add')
    expect(next.some(op => op.type === 'delete')).toBe(true)
    expect(next.some(op => op.type === 'add')).toBe(true)
  })

  it('drops queued update/toggle ops and appends delete when deleting an existing entity', () => {
    const updateOp = makeOp({ id: 'op-update', type: 'update', targetId: '1', payload: { name: 'X' } })
    const next = enqueue([updateOp], 'transaction', 'delete', '1')
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('delete')
  })

  it('collapses a duplicate delete for an already-queued target', () => {
    const deleteOp = makeOp({ id: 'op-delete', type: 'delete', targetId: '1' })
    const next = enqueue([deleteOp], 'transaction', 'delete', '1')
    expect(next).toEqual([deleteOp])
  })

  it('merges an update into an unsent add payload instead of queueing a separate update', () => {
    const addOp = makeOp({ id: 'op-add', type: 'add', targetId: 'local-1', payload: { name: 'Draft', amount: 1 } })
    const next = enqueue([addOp], 'transaction', 'update', 'local-1', { amount: 2 })
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('add')
    expect(next[0].payload).toMatchObject({ name: 'Draft', amount: 2 })
  })

  it('replaces an existing queued update rather than stacking duplicates', () => {
    const updateOp = makeOp({ id: 'op-update', type: 'update', targetId: '1', payload: { name: 'First' } })
    const next = enqueue([updateOp], 'transaction', 'update', '1', { name: 'Second' })
    expect(next).toHaveLength(1)
    expect(next[0].payload).toMatchObject({ name: 'Second' })
  })

  it('cancels a not-yet-synced delete when the same target is re-added', () => {
    const deleteOp = makeOp({ id: 'op-delete', type: 'delete', targetId: '1' })
    const next = enqueue([deleteOp], 'transaction', 'add', '1', { name: 'Restored' })
    expect(next.some(op => op.type === 'delete')).toBe(false)
  })

  it('drops any update/toggle/purchase queued against a target that already has a pending delete', () => {
    const deleteOp = makeOp({ id: 'op-delete', type: 'delete', targetId: '1' })
    const next = enqueue([deleteOp], 'transaction', 'update', '1', { name: 'Too late' })
    expect(next).toEqual([deleteOp])
  })

  it('collapses duplicate purchase ops for the same target', () => {
    const purchaseOp = makeOp({ id: 'op-purchase', entity: 'wishlistItem', type: 'purchase', targetId: '1' })
    const next = enqueue([purchaseOp], 'wishlistItem', 'purchase', '1')
    expect(next).toEqual([purchaseOp])
  })

  it('cancels a not-yet-synced purchase when unpurchase is queued for the same target', () => {
    const purchaseOp = makeOp({ id: 'op-purchase', entity: 'wishlistItem', type: 'purchase', targetId: '1' })
    const next = enqueue([purchaseOp], 'wishlistItem', 'unpurchase', '1')
    expect(next).toEqual([])
  })

  it('queues unpurchase after an in-flight purchase so undo can reverse a synced purchase', () => {
    const purchaseOp = makeOp({ id: 'op-purchase', entity: 'wishlistItem', type: 'purchase', targetId: '1' })
    const next = enqueue([purchaseOp], 'wishlistItem', 'unpurchase', '1', undefined, true, 'op-purchase')
    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ entity: 'wishlistItem', type: 'unpurchase', targetId: '1', isUndo: true })
  })
})
