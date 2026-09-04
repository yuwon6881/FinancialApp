import { useEffect, useState } from 'react'
import { Check, Download, ExternalLink, Eye, FileArchive, FileCode, FileImage, FileText, Link2, Loader2, Pencil, Trash2, X } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { getErrorMessage } from '../../../lib/errors'
import { useAppPrefs } from '../../../contexts/AppContext'
import { formatCurrencyVal, getCurrencySymbol } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { SensitiveMask } from '../../ui/SensitiveAmount'

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

export function EmptyState({ isFiltered = false }: { isFiltered?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <FileArchive className="mb-3 size-10 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-body font-bold text-foreground">
        {isFiltered ? 'No documents match your filters' : 'No documents yet'}
      </p>
      <p className="mt-1 text-caption text-muted-foreground">
        {isFiltered
          ? 'Try adjusting your tax year or category filters above.'
          : 'Upload receipts, invoices or statements to keep them for your tax records.'}
      </p>
    </div>
  )
}

export function AmountReview({ document, updateDocument, currency, disabled = false }: { document: VaultDocument; updateDocument: UpdateDocumentFn; currency?: string; disabled?: boolean }) {
  const { currency: appCurrency, hideSensitive } = useAppPrefs()
  const activeCurrency = currency ?? appCurrency
  const [editing, setEditing] = useState(false)
  const needsReview = document.amountStatus === 'NeedsReview'
  const [value, setValue] = useState(document.amount?.toFixed(2) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setValue(document.amount?.toFixed(2) ?? ''), [document.amount])

  // Leaving the editor must cost nothing. The only way out used to be the tick, and that writes to
  // the server directly rather than through the outbox, so a mis-tap was a real edit with no undo.
  const cancel = () => {
    setValue(document.amount?.toFixed(2) ?? '')
    setError(null)
    setEditing(false)
  }

  const save = async () => {
    if (disabled) return
    const trimmed = value.trim()
    // Both of these used to `return` in silence, so the tick looked broken rather than refusing.
    // An empty field is refused outright: it used to save `null` *with* `Confirmed`, recording "there
    // is definitively no amount here" from what is almost always a cleared field on the way to typing
    // a new one. A document with no amount stays `Unavailable` and reads "No amount confirmed".
    if (trimmed === '') {
      setError('Enter an amount, or press ✕ to leave this unchanged.')
      return
    }
    const amount = Number(trimmed)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter an amount of zero or more.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updateDocument(document.id, {
        amount,
        amountCurrency: activeCurrency.toUpperCase() === 'MYR' ? 'MYR' : 'OTHER',
        amountStatus: 'Confirmed',
      })
      setEditing(false)
    } catch (error) {
      // The server refuses this write for reasons the user can act on, and it names them. Without
      // this the rejection was an unhandled promise: the editor stayed open, the value stayed
      // typed, and nothing said why — the tick reading as broken, which is what the checks above
      // were added to stop it doing.
      setError(getErrorMessage(error, 'That amount could not be saved. Please try again.'))
    } finally { setSaving(false) }
  }
  if (hideSensitive) return <SensitiveMask />
  // An unreviewed suggestion is outlined rather than left as plain text, because it no longer opens by
  // itself: something has to say "this figure is a guess and still needs you".
  if (!editing) return <Button variant="tertiary" type="button" onClick={() => setEditing(true)} disabled={disabled} aria-label={needsReview ? `Review the suggested amount for ${document.originalFileName}` : undefined} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-caption font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 ${needsReview ? 'border border-amber-500/40 bg-amber-500/10 px-2 text-amber-600 hover:bg-amber-500/20' : 'text-accent-ink hover:bg-accent/60'}`}>
    {document.amount != null ? formatCurrencyVal(document.amount, activeCurrency) : 'Add amount'}<Pencil className="size-3.5" />
  </Button>
  return <div>
    <div className="flex items-center gap-1.5" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); cancel() } }}>
      <span className="text-caption font-bold text-foreground">{getCurrencySymbol(activeCurrency)}</span>
      <Input value={value} onChange={event => { setValue(event.target.value); setError(null) }} disabled={disabled || saving} inputMode="decimal" aria-label={`Amount for ${document.originalFileName}`} aria-invalid={error ? true : undefined} className="h-9 w-20 rounded-lg border-border bg-background px-2 text-caption tabular-nums" />
      <IconButton type="button" onClick={() => void save()} disabled={disabled || saving} label={`Confirm amount for ${document.originalFileName}`} tooltip="Confirm amount" className="inline-grid size-11 shrink-0 place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:size-9"><Check className="size-4" strokeWidth={2.5} /></IconButton>
      <IconButton type="button" onClick={cancel} disabled={saving} label={`Stop editing the amount for ${document.originalFileName}`} tooltip="Discard this edit" className="inline-grid size-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:size-9"><X className="size-4" /></IconButton>
    </div>
    {error && <p className="mt-1 text-caption font-semibold text-destructive" role="alert">{error}</p>}
  </div>
}

const ACTION_CLASS = 'inline-flex cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'

/**
 * The three row actions, each exported on its own so the phone card can keep Preview on its face and
 * hand Download and Delete to a swipe drawer, while the desktop table still shows all three inline.
 */

export function PreviewDocumentButton({ document, onPreview, disabled = false }: { document: VaultDocument; onPreview: (document: VaultDocument) => void; disabled?: boolean }) {
  const { hideSensitive } = useAppPrefs()
  return (
    <Button
      variant="tertiary"
      type="button"
      disabled={hideSensitive || disabled}
      onClick={() => onPreview(document)}
      className={ACTION_CLASS}
      aria-label={`Preview ${document.originalFileName}`}
    >
      <Eye className="size-3.5" aria-hidden="true" />
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
      {className ? <span className="text-caption font-bold">{isDownloading ? 'Preparing…' : 'Download'}</span> : null}
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
      className={className ?? 'inline-flex cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50'}
      aria-label={`Delete ${document.originalFileName}`}
    >
      <Trash2 className="size-3.5" />
      {className ? <span className="text-caption font-bold">Delete</span> : null}
    </Button>
  )
}

export function DocumentActions({
  document,
  setDocToDelete,
  downloadFailed,
  onPreview,
  disabled = false,
}: {
  document: VaultDocument
  setDocToDelete: (id: number) => void
  downloadFailed: () => void
  onPreview: (document: VaultDocument) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <PreviewDocumentButton document={document} onPreview={onPreview} disabled={disabled} />
      <DownloadDocumentButton document={document} downloadFailed={downloadFailed} disabled={disabled} />
      <DeleteDocumentButton document={document} setDocToDelete={setDocToDelete} disabled={disabled} />
    </div>
  )
}

export function LinkedTransactionButton({
  document,
  openingTransactionId,
  onOpen,
}: {
  document: VaultDocument
  openingTransactionId: string | null
  onOpen?: (transactionId: string) => void
}) {
  if (!document.transactionId) return null
  const isOpening = openingTransactionId === document.transactionId
  // The label is unconditional. `hidden sm:inline` never did anything for the desktop table — that
  // only renders from `lg` up, where `sm:` is always satisfied — so the one surface it stripped the
  // word from was the phone card, leaving a bare 12px glyph in a row of status badges: no indication
  // it was a button, no indication where it went, and a tap target well under 44px. The card is also
  // the surface with the most room for it.
  if (!onOpen) {
    return (
      <span className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-caption font-bold text-accent-ink" title="Attached to a ledger record">
        <Link2 className="size-3 shrink-0" aria-hidden="true" />
        Linked
      </span>
    )
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={() => onOpen(document.transactionId!)}
      disabled={isOpening}
      aria-busy={isOpening}
      className="min-h-11 shrink-0 border-accent/30 bg-accent/10 px-2 text-caption text-accent-ink hover:border-accent/50 hover:bg-accent/20 sm:min-h-8"
      title="Open linked ledger transaction"
      aria-label={`Open linked transaction for ${document.originalFileName}`}
    >
      {/* Opening fetches the transaction before it can navigate, and the button only went disabled —
          on a phone that is indistinguishable from a tap that missed. */}
      {isOpening
        ? <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
        : <ExternalLink className="size-3 shrink-0" aria-hidden="true" />}
      {isOpening ? 'Opening…' : 'Ledger'}
    </Button>
  )
}
