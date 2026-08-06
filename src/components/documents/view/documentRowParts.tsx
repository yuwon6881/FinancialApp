import { useEffect, useState } from 'react'
import { Check, Download, ExternalLink, Eye, FileArchive, FileCode, FileImage, FileText, Link2, Pencil, Trash2 } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { useAppPrefs } from '../../../contexts/AppContext'
import { formatCurrencyVal, getCurrencySymbol } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { SensitiveMask } from '../../ui/SensitiveAmount'

/**
 * The pieces a vault row is built from, shared by the mobile card and the desktop table so the two
 * cannot drift on what an action is called or what confirming an amount does.
 */

export type UpdateDocumentFn = (
  id: number,
  updates: Pick<Partial<VaultDocument>, 'taxYear' | 'transactionId' | 'reliefCategory' | 'amount' | 'amountCurrency'> & {
    amountStatus?: 'Confirmed' | 'NeedsReview'
  },
) => Promise<void>

/**
 * The file-type glyph, as a component rather than an `iconFor(contentType)` lookup: picking the
 * component in a render body and rendering it as `<Icon />` reads to React (and to
 * react-hooks/static-components) as a component declared during render.
 */
export function DocumentTypeIcon({ contentType, className }: { contentType: string; className?: string }) {
  if (contentType.startsWith('image/')) return <FileImage className={className} aria-hidden="true" />
  if (contentType === 'application/pdf') return <FileText className={className} aria-hidden="true" />
  if (contentType.includes('xml') || contentType.includes('json')) return <FileCode className={className} aria-hidden="true" />
  return <FileArchive className={className} aria-hidden="true" />
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <FileArchive className="mb-3 size-10 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-xs font-bold text-foreground">No documents yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload receipts, invoices or statements to keep them for your tax records.
      </p>
    </div>
  )
}

export function AmountReview({ document, updateDocument, currency, disabled = false }: { document: VaultDocument; updateDocument: UpdateDocumentFn; currency?: string; disabled?: boolean }) {
  const { currency: appCurrency, hideSensitive } = useAppPrefs()
  const activeCurrency = currency ?? appCurrency
  const [editing, setEditing] = useState(document.amountStatus === 'NeedsReview')
  const [value, setValue] = useState(document.amount?.toFixed(2) ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => setValue(document.amount?.toFixed(2) ?? ''), [document.amount])
  const save = async () => {
    if (disabled) return
    const amount = value.trim() === '' ? null : Number(value)
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return
    setSaving(true)
    try {
      await updateDocument(document.id, {
        amount,
        amountCurrency: activeCurrency.toUpperCase() === 'MYR' ? 'MYR' : 'OTHER',
        amountStatus: 'Confirmed',
      })
      setEditing(false)
    } finally { setSaving(false) }
  }
  if (hideSensitive) return <SensitiveMask />
  if (!editing) return <Button variant="unstyled" type="button" onClick={() => setEditing(true)} disabled={disabled} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-accent-ink transition-colors hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
    {document.amount != null ? formatCurrencyVal(document.amount, activeCurrency) : 'Add amount'}<Pencil className="size-3.5" />
  </Button>
  return <div className="flex items-center gap-1.5"><span className="text-xs font-bold text-foreground">{getCurrencySymbol(activeCurrency)}</span>
    <Input value={value} onChange={event => setValue(event.target.value)} disabled={disabled || saving} inputMode="decimal" aria-label={`Amount for ${document.originalFileName}`} className="h-9 w-20 rounded-lg border-border bg-background px-2 text-xs tabular-nums" />
    <Button variant="unstyled" type="button" onClick={() => void save()} disabled={disabled || saving} aria-label={`Confirm amount for ${document.originalFileName}`} title="Confirm amount" className="inline-grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"><Check className="size-4" strokeWidth={2.5} /></Button>
  </div>
}

const ACTION_CLASS = 'cursor-pointer rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'

/**
 * The three row actions, each exported on its own so the phone card can keep Preview on its face and
 * hand Download and Delete to a swipe drawer, while the desktop table still shows all three inline.
 */

export function PreviewDocumentButton({ document, onPreview, disabled = false }: { document: VaultDocument; onPreview: (document: VaultDocument) => void; disabled?: boolean }) {
  const { hideSensitive } = useAppPrefs()
  return (
    <Button
      variant="unstyled"
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
  return (
    <Button
      variant="unstyled"
      type="button"
      disabled={hideSensitive || disabled}
      onClick={() => void downloadDocument(document.id, document.originalFileName).catch(downloadFailed)}
      className={className ?? ACTION_CLASS}
      aria-label={`Download ${document.originalFileName}`}
    >
      <Download className="size-3.5" />
      {className ? <span className="text-[10px] font-bold">Download</span> : null}
    </Button>
  )
}

export function DeleteDocumentButton({ document, setDocToDelete, disabled = false, className }: { document: VaultDocument; setDocToDelete: (id: number) => void; disabled?: boolean; className?: string }) {
  const { hideSensitive } = useAppPrefs()
  return (
    <Button
      variant="unstyled"
      type="button"
      disabled={hideSensitive || disabled}
      onClick={() => setDocToDelete(document.id)}
      className={className ?? 'cursor-pointer rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50'}
      aria-label={`Delete ${document.originalFileName}`}
    >
      <Trash2 className="size-3.5" />
      {className ? <span className="text-[10px] font-bold">Delete</span> : null}
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
  if (!onOpen) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-1.5 py-1 text-[10px] font-bold text-accent-ink" title="Attached to a ledger record">
        <Link2 className="size-3" aria-hidden="true" />
        <span className="hidden sm:inline">Linked</span>
      </span>
    )
  }
  return (
    <Button
      variant="outline"
      size="xs"
      type="button"
      onClick={() => onOpen(document.transactionId!)}
      disabled={isOpening}
      className="shrink-0 border-accent/30 bg-accent/10 px-1.5 py-1 text-[10px] text-accent-ink hover:border-accent/50 hover:bg-accent/20"
      title="Open linked ledger transaction"
      aria-label={`Open linked transaction for ${document.originalFileName}`}
    >
      <ExternalLink className="size-3" aria-hidden="true" />
      <span className="hidden sm:inline">Ledger</span>
    </Button>
  )
}
