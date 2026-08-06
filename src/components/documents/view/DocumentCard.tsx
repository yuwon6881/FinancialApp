import { ChevronDown } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { useAppPrefs } from '../../../contexts/AppContext'
import { Checkbox } from '../../ui/Checkbox'
import { CustomSelect } from '../../ui/CustomSelect'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { formatBytes, formatDate } from './formatters'
import { AmountReview, DocumentActions, DocumentTypeIcon, LinkedTransactionButton, type UpdateDocumentFn } from './documentRowParts'

interface DocumentCardProps {
  document: VaultDocument
  isSelected: boolean
  isSyncing: boolean
  isDeleting: boolean
  reliefCategories: TaxReliefCategoryDefinition[]
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

/**
 * One vault document on a phone.
 *
 * The filing facts — tax year, size, upload date, retention — sit behind a disclosure rather than
 * on the face of the card. Expanded, each row ran to five stanzas separated by four hairlines, so a
 * page of ten documents was some 3,300px of scrolling to find one file. None of that detail is
 * dropped: what a scan is *for* is the name, the amount and whether it is filed under a relief
 * category, and those three stay on the face.
 */
export function DocumentCard({
  document,
  isSelected,
  isSyncing,
  isDeleting,
  reliefCategories,
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

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm shadow-black/5" aria-busy={isBusy}>
      {/* The name gets the full width of its own line. Sharing a flex row with three action buttons
          and two badges is what clipped it to "Official Receipt [REP-…". */}
      <div className="flex min-w-0 items-start gap-2.5">
        <Checkbox
          disabled={hideSensitive || isBusy}
          checked={isSelected}
          onChange={() => toggleSelected(document.id)}
          aria-label={`Select ${document.originalFileName}`}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
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
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <AmountReview document={document} updateDocument={updateDocument} currency={currency} disabled={isBusy} />
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{amountCaption}</p>
        </div>
        <DocumentActions
          document={document}
          setDocToDelete={setDocToDelete}
          downloadFailed={downloadFailed}
          onPreview={onPreview}
          disabled={isBusy}
        />
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tax relief category <span className="text-destructive">*</span>
        </p>
        <CustomSelect
          disabled={hideSensitive || isBusy}
          value={pendingReliefCategory ?? document.reliefCategory ?? ''}
          onChange={value => onReliefCategoryChange(document.id, String(value))}
          options={[
            { value: '', label: 'Uncategorised (legacy)', disabled: true },
            ...reliefCategories.map(category => ({ value: category.id, label: category.name })),
          ]}
          ariaLabel={`Tax relief category for ${document.originalFileName}`}
          className="w-full"
        />
      </div>

      <details className="group/filing mt-3 rounded-lg border border-border/50 bg-muted/20">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50">
          <span>Filing details</span>
          <ChevronDown className="size-3.5 transition-transform duration-200 group-open/filing:rotate-180" aria-hidden="true" />
        </summary>
        {/* Four items in two columns. The same grid held three and always left an empty cell, which
            is the hole that used to sit under "Uploaded"; keep-until was a stray line below it. */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/50 px-3 py-2.5 text-[10px]">
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
    </article>
  )
}
