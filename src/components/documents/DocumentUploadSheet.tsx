import { Input } from '../ui/Input'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileText, UploadCloud, X, XCircle } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { CustomSelect } from '../ui/CustomSelect'
import { compressImageFile } from '../../lib/imageCompression'
import { getErrorMessage } from '../../lib/errors'
import { buildMutationSuccessToast, buildUndoSuccessToast } from '../../lib/mutationToast'
import * as api from '../../lib/api/documents'
import { useAppUi } from '../../contexts/AppContext'
import { formatCurrencyVal } from '../../lib/utils'
import type { DocumentVaultConstraints, TaxReliefCategoryDefinition } from '../../types'
import { FormField } from '../ui/FormField'
import { ModalActions } from '../ui/ModalActions'
import { mapServerErrorToField, type ServerFieldRule } from '../../lib/formErrors'
import { revealFirstFieldError } from '../ui/formValidation'

import {
  FALLBACK_ACCEPTED_UPLOAD_TYPES,
  UNSUPPORTED_DOCUMENT_TYPE_MESSAGE,
  buildDocumentAcceptAttribute,
  isSupportedDocumentUpload,
} from '../../lib/documentUploadTypes'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialTaxYear?: number
  defaultTransactionId?: string
  currency: string
}

const FALLBACK_CONSTRAINTS: DocumentVaultConstraints = {
  maxDocumentBytes: 20 * 1024 * 1024,
  maxBulkDocuments: 10,
  maxTotalBytesPerUser: 2 * 1024 * 1024 * 1024,
  acceptedUploadTypes: FALLBACK_ACCEPTED_UPLOAD_TYPES,
}
const TAX_YEAR_LOOKBACK = 7
const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
type UploadValidationErrors = { taxYear?: string; reliefCategory?: string; files?: string }

const UPLOAD_ERROR_RULES: ServerFieldRule<'taxYear' | 'reliefCategory' | 'files'>[] = [
  { field: 'taxYear', match: ['tax year must be between'] },
  { field: 'reliefCategory', match: ['tax relief category is required', 'category is not configured'] },
  { field: 'files', match: ['exceeds the maximum allowed size', 'unsupported file type', 'storage quota exceeded', 'upload a photo or a pdf'] },
]

