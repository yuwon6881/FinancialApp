import { useEffect, useState } from 'react'
import { ChevronDown, Pencil, X } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { useAppPrefs } from '../../../contexts/AppContext'
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
  isDeleting: boolean
  /** Checkboxes appear only once the list is in selection mode; see DocumentList. */
  isSelecting: boolean
  reliefCategories: TaxReliefCategoryDefinition[]
  /** False while this document's tax year has no category list yet — absent, not empty. */
  areReliefCategoriesKnown?: boolean
  pendingReliefCategory: string | undefined
  openingTransactionId: string | null
  currency: string
  toggleSelected: (id: number) => void
  setDocToDelete: (id: number) => void
  downloadFailed: () => void
  onPreview: (document: VaultDocument) => void
  onReliefCategoryChange: (id: number, reliefCategory: string) => void
  onOpenLinkedTransaction?: (transactionId: string) => void
  updateDocument: UpdateDocumentFn
}

const DRAWER_ACTION_CLASS = 'flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * One vault document on a phone.
 *
 * The filing facts — tax year, size, upload date, retention — sit behind a disclosure rather than on
 * the face of the card. Expanded, each row ran to five stanzas separated by four hairlines, so a page
 * of ten documents was some 3,300px of scrolling to find one file. None of that detail is dropped:
 * what a scan is *for* is the name, the amount and whether it is filed under a relief category, and
 * those three stay on the face.
 *
 * Preview stays as a visible button — it is the primary action and the only one a keyboard can reach
 * without a gesture — while Download and Delete move into the swipe drawer. Three icon buttons per
 * row put thirty tap targets on a page of ten, with a destructive one among them at all times.
 */
