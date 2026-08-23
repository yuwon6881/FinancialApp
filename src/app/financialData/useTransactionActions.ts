import { useCallback } from 'react'
import type { AppTab, SavingsGoal, Transaction, TransactionCategory, TransactionDocumentChanges } from '../../types'
import * as api from '../../lib/api'
import { createFinalId, enqueue } from '../../lib/outbox'
import { triggerHaptic } from '../../lib/haptics'
import { getErrorMessage } from '../../lib/errors'
import { buildUndoSuccessToast } from '../../lib/mutationToast'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'

interface TransactionActionDependencies {
  username: string
  selectedMonth: string
  selectedYear: number
  editingPendingId: string | null
  draftTransactions: Transaction[]
  allTransactions: Transaction[]
  allCategories: TransactionCategory[]
  allSavingsGoals: SavingsGoal[]
  guardSensitive: () => boolean
  createLocalId: (prefix: string, separator?: string) => string
  stageTransactionDocumentChanges: (targetId: string, changes: TransactionDocumentChanges) => void
  loadAll: (
    month?: string,
    year?: number,
    isBackground?: boolean,
    force?: boolean,
    shouldApply?: () => boolean,
  ) => Promise<void>
  beginDirectSync: (ids: Array<string | number>) => void
  endDirectSync: (ids: Array<string | number>) => void
  removePendingLedgerTransaction: (id: string) => void
  mutateQueue: UseOutboxResult['mutateQueue']
  snapshotForUndo: UseOutboxResult['snapshotForUndo']
  pendingTransactionDocumentsRef: React.MutableRefObject<Map<string, TransactionDocumentChanges>>
  pendingTransactionDocumentDeletesRef: React.MutableRefObject<Map<string, number[]>>
  setDraftTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  setDeletingTxId: (id: string | null) => void
  setEditingPendingId: (id: string | null) => void
  setConfirmModalData: AppDialogs['setConfirmModalData']
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
}

/**
 * Ledger writes and the draft staging area in front of them. A new transaction becomes a local
 * draft first and only reaches the outbox through `handleSyncDraftBatch`, so its attachments are
 * kept beside the draft until the row it belongs to has a final id.
 */
