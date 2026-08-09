// AI UI-action dispatcher, extracted from App.tsx's handleAiActions.
//
// The AI assistant returns a list of UI actions (open a tab, prefill a draft,
// request a delete, etc.); this routes each one to the matching app handler.
// It orchestrates App-level handlers rather than owning state, so those are
// injected via `AiActionsDeps`. The payload coercion helpers are pure and
// exported for direct testing.

import type { Dispatch, ReactNode } from 'react'
import type { AiUiAction } from './api/ai'
import { fetchTransactionById } from './api/transactions'
import { capitalizeWords } from './utils'
import { buildMutationSuccessToast } from './mutationToast'
import { REMINDER_LEAD_DAY_OPTIONS } from './recurringPayments'
import type { PendingNotification, RecurringPayment, Transaction, TransactionCategory, WishlistItem } from '../types'
import type {
  AiActionRouterPatch,
  UseAiActionRouterOptions,
} from '../app/useAiActionRouter'

/** Trim-and-return a string payload field, or null if absent/blank. */
export function getPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Return a copy of an AI add payload with the given free-text field title-cased,
 * so assistant-added records read cleanly (e.g. "bills" → "Bills"). Non-string or
 * blank values are left untouched.
 */
function capitalizePayloadField(payload: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = payload[key]
  if (typeof value !== 'string' || !value.trim()) return payload
  return { ...payload, [key]: capitalizeWords(value) }
}

const CYCLE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseCycleKey(value: string | null): { month: string; year: number } | null {
  if (!value) return null
  const match = /^(19|20)(\d{2})-(0[1-9]|1[0-2])$/.exec(value)
  if (!match) return null
  return { year: Number(`${match[1]}${match[2]}`), month: CYCLE_MONTHS[Number(match[3]) - 1] }
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
  'openAddLedgerDraft', 'openAddRecurringDraft', 'openAddWishlistDraft', 'openEditLedgerDraft', 'openEditRecurringDraft', 'openEditWishlistDraft',
  'openAddSavingsGoalDraft', 'openEditSavingsGoalDraft',
  'requestDeleteLedger', 'requestDeleteRecurring', 'requestDeleteWishlist',
  'requestConfirmRecurringBill', 'requestDiscardRecurringBill',
  'requestPurchaseWishlist', 'requestUnpurchaseWishlist', 'toggleRecurring', 'updateRecurringReminder',
])

/**
 * Where the app should end up once a batch has been applied, plus the record to scroll to and
 * highlight once there. Collected during dispatch and handed to the app exactly once at the end,
 * so an action later in the batch cannot leave the user looking at the wrong screen and a
 * repeated request always re-triggers the navigation (the app keys it on a fresh nonce rather
 * than on the tab changing value).
 */
export interface AiNavigationTarget {
  tab: 'dashboard' | 'reports' | 'investments' | 'recurring' | 'wishlist' | 'ledger' | 'drafts'
  /** Recurring payment to scroll to and highlight on the Recurring tab. */
  recurringId?: string | null
  /** Transaction to scroll to and highlight in the ledger list. */
  ledgerTxId?: string | null
  cycleKey?: string | null
}

/**
 * Lazy App adapter. Keeping this dependency assembly in the action chunk prevents Ask AI-only
 * routing branches from joining the eager application path.
 */
export function dispatchAiActionsForApp(
  actions: AiUiAction[],
  options: UseAiActionRouterOptions,
  dispatch: Dispatch<AiActionRouterPatch>,
  nextNonce: () => number,
): Promise<void> {
  return dispatchAiActions(actions, {
    hideSensitive: options.hideSensitive,
    showToast: options.showToast,
    navigate: target => dispatch({ aiNavigation: { ...target, nonce: nextNonce() } }),
    handleSelectPeriod: options.handleSelectPeriod,
    handleNavigateToLedger: options.handleNavigateToLedger,
    nextNonce,
    transactionCategories: options.allCategories,
    stageAiLedgerDrafts: options.handleStageDraftTransactions,
    setAiRecurringDraft: value => dispatch({ aiRecurringDraft: value }),
    setAiWishlistDraft: value => dispatch({ aiWishlistDraft: value }),
    setAiLedgerEditDraft: value => dispatch({ aiLedgerEditDraft: value }),
    setAiRecurringEditDraft: value => dispatch({ aiRecurringEditDraft: value }),
    setAiWishlistEditDraft: value => dispatch({ aiWishlistEditDraft: value }),
    setAiSavingsGoalDraft: value => dispatch({ aiSavingsGoalDraft: value }),
    setAiSavingsGoalEditDraft: value => dispatch({ aiSavingsGoalEditDraft: value }),
    setAiLedgerExportRequest: value => dispatch({ aiLedgerExportRequest: value }),
    requestDeleteLedger: id => requestAiLedgerDelete(id, {
      showToast: options.showToast,
      setConfirmModalData: options.setConfirmModalData,
      allTransactions: options.allTransactions,
      handleDeleteTransaction: options.handleDeleteTransaction,
    }),
    requestDeletePayment: options.requestDeletePayment,
    requestDeleteWishlistItem: options.requestDeleteWishlistItem,
    allRecurringPayments: options.allRecurringPayments,
    allWishlist: options.allWishlist,
    getRewardsBalance: options.getRewardsBalance,
    handleToggleActive: options.handleToggleActive,
    handleUpdateReminder: options.handleUpdateReminder,
    getPendingNotifications: () => options.optimisticDashboardData?.pendingNotifications || [],
    setConfirmModalData: options.setConfirmModalData,
    handleDiscardSubscription: options.handleDiscardSubscription,
    handleConfirmSubscription: options.handleConfirmSubscription,
    handlePurchaseWishlistItem: options.handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem: options.handleUnpurchaseWishlistItem,
  })
}

