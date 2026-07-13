import React, { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Edit2, Trash2 } from 'lucide-react'
import type { Transaction } from '../../types'
import { rowFadeVariants } from '../../lib/animations'
import { formatCurrencyVal } from '../../lib/utils'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { RowSyncBadge } from '../ui/RowSyncBadge'
import { SwipeableRow } from '../ui/SwipeableRow'
import { Button } from '../ui/Button'
import { LedgerAllocationBadge } from './LedgerAllocationBadge'

export interface LedgerRowProps {
  transaction: Transaction
  isDeleting: boolean
  isSyncing: boolean
  hideSensitive: boolean
  currency: string
  onStartEdit: (transaction: Transaction) => void
  onDeleteClick: (transaction: Transaction) => void
  onSplitEditBlocked: () => void
}

const Amount = ({ value, hidden }: { value: ReactNode; hidden: boolean }) => (
  <span className={hidden ? 'blur-sm select-none pointer-events-none inline-block' : ''}>{value}</span>
)

export const DesktopLedgerRow = React.memo(function DesktopLedgerRow(props: LedgerRowProps) {
  const transaction = props.transaction
  const outflow = transaction.amount < 0
  const income = transaction.ledgerCategory === 'Income' || transaction.ledgerCategory.startsWith('IncomeSplit:')
  const split = transaction.id.includes('-split-')
  const transfer = transaction.ledgerCategory.startsWith('Transfer:')
  const money = (value: number) => <Amount value={formatCurrencyVal(value, props.currency)} hidden={props.hideSensitive} />
  return (
    <motion.tr variants={rowFadeVariants} id={`tx-row-${transaction.id}`} className="hover:bg-muted/10 transition">
      <td className="p-4 font-medium text-muted-foreground">{transaction.date}</td>
      <td className="p-4 font-semibold text-foreground flex items-center gap-2"><span>{transaction.description}</span>{props.isDeleting ? <RowSyncBadge state="deleting" entityLabel="transaction" /> : (props.isSyncing || transaction.isPendingSync) ? <RowSyncBadge state={props.isSyncing ? 'syncing' : 'pending'} entityLabel="transaction" /> : null}</td>
      <td className="p-4"><span className={`inline-block text-[10px] px-2 py-0.5 font-semibold rounded-md border ${getCategoryBadgeClass(transaction.category)}`}>{transaction.category}</span></td>
      <td className="p-4"><LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} /></td>
      <td className="p-4 text-right font-medium">
        {income || split ? <span className="text-muted-foreground/30">-</span> : transfer || outflow ? <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">{money(transfer ? transaction.amount : Math.abs(transaction.amount))}</span> : <span className="text-muted-foreground/30">-</span>}
      </td>
      <td className="p-4 text-right font-medium">
        {income || split || transfer || !outflow ? <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-xs">{money(transaction.amount)}</span> : <span className="text-muted-foreground/30">-</span>}
      </td>
      <td className="p-4 text-center flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={split ? props.onSplitEditBlocked : () => props.onStartEdit(transaction)} disabled={!split && (props.isDeleting || props.hideSensitive)}>Edit</Button>
        <Button variant="danger" size="sm" onClick={() => props.onDeleteClick(transaction)} disabled={props.isDeleting || props.hideSensitive}>Delete</Button>
      </td>
    </motion.tr>
  )
})

export const MobileLedgerRow = React.memo(function MobileLedgerRow(props: LedgerRowProps & { hint: boolean }) {
  const transaction = props.transaction
  const outflow = transaction.amount < 0
  const transfer = transaction.ledgerCategory.startsWith('Transfer:')
  const split = transaction.id.includes('-split-')
  const formatted = formatCurrencyVal(outflow ? Math.abs(transaction.amount) : transaction.amount, props.currency)
  return (
    <motion.div variants={rowFadeVariants}>
      <SwipeableRow
        id={`tx-row-${transaction.id}`}
        hint={props.hint}
        disabled={props.isDeleting}
        className="rounded-2xl border border-border shadow-xs"
        actionsWidth={128}
        actions={<><button onClick={split ? props.onSplitEditBlocked : () => props.onStartEdit(transaction)} disabled={!split && (props.isDeleting || props.isSyncing || props.hideSensitive)} className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Edit2 className="size-4" />Edit</button><button onClick={() => props.onDeleteClick(transaction)} disabled={props.isDeleting || props.isSyncing || props.hideSensitive} className="flex-1 flex flex-col items-center justify-center gap-1 bg-red-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="size-4" />Delete</button></>}
      >
        <div className={`h-0.5 w-full ${transfer ? 'bg-blue-500/60' : outflow ? 'bg-orange-500/60' : 'bg-emerald-500/60'}`} />
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground font-mono">{transaction.date}</span><span className={`text-[10px] px-2 py-0.5 font-semibold rounded-full border ${getCategoryBadgeClass(transaction.category)}`}>{transaction.category}</span></div>
          <div className="flex items-center justify-between gap-3"><div className="flex-1 flex items-center gap-1.5 min-w-0"><h4 className="text-sm font-bold truncate">{transaction.description}</h4>{props.isDeleting ? <RowSyncBadge state="deleting" entityLabel="transaction" /> : (props.isSyncing || transaction.isPendingSync) ? <RowSyncBadge state={props.isSyncing ? 'syncing' : 'pending'} entityLabel="transaction" /> : null}</div><span className={`${props.hideSensitive ? 'blur-sm' : ''} text-sm font-bold ${transfer ? 'text-blue-400' : outflow ? 'text-orange-400' : 'text-emerald-400'}`}>{transfer ? '' : outflow ? '-' : '+'}{formatted}</span></div>
          <div className="flex items-center justify-between pt-2 border-t border-border/30"><span className="text-[10px] text-muted-foreground flex items-center gap-1.5">Ledger:<LedgerAllocationBadge ledgerCategory={transaction.ledgerCategory} transactionId={transaction.id} compact /></span></div>
        </div>
      </SwipeableRow>
    </motion.div>
  )
})
