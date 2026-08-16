import { describe, expect, it } from 'vitest'
import type { LedgerAccount, Transaction } from '../types'
import type { OutboxPayload, QueuedOp } from './outbox'
import { projectAccountBalances, projectAccountBalancesFromTransactions } from './accountProjection'

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

  it('applies a queued reconciliation row once to the dashboard snapshot', () => {
    const result = projectAccountBalancesFromTransactions(
      accounts,
      [],
      [baseTransaction({
        id: 'reconcile-op-adjustment-0',
        description: 'Account balance adjustment',
        category: 'Adjustment',
        amount: 50,
        isAccountBalanceAdjustment: true,
      })],
    )

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(150)
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

  it('projects reconciliation interest settings onto an existing account', () => {
    const result = projectAccountBalances(accounts, [op({
      entity: 'ledgerAccountReconcile',
      targetId: 'reconcile-interest',
      payload: {
        reconciliation: {
          operationId: 'reconcile-interest',
          bucket: 'Essentials',
          expectedBucketTotal: 100,
          targets: [{
            id: 'essentials',
            name: 'Main account',
            kind: 'Bank',
            isArchived: false,
            expectedCurrent: 100,
            target: 100,
            interestEnabled: true,
            interestRatePercent: 4.25,
            interestFrequency: 'Yearly',
          }],
        },
      },
    })])

    expect(result.find(account => account.id === 'essentials')).toMatchObject({
      remaining: 100,
      interestEnabled: true,
      interestRatePercent: 4.25,
      interestFrequency: 'Yearly',
    })
  })

  it('preserves an existing account kind when a dashboard correction omits it', () => {
    const result = projectAccountBalances([
      { ...accounts[0], kind: 'Cash', remaining: 100 },
    ], [op({
      entity: 'ledgerAccountReconcile',
      targetId: 'reconcile-kind',
      payload: {
        reconciliation: {
          operationId: 'reconcile-kind',
          bucket: 'Essentials',
          expectedBucketTotal: 100,
          targets: [{ id: 'essentials', name: 'Essentials bank', isArchived: false, expectedCurrent: 100, target: 125 }],
        },
      },
    })])

    expect(result.find(account => account.id === 'essentials')).toMatchObject({ kind: 'Cash', remaining: 125 })
  })

  it('preserves a failed queued reconciliation projection', () => {
    const result = projectAccountBalances(accounts, [op({
      id: 'failed-reconcile-op',
      entity: 'ledgerAccountReconcile',
      targetId: 'reconcile-failed',
      retryCount: 5,
      lastError: 'Account reconciliation could not be saved.',
      payload: {
        reconciliation: {
          operationId: 'reconcile-failed',
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
    expect(result.find(account => account.id === 'cash-new')?.remaining).toBe(40)
  })

  it('projects a queued bucket transfer across two accounts', () => {
    const result = projectAccountBalances(accounts, [op({
      targetId: 'tx-transfer-queued',
      payload: {
        id: 'tx-transfer-queued',
        amount: 30,
        ledgerCategory: 'Transfer:Essentials->Rewards',
        category: 'Transfer',
        description: 'Move to rewards',
        date: '2026-08-15',
        accountId: 'essentials',
        counterAccountId: 'rewards',
      },
    })])

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(70)
    expect(result.find(account => account.id === 'rewards')?.remaining).toBe(30)
  })

  it('projects a queued reconciliation with an archived account', () => {
    const result = projectAccountBalances(accounts, [op({
      entity: 'ledgerAccountReconcile',
      targetId: 'reconcile-archive',
      payload: {
        reconciliation: {
          operationId: 'reconcile-archive',
          bucket: 'Essentials',
          expectedBucketTotal: 100,
          targets: [
            { id: 'essentials', name: 'Essentials bank', kind: 'Bank', isArchived: true, expectedCurrent: 100, target: 0 },
            { id: 'essentials-2', name: 'New Essentials', kind: 'Bank', isArchived: false, expectedCurrent: 0, target: 100 },
          ],
        },
      },
    })])

    expect(result.find(account => account.id === 'essentials')).toMatchObject({
      remaining: 0,
      isArchived: true,
    })
    expect(result.find(account => account.id === 'essentials-2')).toMatchObject({
      remaining: 100,
      isArchived: false,
    })
  })

  it('projects a failed transaction op while it remains queued in outbox', () => {
    const result = projectAccountBalances(accounts, [op({
      id: 'failed-tx-op',
      entity: 'transaction',
      targetId: 'tx-failed',
      retryCount: 2,
      lastError: 'Network error',
      payload: baseTransaction({ id: 'tx-failed', amount: -40 }) as unknown as OutboxPayload,
    })])

    expect(result.find(account => account.id === 'essentials')?.remaining).toBe(60)
  })
})
