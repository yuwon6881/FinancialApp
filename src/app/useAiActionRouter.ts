import { useReducer, useRef, useCallback } from 'react'
import * as api from '../lib/api'
import { dispatchAiActions, requestAiLedgerDelete } from '../lib/aiActions'
import type { Transaction, TransactionCategory } from '../types'

interface AiActionRouterState {
  aiLedgerEditDraft: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiRecurringDraft: { nonce: number; fields: Record<string, unknown> } | null
  aiRecurringEditDraft: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiWishlistDraft: { nonce: number; fields: Record<string, unknown> } | null
  aiWishlistEditDraft: { nonce: number; id: number; changes: Record<string, unknown> } | null
  aiLedgerExportRequest: { nonce: number } | null
}

type AiActionRouterAction =
  | { type: 'SET_LEDGER_EDIT_DRAFT'; id: string; changes: Record<string, unknown>; nonce: number }
  | { type: 'SET_RECURRING_DRAFT'; payload: Record<string, unknown>; nonce: number }
  | { type: 'SET_RECURRING_EDIT_DRAFT'; id: string; changes: Record<string, unknown>; nonce: number }
  | { type: 'SET_WISHLIST_DRAFT'; payload: Record<string, unknown>; nonce: number }
  | { type: 'SET_WISHLIST_EDIT_DRAFT'; id: number; changes: Record<string, unknown>; nonce: number }
  | { type: 'SET_EXPORT_REQUEST'; nonce: number }
  | { type: 'CONSUME_LEDGER_EDIT_DRAFT' }
  | { type: 'CONSUME_RECURRING_DRAFT' }
  | { type: 'CONSUME_RECURRING_EDIT_DRAFT' }
  | { type: 'CONSUME_WISHLIST_DRAFT' }
  | { type: 'CONSUME_WISHLIST_EDIT_DRAFT' }
  | { type: 'CONSUME_EXPORT_REQUEST' }

const initialState: AiActionRouterState = {
  aiLedgerEditDraft: null,
  aiRecurringDraft: null,
  aiRecurringEditDraft: null,
  aiWishlistDraft: null,
  aiWishlistEditDraft: null,
  aiLedgerExportRequest: null,
}

function aiActionRouterReducer(state: AiActionRouterState, action: AiActionRouterAction): AiActionRouterState {
  switch (action.type) {
    case 'SET_LEDGER_EDIT_DRAFT':
      return { ...state, aiLedgerEditDraft: { nonce: action.nonce, id: action.id, changes: action.changes } }
    case 'SET_RECURRING_DRAFT':
      return { ...state, aiRecurringDraft: { nonce: action.nonce, fields: action.payload } }
    case 'SET_RECURRING_EDIT_DRAFT':
      return { ...state, aiRecurringEditDraft: { nonce: action.nonce, id: action.id, changes: action.changes } }
    case 'SET_WISHLIST_DRAFT':
      return { ...state, aiWishlistDraft: { nonce: action.nonce, fields: action.payload } }
    case 'SET_WISHLIST_EDIT_DRAFT':
      return { ...state, aiWishlistEditDraft: { nonce: action.nonce, id: action.id, changes: action.changes } }
    case 'SET_EXPORT_REQUEST':
      return { ...state, aiLedgerExportRequest: { nonce: action.nonce } }
    case 'CONSUME_LEDGER_EDIT_DRAFT':
      return { ...state, aiLedgerEditDraft: null }
    case 'CONSUME_RECURRING_DRAFT':
      return { ...state, aiRecurringDraft: null }
    case 'CONSUME_RECURRING_EDIT_DRAFT':
      return { ...state, aiRecurringEditDraft: null }
    case 'CONSUME_WISHLIST_DRAFT':
      return { ...state, aiWishlistDraft: null }
    case 'CONSUME_WISHLIST_EDIT_DRAFT':
      return { ...state, aiWishlistEditDraft: null }
    case 'CONSUME_EXPORT_REQUEST':
      return { ...state, aiLedgerExportRequest: null }
    default:
      return state
  }
}

