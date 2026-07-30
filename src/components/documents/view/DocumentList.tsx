import { Input } from '../../ui/Input'
import { Checkbox } from '../../ui/Checkbox'
import { useEffect, useState } from 'react'
import { Check, Download, FileArchive, FileCode, FileImage, FileText, Link2, Pencil, Trash2 } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { useAppUi } from '../../../contexts/AppContext'
import { Skeleton } from '../../ui/Skeleton'
import { formatBytes, formatDate } from './formatters'
import { CustomSelect } from '../../ui/CustomSelect'

interface DocumentListProps {
  documents: VaultDocument[]
  isLoading: boolean
  setDocToDelete: (id: number) => void
  selectedIds: Set<number>
  toggleSelected: (id: number) => void
  updateDocument: (
    id: number,
    updates: Pick<Partial<VaultDocument>, 'taxYear' | 'documentType' | 'notes' | 'transactionId' | 'reliefCategory' | 'amount' | 'amountCurrency'> & {
      amountStatus?: 'Confirmed' | 'NeedsReview'
    },
  ) => Promise<void>
  reliefCategories: TaxReliefCategoryDefinition[]
}

function AmountReview({ document, updateDocument }: { document: VaultDocument; updateDocument: DocumentListProps['updateDocument'] }) {
  const [editing, setEditing] = useState(document.amountStatus === 'NeedsReview')
  const [value, setValue] = useState(document.amount?.toFixed(2) ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => setValue(document.amount?.toFixed(2) ?? ''), [document.amount])
  const save = async () => {
    const amount = value.trim() === '' ? null : Number(value)
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return
    setSaving(true)
    try {
      await updateDocument(document.id, { amount, amountCurrency: 'MYR', amountStatus: 'Confirmed' })
      setEditing(false)
    } finally { setSaving(false) }
  }
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-ink">
    {document.amount != null ? `RM${document.amount.toFixed(2)}` : 'Add amount'}<Pencil className="size-3" />
  </button>
  return <div className="flex items-center gap-1"><span className="text-[10px] font-bold">RM</span>
    <Input value={value} onChange={event => setValue(event.target.value)} inputMode="decimal" aria-label={`Amount for ${document.originalFileName}`} className="w-20 rounded-md border border-border bg-background px-1.5 py-1 text-[10px]" />
    <button type="button" onClick={() => void save()} disabled={saving} aria-label={`Confirm amount for ${document.originalFileName}`} className="rounded-md bg-emerald-500/10 p-1 text-emerald-600"><Check className="size-3.5" /></button>
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

export function DocumentList({ documents, isLoading, setDocToDelete, selectedIds, toggleSelected, updateDocument, reliefCategories }: DocumentListProps) {
  const { showToast } = useAppUi()
  const downloadFailed = () =>
    showToast('The document could not be downloaded.', 'Download Failed', 'error')

  return (
    <>
      <div className="space-y-2 lg:hidden">
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
            <article key={document.id} className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Checkbox  checked={selectedIds.has(document.id)} onChange={() => toggleSelected(document.id)} aria-label={`Select ${document.originalFileName}`} className="mt-2 size-4 accent-primary" />
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-foreground" title={document.originalFileName}>
                      {document.originalFileName}
                    </p>
                    {document.transactionId && (
                      <Link2 className="size-3 shrink-0 text-accent-ink" aria-label="Attached to a ledger record" />
                    )}
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

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/40 pt-2.5 text-[10px]">
                <div className="min-w-0">
                  <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 truncate font-bold text-foreground" title={document.documentType}>
                    {document.documentType}
                  </dd>
                </div>
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
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                <span className="text-[10px] text-muted-foreground">{document.amountStatus === 'NeedsReview' ? 'AI suggestion · please confirm' : document.amountStatus === 'Confirmed' ? 'Confirmed amount' : document.amountExtractionMessage || 'No amount confirmed'}</span>
                <AmountReview document={document} updateDocument={updateDocument} />
              </div>
              <div className="mt-2"><CustomSelect value={document.reliefCategory ?? ''} onChange={value => void updateDocument(document.id, { reliefCategory: String(value) || null })}
                options={[{ value: '', label: 'Uncategorised' }, ...reliefCategories.map(category => ({ value: category.id, label: category.name }))]} ariaLabel={`Tax relief category for ${document.originalFileName}`} className="w-full" /></div>
            </article>
          )
        })}
      </div>

      <div className="hidden w-full lg:block">
        <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="w-8 px-3 py-2.5 font-bold"><span className="sr-only">Select</span></th>
            <th scope="col" className="px-3 py-2.5 font-bold">Document</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Type</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Tax Year</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Size</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Amount</th>
            <th scope="col" className="px-3 py-2.5 font-bold">Uploaded</th>
            <th scope="col" className="px-3 py-2.5 text-right font-bold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {isLoading && documents.length === 0 ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index}>
                <td className="px-3 py-3"><Skeleton className="size-4" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-56" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-12" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
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
                        {document.transactionId && (
                          <Link2 className="size-3 shrink-0 text-accent-ink" aria-label="Attached to a ledger record" />
                        )}
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
                  <span className="mb-1 inline-flex whitespace-nowrap rounded-md border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{document.documentType}</span>
                  <CustomSelect value={document.reliefCategory ?? ''} onChange={value => void updateDocument(document.id, { reliefCategory: String(value) || null })}
                    options={[{ value: '', label: 'Uncategorised' }, ...reliefCategories.map(category => ({ value: category.id, label: category.name }))]}
                    ariaLabel={`Tax relief category for ${document.originalFileName}`} className="min-w-40" />
                </td>
                <td className="px-3 py-2.5 font-bold text-foreground tabular-nums">{document.taxYear}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatBytes(document.sizeBytes)}</td>
                <td className="px-3 py-2.5"><AmountReview document={document} updateDocument={updateDocument} />{document.amountStatus === 'NeedsReview' && <p className="mt-0.5 text-[9px] text-amber-600">AI · review</p>}</td>
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
        </tbody>
      </table>
      </div>
    </>
  )
}
