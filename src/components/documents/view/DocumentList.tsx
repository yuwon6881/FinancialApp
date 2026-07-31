import { Input } from '../../ui/Input'
import { Checkbox } from '../../ui/Checkbox'
import { useEffect, useRef, useState } from 'react'
import { Check, Download, ExternalLink, FileArchive, FileCode, FileImage, FileText, Link2, ListChecks, Pencil, Trash2 } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { formatCurrencyVal, getCurrencySymbol } from '../../../lib/utils'
import { Skeleton } from '../../ui/Skeleton'
import { formatBytes, formatDate } from './formatters'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
import { DataTable, DataTableBody, DataTableHeader, DataTableHeaderCell } from '../../ui/DataTable'

interface DocumentListProps {
  documents: VaultDocument[]
  isLoading: boolean
  setDocToDelete: (id: number) => void
  selectedIds: Set<number>
  toggleSelected: (id: number) => void
  onToggleSelectAll: () => void
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  currency: string
  updateDocument: (
    id: number,
    updates: Pick<Partial<VaultDocument>, 'taxYear' | 'notes' | 'transactionId' | 'reliefCategory' | 'amount' | 'amountCurrency'> & {
      amountStatus?: 'Confirmed' | 'NeedsReview'
    },
  ) => Promise<void>
  reliefCategories: TaxReliefCategoryDefinition[]
  pendingReliefCategories: ReadonlyMap<number, string>
  onReliefCategoryChange: (id: number, reliefCategory: string) => void
  onNavigateToTransaction?: (transactionId: string) => Promise<void> | void
}

function AmountReview({ document, updateDocument, currency }: { document: VaultDocument; updateDocument: DocumentListProps['updateDocument']; currency?: string }) {
  const { currency: appCurrency } = useAppPrefs()
  const activeCurrency = currency ?? appCurrency
  const [editing, setEditing] = useState(document.amountStatus === 'NeedsReview')
  const [value, setValue] = useState(document.amount?.toFixed(2) ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => setValue(document.amount?.toFixed(2) ?? ''), [document.amount])
  const save = async () => {
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
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1 text-[11px] font-bold text-accent-ink transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
    {document.amount != null ? formatCurrencyVal(document.amount, activeCurrency) : 'Add amount'}<Pencil className="size-3.5" />
  </button>
  return <div className="flex items-center gap-1.5"><span className="text-[11px] font-bold text-foreground">{getCurrencySymbol(activeCurrency)}</span>
    <Input value={value} onChange={event => setValue(event.target.value)} inputMode="decimal" aria-label={`Amount for ${document.originalFileName}`} className="h-9 w-20 rounded-lg border-border bg-background px-2 text-[11px] tabular-nums" />
    <button type="button" onClick={() => void save()} disabled={saving} aria-label={`Confirm amount for ${document.originalFileName}`} title="Confirm amount" className="inline-grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"><Check className="size-4" strokeWidth={2.5} /></button>
  </div>
}

function iconFor(contentType: string) {
  if (contentType.startsWith('image/')) return FileImage
  if (contentType === 'application/pdf') return FileText
  if (contentType.includes('xml') || contentType.includes('json')) return FileCode
  return FileArchive
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <FileArchive className="mb-3 size-10 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-xs font-bold text-foreground">No documents yet</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Upload receipts, invoices or statements to keep them for your tax records.
      </p>
    </div>
  )
}

function DocumentActions({
  document,
  setDocToDelete,
  downloadFailed,
}: {
  document: VaultDocument
  setDocToDelete: (id: number) => void
  downloadFailed: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => void downloadDocument(document.id, document.originalFileName).catch(downloadFailed)}
        className="cursor-pointer rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label={`Download ${document.originalFileName}`}
      >
        <Download className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDocToDelete(document.id)}
        className="cursor-pointer rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${document.originalFileName}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

function LinkedTransactionButton({
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
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-1.5 py-1 text-[9px] font-bold text-accent-ink" title="Attached to a ledger record">
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
      className="shrink-0 border-accent/30 bg-accent/10 px-1.5 py-1 text-[9px] text-accent-ink hover:border-accent/50 hover:bg-accent/20"
      title="Open linked ledger transaction"
      aria-label={`Open linked transaction for ${document.originalFileName}`}
    >
      <ExternalLink className="size-3" aria-hidden="true" />
      <span className="hidden sm:inline">Ledger</span>
    </Button>
  )
}

