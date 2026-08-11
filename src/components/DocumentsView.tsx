import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Download, Loader2, ShieldCheck, UploadCloud } from 'lucide-react'
import { DocumentUploadSheet } from './documents/DocumentUploadSheet'
import { VaultRetentionNotice } from './documents/VaultRetentionNotice'
import { useDocumentsView } from './documents/view/useDocumentsView'
import { CustomConfirmModal } from './ui/CustomConfirmModal'
import { DocumentFilterBar } from './documents/view/DocumentFilterBar'
import { StorageUsageMeter } from './documents/view/StorageUsageMeter'
import { DocumentList } from './documents/view/DocumentList'
import { DocumentPagination } from './documents/view/DocumentPagination'
import { DocumentsLoadError } from './documents/view/DocumentsLoadError'
import { useStagedReliefCategories } from './documents/view/useStagedReliefCategories'
import { useAppPrefs, useAppSync, useAppUi } from '../contexts/AppContext'
import { TaxReliefOverview } from './documents/view/TaxReliefOverview'
import * as documentsApi from '../lib/api/documents'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
import { Button } from './ui/Button'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { createFinalId } from '../lib/outbox'
import { useOptimisticList } from '../lib/useOptimisticList'

interface DocumentsViewProps {
  onNavigateToTransaction?: (transactionId: string) => Promise<void> | void
}

