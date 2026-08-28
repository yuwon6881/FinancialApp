import { useEffect, useMemo, useRef, useState } from 'react'
import { Reorder } from 'framer-motion'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Paperclip, Plus } from 'lucide-react'
import type { Transaction, TransactionCategory, TransactionDocumentChanges } from '../types'
import { formatCurrencyVal } from '../lib/utils'
import { getDraftTransactionIssues } from '../lib/draftTransactionValidation'
import { useHighlightedElement } from './ui/useHighlightedElement'
import {
  TransactionFormSheet,
  type TransactionFormSheetProps,
  type TransactionFormSheetRef,
} from './ledger/TransactionFormSheet'
import { Button } from './ui/Button'
import { PageHeader } from './ui/PageHeader'
import { InfoHint } from './ui/InfoHint'
import { SensitiveMask } from './ui/SensitiveAmount'
import { DraftQueueCard } from './drafts/DraftQueueCard'
import { DraftReorderItem } from './drafts/DraftReorderItem'

type EditorProps = Omit<TransactionFormSheetProps,
  | 'categories'
  | 'currency'
  | 'hideSensitive'
  | 'onAddTransaction'
  | 'onUpdateTransaction'
  | 'onUpdateDraftTransaction'
  | 'onLoadDraftDocumentChanges'
>

interface DraftStagingViewProps {
  draftTransactions: Transaction[]
  onUpdateDraftTransaction: (id: string, updated: Omit<Transaction, 'id'>, documentChanges: TransactionDocumentChanges) => Promise<void> | void
  onLoadDraftDocumentChanges: (id: string) => Promise<TransactionDocumentChanges>
  onDeleteDraftTransaction: (id: string) => void
  onReorderDraftTransactions: (drafts: Transaction[]) => void
  onSyncDraftBatch: () => Promise<void> | void
  categories: TransactionCategory[]
  hideSensitive: boolean
  currency?: string
  onCancel: () => void
  onAddAnother?: () => void
  editorProps: EditorProps
  highlightedDraftId?: string | null
  onClearHighlightedDraft?: () => void
}

