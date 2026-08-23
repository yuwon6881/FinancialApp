import { useEffect, useMemo, useState } from 'react'
import type { Transaction } from '../../types'
import { getTransactionCyclePlacement } from '../../lib/transactionCyclePlacement'
import { useAppContext } from '../../contexts/AppContext'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { DatePicker } from '../ui/DatePicker'
import { transactionMoveIneligibility } from './transactionMoveEligibility'

interface LedgerMoveSheetProps {
  transactions: Transaction[]
  cycleDay: number
  isOpen: boolean
  onClose: () => void
  onMoved?: () => void
}

export function LedgerMoveSheet({ transactions, cycleDay, isOpen, onClose, onMoved }: LedgerMoveSheetProps) {
  const app = useAppContext()
  const [targetDate, setTargetDate] = useState('')
  useEffect(() => {
    if (isOpen) setTargetDate(transactions[0]?.date?.slice(0, 10) || new Date().toLocaleDateString('en-CA'))
  }, [isOpen, transactions])
  const sourceRange = useMemo(() => {
    const dates = transactions.map(transaction => transaction.date.slice(0, 10)).sort()
    if (dates.length === 0) return ''
    return dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} to ${dates.at(-1)}`
  }, [transactions])
  const destination = targetDate ? getTransactionCyclePlacement(targetDate, cycleDay)?.label : null
  const reason = transactions.map(transactionMoveIneligibility).find(Boolean)

  return <BottomSheet
    isOpen={isOpen}
    title={`Move ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
    onClose={onClose}
    footer={<div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
      <Button
        variant="primary"
        className="flex-1"
        disabled={!targetDate || Boolean(reason)}
        onClick={() => {
          if (!app.guardSensitive()) return
          // Only the parents are queued: the server moves an Income parent's generated split rows
          // with it, and the optimistic projection re-derives those rows from the parent.
          const moves = transactions.map(transaction => ({ id: String(transaction.id), targetDate }))
          const beforeSnapshots = transactions.map(transaction => ({ id: String(transaction.id), date: transaction.date.slice(0, 10) }))
          if (!app.queueMutation?.('transaction', 'bulkMove', `move-${Date.now()}`, { moves, beforeSnapshots })) return
          onMoved?.()
          onClose()
        }}
      >Move</Button>
    </div>}
  >
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/25 p-3 text-sm">
        <p><span className="font-semibold">Current date{transactions.length === 1 ? '' : ' range'}:</span> {sourceRange}</p>
        <p><span className="font-semibold">Selected:</span> {transactions.length}</p>
      </div>
      <label className="block space-y-2 text-sm font-semibold">
        Destination date
        <DatePicker value={targetDate} onChange={setTargetDate} required className="w-full" ariaLabel="Destination transaction date" />
      </label>
      {destination && <p className="text-sm text-muted-foreground">Destination financial cycle: <span className="font-semibold text-foreground">{destination}</span></p>}
      {transactions.length > 1 && <p className="text-sm text-orange-500">All selected records will receive this same date. Undo restores every original date.</p>}
      {reason && <p role="alert" className="text-sm font-semibold text-destructive">{reason}</p>}
    </div>
  </BottomSheet>
}
