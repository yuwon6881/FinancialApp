import { useEffect, useState } from 'react'
import { AlertTriangle, Download, Loader2, ShieldCheck, UploadCloud } from 'lucide-react'
import { DocumentUploadSheet } from './documents/DocumentUploadSheet'
import { useDocumentsView } from './documents/view/useDocumentsView'
import { CustomConfirmModal } from './ui/CustomConfirmModal'
import { DocumentFilterBar } from './documents/view/DocumentFilterBar'
import { StorageUsageMeter } from './documents/view/StorageUsageMeter'
import { DocumentList } from './documents/view/DocumentList'
import { useAppPrefs, useAppUi } from '../contexts/AppContext'
import { TaxReliefOverview } from './documents/view/TaxReliefOverview'
import * as documentsApi from '../lib/api/documents'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
import { Button } from './ui/Button'
import { DataTableFooter, DataTablePagination } from './ui/DataTable'
import { CycleSkeleton } from './ui/Skeleton'

interface DocumentsViewProps {
  onNavigateToTransaction?: (transactionId: string) => Promise<void> | void
}

export function DocumentsView({ onNavigateToTransaction }: DocumentsViewProps) {
  const {
    documents,
    usage,
    availableYears,
    summary,
    expiredYears,
    reliefCategories,
    reliefCategoriesByTaxYear,
    isLoading,
    isTaxInsightsLoading,
    isInitialLoading,
    taxYear,
    setTaxYear,
    reliefCategory,
    setReliefCategory,
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
    addReliefCategory,
    updateReliefCategory,
    deleteDocument,
    updateDocumentMetadata,
    bulkUpdateDocumentCategories,
    bulkDelete,
  } = useDocumentsView()

  const { showToast, guardSensitive } = useAppUi()
  const { currency, hideSensitive } = useAppPrefs()
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [pendingReliefCategories, setPendingReliefCategories] = useState<Map<number, string>>(new Map())
  const [isSavingReliefCategories, setIsSavingReliefCategories] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const visibleIds = documents.map(document => document.id)
  const selectedVisibleCount = visibleIds.filter(id => selectedIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  useEffect(() => {
    setSelectedIds(new Set())
  }, [taxYear, reliefCategory, sortOrder, pageSize])

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

  const stageReliefCategory = (id: number, reliefCategory: string) => {
    if (!guardSensitive()) return
    const document = documents.find(item => item.id === id)
    if (!document) return
    const originalCategory = document.reliefCategory ?? ''
    setPendingReliefCategories(current => {
      const next = new Map(current)
      if (reliefCategory === originalCategory) next.delete(id)
      else next.set(id, reliefCategory)
      return next
    })
  }

  const saveReliefCategories = async () => {
    if (!guardSensitive()) return
    if (pendingReliefCategories.size === 0 || isSavingReliefCategories) return
    const staged = Array.from(pendingReliefCategories.entries())
    setIsSavingReliefCategories(true)
    try {
      const results = await bulkUpdateDocumentCategories(staged.map(([id, reliefCategory]) => ({ id, reliefCategory })))
      const resultsById = new Map(results.map(result => [result.id, result]))
      const failed = staged.filter(([id]) => resultsById.get(id)?.updated !== true)
      setPendingReliefCategories(current => {
        const next = new Map(current)
        for (const [id, stagedCategory] of staged) {
          if (current.get(id) !== stagedCategory) continue
          if (resultsById.get(id)?.updated === true) next.delete(id)
          else next.set(id, stagedCategory)
        }
        return next
      })
      const savedCount = staged.length - failed.length
      if (failed.length) {
        showToast(
          `${savedCount} document categor${savedCount === 1 ? 'y' : 'ies'} updated; ${failed.length} remain staged.`,
          'Document Categories Partially Updated',
          'error',
        )
      } else {
        const copy = buildMutationSuccessToast({
          entity: 'Document Categories',
          action: 'Updated',
          message: `${savedCount} document categor${savedCount === 1 ? 'y' : 'ies'} were updated together.`,
        })
        showToast(copy.message, copy.title, copy.tone)
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'The document categories could not be saved.'), 'Category update failed', 'error')
    } finally {
      setIsSavingReliefCategories(false)
    }
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            type="button"
            disabled={hideSensitive || isDownloading || availableYears.length === 0}
            onClick={() => {
              if (!guardSensitive()) return
              setIsDownloading(true)
              void documentsApi.downloadDocumentArchive(taxYear).catch(() =>
                showToast('The ZIP archive could not be prepared.', 'Download Failed', 'error'))
                .finally(() => setIsDownloading(false))
            }}
            className="rounded-xl bg-card text-xs"
          >
            <Download className="size-4" /> {isDownloading ? 'Preparing ZIP…' : taxYear ? `Download ${taxYear}` : 'Download all'}
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
            className="shrink-0 rounded-xl text-xs shadow-md"
          >
            <UploadCloud className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {expiredYears.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">Tax records past their seven-year retention date</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {expiredYears.map(year => `${year.taxYear} (${year.documentCount})`).join(', ')}. Nothing will be deleted automatically—review and remove them when you decide they are no longer needed.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Vault insights */}
      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4">
        <StorageUsageMeter usage={usage} />

        <TaxReliefOverview
          summary={summary}
          categories={reliefCategories}
          taxYear={taxYear}
          currency={currency}
          isLoading={isTaxInsightsLoading}
          selectedReliefCategory={reliefCategory}
          onSelectReliefCategory={setReliefCategory}
          onAddCategory={async input => {
            if (!guardSensitive()) return
            return addReliefCategory(input)
          }}
          onUpdateCategory={async (categoryId, input) => {
            if (!guardSensitive()) return
            return updateReliefCategory(categoryId, input)
          }}
        />
      </div>

      {/* Documents */}
      <section className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4" aria-labelledby="vault-documents-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
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
          reliefCategoryLabel={reliefCategories.find(category => category.id === reliefCategory)?.name}
          onClearReliefCategory={() => setReliefCategory(undefined)}
        />

        {pendingReliefCategories.size > 0 && (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold">{pendingReliefCategories.size} tax relief categor{pendingReliefCategories.size === 1 ? 'y change' : 'y changes'} staged</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Save them together to update the Vault in one request.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="unstyled"
                type="button"
                disabled={isSavingReliefCategories}
                onClick={() => setPendingReliefCategories(new Map())}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                Discard
              </Button>
              <Button
                variant="unstyled"
                type="button"
                disabled={isSavingReliefCategories}
                onClick={() => void saveReliefCategories()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {isSavingReliefCategories ? 'Saving…' : 'Save categories'}
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
              allVisibleSelected={allVisibleSelected}
              someVisibleSelected={someVisibleSelected}
              isDownloadingSelected={isDownloading}
              onDownloadSelected={() => {
                if (!guardSensitive()) return
                const idsToDownload = [...selectedIds]
                setIsDownloading(true)
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
                  .catch(() => showToast('The selected documents could not be downloaded.', 'Download Failed', 'error'))
                  .finally(() => setIsDownloading(false))
              }}
              onDeleteSelected={() => {
                if (!guardSensitive()) return
                setIsBulkDeleteOpen(true)
              }}
              currency={currency}
              pendingReliefCategories={pendingReliefCategories}
              onReliefCategoryChange={stageReliefCategory}
              updateDocument={async (id, updates) => {
                if (!guardSensitive()) return
                await updateDocumentMetadata(id, updates)
                void loadTaxInsights()
              }}
              reliefCategoriesByTaxYear={reliefCategoriesByTaxYear}
              onNavigateToTransaction={onNavigateToTransaction}
            />

            {totalCount > 0 && (
              <DataTableFooter className="mt-4">
                <DataTablePagination
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={totalCount}
                  totalPages={totalPages}
                  pageSizeOptions={[10, 25, 50]}
                  onPageChange={setPage}
                  onPageSizeChange={value => setPageSize(value as 10 | 25 | 50)}
                />
              </DataTableFooter>
            )}
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
        message="This permanently removes the file from your vault and cannot be undone. If you still need it as tax evidence, download a copy first."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (docToDelete === null) return
          if (!guardSensitive()) {
            setDocToDelete(null)
            return
          }
          const document = documents.find(item => item.id === docToDelete)
          try {
            await deleteDocument(docToDelete)
            setSelectedIds(current => {
              const next = new Set(current)
              next.delete(docToDelete)
              return next
            })
            const copy = buildMutationSuccessToast({
              entity: 'Document',
              action: 'Deleted',
              recordName: document?.originalFileName,
            })
            showToast(copy.message, copy.title, copy.tone)
          } catch {
            // deleteDocument rethrows so the row stays put; surface it instead of
            // leaving the modal open on an unhandled rejection.
            showToast('The document could not be deleted.', 'Delete Failed', 'error')
          } finally {
            setDocToDelete(null)
          }
        }}
        onCancel={() => setDocToDelete(null)}
      />

      <CustomConfirmModal
        isOpen={isBulkDeleteOpen}
        title={`Delete ${selectedIds.size} documents?`}
        message="This permanently removes every selected original file. Successful deletions cannot be undone; any storage failure will be reported and left in the Vault."
        confirmText="Delete selected"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!guardSensitive()) {
            setIsBulkDeleteOpen(false)
            return
          }
          const idsToDelete = [...selectedIds]
          try {
            const results = await bulkDelete(idsToDelete)
            const failed = results.filter(result => !result.deleted)
            setSelectedIds(current => {
              const next = new Set(current)
              idsToDelete.forEach(id => next.delete(id))
              failed.forEach(result => next.add(result.id))
              return next
            })
            if (failed.length) {
              showToast(
                `${results.length - failed.length} document${results.length - failed.length === 1 ? '' : 's'} deleted; ${failed.length} failed and remain selected.`,
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
          } catch {
            showToast('The selected documents could not be deleted.', 'Delete Failed', 'error')
          } finally {
            setIsBulkDeleteOpen(false)
          }
        }}
        onCancel={() => setIsBulkDeleteOpen(false)}
      />
    </div>
  )
}
