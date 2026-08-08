import { Checkbox } from '../../ui/Checkbox'
import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { Skeleton } from '../../ui/Skeleton'
import { formatBytes, formatDate } from './formatters'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
import { SelectionToolbar } from '../../ui/SelectionToolbar'
import { DataTable, DataTableBody, DataTableHeader, DataTableHeaderCell } from '../../ui/DataTable'
import { DocumentPreviewSheet } from './DocumentPreviewSheet'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { DocumentCard } from './DocumentCard'
import { AmountReview, DocumentActions, DocumentTypeIcon, EmptyState, LinkedTransactionButton, type UpdateDocumentFn } from './documentRowParts'

interface DocumentListProps {
  documents: VaultDocument[]
  isLoading: boolean
  setDocToDelete: (id: number) => void
  selectedIds: Set<number>
  toggleSelected: (id: number) => void
  onToggleSelectAll: () => void
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  isDownloadingSelected: boolean
  onDownloadSelected: () => void
  onDeleteSelected: () => void
  isDeletingSelected?: boolean
  currency: string
  syncingDocumentIds?: ReadonlySet<number>
  deletingDocumentIds?: ReadonlySet<number>
  updateDocument: UpdateDocumentFn
  reliefCategoriesByTaxYear: Readonly<Record<number, TaxReliefCategoryDefinition[]>>
  pendingReliefCategories: ReadonlyMap<number, string>
  onReliefCategoryChange: (id: number, reliefCategory: string) => void
  onNavigateToTransaction?: (transactionId: string) => Promise<void> | void
  /** Drops every selection, so leaving selection mode leaves nothing selected behind it. */
  onClearSelection?: () => void
}

