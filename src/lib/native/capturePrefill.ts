import type { LedgerAddPrefill } from '../../app/useCycleNavigation'
import { financialDate } from '../financialDate'
import type { PurchaseCapture } from './purchaseCapture'

/**
 * The Ledger form a detected alert opens. Known facts are carried over; anything the alert did not
 * state stays empty for the reviewer. The alert's own arrival date is a fact about the payment, so
 * it fills the date when the text carried none — labelled, never silently.
 */
export function capturePrefill(candidate: PurchaseCapture, currency: string): LedgerAddPrefill {
  const matchingCurrency = candidate.currency === currency
  const alertDate = Number.isFinite(candidate.capturedAt) && candidate.capturedAt > 0
    ? financialDate(new Date(candidate.capturedAt))
    : undefined
  const date = candidate.date ?? alertDate
  const notices: string[] = []
  if (candidate.currency && !matchingCurrency) {
    notices.push(`The alert showed ${candidate.currency} ${candidate.amount ?? ''}`.trimEnd() + `. Enter the amount in ${currency}; no conversion has been applied.`)
  } else if (!candidate.currency) {
    notices.push(`The alert did not show a currency. Enter the amount in ${currency}.`)
  }
  if (!candidate.date && alertDate) notices.push('Date is taken from when the alert arrived. Change it if the payment happened on another day.')
  return {
    description: candidate.description,
    amount: matchingCurrency ? candidate.amount : undefined,
    date,
    transactionType: 'outflow',
    ...candidate.edits,
    captureId: candidate.id,
    captureSource: candidate.sourceLabel,
    captureNotices: notices,
    captureExcerpt: candidate.excerpt,
  }
}

/** Newest alert first, so the list reads like the phone's own notification shade. */
export function sortCaptures(candidates: PurchaseCapture[]): PurchaseCapture[] {
  return [...candidates].sort((a, b) => b.capturedAt - a.capturedAt)
}