export interface UseAiActionRouterOptions {
  hideSensitive: boolean
  showToast: (message: string, title?: string, tone?: any, action?: any) => void
  setActiveTab: (tab: any) => void
  handleSelectPeriod: (month: string, year: number) => Promise<void> | void
  handleNavigateToLedger: (options: any) => void
  setConfirmModalData: (data: any) => void
  allTransactions: any[]
  handleDeleteTransaction: (id: string) => void
  allRecurringPayments: any[]
  allWishlist: any[]
  handleToggleActive: (id: string) => void
  optimisticDashboardData: any
  handleDiscardSubscription: (noti: any) => void
  handleConfirmSubscription: (noti: any, paidDate: string) => void
  handlePurchaseWishlistItem: (id: number) => void
  handleUnpurchaseWishlistItem: (id: number) => void
  requestDeletePayment: (id: string) => void
  requestDeleteWishlistItem: (id: number) => void
  allCategories: TransactionCategory[]
  handleStageDraftTransactions: (drafts: Omit<Transaction, 'id'>[]) => void
}

export function useAiActionRouter(options: UseAiActionRouterOptions) {
  const {
    hideSensitive,
    showToast,
    setActiveTab,
    handleSelectPeriod,
    handleNavigateToLedger,
    setConfirmModalData,
    allTransactions,
    handleDeleteTransaction,
    allRecurringPayments,
    allWishlist,
    handleToggleActive,
    optimisticDashboardData,
    handleDiscardSubscription,
    handleConfirmSubscription,
    handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem,
    requestDeletePayment,
    requestDeleteWishlistItem,
    allCategories,
    handleStageDraftTransactions,
  } = options

  const [state, dispatch] = useReducer(aiActionRouterReducer, initialState)
  const aiActionNonceRef = useRef(0)

  const nextAiActionNonce = useCallback(() => {
    aiActionNonceRef.current += 1
    return aiActionNonceRef.current
  }, [])

  const handleAiActions = useCallback((actions: api.AiUiAction[]) => {
    // dispatchAiActions is async (dynamic imports, period switches). Without this
    // catch a rejection becomes an unhandled promise and the user is told the
    // action was applied when nothing happened.
    return dispatchAiActions(actions, {
      hideSensitive,
      showToast,
      setActiveTab,
      handleSelectPeriod,
      handleNavigateToLedger,
      nextNonce: nextAiActionNonce,
      transactionCategories: allCategories,
      stageAiLedgerDrafts: handleStageDraftTransactions,
      setAiRecurringDraft: (v: any) => dispatch({ type: 'SET_RECURRING_DRAFT', payload: v.fields, nonce: v.nonce }),
      setAiWishlistDraft: (v: any) => dispatch({ type: 'SET_WISHLIST_DRAFT', payload: v.fields, nonce: v.nonce }),
      setAiLedgerEditDraft: (v: any) => dispatch({ type: 'SET_LEDGER_EDIT_DRAFT', id: v.id, changes: v.changes, nonce: v.nonce }),
      setAiRecurringEditDraft: (v: any) => dispatch({ type: 'SET_RECURRING_EDIT_DRAFT', id: v.id, changes: v.changes, nonce: v.nonce }),
      setAiWishlistEditDraft: (v: any) => dispatch({ type: 'SET_WISHLIST_EDIT_DRAFT', id: v.id, changes: v.changes, nonce: v.nonce }),
      setAiLedgerExportRequest: (v: any) => dispatch({ type: 'SET_EXPORT_REQUEST', nonce: v.nonce }),
      requestDeleteLedger: (id) => requestAiLedgerDelete(id, { showToast, setConfirmModalData, allTransactions, handleDeleteTransaction }),
      requestDeletePayment,
      requestDeleteWishlistItem,
      allRecurringPayments,
      allWishlist,
      handleToggleActive,
      getPendingNotifications: () => optimisticDashboardData?.pendingNotifications || [],
      setConfirmModalData,
      handleDiscardSubscription,
      handleConfirmSubscription,
      handlePurchaseWishlistItem,
      handleUnpurchaseWishlistItem,
    }).catch(error => {
      console.error('AI action dispatch failed', error)
      showToast('Could not apply the AI action. Please try again.', 'Action failed', 'error')
    })
  }, [
    hideSensitive,
    showToast,
    setActiveTab,
    handleSelectPeriod,
    handleNavigateToLedger,
    nextAiActionNonce,
    allTransactions,
    handleDeleteTransaction,
    requestDeletePayment,
    requestDeleteWishlistItem,
    allRecurringPayments,
    allWishlist,
    handleToggleActive,
    optimisticDashboardData,
    handleDiscardSubscription,
    handleConfirmSubscription,
    handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem,
    setConfirmModalData,
    allCategories,
    handleStageDraftTransactions,
  ])

  return {
    state,
    dispatch,
    handleAiActions,
  }
}
