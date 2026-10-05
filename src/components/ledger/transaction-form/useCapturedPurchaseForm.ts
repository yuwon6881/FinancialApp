import { useEffect, useRef } from 'react'
import { usePurchaseCaptureActions } from '../../../contexts/PurchaseCaptureContext'
import type { TransactionFormState } from './transactionFormReducer'
import type { useTransactionSuggestions } from './useTransactionSuggestions'

export function capturedPurchaseEdits(state: TransactionFormState): Record<string, unknown> {
  return { description: state.description, amount: state.amount, date: state.date,
    category: state.category, ledgerCategory: state.ledgerCategory, transactionType: state.transactionType,
    transferSource: state.transferSource, transferTarget: state.transferTarget, accountId: state.accountId,
    counterAccountId: state.counterAccountId }
}

/**
 * Suggestions run once per capture, for the description it arrived with, and never apply
 * themselves. Keying on the edited description would spend two AI calls per keystroke and
 * trip the per-user AI rate limit; later edits use the form's own blur and AI button paths.
 */
export function useCapturedPurchaseForm(state: TransactionFormState, suggestions: ReturnType<typeof useTransactionSuggestions>, hidden: boolean) {
  const capture = usePurchaseCaptureActions()
  const suggested = useRef<string | null>(null)
  useEffect(() => {
    if (!state.captureId || !state.showAddForm || hidden || state.description.trim().length < 2) return
    if (suggested.current === state.captureId) return
    suggested.current = state.captureId
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