export function DocumentsView({ onNavigateToTransaction }: DocumentsViewProps) {
  const {
    documents,
    usage,
    availableYears,
    summary,
    retentionReview,
    reliefCategories,
    reliefCategoriesByTaxYear,
    isLoading,
    loadError,
    isTaxInsightsLoading,
    isInitialLoading,
    taxYear,
    setTaxYear,
    selectedReliefCategories,
    toggleReliefCategory,
    clearReliefCategory,
    clearAllReliefCategories,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    loadDocuments,
    loadUsage,
    loadAvailableYears,
    loadTaxInsights,
    deleteDocument,
    updateDocumentMetadata,
    bulkUpdateDocumentCategories,
    bulkDelete,
  } = useDocumentsView()

  const { showToast, guardSensitive } = useAppUi()
  const { currency, hideSensitive } = useAppPrefs()
  const { operations = [], activeSyncIds = [], deletingId, queueMutation } = useAppSync()
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<number | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null)
  const [syncingDocumentIds, setSyncingDocumentIds] = useState<Set<number>>(new Set())
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<Set<number>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  // Two flags, not one: the header archive button and the selection download are different controls,
  // and a shared flag made each of them relabel and disable the other while the other was running.
  const [isDownloadingArchive, setIsDownloadingArchive] = useState(false)
  const [isDownloadingSelection, setIsDownloadingSelection] = useState(false)
  const refreshedCategoryOpsRef = useRef(new Set<string>())

  const addDocumentIds = (setter: Dispatch<SetStateAction<Set<number>>>, ids: number[]) => {
    setter(current => {
      const next = new Set(current)
      ids.forEach(id => next.add(id))
      return next
    })
  }

  const removeDocumentIds = (setter: Dispatch<SetStateAction<Set<number>>>, ids: number[]) => {
    setter(current => {
      const next = new Set(current)
      ids.forEach(id => next.delete(id))
      return next
    })
  }

  const stagedCategories = useStagedReliefCategories({
    documents,
    bulkUpdate: bulkUpdateDocumentCategories,
    setRowsSyncing: (ids, isSyncing) =>
      (isSyncing ? addDocumentIds : removeDocumentIds)(setSyncingDocumentIds, ids),
    showToast,
    guardSensitive,
  })

  const selectedReliefYear = taxYear ?? availableYears[0]
  const taxReliefOperations = useMemo(() => operations.filter(operation =>
    operation.entity === 'taxReliefCategory'
    && operation.payload?.taxYear === selectedReliefYear,
  ), [operations, selectedReliefYear])
  const optimisticReliefCategories = useOptimisticList(reliefCategories, taxReliefOperations, 'taxReliefCategory')

  useEffect(() => {
    const newlyCompleted = taxReliefOperations.filter(operation =>
      operation.isCompleted && !refreshedCategoryOpsRef.current.has(operation.id),
    )
    if (newlyCompleted.length === 0) return
    newlyCompleted.forEach(operation => refreshedCategoryOpsRef.current.add(operation.id))
    void loadTaxInsights()
  }, [loadTaxInsights, taxReliefOperations])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const visibleIds = documents.map(document => document.id)
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  useEffect(() => {
    setSelectedIds(new Set())
    // Staged category edits are cleared with the selection, and for the same reason: after a filter
    // change the staged rows are no longer on screen, so the "N staged" bar counted documents the
    // user could not see or reach, and Save wrote changes they had lost sight of.
    stagedCategories.clear()
  }, [taxYear, selectedReliefCategories, sortOrder, pageSize])

  useEffect(() => {
    if (!hideSensitive) return
    setIsUploadSheetOpen(false)
    setDocToDelete(null)
    setIsBulkDeleteOpen(false)
  }, [hideSensitive])

  if (isInitialLoading) {
    return <CycleSkeleton variant="documents" />
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            Document Vault
          </h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Keep receipts, invoices, and tax records in one place. Nothing is deleted automatically.
          </p>
        </div>
        {/* Two equal halves on mobile: wrapping left the pair ragged with dead
            space beside it, and a full-width Download made the pairing unclear. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button
            variant="outline"
            size="lg"
            type="button"
            disabled={hideSensitive || isDownloadingArchive || availableYears.length === 0}
            onClick={() => {
              if (!guardSensitive()) return
              setIsDownloadingArchive(true)
              void documentsApi.downloadDocumentArchive(taxYear).catch(error =>
                showToast(getErrorMessage(error, 'The ZIP archive could not be prepared.'), 'Download Failed', 'error'))
                .finally(() => setIsDownloadingArchive(false))
            }}
            className="w-full justify-center rounded-xl bg-card text-xs sm:w-auto"
          >
            <Download className="size-4" /> {isDownloadingArchive ? 'Preparing ZIP…' : taxYear ? `Download ${taxYear}` : 'Download all'}
          </Button>
          <Button
            variant="primary"
            size="lg"
            type="button"
            disabled={hideSensitive}
            onClick={() => {
              if (!guardSensitive()) return
              setIsUploadSheetOpen(true)
            }}
            className="w-full shrink-0 justify-center rounded-xl text-xs shadow-md sm:w-auto"
          >
            <UploadCloud className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      <VaultRetentionNotice review={retentionReview} />

      {/* Vault insights */}
      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4">
        <StorageUsageMeter usage={usage} />

        <TaxReliefOverview
          summary={summary}
          categories={optimisticReliefCategories}
          taxYear={taxYear}
          currency={currency}
          isLoading={isTaxInsightsLoading}
          selectedReliefCategories={selectedReliefCategories}
          onToggleReliefCategory={toggleReliefCategory}
          onAddCategory={async input => {
            if (!guardSensitive()) return
            if (selectedReliefYear === undefined) throw new Error('Choose a tax year first.')
            queueMutation?.('taxReliefCategory', 'add', createFinalId('taxReliefCategory'), {
              ...input,
              taxYear: selectedReliefYear,
            })
          }}
          onUpdateCategory={async (categoryId, input) => {
            if (!guardSensitive()) return
            if (selectedReliefYear === undefined) throw new Error('Choose a tax year first.')
            const category = optimisticReliefCategories.find(item => item.id === categoryId)
            queueMutation?.('taxReliefCategory', 'update', categoryId, {
              ...input,
              taxYear: selectedReliefYear,
              undoSnapshot: category,
            })
          }}
          onDeleteCategory={async categoryId => {
            if (!guardSensitive()) return
            if (selectedReliefYear === undefined) throw new Error('Choose a tax year first.')
            const category = optimisticReliefCategories.find(item => item.id === categoryId)
            queueMutation?.('taxReliefCategory', 'delete', categoryId, {
              name: category?.name,
              taxYear: selectedReliefYear,
              undoSnapshot: category,
            })
            clearReliefCategory(categoryId)
          }}
          activeSyncIds={activeSyncIds}
          deletingId={deletingId}
        />
      </div>

      {/* Documents */}
      <section className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4" aria-labelledby="vault-documents-heading">
        {/* `px-3` matches the inner padding every boxed child below uses, so the heading, the filter
            controls, the selection count and each document's filename all start on one x. Without it
            the section had four different content edges: 12px here, 22px in the filter bar and
            toolbar, 26px inside a card. */}
        <div className="mb-3 flex items-end justify-between gap-3 px-3">
          <div>
            <h3 id="vault-documents-heading" className="text-sm font-black text-foreground">Your documents</h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Filter, review, and manage the files in your Vault.</p>
          </div>
          <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground tabular-nums">
            {totalCount} file{totalCount === 1 ? '' : 's'}
          </span>
        </div>

        <DocumentFilterBar
          taxYear={taxYear}
          setTaxYear={setTaxYear}
          availableYears={availableYears}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          selectedReliefCategories={selectedReliefCategories
            .map(id => reliefCategories.find(category => category.id === id))
            .filter((category): category is NonNullable<typeof category> => Boolean(category))
            .map(category => ({ id: category.id, name: category.name }))}
          onClearReliefCategory={clearReliefCategory}
          onClearAllReliefCategories={clearAllReliefCategories}
        />

        {loadError && <DocumentsLoadError message={loadError} isLoading={isLoading} onRetry={() => void loadDocuments()} />}

        {stagedCategories.staged.size > 0 && (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold">{stagedCategories.staged.size} tax relief categor{stagedCategories.staged.size === 1 ? 'y change' : 'y changes'} staged</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Save them together to update the Vault in one request.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="unstyled"
                type="button"
                disabled={stagedCategories.isSaving}
                onClick={() => stagedCategories.clear()}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                Discard
              </Button>
              <Button
                variant="unstyled"
                type="button"
                disabled={stagedCategories.isSaving}
                aria-busy={stagedCategories.isSaving}
                onClick={() => void stagedCategories.save()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {stagedCategories.isSaving ? 'Saving…' : 'Save categories'}
              </Button>
            </div>
          </div>
        )}

        <div className="relative" aria-busy={isLoading}>
          {isLoading && documents.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-lg backdrop-blur-sm">
                <Loader2 className="size-3.5 animate-spin text-accent-ink" aria-hidden="true" />
                Updating documents…
              </div>
            </div>
          )}
          <div className={isLoading && documents.length > 0 ? 'pointer-events-none opacity-55 blur-[1px] transition-all duration-200' : 'transition-all duration-200'}>
            {(!loadError || documents.length > 0) && <>
              <DocumentList
              documents={documents}
              isLoading={isLoading}
              setDocToDelete={setDocToDelete}
              selectedIds={selectedIds}
              toggleSelected={id => setSelectedIds(current => {
                const next = new Set(current)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })}
              onToggleSelectAll={toggleSelectAllVisible}
              onClearSelection={() => setSelectedIds(new Set())}
              allVisibleSelected={allVisibleSelected}
              someVisibleSelected={someVisibleSelected}
              isDownloadingSelected={isDownloadingSelection}
              onDownloadSelected={() => {
                if (!guardSensitive()) return
                const idsToDownload = [...selectedIds]
                setIsDownloadingSelection(true)
                void documentsApi.downloadSelectedDocumentArchive(idsToDownload)
                  .then(() => {
                    setSelectedIds(current => {
                      const next = new Set(current)
                      idsToDownload.forEach(id => next.delete(id))
                      return next
                    })
                    const copy = buildMutationSuccessToast({
                      entity: 'Documents',
                      action: 'Downloaded',
                      message: `${idsToDownload.length} document${idsToDownload.length === 1 ? '' : 's'} were downloaded.`,
                    })
                    showToast(copy.message, copy.title, copy.tone)
                  })
                  .catch(error => showToast(
                    getErrorMessage(error, 'The selected documents could not be downloaded.'),
                    'Download Failed',
                    'error',
                  ))
                  .finally(() => setIsDownloadingSelection(false))
              }}
              onDeleteSelected={() => {
                if (!guardSensitive()) return
                setIsBulkDeleteOpen(true)
              }}
              isDeletingSelected={isBulkDeleting}
              syncingDocumentIds={syncingDocumentIds}
              deletingDocumentIds={deletingDocumentIds}
              currency={currency}
              pendingReliefCategories={stagedCategories.staged}
              onReliefCategoryChange={stagedCategories.stage}
              updateDocument={async (id, updates) => {
                if (!guardSensitive()) return
                addDocumentIds(setSyncingDocumentIds, [id])
                try {
                  await updateDocumentMetadata(id, updates)
                  void loadTaxInsights()
                } finally {
                  removeDocumentIds(setSyncingDocumentIds, [id])
                }
              }}
              reliefCategoriesByTaxYear={reliefCategoriesByTaxYear}
              onNavigateToTransaction={onNavigateToTransaction}
              />

              <DocumentPagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>}
          </div>
        </div>
      </section>

      <DocumentUploadSheet
        isOpen={isUploadSheetOpen}
        onClose={() => setIsUploadSheetOpen(false)}
        initialTaxYear={taxYear}
        onSuccess={() => {
          void loadDocuments(true)
          void loadUsage()
          void loadAvailableYears()
          void loadTaxInsights()
        }}
        currency={currency}
      />

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
            // deleteDocument rethrows so the row stays put; surface it instead of
            // leaving the modal open on an unhandled rejection.
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
              // The endpoint says why each one failed; a bare count left the user to guess whether
              // retrying was worth it.
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
    </div>
  )
}
