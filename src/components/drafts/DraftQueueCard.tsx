import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Paperclip, Pencil, Trash2 } from 'lucide-react'
import type { Transaction } from '../../types'
import { LedgerAllocationBadge } from '../ledger/LedgerAllocationBadge'
import { LedgerAmount } from '../ledger/LedgerRows'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { IconButton } from '../ui/IconButton'
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
  const needsReview = issues.length > 0
  const actionHint = 'Reveal sensitive data to manage drafts'

  return (
    <SwipeableRow
      id={`draft-row-${draft.id}`}
      hint={hint}
      className={`rounded-panel border bg-card transition-colors ${needsReview ? 'border-amber-500/40' : 'border-border/70'}`}
      contentClassName="rounded-panel bg-card p-3 sm:p-4"
      actionsWidth={144}
      actions={<>
        <Button variant="tertiary" onClick={onEdit} disabled={hideSensitive} aria-label={`Edit ${draft.description}`} className="flex-1 flex-col gap-1 bg-surface-3 text-caption font-semibold text-foreground hover:bg-surface-3"><Pencil className="size-4" aria-hidden="true" />Edit</Button>
        <Button variant="tertiary" onClick={onDelete} disabled={hideSensitive} aria-label={`Delete ${draft.description}`} className="flex-1 flex-col gap-1 bg-destructive text-caption font-semibold text-destructive-foreground hover:bg-destructive/90"><Trash2 className="size-4" aria-hidden="true" />Delete</Button>
      </>}
      desktopActions={false}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
        {grip}
        <CategoryIcon category={isTransfer ? 'Transfer' : draft.category} className="mt-0.5 hidden sm:inline-grid" />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-9 min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-body font-medium text-foreground" title={draft.description}>{draft.description}</p>
            <LedgerAmount transaction={draft} currency={currency} masked={hideSensitive} className="max-w-[45%] shrink-0 text-body font-semibold" />
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              <IconButton onClick={onEdit} disabled={hideSensitive} label={`Edit ${draft.description}`} tooltip={hideSensitive ? actionHint : 'Edit draft'} className="text-muted-foreground hover:text-foreground">
                <Pencil className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton onClick={onDelete} disabled={hideSensitive} label={`Delete ${draft.description}`} tooltip={hideSensitive ? actionHint : 'Delete draft'} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            <Badge tone={needsReview ? 'warning' : 'success'}>
              {needsReview ? <AlertTriangle className="size-3" aria-hidden="true" /> : <CheckCircle2 className="size-3" aria-hidden="true" />}
              {needsReview ? 'Needs review' : 'Ready'}
            </Badge>
            <span className="shrink-0 tabular-nums">{draft.date}</span>
            {documentCount > 0 && <span className="inline-flex min-w-0 items-center gap-1" title={`${documentCount} attachment${documentCount === 1 ? '' : 's'}`}><Paperclip className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{documentCount}</span></span>}
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-caption">
            <LedgerAllocationBadge ledgerCategory={draft.ledgerCategory} transactionId={draft.id} compact />
            {!isTransfer && <span className="min-w-0 max-w-full truncate text-muted-foreground" title={draft.category}>{draft.category}</span>}
          </div>
        </div>
      </div>
      {needsReview && (
        <div className="mt-3 flex flex-col gap-2 rounded-control bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-label text-foreground">{issues.join(' ')}</p>
          <Button variant="secondary" size="sm" onClick={onEdit} disabled={hideSensitive} className="shrink-0">Review</Button>
        </div>
      )}
    </SwipeableRow>
  )
}
