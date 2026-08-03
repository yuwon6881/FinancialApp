import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavingsGoal, Transaction } from '../types'
import { completeGoal } from './savingsGoalActions'
import { completeSavingsGoal } from '../lib/api/savingsGoals'
import { deleteTransaction } from '../lib/api/transactions'

vi.mock('../lib/api/savingsGoals', () => ({
  completeSavingsGoal: vi.fn(),
}))

vi.mock('../lib/api/transactions', () => ({
  deleteTransaction: vi.fn(),
}))

const goal: SavingsGoal = {
  id: 7,
  name: 'Car service',
  targetAmount: 1200,
  earmarkedAmount: 0,
  targetDate: '2026-12-20',
  priority: 'Medium',
  status: 'active',
  isRecurring: true,
  recurrenceMonths: 3,
  cycleFundedAmount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const transaction: Transaction = {
  id: 'savings-goal-completion-7-test',
  date: '2026-08-01',
  description: 'Completed commitment: Car service',
  category: 'Other',
  ledgerCategory: 'Rewards',
  amount: -1200,
  savingsGoalId: 7,
}

describe('completeGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(completeSavingsGoal).mockResolvedValue({ goal, transaction })
    vi.mocked(deleteTransaction).mockResolvedValue()
  })

  it('refreshes the ledger and exposes a working completion undo', async () => {
    const commitGoal = vi.fn()
    const refreshAll = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()
    const removePendingLedgerTransaction = vi.fn()

    await completeGoal({
      currency: 'MYR',
      commitGoals: vi.fn(),
      commitGoal,
      getGoalName: id => id === goal.id ? goal.name : undefined,
      getGoal: id => id === goal.id ? goal : undefined,
      removePendingLedgerTransaction,
      refreshAll,
      showToast,
    }, goal.id)

    expect(commitGoal).toHaveBeenCalledWith(goal)
    expect(refreshAll).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('"Car service" was rolled forward.'),
      'Savings Goal Rolled Forward',
      'success',
      expect.objectContaining({ label: 'Undo' }),
    )
    const action = showToast.mock.calls[0]?.[3]
    expect(action?.label).toBe('Undo')

    action?.onAction()
    await vi.waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith(transaction.id))
    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalledTimes(2))
    expect(removePendingLedgerTransaction).toHaveBeenCalledWith(transaction.id)
    expect(commitGoal).toHaveBeenLastCalledWith(goal)
    expect(showToast).toHaveBeenLastCalledWith(
      'The change to "Car service" was undone.',
      'Undo successful',
      'success',
    )
  })

  it('projects the completion transaction and marks both records as syncing before the POST resolves', async () => {
    const committedGoal = { ...goal, earmarkedAmount: 1200 }
    const committedTransaction = { ...transaction, amount: -1200 }
    vi.mocked(completeSavingsGoal).mockResolvedValue({ goal: committedGoal, transaction: committedTransaction })
    const commitGoal = vi.fn()
    const refreshAll = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()
    const beginDirectSync = vi.fn()
    const endDirectSync = vi.fn()
    const addPendingLedgerTransaction = vi.fn()
    const replacePendingLedgerTransaction = vi.fn()
    const removePendingLedgerTransaction = vi.fn()
    const setDeletingTransactionId = vi.fn()

    await completeGoal({
      currency: 'MYR',
      commitGoals: vi.fn(),
      commitGoal,
      getGoalName: id => id === goal.id ? goal.name : undefined,
      getGoal: id => id === goal.id ? committedGoal : undefined,
      beginDirectSync,
      endDirectSync,
      getActiveGoalIds: () => [goal.id],
      addPendingLedgerTransaction,
      replacePendingLedgerTransaction,
      removePendingLedgerTransaction,
      setDeletingTransactionId,
      refreshAll,
      showToast,
    }, goal.id)

    const pending = addPendingLedgerTransaction.mock.calls[0]?.[0]
    expect(pending).toMatchObject({
      description: 'Completed commitment: Car service',
      ledgerCategory: 'Rewards',
      amount: -1200,
      savingsGoalId: goal.id,
      isPendingSync: true,
    })
    expect(beginDirectSync).toHaveBeenCalledWith([String(goal.id), pending.id])
    expect(replacePendingLedgerTransaction).toHaveBeenCalledWith(pending.id, committedTransaction)
    expect(removePendingLedgerTransaction).toHaveBeenCalledWith(committedTransaction.id)
    expect(endDirectSync).toHaveBeenCalledWith([String(goal.id), pending.id])

    const action = showToast.mock.calls[0]?.[3]
    action?.onAction()
    await vi.waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith(committedTransaction.id))
    expect(setDeletingTransactionId).toHaveBeenCalledWith(committedTransaction.id)
    await vi.waitFor(() => expect(setDeletingTransactionId).toHaveBeenLastCalledWith(null))
  })

  it('keeps the projected ledger row active until completion responds', async () => {
    const committedGoal = { ...goal, earmarkedAmount: 1200 }
    const committedTransaction = { ...transaction, amount: -1200 }
    let resolveCompletion: (value: { goal: SavingsGoal; transaction: Transaction }) => void = () => undefined
    vi.mocked(completeSavingsGoal).mockReturnValue(new Promise(resolve => {
      resolveCompletion = resolve
    }))

    const beginDirectSync = vi.fn()
    const endDirectSync = vi.fn()
    const addPendingLedgerTransaction = vi.fn()
    const refreshAll = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()
    const request = completeGoal({
      currency: 'MYR',
      commitGoals: vi.fn(),
      commitGoal: vi.fn(),
      getGoalName: () => goal.name,
      getGoal: () => committedGoal,
      beginDirectSync,
      endDirectSync,
      addPendingLedgerTransaction,
      replacePendingLedgerTransaction: vi.fn(),
      removePendingLedgerTransaction: vi.fn(),
      refreshAll,
      showToast,
    }, goal.id)

    await vi.waitFor(() => expect(addPendingLedgerTransaction).toHaveBeenCalledOnce())
    const pending = addPendingLedgerTransaction.mock.calls[0]?.[0]
    expect(pending).toMatchObject({ isPendingSync: true, savingsGoalId: goal.id, amount: -1200 })
    expect(beginDirectSync).toHaveBeenCalledWith([String(goal.id), pending.id])
    expect(endDirectSync).not.toHaveBeenCalled()

    resolveCompletion({ goal: committedGoal, transaction: committedTransaction })
    await request
    expect(endDirectSync).toHaveBeenCalledWith([String(goal.id), pending.id])
  })
})
