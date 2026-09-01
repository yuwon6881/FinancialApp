import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTransactionForm, type UseTransactionFormOptions } from './useTransactionForm'
import type { ActiveRecurringPayment, CategorySummary, SavingsGoal } from '../../../types'

vi.mock('../../../lib/api', () => ({
  startReceiptScan: vi.fn(),
  suggestTransactionCategories: vi.fn(),
  suggestTransactionNotes: vi.fn(),
}))

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

function bill(ledgerCategory: string, amount: number): ActiveRecurringPayment {
  return {
    id: 'rec-1',
    recurringPaymentId: 'rec-1',
    name: 'Bill',
    amount,
    category: 'Bills',
    ledgerCategory,
    dueDate: '2026-08-15',
    status: 'Pending',
    isPaid: false,
    isDiscarded: false,
  }
}

function createOptions(overrides: Partial<UseTransactionFormOptions> = {}): UseTransactionFormOptions {
  return {
    categories: [{ id: 'food', name: 'Food' }],
    currency: 'MYR',
    hideSensitive: false,
    autocompleteSuggestions: [],
    transactions: [],
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    stabilityBalance: 0,
    stabilityTarget: 10_000,
    stabilityOverflowRedirect: 'Rewards',
    onAddTransaction: vi.fn(),
    onUpdateTransaction: vi.fn(),
    onReceiptScanStarted: vi.fn(),
    onReceiptScanCleared: vi.fn(),
    activeScanJobIds: [],
    ...overrides,
  }
}

describe('useTransactionForm bucket outflow warnings', () => {
  it('provides an advisory warning when Essentials outflow exceeds headroom due to bills', () => {
    const options = createOptions({
      ledgerSummaries: [cat('Essentials', 1000)],
      activeRecurringPayments: [bill('Essentials', 400)],
    })

    const { result } = renderHook(() => useTransactionForm(options))

    act(() => {
      result.current.openFresh('outflow')
      result.current.dispatch({ type: 'SET_FIELD', field: 'amount', value: '750' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Essentials' })
    })

    expect(result.current.bucketOutflowWarning).not.toBeNull()
    expect(result.current.bucketOutflowWarning?.shortfall).toBe(150)
    expect(result.current.bucketOutflowWarning?.message).toContain('upcoming bills this cycle')
  })

  it('provides an advisory warning for cross-bucket transfers dipping into Rewards earmarks', () => {
    const options = createOptions({
      ledgerSummaries: [cat('Rewards', 800)],
      savingsGoals: [goal({ fundingBucket: 'Rewards', earmarkedAmount: 500 })],
    })

    const { result } = renderHook(() => useTransactionForm(options))

    act(() => {
      result.current.openFresh('transfer')
      result.current.dispatch({ type: 'SET_FIELD', field: 'amount', value: '450' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'transferSource', value: 'Rewards' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'transferTarget', value: 'Essentials' })
    })

    expect(result.current.bucketOutflowWarning).not.toBeNull()
    expect(result.current.bucketOutflowWarning?.shortfall).toBe(150)
    expect(result.current.bucketOutflowWarning?.message).toContain('dips into your commitment earmarks')
  })

  it('does not warn for intra-bucket AccountMove transactions', () => {
    const options = createOptions({
      ledgerSummaries: [cat('Rewards', 800)],
      savingsGoals: [goal({ fundingBucket: 'Rewards', earmarkedAmount: 500 })],
    })

    const { result } = renderHook(() => useTransactionForm(options))

    act(() => {
      result.current.openFresh('transfer')
      result.current.dispatch({ type: 'SET_FIELD', field: 'amount', value: '600' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'AccountMove' })
    })

    expect(result.current.bucketOutflowWarning).toBeNull()
  })

  it('surfaces document validation error into form submit error state', async () => {
    const onAddTransaction = vi.fn()
    const options = createOptions({
      onAddTransaction,
      accounts: [
        { id: 'acc-1', name: 'Main', bucket: 'Essentials', remaining: 1000, isArchived: false },
      ] as UseTransactionFormOptions['accounts'],
    })

    const { result } = renderHook(() => useTransactionForm(options))

    act(() => {
      result.current.openFresh('outflow')
      result.current.dispatch({ type: 'SET_FIELD', field: 'description', value: 'Grocery' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'amount', value: '50' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'category', value: 'Food' })
      result.current.dispatch({ type: 'SET_FIELD', field: 'accountId', value: 'acc-1' })
    })

    // Mock document field ref returning validation error
    result.current.documentsFieldRef.current = {
      getChanges: () => ({ pending: [], unlinkIds: [] }),
      getValidationError: () => 'Upload a photo or a PDF. Other kinds of file cannot be kept as tax evidence.',
      reset: vi.fn(),
    }

    const fakeEvent = {
      preventDefault: vi.fn(),
      currentTarget: document.createElement('form'),
    } as unknown as React.FormEvent<HTMLFormElement>

    await act(async () => {
      await result.current.handleSubmit(fakeEvent)
    })

    expect(result.current.state.errors.submit).toBe(
      'Upload a photo or a PDF. Other kinds of file cannot be kept as tax evidence.',
    )
    expect(onAddTransaction).not.toHaveBeenCalled()
  })
})
