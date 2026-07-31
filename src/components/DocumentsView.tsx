import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, ShieldCheck, Trash2, UploadCloud } from 'lucide-react'
import { DocumentUploadSheet } from './documents/DocumentUploadSheet'
import { useDocumentsView } from './documents/view/useDocumentsView'
import { CustomConfirmModal } from './ui/CustomConfirmModal'
import { DocumentFilterBar } from './documents/view/DocumentFilterBar'
import { StorageUsageMeter } from './documents/view/StorageUsageMeter'
import { DocumentList } from './documents/view/DocumentList'
import { useAppPrefs, useAppUi } from '../contexts/AppContext'
import { TaxReliefOverview } from './documents/view/TaxReliefOverview'
import * as documentsApi from '../lib/api/documents'
import { CustomSelect } from './ui/CustomSelect'
import { getErrorMessage } from '../lib/errors'

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
    isLoading,
    taxYear,
    setTaxYear,
    search,
    setSearch,
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

  const { showToast } = useAppUi()
  const { currency } = useAppPrefs()
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
  }, [taxYear, search, pageSize])

  const toggleSelectAllVisible = () => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  const stageReliefCategory = (id: number, reliefCategory: string) => {
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
    if (pendingReliefCategories.size === 0 || isSavingReliefCategories) return
    const staged = Array.from(pendingReliefCategories.entries())
    setIsSavingReliefCategories(true)
    try {
      const results = await bulkUpdateDocumentCategories(staged.map(([id, reliefCategory]) => ({ id, reliefCategory })))
      const resultsById = new Map(results.map(result => [result.id, result]))
      const failed = staged.filter(([id]) => resultsById.get(id)?.updated !== true)
      setPendingReliefCategories(new Map(failed))
      const savedCount = staged.length - failed.length
      showToast(
        failed.length
          ? `${savedCount} document categor${savedCount === 1 ? 'y' : 'ies'} saved; ${failed.length} remain staged.`
          : `${savedCount} document categor${savedCount === 1 ? 'y' : 'ies'} saved together.`,
        failed.length ? 'Category changes partially saved' : 'Categories saved',
        failed.length ? 'error' : 'success',
      )
    } catch (error) {
      showToast(getErrorMessage(error, 'The document categories could not be saved.'), 'Category update failed', 'error')
    } finally {
      setIsSavingReliefCategories(false)
    }
  }

  return (
    <div className="space-y-5 soft-rise">
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
            Long-term storage for receipts, invoices and tax records. Retention dates are shown for
            reference only — nothing is ever deleted automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isDownloading || availableYears.length === 0}
            onClick={() => {
              setIsDownloading(true)
              void documentsApi.downloadDocumentArchive(taxYear).catch(() =>
                showToast('The ZIP archive could not be prepared.', 'Download Failed', 'error'))
                .finally(() => setIsDownloading(false))
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            <Download className="size-4" /> {isDownloading ? 'Preparing ZIP…' : taxYear ? `Download ${taxYear}` : 'Download all'}
          </button>
          <button
            type="button"
            onClick={() => setIsUploadSheetOpen(true)}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
          >
            <UploadCloud className="size-4" />
            Upload
          </button>
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

      {/* Panel */}
      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-5">
        <DocumentFilterBar
          search={search}
          setSearch={setSearch}
          taxYear={taxYear}
          setTaxYear={setTaxYear}
          availableYears={availableYears}
        />

        <StorageUsageMeter usage={usage} />

        <TaxReliefOverview
          summary={summary}
          categories={reliefCategories}
          taxYear={taxYear}
          currency={currency}
          onAddCategory={addReliefCategory}
          onUpdateCategory={updateReliefCategory}
        />

        {pendingReliefCategories.size > 0 && (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold">{pendingReliefCategories.size} tax relief categor{pendingReliefCategories.size === 1 ? 'y change' : 'y changes'} staged</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Save them together to update the Vault in one request.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={isSavingReliefCategories}
                onClick={() => setPendingReliefCategories(new Map())}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={isSavingReliefCategories}
                onClick={() => void saveReliefCategories()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {isSavingReliefCategories ? 'Saving…' : 'Save categories'}
              </button>
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-bold">{selectedIds.size} selected</span>
              {selectedIds.size > 100 && <p className="mt-0.5 text-[10px] text-destructive">Select up to 100 documents at a time.</p>}
            </div>
            <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:justify-end">
              <button
                type="button"
                disabled={isDownloading || selectedIds.size > 100}
                onClick={() => {
                  setIsDownloading(true)
                  void documentsApi.downloadSelectedDocumentArchive([...selectedIds])
                    .then(() => {
                      setSelectedIds(new Set())
                      showToast(`${selectedIds.size} document${selectedIds.size === 1 ? '' : 's'} downloaded.`, 'Download Complete', 'success')
                    })
                    .catch(() => showToast('The selected documents could not be downloaded.', 'Download Failed', 'error'))
                    .finally(() => setIsDownloading(false))
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-3.5" /> {isDownloading ? 'Preparing ZIP…' : 'Download selected'}
              </button>
              <button type="button" disabled={selectedIds.size > 100} onClick={() => setIsBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="size-3.5" /> Delete selected
              </button>
            </div>
          </div>
        )}

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
          currency={currency}
          pendingReliefCategories={pendingReliefCategories}
          onReliefCategoryChange={stageReliefCategory}
          updateDocument={async (id, updates) => {
            await updateDocumentMetadata(id, updates)
            void loadTaxInsights()
          }}
          reliefCategories={reliefCategories}
          onNavigateToTransaction={onNavigateToTransaction}
        />

        {totalCount > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-muted-foreground tabular-nums">
              Showing {Math.min((page - 1) * pageSize + 1, totalCount)}–{Math.min(page * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Rows per page</span>
                <CustomSelect
                  value={pageSize}
                  onChange={value => setPageSize(Number(value) as 10 | 25 | 50)}
                  options={[10, 25, 50].map(value => ({ value, label: String(value) }))}
                  ariaLabel="Rows per page"
                  className="w-20"
                  direction="up"
                />
              </div>
              <span className="font-semibold text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                disabled={page * pageSize >= totalCount}
                onClick={() => setPage(page + 1)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DocumentUploadSheet
        isOpen={isUploadSheetOpen}
        onClose={() => setIsUploadSheetOpen(false)}
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
          try {
            await deleteDocument(docToDelete)
            setSelectedIds(current => {
              const next = new Set(current)
              next.delete(docToDelete)
              return next
            })
            showToast('Document deleted.', 'Deleted', 'success')
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
          try {
            const results = await bulkDelete([...selectedIds])
            const failed = results.filter(result => !result.deleted)
            setSelectedIds(new Set(failed.map(result => result.id)))
            showToast(
              failed.length ? `${results.length - failed.length} deleted; ${failed.length} failed and remain selected.` : `${results.length} documents deleted.`,
              failed.length ? 'Partially Deleted' : 'Deleted',
              failed.length ? 'error' : 'success',
            )
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
