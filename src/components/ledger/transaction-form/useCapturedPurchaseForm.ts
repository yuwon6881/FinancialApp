import { useEffect, useRef } from 'react'
import { usePurchaseCaptureActions } from '../../../contexts/PurchaseCaptureContext'
import type { TransactionFormState } from './transactionFormReducer'
import type { useTransactionSuggestions } from './useTransactionSuggestions'

export function capturedPurchaseEdits(state: TransactionFormState): Record<string, unknown> {
  return { description: state.description, amount: state.amount, date: state.date,
    category: state.category, ledgerCategory: state.ledgerCategory, accountId: state.accountId }
}

/** Suggestions run once for a captured description and never apply themselves. */
export function useCapturedPurchaseForm(state: TransactionFormState, suggestions: ReturnType<typeof useTransactionSuggestions>, hidden: boolean) {
  const capture = usePurchaseCaptureActions()
  const suggested = useRef<string | null>(null)
  useEffect(() => {
    if (!state.captureId || !state.showAddForm || hidden || state.description.trim().length < 2) return
    const key = `${state.captureId}:${state.description.trim()}`
    if (suggested.current === key) return
    suggested.current = key
    void suggestions.requestCategorySuggestions(state.description.trim(), null)
    void suggestions.requestNoteSuggestions(state.description.trim())
  }, [state.captureId, state.showAddForm, state.description, suggestions, hidden])

  useEffect(() => {
    if (!state.captureId || !state.showAddForm || hidden || !capture) return
    const id = state.captureId
    const timer = window.setTimeout(() => {
      void capture.edit(id, capturedPurchaseEdits(state)).catch(() => { /* Close explicitly reports a failed persistence. */ })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [capture, state, hidden])
}
