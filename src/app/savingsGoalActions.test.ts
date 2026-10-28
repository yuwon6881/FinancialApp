import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavingsGoal, Transaction } from '../types'
import { completeGoal, fundGoalsForCycle, recordInterestOnGoal } from './savingsGoalActions'
import { completeSavingsGoal, fetchSavingsGoals, fundSavingsGoalsForCycle, recordSavingsGoalInterest, undoSavingsGoalsCycleFunding } from '../lib/api/savingsGoals'
import { deleteTransaction } from '../lib/api/transactions'

vi.mock('../lib/api/savingsGoals', () => ({
  completeSavingsGoal: vi.fn(),
  fetchSavingsGoals: vi.fn(),
  fundSavingsGoalsForCycle: vi.fn(),
  recordSavingsGoalInterest: vi.fn(),
  undoSavingsGoalsCycleFunding: vi.fn(),
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

describe('fundGoalsForCycle', () => {
  it('passes the selected bucket to the authoritative funding request', async () => {
    const committedGoals = [{ ...goal, fundingBucket: 'Essentials' as const }]
    vi.mocked(fundSavingsGoalsForCycle).mockResolvedValue({
      goals: committedGoals,
      totalGranted: 100,
      freeToSpend: 0,
      rewardsFreeToSpend: 0,
      essentialsFreeToSpend: 50,
    })
    const commitGoals = vi.fn()
    const showToast = vi.fn()

    await fundGoalsForCycle({
      currency: 'MYR',
      commitGoals,
      commitGoal: vi.fn(),
      getGoalName: vi.fn(),
      refreshAll: vi.fn().mockResolvedValue(undefined),
      showToast,
    }, 'Essentials')

    expect(fundSavingsGoalsForCycle).toHaveBeenCalledWith('Essentials')
    expect(commitGoals).toHaveBeenCalledWith(committedGoals)
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Essentials commitments were funded'),
      expect.any(String),
      expect.any(String),
    )
  })

  it('offers server-authoritative Undo when funding returns an action id', async () => {
    const fundedGoals = [{ ...goal, earmarkedAmount: 100 }]
    vi.mocked(fundSavingsGoalsForCycle).mockResolvedValue({
      actionId: 'fund-action-1',
      goals: fundedGoals,
      totalGranted: 100,
      freeToSpend: 50,
      rewardsFreeToSpend: 50,
      essentialsFreeToSpend: 0,
    })
    vi.mocked(undoSavingsGoalsCycleFunding).mockResolvedValue([goal])
    const commitGoals = vi.fn()
    const showToast = vi.fn()

    await fundGoalsForCycle({
      currency: 'MYR',
      commitGoals,
      commitGoal: vi.fn(),
      getGoalName: vi.fn(),
      refreshAll: vi.fn().mockResolvedValue(undefined),
      showToast,
    }, 'Rewards')

    const undo = showToast.mock.calls[0][3]
    expect(undo?.label).toBe('Undo')
    undo.onAction()
    await vi.waitFor(() => expect(undoSavingsGoalsCycleFunding).toHaveBeenCalledWith('fund-action-1'))
    expect(commitGoals).toHaveBeenLastCalledWith([goal])
  })
})


describe('recordInterestOnGoal', () => {
  it('returns null and shows the online-only message when offline without calling the API', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const showToast = vi.fn()
    const deps = {
      currency: 'MYR',
      commitGoals: vi.fn(),
      commitGoal: vi.fn(),
      getGoalName: () => 'Car service',
      refreshAll: vi.fn(),
      showToast,
    }

    const result = await recordInterestOnGoal(deps, 7, 50, 'acc-1', 'op-test')

    expect(result).toBeNull()
    expect(recordSavingsGoalInterest).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(
      'Recording interest needs a live connection so your account balance can be updated.',
      'Available online only',
      'warning',
    )
    vi.unstubAllGlobals()
  })

  it('returns the rejection message when the API rejects', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(recordSavingsGoalInterest).mockRejectedValueOnce(
      new Error('Only RM 20 of room is left before the target. Raise the target first.'),
    )
    const deps = {
      currency: 'MYR',
      commitGoals: vi.fn(),
      commitGoal: vi.fn(),
      getGoalName: () => 'Car service',
      refreshAll: vi.fn(),
      showToast: vi.fn(),
    }

    const result = await recordInterestOnGoal(deps, 7, 50, 'acc-1', 'op-test')

    expect(result).toBe('Only RM 20 of room is left before the target. Raise the target first.')
    vi.unstubAllGlobals()
  })

  it('commits goals and refreshes on success', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const updatedGoal = { ...goal, earmarkedAmount: 50 }
    vi.mocked(recordSavingsGoalInterest).mockResolvedValueOnce(updatedGoal)
    vi.mocked(fetchSavingsGoals).mockResolvedValueOnce([updatedGoal])
    const commitGoals = vi.fn()
    const refreshAll = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()
    const deps = {
      currency: 'MYR',
      commitGoals,
      commitGoal: vi.fn(),
      getGoalName: () => 'Car service',
      refreshAll,
      showToast,
    }

    const result = await recordInterestOnGoal(deps, 7, 50, 'acc-1', 'op-test')

    expect(result).toBeNull()
    expect(recordSavingsGoalInterest).toHaveBeenCalledWith(7, 50, 'acc-1', 'op-test')
    expect(fetchSavingsGoals).toHaveBeenCalledOnce()
    expect(commitGoals).toHaveBeenCalledWith([updatedGoal])
    expect(refreshAll).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('50'),
      'Interest recorded',
      'success',
    )
    vi.unstubAllGlobals()
  })
})