function SelectAllDocumentsControl({
  count,
  allSelected,
  someSelected,
  onToggle,
}: {
  count: number
  allSelected: boolean
  someSelected: boolean
  onToggle: () => void
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected
  }, [someSelected])

  return (
    <label className={`inline-flex w-fit items-center gap-2 rounded-xl border px-2.5 py-2 transition ${count > 0 ? 'cursor-pointer border-primary/25 bg-primary/5 hover:bg-primary/10' : 'border-border/50 bg-muted/20 opacity-60'}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
        <ListChecks className="size-3.5" />
      </span>
      <Checkbox
        ref={checkboxRef}
        checked={allSelected}
        onChange={onToggle}
        disabled={count === 0}
        aria-label={allSelected ? 'Clear document selection on this page' : 'Select all documents on this page'}
        className="size-4 border-primary/50 bg-card accent-primary"
      />
      <span className="pr-0.5 leading-tight">
        <span className="block text-[10px] font-black uppercase tracking-wide text-foreground">Select page</span>
        <span className="block text-[10px] text-muted-foreground">{count > 0 ? `${count} document${count === 1 ? '' : 's'} below` : 'No documents'}</span>
      </span>
    </label>
  )
}

export function DocumentList({ documents, isLoading, setDocToDelete, selectedIds, toggleSelected, onToggleSelectAll, allVisibleSelected, someVisibleSelected, currency, updateDocument, reliefCategories, pendingReliefCategories, onReliefCategoryChange, onNavigateToTransaction }: DocumentListProps) {
  const { showToast } = useAppUi()
  const [openingTransactionId, setOpeningTransactionId] = useState<string | null>(null)
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

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 border-b border-border/50 pb-3 sm:flex-row sm:items-center sm:justify-start">
        <SelectAllDocumentsControl
          count={documents.length}
          allSelected={allVisibleSelected}
          someSelected={someVisibleSelected}
          onToggle={onToggleSelectAll}
        />
        <div>
          <h3 className="text-sm font-black text-foreground">Documents</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Select files here to download or delete them together.</p>
        </div>
      </div>
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
        ) : documents.map(document => {
          const Icon = iconFor(document.contentType)
          return (
            <article key={document.id} className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm shadow-black/5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Checkbox checked={selectedIds.has(document.id)} onChange={() => toggleSelected(document.id)} aria-label={`Select ${document.originalFileName}`} className="size-4 shrink-0 accent-primary" />
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="line-clamp-2 min-w-0 text-xs font-bold leading-snug text-foreground" title={document.originalFileName}>
                      {document.originalFileName}
                    </p>
                    <LinkedTransactionButton
                      document={document}
                      openingTransactionId={openingTransactionId}
                      onOpen={onNavigateToTransaction ? transactionId => void openLinkedTransaction(transactionId) : undefined}
                    />
                  </div>
                  {document.notes && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {document.notes}
                    </p>
                  )}
                </div>
                <DocumentActions
                  document={document}
                  setDocToDelete={setDocToDelete}
                  downloadFailed={downloadFailed}
                />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/50 pt-3 text-[10px]">
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
              </dl>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Keep until {formatDate(document.retentionUntil)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                <span className="text-[10px] text-muted-foreground">{document.amountStatus === 'NeedsReview' ? 'AI suggestion · please confirm' : document.amountStatus === 'Confirmed' ? 'Confirmed amount' : document.amountExtractionMessage || 'No amount confirmed'}</span>
                <AmountReview document={document} updateDocument={updateDocument} currency={currency} />
              </div>
              <div className="mt-3 border-t border-border/50 pt-3"><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tax relief category <span className="text-destructive">*</span></p><CustomSelect value={pendingReliefCategories.get(document.id) ?? document.reliefCategory ?? ''} onChange={value => onReliefCategoryChange(document.id, String(value))}
                options={[{ value: '', label: 'Uncategorised (legacy)', disabled: true }, ...reliefCategories.map(category => ({ value: category.id, label: category.name }))]} ariaLabel={`Tax relief category for ${document.originalFileName}`} className="w-full" /></div>
            </article>
          )
        })}
      </div>

      <div className="hidden w-full lg:block">
        <DataTable>
        <DataTableHeader className="text-[10px] uppercase tracking-wider">
            <DataTableHeaderCell className="w-8 font-bold"><span className="sr-only">Select</span></DataTableHeaderCell>
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
                <td className="px-3 py-3"><Skeleton className="size-4" /></td>
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
            <tr><td colSpan={8}><EmptyState /></td></tr>
          ) : documents.map(document => {
            const Icon = iconFor(document.contentType)
            return (
              <tr key={document.id} className="transition-colors hover:bg-muted/40">
                <td className="px-3 py-2.5"><Checkbox  checked={selectedIds.has(document.id)} onChange={() => toggleSelected(document.id)} aria-label={`Select ${document.originalFileName}`} className="size-4 accent-primary" /></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 max-w-[22rem]">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-bold text-foreground" title={document.originalFileName}>
                          {document.originalFileName}
                        </p>
                        <LinkedTransactionButton
                          document={document}
                          openingTransactionId={openingTransactionId}
                          onOpen={onNavigateToTransaction ? transactionId => void openLinkedTransaction(transactionId) : undefined}
                        />
                      </div>
                      {document.notes && (
                        <p className="truncate text-[11px] text-muted-foreground" title={document.notes}>
                          {document.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <CustomSelect value={pendingReliefCategories.get(document.id) ?? document.reliefCategory ?? ''} onChange={value => onReliefCategoryChange(document.id, String(value))}
                    options={[{ value: '', label: 'Uncategorised (legacy)', disabled: true }, ...reliefCategories.map(category => ({ value: category.id, label: category.name }))]}
                    ariaLabel={`Tax relief category for ${document.originalFileName}`} className="min-w-40" />
                </td>
                <td className="px-3 py-2.5 font-bold text-foreground tabular-nums">{document.taxYear}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatBytes(document.sizeBytes)}</td>
                <td className="px-3 py-2.5"><AmountReview document={document} updateDocument={updateDocument} currency={currency} />{document.amountStatus === 'NeedsReview' && <p className="mt-0.5 text-[9px] text-amber-600">AI · review</p>}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div className="whitespace-nowrap">{formatDate(document.uploadedAt)}</div>
                  <div className="whitespace-nowrap text-[10px]">Keep until {formatDate(document.retentionUntil)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <DocumentActions
                    document={document}
                    setDocToDelete={setDocToDelete}
                    downloadFailed={downloadFailed}
                  />
                </td>
              </tr>
            )
          })}
        </DataTableBody>
      </DataTable>
      </div>
    </>
  )
}
