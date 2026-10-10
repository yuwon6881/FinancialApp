import { useEffect, useId, useState } from 'react'
import { ChevronDown, Link2, Pencil, X } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { useAppPrefs } from '../../../contexts/AppContext'
import { cn } from '../../../lib/utils'
import { AmountText } from '../../ui/AmountText'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { CustomSelect } from '../../ui/CustomSelect'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { SwipeableRow } from '../../ui/SwipeableRow'
import { formatBytes, formatDate } from './formatters'
import {
  AmountReview,
  DeleteDocumentButton,
  DocumentTypeIcon,
  DownloadDocumentButton,
  LinkedTransactionButton,
  PreviewDocumentButton,
  type UpdateDocumentFn,
} from './documentRowParts'

interface DocumentCardProps {
  document: VaultDocument
  isSelected: boolean
  isSyncing: boolean
  isFailed: boolean
  isDeleting: boolean
  /** Checkboxes appear only once the list is in selection mode; see DocumentList. */
  isSelecting: boolean
  reliefCategories: TaxReliefCategoryDefinition[]
  /** False while this document's tax year has no category list yet — absent, not empty. */
  areReliefCategoriesKnown?: boolean
  pendingReliefCategory: string | undefined
  openingTransactionId: string | null
  currency: string
  /** Rows under a month heading show only the day and month; ungrouped rows show the full date. */
  dateStyle?: 'day' | 'full'
  toggleSelected: (id: number) => void
  setDocToDelete: (id: number) => void
  downloadFailed: () => void
  onPreview: (document: VaultDocument) => void
  onReliefCategoryChange: (id: number, reliefCategory: string) => void
  onOpenLinkedTransaction?: (transactionId: string) => void
  updateDocument: UpdateDocumentFn
}

const DRAWER_ACTION_CLASS = 'flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const DETAIL_ACTION_CLASS = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 dark:bg-surface-2 dark:hover:bg-surface-3'

const dayMonth = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * One vault document below the dense table: a flat row in the list's grouped panel.
 *
 * The face says what a scan is *for* -- its name, the relief it counts towards, when it came in and
 * the amount -- and nothing else. Tapping the row opens its details in place: the amount editor,
 * the relief picker, the filing facts and the actions. Before this every card carried an amount
 * editor, a relief chip, a ledger link and a "Filing details" disclosure on its face, so ten
 * documents were a 3,000px form rather than a list.
 *
 * The details are hidden with CSS rather than unmounted, so an amount half-typed survives the row
 * being folded away. Download and Delete stay in the swipe drawer on a phone as well.
 */
