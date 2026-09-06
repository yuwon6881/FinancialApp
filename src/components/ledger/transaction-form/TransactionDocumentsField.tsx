import { Button } from '../../ui/Button'
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FileText, Link2Off, UploadCloud, X } from 'lucide-react'
import {
  type PendingVaultDocument,
  type TaxReliefCategoryDefinition,
  type TransactionDocumentChanges,
  type VaultDocument,
} from '../../../types'
import { getDocumentConstraints, getTaxReliefCategories } from '../../../lib/api/documents'
import { formatCurrencyVal } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'

import {
  FALLBACK_DOCUMENT_CONSTRAINTS,
  UNSUPPORTED_DOCUMENT_TYPE_MESSAGE,
  buildDocumentAcceptAttribute,
  formatUploadMegabytes,
  isSupportedDocumentUpload,
  normalizeDocumentConstraints,
  oversizeUploadMessage,
} from '../../../lib/documentUploadTypes'

interface PendingDocument extends PendingVaultDocument {
  previewUrl: string | null
}

export interface TransactionDocumentsFieldRef {
  getChanges: () => TransactionDocumentChanges
  getValidationError: () => string | null
  reset: () => void
}

interface TransactionDocumentsFieldProps {
  existingDocuments?: VaultDocument[]
  initialChanges?: TransactionDocumentChanges
  disabled?: boolean
  defaultTaxYear: number
  transactionAmount: string
  currency: string
}

const LABEL_CLASS = 'text-eyebrow uppercase text-muted-foreground'
const parseTransactionAmount = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const amount = Number(trimmed)
  return Number.isFinite(amount) ? Math.abs(amount) : undefined
}

export const TransactionDocumentsField = React.forwardRef<
  TransactionDocumentsFieldRef,
  TransactionDocumentsFieldProps
