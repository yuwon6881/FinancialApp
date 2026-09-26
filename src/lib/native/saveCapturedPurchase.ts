import type { Transaction } from '../../types'
import type { PurchaseCapture } from './purchaseCapture'

/** Persist approval before queueing; retries reuse the same UUID and the original approved payload. */
export async function saveCapturedPurchase(
  candidate: PurchaseCapture,
  transaction: Omit<Transaction, 'id'>,
  deps: {
    prepare: (transaction: Omit<Transaction, 'id'>) => Promise<PurchaseCapture>
    enqueue: (id: string, transaction: Omit<Transaction, 'id'>) => void
    complete: () => Promise<unknown>
  },
): Promise<void> {
  const approved = await deps.prepare(transaction)
  if (approved.completed) return
  if (!approved.prepared) throw new Error('Purchase approval could not be stored. Try again.')
  deps.enqueue(candidate.transactionId, approved.prepared)
  await deps.complete()
}
