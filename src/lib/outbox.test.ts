import { describe, it, expect, vi } from 'vitest'

// Mock the API layer so we can assert exactly what each DISPATCH handler forwards
// without loading the API client in this unit test.
vi.mock('./api', () => ({
  toggleRecurringPayment: vi.fn(async () => ({})),
  addWishlistItem: vi.fn(async () => ({ id: 1 })),
}))

import { applyOpsToList, enqueue, DISPATCH, type QueuedOp } from './outbox'
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
