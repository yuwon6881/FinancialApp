import { useState } from 'react'
import { ChevronLeft, ChevronRight, ShieldCheck, UploadCloud } from 'lucide-react'
import { DocumentUploadSheet } from './documents/DocumentUploadSheet'
import { useDocumentsView } from './documents/view/useDocumentsView'
import { CustomConfirmModal } from './ui/CustomConfirmModal'
import { DocumentFilterBar } from './documents/view/DocumentFilterBar'
import { StorageUsageMeter } from './documents/view/StorageUsageMeter'
import { DocumentList } from './documents/view/DocumentList'
import { useAppUi } from '../contexts/AppContext'

export function DocumentsView() {
  const {
    documents,
    usage,
    availableYears,
    isLoading,
    taxYear,
    setTaxYear,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    totalCount,
    loadDocuments,
    loadUsage,
    loadAvailableYears,
    deleteDocument,
  } = useDocumentsView()

  const { showToast } = useAppUi()
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

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
        <button
          type="button"
          onClick={() => setIsUploadSheetOpen(true)}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/10"
        >
          <UploadCloud className="size-4" aria-hidden="true" />
          Upload Document
        </button>
      </div>

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

        <DocumentList documents={documents} isLoading={isLoading} setDocToDelete={setDocToDelete} />

        {totalCount > pageSize && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              Page {page} of {totalPages}
            </span>
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
        )}
      </div>

      <DocumentUploadSheet
        isOpen={isUploadSheetOpen}
        onClose={() => setIsUploadSheetOpen(false)}
        onSuccess={() => {
          void loadDocuments(true)
          void loadUsage()
          void loadAvailableYears()
        }}
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
    </div>
  )
}