export function DocumentList({ documents, isLoading, setDocToDelete, selectedIds, toggleSelected, onToggleSelectAll, allVisibleSelected, someVisibleSelected, isDownloadingSelected, onDownloadSelected, onDeleteSelected, isDeletingSelected = false, currency, syncingDocumentIds = new Set<number>(), deletingDocumentIds = new Set<number>(), updateDocument, reliefCategoriesByTaxYear, pendingReliefCategories, onReliefCategoryChange, onNavigateToTransaction, onClearSelection }: DocumentListProps) {
  const { showToast } = useAppUi()
  const { hideSensitive } = useAppPrefs()
  const [previewDocument, setPreviewDocument] = useState<VaultDocument | null>(null)
  const [openingTransactionId, setOpeningTransactionId] = useState<string | null>(null)
  const hasSelection = selectedIds.size > 0

  // Bulk download and delete are the rare visit; reading the list is the common one. The toolbar
  // used to stand permanently at min-h-14 with an empty action slot reserved beside it, and every
  // row carried a checkbox, for a mode most visits never enter. An existing selection forces the
  // mode on so a selection can never be live with no way to see or clear it.
  const [selectionRequested, setSelectionRequested] = useState(false)
  const isSelecting = selectionRequested || hasSelection
  const leaveSelectionMode = () => {
    setSelectionRequested(false)
    onClearSelection?.()
  }
  const exceedsSelectionLimit = selectedIds.size > 100
  const downloadFailed = () =>
    showToast('The document could not be downloaded.', 'Download Failed', 'error')
  const openLinkedTransaction = async (transactionId: string) => {
    if (!onNavigateToTransaction) return
    setOpeningTransactionId(transactionId)
    try {
      await onNavigateToTransaction(transactionId)
    } finally {
      setOpeningTransactionId(current => current === transactionId ? null : current)
    }
  }
  const onOpenLinkedTransaction = onNavigateToTransaction
    ? (transactionId: string) => void openLinkedTransaction(transactionId)
    : undefined

  return (
    <>
      <SelectionToolbar
        testId="document-selection-toolbar"
        actionsTestId="document-selection-actions"
        itemCount={documents.length}
        selectedCount={selectedIds.size}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        isSelecting={isSelecting}
        onStartSelection={() => setSelectionRequested(true)}
        onToggleSelectAll={onToggleSelectAll}
        onLeaveSelection={leaveSelectionMode}
        disabled={hideSensitive}
        itemLabel="documents"
        actions={hasSelection && <>
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={hideSensitive || isDownloadingSelected || exceedsSelectionLimit}
            onClick={onDownloadSelected}
            aria-label={isDownloadingSelected ? 'Preparing selected document download' : 'Download selected documents'}
            title="Download selected"
            className="size-9 shrink-0 bg-card p-0 sm:size-auto sm:px-3"
          >
            <Download className={`size-3.5 ${isDownloadingSelected ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{isDownloadingSelected ? 'Preparing…' : 'Download'}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            disabled={hideSensitive || isDeletingSelected || exceedsSelectionLimit}
            onClick={onDeleteSelected}
            aria-busy={isDeletingSelected}
            aria-label="Delete selected documents"
            title="Delete selected"
            className="size-9 shrink-0 p-0 sm:size-auto sm:px-3"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{isDeletingSelected ? 'Deleting…' : 'Delete'}</span>
          </Button>
        </>}
      />
      <div data-testid="document-results">
      <div className="space-y-3 lg:hidden">
        {isLoading && documents.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="mt-3 h-12 w-full" />
            </div>
          ))
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-border/40">
            <EmptyState />
          </div>
        ) : documents.map(document => (
          <DocumentCard
            key={document.id}
            document={document}
            isSelected={selectedIds.has(document.id)}
            isSyncing={syncingDocumentIds.has(document.id)}
            isDeleting={deletingDocumentIds.has(document.id)}
            isSelecting={isSelecting}
            reliefCategories={reliefCategoriesByTaxYear[document.taxYear] ?? []}
            pendingReliefCategory={pendingReliefCategories.get(document.id)}
            openingTransactionId={openingTransactionId}
            currency={currency}
            toggleSelected={toggleSelected}
            setDocToDelete={setDocToDelete}
            downloadFailed={downloadFailed}
            onPreview={setPreviewDocument}
            onReliefCategoryChange={onReliefCategoryChange}
            onOpenLinkedTransaction={onOpenLinkedTransaction}
            updateDocument={updateDocument}
          />
        ))}
      </div>

      <div className="hidden w-full lg:block">
        <DataTable>
        <DataTableHeader className="text-[10px] uppercase tracking-wider">
            {isSelecting && <DataTableHeaderCell className="w-8 font-bold"><span className="sr-only">Select</span></DataTableHeaderCell>}
            <DataTableHeaderCell className="font-bold">Document</DataTableHeaderCell>
            <DataTableHeaderCell className="font-bold">Tax relief</DataTableHeaderCell>
            <DataTableHeaderCell className="font-bold">Tax Year</DataTableHeaderCell>
            <DataTableHeaderCell className="font-bold">Size</DataTableHeaderCell>
            <DataTableHeaderCell className="font-bold">Amount</DataTableHeaderCell>
            <DataTableHeaderCell className="font-bold">Uploaded</DataTableHeaderCell>
            <DataTableHeaderCell className="text-right font-bold">Actions</DataTableHeaderCell>
        </DataTableHeader>
        <DataTableBody>
          {isLoading && documents.length === 0 ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index}>
                {isSelecting && <td className="px-3 py-3"><Skeleton className="size-4" /></td>}
                <td className="px-3 py-3"><Skeleton className="h-4 w-56" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-12" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-3 py-3"><Skeleton className="ml-auto h-7 w-16" /></td>
                <td className="px-3 py-3"><Skeleton className="ml-auto h-7 w-16" /></td>
              </tr>
            ))
          ) : documents.length === 0 ? (
            <tr><td colSpan={isSelecting ? 8 : 7}><EmptyState /></td></tr>
          ) : documents.map(document => {
            const documentReliefCategories = reliefCategoriesByTaxYear[document.taxYear] ?? []
            const isDeleting = deletingDocumentIds.has(document.id)
            const isSyncing = syncingDocumentIds.has(document.id)
            const isBusy = isDeleting || isSyncing
            const pendingCategory = pendingReliefCategories.get(document.id)
            const isReliefDraftChanged = pendingCategory !== undefined && pendingCategory !== (document.reliefCategory ?? '')
            return (
              <tr key={document.id} className="transition-colors hover:bg-muted/40" aria-busy={isBusy}>
                {isSelecting && <td className="px-3 py-2.5"><Checkbox disabled={hideSensitive || isBusy} checked={selectedIds.has(document.id)} onChange={() => toggleSelected(document.id)} aria-label={`Select ${document.originalFileName}`} className="size-4 accent-primary" /></td>}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                      <DocumentTypeIcon contentType={document.contentType} className="size-4" />
                    </span>
                    <div className="min-w-0 max-w-[22rem]">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-bold text-foreground" title={document.originalFileName}>
                          {document.originalFileName}
                        </p>
                        <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} entityLabel="document" />
                        <LinkedTransactionButton
                          document={document}
                          openingTransactionId={openingTransactionId}
                          onOpen={onOpenLinkedTransaction}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <CustomSelect
                      disabled={hideSensitive || isBusy}
                      value={pendingCategory ?? document.reliefCategory ?? ''}
                      onChange={value => onReliefCategoryChange(document.id, String(value))}
                      options={[{ value: '', label: 'Uncategorised (legacy)', disabled: true }, ...documentReliefCategories.map(category => ({ value: category.id, label: category.name }))]}
                      ariaLabel={`Tax relief category for ${document.originalFileName}`}
                      className={`w-40 max-w-40 ${isReliefDraftChanged ? 'rounded-lg ring-2 ring-blue-500/50' : ''}`}
                    />
                    {isReliefDraftChanged && <span className="inline-block size-1.5 shrink-0 rounded-full bg-blue-500" title="Unsaved change" />}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-bold text-foreground tabular-nums">{document.taxYear}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatBytes(document.sizeBytes)}</td>
                 <td className="px-3 py-2.5"><AmountReview document={document} updateDocument={updateDocument} currency={currency} disabled={isBusy} />{document.amountStatus === 'NeedsReview' && <p className="mt-0.5 text-[10px] text-amber-600">AI · review</p>}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div className="whitespace-nowrap">{formatDate(document.uploadedAt)}</div>
                  <div className="whitespace-nowrap text-[10px]">Keep until {formatDate(document.retentionUntil)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <DocumentActions
                    document={document}
                    setDocToDelete={setDocToDelete}
                    downloadFailed={downloadFailed}
                    onPreview={setPreviewDocument}
                    disabled={isBusy}
                  />
                </td>
              </tr>
            )
          })}
        </DataTableBody>
      </DataTable>
      </div>
      <DocumentPreviewSheet document={previewDocument} onClose={() => setPreviewDocument(null)} />
      </div>
    </>
  )
}
