import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Edit2, Paperclip, Trash2 } from 'lucide-react'
import type { Transaction } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { LedgerAllocationBadge } from '../ledger/LedgerAllocationBadge'
import { Button } from '../ui/Button'
import { SensitiveMask } from '../ui/SensitiveAmount'
import { SwipeableRow } from '../ui/SwipeableRow'

interface DraftQueueCardProps {
  draft: Transaction
  grip: ReactNode
  issues: string[]
  documentCount: number
  currency: string
  hideSensitive: boolean
  hint: boolean
  onEdit: () => void
  onDelete: () => void
}

export function DraftQueueCard({ draft, grip, issues, documentCount, currency, hideSensitive, hint, onEdit, onDelete }: DraftQueueCardProps) {
  const isAccountMove = draft.ledgerCategory.toLowerCase() === 'accountmove'
  const isTransfer = draft.ledgerCategory.startsWith('Transfer:') || isAccountMove
  const isOutflow = draft.amount < 0
  const needsReview = issues.length > 0
  const amountClass = isTransfer ? 'text-accent-ink' : isOutflow ? 'text-orange-500' : 'text-emerald-500'
  const amountPrefix = isTransfer ? '' : isOutflow ? '-' : '+'
  const actionHint = 'Reveal sensitive data to manage drafts'

  return (
    <SwipeableRow
      id={`draft-row-${draft.id}`}
      hint={hint}
      className={`rounded-2xl border bg-card shadow-[var(--app-shadow-soft)] transition-colors ${needsReview ? 'border-amber-500/35' : 'border-border/60 hover:border-primary/30'}`}
      contentClassName="rounded-2xl bg-card p-3 sm:p-4"
      actionsWidth={128}
      actions={<>
        <Button variant="unstyled" onClick={onEdit} disabled={hideSensitive} aria-label={`Edit ${draft.description}`} className="flex flex-1 flex-col items-center justify-center gap-1 bg-primary text-xs font-bold text-primary-foreground"><Edit2 className="size-4" aria-hidden="true" />Edit</Button>
        <Button variant="unstyled" onClick={onDelete} disabled={hideSensitive} aria-label={`Delete ${draft.description}`} className="flex flex-1 flex-col items-center justify-center gap-1 bg-destructive text-xs font-bold text-destructive-foreground"><Trash2 className="size-4" aria-hidden="true" />Delete</Button>
      </>}
      desktopActions={false}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
        {grip}
        <div className="min-w-0 flex-1">
          <div className="flex min-h-9 min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground" title={draft.description}>{draft.description}</p>
            <span className={`max-w-[45%] shrink-0 whitespace-nowrap text-right text-sm font-extrabold tabular-nums ${amountClass}`}>
              {hideSensitive ? <SensitiveMask /> : <>{amountPrefix}{formatCurrencyVal(Math.abs(draft.amount), currency)}</>}
            </span>
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              <Button variant="ghost" size="icon" onClick={onEdit} disabled={hideSensitive} aria-label={`Edit ${draft.description}`} title={hideSensitive ? actionHint : 'Edit draft'}>
                <Edit2 className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} disabled={hideSensitive} aria-label={`Delete ${draft.description}`} title={hideSensitive ? actionHint : 'Delete draft'} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-1 font-bold ${needsReview ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {needsReview ? <AlertTriangle className="size-3" aria-hidden="true" /> : <CheckCircle2 className="size-3" aria-hidden="true" />}
              {needsReview ? 'Needs review' : 'Ready'}
            </span>
            <span className="shrink-0 tabular-nums">{draft.date}</span>
            <LedgerAllocationBadge ledgerCategory={draft.ledgerCategory} transactionId={draft.id} compact />
            {!isTransfer && <span className={`min-w-0 max-w-full truncate rounded-md border px-1.5 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(draft.category)}`} title={draft.category}>{draft.category}</span>}
            {documentCount > 0 && <span className="inline-flex min-w-0 items-center gap-1" title={`${documentCount} attachment${documentCount === 1 ? '' : 's'}`}><Paperclip className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{documentCount}</span></span>}
          </div>
          {needsReview && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 text-xs leading-relaxed text-amber-700 dark:text-amber-300">{issues.join(' ')}</p>
              <Button variant="outline" size="sm" onClick={onEdit} disabled={hideSensitive} className="min-h-11 shrink-0 border-amber-500/30 bg-card text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 sm:min-h-9">Review</Button>
            </div>
          )}
        </div>
      </div>
    </SwipeableRow>
  )
}
