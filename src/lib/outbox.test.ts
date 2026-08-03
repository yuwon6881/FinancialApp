import { describe, it, expect, vi } from 'vitest'

// Mock the API layer so we can assert exactly what each DISPATCH handler forwards
// without loading the API client in this unit test.
vi.mock('./api', () => ({
  toggleRecurringPayment: vi.fn(async () => ({})),
  addWishlistItem: vi.fn(async () => ({ id: 1 })),
  updateRecurringPaymentReminder: vi.fn(async () => undefined),
  payRecurringPaymentEarly: vi.fn(async () => ({
    transaction: { id: 'tx-payearly-1' },
    settledOccurrenceDate: '2026-08-01',
    nextOccurrenceDate: '2026-09-01',
  })),
  applyCategoryCleanup: vi.fn(async () => ({ appliedCount: 1, undoActions: [] })),
}))

// Savings goals are dispatched through a dynamic import of their own module (it is kept out of the
// eager api barrel), so the mock has to target that module rather than './api'.
vi.mock('./api/savingsGoals', () => ({
  addSavingsGoal: vi.fn(async () => ({ id: 1 })),
  updateSavingsGoal: vi.fn(async () => undefined),
  deleteSavingsGoal: vi.fn(async () => undefined),
}))

vi.mock('./api/documents', () => ({
  addTaxReliefCategory: vi.fn(async () => ({ id: 'server-relief', name: 'Education', limit: 1000 })),
  updateTaxReliefCategory: vi.fn(async () => ({ id: 'education', name: 'Learning', limit: 1200 })),
  deleteTaxReliefCategory: vi.fn(async () => undefined),
}))

import { applyOpsToList, createLocalNumericId, enqueue, DISPATCH, getSyncSuccessToast, projectFinancialSetting, projectSettingPreference, type QueuedOp } from './outbox'
import * as api from './api'
import * as savingsGoalsApi from './api/savingsGoals'
import * as documentsApi from './api/documents'

interface TestItem {
  id: string | number
  name: string
  date?: string
  postedAt?: string
  description?: string
  category?: string
  ledgerCategory?: string
  amount?: number
  dueDate?: number
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
    expect(savingsGoalsApi.addSavingsGoal).toHaveBeenCalledWith({ name: 'Car service' }, 'op-stable-2')
  })

  it('coerces the savings goal target id to a number for update and delete', async () => {
    await DISPATCH['savingsGoal:update'](makeOp({
      entity: 'savingsGoal', type: 'update', targetId: '7', payload: { name: 'Car service' },
    }))
    await DISPATCH['savingsGoal:delete'](makeOp({
      entity: 'savingsGoal', type: 'delete', targetId: '7',
    }))
    expect(savingsGoalsApi.updateSavingsGoal).toHaveBeenCalledWith(7, { name: 'Car service' })
    expect(savingsGoalsApi.deleteSavingsGoal).toHaveBeenCalledWith(7)
  })

  it('strips the local undo snapshot from a savings goal update body', async () => {
    await DISPATCH['savingsGoal:update'](makeOp({
      entity: 'savingsGoal',
      type: 'update',
      targetId: '7',
      payload: { name: 'Car service', undoSnapshot: { id: 7, name: 'Old name' } },
    }))
    // undoSnapshot is local bookkeeping for the Undo toast; sending it would put a nested copy of
    // the goal into the request body.
    expect(savingsGoalsApi.updateSavingsGoal).toHaveBeenCalledWith(7, { name: 'Car service' })
  })

  it('registers a dispatch handler for every savings goal op the UI can queue', () => {
    // The three ops the goal UI enqueues. Money movement (contribute/fund/complete) is
    // deliberately online-only, so it must NOT appear here.
    for (const key of ['savingsGoal:add', 'savingsGoal:update', 'savingsGoal:delete']) {
      expect(typeof DISPATCH[key]).toBe('function')
    }
    expect(DISPATCH['savingsGoal:contribute']).toBeUndefined()
  })

  it('dispatches reminder updates through the shared outbox payload', async () => {
    await DISPATCH['recurringPayment:reminder'](makeOp({
      entity: 'recurringPayment', type: 'reminder', targetId: 'rp-1',
      payload: { reminderEnabled: true, reminderMode: 'Daily', reminderLeadDays: 7 },
    }))
    expect(api.updateRecurringPaymentReminder).toHaveBeenCalledWith('rp-1', {
      enabled: true,
      mode: 'Daily',
      leadDays: 7,
    })
  })

  it('passes the outbox operation id as the pay-early idempotency key', async () => {
    await DISPATCH['recurringPayment:payEarly'](makeOp({
      id: 'op-pay-early', entity: 'recurringPayment', type: 'payEarly', targetId: 'rp-1',
      payload: { occurrenceDate: '2026-08-01' },
    }))
    expect(api.payRecurringPaymentEarly).toHaveBeenCalledWith('rp-1', '2026-08-01', 'op-pay-early')
  })

  it('dispatches category cleanup actions through the shared outbox', async () => {
    const actions = [{ type: 'merge' as const, categories: ['Old'], targetCategory: 'New' }]
    await DISPATCH['category:cleanup'](makeOp({
      entity: 'category', type: 'cleanup', targetId: 'suggestion-1', payload: { actions },
    }))
    expect(api.applyCategoryCleanup).toHaveBeenCalledWith(actions)
  })

  it('dispatches tax relief category CRUD with the tax year kept in the queued payload', async () => {
    await DISPATCH['taxReliefCategory:add'](makeOp({
      entity: 'taxReliefCategory', type: 'add', targetId: 'local-relief',
      payload: { taxYear: 2026, name: 'Education', limit: 1000 },
    }))
    await DISPATCH['taxReliefCategory:update'](makeOp({
      entity: 'taxReliefCategory', type: 'update', targetId: 'education',
      payload: { taxYear: 2026, name: 'Learning', limit: 1200 },
    }))
    await DISPATCH['taxReliefCategory:delete'](makeOp({
      entity: 'taxReliefCategory', type: 'delete', targetId: 'education', payload: { taxYear: 2026 },
    }))

    expect(documentsApi.addTaxReliefCategory).toHaveBeenCalledWith(2026, { name: 'Education', limit: 1000 })
    expect(documentsApi.updateTaxReliefCategory).toHaveBeenCalledWith(2026, 'education', { name: 'Learning', limit: 1200 })
    expect(documentsApi.deleteTaxReliefCategory).toHaveBeenCalledWith(2026, 'education')
  })
})

