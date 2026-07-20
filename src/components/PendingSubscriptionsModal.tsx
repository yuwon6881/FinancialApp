import { useState } from 'react'
import type { PendingNotification } from '../types'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { BottomSheet } from './ui/BottomSheet'
import { ToggleButton } from './ui/ToggleButton'
import { DatePicker } from './ui/DatePicker'
import { BellRing, CheckCircle2 } from 'lucide-react'

interface PendingSubscriptionsModalProps {
  isOpen: boolean
  pendingNotifications: PendingNotification[]
  currency: string
  hideSensitive: boolean
  showOnLoginChecked: boolean
  onToggleShowOnLogin: (checked: boolean) => void
  onClose: () => void
  onConfirmSubscription: (noti: PendingNotification, paidDate: string) => void
  onDiscardSubscription: (noti: PendingNotification) => void
  onRemoveSubscription: (recurringPaymentId: string) => void
}

export function PendingSubscriptionsModal({
  isOpen,
  pendingNotifications,
  currency,
  hideSensitive,
  showOnLoginChecked,
  onToggleShowOnLogin,
  onClose,
  onConfirmSubscription,
  onDiscardSubscription,
  onRemoveSubscription
}: PendingSubscriptionsModalProps) {
  const [paidDates, setPaidDates] = useState<Record<string, string>>({})

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-amber-500" />
          <span className="text-base font-bold text-foreground">Bills to review</span>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-foreground w-full sm:w-auto">
            <span>Show pending-payment reminder after startup</span>
            <ToggleButton
              active={showOnLoginChecked}
              onClick={() => onToggleShowOnLogin(!showOnLoginChecked)}
              label="Show pending-payment reminder after startup"
              className="size-6 shrink-0"
            />
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-foreground text-background font-bold text-xs rounded-xl hover:bg-foreground/90 transition shadow-sm cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      }
    >
      {pendingNotifications.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <CheckCircle2 className="size-9 text-emerald-500" />
          <h3 className="mt-3 text-sm font-bold text-foreground">All caught up</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">No subscription payments are waiting for confirmation.</p>
        </div>
      ) : (
      <>
        <div className="text-xs text-muted-foreground">
          Confirm paid bills to add them to the ledger, skip only this cycle, or remove the subscription entirely.
        </div>

        <div key={isOpen ? 'open' : 'closed'} className="space-y-3 overflow-y-auto max-h-80 pr-1 py-1 mt-2">
        {pendingNotifications.map((noti) => (
          <div key={noti.id} className="p-4 rounded-xl bg-muted/30 border border-border/40 shadow-xs flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-bold text-foreground text-xs block">{noti.name}</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border ${getCategoryBadgeClass(noti.category)}`}>
                    {noti.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{noti.billingDate}</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-orange-500 font-extrabold text-xs block transition-all duration-300 ${hideSensitive ? 'blur-sm select-none pointer-events-none' : ''}`}>
                  -{formatCurrencyVal(noti.amount, currency)}
                </span>
                <span className="text-[9px] text-muted-foreground">{noti.cycleLabel}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-border/20 pt-2.5">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[160px]">
                  <span className="text-[9px] font-bold text-muted-foreground shrink-0">Paid Date:</span>
                  <DatePicker
                    value={paidDates[noti.id] ?? noti.billingDate}
                    onChange={value => setPaidDates(prev => ({ ...prev, [noti.id]: value }))}
                    align="right"
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const dateVal = paidDates[noti.id] ?? noti.billingDate
                      onConfirmSubscription(noti, dateVal)
                    }}
                    disabled={hideSensitive}
                    title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm whitespace-nowrap text-center"
                  >
                    Confirm Paid
                  </button>
                  <button
                    onClick={() => onDiscardSubscription(noti)}
                    disabled={hideSensitive}
                    title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-lg transition duration-150 cursor-pointer border border-slate-500/10 whitespace-nowrap text-center"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => onRemoveSubscription(noti.recurringPaymentId)}
                    disabled={hideSensitive}
                    title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-xs rounded-lg transition duration-150 cursor-pointer border border-orange-500/10 whitespace-nowrap text-center"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      </>
      )}
    </BottomSheet>
  )
}
