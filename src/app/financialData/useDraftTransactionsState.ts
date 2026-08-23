import { useState, useEffect, useRef, useCallback } from 'react'
import type { Transaction, TransactionDocumentChanges } from '../../types'
import { sanitizeTransactions } from '../../lib/cache'

export function useDraftTransactionsState() {
  const [draftTransactions, setDraftTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem('draft_transactions')
      return sanitizeTransactions(stored ? JSON.parse(stored) : [])
    } catch {
      return []
    }
  })
  const pendingTransactionDocumentsRef = useRef(new Map<string, TransactionDocumentChanges>())
  /** Vault documents to delete once their transaction's queued delete has actually synced. */
  const pendingTransactionDocumentDeletesRef = useRef(new Map<string, number[]>())

  /**
   * Merged, never replaced. `enqueue` collapses a second edit of the same transaction into the
   * queued add/update, so a plain `set` here dropped the first edit's uploads and detaches on the
   * floor — silently, and invisibly, since the form reads its existing documents from the server
   * and never showed the queued file at all.
   */
  const stageTransactionDocumentChanges = useCallback((targetId: string, changes: TransactionDocumentChanges) => {
    if (changes.pending.length === 0 && changes.unlinkIds.length === 0) return
    const existing = pendingTransactionDocumentsRef.current.get(targetId)
    pendingTransactionDocumentsRef.current.set(targetId, existing
      ? {
          pending: [...existing.pending, ...changes.pending],
          unlinkIds: [...new Set([...existing.unlinkIds, ...changes.unlinkIds])],
        }
      : changes)
  }, [])

  // Persist draft transactions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('draft_transactions', JSON.stringify(draftTransactions))
    } catch (storageError) {
      console.warn('Could not persist draft transactions locally.', storageError)
    }
  }, [draftTransactions])

  return {
    draftTransactions,
    setDraftTransactions,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    stageTransactionDocumentChanges,
  }
}
