import { useReducer, useRef, useCallback, useEffect } from 'react'
import type { AiUiAction } from '../lib/api/ai'
// Value-imported lazily inside handleAiActions: the dispatcher and its payload-coercion helpers
// are only reachable once the (already lazy) Ask AI panel returns actions, so keeping them off the
// eager critical path costs nothing at runtime. The type import is erased at build time.
import type { AiNavigationTarget } from '../lib/aiActions'
import type { LedgerAccount, RecurringReminderSettings, Transaction, TransactionCategory } from '../types'

export interface AiActionRouterState {
  aiLedgerEditDraft: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiRecurringDraft: { nonce: number; fields: Record<string, unknown> } | null
  aiRecurringEditDraft: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiWishlistDraft: { nonce: number; fields: Record<string, unknown> } | null
  aiWishlistEditDraft: { nonce: number; id: number; changes: Record<string, unknown> } | null
  aiSavingsGoalDraft: { nonce: number; fields: Record<string, unknown> } | null
  aiSavingsGoalEditDraft: { nonce: number; id: number; changes: Record<string, unknown> } | null
  aiLedgerExportRequest: { nonce: number } | null
  // The batch's final destination. Carried as state with a nonce rather than applied inline so
  // App performs the navigation in a commit of its own, after the mutations it follows have
  // landed — and so an identical repeat request (same tab, same record) still re-navigates
  // instead of being swallowed as "no change".
  aiNavigation: (AiNavigationTarget & { nonce: number }) | null
}

export type AiActionRouterPatch = Partial<AiActionRouterState>

const initialState: AiActionRouterState = {
  aiLedgerEditDraft: null,
  aiRecurringDraft: null,
  aiRecurringEditDraft: null,
  aiWishlistDraft: null,
  aiWishlistEditDraft: null,
  aiSavingsGoalDraft: null,
  aiSavingsGoalEditDraft: null,
  aiLedgerExportRequest: null,
  aiNavigation: null,
}

let aiActionNonce = 0
const nextAiActionNonce = () => {
  aiActionNonce += 1
  return aiActionNonce
}

const aiActionRouterReducer = (
  state: AiActionRouterState,
  patch: AiActionRouterPatch,
): AiActionRouterState => ({ ...state, ...patch })

export interface UseAiActionRouterOptions {
  hideSensitive: boolean
  showToast: (message: string, title?: string, tone?: any, action?: any) => void
  handleSelectPeriod: (month: string, year: number) => Promise<void> | void
  handleNavigateToLedger: (options: any) => void
  setConfirmModalData: (data: any) => void
  allTransactions: any[]
  handleDeleteTransaction: (id: string, transaction?: Transaction) => void
  allRecurringPayments: any[]
  allWishlist: any[]
  getRewardsBalance: () => number
  handleToggleActive: (id: string) => void
  handleUpdateReminder: (id: string, settings: RecurringReminderSettings) => void
  optimisticDashboardData: any
  handleDiscardSubscription: (noti: any) => void
  handleConfirmSubscription: (noti: any, paidDate: string) => void
  handlePurchaseWishlistItem: (id: number) => void
  handleUnpurchaseWishlistItem: (id: number) => void
  requestDeletePayment: (id: string) => void
  requestDeleteWishlistItem: (id: number) => void
  allCategories: TransactionCategory[]
  allLedgerAccounts: LedgerAccount[]
  handleStageDraftTransactions: (drafts: Omit<Transaction, 'id'>[]) => void
}

export function useAiActionRouter(options: UseAiActionRouterOptions) {
  const [state, dispatch] = useReducer(aiActionRouterReducer, initialState)
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const handleAiActions = useCallback(async (actions: AiUiAction[]) => {
    const { dispatchAiActionsForApp } = await import('../lib/aiActions')
    return dispatchAiActionsForApp(
      actions,
      optionsRef.current,
      dispatch,
      nextAiActionNonce,
    )
  }, [])

  return {
    state,
    dispatch,
    handleAiActions,
  }
}
