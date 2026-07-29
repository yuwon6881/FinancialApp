import React, { useRef, useImperativeHandle, useState, useEffect } from 'react'
import { FileText, X, UploadCloud, Link2Off } from 'lucide-react'
import {
  type PendingVaultDocument,
  type TransactionDocumentChanges,
  type VaultDocument,
  type VaultDocumentTypeDefinition,
  type VaultDocumentType,
} from '../../../types'
import { CustomSelect } from '../../ui/CustomSelect'
import { listDocumentTypes } from '../../../lib/api/documents'

interface PendingDocument extends PendingVaultDocument {
  previewUrl: string | null
}

export interface TransactionDocumentsFieldRef {
  getChanges: () => TransactionDocumentChanges
  reset: () => void
}

interface TransactionDocumentsFieldProps {
  existingDocuments?: VaultDocument[]
  disabled?: boolean
  defaultTaxYear: number
}

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground'

export const TransactionDocumentsField = React.forwardRef<
  TransactionDocumentsFieldRef,
  TransactionDocumentsFieldProps
>(({ existingDocuments = [], disabled = false, defaultTaxYear }, ref) => {
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([])
  const [unlinkIds, setUnlinkIds] = useState<number[]>([])
  const [documentTypes, setDocumentTypes] = useState<VaultDocumentTypeDefinition[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocsRef = useRef<PendingDocument[]>([])

  // Mirrored into a ref via an effect rather than during render: writing a ref while
  // rendering is unsafe, and the React Compiler is enabled in this project.
  useEffect(() => {
    pendingDocsRef.current = pendingDocs
  }, [pendingDocs])

  useImperativeHandle(
    ref,
    () => ({
      getChanges: () => ({
        pending: pendingDocs.map(({ file, taxYear, documentType }) => ({ file, taxYear, documentType })),
        unlinkIds,
      }),
      reset: () => {
        pendingDocs.forEach(d => {
          if (d.previewUrl) URL.revokeObjectURL(d.previewUrl)
        })
        setPendingDocs([])
        setUnlinkIds([])
      },
    }),
    [pendingDocs, unlinkIds],
  )

  // Revoke any object URLs still alive when the form unmounts.
  useEffect(() => {
    return () => {
      pendingDocsRef.current.forEach(d => {
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    void listDocumentTypes()
      .then(setDocumentTypes)
      .catch(() => setDocumentTypes([]))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const newDocs: PendingDocument[] = Array.from(e.target.files).map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      taxYear: Math.max(new Date().getFullYear() - 7, Math.min(new Date().getFullYear(), defaultTaxYear)),
      documentType: (documentTypes[0]?.name ?? 'Receipt') as VaultDocumentType,
    }))

    setPendingDocs(prev => [...prev, ...newDocs])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Replaces the entry rather than mutating it in place — a mutated object keeps its
  // identity, so memoized children would not see the change.
  const updatePending = (index: number, patch: Partial<PendingVaultDocument>) => {
    setPendingDocs(prev => prev.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)))
  }

  const removePending = (index: number) => {
    setPendingDocs(prev => {
      const doc = prev[index]
      if (doc?.previewUrl) URL.revokeObjectURL(doc.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const visibleExisting = existingDocuments.filter(doc => !unlinkIds.includes(doc.id))

  if (disabled && visibleExisting.length === 0 && pendingDocs.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Documents</span>
        <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-3 text-center text-[11px] text-muted-foreground">
          Document uploads are unavailable while offline.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL_CLASS}>Documents</span>

      {/* Already attached */}
      {visibleExisting.map(doc => (
        <div
          key={doc.id}
          className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                void import('../../../lib/api/documents').then(({ downloadDocument }) =>
                  downloadDocument(doc.id, doc.originalFileName),
                )
              }}
              className="block max-w-full cursor-pointer truncate text-left text-xs font-bold text-accent-ink hover:underline"
              title={`Download ${doc.originalFileName}`}
            >
              {doc.originalFileName}
            </button>
            <p className="text-[10px] text-muted-foreground">
              {doc.documentType} · YA {doc.taxYear}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUnlinkIds(ids => [...ids, doc.id])}
            disabled={disabled}
            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
            title="Detach from this transaction (the document stays in your vault)"
            aria-label={`Detach ${doc.originalFileName} from this transaction`}
          >
            <Link2Off className="size-3.5" />
          </button>
        </div>
      ))}

      {unlinkIds.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {unlinkIds.length} document{unlinkIds.length === 1 ? '' : 's'} will be detached on save. They stay in
          your Document Vault.
        </p>
      )}

      {/* Queued for upload */}
      {pendingDocs.map((doc, i) => (
        <div
          key={`${doc.file.name}-${i}`}
          className="flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-2.5"
        >
          <div className="flex items-center gap-2.5">
            {doc.previewUrl ? (
              <img src={doc.previewUrl} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                <FileText className="size-4" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground" title={doc.file.name}>
                {doc.file.name}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                Uploads on save · {(doc.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => removePending(i)}
              aria-label={`Remove ${doc.file.name}`}
              className="cursor-pointer rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CustomSelect
              value={doc.taxYear}
              ariaLabel={`Tax year for ${doc.file.name}`}
              onChange={value => updatePending(i, { taxYear: Number(value) })}
              options={Array.from({ length: 8 }, (_, index) => {
                const year = new Date().getFullYear() - index
                return { value: year, label: `YA ${year}` }
              })}
              className="w-full"
            />
            <CustomSelect
              value={doc.documentType}
              ariaLabel={`Document type for ${doc.file.name}`}
              onChange={value => updatePending(i, { documentType: String(value) })}
              options={documentTypes.map(type => ({ value: type.name, label: type.name }))}
              className="w-full"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-ring/60 hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud className="size-4" aria-hidden="true" />
        Attach Document
      </button>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        accept="image/*,.pdf,application/pdf,.xml,application/xml,.json,application/json"
        onChange={handleFileChange}
      />
      {disabled && (
        <p className="text-center text-[10px] text-muted-foreground">
          Attachments are unavailable while offline.
        </p>
      )}
    </div>
  )
})

TransactionDocumentsField.displayName = 'TransactionDocumentsField'
