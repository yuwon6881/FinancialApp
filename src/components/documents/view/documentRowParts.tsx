import { useState } from 'react'
import { ArrowUpRight, Download, Eye, FileArchive, FileCode, FileImage, FileText, Link2, Loader2, SearchX, Trash2, UploadCloud } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { useAppPrefs } from '../../../contexts/AppContext'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'

/**
 * The pieces a vault row is built from, shared by the mobile card and the desktop table so the two
 * cannot drift on what an action is called or what confirming an amount does.
 */

/**
 * Writes one document's metadata. **Rejects with a server-authored message that the caller must
 * put on screen** — the server refuses an edit for five distinct reasons (unconfigured category,
 * disallowed tax year, negative amount, …) and each arrives as the error's message. A bare
 * `void update(…)` swallows all of them and leaves the control looking broken.
 */
export type UpdateDocumentFn = (
  id: number,
  updates: Pick<Partial<VaultDocument>, 'taxYear' | 'transactionId' | 'reliefCategory' | 'amount' | 'amountCurrency'> & {
    amountStatus?: 'Confirmed' | 'NeedsReview'
  },
) => Promise<void>

export function DocumentTypeIcon({ contentType, className }: { contentType: string; className?: string }) {
  if (contentType.startsWith('image/')) return <FileImage className={className} aria-hidden="true" />
  if (contentType === 'application/pdf') return <FileText className={className} aria-hidden="true" />
  if (contentType.includes('xml') || contentType.includes('json')) return <FileCode className={className} aria-hidden="true" />
  return <FileArchive className={className} aria-hidden="true" />
}

export function EmptyState({
  isFiltered = false,
  onClearFilters,
  onUpload,
}: {
  isFiltered?: boolean
  /** Offered when filters are hiding documents, so the way out sits in the empty space itself. */
  onClearFilters?: () => void
  /** Offered in a genuinely empty vault, where uploading is the only useful next step. */
  onUpload?: () => void
}) {
  const action = isFiltered ? onClearFilters : onUpload
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-surface-2 text-muted-foreground dark:bg-surface-3">
        {isFiltered ? <SearchX className="size-5" aria-hidden="true" /> : <FileArchive className="size-5" aria-hidden="true" />}
      </span>
      <p className="text-body font-semibold text-foreground">
        {isFiltered ? 'No documents match your filters' : 'No documents yet'}
      </p>
      <p className="mt-1 max-w-xs text-caption text-muted-foreground">
        {isFiltered
          ? 'Try another tax year or relief category.'
          : 'Upload receipts, invoices or statements to keep them for your tax records.'}
      </p>
      {action && (
        <Button variant="secondary" size="sm" type="button" onClick={action} className="mt-4">
          {isFiltered ? 'Clear filters' : <><UploadCloud className="size-4" aria-hidden="true" />Upload a document</>}
        </Button>
      )}
    </div>
  )
}

// Quiet round icon actions at IconButton's size, so a row's actions read as one group.
const ACTION_CLASS = 'size-11 min-h-0 p-0 text-muted-foreground hover:text-foreground lg:size-9'

/**
 * The three row actions, each exported on its own so the phone card can keep Preview on its face and
 * hand Download and Delete to a swipe drawer, while the desktop table still shows all three inline.
 */

export function PreviewDocumentButton({ document, onPreview, disabled = false, className }: { document: VaultDocument; onPreview: (document: VaultDocument) => void; disabled?: boolean; className?: string }) {
  const { hideSensitive } = useAppPrefs()
  return (
    <Button
      variant="tertiary"
      type="button"
      disabled={hideSensitive || disabled}
      onClick={() => onPreview(document)}
      className={className ?? ACTION_CLASS}
      aria-label={`Preview ${document.originalFileName}`}
    >
      <Eye className="size-3.5" aria-hidden="true" />
      {className ? <span className="text-caption font-semibold">Preview</span> : null}
    </Button>
  )
}

