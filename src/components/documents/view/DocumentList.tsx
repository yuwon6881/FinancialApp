import { FileText, FileImage, FileCode, FileArchive, Download, Trash2, Link2 } from 'lucide-react'
import { downloadDocument } from '../../../lib/api/documents'
import { Skeleton } from '../../ui/Skeleton'
import { useIsMobile } from '../../../lib/useIsMobile'
import { useAppUi } from '../../../contexts/AppContext'
import { formatBytes, formatDate } from './formatters'
import type { VaultDocument } from '../../../types'

interface DocumentListProps {
  documents: VaultDocument[]
  isLoading: boolean
  setDocToDelete: (id: number) => void
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

// Download and delete controls, shared by both layouts so the two never drift apart.
function RowActions({
  doc,
  setDocToDelete,
  onDownloadFailed,
}: {
  doc: VaultDocument
  setDocToDelete: (id: number) => void
  onDownloadFailed: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void downloadDocument(doc.id, doc.originalFileName).catch(onDownloadFailed)
        }}
        className="cursor-pointer rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title={`Download ${doc.originalFileName}`}
        aria-label={`Download ${doc.originalFileName}`}
      >
        <Download className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDocToDelete(doc.id)}
        className="cursor-pointer rounded-lg border border-border/60 bg-muted/40 p-2 text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        title={`Delete ${doc.originalFileName}`}
        aria-label={`Delete ${doc.originalFileName}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </>
  )
}

function DocumentTypeBadge({ documentType }: { documentType: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
      {documentType}
    </span>
  )
}

// Phone / small tablet: stacked cards. A table here would force horizontal scrolling,
// which the ledger deliberately avoids (see LedgerTransactionList).
function MobileDocumentList({ documents, isLoading, setDocToDelete }: DocumentListProps) {
  const { showToast } = useAppUi()
  const notifyDownloadFailed = () => showToast('The document could not be downloaded.', 'Download Failed', 'error')

  if (isLoading && documents.length === 0) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-muted/30 p-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  if (documents.length === 0) return <EmptyState />

  return (
    <ul className="space-y-2.5">
      {documents.map(doc => {
        const Icon = iconFor(doc.contentType)
        return (
          <li key={doc.id} className="rounded-xl border border-border/40 bg-muted/30 p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground" title={doc.originalFileName}>
                  {doc.originalFileName}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <DocumentTypeBadge documentType={doc.documentType} />
                  <span className="text-[10px] font-bold text-foreground">YA {doc.taxYear}</span>
                  <span className="text-[10px] text-muted-foreground">{formatBytes(doc.sizeBytes)}</span>
                  {doc.transactionId && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-ink"
                      title="Attached to a ledger record"
                    >
                      <Link2 className="size-3" aria-hidden="true" />
                      Linked
                    </span>
                  )}
                </div>
                {doc.notes && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{doc.notes}</p>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Uploaded {formatDate(doc.uploadedAt)} · Keep until {formatDate(doc.retentionUntil)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <RowActions doc={doc} setDocToDelete={setDocToDelete} onDownloadFailed={notifyDownloadFailed} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DesktopDocumentTable({ documents, isLoading, setDocToDelete }: DocumentListProps) {
  const { showToast } = useAppUi()
  const notifyDownloadFailed = () => showToast('The document could not be downloaded.', 'Download Failed', 'error')

  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
          <th scope="col" className="px-3 py-2.5 font-bold">Document</th>
          <th scope="col" className="px-3 py-2.5 font-bold">Type</th>
          <th scope="col" className="px-3 py-2.5 font-bold">Tax Year</th>
          <th scope="col" className="px-3 py-2.5 font-bold">Size</th>
          <th scope="col" className="px-3 py-2.5 font-bold">Uploaded</th>
          <th scope="col" className="px-3 py-2.5 text-right font-bold">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {isLoading && documents.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-3"><Skeleton className="h-4 w-56" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-12" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
              <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-3"><Skeleton className="ml-auto h-7 w-16" /></td>
            </tr>
          ))
        ) : documents.length === 0 ? (
          <tr>
            <td colSpan={6}><EmptyState /></td>
          </tr>
        ) : (
          documents.map(doc => {
            const Icon = iconFor(doc.contentType)
            return (
              <tr key={doc.id} className="transition-colors hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 max-w-[22rem]">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-bold text-foreground" title={doc.originalFileName}>
                          {doc.originalFileName}
                        </p>
                        {doc.transactionId && (
                          <Link2
                            className="size-3 shrink-0 text-accent-ink"
                            aria-label="Attached to a ledger record"
                          />
                        )}
                      </div>
                      {doc.notes && (
                        <p className="truncate text-[11px] text-muted-foreground" title={doc.notes}>
                          {doc.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5"><DocumentTypeBadge documentType={doc.documentType} /></td>
                <td className="px-3 py-2.5 font-bold text-foreground tabular-nums">{doc.taxYear}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatBytes(doc.sizeBytes)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div className="whitespace-nowrap">{formatDate(doc.uploadedAt)}</div>
                  <div className="whitespace-nowrap text-[10px]">Keep until {formatDate(doc.retentionUntil)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <RowActions doc={doc} setDocToDelete={setDocToDelete} onDownloadFailed={notifyDownloadFailed} />
                  </div>
                </td>
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )
}

// Renders exactly one layout rather than mounting both and CSS-hiding one, matching
// LedgerTransactionList. 1024px is the same breakpoint the ledger switches at.
export function DocumentList(props: DocumentListProps) {
  const isMobile = useIsMobile(1024)
  return isMobile ? <MobileDocumentList {...props} /> : <DesktopDocumentTable {...props} />
}
