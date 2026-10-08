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
  it('keeps a rebate dependent on its payment through sync failure and retry', () => {
    const { actions, queue } = setup()

    actions.handleSettleCard([payment, rebate])

    const ops = queue()
    expect(ops.map(op => [op.entity, op.type])).toEqual([['transaction', 'bulkAdd']])
    const rows = ops[0].payload?.transactions as Transaction[]
    expect(rows.map(row => row.description)).toEqual(['Pay Visa', 'Rebate on Visa'])
    expect(rows[0].id).not.toBe(rows[1].id)
    expect(Date.parse(rows[1].postedAt!)).toBeGreaterThan(Date.parse(rows[0].postedAt!))
  })

  it('keeps a payment without a rebate as an ordinary add', () => {
    const { actions, queue } = setup()
    actions.handleSettleCard([payment])
    expect(queue()).toMatchObject([{ entity: 'transaction', type: 'add', payload: payment }])
  })

  it('queues nothing while financial values are hidden', () => {
    const { actions, queue } = setup(false)

    actions.handleSettleCard([payment, rebate])

    expect(queue()).toEqual([])
  })
})
