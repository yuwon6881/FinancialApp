import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Edit2, FileText, Plus, Trash2 } from 'lucide-react'
import type { Transaction, TransactionCategory, TransactionDocumentChanges } from '../types'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { getDraftTransactionIssues } from '../lib/draftTransactionValidation'
import { LedgerAllocationBadge } from './ledger/LedgerAllocationBadge'
import {
  TransactionFormSheet,
  type TransactionFormSheetProps,
  type TransactionFormSheetRef,
} from './ledger/TransactionFormSheet'
import { Button } from './ui/Button'
import { SensitiveMask } from './ui/SensitiveAmount'
import { SwipeableRow } from './ui/SwipeableRow'

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
  onUpdateDraftTransaction: (
    id: string,
    updated: Omit<Transaction, 'id'>,
    documentChanges: TransactionDocumentChanges,
  ) => Promise<void> | void
  onLoadDraftDocumentChanges: (id: string) => Promise<TransactionDocumentChanges>
  onDeleteDraftTransaction: (id: string) => void
  onSyncDraftBatch: () => Promise<void> | void
  categories: TransactionCategory[]
  hideSensitive: boolean
  currency?: string
  onCancel: () => void
  onAddAnother?: () => void
  editorProps: EditorProps
}

export function DraftStagingView({
  draftTransactions,
  onUpdateDraftTransaction,
  onLoadDraftDocumentChanges,
  onDeleteDraftTransaction,
  onSyncDraftBatch,
  categories,
  hideSensitive,
  currency = 'USD',
  onCancel,
  onAddAnother,
  editorProps,
}: DraftStagingViewProps) {
  const formRef = useRef<TransactionFormSheetRef>(null)
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({})
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null)
  const [attachmentRevision, setAttachmentRevision] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const issuesById = useMemo(() => new Map(
    draftTransactions.map(draft => [draft.id, getDraftTransactionIssues(draft, categories)]),
  ), [categories, draftTransactions])
  const firstInvalidDraft = draftTransactions.find(draft => (issuesById.get(draft.id)?.length ?? 0) > 0)
  const invalidCount = draftTransactions.filter(draft => (issuesById.get(draft.id)?.length ?? 0) > 0).length

  useEffect(() => {
    let active = true
    setDocumentLoadError(null)
    void Promise.all(draftTransactions.map(async draft => {
      const changes = await onLoadDraftDocumentChanges(draft.id)
      return [draft.id, changes.pending.length] as const
    })).then(entries => {
      if (active) setDocumentCounts(Object.fromEntries(entries))
    }).catch(() => {
      if (active) setDocumentLoadError('Draft attachments could not be checked. Retry before adding these transactions.')
    })
    return () => { active = false }
  }, [attachmentRevision, draftTransactions, onLoadDraftDocumentChanges])

  const openDraft = (draft: Transaction) => {
    void formRef.current?.handleStartDraft(draft).catch(() => setDocumentLoadError(
      'This draft’s attachments could not be opened. Please retry.',
    ))
  }

  const handlePrimaryAction = async () => {
    if (firstInvalidDraft) {
      openDraft(firstInvalidDraft)
      return
    }
    if (documentLoadError || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSyncDraftBatch()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5" aria-labelledby="draft-transactions-title">
      <header className="app-panel rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Back to Ledger" title="Back to Ledger">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="size-5 text-accent-ink" aria-hidden="true" />
              <h2 id="draft-transactions-title" className="text-xl font-bold text-foreground">Draft Transactions</h2>
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {draftTransactions.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Review each draft before adding it to your Ledger.</p>
          </div>
        </div>
      </header>

      {documentLoadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <span>{documentLoadError}</span>
          <Button variant="outline" size="sm" onClick={() => setAttachmentRevision(revision => revision + 1)}>Retry</Button>
        </div>
      )}

      <div className="space-y-3">
        {draftTransactions.map((draft, index) => {
          const isTransfer = draft.ledgerCategory.startsWith('Transfer:') || draft.ledgerCategory.toLowerCase() === 'accountmove'
          const isOutflow = draft.amount < 0
          const issues = issuesById.get(draft.id) ?? []
          const amountClass = isTransfer ? 'text-accent-ink' : isOutflow ? 'text-orange-500' : 'text-emerald-500'
          const amountPrefix = isTransfer ? '' : isOutflow ? '-' : '+'
          const documentCount = documentCounts[draft.id] ?? 0

          return (
            <SwipeableRow
              key={draft.id}
              hint={index === 0}
              className="rounded-2xl border border-border/60 bg-card shadow-[var(--app-shadow-soft)] transition-colors hover:border-primary/35"
              contentClassName="p-4"
              actionsWidth={128}
              actions={<>
                <Button variant="unstyled" onClick={() => openDraft(draft)} disabled={hideSensitive} aria-label={`Edit ${draft.description}`} className="flex flex-1 flex-col items-center justify-center gap-1 bg-primary text-primary-foreground text-[11px] font-bold">
                  <Edit2 className="size-4" />Edit
                </Button>
                <Button variant="unstyled" onClick={() => onDeleteDraftTransaction(draft.id)} disabled={hideSensitive} aria-label={`Delete ${draft.description}`} className="flex flex-1 flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-[11px] font-bold">
                  <Trash2 className="size-4" />Delete
                </Button>
              </>}
              desktopActions={<>
                <Button variant="ghost" size="icon" onClick={() => openDraft(draft)} disabled={hideSensitive} aria-label={`Edit ${draft.description}`} title={hideSensitive ? 'Reveal sensitive data to edit drafts' : 'Edit draft'}>
                  <Edit2 className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDeleteDraftTransaction(draft.id)} disabled={hideSensitive} aria-label={`Delete ${draft.description}`} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </>}
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{draft.description}</p>
                  <div className="mt-1 min-w-0 space-y-1.5 pr-10 text-[10px] text-muted-foreground lg:pr-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {issues.length > 0 && (
                        <span className="max-w-full truncate rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400" title={issues.join(' ')}>
                          Needs review
                        </span>
                      )}
                      <span className="shrink-0">{draft.date}</span>
                      <LedgerAllocationBadge ledgerCategory={draft.ledgerCategory} transactionId={draft.id} compact />
                    </div>
                    {!isTransfer && (
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className={`min-w-0 max-w-full truncate rounded-md border px-1.5 py-0.5 font-semibold ${getCategoryBadgeClass(draft.category)}`} title={draft.category}>{draft.category}</span>
                        {documentCount > 0 && <span className="min-w-0 max-w-full truncate" title={`${documentCount} document${documentCount === 1 ? '' : 's'}`}>{documentCount} document{documentCount === 1 ? '' : 's'}</span>}
                      </div>
                    )}
                    {isTransfer && documentCount > 0 && (
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 max-w-full truncate" title={`${documentCount} document${documentCount === 1 ? '' : 's'}`}>{documentCount} document{documentCount === 1 ? '' : 's'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className={`max-w-[45%] shrink-0 self-center whitespace-nowrap text-right text-sm font-extrabold tabular-nums ${amountClass}`}>
                  {hideSensitive ? <SensitiveMask /> : <>{amountPrefix}{formatCurrencyVal(Math.abs(draft.amount), currency)}</>}
                </span>
              </div>
            </SwipeableRow>
          )
        })}
      </div>

      {onAddAnother && (
        <Button variant="outline" onClick={onAddAnother} disabled={hideSensitive} className="min-h-11 w-full gap-2 rounded-2xl border-dashed border-primary/40 bg-primary/5 text-accent-ink hover:bg-primary/10">
          <Plus className="size-4" />Add Another Transaction
        </Button>
      )}

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-20 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-[var(--app-shadow-elevated)] backdrop-blur lg:bottom-4">
        <Button
          onClick={() => void handlePrimaryAction()}
          disabled={hideSensitive || Boolean(documentLoadError) || isSubmitting}
          className="min-h-11 w-full rounded-xl"
        >
          {firstInvalidDraft
            ? invalidCount === 1 ? 'Review Draft' : 'Review First Draft'
            : isSubmitting ? 'Adding to Ledger…' : `Add ${draftTransactions.length} to Ledger`}
        </Button>
      </div>

      <TransactionFormSheet
        ref={formRef}
        {...editorProps}
        categories={categories}
        currency={currency}
        hideSensitive={hideSensitive}
        onAddTransaction={() => undefined}
        onUpdateDraftTransaction={onUpdateDraftTransaction}
        onLoadDraftDocumentChanges={onLoadDraftDocumentChanges}
      />
    </section>
  )
}
