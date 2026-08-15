import React, { type ReactNode } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
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

export interface LedgerRowProps {
  transaction: Transaction
  accounts?: LedgerAccount[]
  isDeleting: boolean
  isSyncing: boolean
  hideSensitive: boolean
  currency: string
  /** Position in the rendered page, used only for the CSS entrance stagger. */
  index?: number
  onStartEdit: (transaction: Transaction) => void
  onDeleteClick: (transaction: Transaction) => void
  onEditBlocked: (transaction: Transaction) => void
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
// ledger bucket and nothing else. Completed reload uses high-contrast emerald; pending drawdowns
// use amber (--ledger-pending-*) for attention.
const ReloadIntentChip = ({
  intent,
  status,
}: {
  intent: Transaction['stabilityReloadIntent']
  status: Transaction['stabilityReloadStatus']
}) => {
  const settled = status === 'NotRequired' || status === 'Complete'
  const partial = status === 'PartlyRepaid'
  return (
    <span
      className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
        settled
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
          : partial
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }`}
    >
      {stabilityReloadStatusLabel(status, intent)}
    </span>
  )
}

function AccountChip({ transaction, accounts }: { transaction: Transaction; accounts?: LedgerAccount[] }) {
  if (!transaction.accountId) return null
  const account = accounts?.find(item => item.id === transaction.accountId)
  if (!account) return null
  return (
    <span
      className={`inline-flex max-w-[15rem] shrink-0 truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
        account.isArchived
          ? 'border-border/60 bg-muted/40 text-muted-foreground'
          : 'border-primary/25 bg-primary/10 text-foreground'
      }`}
      title={`Account: ${account.name}${account.isArchived ? ' (Closed)' : ''}`}
    >
      Account: {account.name}{account.isArchived ? ' (Closed)' : ''}
    </span>
  )
}

export const DesktopLedgerRow = React.memo(function DesktopLedgerRow(props: LedgerRowProps) {
  const transaction = props.transaction
  const outflow = transaction.amount < 0
  const income = transaction.ledgerCategory === 'Income' || transaction.ledgerCategory.startsWith('IncomeSplit:')
  const split = transaction.id.includes('-split-')
  const completion = transaction.savingsGoalId != null
  const editBlocked = split || completion
  const transfer = transaction.ledgerCategory.startsWith('Transfer:') || transaction.ledgerCategory.toLowerCase() === 'accountmove'
  const reloadDrawdown = isStabilityReloadDrawdown(transaction)
  const money = (value: number) => <Amount value={formatCurrencyVal(value, props.currency)} hidden={props.hideSensitive} />
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
      <td className="p-4 font-medium text-muted-foreground">{transaction.date}</td>
      <td className="p-4 font-semibold text-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{transaction.description}</span>
          <AccountChip transaction={transaction} accounts={props.accounts} />
          {reloadDrawdown && <ReloadIntentChip intent={transaction.stabilityReloadIntent} status={transaction.stabilityReloadStatus} />}
          <RowSyncStatus isDeleting={props.isDeleting} isSyncing={props.isSyncing} isPending={transaction.isPendingSync} entityLabel="transaction" />
        </div>
      </td>
      <td className="p-4"><span className={`inline-block text-[10px] px-2 py-0.5 font-semibold rounded-md border ${getCategoryBadgeClass(transaction.category)}`}>{transaction.category}</span></td>
      <td className="p-4">
        <span className="inline-flex flex-col items-start gap-1">
          <LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} />
          {transfer && (
            <span className="text-[10px] font-semibold text-blue-500 whitespace-nowrap">
              {split ? 'Allocated' : 'Moved'} {money(Math.abs(transaction.amount))}
            </span>
          )}
        </span>
      </td>
      <td className="p-4 text-right font-medium">
        {income || transfer ? <span className="text-muted-foreground/30">-</span> : outflow ? <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">{money(Math.abs(transaction.amount))}</span> : <span className="text-muted-foreground/30">-</span>}
      </td>
      <td className="p-4 text-right font-medium">
        {!transfer && (income || !outflow) ? <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-xs">{money(transaction.amount)}</span> : <span className="text-muted-foreground/30">-</span>}
      </td>
      <td className="p-4 text-center flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)} disabled={!editBlocked && (props.isDeleting || props.hideSensitive)}>Edit</Button>
        <Button variant="danger" size="sm" onClick={() => props.onDeleteClick(transaction)} disabled={props.isDeleting || props.hideSensitive}>Delete</Button>
      </td>
    </tr>
  )
})

export const MobileLedgerRow = React.memo(function MobileLedgerRow(props: LedgerRowProps & { hint: boolean }) {
  const transaction = props.transaction
  const outflow = transaction.amount < 0
  const transfer = transaction.ledgerCategory.startsWith('Transfer:') || transaction.ledgerCategory.toLowerCase() === 'accountmove'
  const split = transaction.id.includes('-split-')
  const editBlocked = split || transaction.savingsGoalId != null
  const reloadDrawdown = isStabilityReloadDrawdown(transaction)
  const formatted = formatCurrencyVal(outflow ? Math.abs(transaction.amount) : transaction.amount, props.currency)

  return (
    <div className="cv-row list-row-enter" style={staggerStyle(props.index)}>
      <SwipeableRow
        id={ledgerTransactionRowId(transaction.id, 'mobile')}
        hint={props.hint}
        disabled={props.isDeleting}
        className="rounded-2xl border border-border shadow-xs"
        actionsWidth={128}
        actions={<><Button variant="unstyled" onClick={editBlocked ? () => props.onEditBlocked(transaction) : () => props.onStartEdit(transaction)} disabled={!editBlocked && (props.isDeleting || props.isSyncing || props.hideSensitive)} className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Edit2 className="size-4" />Edit</Button><Button variant="unstyled" onClick={() => props.onDeleteClick(transaction)} disabled={props.isDeleting || props.isSyncing || props.hideSensitive} className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="size-4" />Delete</Button></>}
      >
        <div className={`h-0.5 w-full ${transfer ? 'bg-blue-500/60' : outflow ? 'bg-orange-500/60' : 'bg-emerald-500/60'}`} />
        <div className="p-4 space-y-3">
          {props.isSelecting && <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
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

          <div className="flex items-center justify-between gap-2"><span className="shrink-0 text-[10px] text-muted-foreground font-mono">{transaction.date}</span><span title={transaction.category} className={`min-w-0 max-w-[65%] truncate px-2 py-0.5 text-right text-[10px] font-semibold rounded-full border ${getCategoryBadgeClass(transaction.category)}`}>{transaction.category}</span></div>
          <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><h4 className="min-w-0 truncate text-sm font-bold" title={transaction.description}>{transaction.description}</h4><AccountChip transaction={transaction} accounts={props.accounts} /><RowSyncStatus isDeleting={props.isDeleting} isSyncing={props.isSyncing} isPending={transaction.isPendingSync} entityLabel="transaction" /></div><span className={`max-w-[45%] shrink-0 break-words text-right text-sm font-bold ${transfer ? 'text-blue-400' : outflow ? 'text-orange-400' : 'text-emerald-400'}`}>{props.hideSensitive ? <SensitiveMask /> : <>{transfer ? '' : outflow ? '-' : '+'}{formatted}</>}</span></div>
          {reloadDrawdown && <div className="flex"><ReloadIntentChip intent={transaction.stabilityReloadIntent} status={transaction.stabilityReloadStatus} /></div>}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30"><span className="text-[10px] text-muted-foreground flex items-center gap-1.5">Ledger:<LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} compact /></span></div>
        </div>
      </SwipeableRow>
    </div>
  )
})