export function DownloadDocumentButton({ document, downloadFailed, disabled = false, className }: { document: VaultDocument; downloadFailed: () => void; disabled?: boolean; className?: string }) {
  const { hideSensitive } = useAppPrefs()
  // Fetching the file has to finish before the browser will offer to save it, and a vault document
  // runs to 20 MB. Without this the button was indistinguishable from a tap that never landed, for
  // the same reason LinkedTransactionButton below shows a spinner while it resolves.
  const [isDownloading, setIsDownloading] = useState(false)
  const start = async () => {
    setIsDownloading(true)
    try {
      await downloadDocument(document.id, document.originalFileName)
    } catch {
      downloadFailed()
    } finally {
      setIsDownloading(false)
    }
  }
  return (
    <Button
      variant="tertiary"
      type="button"
      disabled={hideSensitive || disabled || isDownloading}
      aria-busy={isDownloading}
      onClick={() => void start()}
      className={className ?? ACTION_CLASS}
      aria-label={isDownloading ? `Preparing ${document.originalFileName}` : `Download ${document.originalFileName}`}
    >
      {isDownloading
        ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        : <Download className="size-3.5" />}
      {className ? <span className="text-caption font-semibold">{isDownloading ? 'Preparing…' : 'Download'}</span> : null}
    </Button>
  )
}

export function DeleteDocumentButton({ document, setDocToDelete, disabled = false, className }: { document: VaultDocument; setDocToDelete: (id: number) => void; disabled?: boolean; className?: string }) {
  const { hideSensitive } = useAppPrefs()
  return (
    <Button
      variant="tertiary"
      type="button"
      disabled={hideSensitive || disabled}
      onClick={() => setDocToDelete(document.id)}
      className={className ?? `${ACTION_CLASS} hover:bg-destructive/10 hover:text-destructive`}
      aria-label={`Delete ${document.originalFileName}`}
    >
      <Trash2 className="size-3.5" />
      {className ? <span className="text-caption font-semibold">Delete</span> : null}
    </Button>
  )
}

export function DocumentActions({
  document,
  setDocToDelete,
  downloadFailed,
  onPreview,
  disabled = false,
  openingTransactionId = null,
  onOpenLinkedTransaction,
}: {
  document: VaultDocument
  setDocToDelete: (id: number) => void
  downloadFailed: () => void
  onPreview: (document: VaultDocument) => void
  disabled?: boolean
  openingTransactionId?: string | null
  onOpenLinkedTransaction?: (transactionId: string) => void
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* The ledger slot is held open on unlinked rows so every row's icons line up in columns. */}
      {document.transactionId && onOpenLinkedTransaction
        ? <LinkedTransactionButton document={document} openingTransactionId={openingTransactionId} onOpen={onOpenLinkedTransaction} appearance="icon" />
        : <span className="size-11 shrink-0 lg:size-9" aria-hidden="true" />}
      <PreviewDocumentButton document={document} onPreview={onPreview} disabled={disabled} />
      <DownloadDocumentButton document={document} downloadFailed={downloadFailed} disabled={disabled} />
      <DeleteDocumentButton document={document} setDocToDelete={setDocToDelete} disabled={disabled} />
    </div>
  )
}

/**
 * The way from a document to the ledger record it is filed against.
 *
 * `icon` is the table's form: one more action in the row's action group, so the name column stays
 * a name. `labelled` is the phone card's form, where the details panel has room to say where it
 * goes. With no way to open the record it is a quiet "Linked" tag.
 */
export function LinkedTransactionButton({
  document,
  openingTransactionId,
  onOpen,
  appearance = 'labelled',
}: {
  document: VaultDocument
  openingTransactionId: string | null
  onOpen?: (transactionId: string) => void
  appearance?: 'icon' | 'labelled'
}) {
  if (!document.transactionId) return null
  const isOpening = openingTransactionId === document.transactionId
  if (!onOpen) return <LinkedTransactionTag />
  // Opening fetches the transaction before it can navigate, so it shows a spinner rather than only
  // going disabled, which on a phone is indistinguishable from a tap that missed.
  const icon = isOpening
    ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
    : <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
  if (appearance === 'icon') {
    return (
      <IconButton
        label={`Open linked transaction for ${document.originalFileName}`}
        tooltip="Open in ledger"
        onClick={() => onOpen(document.transactionId!)}
        disabled={isOpening}
        aria-busy={isOpening}
        className="text-accent-ink hover:bg-primary/10"
      >
        {icon}
      </IconButton>
    )
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => onOpen(document.transactionId!)}
      disabled={isOpening}
      aria-busy={isOpening}
      aria-label={`Open linked transaction for ${document.originalFileName}`}
      className="shrink-0 text-accent-ink"
    >
      {icon}
      {isOpening ? 'Opening…' : 'Open in ledger'}
    </Button>
  )
}

/** Says, without being a control, that a document is filed against a ledger record. */
export function LinkedTransactionTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap align-bottom font-medium text-accent-ink" title="Attached to a ledger record">
      <Link2 className="size-3 shrink-0" aria-hidden="true" />
      In ledger
    </span>
  )
}
