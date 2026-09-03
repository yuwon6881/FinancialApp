import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Download, Loader2, ShieldCheck, UploadCloud } from 'lucide-react'
import { DocumentUploadSheet } from './documents/DocumentUploadSheet'
import { VaultRetentionNotice } from './documents/VaultRetentionNotice'
import { useDocumentsView } from './documents/view/useDocumentsView'
import { DocumentFilterBar } from './documents/view/DocumentFilterBar'
import { StorageUsageMeter } from './documents/view/StorageUsageMeter'
import { DocumentList } from './documents/view/DocumentList'
import { DocumentPagination } from './documents/view/DocumentPagination'
import { DocumentsLoadError } from './documents/view/DocumentsLoadError'
import { useStagedReliefCategories } from './documents/view/useStagedReliefCategories'
import { useAppPrefs, useAppSync, useAppUi } from '../contexts/AppContext'
import { TaxReliefOverview } from './documents/view/TaxReliefOverview'
import { DocumentDeleteModals } from './documents/view/DocumentDeleteModals'
import * as documentsApi from '../lib/api/documents'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
import { Button } from './ui/Button'
import { PageHeader } from './ui/PageHeader'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { createFinalId } from '../lib/outbox'
import { useOptimisticList } from '../lib/useOptimisticList'
import { Badge } from './ui/Badge'
import { SectionHeader } from './ui/SectionHeader'

interface DocumentsViewProps {
  onNavigateToTransaction?: (transactionId: string) => Promise<void> | void
}

export function DocumentsView({ onNavigateToTransaction }: DocumentsViewProps) {
  const { showToast, guardSensitive } = useAppUi()
  const { currency, hideSensitive } = useAppPrefs()
  const { operations = [], failedOperations = [], activeSyncIds = [], deletingId, queueMutation } = useAppSync()

  const {
    documents: serverDocuments,
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
    loadOverview,
    deleteDocument,
    bulkDelete,
  } = useDocumentsView(showToast)

  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<number | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null)
  const [syncingDocumentIds, setSyncingDocumentIds] = useState<Set<number>>(new Set())
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<Set<number>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isDownloadingArchive, setIsDownloadingArchive] = useState(false)
  const [isDownloadingSelection, setIsDownloadingSelection] = useState(false)
  const refreshedCategoryOpsRef = useRef(new Set<string>())
  const refreshedDocumentOpsRef = useRef(new Set<string>())

  const vaultDocumentOperations = useMemo(() => operations.filter(operation =>
    operation.entity === 'vaultDocument',
  ), [operations])
  const outboxSyncingDocumentIds = useMemo(() => new Set(
    vaultDocumentOperations
      .filter(operation => activeSyncIds.includes(operation.id))
      .map(operation => Number(operation.targetId)),
  ), [activeSyncIds, vaultDocumentOperations])
  const failedDocumentIds = useMemo(() => new Set(
    failedOperations
      .filter(operation => operation.entity === 'vaultDocument')
      .map(operation => Number(operation.targetId)),
  ), [failedOperations])
  const visibleSyncingDocumentIds = useMemo(
    () => new Set([...syncingDocumentIds, ...outboxSyncingDocumentIds]),
    [outboxSyncingDocumentIds, syncingDocumentIds],
  )
  const documents = useOptimisticList(serverDocuments, vaultDocumentOperations, 'vaultDocument')

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
    bulkUpdate: async updates => {
      const results = updates.map(update => {
        const document = documents.find(item => item.id === update.id)
        if (!document || !queueMutation) return { id: update.id, updated: false, message: 'Document is no longer available.' }
        const queued = queueMutation('vaultDocument', 'update', String(update.id), {
          reliefCategory: update.reliefCategory,
          name: document.originalFileName,
          undoSnapshot: document,
        })
        return queued
          ? { id: update.id, updated: true }
          : { id: update.id, updated: false, message: 'Change could not be queued.' }
      })
      return results
    },
    isQueued: true,
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
    void loadOverview(taxYear)
  }, [loadOverview, taxReliefOperations, taxYear])

  useEffect(() => {
    const newlyCompleted = vaultDocumentOperations.filter(operation =>
      operation.isCompleted && !refreshedDocumentOpsRef.current.has(operation.id),
    )
    if (newlyCompleted.length === 0) return
    newlyCompleted.forEach(operation => refreshedDocumentOpsRef.current.add(operation.id))
    void loadDocuments()
    void loadOverview(taxYear)
  }, [loadDocuments, loadOverview, taxYear, vaultDocumentOperations])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const visibleIds = documents.map(document => document.id)
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  useEffect(() => {
    setSelectedIds(new Set())
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
      <PageHeader
        title="Document Vault"
        description="Keep receipts, invoices, and tax records in one place. Nothing is deleted automatically."
        icon={<span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink"><ShieldCheck className="size-5" /></span>}
        actions={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button
            variant="secondary"
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
        </div>}
      />

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
      <section className="rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card sm:p-4 sm:shadow-xs" aria-labelledby="vault-documents-heading">
        <SectionHeader
          title="Your documents"
          titleId="vault-documents-heading"
          description="Filter, review, and manage the files in your Vault."
          meta={<Badge>{totalCount} file{totalCount === 1 ? '' : 's'}</Badge>}
          className="mb-3 sm:px-3"
        />

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
              <p className="mt-0.5 text-xs text-muted-foreground">Save them together to update the Vault in one request.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="tertiary"
                type="button"
                disabled={stagedCategories.isSaving}
                onClick={() => stagedCategories.clear()}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                Discard
              </Button>
              <Button
                variant="tertiary"
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
              <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-lg backdrop-blur-sm">
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
                isFiltered={taxYear !== undefined || selectedReliefCategories.length > 0}
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
                syncingDocumentIds={visibleSyncingDocumentIds}
                failedDocumentIds={failedDocumentIds}
                deletingDocumentIds={deletingDocumentIds}
                currency={currency}
                pendingReliefCategories={stagedCategories.staged}
                onReliefCategoryChange={stagedCategories.stage}
                updateDocument={async (id, updates) => {
                  if (!guardSensitive()) return
                  const document = documents.find(item => item.id === id)
                  if (!document || !queueMutation) return
                  queueMutation('vaultDocument', 'update', String(id), {
                    ...updates,
                    name: document.originalFileName,
                    undoSnapshot: document,
                  })
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
          void loadOverview(taxYear)
        }}
        currency={currency}
      />

      <DocumentDeleteModals
        docToDelete={docToDelete}
        setDocToDelete={setDocToDelete}
        deletingDocumentId={deletingDocumentId}
        setDeletingDocumentId={setDeletingDocumentId}
        documents={documents}
        deleteDocument={deleteDocument}
        setSelectedIds={setSelectedIds}
        stagedCategories={stagedCategories}
        showToast={showToast}
        guardSensitive={guardSensitive}
        addDocumentIds={addDocumentIds}
        removeDocumentIds={removeDocumentIds}
        setDeletingDocumentIds={setDeletingDocumentIds}
        isBulkDeleteOpen={isBulkDeleteOpen}
        setIsBulkDeleteOpen={setIsBulkDeleteOpen}
        selectedIds={selectedIds}
        isBulkDeleting={isBulkDeleting}
        setIsBulkDeleting={setIsBulkDeleting}
        bulkDelete={bulkDelete}
      />
    </div>
  )
}
