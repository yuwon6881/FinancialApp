import { describe, expect, it } from 'vitest'
import { getBucketOutflowWarning } from './transactionBucketWarnings'
import type { ActiveRecurringPayment, CategorySummary, SavingsGoal } from '../types'

function cat(name: string, remaining: number): CategorySummary {
  return {
    name,
    allocation: 0.5,
    budget: remaining,
    spent: 0,
    remaining,
    target: remaining,
    incomeAllocated: 0,
    netChange: remaining,
  }
}

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 1,
    name: 'Goal',
    targetAmount: 500,
    earmarkedAmount: 300,
    targetDate: '2026-12-31',
    priority: 'Medium',
    status: 'active',
    isRecurring: false,
    recurrenceMonths: 12,
    cycleFundedAmount: 0,
    createdAt: '2026-01-01',
    fundingBucket: 'Rewards',
    ...overrides,
  }
}

function bill(ledgerCategory: string, amount: number, status: 'Pending' | 'Paid' | 'Discarded' = 'Pending'): ActiveRecurringPayment {
  return {
    id: 'rec-1',
    recurringPaymentId: 'rec-1',
    name: 'Bill',
    amount,
    category: 'Bills',
    ledgerCategory,
    dueDate: '2026-08-15',
    status,
    isPaid: status === 'Paid',
    isDiscarded: status === 'Discarded',
  }
}

describe('getBucketOutflowWarning', () => {
  it('returns null for zero, negative, or invalid amounts', () => {
    const context = { categories: [cat('Essentials', 1000)] }
    expect(getBucketOutflowWarning({ bucket: 'Essentials', amount: 0, context })).toBeNull()
    expect(getBucketOutflowWarning({ bucket: 'Essentials', amount: -50, context })).toBeNull()
    expect(getBucketOutflowWarning({ bucket: 'Essentials', amount: Number.NaN, context })).toBeNull()
  })

  it('returns null when outflow is within safe headroom for Essentials', () => {
    const context = {
      categories: [cat('Essentials', 1000)],
      activeRecurringPayments: [bill('Essentials', 300)],
      savingsGoals: [goal({ fundingBucket: 'Essentials', earmarkedAmount: 200 })],
    }
    // Safe headroom is 1000 - 300 - 200 = 500. Spending 400 is fine.
    expect(getBucketOutflowWarning({ bucket: 'Essentials', amount: 400, context })).toBeNull()
  })

  it('warns when Essentials outflow leaves upcoming bills short', () => {
    const context = {
      categories: [cat('Essentials', 1000)],
      activeRecurringPayments: [bill('Essentials', 400)],
    }
    // Safe headroom is 1000 - 400 = 600. Spending 750 leaves 150 shortfall.
    const warning = getBucketOutflowWarning({ bucket: 'Essentials', amount: 750, context })
    expect(warning).not.toBeNull()
    expect(warning?.bucket).toBe('Essentials')
    expect(warning?.shortfall).toBe(150)
    expect(warning?.message).toContain('short of covering upcoming bills this cycle')
  })

  it('warns when Essentials outflow leaves both upcoming bills and commitments short', () => {
    const context = {
      categories: [cat('Essentials', 1000)],
      activeRecurringPayments: [bill('Essentials', 300)],
      savingsGoals: [goal({ fundingBucket: 'Essentials', earmarkedAmount: 200 })],
    }
    // Safe headroom is 1000 - 300 - 200 = 500. Spending 700 leaves 200 shortfall.
    const warning = getBucketOutflowWarning({ bucket: 'Essentials', amount: 700, context })
    expect(warning).not.toBeNull()
    expect(warning?.shortfall).toBe(200)
    expect(warning?.message).toContain('bills and commitments')
  })

  it('warns when Rewards outflow dips into commitment earmarks', () => {
    const context = {
      categories: [cat('Rewards', 800)],
      savingsGoals: [goal({ fundingBucket: 'Rewards', earmarkedAmount: 500 })],
    }
    // Safe headroom is 800 - 500 = 300. Transferring 450 dips into earmarks by 150.
    const warning = getBucketOutflowWarning({ bucket: 'Rewards', amount: 450, context })
    expect(warning).not.toBeNull()
    expect(warning?.bucket).toBe('Rewards')
    expect(warning?.shortfall).toBe(150)
    expect(warning?.message).toContain('dips into your commitment earmarks')
  })

  it('warns when Stability outflow drops below emergency fund target', () => {
    const context = {
      categories: [cat('Stability', 10000)],
      targetStabilityFund: 10000,
    }
    // Safe headroom is 10000 - 10000 = 0. Any spending leaves a shortfall against target.
    const warning = getBucketOutflowWarning({ bucket: 'Stability', amount: 500, context })
    expect(warning).not.toBeNull()
    expect(warning?.bucket).toBe('Stability')
    expect(warning?.shortfall).toBe(500)
    expect(warning?.message).toContain('drops your emergency fund below your target')
  })

  it('handles edit mode by crediting back existing amount in the source bucket', () => {
    const context = {
      categories: [cat('Essentials', 400)], // Remaining after 100 was already spent
      activeRecurringPayments: [bill('Essentials', 300)],
    }
    // Baseline remaining is 400 + 100 = 500. Headroom is 500 - 300 = 200.
    // Changing the amount from 100 to 180 is within 200 headroom -> no warning.
    expect(getBucketOutflowWarning({
      bucket: 'Essentials',
      amount: 180,
      context,
      existingAmountInBucket: 100,
    })).toBeNull()

    // Changing the amount from 100 to 250 -> 250 - 200 = 50 shortfall.
    const warning = getBucketOutflowWarning({
      bucket: 'Essentials',
      amount: 250,
      context,
      existingAmountInBucket: 100,
    })
    expect(warning?.shortfall).toBe(50)
  })

  it('ignores completed or pending delete goals', () => {
    const context = {
      categories: [cat('Rewards', 800)],
      savingsGoals: [
        goal({ status: 'completed', earmarkedAmount: 500 }),
        goal({ isPendingDelete: true, earmarkedAmount: 300 }),
      ],
    }
    // Both goals are inactive/released -> headroom is 800. Spending 700 is fine.
    expect(getBucketOutflowWarning({ bucket: 'Rewards', amount: 700, context })).toBeNull()
  })
})
