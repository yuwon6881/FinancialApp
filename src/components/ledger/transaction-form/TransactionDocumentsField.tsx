import React, { lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import {
  type PendingVaultDocument,
  type TaxReliefCategoryDefinition,
  type TransactionDocumentChanges,
  type VaultDocument,
} from '../../../types'
import { getDocumentConstraints, getTaxReliefCategories } from '../../../lib/api/documents'
import { useAppPrefs } from '../../../contexts/AppContext'
import { cn, formatCurrencyVal } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { FiledDocumentRow, StagedDocumentRow } from './TransactionDocumentRows'

import {
  FALLBACK_DOCUMENT_CONSTRAINTS,
  UNSUPPORTED_DOCUMENT_TYPE_MESSAGE,
  buildDocumentAcceptAttribute,
  formatUploadMegabytes,
  isSupportedDocumentUpload,
  normalizeDocumentConstraints,
  oversizeUploadMessage,
} from '../../../lib/documentUploadTypes'

// The preview pulls in the PDF renderer; the form only pays for it when a document is opened.
const DocumentPreviewSheet = lazy(() =>
  import('../../documents/view/DocumentPreviewSheet').then(module => ({ default: module.DocumentPreviewSheet })))

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

const LABEL_CLASS = 'text-label font-medium text-muted-foreground'
const parseTransactionAmount = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const amount = Number(trimmed)
  return Number.isFinite(amount) ? Math.abs(amount) : undefined
}

/**
 * The category a newly picked file starts with. A single category leaves nothing to choose, and a
 * second receipt for the same purchase almost always counts where the first one did, so it starts
 * there; otherwise it starts empty and the save asks for it.
 */
function suggestedCategory(categories: TaxReliefCategoryDefinition[], pending: PendingDocument[]): string {
  if (categories.length === 1) return categories[0].id
  const previous = [...pending].reverse().find(document => document.reliefCategory)?.reliefCategory
  return previous && categories.some(category => category.id === previous) ? previous : ''
}

export const TransactionDocumentsField = React.forwardRef<
  TransactionDocumentsFieldRef,
  TransactionDocumentsFieldProps
