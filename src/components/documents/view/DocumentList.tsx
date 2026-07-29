import { Download, FileArchive, FileCode, FileImage, FileText, Link2, Trash2 } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { useAppUi } from '../../../contexts/AppContext'
import { Skeleton } from '../../ui/Skeleton'
import { formatBytes, formatDate } from './formatters'

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

export function DocumentList({ documents, isLoading, setDocToDelete }: DocumentListProps) {
  const { showToast } = useAppUi()
  const downloadFailed = () =>
    showToast('The document could not be downloaded.', 'Download Failed', 'error')

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
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
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index}>
                <td className="px-3 py-3"><Skeleton className="h-4 w-56" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-12" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-3 py-3"><Skeleton className="ml-auto h-7 w-16" /></td>
              </tr>
            ))
          ) : documents.length === 0 ? (
            <tr><td colSpan={6}><EmptyState /></td></tr>
          ) : documents.map(document => {
            const Icon = iconFor(document.contentType)
            return (
              <tr key={document.id} className="transition-colors hover:bg-muted/40">
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
                  <span className="inline-flex whitespace-nowrap rounded-md border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {document.documentType}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-bold text-foreground tabular-nums">{document.taxYear}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatBytes(document.sizeBytes)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div className="whitespace-nowrap">{formatDate(document.uploadedAt)}</div>
                  <div className="whitespace-nowrap text-[10px]">Keep until {formatDate(document.retentionUntil)}</div>
                </td>
                <td className="px-3 py-2.5">
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
