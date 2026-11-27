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
  suggestTransactionCategories: vi.fn().mockResolvedValue([]),
  suggestTransactionNotes: vi.fn().mockResolvedValue([]),
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
  it('opens a captured purchase without inventing missing date, amount, category, bucket or account', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({
      autoOpenPrefill: { captureId: 'capture', description: 'Coffee' },
      accounts: [{ id: 'one', name: 'Cash', bucket: 'Essentials', isArchived: false } as any],
    })))
    await act(async () => result.current.openFresh())
    expect(result.current.state.captureId).toBe('capture')
    expect(result.current.state.description).toBe('Coffee')
    expect(result.current.state.amount).toBe('')
    expect(result.current.state.date).toBe('')
    expect(result.current.state.category).toBe('')
    expect(result.current.state.ledgerCategory).toBe('')
    expect(result.current.state.accountId).toBeFalsy()
    act(() => result.current.dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Essentials' }))
    expect(result.current.state.accountId).toBeFalsy()
  })

  it('opens a captured transfer with empty categories and requires the reviewer to choose both accounts', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({
      autoOpenTxType: 'transfer',
      autoOpenPrefill: {
        captureId: 'transfer-capture',
        transactionType: 'transfer',
        transferSource: '',
        transferTarget: '',
        description: 'Transfer to savings',
      },
      accounts: [
        { id: 'essentials', name: 'Main', bucket: 'Essentials', isArchived: false } as any,
        { id: 'rewards', name: 'Savings', bucket: 'Rewards', isArchived: false } as any,
      ],
    })))

    await act(async () => result.current.openFresh())

    expect(result.current.state.captureId).toBe('transfer-capture')
    expect(result.current.state.transactionType).toBe('transfer')
    expect(result.current.state.transferSource).toBe('')
    expect(result.current.state.transferTarget).toBe('')
    expect(result.current.state.accountId).toBeFalsy()
    expect(result.current.state.counterAccountId).toBeFalsy()
  })
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

describe('picking a remembered description', () => {
  const accounts = [
    { id: 'bank', name: 'Bank', bucket: 'Essentials', isArchived: false } as any,
    { id: 'card', name: 'Card', bucket: 'Essentials', isArchived: false } as any,
  ]
  const history: Transaction[] = [{ ...transaction('earlier'), description: 'Grab', accountId: 'card' }]
  const suggestion = { description: 'Grab', category: 'Food', ledgerCategory: 'Essentials', txType: 'outflow' as const }

  it('selects the account last used for that description in a multi-account bucket', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, transactions: history })))
    await act(async () => result.current.openFresh())
    act(() => result.current.handleSelectSuggestion(suggestion))
    expect(result.current.state.ledgerCategory).toBe('Essentials')
    expect(result.current.state.accountId).toBe('card')
  })

  it('keeps an account the user already chose in that bucket', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, transactions: history })))
    await act(async () => result.current.openFresh())
    act(() => result.current.dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Essentials' }))
    act(() => result.current.dispatch({ type: 'SET_FIELD', field: 'accountId', value: 'bank' }))
    act(() => result.current.handleSelectSuggestion(suggestion))
    expect(result.current.state.accountId).toBe('bank')
  })

  it('leaves the account empty when the description has no history', async () => {
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, transactions: [] })))
    await act(async () => result.current.openFresh())
    act(() => result.current.handleSelectSuggestion(suggestion))
    expect(result.current.state.accountId).toBeFalsy()
  })
})

describe('saving and adding another', () => {
  const accounts = [{ id: 'bank', name: 'Bank', bucket: 'Essentials', isArchived: false } as any]
  const fill = (result: { current: ReturnType<typeof useTransactionForm> }) => {
    const set = (field: string, value: unknown) => result.current.dispatch({ type: 'SET_FIELD', field: field as any, value })
    act(() => {
      set('description', 'Lunch')
      set('amount', '12.50')
      set('date', '2026-11-20')
      set('ledgerCategory', 'Essentials')
      set('category', 'Food')
      set('accountId', 'bank')
    })
  }
  const submitEvent = (addAnother: boolean) => {
    const submitter = document.createElement('button')
    if (addAnother) submitter.setAttribute('data-add-another', 'true')
    const form = document.createElement('form')
    return { preventDefault: vi.fn(), currentTarget: form, nativeEvent: { submitter } } as any
  }

  it('keeps the sheet open on a blank entry that keeps only the date', async () => {
    const onAddTransaction = vi.fn()
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, onAddTransaction })))
    await act(async () => result.current.openFresh())
    fill(result)
    await act(async () => result.current.handleSubmit(submitEvent(true)))
    expect(onAddTransaction).toHaveBeenCalledTimes(1)
    expect(onAddTransaction.mock.calls[0][0]).toMatchObject({ description: 'Lunch', amount: -12.5, accountId: 'bank' })
    expect(onAddTransaction.mock.calls[0][2]).toEqual({ addAnother: true })
    expect(result.current.state.showAddForm).toBe(true)
    expect(result.current.state.mode).toBe('create')
    expect(result.current.state.date).toBe('2026-11-20')
    expect(result.current.state.description).toBe('')
    expect(result.current.state.amount).toBe('')
    expect(result.current.state.ledgerCategory).toBe('')
    expect(result.current.state.category).toBe('')
  })

  it('closes after an ordinary save', async () => {
    const onAddTransaction = vi.fn()
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, onAddTransaction })))
    await act(async () => result.current.openFresh())
    fill(result)
    await act(async () => result.current.handleSubmit(submitEvent(false)))
    expect(onAddTransaction).toHaveBeenCalledTimes(1)
    expect(result.current.state.showAddForm).toBe(false)
  })

  it('stays open with the entry intact when the save fails', async () => {
    const onAddTransaction = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, onAddTransaction })))
    await act(async () => result.current.openFresh())
    fill(result)
    await act(async () => result.current.handleSubmit(submitEvent(true)))
    expect(result.current.state.showAddForm).toBe(true)
    expect(result.current.state.description).toBe('Lunch')
    expect(result.current.state.errors.submit).toBeTruthy()
  })

  it('honors dismissal while a Save & new request is still running', async () => {
    let finishSave: (() => void) | undefined
    const onAddTransaction = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve }))
    const { result } = renderHook(() => useTransactionForm(createOptions({ accounts, onAddTransaction })))
    await act(async () => result.current.openFresh())
    fill(result)

    let save: Promise<void>
    act(() => { save = result.current.handleSubmit(submitEvent(true)) })
    await act(async () => result.current.handleCloseForm())
    await act(async () => {
      finishSave?.()
      await save
    })

    expect(onAddTransaction).toHaveBeenCalledTimes(1)
    expect(result.current.state.showAddForm).toBe(false)
  })
})
