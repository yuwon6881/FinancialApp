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
    setAiLedgerDraft: vi.fn(),
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

  it('prefills a ledger draft with a fresh nonce and opens the tab', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openAddLedgerDraft', payload: { amount: 5 } }], d)
    expect(d.setAiLedgerDraft).toHaveBeenCalledWith({ nonce: 1, fields: { amount: 5 } })
    expect(d.setActiveTab).toHaveBeenCalledWith('ledger')
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
