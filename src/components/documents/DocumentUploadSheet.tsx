import React, { useState, useRef, useEffect } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { compressImageFile } from '../../lib/imageCompression'
import { getErrorMessage } from '../../lib/errors'
import * as api from '../../lib/api'
import { FileText, UploadCloud, X } from 'lucide-react'
import { useAppUi } from '../../contexts/AppContext'
import { VAULT_DOCUMENT_TYPES, type VaultDocumentType } from '../../types'

interface DocumentUploadSheetProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialTaxYear?: number
  defaultTransactionId?: string
}

const FIELD_CLASS =
  'w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 transition'

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground'

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

export function DocumentUploadSheet({
  isOpen,
  onClose,
  onSuccess,
  initialTaxYear,
  defaultTransactionId,
}: DocumentUploadSheetProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preparedFile, setPreparedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [taxYear, setTaxYear] = useState<string>(initialTaxYear?.toString() || new Date().getFullYear().toString())
  const [documentType, setDocumentType] = useState<VaultDocumentType>('Receipt')
  const [notes, setNotes] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [compressionInfo, setCompressionInfo] = useState<
    | { kind: 'compressed'; originalSize: number; compressedSize: number }
    | { kind: 'pass-through'; reason: string }
    | null
  >(null)
  const [isPreparing, setIsPreparing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const preparationIdRef = useRef(0)
  const { showToast } = useAppUi()

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setFile(null)
      setPreparedFile(null)
      setPreviewUrl(null)
      setTaxYear(initialTaxYear?.toString() || new Date().getFullYear().toString())
      setDocumentType('Receipt')
      setNotes('')
      setIsUploading(false)
      setCompressionInfo(null)
      setIsPreparing(false)
    }
  }, [isOpen, initialTaxYear])

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      const preparationId = ++preparationIdRef.current
      setFile(selected)
      setPreparedFile(null)
      setCompressionInfo(null)
      setIsPreparing(true)
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected))
      } else {
        setPreviewUrl(null)
      }

      const compressed = await compressImageFile(selected, { maxEdge: 2000, quality: 0.8 })
      if (preparationId !== preparationIdRef.current) return

      setPreparedFile(compressed)
      setCompressionInfo(
        compressed === selected
          ? { kind: 'pass-through', reason: getPassThroughReason(selected) }
          : { kind: 'compressed', originalSize: selected.size, compressedSize: compressed.size },
      )
      setIsPreparing(false)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setPreparedFile(null)
    setPreviewUrl(null)
    setCompressionInfo(null)
    setIsPreparing(false)
    preparationIdRef.current += 1
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async () => {
    if (!file || !preparedFile || isPreparing) return

    try {
      setIsUploading(true)
      await api.uploadDocument(
        preparedFile,
        parseInt(taxYear, 10),
        documentType,
        notes || undefined,
        defaultTransactionId,
      )
      showToast('Document saved to your vault.', 'Upload Complete', 'success')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'The document could not be uploaded.'), 'Upload Failed', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const isBusy = isPreparing || isUploading

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-lg"
      title={
        <div className="flex items-center gap-2 text-foreground">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-ink">
            <UploadCloud className="size-4" />
          </span>
          <span>Upload Document</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="cursor-pointer rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!preparedFile || isBusy}
            className="cursor-pointer rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreparing ? 'Preparing…' : isUploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* File selection */}
        <div className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>File</span>
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-8 text-center transition hover:border-ring/60 hover:bg-muted/40"
            >
              <UploadCloud className="mb-2 size-8 text-muted-foreground/60" aria-hidden="true" />
              <span className="text-xs font-bold text-foreground">Tap to choose a file</span>
              <span className="mt-1 text-[10px] text-muted-foreground">
                Images, PDF, XML or JSON · up to 20 MB
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-2.5">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">{formatMb(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                aria-label="Remove selected file"
                className="cursor-pointer rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {isPreparing && (
            <p className="text-[10px] text-muted-foreground">Preparing file…</p>
          )}
          {!isPreparing && compressionInfo?.kind === 'compressed' && (
            <p className="rounded-lg border border-border/40 bg-muted/40 px-2.5 py-2 text-[10px] text-muted-foreground">
              Compressed{' '}
              <span className="font-bold text-foreground tabular-nums">
                {formatMb(compressionInfo.originalSize)}
              </span>{' '}
              →{' '}
              <span className="font-bold text-accent-ink tabular-nums">
                {formatMb(compressionInfo.compressedSize)}
              </span>
            </p>
          )}
          {!isPreparing && compressionInfo?.kind === 'pass-through' && (
            <p className="text-[10px] text-muted-foreground">
              Stored unchanged ({compressionInfo.reason}).
            </p>
          )}

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,.pdf,application/pdf,.xml,application/xml,.json,application/json"
            onChange={handleFileChange}
          />
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>Tax Year</span>
            <input
              type="number"
              inputMode="numeric"
              min={1900}
              max={9999}
              value={taxYear}
              onChange={e => setTaxYear(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>Type</span>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value as VaultDocumentType)}
              className={`${FIELD_CLASS} cursor-pointer`}
            >
              {VAULT_DOCUMENT_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Notes (optional)</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Annual medical check-up receipt"
            maxLength={500}
            className={`${FIELD_CLASS} min-h-20 resize-y`}
          />
        </label>

        {defaultTransactionId && (
          <p className="rounded-lg border border-border/40 bg-muted/40 px-2.5 py-2 text-[10px] text-muted-foreground">
            This document will be attached to the selected ledger record.
          </p>
        )}
      </div>
    </BottomSheet>
  )
}

function getPassThroughReason(file: File): string {
  const lowerName = file.name.toLowerCase()
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) return 'PDF kept as the original'
  if (file.type.includes('heic') || file.type.includes('heif') || /\.(heic|heif)$/.test(lowerName))
    return 'HEIC cannot be compressed in the browser'
  if (file.type.includes('json') || lowerName.endsWith('.json')) return 'JSON kept as the original'
  if (file.type.includes('xml') || lowerName.endsWith('.xml')) return 'XML kept as the original'
  if (file.size <= 300 * 1024) return 'already under 300 KB'
  return 'original file retained'
}
