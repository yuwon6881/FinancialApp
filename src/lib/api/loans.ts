import type { Loan, LoanRepaymentActionResult, LoanRepaymentPreviewResult } from '../../types'
import type { WireLoan, WireLoanRepaymentActionResult, WireLoanRepaymentPreviewResult, WireLoanScheduleEntry } from '../apiTypes'
import { deobfuscateLoan, deobfuscateLoanRepaymentAction, deobfuscateLoanRepaymentPreview, deobfuscateLoanSchedule, obfuscateAmount } from './amounts'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

export function fetchLoans(signal?: AbortSignal): Promise<Loan[]> {
  return cachedGet('loans', async () => {
    const data = await request<WireLoan[] | null>('/loans', {
      errorMessage: 'Failed to fetch loans',
    })
    return (data || []).map(deobfuscateLoan)
  }, { signal, staleTime: 120_000 })
}

function toMutationBody(loan: Partial<Loan>) {
  return {
    id: loan.id,
    name: loan.name,
    recurringPaymentId: loan.recurringPaymentId,
    openingPrincipal: obfuscateAmount(loan.openingPrincipal ?? 0),
    trackingStartDate: loan.trackingStartDate,
    annualRatePercent: Number.isFinite(loan.annualRatePercent) ? loan.annualRatePercent : 0,
    termPeriods: loan.termPeriods,
    interestMethod: loan.interestMethod,
    rateBasis: loan.rateBasis,
  }
}

export async function fetchLoanSchedule(id: string, signal?: AbortSignal) {
  const data = await request<WireLoanScheduleEntry[]>(`/loans/${encodeURIComponent(id)}/schedule`, {
    errorMessage: 'Failed to fetch the full loan schedule',
    signal,
  })
  return (data || []).map(deobfuscateLoanSchedule)
}

export async function addLoan(loan: Partial<Loan>): Promise<Loan> {
  const data = await request<WireLoan>('/loans', {
    method: 'POST',
    ...jsonBody(toMutationBody(loan)),
    errorMessage: 'Failed to create loan',
  })
  invalidateCache()
  return deobfuscateLoan(data)
}

export async function updateLoan(id: string, loan: Loan): Promise<Loan> {
  const data = await request<WireLoan>(`/loans/${encodeURIComponent(id)}`, {
    method: 'PUT',
    ...jsonBody(toMutationBody(loan)),
    errorMessage: 'Failed to update loan',
  })
  invalidateCache()
  return deobfuscateLoan(data)
}

export async function deleteLoan(id: string): Promise<void> {
  await requestVoid(`/loans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete loan',
  })
  invalidateCache()
}

export async function previewAdvanceRepayment(id: string, cycles: number, signal?: AbortSignal): Promise<LoanRepaymentPreviewResult> {
  const data = await request<WireLoanRepaymentPreviewResult>(`/loans/${encodeURIComponent(id)}/repayments/preview`, {
    method: 'POST',
    ...jsonBody({ cycles }),
    signal,
    errorMessage: 'Failed to preview advance loan repayment',
  })
  return deobfuscateLoanRepaymentPreview(data)
}

export async function advanceCyclesRepayment(
  id: string,
  cycles: number,
  accountId?: string,
  clientKey?: string,
  postedAt?: string,
): Promise<LoanRepaymentActionResult> {
  const data = await request<WireLoanRepaymentActionResult>(`/loans/${encodeURIComponent(id)}/repayments/advance-cycles`, {
    method: 'POST',
    ...jsonBody({
      cycles,
      accountId,
      clientKey,
      postedAt,
    }),
    errorMessage: 'Failed to record advance repayment',
  })
  invalidateCache()
  return deobfuscateLoanRepaymentAction(data)
}

export async function fullSettlementRepayment(
  id: string,
  lenderQuoteAmount: number,
  accountId?: string,
  clientKey?: string,
  postedAt?: string,
): Promise<LoanRepaymentActionResult> {
  const data = await request<WireLoanRepaymentActionResult>(`/loans/${encodeURIComponent(id)}/repayments/full-settlement`, {
    method: 'POST',
    ...jsonBody({
      lenderQuoteAmount: obfuscateAmount(lenderQuoteAmount),
      accountId,
      clientKey,
      postedAt,
    }),
    errorMessage: 'Failed to record full loan settlement',
  })
  invalidateCache()
  return deobfuscateLoanRepaymentAction(data)
}

export async function undoRepaymentAction(actionId: string): Promise<LoanRepaymentActionResult> {
  const data = await request<WireLoanRepaymentActionResult>(`/loans/repayments/${encodeURIComponent(actionId)}/undo`, {
    method: 'POST',
    errorMessage: 'Failed to undo repayment',
  })
  invalidateCache()
  return deobfuscateLoanRepaymentAction(data)
}
