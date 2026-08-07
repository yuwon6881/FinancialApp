import { Checkbox } from '../../ui/Checkbox'
import { useEffect, useRef, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { Skeleton } from '../../ui/Skeleton'
import { formatBytes, formatDate } from './formatters'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
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

function SelectAllDocumentsControl({
  count,
  allSelected,
  someSelected,
  onToggle,
  disabled = false,
}: {
  count: number
  allSelected: boolean
  someSelected: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected
  }, [someSelected])

  // `-mx-1.5` cancels the padding that gives the hover state its breathing room, so the box itself
  // still lines up with the per-row checkboxes below rather than sitting 6px inside them.
  return (
    <label className={`-mx-1.5 inline-flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition ${count > 0 ? 'cursor-pointer hover:bg-muted' : 'opacity-60'}`}>
      <Checkbox
        ref={checkboxRef}
        checked={allSelected}
        onChange={onToggle}
        disabled={disabled || count === 0}
        aria-label={allSelected ? 'Clear document selection on this page' : 'Select all documents on this page'}
        className="size-4 border-primary/50 bg-card accent-primary"
      />
      <span className="truncate text-[10px] font-black uppercase tracking-wide text-foreground">Select page</span>
    </label>
  )
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
      {/* A grid, never `flex-wrap`. The two states of the count read at different widths ("10 on this
          page" vs "10 selected"), so a wrapping row fit the actions on one line in one state and two
          in the other — ticking a box then changed the toolbar's height and shoved the whole list up.
          One row with a truncating left cell keeps the height fixed without reserving empty space:
          Done is the last child, so it stays pinned to the right edge and the bulk actions grow
          leftward into the flexible cell as they appear. */}
      <div data-testid="document-selection-toolbar" className={`mb-3 grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${hasSelection ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/20'}`}>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          {isSelecting && (
            <>
              <SelectAllDocumentsControl
                count={documents.length}
                allSelected={allVisibleSelected}
                someSelected={someVisibleSelected}
                onToggle={onToggleSelectAll}
                disabled={hideSensitive}
              />
              <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
            </>
          )}
          <p
            className={`truncate text-[10px] font-semibold sm:text-xs ${exceedsSelectionLimit ? 'text-destructive' : hasSelection ? 'text-primary' : 'text-muted-foreground'}`}
            aria-live="polite"
          >
            {hasSelection
              ? `${selectedIds.size} selected${exceedsSelectionLimit ? ' · max 100' : ''}`
              : `${documents.length} on this page`}
          </p>
        </div>

        <div data-testid="document-selection-actions" className="flex shrink-0 items-center justify-end gap-1.5">
          {!isSelecting ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={hideSensitive || documents.length === 0}
              onClick={() => setSelectionRequested(true)}
              className="bg-card"
            >
              Select
            </Button>
          ) : (
            <>
              {/* Absent, not disabled, until something is selected: a greyed destructive button still
                  reads as red and dangerous, so it looked broken rather than waiting. They insert to
                  the *left* of Done, which is why nothing needs a reserved gap holding empty space. */}
              {hasSelection && (
                <>
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
                </>
              )}
              {/* Last child, so it stays flush with the right edge whatever appears beside it — the
                  one control in this row that must never move under a reaching thumb. */}
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={leaveSelectionMode}
                aria-label="Leave selection mode"
                className="shrink-0 bg-card"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
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
                 <CustomSelect disabled={hideSensitive || isBusy} value={pendingReliefCategories.get(document.id) ?? document.reliefCategory ?? ''} onChange={value => onReliefCategoryChange(document.id, String(value))}
                    options={[{ value: '', label: 'Uncategorised (legacy)', disabled: true }, ...documentReliefCategories.map(category => ({ value: category.id, label: category.name }))]}
                    ariaLabel={`Tax relief category for ${document.originalFileName}`} className="w-40 max-w-40" />
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
