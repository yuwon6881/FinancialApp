import React from 'react'
import { ArrowLeftRight, CalendarClock, Pencil, Trash2, Wallet } from 'lucide-react'
import type { LedgerAccount, Transaction } from '../../types'
import { cn } from '../../lib/utils'
import { AmountText } from '../ui/AmountText'
import { CategoryIcon } from '../ui/CategoryIcon'
import { IconButton } from '../ui/IconButton'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { SwipeableRow } from '../ui/SwipeableRow'
import { Button } from '../ui/Button'
import { LedgerAllocationBadge } from './LedgerAllocationBadge'
import { ledgerTransactionRowId } from '../../lib/ledgerTransactionTarget'
import { Checkbox } from '../ui/Checkbox'
import { isStabilityReloadDrawdown, stabilityReloadStatusLabel } from '../../lib/stabilityRecovery'
import { transactionMoveIneligibility } from './transactionMoveEligibility'

export interface LedgerRowProps {
  transaction: Transaction
  accounts?: LedgerAccount[]
  isDeleting: boolean
  isSyncing: boolean
  hideSensitive: boolean
  maskFinancialFigures?: boolean
  currency: string
  /** Position in the rendered page, used only for the CSS entrance stagger. */
  index?: number
  onStartEdit: (transaction: Transaction) => void
  onDeleteClick: (transaction: Transaction) => void
  onEditBlocked: (transaction: Transaction) => void
  onMove?: (transaction: Transaction) => void
  isSelecting: boolean
  isSelected: (transaction: Transaction) => boolean
  canSelect: (transaction: Transaction) => boolean
  onToggleSelected: (transaction: Transaction) => void
}

// Per-row entrance delay, replacing Framer Motion's `staggerChildren: 0.05`. Capped so
// that "show all cycles" (up to ~100 rows) does not turn a decorative stagger into a
// five-second cascade the way the uncapped variant did.
const STAGGER_STEP_MS = 50
const STAGGER_MAX_MS = 400

function staggerStyle(index: number | undefined) {
  if (!index) return undefined
  return { animationDelay: `${Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms` }
}

const isTransferRow = (transaction: Transaction) =>
  transaction.ledgerCategory.startsWith('Transfer:') || transaction.ledgerCategory.toLowerCase() === 'accountmove'

/**
 * One signed figure per row, the way a bank statement reads: money in is green with a plus,
 * money out is plain ink with a minus -- spending is normal, not an alarm -- and a transfer or
 * allocation is muted with no sign, because it moved money without spending any.
 */
export function LedgerAmount({ transaction, currency, masked, className }: {
  transaction: Transaction
  currency: string
  masked: boolean
  className?: string
}) {
  const transfer = isTransferRow(transaction)
  if (transfer) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
        <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden="true" />
        <AmountText value={Math.abs(transaction.amount)} currency={currency} isMasked={masked} signDisplay="never" />
      </span>
    )
  }
  return (
    <AmountText
      value={transaction.amount}
      currency={currency}
      isMasked={masked}
      signDisplay={transaction.amount > 0 ? 'always' : 'auto'}
      tone={transaction.amount > 0 ? 'positive' : 'neutral'}
      className={className}
    />
  )
}

const shortDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(year !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}

