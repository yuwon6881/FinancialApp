import type { Loan } from '../../types'
import type { WireLoan, WireLoanScheduleEntry } from '../apiTypes'
import { deobfuscateLoan, deobfuscateLoanSchedule, obfuscateAmount } from './amounts'
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