>(({ existingDocuments = [], initialChanges, disabled = false, defaultTaxYear, transactionAmount, currency }, ref) => {
  const { hideSensitive } = useAppPrefs()
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
  // A missing category is only an error once the user tries to save. Flagging it the moment a file
  // was picked put a red message under something the user had not finished doing yet.
  const [showCategoryErrors, setShowCategoryErrors] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<VaultDocument | null>(null)
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
        setPendingDocs(current => current.map(document => {
          if (document.reliefCategory && categories.some(category => category.id === document.reliefCategory)) return document
          return { ...document, reliefCategory: categories.length === 1 ? categories[0].id : '' }
        }))
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
        if (missingCategory) {
          setShowCategoryErrors(true)
          return `Choose a tax relief category for ${missingCategory.file.name}.`
        }
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
        setShowCategoryErrors(false)
      },
    }),
    [categoriesLoaded, categoryLoadFailed, constraints, defaultTaxYear, pendingDocs, unlinkIds],
  )

  useEffect(() => () => {
    pendingDocsRef.current.forEach(document => {
      if (document.previewUrl) URL.revokeObjectURL(document.previewUrl)
    })
  }, [])

  const addFiles = (selected: File[]) => {
    if (selected.length === 0) return
    // The accept attribute is only a hint the OS dialog lets the user override, and a drop ignores
    // it entirely, so the type has to be checked here. Refusing at attach time beats listing a file
    // that only fails on save.
    const unsupported = selected.filter(file => !isSupportedDocumentUpload(file, constraints.acceptedUploadTypes))
    if (unsupported.length > 0) {
      setAttachError(`${unsupported.map(file => file.name).join(', ')}: ${UNSUPPORTED_DOCUMENT_TYPE_MESSAGE}`)
      return
    }
    const oversized = selected.find(file => file.size > constraints.maxDocumentBytes)
    if (oversized) {
      setAttachError(oversizeUploadMessage(oversized.name, constraints.maxDocumentBytes))
      return
    }
    setAttachError(null)

    setPendingDocs(previous => [
      ...previous,
      ...selected.map(file => ({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        taxYear: defaultTaxYear,
        reliefCategory: suggestedCategory(reliefCategories, previous),
        amount: parseTransactionAmount(transactionAmount),
        amountCurrency: currency.toUpperCase() === 'MYR' ? 'MYR' as const : 'OTHER' as const,
      })),
    ])
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []))
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

  const categoryOptions = [
    { value: '', label: categoriesLoaded ? 'Choose tax relief category' : 'Loading categories…', disabled: true },
    ...reliefCategories.map(category => ({ value: category.id, label: `${category.name} · ${formatCurrencyVal(category.limit, currency)}` })),
  ]
  const canAttach = !disabled && categoriesLoaded && reliefCategories.length > 0
  const hasRows = existingDocuments.length > 0 || pendingDocs.length > 0
  const attachedCount = existingDocuments.length - unlinkIds.length + pendingDocs.length

  if (disabled && !hasRows) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Documents</span>
        <p className="rounded-control bg-surface-2/70 px-3 py-3 text-center text-caption text-muted-foreground">
          Document uploads are unavailable while offline.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={LABEL_CLASS}>Documents</span>
        {attachedCount > 0 && (
          <span className="text-caption text-muted-foreground tabular-nums">{attachedCount} attached</span>
        )}
      </div>

      {hasRows && (
        <ul aria-label="Attached documents" className="divide-y divide-border/60 overflow-hidden rounded-control bg-surface-2/50 ring-1 ring-border/60 dark:bg-surface-2/70">
          {existingDocuments.map(document => (
            <FiledDocumentRow
              key={document.id}
              document={document}
              categoryName={reliefCategories.find(category => category.id === document.reliefCategory)?.name ?? document.reliefCategory ?? undefined}
              currency={currency}
              masked={Boolean(hideSensitive)}
              isDetaching={unlinkIds.includes(document.id)}
              disabled={disabled}
              onPreview={() => setPreviewDocument(document)}
              onDetach={() => setUnlinkIds(ids => [...ids, document.id])}
              onUndoDetach={() => setUnlinkIds(ids => ids.filter(id => id !== document.id))}
            />
          ))}
          {pendingDocs.map((document, index) => (
            <StagedDocumentRow
              key={`${document.file.name}-${index}`}
              file={document.file}
              previewUrl={document.previewUrl}
              reliefCategory={document.reliefCategory}
              categoryOptions={categoryOptions}
              categoriesReady={categoriesLoaded && reliefCategories.length > 0}
              showError={showCategoryErrors}
              onCategoryChange={value => updatePending(index, { reliefCategory: value })}
              onRemove={() => removePending(index)}
            />
          ))}
        </ul>
      )}

      {/* One target for both ways in: tapping opens the picker, and on a desktop a file can be
          dropped onto it. The size rule sits inside it, where the eye already is. */}
      <div
        onDragOver={event => {
          if (!canAttach) return
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={event => {
          if (!canAttach) return
          event.preventDefault()
          setIsDragging(false)
          addFiles(Array.from(event.dataTransfer.files ?? []))
        }}
      >
        <Button
          variant="tertiary"
          disabled={!canAttach}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full min-h-14 justify-start gap-3 rounded-control border border-dashed border-border px-3 py-2.5 text-left hover:border-foreground/30 hover:bg-surface-2',
            isDragging && 'border-primary bg-primary/8 hover:bg-primary/8',
          )}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-muted-foreground dark:bg-surface-3">
            <UploadCloud className="size-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-body font-medium text-foreground">
              {isDragging ? 'Drop to attach' : hasRows ? 'Attach another document' : 'Attach a receipt or invoice'}
            </span>
            <span className="block text-caption font-normal text-muted-foreground">
              Photo or PDF · up to {formatUploadMegabytes(constraints.maxDocumentBytes)} each
            </span>
          </span>
        </Button>
      </div>
      <Input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        accept={buildDocumentAcceptAttribute(constraints.acceptedUploadTypes)}
        onChange={handleFileChange}
      />
      {attachError && <p className="text-caption text-destructive" role="alert">{attachError}</p>}
      {disabled && <p className="text-caption text-muted-foreground">Attachments are unavailable while offline.</p>}
      {!disabled && categoriesLoaded && reliefCategories.length === 0 && (
        <p className="text-caption text-muted-foreground">
          {categoryLoadFailed
            ? 'Tax relief categories could not be loaded. Try again before attaching a document.'
            : 'Add a tax relief category in the Vault before attaching documents.'}
        </p>
      )}

      {previewDocument && (
        <Suspense fallback={null}>
          <DocumentPreviewSheet document={previewDocument} onClose={() => setPreviewDocument(null)} />
        </Suspense>
      )}
    </div>
  )
})

TransactionDocumentsField.displayName = 'TransactionDocumentsField'
