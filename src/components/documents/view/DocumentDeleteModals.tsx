import React from 'react'
import type { VaultDocument } from '../../../types'
import { CustomConfirmModal } from '../../ui/CustomConfirmModal'
import { getErrorMessage } from '../../../lib/errors'
import { buildMutationSuccessToast } from '../../../lib/mutationToast'

export interface DocumentDeleteModalsProps {
  docToDelete: number | null
  setDocToDelete: (id: number | null) => void
  deletingDocumentId: number | null
  setDeletingDocumentId: (id: number | null) => void
  documents: VaultDocument[]
  deleteDocument: (id: number) => Promise<unknown>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>
  stagedCategories: { forget: (ids: number[]) => void }
  showToast: (message: string, title?: string, tone?: any) => void
  guardSensitive: () => boolean
  addDocumentIds: (setter: React.Dispatch<React.SetStateAction<Set<number>>>, ids: number[]) => void
  removeDocumentIds: (setter: React.Dispatch<React.SetStateAction<Set<number>>>, ids: number[]) => void
  setDeletingDocumentIds: React.Dispatch<React.SetStateAction<Set<number>>>
  isBulkDeleteOpen: boolean
  setIsBulkDeleteOpen: (open: boolean) => void
  selectedIds: Set<number>
  isBulkDeleting: boolean
  setIsBulkDeleting: (deleting: boolean) => void
  bulkDelete: (ids: number[]) => Promise<Array<{ id: number; deleted: boolean; message?: string | null }>>
}

export const DocumentDeleteModals: React.FC<DocumentDeleteModalsProps> = ({
  docToDelete,
  setDocToDelete,
  deletingDocumentId,
  setDeletingDocumentId,
  documents,
  deleteDocument,
  setSelectedIds,
  stagedCategories,
  showToast,
  guardSensitive,
  addDocumentIds,
  removeDocumentIds,
  setDeletingDocumentIds,
  isBulkDeleteOpen,
  setIsBulkDeleteOpen,
  selectedIds,
  isBulkDeleting,
  setIsBulkDeleting,
  bulkDelete,
}) => {
  return (
    <>
      <CustomConfirmModal
        isOpen={docToDelete !== null}
        title="Delete Document"
        message="Delete this file permanently? Download a copy first if you still need it for tax evidence."
        confirmText="Delete"
        isConfirming={deletingDocumentId !== null}
        confirmingText="Deleting…"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (docToDelete === null) return
          if (!guardSensitive()) {
            setDocToDelete(null)
            return
          }
          const document = documents.find(item => item.id === docToDelete)
          setDeletingDocumentId(docToDelete)
          addDocumentIds(setDeletingDocumentIds, [docToDelete])
          try {
            await deleteDocument(docToDelete)
            setSelectedIds(current => {
              const next = new Set(current)
              next.delete(docToDelete)
              return next
            })
            stagedCategories.forget([docToDelete])
            const copy = buildMutationSuccessToast({
              entity: 'Document',
              action: 'Deleted',
              recordName: document?.originalFileName,
            })
            showToast(copy.message, copy.title, copy.tone)
          } catch (error) {
            showToast(getErrorMessage(error, 'The document could not be deleted.'), 'Delete Failed', 'error')
          } finally {
            setDeletingDocumentId(null)
            removeDocumentIds(setDeletingDocumentIds, [docToDelete])
            setDocToDelete(null)
          }
        }}
        onCancel={() => setDocToDelete(null)}
      />

      <CustomConfirmModal
        isOpen={isBulkDeleteOpen}
        title={`Delete ${selectedIds.size} documents?`}
        message="Delete the selected files permanently? Successful deletions cannot be undone; failed files stay in the Vault."
        confirmText="Delete selected"
        isConfirming={isBulkDeleting}
        confirmingText="Deleting…"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!guardSensitive()) {
            setIsBulkDeleteOpen(false)
            return
          }
          const idsToDelete = [...selectedIds]
          setIsBulkDeleting(true)
          addDocumentIds(setDeletingDocumentIds, idsToDelete)
          try {
            const results = await bulkDelete(idsToDelete)
            const failed = results.filter(result => !result.deleted)
            setSelectedIds(current => {
              const next = new Set(current)
              idsToDelete.forEach(id => next.delete(id))
              failed.forEach(result => next.add(result.id))
              return next
            })
            stagedCategories.forget(results.filter(result => result.deleted).map(result => result.id))
            if (failed.length) {
              const reason = failed.find(result => result.message)?.message
              showToast(
                `${results.length - failed.length} document${results.length - failed.length === 1 ? '' : 's'} deleted; ${failed.length} failed and remain selected.${reason ? ` ${reason}` : ''}`,
                'Documents Partially Deleted',
                'error',
              )
            } else {
              const copy = buildMutationSuccessToast({
                entity: 'Documents',
                action: 'Deleted',
                message: `${results.length} document${results.length === 1 ? '' : 's'} were deleted.`,
              })
              showToast(copy.message, copy.title, copy.tone)
            }
          } catch (error) {
            showToast(getErrorMessage(error, 'The selected documents could not be deleted.'), 'Delete Failed', 'error')
          } finally {
            setIsBulkDeleting(false)
            removeDocumentIds(setDeletingDocumentIds, idsToDelete)
            setIsBulkDeleteOpen(false)
          }
        }}
        onCancel={() => setIsBulkDeleteOpen(false)}
      />
    </>
  )
}
