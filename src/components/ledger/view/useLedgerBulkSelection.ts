import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Transaction } from '../../../types'

export const LEDGER_BULK_LIMIT = 100

const parentId = (id: string) => {
  const marker = id.indexOf('-split-')
  return marker < 0 ? id : id.slice(0, marker)
}

export interface UseLedgerBulkSelectionOptions {
  transactions: readonly Transaction[]
  allTransactions?: readonly Transaction[]
  isDeleting: (id: string) => boolean
  isSyncing: (id: string) => boolean
  hideSensitive: boolean
  resetKey: string
}

export function useLedgerBulkSelection({ transactions, allTransactions = transactions, isDeleting, isSyncing, hideSensitive, resetKey }: UseLedgerBulkSelectionOptions) {
  const [selectionRequested, setSelectionRequested] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedRows, setSelectedRows] = useState<Map<string, Transaction>>(new Map())

  const transactionById = useMemo(() => {
    const lookup = new Map<string, Transaction>()
    for (const transaction of allTransactions) lookup.set(String(transaction.id), transaction)
    for (const transaction of transactions) lookup.set(String(transaction.id), transaction)
    return lookup
  }, [allTransactions, transactions])

  const eligible = useCallback((transaction: Transaction) => {
    const id = String(transaction.id)
    const canonicalId = parentId(id)
    const canonical = transactionById.get(canonicalId) ?? transaction
    return !hideSensitive
      && !transaction.isPendingSync
      && !transaction.isPendingDelete
      && canonical.isPendingSync !== true
      && canonical.isPendingDelete !== true
      && canonical.savingsGoalId == null
      && !isDeleting(id)
      && !isSyncing(id)
      && !isDeleting(canonicalId)
      && !isSyncing(canonicalId)
  }, [hideSensitive, isDeleting, isSyncing, transactionById])

  const visibleGroups = useMemo(() => {
    const groups = new Map<string, Transaction>()
    for (const transaction of transactions) {
      if (!eligible(transaction)) continue
      const id = parentId(String(transaction.id))
      const previous = groups.get(id)
      if (!previous || String(previous.id).includes('-split-')) groups.set(id, transaction)
    }
    return groups
  }, [eligible, transactions])

  const isSelecting = selectionRequested || selectedIds.size > 0
  const selectedCount = selectedIds.size
  const visibleIds = useMemo(() => Array.from(visibleGroups.keys()), [visibleGroups])
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected
  const exceedsLimit = selectedCount > LEDGER_BULK_LIMIT

  useEffect(() => {
    setSelectionRequested(false)
    setSelectedIds(new Set())
    setSelectedRows(new Map())
  }, [resetKey])

  useEffect(() => {
    if (!hideSensitive) return
    setSelectionRequested(false)
    setSelectedIds(new Set())
    setSelectedRows(new Map())
  }, [hideSensitive])

  const toggleSelected = useCallback((transaction: Transaction) => {
    if (!eligible(transaction)) return
    const id = parentId(String(transaction.id))
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else if (next.size < LEDGER_BULK_LIMIT) next.add(id)
      return next
    })
    setSelectedRows(previous => {
      const next = new Map(previous)
      if (next.has(id)) next.delete(id)
      else if (next.size < LEDGER_BULK_LIMIT) {
        const existing = visibleGroups.get(id)
        const canonical = transactionById.get(id)
        next.set(id, canonical ?? (existing && !String(existing.id).includes('-split-') ? existing : transaction))
      }
      return next
    })
  }, [eligible, transactionById, visibleGroups])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => {
        if (next.size < LEDGER_BULK_LIMIT) next.add(id)
      })
      return next
    })
    setSelectedRows(previous => {
      const next = new Map(previous)
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => {
        if (next.size >= LEDGER_BULK_LIMIT) return
        const transaction = visibleGroups.get(id)
        if (transaction) next.set(id, transaction)
      })
      return next
    })
  }, [allVisibleSelected, visibleGroups, visibleIds])

  const leaveSelection = useCallback(() => {
    setSelectionRequested(false)
    setSelectedIds(new Set())
    setSelectedRows(new Map())
  }, [])
  const startSelection = useCallback(() => setSelectionRequested(true), [])

  return {
    isSelecting,
    selectionRequested,
    startSelection,
    selectedIds,
    selectedTransactions: Array.from(selectedRows.values()),
    selectedCount,
    visibleIds,
    eligibleVisibleCount: visibleIds.length,
    protectedVisibleCount: transactions.filter(transaction => transaction.savingsGoalId != null).length,
    allVisibleSelected,
    someVisibleSelected,
    exceedsLimit,
    toggleSelected,
    canSelect: eligible,
    isSelected: (transaction: Transaction) => selectedIds.has(parentId(String(transaction.id))),
    toggleSelectAll,
    leaveSelection,
  }
}
