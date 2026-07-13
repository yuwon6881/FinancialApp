import { describe, expect, it, vi } from 'vitest'
import {
  dispatchAiActions,
  getPayloadString,
  getPayloadNumber,
  AI_MUTATION_TYPES,
  type AiActionsDeps,
} from './aiActions'

describe('getPayloadString', () => {
  it('returns trimmed strings and null for blanks/non-strings', () => {
    expect(getPayloadString({ a: '  hi ' }, 'a')).toBe('hi')
    expect(getPayloadString({ a: '   ' }, 'a')).toBeNull()
    expect(getPayloadString({ a: 5 }, 'a')).toBeNull()
    expect(getPayloadString({}, 'a')).toBeNull()
  })
})

describe('getPayloadNumber', () => {
  it('accepts numbers and numeric strings, rejects the rest', () => {
    expect(getPayloadNumber({ a: 42 }, 'a')).toBe(42)
    expect(getPayloadNumber({ a: '42' }, 'a')).toBe(42)
    expect(getPayloadNumber({ a: 'x' }, 'a')).toBeNull()
    expect(getPayloadNumber({ a: Infinity }, 'a')).toBeNull()
    expect(getPayloadNumber({}, 'a')).toBeNull()
  })
})

function makeDeps(overrides: Partial<AiActionsDeps> = {}): AiActionsDeps {
  let nonce = 0
  return {
    hideSensitive: false,
    showToast: vi.fn(),
    setActiveTab: vi.fn(),
    handleSelectPeriod: vi.fn(),
    handleNavigateToLedger: vi.fn(),
    nextNonce: () => ++nonce,
    transactionCategories: [
      { id: 'food', name: 'Food' },
      { id: 'transport', name: 'Transport' },
      { id: 'other', name: 'Other' },
    ],
    stageAiLedgerDrafts: vi.fn(),
    setAiRecurringDraft: vi.fn(),
    setAiWishlistDraft: vi.fn(),
    setAiLedgerEditDraft: vi.fn(),
    setAiRecurringEditDraft: vi.fn(),
    setAiWishlistEditDraft: vi.fn(),
    setAiLedgerExportRequest: vi.fn(),
    requestDeleteLedger: vi.fn(),
    requestDeletePayment: vi.fn(),
    requestDeleteWishlistItem: vi.fn(),
    allRecurringPayments: [],
    allWishlist: [],
    handleToggleActive: vi.fn(),
    getPendingNotifications: () => [],
    setConfirmModalData: vi.fn(),
    handleDiscardSubscription: vi.fn(),
    handleConfirmSubscription: vi.fn(),
    handlePurchaseWishlistItem: vi.fn(),
    handleUnpurchaseWishlistItem: vi.fn(),
    ...overrides,
  }
}

describe('dispatchAiActions — navigation', () => {
  it('routes tab-open actions to setActiveTab', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openDashboard', payload: {} }], d)
    expect(d.setActiveTab).toHaveBeenCalledWith('dashboard')
  })

  it('processes at most the first three actions', async () => {
    const d = makeDeps()
    await dispatchAiActions(
      [
        { type: 'openDashboard', payload: {} },
        { type: 'openRecurring', payload: {} },
        { type: 'openWishlist', payload: {} },
        { type: 'openLedger', payload: {} },
      ],
      d
    )
    expect(d.setActiveTab).toHaveBeenCalledTimes(3)
    expect(d.setActiveTab).not.toHaveBeenCalledWith('ledger')
  })

  it('stages every ledger record and opens the draft transactions tab', async () => {
    const d = makeDeps()
    await dispatchAiActions([
      { type: 'openAddLedgerDraft', payload: { description: 'Nasi Lemak', amount: 12, txType: 'outflow', category: 'Food', ledgerCategory: 'Essentials', ledgerCategorySpecified: false } },
      { type: 'openAddLedgerDraft', payload: { description: 'Car Fuel', amount: 30, txType: 'outflow', category: 'Transport', ledgerCategory: 'Growth', ledgerCategorySpecified: true } },
    ], d)
    expect(d.stageAiLedgerDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ description: 'Nasi Lemak', amount: -12, category: 'Food', ledgerCategory: 'Essentials' }),
      expect.objectContaining({ description: 'Car Fuel', amount: -30, category: 'Transport', ledgerCategory: 'Growth' }),
    ])
    expect(d.setActiveTab).toHaveBeenCalledWith('drafts')
  })

  it('defaults ledger category to Essentials and preserves valid AI category choices', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openAddLedgerDraft', payload: {
      description: 'Lunch', amount: 9, txType: 'outflow', category: 'Food', ledgerCategory: 'Growth', ledgerCategorySpecified: false,
    } }], d)
    expect(d.stageAiLedgerDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ category: 'Food', ledgerCategory: 'Essentials' }),
    ])
  })

  it('maps an explicitly requested reward ledger to Rewards', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openAddLedgerDraft', payload: {
      description: 'Movie', amount: 20, txType: 'outflow', category: 'Other', ledgerCategory: 'Reward', ledgerCategorySpecified: true,
    } }], d)
    expect(d.stageAiLedgerDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ ledgerCategory: 'Rewards' }),
    ])
  })

  it('stages more than three flat ledger actions as one batch', async () => {
    const d = makeDeps()
    const actions = Array.from({ length: 4 }, (_, index) => ({
      type: 'openAddLedgerDraft' as const,
      payload: {
        description: `Item ${index + 1}`,
        amount: index + 1,
        txType: 'outflow',
        category: 'Other',
        ledgerCategory: 'Essentials',
        ledgerCategorySpecified: false,
      },
    }))

    await dispatchAiActions(actions, d)

    expect(d.stageAiLedgerDrafts).toHaveBeenCalledOnce()
    expect(d.stageAiLedgerDrafts).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ description: 'Item 1' }),
      expect.objectContaining({ description: 'Item 4' }),
    ]))
  })
})

