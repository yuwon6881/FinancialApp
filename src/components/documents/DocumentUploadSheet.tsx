import { Input } from '../ui/Input'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileText, UploadCloud, X, XCircle } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { compressImageFile } from '../../lib/imageCompression'
import { getErrorMessage } from '../../lib/errors'
import { buildMutationSuccessToast } from '../../lib/mutationToast'
import * as api from '../../lib/api/documents'
import { useAppUi } from '../../contexts/AppContext'
import { formatCurrencyVal } from '../../lib/utils'
import type { DocumentVaultConstraints, TaxReliefCategoryDefinition } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialTaxYear?: number
  defaultTransactionId?: string
  currency: string
}

const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground'
const FALLBACK_CONSTRAINTS: DocumentVaultConstraints = { maxDocumentBytes: 20 * 1024 * 1024, maxBulkDocuments: 10, maxTotalBytesPerUser: 2 * 1024 * 1024 * 1024 }
const TAX_YEAR_LOOKBACK = 7
const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

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
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useAppUi()

  useEffect(() => {
    if (!isOpen) return
    setFiles([])
    setTaxYear(String(safeInitialTaxYear))
    setReliefCategory('')
    setResults(null)
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
    const limited = selected.slice(0, constraints.maxBulkDocuments)
    setIsPreparing(true)
    try {
      const prepared = await Promise.all(limited.map(file =>
        file.size > constraints.maxDocumentBytes ? Promise.resolve(file) : compressImageFile(file, { maxEdge: 2000, quality: 0.8 })))
      setFiles(prepared)
      if (selected.length > constraints.maxBulkDocuments) {
        showToast(`Only the first ${constraints.maxBulkDocuments} documents were selected.`, 'Bulk Limit', 'info')
      }
    } finally {
      setIsPreparing(false)
    }
  }

  const upload = async () => {
    if (files.length === 0 || !reliefCategory || isPreparing) return
    const selectedTaxYear = Number(taxYear)
    if (!Number.isInteger(selectedTaxYear) || selectedTaxYear < minimumTaxYear || selectedTaxYear > currentYear) {
      showToast(`Choose a tax year from ${minimumTaxYear} to ${currentYear}.`, 'Invalid tax year', 'error')
      return
    }
    if (reliefCategory && !reliefCategories.some(category => category.id === reliefCategory)) {
      showToast('Choose a valid category for the selected tax year.', 'Category unavailable', 'error')
      return
    }
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
        const copy = buildMutationSuccessToast({
          entity: 'Documents',
          action: 'Added',
          message: `${successCount} document${successCount === 1 ? '' : 's'} were added. Review the extracted amount${successCount === 1 ? '' : 's'} in the Vault.`,
        })
        showToast(copy.message, copy.title, copy.tone)
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'The documents could not be uploaded.'), 'Upload Failed', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const failedCount = results?.filter(result => !result.uploaded).length ?? 0
  const taxYearOptions = Array.from({ length: TAX_YEAR_LOOKBACK + 1 }, (_, index) => currentYear - index)
    .map(year => ({ value: String(year), label: String(year) }))

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-2xl"
      title={<span className="flex items-center gap-2"><UploadCloud className="size-4" />Upload tax documents</span>}
      footer={<div className="flex justify-end gap-3">
        <Button variant="outline" type="button" onClick={onClose} className="rounded-xl px-4 py-2">{results ? 'Done' : 'Cancel'}</Button>
        {!results && <Button type="button" onClick={upload} disabled={files.length === 0 || !reliefCategory || isPreparing || isUploading}
          className="rounded-xl px-5 py-2">
          {isPreparing ? 'Preparing…' : isUploading ? 'Uploading and reading amounts…' : `Upload ${files.length || ''}`}
        </Button>}
      </div>}>
      <div className="space-y-4">
        {results ? (
          <div className="space-y-3" role="status">
            <div className={`rounded-xl border p-3 ${failedCount ? 'border-amber-500/30 bg-amber-500/8' : 'border-emerald-500/30 bg-emerald-500/8'}`}>
              <p className="text-sm font-bold text-foreground">{results.filter(result => result.uploaded).length} saved · {failedCount} failed</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Successful files remain in your Vault. AI amounts require your review.</p>
            </div>
            {results.map(result => <div key={result.fileName} className="flex items-start gap-2 rounded-xl border border-border/60 p-3">
              {result.uploaded ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" /> : <XCircle className="mt-0.5 size-4 text-destructive" />}
              <div className="min-w-0"><p className="truncate text-xs font-bold">{result.fileName}</p>
                <p className="text-[10px] text-muted-foreground">{result.uploaded ? 'Saved. Amount extraction is ready for review.' : result.message || 'Upload failed.'}</p></div>
            </div>)}
          </div>
        ) : <>
          <div>
            <span className={LABEL_CLASS}>Documents</span>
            <Button variant="unstyled" type="button" onClick={() => inputRef.current?.click()} className="mt-1.5 flex w-full flex-col items-center rounded-xl border-2 border-dashed border-border px-4 py-7 hover:bg-muted/40 cursor-pointer">
              <UploadCloud className="mb-2 size-8 text-muted-foreground/60" /><span className="text-xs font-bold text-foreground">Choose one or multiple files</span>
              <span className="mt-1 text-[10px] text-muted-foreground">Up to {constraints.maxBulkDocuments} files · {formatMb(constraints.maxDocumentBytes)} each</span>
            </Button>
            <Input ref={inputRef} type="file" multiple={!defaultTransactionId} className="hidden"
              accept="image/*,.pdf,application/pdf,.xml,application/xml,.json,application/json"
              onChange={event => void chooseFiles(Array.from(event.target.files ?? []))} />
          </div>
          {files.length > 0 && <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {files.map((file, index) => {
              const tooLarge = file.size > constraints.maxDocumentBytes
              return <div key={`${file.name}-${index}`} className={`flex items-center gap-2 rounded-lg border p-2 ${tooLarge ? 'border-destructive/40 bg-destructive/5' : 'border-border/60'}`}>
                <FileText className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold">{file.name}</p><p className={`text-[10px] ${tooLarge ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatMb(file.size)}{tooLarge ? ` · exceeds ${formatMb(constraints.maxDocumentBytes)}` : ''}</p></div>
                <Button variant="unstyled" type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} className="cursor-pointer hover:bg-muted/50 p-1.5 rounded-lg transition-colors"><X className="size-4" /></Button>
              </div>
            })}
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className={LABEL_CLASS}>Tax year</span>
              <CustomSelect value={taxYear} onChange={value => setTaxYear(String(value))} options={taxYearOptions} ariaLabel="Tax year" className="w-full" /></label>
          </div>
            <label className="space-y-1.5"><span className={LABEL_CLASS}>Tax relief category <span className="text-destructive">*</span></span>
            <CustomSelect value={reliefCategory} onChange={value => setReliefCategory(String(value))}
              options={[{ value: '', label: 'Choose tax relief category' }, ...reliefCategories.map(category => ({ value: category.id, label: `${category.name} · ${formatCurrencyVal(category.limit, currency)}` }))]}
              ariaLabel="Tax relief category" className="w-full" required invalid={files.length > 0 && !reliefCategory}
              disabled={categoriesLoading || reliefCategories.length === 0} /></label>
          {files.length > 0 && !categoriesLoading && reliefCategories.length === 0 && (
            <p className="-mt-2 text-[10px] leading-relaxed text-muted-foreground">
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
