import type { Transaction } from '../../types'
import type { WireTransaction } from '../apiTypes'
import type { QueuedOp } from '../outbox'
import { deobfuscateTransaction, obfuscateAmount } from './amounts'
import { invalidateCache, jsonBody, request } from './client'

export interface BulkTransactionMutationResult {
  deleted: Transaction[]
  restored: Transaction[]
}

export async function bulkDeleteTransactions(ids: string[]): Promise<BulkTransactionMutationResult> {
  const data = await request<{ deleted: WireTransaction[] }>('/transactions/bulk-delete', {
    method: 'POST',
    ...jsonBody({ ids }),
    errorMessage: 'Failed to delete selected transactions',
  })
  invalidateCache()
  return { deleted: (data.deleted || []).map(deobfuscateTransaction), restored: [] }
}

export async function bulkRestoreTransactions(transactions: Transaction[]): Promise<BulkTransactionMutationResult> {
  const data = await request<{ restored: WireTransaction[] }>('/transactions/bulk-restore', {
    method: 'POST',
    ...jsonBody({ transactions: transactions.map(transaction => ({
      ...transaction,
      amount: obfuscateAmount(transaction.amount),
      stabilityRecoveryTopUpAmount: transaction.stabilityRecoveryTopUpAmount == null
        ? transaction.stabilityRecoveryTopUpAmount
        : obfuscateAmount(transaction.stabilityRecoveryTopUpAmount),
    })) }),
    errorMessage: 'Failed to restore selected transactions',
  })
  invalidateCache()
  return { deleted: [], restored: (data.restored || []).map(deobfuscateTransaction) }
}

export async function dispatchBulkTransaction(op: Pick<QueuedOp, 'type' | 'payload'>): Promise<BulkTransactionMutationResult> {
  if (op.type === 'bulkDelete') {
    const ids = Array.isArray(op.payload?.transactionIds) ? op.payload.transactionIds.map(String) : []
    return bulkDeleteTransactions(ids)
  }
  const snapshots = Array.isArray(op.payload?.transactions)
    ? op.payload.transactions
      .filter((item): item is Transaction => Boolean(item && typeof item === 'object' && 'id' in item))
      .map(item => ({ ...item, id: String(item.id) } as Transaction))
    : []
  return bulkRestoreTransactions(snapshots)
}