export function DocumentUploadSheet({ isOpen, onClose, onSuccess, initialTaxYear, defaultTransactionId, currency }: Props) {
  const currentYear = new Date().getFullYear()
  const minimumTaxYear = currentYear - TAX_YEAR_LOOKBACK
  const safeInitialTaxYear = initialTaxYear !== undefined && Number.isInteger(initialTaxYear) && initialTaxYear >= minimumTaxYear && initialTaxYear <= currentYear
    ? initialTaxYear
    : currentYear
  const [files, setFiles] = useState<File[]>([])
  const [taxYear, setTaxYear] = useState(String(safeInitialTaxYear))
  const [reliefCategory, setReliefCategory] = useState('')
  const [reliefCategories, setReliefCategories] = useState<TaxReliefCategoryDefinition[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoryLoadFailed, setCategoryLoadFailed] = useState(false)
  const [constraints, setConstraints] = useState(FALLBACK_CONSTRAINTS)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<api.BulkDocumentResult[] | null>(null)
  const [validationErrors, setValidationErrors] = useState<UploadValidationErrors>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetBodyRef = useRef<HTMLDivElement>(null)
  const { showToast } = useAppUi()

  useEffect(() => {
    if (!isOpen) return
    setFiles([])
    setTaxYear(String(safeInitialTaxYear))
    setReliefCategory('')
    setResults(null)
    setValidationErrors({})
    api.getDocumentConstraints()
      .then(setConstraints)
      .catch(() => setConstraints(FALLBACK_CONSTRAINTS))
  }, [isOpen, safeInitialTaxYear])

  useEffect(() => {
    const year = Number(taxYear)
    if (!Number.isFinite(year)) return
    let active = true
    setReliefCategory('')
    setReliefCategories([])
    setCategoriesLoading(true)
    setCategoryLoadFailed(false)
    void api.getTaxReliefCategories(year)
      .then(categories => {
        if (active) setReliefCategories(categories)
      })
      .catch(() => {
        if (active) {
          setReliefCategories([])
          setCategoryLoadFailed(true)
        }
      })
      .finally(() => {
        if (active) setCategoriesLoading(false)
      })
    return () => { active = false }
  }, [taxYear])

  const chooseFiles = async (selected: File[]) => {
    setResults(null)
    setValidationErrors({})
    const unsupported = selected.find(file => !isSupportedDocumentUpload(file, constraints.acceptedUploadTypes))
    if (unsupported) {
      setValidationErrors({ files: UNSUPPORTED_DOCUMENT_TYPE_MESSAGE })
      revealFirstFieldError(sheetBodyRef)
      return
    }
    const limited = selected.slice(0, constraints.maxBulkDocuments)
    setIsPreparing(true)
    try {
      const prepared = await Promise.all(limited.map(file =>
        file.size > constraints.maxDocumentBytes
          ? compressImageFile(file, { maxEdge: 2000, quality: 0.8 })
          : Promise.resolve(file)))
      setFiles(prepared)
      if (selected.length > constraints.maxBulkDocuments) {
        showToast(`Only the first ${constraints.maxBulkDocuments} documents were selected.`, 'Bulk Limit', 'info')
      }
    } finally {
      setIsPreparing(false)
    }
  }

  const upload = async () => {
    if (isPreparing || isUploading) return
    const selectedTaxYear = Number(taxYear)
    const errors: UploadValidationErrors = {}
    if (files.length === 0) errors.files = 'Choose at least one document.'
    if (!Number.isInteger(selectedTaxYear) || selectedTaxYear < minimumTaxYear || selectedTaxYear > currentYear) {
      errors.taxYear = `Choose a tax year from ${minimumTaxYear} to ${currentYear}.`
    }
    if (!reliefCategory) {
      errors.reliefCategory = 'Choose a tax relief category before uploading.'
    } else if (!reliefCategories.some(category => category.id === reliefCategory)) {
      errors.reliefCategory = 'Choose a valid category for the selected tax year.'
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      revealFirstFieldError(sheetBodyRef)
      return
    }
    setValidationErrors({})
    setIsUploading(true)
    try {
      const uploadResults = defaultTransactionId && files.length === 1
        ? [await api.uploadDocument(files[0], selectedTaxYear, defaultTransactionId, undefined, reliefCategory || undefined)
            .then(value => ({ fileName: files[0].name, uploaded: true, id: value.id }))]
        : await api.uploadDocuments(files, selectedTaxYear, reliefCategory || undefined)
      setResults(uploadResults)
      const successCount = uploadResults.filter(result => result.uploaded).length
      if (successCount > 0) onSuccess()
      if (uploadResults.every(result => result.uploaded)) {
        const uploadedIds = uploadResults.flatMap(result => result.uploaded && typeof result.id === 'number' ? [result.id] : [])
        const copy = buildMutationSuccessToast({
          entity: 'Documents',
          action: 'Added',
          message: `${successCount} document${successCount === 1 ? '' : 's'} were added. Review the extracted amount${successCount === 1 ? '' : 's'} in the Vault.`,
        })
        showToast(copy.message, copy.title, copy.tone, uploadedIds.length === successCount ? {
          label: 'Undo',
          onAction: () => {
            void (async () => {
              if (typeof navigator !== 'undefined' && !navigator.onLine) {
                showToast('Undoing an upload needs a live connection because the stored files must be removed from the Vault.', 'Available online only', 'warning')
                return
              }
              try {
                await Promise.all(uploadedIds.map(id => api.deleteDocument(id)))
                onSuccess()
                const undoCopy = buildUndoSuccessToast(`${uploadedIds.length} document${uploadedIds.length === 1 ? '' : 's'}`, 'Vault upload')
                showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
              } catch (error) {
                showToast(getErrorMessage(error, 'The uploaded documents could not be removed.'), 'Undo Failed', 'error')
              }
            })()
          },
        } : undefined)
      }
    } catch (error) {
      // A rejected tax year or category is answerable inside the sheet; storage
      // and transport failures are not, so those still surface as a toast.
      const mapped = mapServerErrorToField(error, UPLOAD_ERROR_RULES)
      if (mapped) {
        setValidationErrors({ [mapped.field]: mapped.message })
        revealFirstFieldError(sheetBodyRef)
        return
      }
      showToast(getErrorMessage(error, 'The documents could not be uploaded.'), 'Upload Failed', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const failedCount = results?.filter(result => !result.uploaded).length ?? 0
  const taxYearOptions = Array.from({ length: TAX_YEAR_LOOKBACK + 1 }, (_, index) => currentYear - index)
    .map(year => ({ value: String(year), label: String(year) }))
  const reliefCategoryError = validationErrors.reliefCategory
    ?? (files.length > 0 && !categoriesLoading && reliefCategories.length > 0 && !reliefCategory
      ? 'Choose a tax relief category before uploading.'
      : undefined)

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-2xl"
      title={<span className="flex items-center gap-2"><UploadCloud className="size-4" />Upload tax documents</span>}
      footer={<ModalActions>
        <Button variant="secondary" type="button" onClick={onClose} className="rounded-xl px-4">{results ? 'Done' : 'Cancel'}</Button>
        {/* Deliberately not disabled on missing files/category: an inert button
            explains nothing, while submitting surfaces the reason on the field. */}
        {!results && <Button type="button" onClick={upload} disabled={isPreparing || isUploading}
          className="rounded-xl px-5 shadow-md">
          {isPreparing ? 'Preparing…' : isUploading ? 'Uploading and reading amounts…' : `Upload ${files.length || ''}`}
        </Button>}
      </ModalActions>}>
      <div className="space-y-4" ref={sheetBodyRef}>
        {results ? (
          <div className="space-y-3" role="status">
            <div className={`rounded-xl border p-3 ${failedCount ? 'border-amber-500/30 bg-amber-500/8' : 'border-emerald-500/30 bg-emerald-500/8'}`}>
              <p className="text-sm font-bold text-foreground">{results.filter(result => result.uploaded).length} saved · {failedCount} failed</p>
              <p className="mt-1 text-caption text-muted-foreground">Successful files remain in your Vault. AI amounts require your review.</p>
            </div>
            {results.map(result => <div key={result.fileName} className="flex items-start gap-2 rounded-xl border border-border/60 p-3">
              {result.uploaded ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" /> : <XCircle className="mt-0.5 size-4 text-destructive" />}
              <div className="min-w-0"><p className="truncate text-body font-bold">{result.fileName}</p>
                <p className="text-caption text-muted-foreground">{result.uploaded ? 'Saved. Amount extraction is ready for review.' : result.message || 'Upload failed.'}</p></div>
            </div>)}
          </div>
        ) : <>
          <FormField label="Documents" required error={validationErrors.files}>
            <Button variant="tertiary" type="button" onClick={() => inputRef.current?.click()} className="mt-1.5 flex w-full flex-col items-center rounded-xl border-2 border-dashed border-border px-4 py-7 hover:bg-muted/40 cursor-pointer">
              <UploadCloud className="mb-2 size-8 text-muted-foreground/60" /><span className="text-body font-bold text-foreground">Choose one or multiple files</span>
              <span className="mt-1 text-caption text-muted-foreground">Up to {constraints.maxBulkDocuments} files · {formatMb(constraints.maxDocumentBytes)} each</span>
            </Button>
            <Input ref={inputRef} type="file" multiple={!defaultTransactionId} className="hidden"
              accept={buildDocumentAcceptAttribute(constraints.acceptedUploadTypes)}
              onChange={event => void chooseFiles(Array.from(event.target.files ?? []))} />
          </FormField>
          {files.length > 0 && <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {files.map((file, index) => {
              const tooLarge = file.size > constraints.maxDocumentBytes
              return <div key={`${file.name}-${index}`} className={`flex items-center gap-2 rounded-lg border p-2 ${tooLarge ? 'border-destructive/40 bg-destructive/5' : 'border-border/60'}`}>
                <FileText className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold">{file.name}</p><p className={`text-caption ${tooLarge ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatMb(file.size)}{tooLarge ? ` · exceeds ${formatMb(constraints.maxDocumentBytes)}` : ''}</p></div>
                <IconButton type="button" label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} className="size-11 cursor-pointer rounded-lg transition-colors hover:bg-muted/50 sm:size-8"><X className="size-4" /></IconButton>
              </div>
            })}
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Tax year" error={validationErrors.taxYear}>
              <CustomSelect
                value={taxYear}
                onChange={value => {
                  setTaxYear(String(value))
                  setValidationErrors(current => ({ ...current, taxYear: undefined, reliefCategory: undefined }))
                }}
                options={taxYearOptions}
                ariaLabel="Tax year"
                className="w-full"
              />
            </FormField>
            <FormField label="Tax relief category" required error={reliefCategoryError}>
              <CustomSelect
                value={reliefCategory}
                onChange={value => {
                  setReliefCategory(String(value))
                  setValidationErrors(current => ({ ...current, reliefCategory: undefined }))
                }}
                options={[{ value: '', label: 'Choose tax relief category' }, ...reliefCategories.map(category => ({ value: category.id, label: `${category.name} · ${formatCurrencyVal(category.limit, currency)}` }))]}
                ariaLabel="Tax relief category"
                className="w-full"
                required
                invalid={Boolean(reliefCategoryError)}
                disabled={categoriesLoading || reliefCategories.length === 0}
              />
            </FormField>
          </div>
          {files.length > 0 && !categoriesLoading && reliefCategories.length === 0 && (
            <p className="-mt-2 text-caption leading-relaxed text-muted-foreground">
              {categoryLoadFailed
                ? 'Tax relief categories could not be loaded. Try again before uploading.'
                : 'Add a tax relief category in the Document Vault tracker before uploading.'}
            </p>
          )}
        </>}
      </div>
    </BottomSheet>
  )
}
