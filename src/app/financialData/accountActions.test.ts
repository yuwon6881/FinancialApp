import { describe, expect, it, vi } from 'vitest'
import { enqueue, type QueuedOp } from '../../lib/outbox'
import type { Transaction } from '../../types'
import { createLedgerAccountActions } from './accountActions'

const payment: Omit<Transaction, 'id'> = {
  date: '2026-10-08',
  description: 'Pay Visa',
  category: 'Transfer',
  ledgerCategory: 'AccountMove',
  amount: 250,
  accountId: 'bank',
  counterAccountId: 'visa',
}
const rebate: Omit<Transaction, 'id'> = {
  date: '2026-10-08',
  description: 'Rebate on Visa',
  category: 'Cashback',
  ledgerCategory: 'Essentials',
  amount: 30,
  accountId: 'visa',
}

const setup = (revealed = true) => {
  let queue: QueuedOp[] = []
  const actions = createLedgerAccountActions({
    accounts: [],
    guardSensitive: () => revealed,
    enqueue,
    mutateQueue: update => { queue = update(queue) },
    snapshotForUndo: vi.fn(),
    setConfirmModalData: vi.fn(),
  })
  return { actions, queue: () => queue }
}

describe('handleSettleCard', () => {
  // The payment and its rebate are queued together and in order, each as an ordinary transaction
  // add, so they sync, project, and undo like any other ledger row.
  it('queues the card payment and its rebate as ordered transaction adds', () => {
    const { actions, queue } = setup()

    actions.handleSettleCard([payment, rebate])

    const ops = queue()
    expect(ops.map(op => [op.entity, op.type])).toEqual([['transaction', 'add'], ['transaction', 'add']])
    expect(ops.map(op => op.payload?.description)).toEqual(['Pay Visa', 'Rebate on Visa'])
    expect(ops[0].targetId).not.toBe(ops[1].targetId)
    expect(ops.every(op => op.payload?.id === op.targetId)).toBe(true)
    expect(Date.parse(String(ops[1].payload?.postedAt))).toBeGreaterThan(Date.parse(String(ops[0].payload?.postedAt)))
  })

  it('queues nothing while financial values are hidden', () => {
    const { actions, queue } = setup(false)

    actions.handleSettleCard([payment, rebate])

    expect(queue()).toEqual([])
  })
})