describe('sync success toast copy', () => {
  it.each([
    ['category', 'add', { name: 'Food' }, 'Category Added', '"Food" was added.'],
    ['category', 'delete', { name: 'Food' }, 'Category Deleted', '"Food" was deleted.'],
    ['transaction', 'delete', { description: 'Lunch' }, 'Transaction Deleted', '"Lunch" was deleted.'],
    ['recurringPayment', 'delete', { name: 'Netflix' }, 'Recurring Payment Deleted', '"Netflix" was deleted.'],
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

  it('uses the same record-first shape for an undone wishlist purchase', () => {
    expect(getSyncSuccessToast(makeOp({
      entity: 'wishlistItem',
      type: 'unpurchase',
      payload: { name: 'Headphones' },
    }))).toEqual({
      title: 'Wishlist Item Purchase Undone',
      message: '"Headphones" was unmarked as purchased.',
      tone: 'success',
    })
  })

  it('keeps setting sync copy in the shared entity/action format', () => {
    expect(getSyncSuccessToast(makeOp({
      entity: 'settings',
      type: 'update',
      targetId: 'darkMode',
      payload: { darkMode: true },
    }))).toEqual({
      title: 'Settings Updated',
      message: '"Dark mode" was enabled. Synced to the server.',
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
    // Persisted queues can contain placeholders created by older app versions. Leaving one as a
    // string would break every id comparison and the numeric sort in orderForFunding.
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

describe('optimistic list ordering', () => {
  it('uses positive numeric placeholders beyond the server integer range', () => {
    const id = createLocalNumericId()

    expect(id).toBeGreaterThan(2_147_483_647)
    expect(Number.isSafeInteger(id)).toBe(true)
  })

  it('keeps an optimistic category in the API alphabetical order', () => {
    const base: TestItem[] = [
      { id: 'cat-a', name: 'Bills' },
      { id: 'cat-c', name: 'Transport' },
    ]
    const ops = [makeOp({
      entity: 'category', type: 'add', targetId: 'cat-b', payload: { name: 'Food' },
    })]

    expect(applyOpsToList(base, ops, 'category').map(item => item.name)).toEqual([
      'Bills',
      'Food',
      'Transport',
    ])
  })

  it('keeps recurring payments in the API name order before view-specific sorting', () => {
    const base: TestItem[] = [
      { id: 'rec-a', name: 'Cloud storage', amount: 10, dueDate: 20 },
      { id: 'rec-c', name: 'Streaming', amount: 10, dueDate: 5 },
    ]
    const ops = [makeOp({
      entity: 'recurringPayment',
      type: 'add',
      targetId: 'rec-b',
      payload: { name: 'Music', amount: 10, dueDate: 15 },
    })]

    expect(applyOpsToList(base, ops, 'recurringPayment').map(item => item.name)).toEqual([
      'Cloud storage',
      'Music',
      'Streaming',
    ])
  })

  it('appends optimistic tax relief categories in the API insertion order', () => {
    const base: TestItem[] = [
      { id: 'medical', name: 'Medical' },
      { id: 'education', name: 'Education' },
    ]
    const ops = [
      makeOp({
        id: 'op-relief-1',
        entity: 'taxReliefCategory',
        type: 'add',
        targetId: 'relief-local-1',
        payload: { name: 'Lifestyle', limit: 2500, taxYear: 2026 },
      }),
      makeOp({
        id: 'op-relief-2',
        entity: 'taxReliefCategory',
        type: 'add',
        targetId: 'relief-local-2',
        payload: { name: 'Childcare', limit: 3000, taxYear: 2026 },
      }),
    ]

    expect(applyOpsToList(base, ops, 'taxReliefCategory').map(item => item.name)).toEqual([
      'Medical',
      'Education',
      'Lifestyle',
      'Childcare',
    ])
  })

  it('keeps a tax relief category update in its existing API position', () => {
    const base: TestItem[] = [
      { id: 'medical', name: 'Medical' },
      { id: 'education', name: 'Education' },
    ]
    const ops = [makeOp({
      entity: 'taxReliefCategory',
      type: 'update',
      targetId: 'medical',
      payload: { name: 'Health', limit: 10_000, taxYear: 2026 },
    })]

    expect(applyOpsToList(base, ops, 'taxReliefCategory').map(item => item.name)).toEqual([
      'Health',
      'Education',
    ])
  })

  it('repositions an optimistic category update using the same shared order', () => {
    const base: TestItem[] = [
      { id: 'cat-a', name: 'Bills' },
      { id: 'cat-b', name: 'Food' },
    ]
    const ops = [makeOp({
      entity: 'category', type: 'update', targetId: 'cat-a', payload: { name: 'Transport' },
    })]

    expect(applyOpsToList(base, ops, 'category').map(item => item.name)).toEqual(['Food', 'Transport'])
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

  it('keeps historical ledger rows unchanged when deleting a recurring payment', () => {
    const base: TestItem[] = [
      { id: 'tx-1', name: 'Netflix', description: 'Netflix Payment', recurringPaymentId: 'rec-1' },
      { id: 'tx-2', name: 'Groceries' },
    ]
    const ops = [makeOp({ entity: 'recurringPayment', type: 'delete', targetId: 'rec-1' })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result[0]).toEqual(base[0])
    expect(result[1]).toMatchObject({ id: 'tx-2' })
    expect(result[1].isPendingDelete).toBeUndefined()
  })

  it('unmarks the linked wishlist item when its purchase transaction is deleted', () => {
    const base: TestItem[] = [{
      id: 5,
      name: 'Headphones',
      isPurchased: true,
      purchaseTransactionId: 'tx-guid',
    }]
    const ops = [makeOp({
      entity: 'transaction',
      type: 'delete',
      targetId: 'tx-guid',
      payload: { undoSnapshot: { id: 'tx-guid', wishlistItemId: 5 } },
    })]

    expect(applyOpsToList(base, ops, 'wishlistItem')[0]).toMatchObject({
      id: 5,
      isPurchased: false,
      purchaseTransactionId: null,
      isPendingSync: true,
    })
  })

  it('relinks the wishlist item when a deleted purchase transaction is restored', () => {
    const base: TestItem[] = [{ id: 5, name: 'Headphones', isPurchased: false }]
    const ops = [makeOp({
      entity: 'transaction',
      type: 'add',
      targetId: 'tx-guid',
      payload: { wishlistItemId: 5, date: '2026-08-01' },
      isUndo: true,
    })]

    expect(applyOpsToList(base, ops, 'wishlistItem')[0]).toMatchObject({
      id: 5,
      isPurchased: true,
      purchaseTransactionId: 'tx-guid',
      purchasedAt: '2026-08-01',
      isPendingSync: true,
    })
  })

  it('moves category-dependent ledger rows optimistically during a category replacement', () => {
    const base: TestItem[] = [
      { id: 'tx-1', name: 'Old category row', category: 'Eating out' },
      { id: 'tx-2', name: 'Unrelated', category: 'Transport' },
    ]
    const ops = [makeOp({
      entity: 'category',
      type: 'delete',
      targetId: 'cat-1',
      payload: {
        name: 'Eating out',
        replacementCategoryId: 'cat-2',
        replacementCategoryName: 'Food',
      },
    })]
    const result = applyOpsToList(base, ops, 'transaction')
    expect(result[0]).toMatchObject({ category: 'Food', isPendingSync: true })
    expect(result[1]).toMatchObject({ category: 'Transport' })
  })

  it('projects a pay-early ledger row and advances its recurring payment', () => {
    const payment = [{ id: 'rp-1', name: 'Streaming', nextDueDate: '2026-08-01', category: 'Bills' }]
    const optimisticTransaction = {
      id: 'pending-pay-early', date: '2026-08-02', postedAt: '2026-08-02T00:00:00.000Z',
      description: 'Streaming', category: 'Bills', ledgerCategory: 'Needs', amount: -50,
      recurringPaymentId: 'rp-1', recurringOccurrenceDate: '2026-08-01',
    }
    const op = makeOp({
      entity: 'recurringPayment', type: 'payEarly', targetId: 'rp-1',
      payload: { occurrenceDate: '2026-08-01', optimisticTransaction },
    })

    const recurring = applyOpsToList(payment, [op], 'recurringPayment')
    const transactions = applyOpsToList([], [op], 'transaction')
    expect(recurring[0]).toMatchObject({ isPendingSync: true, pendingSyncOperationId: 'op-1' })
    expect(transactions[0]).toMatchObject({ id: 'pending-pay-early', amount: -50, isPendingSync: true })

    const completed = applyOpsToList(payment, [{
      ...op,
      isCompleted: true,
      payload: {
        ...op.payload,
        resultTransaction: { ...optimisticTransaction, id: 'tx-server' },
        nextOccurrenceDate: '2026-09-01',
        settledOccurrenceDate: '2026-08-01',
      },
    }], 'recurringPayment')
    expect(completed[0]).toMatchObject({ nextDueDate: '2026-09-01', isPendingSync: false })
  })

  it('projects category cleanup across categories and dependent records', () => {
    const op = makeOp({
      entity: 'category', type: 'cleanup', targetId: 'cleanup-1',
      payload: { actions: [{ type: 'merge', categories: ['Old'], targetCategory: 'New' }] },
    })
    const categories = applyOpsToList([{ id: 'old-id', name: 'Old' }, { id: 'new-id', name: 'New' }], [op], 'category')
    const transactions = applyOpsToList([{ id: 'tx-1', name: 'Lunch', category: 'Old' }], [op], 'transaction')
    expect(categories.find(category => category.name === 'Old')).toMatchObject({
      isPendingDelete: true,
      isPendingSync: true,
    })
    expect(transactions[0]).toMatchObject({ category: 'New', isPendingSync: true })
  })

  it('restores an investment activity snapshot as a pending row for an immediate undo', () => {
    const result = applyOpsToList([], [makeOp({
      entity: 'investmentActivity',
      type: 'restore',
      targetId: 'activity-1',
      payload: {
        transactions: [{ id: 'activity-1', type: 'Buy', tradeDate: '2026-08-01' }],
      },
    })], 'investmentActivity')
    expect(result[0]).toMatchObject({ id: 'activity-1', tradeDate: '2026-08-01', isPendingSync: true })
  })

  it('restores an investment cash movement snapshot as a pending row for an immediate undo', () => {
    const result = applyOpsToList([], [makeOp({
      entity: 'investmentCashFlow',
      type: 'restore',
      targetId: 'cash-1',
      payload: { id: 'cash-1', type: 'Deposit', amount: 100, date: '2026-08-01' },
    })], 'investmentCashFlow')
    expect(result[0]).toMatchObject({ id: 'cash-1', amount: 100, isPendingSync: true })
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

  it('keeps independent unsent transactions when removing an unsent recurring payment', () => {
    const queue = [
      makeOp({ id: 'op-rec-add', entity: 'recurringPayment', type: 'add', targetId: 'rec-1', payload: { name: 'Netflix' } }),
      makeOp({ id: 'op-tx-add', entity: 'transaction', type: 'add', targetId: 'tx-1', payload: { name: 'Netflix Payment', recurringPaymentId: 'rec-1' } }),
    ]
    const next = enqueue(queue, 'recurringPayment', 'delete', 'rec-1')
    expect(next).toEqual([queue[1]])
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