describe('dispatchAiActions — sensitive mode', () => {
  it('blocks every mutating action with a warning toast', async () => {
    const d = makeDeps({ hideSensitive: true })
    for (const type of AI_MUTATION_TYPES) {
      await dispatchAiActions([{ type, payload: {} }], d)
    }
    expect(d.showToast).toHaveBeenCalledTimes(AI_MUTATION_TYPES.size)
    expect(d.setConfirmModalData).not.toHaveBeenCalled()
    expect(d.handleToggleActive).not.toHaveBeenCalled()
  })

  it('blocks ledger export in sensitive mode', async () => {
    const d = makeDeps({ hideSensitive: true })
    await dispatchAiActions([{ type: 'openLedgerExport', payload: {} }], d)
    expect(d.setAiLedgerExportRequest).not.toHaveBeenCalled()
    expect(d.showToast).toHaveBeenCalledOnce()
  })

  it('still allows read-only navigation in sensitive mode', async () => {
    const d = makeDeps({ hideSensitive: true })
    await dispatchAiActions([{ type: 'openDashboard', payload: {} }], d)
    expect(d.setActiveTab).toHaveBeenCalledWith('dashboard')
    expect(d.showToast).not.toHaveBeenCalled()
  })
})

describe('dispatchAiActions — record actions', () => {
  it('opens a confirm modal for a matching pending bill', async () => {
    const pending = {
      id: 'n1', recurringPaymentId: 'rp1', name: 'Rent', amount: 100, category: 'Rent',
      ledgerCategory: 'Essentials', billingDate: '2026-07-01', year: 2026, month: 7, cycleLabel: 'Jul',
    }
    const d = makeDeps({ getPendingNotifications: () => [pending] })
    await dispatchAiActions([{ type: 'requestConfirmRecurringBill', payload: { id: 'rp1' } }], d)
    expect(d.setConfirmModalData).toHaveBeenCalledOnce()
  })

  it('warns when no matching pending bill exists', async () => {
    const d = makeDeps({ getPendingNotifications: () => [] })
    await dispatchAiActions([{ type: 'requestConfirmRecurringBill', payload: { id: 'rp1' } }], d)
    expect(d.setConfirmModalData).not.toHaveBeenCalled()
    expect(d.showToast).toHaveBeenCalledOnce()
  })

  it('no-ops a toggle when the payment is already in the requested state', async () => {
    const payment = { id: 'rp1', name: 'Netflix', active: true } as AiActionsDeps['allRecurringPayments'][number]
    const d = makeDeps({ allRecurringPayments: [payment] })
    await dispatchAiActions([{ type: 'toggleRecurring', payload: { id: 'rp1', active: true } }], d)
    expect(d.handleToggleActive).not.toHaveBeenCalled()
    expect(d.showToast).toHaveBeenCalledOnce() // "already on"
  })

  it('toggles a payment when the requested state differs', async () => {
    const payment = { id: 'rp1', name: 'Netflix', active: false } as AiActionsDeps['allRecurringPayments'][number]
    const d = makeDeps({ allRecurringPayments: [payment] })
    await dispatchAiActions([{ type: 'toggleRecurring', payload: { id: 'rp1', active: true } }], d)
    expect(d.handleToggleActive).toHaveBeenCalledWith('rp1')
  })
})
