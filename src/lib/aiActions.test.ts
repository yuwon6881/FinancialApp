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
    navigate: vi.fn(),
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
    setAiSavingsGoalDraft: vi.fn(),
    setAiSavingsGoalEditDraft: vi.fn(),
    setAiLedgerExportRequest: vi.fn(),
    requestDeleteLedger: vi.fn(),
    requestDeletePayment: vi.fn(),
    requestDeleteWishlistItem: vi.fn(),
    allRecurringPayments: [],
    allWishlist: [],
    getRewardsBalance: () => 0,
    handleToggleActive: vi.fn(),
    handleUpdateReminder: vi.fn(),
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
  it('routes tab-open actions to a single navigation', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openDashboard', payload: {} }], d)
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'dashboard' })
  })

  it('keeps a report cycle and portfolio navigation in the existing views', async () => {
    const d = makeDeps()
    await dispatchAiActions([
      { type: 'openReports', payload: { cycleKey: '2026-06' } },
      { type: 'openInvestments', payload: {} },
    ], d)

    expect(d.handleSelectPeriod).toHaveBeenCalledWith('Jun', 2026)
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'investments' })
  })

  it('opens Savings Goal drafts without saving or funding them', async () => {
    const d = makeDeps()
    await dispatchAiActions([
      {
        type: 'openAddSavingsGoalDraft',
        payload: { name: 'Emergency fund', targetAmount: 1000, targetDate: '2027-01-01', priority: 'high', isRecurring: false, recurrenceMonths: 12 },
      },
      { type: 'openEditSavingsGoalDraft', payload: { id: 3, changes: { targetAmount: 1200 } } },
    ], d)

    expect(d.setAiSavingsGoalDraft).toHaveBeenCalledWith(expect.objectContaining({ fields: expect.objectContaining({ name: 'Emergency Fund' }) }))
    expect(d.setAiSavingsGoalEditDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
    expect(d.handlePurchaseWishlistItem).not.toHaveBeenCalled()
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'wishlist' })
  })

  it('processes at most the first three actions and navigates exactly once', async () => {
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
    expect(d.navigate).toHaveBeenCalledOnce()
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'wishlist' })
    expect(d.handleNavigateToLedger).not.toHaveBeenCalled()
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
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'drafts' })
  })

  it('keeps Drafts as the final destination when a reply also contains another navigation action', async () => {
    const d = makeDeps()
    await dispatchAiActions([
      { type: 'openAddLedgerDraft', payload: { description: 'Lunch', amount: 12, txType: 'outflow', category: 'Food', ledgerCategory: 'Essentials', ledgerCategorySpecified: false } },
      { type: 'openDashboard', payload: {} },
    ], d)

    expect(d.stageAiLedgerDrafts).toHaveBeenCalledOnce()
    expect(d.navigate).toHaveBeenCalledOnce()
    expect(d.navigate).toHaveBeenLastCalledWith({ tab: 'drafts' })
  })

  it('capitalizes each word of an AI-added ledger description', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openAddLedgerDraft', payload: {
      description: 'nasi lemak', amount: 12, txType: 'outflow', category: 'Food', ledgerCategory: 'Essentials', ledgerCategorySpecified: false,
    } }], d)
    expect(d.stageAiLedgerDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ description: 'Nasi Lemak' }),
    ])
  })

  it('capitalizes AI-added recurring and wishlist names', async () => {
    const d = makeDeps()
    await dispatchAiActions([
      { type: 'openAddRecurringDraft', payload: { name: 'netflix subscription', amount: 15 } },
      { type: 'openAddWishlistDraft', payload: { name: 'new headphones', price: 200 } },
    ], d)
    expect(d.setAiRecurringDraft).toHaveBeenCalledWith(
      expect.objectContaining({ fields: expect.objectContaining({ name: 'Netflix Subscription' }) })
    )
    expect(d.setAiWishlistDraft).toHaveBeenCalledWith(
      expect.objectContaining({ fields: expect.objectContaining({ name: 'New Headphones' }) })
    )
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
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'dashboard' })
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

  it('toggles a payment when the requested state differs and lands on its card', async () => {
    const payment = { id: 'rp1', name: 'Netflix', active: false } as AiActionsDeps['allRecurringPayments'][number]
    const d = makeDeps({ allRecurringPayments: [payment] })
    await dispatchAiActions([{ type: 'toggleRecurring', payload: { id: 'rp1', active: true } }], d)
    expect(d.handleToggleActive).toHaveBeenCalledWith('rp1')
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'recurring', recurringId: 'rp1' })
  })
})

