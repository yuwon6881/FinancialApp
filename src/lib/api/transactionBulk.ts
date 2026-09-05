import type { Transaction } from '../../types'
import type { WireTransaction } from '../apiTypes'
import type { QueuedOp } from '../outbox'
import { deobfuscateTransaction, obfuscateAmount } from './amounts'
import { invalidateCache, jsonBody, request } from './client'

export interface BulkTransactionMutationResult {
  deleted: Transaction[]
  restored: Transaction[]
  moved?: Transaction[]
  created?: Transaction[]
}

export async function bulkDeleteTransactions(ids: string[]): Promise<BulkTransactionMutationResult> {
  const data = await request<{ deleted: WireTransaction[] }>('/transactions/bulk-delete', {
    method: 'POST',
    ...jsonBody({ ids }),
    errorMessage: 'Failed to delete selected transactions',
  })
  invalidateCache()
  return { deleted: (data.deleted || []).map(deobfuscateTransaction), restored: [], moved: [] }
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
  return { deleted: [], restored: (data.restored || []).map(deobfuscateTransaction), moved: [] }
}

export async function bulkMoveTransactions(moves: { id: string; targetDate: string }[]): Promise<BulkTransactionMutationResult> {
  const data = await request<{ moved: WireTransaction[] }>('/transactions/bulk-move', {
    method: 'POST',
    ...jsonBody({ moves }),
    errorMessage: 'Failed to move selected transactions',
  })
  invalidateCache()
  return { deleted: [], restored: [], moved: (data.moved || []).map(deobfuscateTransaction) }
}

export async function bulkCreateTransactions(
  transactions: Array<Partial<Transaction>>,
): Promise<BulkTransactionMutationResult> {
  const data = await request<{ created: WireTransaction[] }>('/transactions/bulk-create', {
    method: 'POST',
    ...jsonBody({
      transactions: transactions.map(t => ({
        ...t,
        amount: obfuscateAmount(t.amount ?? 0),
        stabilityRecoveryTopUpAmount: t.stabilityRecoveryTopUpAmount == null
          ? t.stabilityRecoveryTopUpAmount
          : obfuscateAmount(t.stabilityRecoveryTopUpAmount),
      })),
    }),
    errorMessage: 'Failed to create transactions',
  })
  invalidateCache()
  return { deleted: [], restored: [], created: (data.created || []).map(deobfuscateTransaction) }
}

export async function dispatchBulkTransaction(op: Pick<QueuedOp, 'type' | 'payload'>): Promise<BulkTransactionMutationResult> {
  if (op.type === 'bulkDelete') {
    const ids = Array.isArray(op.payload?.transactionIds) ? op.payload.transactionIds.map(String) : []
    return bulkDeleteTransactions(ids)
  }
  if (op.type === 'bulkMove') {
    const moves = Array.isArray(op.payload?.moves)
      ? op.payload.moves.filter((move): move is { id: string; targetDate: string } => Boolean(
          move && typeof move === 'object' && 'id' in move && 'targetDate' in move,
        )).map(move => ({ id: String(move.id), targetDate: String(move.targetDate) }))
      : []
    return bulkMoveTransactions(moves)
  }
  if (op.type === 'bulkAdd') {
    const txs = Array.isArray(op.payload?.transactions)
      ? op.payload.transactions
        .filter((item): item is Partial<Transaction> => Boolean(item && typeof item === 'object'))
      : []
    return bulkCreateTransactions(txs)
  }
  const snapshots = Array.isArray(op.payload?.transactions)
    ? op.payload.transactions
      .filter((item): item is Transaction => Boolean(item && typeof item === 'object' && 'id' in item))
      .map(item => ({ ...item, id: String(item.id) } as Transaction))
    : []
  return bulkRestoreTransactions(snapshots)
}
