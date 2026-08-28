import { useEffect, useState } from 'react'
import type { PendingNotification } from '../types'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { BottomSheet } from './ui/BottomSheet'
import { ToggleButton } from './ui/ToggleButton'
import { DatePicker } from './ui/DatePicker'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { SensitiveMask } from './ui/SensitiveAmount'
import { Button } from './ui/Button'
import { BellRing, CheckCircle2, Loader2 } from 'lucide-react'
import { financialDate } from '../lib/financialDate'

interface PendingSubscriptionsModalProps {
  isOpen: boolean
  pendingNotifications: PendingNotification[]
  currency: string
  hideSensitive: boolean
  showOnLoginChecked: boolean
  onToggleShowOnLogin: (checked: boolean) => void
  onClose: () => void
  onConfirmSubscription: (noti: PendingNotification, paidDate: string, amount?: number) => void
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
  const [paidAmounts, setPaidAmounts] = useState<Record<string, string>>({})
  const [pendingActions, setPendingActions] = useState<Record<string, 'confirm' | 'discard' | 'remove'>>({})

  // Blank means "pay the whole bill", which is what almost every confirmation is. A figure below the
  // amount due records a part payment and leaves the bill open for the rest; anything at or above it
  // is the full payment, so it is sent as undefined rather than as a partial the server would refuse.
  const partialAmountFor = (noti: PendingNotification): number | undefined => {
    const raw = (paidAmounts[noti.id] ?? '').trim()
    if (raw === '') return undefined
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined
    const due = Math.abs(noti.amount)
    return due > 0 && parsed >= due ? undefined : parsed
  }

