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