export function useTransactionActions(deps: TransactionActionDependencies) {
  const {
    username,
    selectedMonth,
    selectedYear,
    editingPendingId,
    draftTransactions,
    allTransactions,
    allCategories,
    allSavingsGoals,
    guardSensitive,
    createLocalId,
    stageTransactionDocumentChanges,
    loadAll,
    beginDirectSync,
    endDirectSync,
    removePendingLedgerTransaction,
    mutateQueue,
    snapshotForUndo,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    setDraftTransactions,
    setDeletingTxId,
    setEditingPendingId,
    setConfirmModalData,
    showToast,
  } = deps

  const handleAddTransaction = async (
    newTx: Omit<Transaction, 'id'>,
    setActiveTab: (tab: AppTab) => void,
    documentChanges?: TransactionDocumentChanges,
  ) => {
    const drafts = handleStageDraftTransactions([newTx])
    if (drafts.length === 0) return undefined
    if (documentChanges && (documentChanges.pending.length > 0 || documentChanges.unlinkIds.length > 0)) {
      try {
        const { saveDraftTransactionDocumentChanges } = await import('../../lib/draftTransactionDocuments')
        await saveDraftTransactionDocumentChanges(username, drafts[0].id, documentChanges)
      } catch (error) {
        setDraftTransactions(previous => previous.filter(draft => draft.id !== drafts[0].id))
        throw error
      }
    }
    setActiveTab('drafts')
    return drafts[0].id
  }

  const handleStageDraftTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    if (!guardSensitive()) return []
    if (newTransactions.length === 0) return []
    const drafts = newTransactions.map(transaction => ({
      ...transaction,
      id: createLocalId('draft'),
      isPendingSync: true,
    }))
    setDraftTransactions(prev => [...prev, ...drafts])
    void triggerHaptic(15)
    return drafts
  }

  const handleUpdateDraftTransaction = async (
    id: string,
    updated: Omit<Transaction, 'id'>,
    documentChanges: TransactionDocumentChanges = { pending: [], unlinkIds: [] },
  ) => {
    if (!guardSensitive()) return
    const { saveDraftTransactionDocumentChanges } = await import('../../lib/draftTransactionDocuments')
    await saveDraftTransactionDocumentChanges(username, id, documentChanges)
    setDraftTransactions(prev => prev.map(t => t.id === id ? { ...updated, id, isPendingSync: true } : t))
    void triggerHaptic(15)
  }

  const loadDraftTransactionDocumentChanges = useCallback(async (id: string) => {
    const { loadDraftTransactionDocumentChanges } = await import('../../lib/draftTransactionDocuments')
    return loadDraftTransactionDocumentChanges(username, id)
  }, [username])

  const handleDeleteDraftTransaction = (id: string) => {
    if (!guardSensitive()) return
    pendingTransactionDocumentsRef.current.delete(id)
    void import('../../lib/draftTransactionDocuments').then(({ deleteDraftTransactionDocumentChanges }) =>
      deleteDraftTransactionDocumentChanges(username, id)).catch(() => {
        showToast('The draft was removed, but its obsolete local file copy could not be cleared.', 'Draft cleanup incomplete', 'warning')
      })
    setDraftTransactions(prev => prev.filter(t => t.id !== id))
    void triggerHaptic(30)
  }

  const requestDeleteDraftTransaction = (id: string) => {
    if (!guardSensitive()) return
    const draft = draftTransactions.find(t => t.id === id)
    setConfirmModalData({
      title: 'Delete Draft',
      message: `Delete draft "${draft?.description || 'transaction'}"? This removes it from the draft queue before it is synced.`,
      confirmText: 'Delete',
      onConfirm: () => handleDeleteDraftTransaction(id)
    })
  }

  const handleSyncDraftBatch = async () => {
    if (!guardSensitive()) return
    if (draftTransactions.length === 0) return
    const drafts = draftTransactions
    const { getDraftTransactionIssues } = await import('../../lib/draftTransactionValidation')
    const invalidDraft = drafts.find(draft => getDraftTransactionIssues(draft, allCategories).length > 0)
    if (invalidDraft) {
      showToast(
        `Review “${invalidDraft.description || 'transaction'}” before adding this batch to the Ledger.`,
        'Draft needs review',
        'warning',
      )
      return
    }
    let documentChangesByDraft: Map<string, TransactionDocumentChanges>
    try {
      const { loadDraftTransactionDocumentChanges } = await import('../../lib/draftTransactionDocuments')
      documentChangesByDraft = new Map(await Promise.all(drafts.map(async draft => [
        draft.id,
        await loadDraftTransactionDocumentChanges(username, draft.id),
      ] as const)))
    } catch (error) {
      showToast(getErrorMessage(error, 'Draft attachments could not be restored. Try again before adding these transactions.'), 'Draft files unavailable', 'error')
      return
    }
    void triggerHaptic([25, 45, 25])
    mutateQueue(prev => {
      let nextQueue = prev
      drafts.forEach(d => {
        const finalId = createFinalId('transaction')
        const documentChanges = documentChangesByDraft.get(d.id)
        if (documentChanges && (documentChanges.pending.length > 0 || documentChanges.unlinkIds.length > 0)) {
          pendingTransactionDocumentsRef.current.set(finalId, documentChanges)
        }
        const payload = { ...d, id: finalId }
        delete payload.isPendingSync
        nextQueue = enqueue(nextQueue, 'transaction', 'add', finalId, payload)
      })
      return nextQueue
    })
    setDraftTransactions([])
    try {
      const { deleteDraftTransactionDocumentChanges } = await import('../../lib/draftTransactionDocuments')
      await Promise.all(drafts.map(draft => deleteDraftTransactionDocumentChanges(username, draft.id)))
    } catch {
      showToast('The transactions were queued, but obsolete local draft files could not be cleared.', 'Draft cleanup incomplete', 'warning')
    }
  }

  const handleDeleteTransaction = (
    id: string,
    transactionHint?: Transaction,
    attachedDocumentIdsToDelete?: number[],
  ) => {
    if (!guardSensitive()) return
    void triggerHaptic(30)
    let deleteId = id
    if (id.includes('-split-')) {
      deleteId = id.split('-split-')[0]
    }
    setDeletingTxId(deleteId)
    const transaction = transactionHint?.id === deleteId
      ? transactionHint
      : allTransactions.find(t => String(t.id) === deleteId)
    if (transaction?.savingsGoalId != null) {
      // Completion deletion rolls back both the ledger row and goal, so it cannot use the transaction-only outbox.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setDeletingTxId(null)
        showToast('Undo requires a live connection to restore the linked ledger entry and goal.', 'Available online only', 'warning')
        return
      }
      const syncIds = [deleteId, String(transaction.savingsGoalId)]
      beginDirectSync(syncIds)
      void (async () => {
        try {
          await api.deleteTransaction(deleteId)
          await loadAll(selectedMonth || undefined, selectedYear || undefined, true, false, () => true)
          removePendingLedgerTransaction(deleteId)
          const goalName = allSavingsGoals.find(goal => goal.id === transaction.savingsGoalId)?.name
          const fallbackName = transaction.description.replace(/^Completed commitment:\s*/i, '')
          const undoCopy = buildUndoSuccessToast(goalName || fallbackName, 'savings goal')
          showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
        } catch (error: unknown) {
          showToast(getErrorMessage(error), 'Could not undo completion', 'error')
        } finally {
          setDeletingTxId(null)
          endDirectSync(syncIds)
        }
      })()
      return
    }
    snapshotForUndo('transaction', deleteId, transaction)
    // Any queued attachment work for this row is void now, and would otherwise upload a file to a
    // transaction that is on its way out.
    pendingTransactionDocumentsRef.current.delete(deleteId)
    const documentIdsToDelete = attachedDocumentIdsToDelete?.length ? [...attachedDocumentIdsToDelete] : undefined
    if (documentIdsToDelete) {
      pendingTransactionDocumentDeletesRef.current.set(deleteId, documentIdsToDelete)
    }
    mutateQueue(prev => enqueue(prev, 'transaction', 'delete', deleteId, {
      description: transaction?.description,
      undoSnapshot: transaction,
      // Read only by the success toast, so it can say plainly that the files are gone for good
      // while the Undo beside it restores the transaction.
      deletedDocumentCount: documentIdsToDelete?.length,
    }))
    if (deleteId === editingPendingId) setEditingPendingId(null)
  }

  const handleUpdateTransaction = (
    id: string,
    updatedTx: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => {
    if (!guardSensitive()) return
    void triggerHaptic(15)
    const previousTransaction = allTransactions.find(t => String(t.id) === String(id))
    snapshotForUndo('transaction', String(id), previousTransaction)
    if (documentChanges) stageTransactionDocumentChanges(id, documentChanges)
    mutateQueue(prev => enqueue(prev, 'transaction', 'update', id, {
      ...updatedTx,
      undoSnapshot: previousTransaction,
    }))
    if (id === editingPendingId) setEditingPendingId(null)
  }

  return {
    handleAddTransaction,
    handleStageDraftTransactions,
    handleUpdateDraftTransaction,
    loadDraftTransactionDocumentChanges,
    handleDeleteDraftTransaction,
    requestDeleteDraftTransaction,
    handleSyncDraftBatch,
    handleDeleteTransaction,
    handleUpdateTransaction,
  }
}
