import { useEffect } from 'react'
import { usePurchaseCaptureActions } from '../../../contexts/PurchaseCaptureContext'
import type { TransactionFormState } from './transactionFormReducer'

export function capturedPurchaseEdits(state: TransactionFormState): Record<string, unknown> {
  return { description: state.description, amount: state.amount, date: state.date,
    category: state.category, ledgerCategory: state.ledgerCategory, transactionType: state.transactionType,
    transferSource: state.transferSource, transferTarget: state.transferTarget, accountId: state.accountId,
    counterAccountId: state.counterAccountId }
}

/**
 * Keeps the native capture in step with the form. Opening a detected purchase makes no AI request
 * of its own: neither the description cleanup nor the category suggestion runs until the user asks,
 * through the AI button or by leaving the description field. Requesting them on open put an AI
 * spinner and popover over a description the user had not touched.
 */
export function useCapturedPurchaseForm(state: TransactionFormState, hidden: boolean) {
  const capture = usePurchaseCaptureActions()
  useEffect(() => {
    if (!state.captureId || !state.showAddForm || hidden || !capture) return
    const id = state.captureId
    const timer = window.setTimeout(() => {
      void capture.edit(id, capturedPurchaseEdits(state)).catch(() => { /* Close explicitly reports a failed persistence. */ })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [capture, state, hidden])
}
