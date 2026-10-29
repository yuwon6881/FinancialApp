import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import * as api from '../../../lib/api/documents'
import { getErrorMessage } from '../../../lib/errors'
import { getCurrencySymbol } from '../../../lib/utils'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { Meter } from '../../ui/Meter'
import { ModalActions } from '../../ui/ModalActions'
import { DocumentPreviewPane } from './DocumentPreviewPane'
import { confidenceLabel, formatBytes, formatFileKind } from './formatters'
import type { UpdateDocumentFn } from './documentRowParts'

/**
 * What to review. With `documentIds` it is exactly those documents, whatever their status -- the
 * batch just uploaded. Without, it is every amount in the tax year the AI read and nobody has
 * confirmed yet.
 */
export interface DocumentReviewRequest {
  taxYear?: number
  documentIds?: number[]
}

interface DocumentReviewSheetProps {
  request: DocumentReviewRequest | null
  onClose: () => void
  currency: string
  /** Writes through the outbox, so a confirmation is instant, works offline, and can be undone. */
  saveReview: (document: VaultDocument, updates: Parameters<UpdateDocumentFn>[1]) => Promise<void>
}

const REVIEW_PAGE_SIZE = 100

async function loadQueue(request: DocumentReviewRequest): Promise<VaultDocument[]> {
  const page = await api.listDocuments(request.taxYear, undefined, 0, REVIEW_PAGE_SIZE, undefined, 'uploaded-desc')
  if (request.documentIds) {
    const byId = new Map(page.items.map(document => [document.id, document]))
    return request.documentIds.flatMap(id => byId.get(id) ?? [])
  }
  return page.items.filter(document => document.amountStatus === 'NeedsReview')
}

/**
 * One document at a time: the receipt on one side, the amount read from it and its relief category
 * on the other, already filled in. "Confirm" writes both and moves on, so checking a batch is a
 * glance and Enter per document, instead of finding each row and opening its editor.
 */