/** Actions that open the single shared confirm modal before anything is applied. */
export const AI_CONFIRMATION_TYPES = new Set<string>([
  'requestDeleteLedger', 'requestDeleteRecurring', 'requestDeleteWishlist',
  'requestConfirmRecurringBill', 'requestDiscardRecurringBill',
  'requestPurchaseWishlist', 'requestUnpurchaseWishlist',
])

interface NonceDraft { nonce: number; fields: Record<string, unknown> }
interface NonceEditDraft<Id> { nonce: number; id: Id; changes: Record<string, unknown> }

type ToastFn = (message: string, title?: string, tone?: 'info' | 'success' | 'warning' | 'error') => void

export interface AiActionsDeps {
  hideSensitive: boolean
  showToast: ToastFn
  /** Applies the batch's single final destination (tab + optional scroll/highlight target). */
  navigate: (target: AiNavigationTarget) => void
  handleSelectPeriod: (month: string, year: number) => Promise<void> | void
  handleNavigateToLedger: (options: {
    category?: string | null
    search?: string | null
    date?: string | null
    startDate?: string | null
    endDate?: string | null
    minAmount?: string | null
    maxAmount?: string | null
    recurringOnly?: boolean
    wishlistOnly?: boolean
    txType?: 'inflow' | 'outflow' | 'transfer' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => void
  nextNonce: () => number
  transactionCategories: TransactionCategory[]
  stageAiLedgerDrafts: (drafts: Omit<Transaction, 'id'>[]) => void
  setAiRecurringDraft: (v: NonceDraft) => void
  setAiWishlistDraft: (v: NonceDraft) => void
  setAiLedgerEditDraft: (v: NonceEditDraft<string>) => void
  setAiRecurringEditDraft: (v: NonceEditDraft<string>) => void
  setAiWishlistEditDraft: (v: NonceEditDraft<number>) => void
  setAiSavingsGoalDraft: (v: NonceDraft) => void
  setAiSavingsGoalEditDraft: (v: NonceEditDraft<number>) => void
  setAiLedgerExportRequest: (v: { nonce: number }) => void
  requestDeleteLedger: (id: string) => Promise<void> | void
  requestDeletePayment: (id: string) => void
  requestDeleteWishlistItem: (id: number) => void
  allRecurringPayments: RecurringPayment[]
  allWishlist: WishlistItem[]
  /** Current Rewards balance — a wishlist claim is only possible once this covers the price. */
  getRewardsBalance: () => number
  handleToggleActive: (id: string) => void
  handleUpdateReminder: (id: string, settings: { enabled: boolean; mode: 'Once' | 'Daily'; leadDays: number }) => void
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
    allTransactions: Transaction[]
    handleDeleteTransaction: (id: string, transaction?: Transaction) => void
  }
): Promise<void> {
  let transaction: Transaction | undefined =
    deps.allTransactions.find(t => String(t.id) === String(id))
  if (!transaction) {
    transaction = await fetchTransactionById(id).catch(() => undefined)
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
      ? `Delete "${tx.description}"? Its Income Auto-Split parent and related splits will also be deleted.`
      : tx.savingsGoalId != null
        ? `Delete "${tx.description}"? This restores the commitment's saved amount and deadline.`
      : `Delete "${tx.description}"? Confirm to continue.`,
    confirmText: 'Delete',
    onConfirm: () => deps.handleDeleteTransaction(tx.id, tx),
  })
}

