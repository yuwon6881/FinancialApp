import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTransactionForm, type UseTransactionFormOptions } from './useTransactionForm'
import type { Transaction } from '../../../types'

vi.mock('../../../lib/api/documents', () => ({
  listAllDocumentsForTransaction: vi.fn().mockResolvedValue([]),
  getTaxReliefCategories: vi.fn().mockResolvedValue([]),
  downloadDocument: vi.fn(),
}))

vi.mock('../../../lib/api', () => ({
  startReceiptScan: vi.fn(),
  suggestTransactionCategories: vi.fn(),
  suggestTransactionNotes: vi.fn(),
}))

const CATEGORIES = [{ id: 'food', name: 'Food' }]

const createOptions = (overrides: Partial<UseTransactionFormOptions> = {}): UseTransactionFormOptions => ({
  categories: CATEGORIES,
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
  ...overrides,
})

const transaction = (id: string, amount = -10): Transaction => ({
  id,
  date: '2026-08-20',
  description: id,
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount,
})

const share = { description: 'Shared receipt', amount: 42.5, date: '2026-08-21', txType: 'outflow' } as const

describe('applying a computed share to the transaction sheet', () => {
  it('edits an open edit in place instead of reopening a blank create', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions()))

    await act(async () => { result.current.handleStartEdit(transaction('tx-a')) })
    act(() => {
      result.current.dispatch({ type: 'SET_FIELD', field: 'description', value: 'Dinner with Sam' })
    })

    act(() => result.current.applyPrefill({ ...share }))

    expect(result.current.state.mode).toBe('edit')
    expect(result.current.state.editingId).toBe('tx-a')
    expect(result.current.state.amount).toBe('42.50')
    expect(result.current.state.description).toBe('Shared receipt')
  })

  it('does not retype a saved inflow', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions()))

    await act(async () => { result.current.handleStartEdit(transaction('tx-in', 500)) })
    expect(result.current.state.transactionType).toBe('inflow')

    act(() => result.current.applyPrefill({ ...share }))

    expect(result.current.state.transactionType).toBe('inflow')
    expect(result.current.state.editingId).toBe('tx-in')
  })

  it('opens a fresh create when no edit is on screen', () => {
    const { result } = renderHook(() => useTransactionForm(createOptions()))

    act(() => result.current.applyPrefill({ ...share }))

    expect(result.current.state.mode).toBe('create')
    expect(result.current.state.editingId).toBeNull()
    expect(result.current.state.amount).toBe('42.50')
    expect(result.current.state.transactionType).toBe('outflow')
  })

  it('opens a fresh create when the sheet was closed while still holding an edit', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions()))

    await act(async () => { result.current.handleStartEdit(transaction('tx-a')) })
    await act(async () => { result.current.handleCloseForm() })

    act(() => result.current.applyPrefill({ ...share }))

    expect(result.current.state.mode).toBe('create')
    expect(result.current.state.editingId).toBeNull()
  })
})