export function DraftStagingView({
  draftTransactions, highlightedDraftId = null, onClearHighlightedDraft,
  onUpdateDraftTransaction, onLoadDraftDocumentChanges, onDeleteDraftTransaction,
  onReorderDraftTransactions, onSyncDraftBatch, categories, hideSensitive,
  currency = 'USD', onCancel, onAddAnother, editorProps,
}: DraftStagingViewProps) {
  const formRef = useRef<TransactionFormSheetRef>(null)
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({})
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null)
  const [attachmentRevision, setAttachmentRevision] = useState(0)
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const issuesById = useMemo(() => new Map(
    draftTransactions.map(draft => [draft.id, getDraftTransactionIssues(draft, categories)]),
  ), [categories, draftTransactions])
  const firstInvalidDraft = draftTransactions.find(draft => (issuesById.get(draft.id)?.length ?? 0) > 0)
  const invalidCount = draftTransactions.filter(draft => (issuesById.get(draft.id)?.length ?? 0) > 0).length
  const draftTotal = useMemo(() => draftTransactions.reduce((sum, draft) => sum + Math.abs(draft.amount), 0), [draftTransactions])
  const attachmentCount = useMemo(() => Object.values(documentCounts).reduce((sum, count) => sum + count, 0), [documentCounts])

  const draftIdsKey = useMemo(
    () => draftTransactions.map(draft => draft.id).sort().join(','),
    [draftTransactions],
  )

  useEffect(() => {
    if (draftTransactions.length === 0) {
      setDocumentCounts({})
      setDocumentLoadError(null)
      setAttachmentsLoading(false)
      return
    }
    let active = true
    setDocumentLoadError(null)
    setAttachmentsLoading(true)
    void Promise.all(draftTransactions.map(async draft => {
      const changes = await onLoadDraftDocumentChanges(draft.id)
      return [draft.id, changes.pending.length] as const
    })).then(entries => {
      if (active) setDocumentCounts(Object.fromEntries(entries))
    }).catch(() => {
      if (active) setDocumentLoadError('Draft attachments could not be checked. Retry before adding these transactions.')
    }).finally(() => {
      if (active) setAttachmentsLoading(false)
    })
    return () => { active = false }
  }, [attachmentRevision, draftIdsKey, onLoadDraftDocumentChanges])

  useHighlightedElement(highlightedDraftId ? `draft-row-${highlightedDraftId}` : null, onClearHighlightedDraft)

  const openDraft = (draft: Transaction) => {
    void formRef.current?.handleStartDraft(draft).catch(() => setDocumentLoadError('This draft’s attachments could not be opened. Please retry.'))
  }

  const handleUpdateDraft = async (
    id: string,
    updated: Omit<Transaction, 'id'>,
    documentChanges: TransactionDocumentChanges,
  ) => {
    await onUpdateDraftTransaction(id, updated, documentChanges)
    setDocumentCounts(prev => ({ ...prev, [id]: documentChanges.pending.length }))
  }

  const handlePrimaryAction = async () => {
    if (firstInvalidDraft) { openDraft(firstInvalidDraft); return }
    if (documentLoadError || isSubmitting) return
    setIsSubmitting(true)
    try { await onSyncDraftBatch() } finally { setIsSubmitting(false) }
  }

  const moveDraft = (draftId: string, direction: -1 | 1) => {
    if (hideSensitive) return
    const sourceIndex = draftTransactions.findIndex(draft => draft.id === draftId)
    const targetIndex = sourceIndex + direction
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= draftTransactions.length) return
    const reordered = [...draftTransactions]
    const [moved] = reordered.splice(sourceIndex, 1)
    if (!moved) return
    reordered.splice(targetIndex, 0, moved)
    onReorderDraftTransactions(reordered)
  }

  const recordingOrderExplanation = 'The top draft records first. In the Ledger’s default newest-first view, same-day drafts appear in reverse order.'

  return (
    <section className="mx-auto max-w-5xl space-y-4 sm:space-y-5" aria-labelledby="draft-transactions-title">
      <PageHeader
        titleId="draft-transactions-title"
        leading={<Button variant="ghost" size="icon" onClick={onCancel} aria-label="Back to Ledger" title="Back to Ledger"><ArrowLeft className="size-4" aria-hidden="true" /></Button>}
        icon={<span className="grid size-10 place-items-center rounded-xl border border-accent-ink/20 bg-accent/20 text-accent-ink sm:size-11"><FileText className="size-5" /></span>}
        title={<span className="flex min-w-0 items-center gap-2"><span className="truncate">Draft Transactions</span>
            <span className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-bold text-muted-foreground">{draftTransactions.length}</span>
            <InfoHint text={recordingOrderExplanation} label="draft recording order" align="left" />
          </span>}
        description={<><span>Check the details, then add everything to your Ledger.</span><span className="sr-only">{recordingOrderExplanation}</span></>}
      />

      {draftTransactions.length === 0 ? (
        <div role="status" className="app-panel rounded-2xl border border-dashed border-border/70 bg-card/80 px-5 py-12 text-center sm:px-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-border/60 bg-muted/35 text-muted-foreground"><FileText className="size-5" aria-hidden="true" /></span>
          <h3 className="mt-4 text-base font-bold text-foreground">Your draft queue is clear</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">Start a transaction to review it here before adding it to the Ledger.</p>
          <div className="mx-auto mt-5 flex max-w-sm flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={onCancel}>Back to Ledger</Button>
            {onAddAnother && <Button onClick={onAddAnother} disabled={hideSensitive}>Post Transaction</Button>}
          </div>
        </div>
      ) : (
        <>
          <section
            className="app-panel flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 sm:px-5"
            aria-label="Batch overview"
          >
            <div className="mr-auto min-w-0">
              <span className="block text-xs font-semibold text-muted-foreground">Batch total</span>
              <span className="block truncate text-base font-extrabold text-foreground tabular-nums">
                {hideSensitive ? <SensitiveMask /> : formatCurrencyVal(draftTotal, currency)}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${invalidCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {invalidCount > 0
                ? <AlertTriangle className="size-3.5" aria-hidden="true" />
                : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
              {invalidCount > 0 ? `${invalidCount} need review` : 'All ready'}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${documentLoadError ? 'text-destructive' : 'text-muted-foreground'}`}>
              <Paperclip className="size-3.5" aria-hidden="true" />
              {attachmentsLoading
                ? 'Checking attachments…'
                : documentLoadError
                  ? 'Attachment check failed'
                  : attachmentCount === 0
                    ? 'No attachments'
                    : `${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`}
            </span>
          </section>

          {documentLoadError && <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{documentLoadError}</span><Button variant="outline" size="sm" onClick={() => setAttachmentRevision(revision => revision + 1)} className="shrink-0">Retry</Button></div>}

          <section aria-labelledby="draft-review-queue-title">
            <div className="mb-2.5 flex min-h-11 items-center justify-between gap-3 px-0.5 sm:min-h-9">
              <h3 id="draft-review-queue-title" className="text-sm font-bold text-foreground">Review drafts</h3>
              {onAddAnother && (
                <Button
                  variant="outline"
                  onClick={onAddAnother}
                  disabled={hideSensitive}
                  className="h-11 shrink-0 gap-1.5 px-3 sm:h-9"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add draft
                </Button>
              )}
            </div>
            <Reorder.Group axis="y" values={draftTransactions} onReorder={reordered => { if (!hideSensitive) onReorderDraftTransactions(reordered) }} className="space-y-3" aria-label="Draft transaction recording order">
              {draftTransactions.map((draft, index) => (
                <DraftReorderItem key={draft.id} value={draft} position={index + 1} count={draftTransactions.length} disabled={hideSensitive} onMove={direction => moveDraft(draft.id, direction)}>
                  {grip => <DraftQueueCard draft={draft} grip={grip} issues={issuesById.get(draft.id) ?? []} documentCount={documentCounts[draft.id] ?? 0} currency={currency} hideSensitive={hideSensitive} hint={index === 0} onEdit={() => openDraft(draft)} onDelete={() => onDeleteDraftTransaction(draft.id)} />}
                </DraftReorderItem>
              ))}
            </Reorder.Group>
          </section>

          <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-20 grid gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-[var(--app-shadow-elevated)] backdrop-blur sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4 lg:bottom-4">
            <p className="min-w-0 truncate px-1 text-xs font-semibold text-muted-foreground">
              <span className="text-foreground">{invalidCount > 0 ? `${invalidCount} need review` : 'Ready to add'}</span>
              <span aria-hidden="true"> · </span>
              {hideSensitive ? <SensitiveMask /> : formatCurrencyVal(draftTotal, currency)}
            </p>
            <Button
              onClick={() => void handlePrimaryAction()}
              aria-label={firstInvalidDraft ? undefined : `Add ${draftTransactions.length} draft${draftTransactions.length === 1 ? '' : 's'} to Ledger`}
              disabled={hideSensitive || Boolean(documentLoadError) || attachmentsLoading || isSubmitting}
              className="h-11 w-full rounded-xl sm:w-auto sm:min-w-44"
            >
              {firstInvalidDraft ? 'Review first draft' : isSubmitting ? 'Adding…' : 'Add to Ledger'}
            </Button>
          </div>
        </>
      )}

      <TransactionFormSheet ref={formRef} {...editorProps} categories={categories} currency={currency} hideSensitive={hideSensitive} onAddTransaction={() => undefined} onUpdateDraftTransaction={handleUpdateDraft} onLoadDraftDocumentChanges={onLoadDraftDocumentChanges} />
    </section>
  )
}