/** Route AI UI actions, allowing a ledger-only batch while retaining the normal three-action cap. */
export async function dispatchAiActions(actions: AiUiAction[], deps: AiActionsDeps): Promise<void> {
  const candidates = actions.slice(0, 50)
  const containsOnlyLedgerDrafts = candidates.length > 0 && candidates.every(action => action.type === 'openAddLedgerDraft')
  const selectedActions = containsOnlyLedgerDrafts ? candidates : actions.slice(0, 3)

  if (containsOnlyLedgerDrafts) {
    if (deps.hideSensitive) {
      deps.showToast('Unhide balances to make record changes.', 'Sensitive mode active', 'warning')
      return
    }
    const { buildAiLedgerDraftTransactions } = await import('./aiLedgerDrafts')
    const drafts = selectedActions.flatMap(action =>
      buildAiLedgerDraftTransactions((action.payload || {}) as Record<string, unknown>, deps.transactionCategories)
    )
    if (drafts.length === 0) {
      deps.showToast('No valid ledger transactions were found in the AI response.', 'Drafts not created', 'warning')
      return
    }
    deps.stageAiLedgerDrafts(drafts)
    deps.navigate({ tab: 'drafts' })
    return
  }

  // Every branch below records where the user should end up instead of navigating inline, and
  // the winner is applied once after the loop. An AI reply can include a follow-up navigation
  // action after creating a ledger draft, so the staged draft claims the destination and a
  // later action cannot leave the user on another tab with an unseen draft.
  const finalDestination: { target: AiNavigationTarget | null; locked: boolean } = { target: null, locked: false }
  const setDestination = (target: AiNavigationTarget) => {
    if (!finalDestination.locked) finalDestination.target = target
  }
  // Only one confirm modal can be on screen at a time — `setConfirmModalData` is a
  // plain setState, so a second confirmation-bearing action in the same batch would
  // silently replace the first. Honour the first and tell the user about the rest.
  let confirmClaimed = false
  let skippedConfirmations = 0
  for (const action of selectedActions) {
    const payload = (action.payload || {}) as Record<string, unknown>
    if (deps.hideSensitive && AI_MUTATION_TYPES.has(action.type)) {
      deps.showToast('Unhide balances to make record changes.', 'Sensitive mode active', 'warning')
      continue
    }
    if (deps.hideSensitive && action.type === 'openLedgerExport') {
      deps.showToast('Unhide balances before exporting transactions.', 'Sensitive mode active', 'warning')
      continue
    }
    if (AI_CONFIRMATION_TYPES.has(action.type)) {
      if (confirmClaimed) {
        skippedConfirmations += 1
        continue
      }
      confirmClaimed = true
    }
    if (action.type === 'openDashboard') {
      setDestination({ tab: 'dashboard' })
    } else if (action.type === 'openReports') {
      const cycle = parseCycleKey(getPayloadString(payload, 'cycleKey'))
      if (cycle) await deps.handleSelectPeriod(cycle.month, cycle.year)
      setDestination({ tab: 'reports', cycleKey: cycle ? `${cycle.year}-${String(CYCLE_MONTHS.indexOf(cycle.month) + 1).padStart(2, '0')}` : null })
    } else if (action.type === 'openInvestments') {
      setDestination({ tab: 'investments' })
    } else if (action.type === 'openRecurring') {
      setDestination({ tab: 'recurring' })
    } else if (action.type === 'openWishlist') {
      setDestination({ tab: 'wishlist' })
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
      const minAmount = getPayloadNumber(payload, 'minAmount')
      const maxAmount = getPayloadNumber(payload, 'maxAmount')
      deps.handleNavigateToLedger({
        category: getPayloadString(payload, 'category') || getPayloadString(payload, 'ledgerCategory'),
        txType,
        search: getPayloadString(payload, 'search'),
        date: getPayloadString(payload, 'date'),
        startDate: getPayloadString(payload, 'startDate'),
        endDate: getPayloadString(payload, 'endDate'),
        // The filter bar stores amounts as raw input strings, not numbers.
        minAmount: minAmount != null && minAmount >= 0 ? String(minAmount) : null,
        maxAmount: maxAmount != null && maxAmount >= 0 ? String(maxAmount) : null,
        recurringOnly: payload.recurringOnly === true,
        wishlistOnly: payload.wishlistOnly === true,
        showAllCycles: payload.allCycles === true || range !== 'monthly',
        range,
      })
      setDestination({ tab: 'ledger' })
      if (action.type === 'openLedgerExport') {
        deps.setAiLedgerExportRequest({ nonce: deps.nextNonce() })
      }
    } else if (action.type === 'openAddLedgerDraft') {
      const { buildAiLedgerDraftTransactions } = await import('./aiLedgerDrafts')
      const drafts = buildAiLedgerDraftTransactions(payload, deps.transactionCategories)
      if (drafts.length === 0) {
        deps.showToast('No valid ledger transactions were found in the AI response.', 'Drafts not created', 'warning')
        continue
      }
      deps.stageAiLedgerDrafts(drafts)
      setDestination({ tab: 'drafts' })
      finalDestination.locked = true
    } else if (action.type === 'openAddRecurringDraft') {
      deps.setAiRecurringDraft({ nonce: deps.nextNonce(), fields: capitalizePayloadField(payload, 'name') })
      setDestination({ tab: 'recurring' })
    } else if (action.type === 'openAddWishlistDraft') {
      deps.setAiWishlistDraft({ nonce: deps.nextNonce(), fields: capitalizePayloadField(payload, 'name') })
      setDestination({ tab: 'wishlist' })
    } else if (action.type === 'openAddSavingsGoalDraft') {
      deps.setAiSavingsGoalDraft({ nonce: deps.nextNonce(), fields: capitalizePayloadField(payload, 'name') })
      setDestination({ tab: 'wishlist' })
    } else if (action.type === 'openEditLedgerDraft') {
      if (deps.hideSensitive) {
        deps.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
        continue
      }
      const id = getPayloadString(payload, 'id')
      const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes as Record<string, unknown> : {}
      if (id) {
        deps.setAiLedgerEditDraft({ nonce: deps.nextNonce(), id, changes })
        setDestination({ tab: 'ledger', ledgerTxId: id })
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
        setDestination({ tab: 'recurring', recurringId: id })
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
        setDestination({ tab: 'wishlist' })
      }
    } else if (action.type === 'openEditSavingsGoalDraft') {
      if (deps.hideSensitive) {
        deps.showToast('Unhide balances to make changes.', 'Sensitive mode active', 'warning')
        continue
      }
      const id = getPayloadNumber(payload, 'id')
      const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes as Record<string, unknown> : {}
      if (id != null && Object.keys(changes).length > 0) {
        deps.setAiSavingsGoalEditDraft({ nonce: deps.nextNonce(), id, changes })
        setDestination({ tab: 'wishlist' })
      }
    } else if (action.type === 'requestDeleteLedger') {
      const id = getPayloadString(payload, 'id')
      if (id) {
        await deps.requestDeleteLedger(id)
        setDestination({ tab: 'ledger', ledgerTxId: id })
      }
    } else if (action.type === 'requestDeleteRecurring') {
      const id = getPayloadString(payload, 'id')
      if (id) {
        deps.requestDeletePayment(id)
        setDestination({ tab: 'recurring', recurringId: id })
      }
    } else if (action.type === 'requestDeleteWishlist') {
      const id = getPayloadNumber(payload, 'id')
      if (id != null) {
        deps.requestDeleteWishlistItem(id)
        setDestination({ tab: 'wishlist' })
      }
    } else if (action.type === 'toggleRecurring') {
      const id = getPayloadString(payload, 'id')
      const payment = id ? deps.allRecurringPayments.find(p => String(p.id) === id) : undefined
      const requestedActive = typeof payload.active === 'boolean' ? payload.active : payment ? !payment.active : null
      if (!payment) {
        deps.showToast('That recurring payment could not be found.', 'Toggle unavailable', 'warning')
        continue
      }
      if (requestedActive !== null && payment.active !== requestedActive) {
        deps.handleToggleActive(payment.id)
        const copy = buildMutationSuccessToast({
          entity: 'Recurring Payment',
          action: requestedActive ? 'Resumed' : 'Paused',
          recordName: payment.name,
          messageVerb: requestedActive ? 'resumed' : 'paused',
        })
        deps.showToast(copy.message, copy.title, copy.tone)
      } else {
        deps.showToast(`"${payment.name}" is already ${requestedActive ? 'on' : 'off'}.`, 'No change needed', 'info')
      }
      setDestination({ tab: 'recurring', recurringId: payment.id })
    } else if (action.type === 'updateRecurringReminder') {
      const id = getPayloadString(payload, 'id')
      const payment = id ? deps.allRecurringPayments.find(p => String(p.id) === id) : undefined
      if (!payment) {
        deps.showToast('That recurring payment could not be found.', 'Reminder unavailable', 'warning')
        continue
      }
      if (typeof payload.enabled !== 'boolean') {
        deps.showToast('The AI did not say whether to turn the reminder on or off.', 'Reminder unchanged', 'warning')
        continue
      }
      const enabled = payload.enabled
      const requestedMode = getPayloadString(payload, 'reminderMode')
      const requestedLeadDays = getPayloadNumber(payload, 'leadDays')
      // Anything the request left out keeps the subscription's saved value, so "remind me daily"
      // does not silently reset a lead time the user chose earlier.
      const settings = {
        enabled,
        mode: requestedMode === 'Once' || requestedMode === 'Daily' ? requestedMode : (payment.reminderMode ?? 'Once'),
        leadDays: requestedLeadDays != null && REMINDER_LEAD_DAY_OPTIONS.includes(requestedLeadDays)
          ? requestedLeadDays
          : (payment.reminderLeadDays ?? 3),
      } as const
      const current = {
        enabled: payment.reminderEnabled ?? false,
        mode: payment.reminderMode ?? 'Once',
        leadDays: payment.reminderLeadDays ?? 3,
      }
      const unchanged = current.enabled === settings.enabled &&
        (!settings.enabled || (current.mode === settings.mode && current.leadDays === settings.leadDays))
      if (unchanged) {
        deps.showToast(`"${payment.name}" already uses those reminder settings.`, 'No change needed', 'info')
      } else {
        deps.handleUpdateReminder(payment.id, { ...settings })
        const copy = buildMutationSuccessToast({
          entity: 'Recurring Payment',
          action: 'Updated',
          recordName: payment.name,
          messageSuffix: settings.enabled
            ? `Reminder is on — ${settings.mode === 'Daily' ? 'daily' : 'once'}, ${settings.leadDays} day${settings.leadDays === 1 ? '' : 's'} before it is due.`
            : 'Reminder is off.',
        })
        deps.showToast(copy.message, copy.title, copy.tone)
      }
      setDestination({ tab: 'recurring', recurringId: payment.id })
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
        onConfirm: () => {
          if (isDiscard) deps.handleDiscardSubscription(pending)
          else deps.handleConfirmSubscription(pending, requestedDate || pending.billingDate)
          deps.navigate({ tab: 'recurring', recurringId: pending.recurringPaymentId })
        },
      })
      setDestination({ tab: 'recurring', recurringId: pending.recurringPaymentId })
    } else if (action.type === 'requestPurchaseWishlist' || action.type === 'requestUnpurchaseWishlist') {
      const id = getPayloadNumber(payload, 'id')
      const item = id == null ? undefined : deps.allWishlist.find(w => Number(w.id) === id)
      if (!item) {
        deps.showToast('The wishlist item could not be found.', 'Wishlist action unavailable', 'warning')
        continue
      }
      const undoPurchase = action.type === 'requestUnpurchaseWishlist'
      // Mirror exactly what the Wishlist card allows, so the assistant can never open a
      // confirmation for a claim the user could not make by hand: the goal must still be open
      // and the Rewards bucket must already cover its full price.
      if (!undoPurchase) {
        if (item.isPurchased) {
          deps.showToast(`"${item.name}" has already been claimed.`, 'Already claimed', 'info')
          setDestination({ tab: 'wishlist' })
          continue
        }
        if (deps.getRewardsBalance() < item.price) {
          deps.showToast(
            `"${item.name}" is not claimable yet — the Rewards bucket does not cover its price.`,
            'Not enough in Rewards',
            'warning',
          )
          setDestination({ tab: 'wishlist' })
          continue
        }
      }
      deps.setConfirmModalData({
        title: undoPurchase ? 'Undo Wishlist Purchase' : 'Claim Wishlist Item',
        message: undoPurchase
          ? `Undo the purchase of "${item.name}" and remove its linked ledger transaction?`
          : `Claim "${item.name}" and create its linked Rewards transaction?`,
        confirmText: undoPurchase ? 'Undo Purchase' : 'Claim',
        onConfirm: () => {
          if (undoPurchase) deps.handleUnpurchaseWishlistItem(item.id)
          else deps.handlePurchaseWishlistItem(item.id)
          deps.navigate({ tab: 'wishlist' })
        },
      })
      setDestination({ tab: 'wishlist' })
    }
  }
  if (finalDestination.target) deps.navigate(finalDestination.target)
  if (skippedConfirmations > 0) {
    deps.showToast(
      `${skippedConfirmations} more ${skippedConfirmations === 1 ? 'change needs' : 'changes need'} confirming. Ask again once you have answered this one.`,
      'One confirmation at a time',
      'info',
    )
  }
}
