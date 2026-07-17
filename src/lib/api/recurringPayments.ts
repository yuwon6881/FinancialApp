import type { RecurringPayment } from '../../types'
import type { WireRecurringPayment } from '../apiTypes'
import { deobfuscateRecurringPayment, obfuscateAmount } from './amounts'
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
