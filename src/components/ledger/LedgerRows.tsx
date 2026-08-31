import React, { type ReactNode } from 'react'
import { CalendarClock, Edit2, Trash2, Wallet } from 'lucide-react'
import type { LedgerAccount, Transaction } from '../../types'
import { formatCurrencyVal } from '../../lib/utils'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { SwipeableRow } from '../ui/SwipeableRow'
import { Button } from '../ui/Button'
import { LedgerAllocationBadge } from './LedgerAllocationBadge'
import { ledgerTransactionRowId } from '../../lib/ledgerTransactionTarget'
import { SensitiveMask } from '../ui/SensitiveAmount'
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

const Amount = ({ value, hidden }: { value: ReactNode; hidden: boolean }) => (
  hidden ? <SensitiveMask /> : <span>{value}</span>
)

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
      className={`inline-flex max-w-full shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap ${isPending ? 'text-accent-ink' : 'text-muted-foreground'}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${isPending ? 'bg-accent-ink' : 'bg-muted-foreground/60'}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  )
}

function AccountChip({ transaction, accounts }: { transaction: Transaction; accounts?: LedgerAccount[] }) {
  if (!transaction.accountId) return null
  const account = accounts?.find(item => item.id === transaction.accountId)
  if (!account) return null
  return (
    <span
      title={`Account: ${account.name}${account.isArchived ? ' (Closed)' : ''}`}
      className={`inline-flex min-w-0 max-w-[14rem] shrink items-center gap-1 text-xs font-medium text-muted-foreground ${account.isArchived ? 'opacity-70' : ''}`}
    >
      <Wallet className="size-3 shrink-0 text-accent-ink" aria-hidden="true" />
      <span className="min-w-0 truncate"><span className="sr-only">Account: </span>{account.name}{account.isArchived ? ' (Closed)' : ''}</span>
    </span>
  )
}

export const DesktopLedgerRow = React.memo(function DesktopLedgerRow(props: LedgerRowProps) {
  const transaction = props.transaction
  const outflow = transaction.amount < 0
  const income = transaction.ledgerCategory === 'Income' || transaction.ledgerCategory.startsWith('IncomeSplit:')
  const split = transaction.id.includes('-split-')
  const completion = transaction.savingsGoalId != null
  const editBlocked = split || completion || transaction.wishlistItemId != null
  const transfer = transaction.ledgerCategory.startsWith('Transfer:') || transaction.ledgerCategory.toLowerCase() === 'accountmove'
  const moveReason = transactionMoveIneligibility(transaction)
  const canMove = !editBlocked && !moveReason && Boolean(props.onMove)
  const reloadDrawdown = isStabilityReloadDrawdown(transaction)
  const hasAccount = Boolean(transaction.accountId)
  const money = (value: number) => <Amount value={formatCurrencyVal(value, props.currency)} hidden={props.maskFinancialFigures ?? props.hideSensitive} />
  return (
    <tr
      id={ledgerTransactionRowId(transaction.id, 'desktop')}
      className="list-row-enter hover:bg-muted/10 transition"
      style={staggerStyle(props.index)}
    >
      {props.isSelecting && <td className="p-4 align-middle">
        <Checkbox
          checked={props.isSelected(transaction)}
          onChange={() => props.onToggleSelected(transaction)}
          disabled={!props.canSelect(transaction)}
          aria-label={props.canSelect(transaction)
            ? `Select ${transaction.description}`
            : transaction.savingsGoalId != null
              ? `${transaction.description} is a commitment completion and must be deleted individually`
              : `${transaction.description} is busy and cannot be selected`}
          title={transaction.savingsGoalId != null ? 'Commitment completions must be deleted individually.' : undefined}
        />
      </td>}
      <td className="p-4 font-medium text-muted-foreground text-xs font-mono">{transaction.date}</td>
      <td className="p-4 font-semibold text-foreground">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate">{transaction.description}</span>
            <RowSyncStatus isDeleting={props.isDeleting} isSyncing={props.isSyncing} isPending={transaction.isPendingSync} entityLabel="transaction" />
          </div>
          {(hasAccount || reloadDrawdown) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <AccountChip transaction={transaction} accounts={props.accounts} />
              {reloadDrawdown && <ReloadIntentChip intent={transaction.stabilityReloadIntent} status={transaction.stabilityReloadStatus} />}
            </div>
          )}
        </div>
      </td>
      <td className="p-4"><span className={`inline-block text-xs px-2.5 py-0.5 font-semibold rounded-md border ${getCategoryBadgeClass(transaction.category)}`}>{transaction.category}</span></td>
      <td className="p-4">
        <span className="inline-flex flex-col items-start gap-1">
          <LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} />
          {transfer && (
            <span className="text-xs font-semibold text-blue-500 whitespace-nowrap tabular-nums">
              {split ? 'Allocated' : 'Moved'} {money(Math.abs(transaction.amount))}
            </span>
          )}
        </span>
      </td>
      <td className="p-4 text-right font-medium">
        {income || transfer ? <span className="text-muted-foreground/30">-</span> : outflow ? <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs tabular-nums">{money(Math.abs(transaction.amount))}</span> : <span className="text-muted-foreground/30">-</span>}
      </td>
      <td className="p-4 text-right font-medium">
        {!transfer && (income || !outflow) ? <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-xs tabular-nums">{money(transaction.amount)}</span> : <span className="text-muted-foreground/30">-</span>}
      </td>
      <td className="p-4 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)} disabled={!editBlocked && (props.isDeleting || props.hideSensitive)}>Edit</Button>
          {props.onMove && <Button variant="ghost" size="sm" title={moveReason ?? undefined} onClick={() => canMove ? props.onMove?.(transaction) : undefined} disabled={!canMove || props.isDeleting || props.hideSensitive} className={canMove ? 'border border-primary/30 text-accent-ink hover:bg-primary/10' : 'border border-border/50 text-muted-foreground'}>Move to</Button>}
          <Button variant="danger" size="sm" onClick={() => props.onDeleteClick(transaction)} disabled={props.isDeleting || props.hideSensitive}>Delete</Button>
        </div>
      </td>
    </tr>
  )
})
// Between the compact and expanded tiers the card is what renders but SwipeableRow has no swipe
// drawer, so the row actions come back inline. They have to be compact icon buttons: the drawer's
// full-width stacked blocks were rendering inline in a non-shrinking box and pushing the whole card
// past the viewport. 44px targets, because this only ever shows on compact and medium.
const INLINE_ACTION_CLASS = 'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50'

export const MobileLedgerRow = React.memo(function MobileLedgerRow(props: LedgerRowProps & { hint: boolean }) {
  const transaction = props.transaction
  const outflow = transaction.amount < 0
  const transfer = transaction.ledgerCategory.startsWith('Transfer:') || transaction.ledgerCategory.toLowerCase() === 'accountmove'
  const split = transaction.id.includes('-split-')
  const editBlocked = split || transaction.savingsGoalId != null || transaction.wishlistItemId != null
  const moveReason = transactionMoveIneligibility(transaction)
  const canMove = !editBlocked && !moveReason && Boolean(props.onMove)
  const reloadDrawdown = isStabilityReloadDrawdown(transaction)
  const hasAccount = Boolean(transaction.accountId)
  const formatted = formatCurrencyVal(outflow ? Math.abs(transaction.amount) : transaction.amount, props.currency)

  return (
    <div className="cv-row list-row-enter" style={staggerStyle(props.index)}>
      <SwipeableRow
        id={ledgerTransactionRowId(transaction.id, 'mobile')}
        hint={props.hint}
        disabled={props.isDeleting}
        className="relative overflow-hidden rounded-2xl border border-border shadow-xs"
        contentClassName="pr-3"
        actionsWidth={props.onMove ? 192 : 128}
        actions={<><Button variant="unstyled" onClick={editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)} disabled={!editBlocked && (props.isDeleting || props.isSyncing || props.hideSensitive)} className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Edit2 className="size-4" />Edit</Button>{props.onMove && <Button variant="unstyled" onClick={() => props.onMove?.(transaction)} disabled={!canMove || props.isDeleting || props.isSyncing || props.hideSensitive} className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${canMove ? 'bg-secondary text-secondary-foreground' : 'bg-muted/50 text-muted-foreground'}`}><CalendarClock className="size-4" />Move to</Button>}<Button variant="unstyled" onClick={() => props.onDeleteClick(transaction)} disabled={props.isDeleting || props.isSyncing || props.hideSensitive} className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="size-4" />Delete</Button></>}
        desktopActions={<>
          <Button
            variant="unstyled"
            onClick={editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)}
            disabled={!editBlocked && (props.isDeleting || props.isSyncing || props.hideSensitive)}
            aria-label={`Edit ${transaction.description}`}
            title="Edit"
            className={`${INLINE_ACTION_CLASS} border-primary/30 bg-primary/10 text-accent-ink hover:bg-primary/20`}
          >
            <Edit2 className="size-4" aria-hidden="true" />
          </Button>
          {props.onMove && (
            <Button
              variant="unstyled"
              onClick={() => props.onMove?.(transaction)}
              disabled={!canMove || props.isDeleting || props.isSyncing || props.hideSensitive}
              aria-label={`Move ${transaction.description} to another cycle`}
              title="Move to"
              className={`${INLINE_ACTION_CLASS} border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground`}
            >
              <CalendarClock className="size-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="unstyled"
            onClick={() => props.onDeleteClick(transaction)}
            disabled={props.isDeleting || props.isSyncing || props.hideSensitive}
            aria-label={`Delete ${transaction.description}`}
            title="Delete"
            className={`${INLINE_ACTION_CLASS} border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </>}
      >
        <div className={`absolute inset-x-0 top-0 h-0.5 ${transfer ? 'bg-blue-500/60' : outflow ? 'bg-orange-500/60' : 'bg-emerald-500/60'}`} />
        <div className="p-4 space-y-3">
          {props.isSelecting && <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Checkbox
                checked={props.isSelected(transaction)}
                onChange={() => props.onToggleSelected(transaction)}
                disabled={!props.canSelect(transaction)}
                aria-label={props.canSelect(transaction)
                  ? `Select ${transaction.description}`
                  : transaction.savingsGoalId != null
                    ? `${transaction.description} is a commitment completion and must be deleted individually`
                    : `${transaction.description} is busy and cannot be selected`}
                title={transaction.savingsGoalId != null ? 'Commitment completions must be deleted individually.' : undefined}
              />
              Select transaction
            </label>
          </div>}

          <div className="flex items-center justify-between gap-2"><span className="shrink-0 text-xs text-muted-foreground font-mono">{transaction.date}</span><span title={transaction.category} className={`min-w-0 max-w-[65%] truncate px-2.5 py-0.5 text-right text-xs font-semibold rounded-md border ${getCategoryBadgeClass(transaction.category)}`}>{transaction.category}</span></div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <h4 className="min-w-0 truncate text-sm font-bold" title={transaction.description}>{transaction.description}</h4>
                <RowSyncStatus isDeleting={props.isDeleting} isSyncing={props.isSyncing} isPending={transaction.isPendingSync} entityLabel="transaction" />
              </div>
              {(hasAccount || reloadDrawdown) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <AccountChip transaction={transaction} accounts={props.accounts} />
                  {reloadDrawdown && <ReloadIntentChip intent={transaction.stabilityReloadIntent} status={transaction.stabilityReloadStatus} />}
                </div>
              )}
            </div>
            <span className={`max-w-[45%] shrink-0 break-words text-right text-sm font-bold tabular-nums ${(props.maskFinancialFigures ?? props.hideSensitive) ? 'text-muted-foreground' : transfer ? 'text-blue-400' : outflow ? 'text-orange-400' : 'text-emerald-400'}`}>{(props.maskFinancialFigures ?? props.hideSensitive) ? <SensitiveMask /> : <>{transfer ? '' : outflow ? '-' : '+'}{formatted}</>}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30"><span className="text-xs text-muted-foreground flex items-center gap-1.5">Ledger:<LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} compact /></span></div>
        </div>
      </SwipeableRow>
    </div>
  )
})
