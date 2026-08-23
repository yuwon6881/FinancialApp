import { useState, useEffect, useRef, useCallback } from 'react'
import type { Transaction } from '../../../types'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'

export interface UseLedgerDeleteModalOptions {
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  onDeleteTransaction: (id: string, transaction?: Transaction, attachedDocumentIdsToDelete?: number[]) => Promise<void> | void
  onShowAlert?: (message: string, title?: string) => void
  formRef: React.RefObject<any>
}

export function useLedgerDeleteModal(options: UseLedgerDeleteModalOptions) {
  const {
    hideSensitive,
    sensitivePreferenceStatus,
    onDeleteTransaction,
    onShowAlert,
    formRef,
  } = options

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<number[]>([])
  const [alsoDeleteDocuments, setAlsoDeleteDocuments] = useState(false)
  const [areAttachedDocumentsLoading, setAreAttachedDocumentsLoading] = useState(false)
  const deleteDocumentLookupRef = useRef(0)
  const [showEditDisabledModal, setShowEditDisabledModal] = useState(false)
  const [editBlockedTransaction, setEditBlockedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    if (!hideSensitive) return
    deleteDocumentLookupRef.current += 1
    setShowDeleteModal(false)
    setTxToDelete(null)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
    setAreAttachedDocumentsLoading(false)
    setShowEditDisabledModal(false)
    setEditBlockedTransaction(null)
    if (sensitivePreferenceStatus !== 'pending') formRef.current?.handleCloseForm()
  }, [hideSensitive, sensitivePreferenceStatus, formRef])

  const handleDeleteClick = useCallback((t: Transaction) => {
    if (hideSensitive) return
    const transactionId = t.id.includes('-split-') ? t.id.split('-split-')[0] : t.id
    const lookupId = ++deleteDocumentLookupRef.current
    setTxToDelete(t)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
    setAreAttachedDocumentsLoading(true)
    setShowDeleteModal(true)
    void import('../../../lib/api/documents')
      .then(({ listAllDocumentsForTransaction }) => listAllDocumentsForTransaction(transactionId))
      .then(documents => {
        if (deleteDocumentLookupRef.current === lookupId) {
          setAttachedDocumentIds(documents.map(document => document.id))
        }
      })
      .catch(() => {
        if (deleteDocumentLookupRef.current === lookupId) {
          onShowAlert?.(
            'Attached documents could not be checked. Deleting the transaction will still keep every vault document.',
            'Document Vault',
          )
        }
      })
      .finally(() => {
        if (deleteDocumentLookupRef.current === lookupId) {
          setAreAttachedDocumentsLoading(false)
        }
      })
  }, [hideSensitive, onShowAlert])

  const handleConfirmDelete = useCallback(async () => {
    if (!txToDelete) return

    let deleteId = txToDelete.id
    if (txToDelete.id.includes('-split-')) {
      deleteId = txToDelete.id.split('-split-')[0]
    }

    await onDeleteTransaction(deleteId, txToDelete, alsoDeleteDocuments ? attachedDocumentIds : undefined)
    setShowDeleteModal(false)
    setTxToDelete(null)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
  }, [alsoDeleteDocuments, attachedDocumentIds, onDeleteTransaction, txToDelete])

  const handleCancelDelete = useCallback(() => {
    deleteDocumentLookupRef.current += 1
    setShowDeleteModal(false)
    setTxToDelete(null)
    setAttachedDocumentIds([])
    setAlsoDeleteDocuments(false)
    setAreAttachedDocumentsLoading(false)
  }, [])

  const handleDeleteClickRef = useRef(handleDeleteClick)
  useEffect(() => {
    handleDeleteClickRef.current = handleDeleteClick
  })
  const onDeleteClickStable = useCallback((t: Transaction) => handleDeleteClickRef.current(t), [])

  const onEditBlockedStable = useCallback((transaction: Transaction) => {
    setEditBlockedTransaction(transaction)
    setShowEditDisabledModal(true)
  }, [])

  return {
    showDeleteModal,
    setShowDeleteModal,
    txToDelete,
    attachedDocumentIds,
    alsoDeleteDocuments,
    setAlsoDeleteDocuments,
    areAttachedDocumentsLoading,
    showEditDisabledModal,
    setShowEditDisabledModal,
    editBlockedTransaction,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    onDeleteClickStable,
    onEditBlockedStable,
  }
}
