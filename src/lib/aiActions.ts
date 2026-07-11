// AI UI-action dispatcher, extracted from App.tsx's handleAiActions.
//
// The AI assistant returns a list of UI actions (open a tab, prefill a draft,
// request a delete, etc.); this routes each one to the matching app handler.
// It orchestrates App-level handlers rather than owning state, so those are
// injected via `AiActionsDeps`. The payload coercion helpers are pure and
// exported for direct testing.

import type { ReactNode } from 'react'
import type { AiUiAction } from './api'
import * as api from './api'
import type { PendingNotification, RecurringPayment, WishlistItem } from '../types'

/** Trim-and-return a string payload field, or null if absent/blank. */
export function getPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Coerce a numeric payload field (number or numeric string), or null. */
export function getPayloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Action types that mutate records — blocked while sensitive mode is active. */
export const AI_MUTATION_TYPES = new Set<string>([
  'openEditLedgerDraft', 'openEditRecurringDraft', 'openEditWishlistDraft',
  'requestDeleteLedger', 'requestDeleteRecurring', 'requestDeleteWishlist',
  'requestConfirmRecurringBill', 'requestDiscardRecurringBill',
  'requestPurchaseWishlist', 'requestUnpurchaseWishlist', 'toggleRecurring',
])

interface NonceDraft { nonce: number; fields: Record<string, unknown> }
interface NonceEditDraft<Id> { nonce: number; id: Id; changes: Record<string, unknown> }

type ToastFn = (message: string, title?: string, tone?: 'info' | 'success' | 'warning' | 'error') => void

