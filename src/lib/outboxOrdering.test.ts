import { describe, expect, it } from 'vitest'
import type { QueuedOp } from './outbox'
import { applyOpsToList } from './outbox'

type OrderedItem = {
  id: string
  name: string
  symbol?: string
  isArchived?: boolean
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

const add = (
  entity: QueuedOp['entity'],
  targetId: string,
  payload: QueuedOp['payload'],
  createdAt = 1,
): QueuedOp => ({
  id: `op-${targetId}`,
  entity,
  type: 'add',
  targetId,
  payload,
  createdAt,
  retryCount: 0,
})

describe('application-wide optimistic list policies', () => {
  it('orders investment accounts like the API, including archived rows and id ties', () => {
    const base: OrderedItem[] = [
      { id: 'account-b', name: 'Broker', isArchived: false },
      { id: 'account-z', name: 'Old broker', isArchived: true },
    ]
    const operations = [
      add('investmentAccount', 'account-a', { name: 'Broker', baseCurrency: 'MYR', isArchived: false }),
      add('investmentAccount', 'account-y', { name: 'Archived broker', baseCurrency: 'USD', isArchived: true }),
    ]

    expect(applyOpsToList(base, operations, 'investmentAccount').map(item => item.id)).toEqual([
      'account-a',
      'account-b',
      'account-y',
      'account-z',
    ])
  })

  it('orders investments by symbol and id like the portfolio API', () => {
    const base: OrderedItem[] = [
      { id: 'instrument-b', name: 'Fund B', symbol: 'VWRA' },
      { id: 'instrument-z', name: 'Fund Z', symbol: 'ZPRV' },
    ]
    const operations = [
      add('investmentInstrument', 'instrument-a', { name: 'Fund A', symbol: 'VWRA', currency: 'USD' }),
      add('investmentInstrument', 'instrument-c', { name: 'Fund C', symbol: 'CSPX', currency: 'USD' }),
    ]

    expect(applyOpsToList(base, operations, 'investmentInstrument').map(item => item.id)).toEqual([
      'instrument-c',
      'instrument-a',
      'instrument-b',
      'instrument-z',
    ])
  })

  it('uses the stable recurring-payment id when names tie', () => {
    const base: OrderedItem[] = [
      { id: 'rec-b', name: 'Streaming' },
      { id: 'rec-z', name: 'Utilities' },
    ]
    const operations = [
      add('recurringPayment', 'rec-a', { name: 'Streaming', amount: 20 }),
    ]

    expect(applyOpsToList(base, operations, 'recurringPayment').map(item => item.id)).toEqual([
      'rec-a',
      'rec-b',
      'rec-z',
    ])
  })
})

// Projection is a replay, so it has to run in the order the user acted. Two separate
// orderings broke that and silently dropped edits; both are pinned here.
describe('chronological op replay', () => {
  const at = (
    entity: QueuedOp['entity'],
    type: QueuedOp['type'],
    targetId: string,
    payload: QueuedOp['payload'],
    createdAt: number,
    isCompleted?: boolean,
  ): QueuedOp => ({
    id: `op-${type}-${targetId}-${createdAt}`,
    entity,
    type,
    targetId,
    payload,
    createdAt,
    retryCount: 0,
    isCompleted,
  })

  // `activeOps` is `[...pendingOps, ...recentlyCompletedOps]`, so an older completed add
  // arrives *after* a newer pending update. Replayed in array order the add re-applied
  // last and overwrote the edit with the original payload — the user's change vanished
  // from the ledger until the next refresh.
  it('keeps an edit that was queued after a completed add', () => {
    const add = at('transaction', 'add', 'tx-1', { description: 'Original' }, 1, true)
    const update = at('transaction', 'update', 'tx-1', { description: 'Edited' }, 2)

    const rows = applyOpsToList<OrderedItem & { description?: string }>(
      [], [update, add], 'transaction',
    )

    expect(rows.map(row => row.description)).toEqual(['Edited'])
  })

  // Cross-entity ops were appended as a block after the entity's own, so an update
  // targeting the row a wishlist purchase synthesizes ran before that row existed and
  // was dropped outright rather than merged.
  it('keeps an edit to the ledger row a queued wishlist purchase creates', () => {
    const purchase = at('wishlistItem', 'purchase', '42', { name: 'Headphones', price: 300 }, 1)
    const update = at('transaction', 'update', 'wishlist-purchase-42', { description: 'Edited' }, 2)

    const rows = applyOpsToList<OrderedItem & { description?: string }>(
      [], [purchase, update], 'transaction',
    )

    expect(rows.map(row => row.description)).toEqual(['Edited'])
  })

  // The reverse order must still hold: an edit made *before* the row was replaced is
  // correctly superseded, so the sort must not be mistaken for "updates always win".
  it('lets a later add supersede an earlier edit', () => {
    const update = at('transaction', 'update', 'tx-1', { description: 'Edited' }, 1)
    const add = at('transaction', 'add', 'tx-1', { description: 'Original' }, 2, true)

    const rows = applyOpsToList<OrderedItem & { description?: string }>(
      [], [update, add], 'transaction',
    )

    expect(rows.map(row => row.description)).toEqual(['Original'])
  })
})