describe('dispatchAiActions — ledger filters', () => {
  it('passes the advanced filter fields through to the ledger', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openLedger', payload: {
      minAmount: 250, maxAmount: 1000, startDate: '2026-07-01', endDate: '2026-07-31',
      recurringOnly: true, txType: 'outflow',
    } }], d)

    expect(d.handleNavigateToLedger).toHaveBeenCalledWith(expect.objectContaining({
      minAmount: '250',
      maxAmount: '1000',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      recurringOnly: true,
      wishlistOnly: false,
      txType: 'outflow',
    }))
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'ledger' })
  })

  it('leaves amount filters unset when the AI did not ask for them', async () => {
    const d = makeDeps()
    await dispatchAiActions([{ type: 'openLedger', payload: { category: 'Food' } }], d)
    expect(d.handleNavigateToLedger).toHaveBeenCalledWith(expect.objectContaining({
      minAmount: null, maxAmount: null, recurringOnly: false, wishlistOnly: false,
    }))
  })
})

describe('dispatchAiActions — recurring reminders', () => {
  const payment = {
    id: 'rp1', name: 'Netflix', active: true, reminderEnabled: false, reminderMode: 'Once', reminderLeadDays: 3,
  } as AiActionsDeps['allRecurringPayments'][number]

  it('turns a reminder on with the requested mode and lead time', async () => {
    const d = makeDeps({ allRecurringPayments: [payment] })
    await dispatchAiActions([{ type: 'updateRecurringReminder', payload: {
      id: 'rp1', enabled: true, reminderMode: 'Daily', leadDays: 7,
    } }], d)

    expect(d.handleUpdateReminder).toHaveBeenCalledWith('rp1', { enabled: true, mode: 'Daily', leadDays: 7 })
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'recurring', recurringId: 'rp1' })
  })

  it('keeps the saved mode and lead time when the request names neither', async () => {
    const d = makeDeps({ allRecurringPayments: [{ ...payment, reminderMode: 'Daily', reminderLeadDays: 7 }] })
    await dispatchAiActions([{ type: 'updateRecurringReminder', payload: { id: 'rp1', enabled: true } }], d)
    expect(d.handleUpdateReminder).toHaveBeenCalledWith('rp1', { enabled: true, mode: 'Daily', leadDays: 7 })
  })

  it('rejects a lead time the reminder controls do not offer', async () => {
    const d = makeDeps({ allRecurringPayments: [payment] })
    await dispatchAiActions([{ type: 'updateRecurringReminder', payload: {
      id: 'rp1', enabled: true, reminderMode: 'Once', leadDays: 5,
    } }], d)
    expect(d.handleUpdateReminder).toHaveBeenCalledWith('rp1', { enabled: true, mode: 'Once', leadDays: 3 })
  })

  it('does nothing when the reminder already matches', async () => {
    const d = makeDeps({ allRecurringPayments: [{ ...payment, reminderEnabled: false }] })
    await dispatchAiActions([{ type: 'updateRecurringReminder', payload: { id: 'rp1', enabled: false } }], d)
    expect(d.handleUpdateReminder).not.toHaveBeenCalled()
    expect(d.showToast).toHaveBeenCalledOnce()
  })
})

describe('dispatchAiActions — wishlist claim', () => {
  const item = { id: 7, name: 'Headphones', price: 200, isPurchased: false } as AiActionsDeps['allWishlist'][number]

  it('opens the claim confirmation when Rewards covers the price', async () => {
    const d = makeDeps({ allWishlist: [item], getRewardsBalance: () => 250 })
    await dispatchAiActions([{ type: 'requestPurchaseWishlist', payload: { id: 7 } }], d)
    expect(d.setConfirmModalData).toHaveBeenCalledOnce()
  })

  it('refuses the claim when Rewards is short', async () => {
    const d = makeDeps({ allWishlist: [item], getRewardsBalance: () => 199.99 })
    await dispatchAiActions([{ type: 'requestPurchaseWishlist', payload: { id: 7 } }], d)
    expect(d.setConfirmModalData).not.toHaveBeenCalled()
    expect(d.showToast).toHaveBeenCalledOnce()
    expect(d.navigate).toHaveBeenCalledWith({ tab: 'wishlist' })
  })

  it('refuses a claim for an item that was already claimed', async () => {
    const d = makeDeps({ allWishlist: [{ ...item, isPurchased: true }], getRewardsBalance: () => 10_000 })
    await dispatchAiActions([{ type: 'requestPurchaseWishlist', payload: { id: 7 } }], d)
    expect(d.setConfirmModalData).not.toHaveBeenCalled()
    expect(d.showToast).toHaveBeenCalledOnce()
  })

  it('still allows undoing a purchase regardless of the Rewards balance', async () => {
    const d = makeDeps({ allWishlist: [{ ...item, isPurchased: true }], getRewardsBalance: () => 0 })
    await dispatchAiActions([{ type: 'requestUnpurchaseWishlist', payload: { id: 7 } }], d)
    expect(d.setConfirmModalData).toHaveBeenCalledOnce()
  })
})