export function DocumentReviewSheet({ request, onClose, currency, saveReview }: DocumentReviewSheetProps) {
  const [queue, setQueue] = useState<VaultDocument[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [confirmed, setConfirmed] = useState(0)
  const [amount, setAmount] = useState('')
  const [reliefCategory, setReliefCategory] = useState('')
  const [categories, setCategories] = useState<TaxReliefCategoryDefinition[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!request) return
    let active = true
    setQueue(null)
    setLoadError(null)
    setIndex(0)
    setConfirmed(0)
    void loadQueue(request)
      .then(items => { if (active) setQueue(items) })
      .catch(err => { if (active) setLoadError(getErrorMessage(err, 'The documents to review could not be loaded.')) })
    return () => { active = false }
  }, [request])

  const current = queue?.[index] ?? null
  const currentYear = current?.taxYear

  useEffect(() => {
    if (!current) return
    setAmount(current.amount != null ? current.amount.toFixed(2) : '')
    setReliefCategory(current.reliefCategory ?? '')
    setError(null)
    // Focused and selected, so a wrong figure is replaced by typing and a right one kept with Enter.
    requestAnimationFrame(() => {
      amountRef.current?.focus()
      amountRef.current?.select()
    })
  }, [current])

  useEffect(() => {
    if (currentYear === undefined) return
    let active = true
    setCategories(null)
    void api.getTaxReliefCategories(currentYear)
      .then(loaded => { if (active) setCategories(loaded) })
      .catch(() => { if (active) setCategories([]) })
    return () => { active = false }
  }, [currentYear])

  const total = queue?.length ?? 0
  const isDone = queue !== null && index >= total

  const next = () => setIndex(value => value + 1)

  const confirm = async () => {
    if (!current || saving) return
    const trimmed = amount.trim()
    const value = Number(trimmed)
    if (trimmed === '' || !Number.isFinite(value) || value < 0) {
      setError(trimmed === '' ? 'Enter the amount on the receipt, or skip this one for now.' : 'Enter an amount of zero or more.')
      amountRef.current?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveReview(current, {
        amount: value,
        amountCurrency: currency.toUpperCase() === 'MYR' ? 'MYR' : 'OTHER',
        amountStatus: 'Confirmed',
        ...(reliefCategory && reliefCategory !== current.reliefCategory ? { reliefCategory } : {}),
      })
      setConfirmed(count => count + 1)
      next()
    } catch (err) {
      setError(getErrorMessage(err, 'That amount could not be saved. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const sure = current?.amountStatus === 'NeedsReview' ? confidenceLabel(current.amountConfidence) : null
  const aiNote = !current
    ? null
    : current.amountStatus === 'NeedsReview' && current.amount != null
      ? `Read by AI${sure ? ` · ${sure}` : ''}. Check it against the receipt.`
      : current.amountStatus === 'Confirmed'
        ? 'Already confirmed. Change it only if it is wrong.'
        : current.amountExtractionMessage || 'No amount could be read. Type it from the receipt.'

  const footer = isDone || !current ? (
    <ModalActions>
      <Button variant={isDone ? 'primary' : 'secondary'} onClick={onClose}>{isDone ? 'Done' : 'Close'}</Button>
    </ModalActions>
  ) : (
    <ModalActions>
      <Button variant="secondary" onClick={next} disabled={saving}>Skip for now</Button>
      <Button onClick={() => void confirm()} loading={saving}>
        {index === total - 1 ? 'Confirm' : 'Confirm & next'}
      </Button>
    </ModalActions>
  )

  return (
    <BottomSheet
      isOpen={request !== null}
      onClose={onClose}
      title="Check amounts"
      description={current && !isDone ? `${index + 1} of ${total}` : undefined}
      maxWidthClassName="max-w-5xl"
      footer={footer}
    >
      {loadError ? (
        <p role="alert" className="rounded-control bg-destructive/10 px-3 py-3 text-body text-destructive">{loadError}</p>
      ) : queue === null ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-caption font-semibold text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
          Finding documents to check…
        </div>
      ) : isDone || !current ? (
        <div className="flex flex-col items-center px-4 py-10 text-center" role="status">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <p className="text-subsection text-foreground">{total === 0 ? 'Nothing to check' : 'All caught up'}</p>
          <p className="mt-1 max-w-sm text-body text-muted-foreground">
            {total === 0
              ? 'Every amount in your Vault has been confirmed.'
              : `${confirmed} of ${total} confirmed.${total - confirmed > 0 ? ' Skipped ones stay marked for review.' : ''}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Meter size="sm" percent={(index / total) * 100} label="Review progress" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
            <div className="flex h-[36vh] min-h-56 overflow-hidden rounded-control ring-1 ring-border/60 lg:h-[58vh]">
              <DocumentPreviewPane key={current.id} document={current} />
            </div>
            <form
              noValidate
              className="flex min-w-0 flex-col gap-4"
              onSubmit={event => {
                event.preventDefault()
                void confirm()
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-foreground" title={current.originalFileName}>{current.originalFileName}</p>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {formatFileKind(current.contentType)} · {formatBytes(current.sizeBytes)} · YA {current.taxYear}
                </p>
              </div>
              {aiNote && (
                <p className="flex items-start gap-2 rounded-control inset-group px-3 py-2.5 text-caption text-muted-foreground dark:bg-surface-3/60">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                  {aiNote}
                </p>
              )}
              <FormField label={`Amount (${getCurrencySymbol(currency)})`} required error={error ?? undefined}>
                <Input
                  ref={amountRef}
                  value={amount}
                  onChange={event => { setAmount(event.target.value); setError(null) }}
                  onKeyDown={event => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    void confirm()
                  }}
                  inputMode="decimal"
                  aria-label={`Amount for ${current.originalFileName}`}
                  aria-invalid={error ? true : undefined}
                  className="text-callout font-semibold tabular-nums"
                />
              </FormField>
              <FormField label="Tax relief category">
                <CustomSelect
                  value={reliefCategory}
                  onChange={value => setReliefCategory(String(value))}
                  options={[
                    ...(reliefCategory ? [] : [{ value: '', label: categories ? 'Choose tax relief category' : 'Loading categories…', disabled: true }]),
                    ...(categories ?? []).map(category => ({ value: category.id, label: category.name })),
                  ]}
                  ariaLabel={`Tax relief category for ${current.originalFileName}`}
                  disabled={!categories || categories.length === 0}
                  className="w-full"
                />
              </FormField>
              <p className="hidden text-caption text-muted-foreground lg:block">Press Enter to confirm and move on.</p>
            </form>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
