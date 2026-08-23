import { useState, useCallback } from 'react'
import type { Transaction } from '../../types'

export function useDirectSyncState() {
  const [directSyncIds, setDirectSyncIds] = useState<string[]>([])
  const [pendingLedgerTransactions, setPendingLedgerTransactions] = useState<Transaction[]>([])

  const beginDirectSync = useCallback((ids: Array<string | number>) => {
    const normalized = ids.map(String).filter(Boolean)
    if (normalized.length === 0) return
    setDirectSyncIds(previous => Array.from(new Set([...previous, ...normalized])))
  }, [])

  const endDirectSync = useCallback((ids: Array<string | number>) => {
    const toRemove = new Set(ids.map(String))
    setDirectSyncIds(previous => previous.filter(id => !toRemove.has(id)))
  }, [])

  const addPendingLedgerTransaction = useCallback((transaction: Transaction) => {
    setPendingLedgerTransactions(previous => [
      ...previous.filter(item => String(item.id) !== String(transaction.id)),
      transaction,
    ])
  }, [])

  const replacePendingLedgerTransaction = useCallback((pendingId: string, transaction: Transaction) => {
    setPendingLedgerTransactions(previous => previous.map(item =>
      String(item.id) === String(pendingId) ? { ...transaction, isPendingSync: false } : item,
    ))
  }, [])

  const removePendingLedgerTransaction = useCallback((id: string) => {
    setPendingLedgerTransactions(previous => previous.filter(item => String(item.id) !== String(id)))
  }, [])

  return {
    directSyncIds,
    setDirectSyncIds,
    pendingLedgerTransactions,
    setPendingLedgerTransactions,
    beginDirectSync,
    endDirectSync,
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    removePendingLedgerTransaction,
  }
}