export function DocumentCard({
  document,
  isSelected,
  isSyncing,
  isDeleting,
  isSelecting,
  reliefCategories,
  areReliefCategoriesKnown = true,
  pendingReliefCategory,
  openingTransactionId,
  currency,
  toggleSelected,
  setDocToDelete,
  downloadFailed,
  onPreview,
  onReliefCategoryChange,
  onOpenLinkedTransaction,
  updateDocument,
}: DocumentCardProps) {
  const { hideSensitive } = useAppPrefs()
  const isBusy = isDeleting || isSyncing
  const amountCaption = document.amountStatus === 'NeedsReview'
    ? 'AI suggestion · please confirm'
    : document.amountStatus === 'Confirmed'
      ? 'Confirmed amount'
      : document.amountExtractionMessage || 'No amount confirmed'

  // A document that already has a category shows it as a chip. Leaving every row's picker expanded
  // turned the list into a form: ten required selects, nine of them already answered.
  const reliefId = pendingReliefCategory ?? document.reliefCategory ?? ''
  const reliefName = reliefCategories.find(category => category.id === reliefId)?.name
  const isReliefDraftChanged = pendingReliefCategory !== undefined && pendingReliefCategory !== (document.reliefCategory ?? '')
  const [editingRelief, setEditingRelief] = useState(false)
  // An unset category has nothing to fall back to, so the picker stays open and there is no cancel —
  // the field is genuinely required. Once a category exists, opening the picker is reversible.
  // A name missing only because this year's categories have not arrived is not an unset category,
  // and forcing the picker open there offered an empty required field for an answered question.
  const showReliefPicker = editingRelief || (!reliefName && areReliefCategoriesKnown)
  const canCancelRelief = editingRelief && !!reliefName
  // Collapse anything open if the row starts syncing or deleting out from under it.
  useEffect(() => {
    if (isBusy) setEditingRelief(false)
  }, [isBusy])

  // Tapping the card previews, so the common case costs no aim. Anything the user could have meant to
  // press instead — the checkbox, the amount editor, the picker, the disclosure — wins the tap.
  //
  // But tap-to-preview also took away the gesture people reach for to back out of a half-finished
  // edit: tapping empty space. So an open sub-state absorbs the first tap and closes, and only a card
  // at rest opens the preview. Without this, every escape hatch on the card is a preview instead.
  const previewOnBodyTap = (event: React.MouseEvent<HTMLDivElement>) => {
    if (hideSensitive || isBusy || isSelecting) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button, a, input, select, summary, label, [role="button"], [role="combobox"], [role="listbox"]')) return
    if (canCancelRelief) {
      setEditingRelief(false)
      return
    }
    onPreview(document)
  }

  return (
    <div data-testid={`document-card-${document.id}`} aria-busy={isBusy}>
      <SwipeableRow
        className="rounded-2xl border border-border/60 shadow-[var(--app-shadow-soft)]"
        contentClassName="p-3"
        disabled={isBusy || hideSensitive}
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
        // Between md and lg the card is still what renders but there is no swipe drawer, so the two
        // actions come back inline — as the compact icon buttons, not the drawer's full-colour blocks.
        desktopActions={
          <>
            <DownloadDocumentButton document={document} downloadFailed={downloadFailed} disabled={isBusy} />
            <DeleteDocumentButton document={document} setDocToDelete={setDocToDelete} disabled={isBusy} />
          </>
        }
      >
        <div onClick={previewOnBodyTap}>
          {/* The name gets the full width of its own line. Sharing a flex row with three action
              buttons and two badges is what clipped it to "Official Receipt [REP-…". */}
          {/* `items-center`, not `items-start`: a 16px checkbox top-aligned beside a 40px icon tile
              reads as misaligned with both the tile and the filename next to it. Centred, the
              checkbox, the tile, the name block and the preview button all sit on one axis. */}
          <div className="flex min-w-0 items-center gap-2.5">
            {isSelecting && (
              <Checkbox
                disabled={hideSensitive || isBusy}
                checked={isSelected}
                onChange={() => toggleSelected(document.id)}
                aria-label={`Select ${document.originalFileName}`}
                className="size-4 shrink-0 accent-primary"
              />
            )}
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
              <DocumentTypeIcon contentType={document.contentType} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-bold leading-snug text-foreground" title={document.originalFileName}>
                {document.originalFileName}
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden">
                <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} entityLabel="document" />
                <LinkedTransactionButton
                  document={document}
                  openingTransactionId={openingTransactionId}
                  onOpen={onOpenLinkedTransaction}
                />
              </div>
            </div>
            <PreviewDocumentButton document={document} onPreview={onPreview} disabled={isBusy} />
          </div>

          <div className="mt-3 flex flex-col items-stretch gap-2 min-[360px]:flex-row min-[360px]:items-end min-[360px]:justify-between sm:gap-3">
            <div className="min-w-0 max-w-full">
              <AmountReview document={document} updateDocument={updateDocument} currency={currency} disabled={isBusy} />
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{amountCaption}</p>
            </div>
            {/* No name and no picker means the year's categories are still on their way: show
                nothing rather than an empty chip claiming the document has no category. */}
            {!showReliefPicker && reliefName && (
              <Button
                variant="unstyled"
                type="button"
                disabled={hideSensitive || isBusy}
                onClick={() => setEditingRelief(true)}
                aria-label={`Change tax relief category for ${document.originalFileName}`}
                className={`inline-flex min-h-11 max-w-full shrink-0 self-end items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 sm:self-auto ${
                  isReliefDraftChanged
                    ? 'border-blue-500/40 bg-blue-500/10 ring-2 ring-blue-500/50'
                    : 'border-border/60 bg-muted/40'
                }`}
              >
                <span className="max-w-32 truncate">{reliefName}</span>
                {isReliefDraftChanged && <span className="inline-block size-1.5 rounded-full bg-blue-500" title="Unsaved change" />}
                <Pencil className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
            )}
          </div>

          {showReliefPicker && (
            <div className="mt-3" onKeyDown={event => { if (event.key === 'Escape' && canCancelRelief) { event.stopPropagation(); setEditingRelief(false) } }}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tax relief category <span className="text-destructive">*</span>
                  {isReliefDraftChanged && <span className="inline-block size-1.5 rounded-full bg-blue-500" title="Unsaved change" />}
                </p>
                {canCancelRelief && (
                  <Button
                    variant="unstyled"
                    type="button"
                    onClick={() => setEditingRelief(false)}
                    aria-label={`Keep ${reliefName} as the tax relief category for ${document.originalFileName}`}
                    title="Keep the current category"
                    className="inline-grid size-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:size-7"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
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
                className={`w-full ${isReliefDraftChanged ? 'rounded-lg ring-2 ring-blue-500/50' : ''}`}
              />
            </div>
          )}

          <details className="group/filing mt-3 border-t border-border/40">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-0 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
              <span>Filing details</span>
              <ChevronDown className="size-3.5 transition-transform duration-200 group-open/filing:rotate-180" aria-hidden="true" />
            </summary>
            {/* Four items in two columns. The same grid held three and always left an empty cell,
                which is the hole that used to sit under "Uploaded"; keep-until was a stray line
                below it. */}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/30 py-2.5 text-[10px]">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Tax year</dt>
                <dd className="mt-0.5 font-bold text-foreground tabular-nums">{document.taxYear}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Size</dt>
                <dd className="mt-0.5 font-semibold text-foreground tabular-nums">{formatBytes(document.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Uploaded</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{formatDate(document.uploadedAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Keep until</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{formatDate(document.retentionUntil)}</dd>
              </div>
            </dl>
          </details>
        </div>
      </SwipeableRow>
    </div>
  )
}
