import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionForm, type UseTransactionFormOptions } from './useTransactionForm'
import { setModalDraft } from '../../../lib/modalDrafts'

vi.mock('../../../lib/api', () => ({
  startReceiptScan: vi.fn(),
  suggestTransactionCategories: vi.fn(),
  suggestTransactionNotes: vi.fn(),
}))

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

describe('useTransactionForm stored draft', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // The Ledger tab remounts this form on every navigation into the page, so a stored draft
  // must never reopen the sheet by itself -- it used to come back as "Edit Draft" each visit.
  it('stays closed on mount even when a draft from a previous session is stored', () => {
    setModalDraft('ledger-tx-form', {
      editorMode: 'create',
      editingTxId: null,
      description: 'Half typed coffee',
      amount: '12.00',
      txType: 'outflow',
      category: 'Food',
      ledgerCategory: 'Essentials',
      transferSource: 'Essentials',
      transferTarget: 'Rewards',
      date: '2026-08-20',
      accountId: '',
      counterAccountId: null,
      splitAccountIds: {},
      stabilityTopUpAccepted: false,
      stabilityTopUpAmount: '',
      stabilityReloadIntent: 'Unanswered',
    })

    const { result } = renderHook(() => useTransactionForm(createOptions()))

    expect(result.current.state.showAddForm).toBe(false)
    expect(result.current.state.mode).toBe('create')
    expect(result.current.state.description).toBe('')
  })
})