>(({ existingDocuments = [], initialChanges, disabled = false, defaultTaxYear, transactionAmount, currency }, ref) => {
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>(() =>
    (initialChanges?.pending ?? []).map(document => ({
      ...document,
      previewUrl: document.file.type.startsWith('image/') ? URL.createObjectURL(document.file) : null,
    })))
  const [unlinkIds, setUnlinkIds] = useState<number[]>(() => [...(initialChanges?.unlinkIds ?? [])])
  const [reliefCategories, setReliefCategories] = useState<TaxReliefCategoryDefinition[]>([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [categoryLoadFailed, setCategoryLoadFailed] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  // The vault sheet checks size and type against what the server advertises; this picker used the
  // hard-coded fallback list and no size check at all, so an oversized or newly-disallowed receipt
  // was accepted here and only rejected when the whole transaction was saved.
  const [constraints, setConstraints] = useState(FALLBACK_DOCUMENT_CONSTRAINTS)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocsRef = useRef<PendingDocument[]>([])

  useEffect(() => {
    let active = true
    void getDocumentConstraints()
      .then(loaded => {
        if (active) setConstraints(normalizeDocumentConstraints(loaded))
      })
      .catch(() => {
        if (active) setConstraints(FALLBACK_DOCUMENT_CONSTRAINTS)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    pendingDocsRef.current = pendingDocs
  }, [pendingDocs])

  useEffect(() => {
    let active = true
    setCategoriesLoaded(false)
    setCategoryLoadFailed(false)
    void getTaxReliefCategories(defaultTaxYear)
      .then(categories => {
        if (!active) return
        setReliefCategories(categories)
        setPendingDocs(current => current.map(document => (
          document.reliefCategory && categories.some(category => category.id === document.reliefCategory)
            ? document
            : { ...document, reliefCategory: '' }
        )))
      })
      .catch(() => {
        if (!active) return
        setReliefCategories([])
        setCategoryLoadFailed(true)
      })
      .finally(() => {
        if (active) setCategoriesLoaded(true)
      })
    return () => {
      active = false
    }
  }, [defaultTaxYear])

  useImperativeHandle(
    ref,
    () => ({
      getChanges: () => ({
        // The transaction posting date is authoritative, even when the date was
        // changed after a file was attached.
        pending: pendingDocs.map(({ file, reliefCategory, amount, amountCurrency }) => ({
          file,
          taxYear: defaultTaxYear,
          reliefCategory,
          amount,
          amountCurrency,
        })),
        unlinkIds,
      }),
      getValidationError: () => {
        const unsupported = pendingDocs.find(document =>
          !isSupportedDocumentUpload(document.file, constraints.acceptedUploadTypes))
        if (unsupported) return `${unsupported.file.name}: ${UNSUPPORTED_DOCUMENT_TYPE_MESSAGE}`
        // Re-checked on save as well as on attach: a file picked before the advertised limits
        // arrived was measured against the fallback.
        const oversized = pendingDocs.find(document => document.file.size > constraints.maxDocumentBytes)
        if (oversized) return oversizeUploadMessage(oversized.file.name, constraints.maxDocumentBytes)
        const missingCategory = pendingDocs.find(document => !document.reliefCategory)
        if (missingCategory) return `Choose a tax relief category for ${missingCategory.file.name}.`
        if (pendingDocs.length > 0 && (!categoriesLoaded || categoryLoadFailed)) {
          return 'Tax relief categories could not be loaded. Try again before saving the transaction.'
        }
        return null
      },
      reset: () => {
        pendingDocs.forEach(document => {
          if (document.previewUrl) URL.revokeObjectURL(document.previewUrl)
        })
        setPendingDocs([])
        setUnlinkIds([])
      },
    }),
    [categoriesLoaded, categoryLoadFailed, constraints, defaultTaxYear, pendingDocs, unlinkIds],
  )

  useEffect(() => () => {
    pendingDocsRef.current.forEach(document => {
      if (document.previewUrl) URL.revokeObjectURL(document.previewUrl)
    })
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return

    const selected = Array.from(event.target.files)
    // The accept attribute is only a hint the OS dialog lets the user override, so the type has to
    // be checked here too. Refusing at attach time beats listing a file that only fails on save.
    const unsupported = selected.filter(file => !isSupportedDocumentUpload(file, constraints.acceptedUploadTypes))
    if (unsupported.length > 0) {
      setAttachError(`${unsupported.map(file => file.name).join(', ')}: ${UNSUPPORTED_DOCUMENT_TYPE_MESSAGE}`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const oversized = selected.find(file => file.size > constraints.maxDocumentBytes)
    if (oversized) {
      setAttachError(oversizeUploadMessage(oversized.name, constraints.maxDocumentBytes))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setAttachError(null)

    const newDocs: PendingDocument[] = selected.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      taxYear: defaultTaxYear,
      reliefCategory: '',
      amount: parseTransactionAmount(transactionAmount),
      amountCurrency: currency.toUpperCase() === 'MYR' ? 'MYR' : 'OTHER',
    }))
    setPendingDocs(previous => [...previous, ...newDocs])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    const amount = parseTransactionAmount(transactionAmount)
    const amountCurrency = currency.toUpperCase() === 'MYR' ? 'MYR' : 'OTHER'
    setPendingDocs(current => current.map(document => ({ ...document, amount, amountCurrency })))
  }, [transactionAmount, currency])

  const updatePending = (index: number, patch: Partial<PendingVaultDocument>) => {
    setPendingDocs(previous => previous.map((document, itemIndex) => (
      itemIndex === index ? { ...document, ...patch } : document
    )))
  }

  const removePending = (index: number) => {
    setPendingDocs(previous => {
      const document = previous[index]
      if (document?.previewUrl) URL.revokeObjectURL(document.previewUrl)
      return previous.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const visibleExisting = existingDocuments.filter(document => !unlinkIds.includes(document.id))
  const categoryOptions = [
    { value: '', label: categoriesLoaded ? 'Choose tax relief category' : 'Loading categories…' },
    ...reliefCategories.map(category => ({ value: category.id, label: `${category.name} · ${formatCurrencyVal(category.limit, currency)}` })),
  ]

  if (disabled && visibleExisting.length === 0 && pendingDocs.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Documents</span>
        <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
          Document uploads are unavailable while offline.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL_CLASS}>Documents</span>

      {visibleExisting.map(document => {
        const categoryName = reliefCategories.find(category => category.id === document.reliefCategory)?.name
          ?? document.reliefCategory
          ?? 'Choose tax relief category'
        return (
          <div key={document.id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 shadow-[var(--app-shadow-soft)]">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink ring-1 ring-accent/30">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Button variant="tertiary"
                type="button"
                onClick={() => {
                  void import('../../../lib/api/documents').then(({ downloadDocument }) =>
                    downloadDocument(document.id, document.originalFileName))
                }}
                className="block max-w-full cursor-pointer truncate text-left text-xs font-bold text-accent-ink hover:underline"
                title={`Download ${document.originalFileName}`}
              >
                {document.originalFileName}
              </Button>
              <p className="truncate text-xs text-muted-foreground" title={categoryName}>
                {categoryName} · YA {document.taxYear}
              </p>
            </div>
            <Button variant="tertiary"
              type="button"
              onClick={() => setUnlinkIds(ids => [...ids, document.id])}
              disabled={disabled}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              title="Detach from this transaction (the document stays in your vault)"
              aria-label={`Detach ${document.originalFileName} from this transaction`}
            >
              <Link2Off className="size-3.5" />
              <span className="hidden text-xs font-bold sm:inline">Detach</span>
            </Button>
          </div>
        )
      })}

      {unlinkIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {unlinkIds.length} document{unlinkIds.length === 1 ? '' : 's'} will be detached on save. They stay in your Document Vault.
        </p>
      )}

      {pendingDocs.map((document, index) => (
        <div key={`${document.file.name}-${index}`} className="relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-sm shadow-primary/5">
          <div className="flex items-center gap-2.5">
            {document.previewUrl ? (
              <img src={document.previewUrl} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
                <FileText className="size-4" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground" title={document.file.name}>{document.file.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">Uploads on save · {(document.file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <Button variant="tertiary"
              type="button"
              onClick={() => removePending(index)}
              aria-label={`Remove ${document.file.name}`}
              className="cursor-pointer rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <FormField
            label="Tax relief category"
            required
            error={!document.reliefCategory ? 'Choose a tax relief category before saving this transaction.' : undefined}
          >
            <CustomSelect
              value={document.reliefCategory}
              ariaLabel={`Tax relief category for ${document.file.name}`}
              onChange={value => updatePending(index, { reliefCategory: String(value) })}
              options={categoryOptions}
              className="w-full"
              disabled={!categoriesLoaded || reliefCategories.length === 0}
              required
              invalid={!document.reliefCategory}
            />
          </FormField>
        </div>
      ))}

      <Button variant="tertiary"
        type="button"
        disabled={disabled || !categoriesLoaded || reliefCategories.length === 0}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/60 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud className="size-4" aria-hidden="true" />
        Attach Document
      </Button>
      {!disabled && (
        <p className="text-center text-xs text-muted-foreground">
          Photo or PDF · up to {formatUploadMegabytes(constraints.maxDocumentBytes)} each
        </p>
      )}
      <Input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        accept={buildDocumentAcceptAttribute(constraints.acceptedUploadTypes)}
        onChange={handleFileChange}
      />
      {attachError && <p className="text-center text-xs text-destructive" role="alert">{attachError}</p>}
      {disabled && <p className="text-center text-xs text-muted-foreground">Attachments are unavailable while offline.</p>}
      {!disabled && categoriesLoaded && reliefCategories.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {categoryLoadFailed
            ? 'Tax relief categories could not be loaded. Try again before attaching a document.'
            : 'Add a tax relief category in the Document Vault before attaching documents.'}
        </p>
      )}
    </div>
  )
})

TransactionDocumentsField.displayName = 'TransactionDocumentsField'