export interface AiActionsDeps {
  hideSensitive: boolean
  showToast: ToastFn
  setActiveTab: (tab: 'dashboard' | 'recurring' | 'wishlist' | 'ledger') => void
  handleSelectPeriod: (month: string, year: number) => Promise<void> | void
  handleNavigateToLedger: (options: {
    category?: string | null
    search?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => void
  nextNonce: () => number
  setAiLedgerDraft: (v: NonceDraft) => void
  setAiRecurringDraft: (v: NonceDraft) => void
  setAiWishlistDraft: (v: NonceDraft) => void
  setAiLedgerEditDraft: (v: NonceEditDraft<string>) => void
  setAiRecurringEditDraft: (v: NonceEditDraft<string>) => void
  setAiWishlistEditDraft: (v: NonceEditDraft<number>) => void
  setAiLedgerExportRequest: (v: { nonce: number }) => void
  requestDeleteLedger: (id: string) => Promise<void> | void
  requestDeletePayment: (id: string) => void
  requestDeleteWishlistItem: (id: number) => void
  allRecurringPayments: RecurringPayment[]
  allWishlist: WishlistItem[]
  handleToggleActive: (id: string) => void
  getPendingNotifications: () => PendingNotification[]
  setConfirmModalData: (data: {
    title: string
    message: ReactNode
    confirmText?: string
    confirmDisabled?: boolean
    onConfirm: () => void
  }) => void
  handleDiscardSubscription: (noti: PendingNotification) => void
  handleConfirmSubscription: (noti: PendingNotification, paidDate: string) => void
  handlePurchaseWishlistItem: (id: number) => void
  handleUnpurchaseWishlistItem: (id: number) => void
}

/** Build the confirm-delete flow for an AI-requested ledger deletion. */
export async function requestAiLedgerDelete(
  id: string,
  deps: Pick<AiActionsDeps, 'showToast' | 'setConfirmModalData'> & {
    allTransactions: { id: string; description: string }[]
    handleDeleteTransaction: (id: string) => void
  }
): Promise<void> {
  let transaction: { id: string; description: string } | undefined =
    deps.allTransactions.find(t => String(t.id) === String(id))
  if (!transaction) {
    transaction = await api.fetchTransactionById(id).catch(() => undefined) as typeof transaction
  }
  if (!transaction) {
    deps.showToast('The transaction could not be found.', 'Delete unavailable', 'warning')
    return
  }
  const deletesSplitGroup = transaction.id.includes('-split-')
  const tx = transaction
  deps.setConfirmModalData({
    title: 'Delete Transaction',
    message: deletesSplitGroup
      ? `Delete "${tx.description}"? This is part of an Income Auto-Split, so the main Income record and all related splits will be deleted.`
      : `Delete "${tx.description}"? This action will only proceed after you confirm here.`,
    confirmText: 'Delete',
    onConfirm: () => deps.handleDeleteTransaction(tx.id),
  })
}

/** Route up to the first three AI UI actions to their app handlers. */
export async function dispatchAiActions(actions: AiUiAction[], deps: AiActionsDeps): Promise<void> {
  for (const action of actions.slice(0, 3)) {
    const payload = (action.payload || {}) as Record<string, unknown>
    if (deps.hideSensitive && AI_MUTATION_TYPES.has(action.type)) {
      deps.showToast('Unhide balances to make record changes.', 'Sensitive mode active', 'warning')
      continue
    }
    if (deps.hideSensitive && action.type === 'openLedgerExport') {
      deps.showToast('Unhide balances before exporting transactions.', 'Sensitive mode active', 'warning')
      continue
    }
    if (action.type === 'openDashboard') {
      deps.setActiveTab('dashboard')
    } else if (action.type === 'openRecurring') {
      deps.setActiveTab('recurring')
    } else if (action.type === 'openWishlist') {
      deps.setActiveTab('wishlist')
    } else if (action.type === 'openLedger' || action.type === 'openLedgerExport') {
      const month = getPayloadString(payload, 'month')
      const year = getPayloadNumber(payload, 'year')
      if (month && year) {
        await deps.handleSelectPeriod(month, year)
      }
      const txTypeValue = getPayloadString(payload, 'txType')
      const txType = txTypeValue === 'inflow' || txTypeValue === 'outflow' || txTypeValue === 'transfer' ? txTypeValue : null
      const rangeValue = getPayloadString(payload, 'range')
      const range = rangeValue === '3month' || rangeValue === '6month' || rangeValue === 'yearly' ? rangeValue : 'monthly'
      deps.handleNavigateToLedger({
        category: getPayloadString(payload, 'category') || getPayloadString(payload, 'ledgerCategory'),
        txType,
        search: getPayloadString(payload, 'search'),
        date: getPayloadString(payload, 'date'),
        showAllCycles: payload.allCycles === true || range !== 'monthly',
        range,
      })
      if (action.type === 'openLedgerExport') {
        deps.setAiLedgerExportRequest({ nonce: deps.nextNonce() })
      }
    } else if (action.type === 'openAddLedgerDraft') {
      deps.setAiLedgerDraft({ nonce: deps.nextNonce(), fields: payload })
      deps.setActiveTab('ledger')
    } else if (action.type === 'openAddRecurringDraft') {
      deps.setAiRecurringDraft({ nonce: deps.nextNonce(), fields: payload })
      deps.setActiveTab('recurring')
    } else if (action.type === 'openAddWishlistDraft') {
      deps.setAiWishlistDraft({ nonce: deps.nextNonce(), fields: payload })
      deps.setActiveTab('wishlist')
    } else if (action.type === 'openEditLedgerDraft') {
      if (deps.hideSensitive) {
        deps.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
        continue
      }
      const id = getPayloadString(payload, 'id')
      const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes as Record<string, unknown> : {}
      if (id) {
        deps.setAiLedgerEditDraft({ nonce: deps.nextNonce(), id, changes })
        deps.setActiveTab('ledger')
      }
    } else if (action.type === 'openEditRecurringDraft') {
      if (deps.hideSensitive) {
        deps.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
        continue
      }
      const id = getPayloadString(payload, 'id')
      const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes as Record<string, unknown> : {}
      if (id) {
        deps.setAiRecurringEditDraft({ nonce: deps.nextNonce(), id, changes })
        deps.setActiveTab('recurring')
      }
    } else if (action.type === 'openEditWishlistDraft') {
      if (deps.hideSensitive) {
        deps.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
        continue
      }
      const id = getPayloadNumber(payload, 'id')
      const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes as Record<string, unknown> : {}
      if (id != null) {
        deps.setAiWishlistEditDraft({ nonce: deps.nextNonce(), id, changes })
        deps.setActiveTab('wishlist')
      }
    } else if (action.type === 'requestDeleteLedger') {
      const id = getPayloadString(payload, 'id')
      if (id) await deps.requestDeleteLedger(id)
    } else if (action.type === 'requestDeleteRecurring') {
      const id = getPayloadString(payload, 'id')
      if (id) deps.requestDeletePayment(id)
    } else if (action.type === 'requestDeleteWishlist') {
      const id = getPayloadNumber(payload, 'id')
      if (id != null) deps.requestDeleteWishlistItem(id)
    } else if (action.type === 'toggleRecurring') {
      const id = getPayloadString(payload, 'id')
      const payment = id ? deps.allRecurringPayments.find(p => String(p.id) === id) : undefined
      const requestedActive = typeof payload.active === 'boolean' ? payload.active : payment ? !payment.active : null
      if (payment && requestedActive !== null && payment.active !== requestedActive) {
        deps.handleToggleActive(payment.id)
      } else if (payment && payment.active === requestedActive) {
        deps.showToast(`"${payment.name}" is already ${requestedActive ? 'on' : 'off'}.`, 'No change needed', 'info')
      }
    } else if (action.type === 'requestConfirmRecurringBill' || action.type === 'requestDiscardRecurringBill') {
      const id = getPayloadString(payload, 'id')
      const requestedDate = getPayloadString(payload, 'date')
      const pending = deps.getPendingNotifications().find(notification =>
        notification.recurringPaymentId === id && (!requestedDate || notification.billingDate === requestedDate)
      )
      if (!pending) {
        deps.showToast('No matching pending bill was found in the active cycle.', 'Bill action unavailable', 'warning')
        continue
      }
      const isDiscard = action.type === 'requestDiscardRecurringBill'
      deps.setConfirmModalData({
        title: isDiscard ? 'Discard Scheduled Bill' : 'Confirm Bill Paid',
        message: isDiscard
          ? `Discard "${pending.name}" for ${pending.billingDate}? No expense will be recorded for this cycle.`
          : `Mark "${pending.name}" as paid on ${requestedDate || pending.billingDate}?`,
        confirmText: isDiscard ? 'Discard' : 'Confirm Paid',
        onConfirm: () => isDiscard
          ? deps.handleDiscardSubscription(pending)
          : deps.handleConfirmSubscription(pending, requestedDate || pending.billingDate),
      })
    } else if (action.type === 'requestPurchaseWishlist' || action.type === 'requestUnpurchaseWishlist') {
      const id = getPayloadNumber(payload, 'id')
      const item = id == null ? undefined : deps.allWishlist.find(w => Number(w.id) === id)
      if (!item) {
        deps.showToast('The wishlist item could not be found.', 'Wishlist action unavailable', 'warning')
        continue
      }
      const undoPurchase = action.type === 'requestUnpurchaseWishlist'
      deps.setConfirmModalData({
        title: undoPurchase ? 'Undo Wishlist Purchase' : 'Claim Wishlist Item',
        message: undoPurchase
          ? `Undo the purchase of "${item.name}" and remove its linked ledger transaction?`
          : `Claim "${item.name}" and create its linked Rewards transaction?`,
        confirmText: undoPurchase ? 'Undo Purchase' : 'Claim',
        onConfirm: () => undoPurchase ? deps.handleUnpurchaseWishlistItem(item.id) : deps.handlePurchaseWishlistItem(item.id),
      })
    }
  }
}