export function DocumentCard({
  document,
  isSelected,
  isSyncing,
  isFailed,
  isDeleting,
  isSelecting,
  reliefCategories,
  areReliefCategoriesKnown = true,
  pendingReliefCategory,
  openingTransactionId,
  currency,
  dateStyle = 'day',
  toggleSelected,
  setDocToDelete,
  downloadFailed,
  onPreview,
  onReliefCategoryChange,
  onOpenLinkedTransaction,
  updateDocument,
}: DocumentCardProps) {
  const { hideSensitive } = useAppPrefs()
  const detailsId = useId()
  const [expanded, setExpanded] = useState(false)
  const isBusy = isDeleting || isSyncing
  const needsReview = document.amountStatus === 'NeedsReview'
  // A confirmed figure needs no caption; only a guess or a missing amount says something.
  const amountCaption = needsReview
    ? 'AI suggestion · please confirm'
    : document.amountStatus === 'Confirmed'
      ? null
      : document.amountExtractionMessage || 'No amount confirmed'

  // A document that already has a category shows it as a chip; the picker opens on request.
  const reliefId = pendingReliefCategory ?? document.reliefCategory ?? ''
  const reliefName = reliefCategories.find(category => category.id === reliefId)?.name
  const isReliefDraftChanged = pendingReliefCategory !== undefined && pendingReliefCategory !== (document.reliefCategory ?? '')
  const [editingRelief, setEditingRelief] = useState(false)
  // An unset category has nothing to fall back to, so the picker stays open and there is no cancel —
  // the field is genuinely required. A name missing only because this year's categories have not
  // arrived is not an unset category, and must not offer an empty required field.
  const showReliefPicker = editingRelief || (!reliefName && areReliefCategoriesKnown)
  const canCancelRelief = editingRelief && !!reliefName
  const missingRelief = !reliefName && areReliefCategoriesKnown
  // Collapse anything open if the row starts syncing or deleting out from under it.
  useEffect(() => {
    if (isBusy) setEditingRelief(false)
  }, [isBusy])
  // Selection mode turns the row into a checkbox target; the details fold away while it lasts.
  const showDetails = expanded && !isSelecting

  return (
    <div data-testid={`document-card-${document.id}`} aria-busy={isBusy} className="@container">
      <SwipeableRow
        variant="flush"
        disabled={isBusy || hideSensitive || isSelecting}
        actionsWidth={128}
        actions={
          <>
            <DownloadDocumentButton
              document={document}
              downloadFailed={downloadFailed}
              disabled={isBusy}
              className={`${DRAWER_ACTION_CLASS} bg-primary text-primary-foreground`}
            />
            <DeleteDocumentButton
              document={document}
              setDocToDelete={setDocToDelete}
              disabled={isBusy}
              className={`${DRAWER_ACTION_CLASS} bg-destructive text-destructive-foreground`}
            />
          </>
        }
        desktopActions={false}
      >
        <div className={cn('relative flex min-h-16 min-w-0 items-center gap-2.5 py-2.5 pl-3 pr-3 transition-colors @xs:gap-3 @xs:pl-4 hover:bg-surface-2/50', isSelected && 'bg-primary/6 hover:bg-primary/8')}>
          {/* The whole row is the target, laid over the content rather than wrapping it, so the
              sync status and the inline preview button stay their own elements instead of being
              flattened into one button's name. */}
          {isSelecting ? (
            <Button
              variant="tertiary"
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              disabled={hideSensitive || isBusy}
              onClick={() => toggleSelected(document.id)}
              className="absolute inset-0 size-auto min-h-0 rounded-none p-0 hover:bg-transparent active:scale-100 disabled:opacity-100"
            />
          ) : (
            <Button
              variant="tertiary"
              type="button"
              aria-expanded={showDetails}
              aria-controls={detailsId}
              aria-label={`Details for ${document.originalFileName}`}
              onClick={() => setExpanded(open => !open)}
              className="absolute inset-0 size-auto min-h-0 rounded-none p-0 hover:bg-transparent focus-visible:outline-offset-[-2px] active:scale-100"
            />
          )}

          {isSelecting ? (
            <span className="relative grid size-8 shrink-0 place-items-center @xs:size-10">
              <Checkbox
                disabled={hideSensitive || isBusy}
                checked={isSelected}
                onChange={() => toggleSelected(document.id)}
                aria-label={`Select ${document.originalFileName}`}
              />
            </span>
          ) : (
            <span className="pointer-events-none relative grid size-8 shrink-0 place-items-center rounded-control bg-surface-2 @xs:size-10 text-muted-foreground dark:bg-surface-3">
              <DocumentTypeIcon contentType={document.contentType} className="size-4 @xs:size-4.5" />
            </span>
          )}

          <div className="pointer-events-none relative min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-body font-medium text-foreground" title={document.originalFileName}>
                {document.originalFileName}
              </p>
              {document.transactionId && (
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-label="Linked to a transaction" />
              )}
              <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isFailed={isFailed} isPending={document.isPendingSync} entityLabel="document" />
            </div>
            <p className="mt-0.5 truncate text-caption text-muted-foreground tabular-nums">
              {reliefName
                ? <span>{reliefName}</span>
                : missingRelief && <span className="font-medium text-amber-700 dark:text-amber-300">No relief category</span>}
              {(reliefName || missingRelief) && <span aria-hidden="true"> · </span>}
              {dateStyle === 'full' ? formatDate(document.uploadedAt) : dayMonth(document.uploadedAt)}
              <span className="hidden @md:inline"> · {formatBytes(document.sizeBytes)}</span>
            </p>
          </div>

          <div className="pointer-events-none relative shrink-0 text-right">
            {document.amount != null ? (
              <AmountText
                value={document.amount}
                currency={currency}
                isMasked={hideSensitive}
                className={cn('block text-body font-semibold', needsReview ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}
              />
            ) : (
              <span className="block text-label text-muted-foreground">No amount</span>
            )}
            {needsReview && <span className="block text-caption font-medium text-amber-700 dark:text-amber-300">To review</span>}
          </div>

          {/* Preview is the one action worth a permanent place once the row has the width. */}
          {!isSelecting && (
            <div className="relative hidden shrink-0 @xl:block">
              <PreviewDocumentButton document={document} onPreview={onPreview} disabled={isBusy} />
            </div>
          )}
          {!isSelecting && (
            <ChevronDown
              className={cn('pointer-events-none relative hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 @md:block', showDetails && 'rotate-180')}
              aria-hidden="true"
            />
          )}
        </div>

        <div
          id={detailsId}
          data-testid={`document-details-${document.id}`}
          className={cn('px-3 pb-3', !showDetails && 'hidden')}
        >
          <div className="space-y-3 rounded-control bg-surface-2/70 p-3 dark:bg-surface-3/60">
            <div className="grid gap-3 @lg:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-label font-medium text-muted-foreground">Amount</p>
                <div className="-ml-1.5">
                  <AmountReview document={document} updateDocument={updateDocument} currency={currency} disabled={isBusy} />
                </div>
                {amountCaption && <p className="mt-0.5 text-caption text-muted-foreground">{amountCaption}</p>}
              </div>

              <div className="min-w-0" onKeyDown={event => { if (event.key === 'Escape' && canCancelRelief) { event.stopPropagation(); setEditingRelief(false) } }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-label font-medium text-muted-foreground">
                    Tax relief category{showReliefPicker && <span className="text-destructive">*</span>}
                    {isReliefDraftChanged && <span className="inline-block size-1.5 rounded-full bg-primary" title="Unsaved change" />}
                  </p>
                  {canCancelRelief && (
                    <Button size="icon"
                      variant="tertiary"
                      type="button"
                      onClick={() => setEditingRelief(false)}
                      aria-label={`Keep ${reliefName} as the tax relief category for ${document.originalFileName}`}
                      title="Keep the current category"
                      className="size-11 shrink-0 text-muted-foreground sm:size-8 lg:size-8"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
                {showReliefPicker ? (
                  <CustomSelect
                    disabled={hideSensitive || isBusy}
                    value={reliefId}
                    onChange={value => {
                      onReliefCategoryChange(document.id, String(value))
                      setEditingRelief(false)
                    }}
                    options={[
                      ...(reliefId ? [] : [{ value: '', label: 'Choose tax relief category', disabled: true }]),
                      ...reliefCategories.map(category => ({ value: category.id, label: category.name })),
                    ]}
                    ariaLabel={`Tax relief category for ${document.originalFileName}`}
                    className={`w-full ${isReliefDraftChanged ? 'rounded-lg ring-2 ring-primary/50' : ''}`}
                  />
                ) : reliefName ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    type="button"
                    disabled={hideSensitive || isBusy}
                    onClick={() => setEditingRelief(true)}
                    aria-label={`Change tax relief category for ${document.originalFileName}`}
                    className={cn(
                      '-ml-1 max-w-full gap-1.5 px-2.5 font-medium',
                      isReliefDraftChanged && 'bg-primary/10 ring-2 ring-primary/50 hover:bg-primary/10',
                    )}
                  >
                    <span className="truncate">{reliefName}</span>
                    {isReliefDraftChanged && <span className="inline-block size-1.5 rounded-full bg-primary" title="Unsaved change" />}
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Button>
                ) : (
                  // Neither a name nor a picker: this year's categories are still on their way.
                  <p className="text-caption text-muted-foreground">Loading categories…</p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-caption @lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Tax year</dt>
                <dd className="font-medium text-foreground tabular-nums">{document.taxYear}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Uploaded</dt>
                <dd className="font-medium text-foreground">{formatDate(document.uploadedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-medium text-foreground tabular-nums">{formatBytes(document.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Keep until</dt>
                <dd className="font-medium text-foreground">{formatDate(document.retentionUntil)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <PreviewDocumentButton document={document} onPreview={onPreview} disabled={isBusy} className={cn(DETAIL_ACTION_CLASS, '@xl:hidden')} />
              <DownloadDocumentButton document={document} downloadFailed={downloadFailed} disabled={isBusy} className={DETAIL_ACTION_CLASS} />
              <LinkedTransactionButton document={document} openingTransactionId={openingTransactionId} onOpen={onOpenLinkedTransaction} />
              <DeleteDocumentButton
                document={document}
                setDocToDelete={setDocToDelete}
                disabled={isBusy}
                className={cn(DETAIL_ACTION_CLASS, 'ml-auto text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/14')}
              />
            </div>
          </div>
        </div>
      </SwipeableRow>
    </div>
  )
}
