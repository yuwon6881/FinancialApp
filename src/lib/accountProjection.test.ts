import { describe, expect, it } from 'vitest'
import type { LedgerAccount, Transaction } from '../types'
import type { QueuedOp } from './outbox'
import { projectAccountBalances } from './accountProjection'

const accounts: LedgerAccount[] = [
  {
    id: 'essentials', name: 'Essentials bank', bucket: 'Essentials', kind: 'Bank', interestEnabled: false, interestRatePercent: 0, interestFrequency: 'Monthly',
    isArchived: false, remaining: 100, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  },
  {
    id: 'rewards', name: 'Rewards wallet', bucket: 'Rewards', kind: 'EWallet', interestEnabled: false, interestRatePercent: 0, interestFrequency: 'Monthly',
    isArchived: false, remaining: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  },
]

const baseTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1', date: '2026-08-01', description: 'Lunch', category: 'Food',
  ledgerCategory: 'Essentials', amount: -20, accountId: 'essentials', ...overrides,
})

const op = (overrides: Partial<QueuedOp>): QueuedOp => ({
  id: 'op-1', entity: 'transaction', type: 'add', targetId: 'tx-1', createdAt: 1, retryCount: 0, ...overrides,
})

describe('projectAccountBalances', () => {
  it('projects an added transaction onto the server account snapshot', () => {
    const result = projectAccountBalances(accounts, [op({ payload: baseTransaction({ id: 'tx-new', amount: -15 }) as unknown as Record<string, unknown>, targetId: 'tx-new' })])

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(85)
  })

  it('replaces the base effect for an update and removes it for a delete', () => {
    const updated = projectAccountBalances(accounts, [op({
      type: 'update',
      payload: { ...baseTransaction({ amount: -35 }), undoSnapshot: baseTransaction() },
    })], [baseTransaction()])
    expect(updated.find(account => account.id === 'essentials')?.remaining).toBe(85)

    const deleted = projectAccountBalances(accounts, [op({
      type: 'delete',
      payload: { undoSnapshot: baseTransaction() },
    })], [baseTransaction()])
    expect(deleted.find(account => account.id === 'essentials')?.remaining).toBe(120)
  })

  it('projects generated income children without stamping the parent account onto them', () => {
    const result = projectAccountBalances(accounts, [op({
      targetId: 'salary',
      payload: {
        id: 'salary', amount: 100, ledgerCategory: 'Income', category: 'Salary',
        description: 'Salary', date: '2026-08-01', splitAccountIds: { Essentials: 'essentials', Growth: '', Stability: '', Rewards: 'rewards' },
      },
    })], [], {
      essentialsAlloc: 0.5,
      growthAlloc: 0,
      stabilityAlloc: 0,
      rewardsAlloc: 0.5,
    })

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(150)
    expect(result.find(account => account.id === 'rewards')?.remaining).toBe(50)
  })

  it('does not count an IncomeSplit proposal parent as well as its generated children', () => {
    const result = projectAccountBalances(accounts, [op({
      targetId: 'salary',
      payload: {
        id: 'salary', amount: 100, ledgerCategory: 'IncomeSplit:0.5,0,0,0.5', category: 'Salary',
        description: 'Salary', date: '2026-08-01', splitAccountIds: { Essentials: 'essentials', Growth: '', Stability: '', Rewards: 'rewards' },
      },
    })])

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(150)
    expect(result.find(account => account.id === 'rewards')?.remaining).toBe(50)
  })

  it('handles an in-bucket AccountMove as a zero bucket delta', () => {
    const result = projectAccountBalances([
      { ...accounts[0], remaining: 100 },
      { ...accounts[0], id: 'cash', name: 'Cash', remaining: 0 },
    ], [op({ targetId: 'move', payload: {
      id: 'move', amount: 40, ledgerCategory: 'AccountMove', category: 'Transfer',
      description: 'Move', date: '2026-08-01', accountId: 'essentials', counterAccountId: 'cash',
    } })])

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(60)
    expect(result.find(account => account.id === 'cash')?.remaining).toBe(40)
  })

  it('projects an atomic reconciliation onto existing and new account rows', () => {
    const result = projectAccountBalances(accounts, [op({
      entity: 'ledgerAccountReconcile',
      targetId: 'reconcile-1',
      payload: {
        reconciliation: {
          operationId: 'reconcile-1',
          bucket: 'Essentials',
          expectedBucketTotal: 100,
          targets: [
            { id: 'essentials', name: 'Essentials bank', kind: 'Bank', isArchived: false, expectedCurrent: 100, target: 60 },
            { id: 'cash-new', name: 'Cash jar', kind: 'Cash', isArchived: false, expectedCurrent: 0, target: 40 },
          ],
        },
      },
    })])

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(60)
    expect(result.find(account => account.id === 'cash-new')).toMatchObject({
      name: 'Cash jar',
      bucket: 'Essentials',
      kind: 'Cash',
      remaining: 40,
      isPendingSync: true,
      pendingSyncOperationId: 'op-1',
    })
  })
})
