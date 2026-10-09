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
import { IconButton } from './ui/IconButton'
import { PageHeader } from './ui/PageHeader'
import { InfoHint } from './ui/InfoHint'
import { SensitiveMask } from './ui/SensitiveAmount'
import { DraftQueueCard } from './drafts/DraftQueueCard'
import { DraftReorderItem } from './drafts/DraftReorderItem'
import { EmptyState } from './ui/EmptyState'
import { Badge } from './ui/Badge'

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
        leading={<IconButton onClick={onCancel} label="Back to Ledger" tooltip="Back to Ledger"><ArrowLeft className="size-4" aria-hidden="true" /></IconButton>}
        title={<span data-page-title-text="draft-transactions" className="inline-block whitespace-nowrap">Review drafts</span>}
        description={
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-1.5 text-body text-muted-foreground">
              <Badge tone="neutral">{draftTransactions.length}</Badge>
              <span>draft{draftTransactions.length === 1 ? '' : 's'} in queue</span>
              <InfoHint text={recordingOrderExplanation} label="draft recording order" align="left" inline />
              <span className="sr-only">{recordingOrderExplanation}</span>
            </p>
          </div>
        }
      />

      {draftTransactions.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" aria-hidden="true" />}
          title="Your draft queue is clear"
          actions={<>
            <Button variant="secondary" onClick={onCancel}>Back to Ledger</Button>
            {onAddAnother && <Button onClick={onAddAnother} disabled={hideSensitive}>Post Transaction</Button>}
          </>}
        />
      ) : (
        <>
          <section
            className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-panel bg-surface-2/70 px-4 py-3.5 sm:px-5"
            aria-label="Batch overview"
          >
            <div className="mr-auto min-w-0">
              <span className="block text-label text-muted-foreground">Batch total</span>
              <span className="block truncate text-title text-foreground tabular-nums">
                {hideSensitive ? <SensitiveMask /> : formatCurrencyVal(draftTotal, currency)}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-label font-medium ${invalidCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {invalidCount > 0
                ? <AlertTriangle className="size-3.5" aria-hidden="true" />
                : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
              {invalidCount > 0 ? `${invalidCount} need review` : 'All ready'}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-label ${documentLoadError ? 'text-destructive' : 'text-muted-foreground'}`}>
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

          {documentLoadError && <div className="flex flex-col gap-3 rounded-control bg-destructive/10 px-4 py-3 text-body text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{documentLoadError}</span><Button variant="secondary" size="sm" onClick={() => setAttachmentRevision(revision => revision + 1)} className="shrink-0">Retry</Button></div>}

          <section aria-labelledby="draft-review-queue-title">
            <div className="mb-2.5 flex min-h-11 items-center justify-between gap-3 px-0.5 sm:min-h-9">
              <h3 id="draft-review-queue-title" className="text-subsection text-foreground">Review drafts</h3>
              {onAddAnother && (
                <Button
                  variant="secondary"
                  onClick={onAddAnother}
                  disabled={hideSensitive}
                  size="sm"
                  className="shrink-0 gap-1.5"
                >
                  <Plus className="size-4" aria-hidden="true" />
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

          <div className="glass-surface sticky bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-20 grid gap-3 rounded-full p-2 pl-5 shadow-(--app-shadow-overlay) grid-cols-[minmax(0,1fr)_auto] items-center sm:bottom-4">
            <p className="min-w-0 truncate text-label text-muted-foreground">
              <span className="text-foreground">{invalidCount > 0 ? `${invalidCount} need review` : 'Ready to add'}</span>
              <span aria-hidden="true"> · </span>
              {hideSensitive ? <SensitiveMask /> : formatCurrencyVal(draftTotal, currency)}
            </p>
            <Button
              onClick={() => void handlePrimaryAction()}
              aria-label={firstInvalidDraft
                ? `Review ${firstInvalidDraft.description || 'draft'}`
                : `Add ${draftTransactions.length} draft${draftTransactions.length === 1 ? '' : 's'} to Ledger`}
              disabled={hideSensitive || Boolean(documentLoadError) || attachmentsLoading || isSubmitting}
              className="sm:min-w-44"
            >
              {firstInvalidDraft ? 'Review' : isSubmitting ? 'Adding…' : 'Add to Ledger'}
            </Button>
          </div>
        </>
      )}

      <TransactionFormSheet ref={formRef} {...editorProps} categories={categories} currency={currency} hideSensitive={hideSensitive} onAddTransaction={() => undefined} onUpdateDraftTransaction={handleUpdateDraft} onLoadDraftDocumentChanges={onLoadDraftDocumentChanges} />
    </section>
  )
}
