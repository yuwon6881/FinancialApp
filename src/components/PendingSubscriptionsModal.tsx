import type { PendingNotification } from '../types'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { BottomSheet } from './ui/BottomSheet'

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
  if (pendingNotifications.length === 0) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          <span className="text-base font-bold text-foreground">Pending Subscription Payments</span>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer w-full sm:w-auto">
            <input
              type="checkbox"
              checked={showOnLoginChecked}
              onChange={(e) => onToggleShowOnLogin(e.target.checked)}
              className="rounded border-border text-blue-500 focus:ring-blue-500"
            />
            Show this notification automatically every time I log in
          </label>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-foreground text-background font-bold text-xs rounded-xl hover:bg-foreground/90 transition shadow-sm cursor-pointer text-center"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="text-xs text-muted-foreground">
        The following subscription renewals have arrived or passed. Please confirm which bills have been paid to register them in the ledger.
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
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
                  <span className="text-[9px] font-bold text-muted-foreground shrink-0">Paid Date:</span>
                  <input
                    type="date"
                    defaultValue={noti.billingDate}
                    id={`modal-date-${noti.id}`}
                    className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const dateVal = (document.getElementById(`modal-date-${noti.id}`) as HTMLInputElement)?.value || noti.billingDate
                      onConfirmSubscription(noti, dateVal)
                    }}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm whitespace-nowrap text-center"
                  >
                    Confirm Paid
                  </button>
                  <button
                    onClick={() => onDiscardSubscription(noti)}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-lg transition duration-150 cursor-pointer border border-slate-500/10 whitespace-nowrap text-center"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => onRemoveSubscription(noti.recurringPaymentId)}
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
    </BottomSheet>
  )
}
