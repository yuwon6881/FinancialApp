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

    await completeGoal({
      currency: 'MYR',
      commitGoals: vi.fn(),
      commitGoal,
      getGoalName: id => id === goal.id ? goal.name : undefined,
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
    expect(showToast).toHaveBeenLastCalledWith(
      'The change to "Car service" was undone.',
      'Undo successful',
      'success',
    )
  })
})
