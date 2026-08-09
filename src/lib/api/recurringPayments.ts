import type { PayEarlyResult, RecurringPayment, RecurringReminderSettings, RecurringSettlementResult } from '../../types'
import type { WirePayEarlyResult, WireRecurringPayment, WireRecurringSettlementResult } from '../apiTypes'
import { deobfuscateAmount, deobfuscateRecurringPayment, deobfuscateTransaction, obfuscateAmount } from './amounts'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

export function fetchRecurringPayments(signal?: AbortSignal): Promise<RecurringPayment[]> {
  return cachedGet('recurringPayments', async () => {
    const data = await request<WireRecurringPayment[] | null>('/recurring-payments', {
      errorMessage: 'Failed to fetch recurring payments',
    })
    return (data || []).map(deobfuscateRecurringPayment)
  }, { signal, staleTime: 300_000 })
}

export async function addRecurringPayment(payment: Omit<RecurringPayment, 'id'> & { id?: string }): Promise<RecurringPayment> {
  const data = await request<WireRecurringPayment>('/recurring-payments', {
    method: 'POST',
    ...jsonBody({ ...payment, amount: obfuscateAmount(payment.amount) }),
    errorMessage: 'Failed to add recurring payment',
  })
  invalidateCache()
  return deobfuscateRecurringPayment(data)
}

export async function toggleRecurringPayment(id: string, active?: boolean): Promise<RecurringPayment> {
  const data = await request<WireRecurringPayment>(`/recurring-payments/${id}/toggle`, {
    method: 'PUT',
    // Send the absolute desired state so a coalesced/retried toggle from the offline outbox
    // is idempotent (the server sets the value rather than flipping it). Omitted only for
    // any legacy caller with no known target state (server falls back to a relative flip).
    ...(typeof active === 'boolean' ? jsonBody({ active }) : {}),
    errorMessage: 'Failed to toggle recurring payment',
  })
  invalidateCache()
  return deobfuscateRecurringPayment(data)
}

export async function updateRecurringPayment(id: string, payment: RecurringPayment): Promise<RecurringPayment> {
  const data = await request<WireRecurringPayment>(`/recurring-payments/${id}`, {
    method: 'PUT',
    ...jsonBody({ ...payment, amount: obfuscateAmount(payment.amount) }),
    errorMessage: 'Failed to update recurring payment',
  })
  invalidateCache()
  return deobfuscateRecurringPayment(data)
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  await requestVoid(`/recurring-payments/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete recurring payment',
  })
  invalidateCache()
}

export async function updateRecurringPaymentReminder(id: string, settings: RecurringReminderSettings): Promise<void> {
  await requestVoid(`/recurring-payments/${id}/reminder`, {
    method: 'PUT',
    ...jsonBody(settings),
    errorMessage: 'Failed to update the payment reminder',
  })
  invalidateCache()
}

export async function payRecurringPaymentEarly(id: string, occurrenceDate: string, clientKey?: string): Promise<PayEarlyResult> {
  const data = await request<WirePayEarlyResult>(`/recurring-payments/${id}/pay-early`, {
    method: 'POST',
    ...jsonBody({ occurrenceDate, ...(clientKey ? { clientKey } : {}) }),
    errorMessage: 'Failed to pay this subscription early',
  })
  invalidateCache()
  return {
    transaction: deobfuscateTransaction(data.transaction),
    settledOccurrenceDate: data.settledOccurrenceDate,
    nextOccurrenceDate: data.nextOccurrenceDate,
  }
}

export async function settleRecurringOccurrence(
  id: string,
  occurrenceDate: string,
  status: 'Paid' | 'Discarded',
  paidDate?: string,
  clientKey?: string,
  transactionId?: string,
  postedAt?: string,
): Promise<RecurringSettlementResult> {
  const data = await request<WireRecurringSettlementResult>(
    `/recurring-payments/${id}/occurrences/${occurrenceDate}/settle`,
    {
      method: 'POST',
      ...jsonBody({ status, paidDate, clientKey, transactionId, postedAt }),
      errorMessage: status === 'Paid' ? 'Failed to confirm this bill' : 'Failed to discard this bill',
    },
  )
  invalidateCache()
  return {
    occurrence: {
      ...data.occurrence,
      amount: data.occurrence.amount == null ? null : deobfuscateAmount(data.occurrence.amount),
    },
    transaction: data.transaction ? deobfuscateTransaction(data.transaction) : null,
    nextOccurrenceDate: data.nextOccurrenceDate,
  }
}