  useEffect(() => {
    if (!isOpen) {
      setPendingActions({})
      return
    }
    const visibleIds = new Set(pendingNotifications.map(notification => notification.id))
    setPendingActions(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => visibleIds.has(id)),
    ))
  }, [isOpen, pendingNotifications])

  const runSubscriptionAction = (
    noti: PendingNotification,
    action: 'confirm' | 'discard' | 'remove',
    callback: () => void,
  ) => {
    setPendingActions(current => ({ ...current, [noti.id]: action }))
    callback()
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      layerClassName="z-[300]"
      backdropClassName="max-sm:p-2"
      panelClassName="max-sm:gap-3 max-sm:p-4"
      title={
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-amber-500" />
          <span className="text-base font-bold text-foreground">Bills to review</span>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-foreground w-full sm:w-auto">
            <span>Notify Bills</span>
            <ToggleButton
              active={showOnLoginChecked}
              onClick={() => onToggleShowOnLogin(!showOnLoginChecked)}
              label="Notify Bills"
              className="size-6 shrink-0"
            />
          </div>
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full rounded-xl shadow-sm sm:w-auto"
          >
            Close
          </Button>
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
        <div className="text-xs leading-relaxed text-muted-foreground">
          Confirm paid bills to add them to the ledger, skip only this cycle, or remove the subscription entirely.
        </div>

        <div key={isOpen ? 'open' : 'closed'} className="mt-1 max-h-[56vh] space-y-3 overflow-y-auto py-1 pr-1 sm:mt-2 sm:max-h-80">
        {pendingNotifications.map((noti) => {
          const pendingAction = pendingActions[noti.id]
          const isPending = pendingAction !== undefined
          return (
          <div key={noti.id} className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-muted/25 p-4 shadow-xs sm:gap-3">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <span className="min-w-0 truncate text-sm font-bold text-foreground">{noti.name}</span>
                <span className="shrink-0 text-sm font-extrabold text-orange-500 transition-all duration-300">
                  {hideSensitive ? <SensitiveMask /> : <>-{formatCurrencyVal(Math.abs(noti.amount), currency)}</>}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className={`inline-block text-xs px-1.5 py-0.5 font-bold rounded border ${getCategoryBadgeClass(noti.category)}`}>
                    {noti.category}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Due {noti.billingDate}</span>
                  <span className="text-xs text-muted-foreground">Cycle {noti.cycleLabel}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:pt-2.5">
              <div className={`w-full space-y-1.5 sm:flex sm:w-auto sm:min-w-[210px] sm:items-center sm:gap-1.5 sm:space-y-0 ${isPending ? 'pointer-events-none opacity-70' : ''}`}>
                  <span className="block text-xs font-bold text-muted-foreground sm:shrink-0">Paid Date</span>
                  <DatePicker
                    value={paidDates[noti.id] ?? noti.billingDate}
                    onChange={value => setPaidDates(prev => ({ ...prev, [noti.id]: value }))}
                    max={financialDate()}
                    align="right"
                    className="w-full sm:flex-1"
                  />
              </div>
              <div className={`w-full space-y-1.5 sm:w-auto sm:min-w-[170px] ${isPending ? 'pointer-events-none opacity-70' : ''}`}>
                  <label
                    htmlFor={`pending-amount-${noti.id}`}
                    className="block text-xs font-bold text-muted-foreground"
                  >
                    Amount paid
                  </label>
                  <SmartAmountInput
                    id={`pending-amount-${noti.id}`}
                    type="text"
                    inputMode="decimal"
                    value={paidAmounts[noti.id] ?? ''}
                    onChange={event => setPaidAmounts(prev => ({ ...prev, [noti.id]: event.target.value }))}
                    placeholder={hideSensitive ? '' : formatCurrencyVal(Math.abs(noti.amount), currency)}
                    disabled={hideSensitive}
                    aria-describedby={`pending-amount-hint-${noti.id}`}
                    className="w-full font-medium"
                  />
                  <p id={`pending-amount-hint-${noti.id}`} className="text-xs leading-relaxed text-muted-foreground">
                    {partialAmountFor(noti) != null
                      ? 'Part payment — the rest stays due on this bill.'
                      : 'Leave blank to pay the full amount.'}
                  </p>
              </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <Button
                    variant="primary"
                    onClick={() => runSubscriptionAction(
                      noti,
                      'confirm',
                      () => onConfirmSubscription(
                        noti,
                        paidDates[noti.id] ?? noti.billingDate,
                        partialAmountFor(noti),
                      ),
                    )}
                    disabled={hideSensitive || isPending}
                    title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                    className="col-span-2 min-h-10 min-w-0 whitespace-nowrap rounded-xl px-4 py-2 shadow-sm disabled:cursor-wait disabled:opacity-70 sm:col-span-1 sm:min-h-9 sm:flex-initial sm:rounded-lg sm:px-3 sm:py-1.5"
                  >
                    {pendingAction === 'confirm'
                      ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Confirming…</span>
                      : 'Confirm Paid'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => runSubscriptionAction(noti, 'discard', () => onDiscardSubscription(noti))}
                    disabled={hideSensitive || isPending}
                    title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                    className="min-h-10 min-w-0 whitespace-nowrap rounded-xl border-border/50 bg-muted/30 px-3 py-2 text-muted-foreground disabled:cursor-wait disabled:opacity-70 sm:min-h-9 sm:flex-initial sm:rounded-lg sm:py-1.5"
                  >
                    {pendingAction === 'discard'
                      ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Discarding…</span>
                      : 'Discard'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => runSubscriptionAction(noti, 'remove', () => onRemoveSubscription(noti.recurringPaymentId))}
                    disabled={hideSensitive || isPending}
                    title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                    className="min-h-10 min-w-0 whitespace-nowrap rounded-xl px-3 py-2 disabled:cursor-wait disabled:opacity-70 sm:min-h-9 sm:flex-initial sm:rounded-lg sm:py-1.5"
                  >
                    {pendingAction === 'remove'
                      ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Removing…</span>
                      : 'Remove'}
                  </Button>
                </div>
            </div>
          </div>
          )
        })}
        </div>
      </>
      )}
    </BottomSheet>
  )
}