// The reload answer sits beside the description, not in the allocation cell: that cell is the
// ledger bucket and nothing else.
const ReloadIntentChip = ({
  intent,
  status,
}: {
  intent: Transaction['stabilityReloadIntent']
  status: Transaction['stabilityReloadStatus']
}) => {
  const settled = status === 'NotRequired' || status === 'Complete' || (status == null && intent === 'NotRequired')
  const label = stabilityReloadStatusLabel(status, intent)
  const isPending = !settled
  return (
    <span
      title={`Stability recovery status: ${label}`}
      className={`inline-flex max-w-full shrink-0 items-center gap-1 text-caption font-medium whitespace-nowrap ${isPending ? 'text-accent-ink' : 'text-muted-foreground'}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${isPending ? 'bg-accent-ink' : 'bg-muted-foreground/60'}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  )
}

const accountLabel = (account: LedgerAccount) => `${account.name}${account.isArchived ? ' (Closed)' : ''}`

/** Whether AccountChip has anything to draw, so a caller does not open an empty chip row for it. */
function hasNamedAccount(transaction: Transaction, accounts?: LedgerAccount[]): boolean {
  return Boolean(transaction.accountId && accounts?.some(item => item.id === transaction.accountId))
}

function AccountChip({ transaction, accounts }: { transaction: Transaction; accounts?: LedgerAccount[] }) {
  if (!transaction.accountId) return null
  const account = accounts?.find(item => item.id === transaction.accountId)
  if (!account) return null
  // An internal move has a destination as well as a source, and naming only the source left the
  // row saying money left an account without saying where it went.
  const counterAccount = transaction.counterAccountId
    ? accounts?.find(item => item.id === transaction.counterAccountId)
    : undefined
  const title = counterAccount
    ? `Account: ${accountLabel(account)} to ${accountLabel(counterAccount)}`
    : `Account: ${accountLabel(account)}`
  const isArchived = account.isArchived || Boolean(counterAccount?.isArchived)
  return (
    <span
      title={title}
      className={`inline-flex min-w-0 max-w-[14rem] shrink items-center gap-1 text-caption text-muted-foreground ${isArchived ? 'opacity-70' : ''}`}
    >
      <Wallet className="size-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">
        <span className="sr-only">Account: </span>
        {accountLabel(account)}
        {counterAccount && <><span aria-hidden="true"> → </span><span className="sr-only"> to </span>{accountLabel(counterAccount)}</>}
      </span>
    </span>
  )
}

function selectionLabel(transaction: Transaction, canSelect: boolean) {
  if (canSelect) return `Select ${transaction.description}`
  return transaction.savingsGoalId != null
    ? `${transaction.description} is a commitment completion and must be deleted individually`
    : `${transaction.description} is busy and cannot be selected`
}

function rowFacts(transaction: Transaction, onMove: LedgerRowProps['onMove']) {
  const split = transaction.id.includes('-split-')
  const editBlocked = split || transaction.savingsGoalId != null || transaction.wishlistItemId != null
  const moveReason = transactionMoveIneligibility(transaction)
  return {
    split,
    editBlocked,
    moveReason,
    canMove: !editBlocked && !moveReason && Boolean(onMove),
    transfer: isTransferRow(transaction),
    reloadDrawdown: isStabilityReloadDrawdown(transaction),
  }
}

export const DesktopLedgerRow = React.memo(function DesktopLedgerRow(props: LedgerRowProps) {
  const transaction = props.transaction
  const { split, editBlocked, moveReason, canMove, transfer, reloadDrawdown } = rowFacts(transaction, props.onMove)
  // The chip renders nothing for an account missing from the list, so gating on the raw id
  // opened an empty chip row under the description.
  const hasAccount = hasNamedAccount(transaction, props.accounts)
  const masked = props.maskFinancialFigures ?? props.hideSensitive
  const busy = props.isDeleting || props.hideSensitive
  return (
    <tr
      id={ledgerTransactionRowId(transaction.id, 'desktop')}
      className="group list-row-enter transition-colors hover:bg-surface-2/50"
      style={staggerStyle(props.index)}
    >
      {props.isSelecting && <td className="align-middle">
        <Checkbox
          checked={props.isSelected(transaction)}
          onChange={() => props.onToggleSelected(transaction)}
          disabled={!props.canSelect(transaction)}
          aria-label={selectionLabel(transaction, props.canSelect(transaction))}
          title={transaction.savingsGoalId != null ? 'Commitment completions must be deleted individually.' : undefined}
        />
      </td>}
      <td className="whitespace-nowrap text-label text-muted-foreground tabular-nums" title={transaction.date}>{shortDate(transaction.date)}</td>
      <td className="max-w-0 w-[40%]">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIcon category={transfer ? 'Transfer' : transaction.category} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-body font-medium text-foreground">{transaction.description}</span>
              <RowSyncStatus isDeleting={props.isDeleting} isSyncing={props.isSyncing} isPending={transaction.isPendingSync} entityLabel="transaction" />
            </div>
            {(hasAccount || reloadDrawdown) && (
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <AccountChip transaction={transaction} accounts={props.accounts} />
                {reloadDrawdown && <ReloadIntentChip intent={transaction.stabilityReloadIntent} status={transaction.stabilityReloadStatus} />}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap text-label text-muted-foreground">{transaction.category}</td>
      <td>
        <span className="inline-flex flex-col items-start gap-0.5">
          <LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} />
          {transfer && <span className="text-caption text-muted-foreground">{split ? 'Allocated' : 'Moved'}</span>}
        </span>
      </td>
      <td className="whitespace-nowrap text-right text-body font-medium">
        <LedgerAmount transaction={transaction} currency={props.currency} masked={masked} />
      </td>
      <td className="w-px whitespace-nowrap">
        <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
          <IconButton
            label={`Edit ${transaction.description}`}
            tooltip="Edit"
            onClick={editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)}
            disabled={!editBlocked && busy}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </IconButton>
          {props.onMove && (
            <IconButton
              label={moveReason ? `Cannot move ${transaction.description}: ${moveReason}` : `Move ${transaction.description} to another cycle`}
              tooltip={moveReason ?? 'Move to another cycle'}
              onClick={() => canMove ? props.onMove?.(transaction) : undefined}
              disabled={!canMove || busy}
              className="text-muted-foreground hover:text-foreground"
            >
              <CalendarClock className="size-4" aria-hidden="true" />
            </IconButton>
          )}
          <IconButton
            label={`Delete ${transaction.description}`}
            tooltip="Delete"
            onClick={() => props.onDeleteClick(transaction)}
            disabled={busy}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </td>
    </tr>
  )
})

const DRAWER_ACTION = 'flex-1 flex-col gap-1 text-caption font-semibold disabled:opacity-50'

export const MobileLedgerRow = React.memo(function MobileLedgerRow(props: LedgerRowProps & { hint: boolean }) {
  const transaction = props.transaction
  const { editBlocked, moveReason, canMove, transfer, reloadDrawdown } = rowFacts(transaction, props.onMove)
  // The chip renders nothing for an account missing from the list, so gating on the raw id
  // opened an empty chip row under the description.
  const hasAccount = hasNamedAccount(transaction, props.accounts)
  const masked = props.maskFinancialFigures ?? props.hideSensitive
  const busy = props.isDeleting || props.isSyncing || props.hideSensitive
  const edit = editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)
  const editLabel = `Edit ${transaction.description}`
  const moveLabel = moveReason ? `Cannot move ${transaction.description}: ${moveReason}` : `Move ${transaction.description} to another cycle`
  const deleteLabel = `Delete ${transaction.description}`

  return (
    <div className="cv-row list-row-enter" style={staggerStyle(props.index)}>
      <SwipeableRow
        id={ledgerTransactionRowId(transaction.id, 'mobile')}
        variant="flush"
        hint={props.hint}
        disabled={props.isDeleting}
        contentClassName="pr-2"
        actionsWidth={props.onMove ? 216 : 144}
        actions={<>
          <Button variant="tertiary" onClick={edit} disabled={!editBlocked && busy} aria-label={editLabel} className={cn(DRAWER_ACTION, 'bg-surface-3 text-foreground hover:bg-surface-3')}>
            <Pencil className="size-4" aria-hidden="true" />Edit
          </Button>
          {props.onMove && (
            <Button variant="tertiary" onClick={() => props.onMove?.(transaction)} disabled={!canMove || busy} title={moveReason ?? undefined} aria-label={moveLabel} className={cn(DRAWER_ACTION, 'bg-surface-2 text-foreground hover:bg-surface-2')}>
              <CalendarClock className="size-4" aria-hidden="true" />Move
            </Button>
          )}
          <Button variant="tertiary" onClick={() => props.onDeleteClick(transaction)} disabled={busy} aria-label={deleteLabel} className={cn(DRAWER_ACTION, 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}>
            <Trash2 className="size-4" aria-hidden="true" />Delete
          </Button>
        </>}
        desktopActions={<>
          <IconButton label={editLabel} tooltip="Edit" onClick={edit} disabled={!editBlocked && busy} className="text-muted-foreground hover:text-foreground">
            <Pencil className="size-4" aria-hidden="true" />
          </IconButton>
          {props.onMove && (
            <IconButton label={moveLabel} tooltip={moveReason ?? 'Move to another cycle'} onClick={() => props.onMove?.(transaction)} disabled={!canMove || busy} className="text-muted-foreground hover:text-foreground">
              <CalendarClock className="size-4" aria-hidden="true" />
            </IconButton>
          )}
          <IconButton label={deleteLabel} tooltip="Delete" onClick={() => props.onDeleteClick(transaction)} disabled={busy} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </>}
      >
        <div className="flex min-h-16 items-center gap-3 py-3 pl-4">
          {props.isSelecting ? (
            <span className="grid size-10 shrink-0 place-items-center">
              <Checkbox
                checked={props.isSelected(transaction)}
                onChange={() => props.onToggleSelected(transaction)}
                disabled={!props.canSelect(transaction)}
                aria-label={selectionLabel(transaction, props.canSelect(transaction))}
                title={transaction.savingsGoalId != null ? 'Commitment completions must be deleted individually.' : undefined}
              />
            </span>
          ) : (
            <CategoryIcon category={transfer ? 'Transfer' : transaction.category} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h4 className="min-w-0 truncate text-body font-medium text-foreground" title={transaction.description}>{transaction.description}</h4>
              <RowSyncStatus isDeleting={props.isDeleting} isSyncing={props.isSyncing} isPending={transaction.isPendingSync} entityLabel="transaction" />
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="min-w-0 truncate text-caption text-muted-foreground" title={transaction.category}>{transaction.category}</span>
              {hasAccount && <AccountChip transaction={transaction} accounts={props.accounts} />}
              {reloadDrawdown && <ReloadIntentChip intent={transaction.stabilityReloadIntent} status={transaction.stabilityReloadStatus} />}
            </div>
          </div>
          <div className="flex max-w-[45%] shrink-0 flex-col items-end gap-0.5 text-right">
            <LedgerAmount transaction={transaction} currency={props.currency} masked={masked} className="text-body font-semibold" />
            <LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} compact />
          </div>
        </div>
      </SwipeableRow>
    </div>
  )
})
