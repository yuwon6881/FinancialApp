import { useEffect, useRef, useState } from 'react'
import type { PendingNotification } from '../types'
import { formatCurrencyVal } from '../lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { BottomSheet } from './ui/BottomSheet'
import { Checkbox } from './ui/Checkbox'
import { DatePicker } from './ui/DatePicker'
import { InfoHint } from './ui/InfoHint'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { SensitiveMask } from './ui/SensitiveAmount'
import { Button } from './ui/Button'
import { MutationButtonContent } from './ui/MutationButtonContent'
import { AlertCircle, BellRing, CheckCircle2, CircleDollarSign } from 'lucide-react'
import { financialDate } from '../lib/financialDate'

interface PendingSubscriptionsModalProps {
  isOpen: boolean
  pendingNotifications: PendingNotification[]
  currency: string
  hideSensitive: boolean
  onClose: () => void
  onConfirmSubscription: (noti: PendingNotification, paidDate: string, amount?: number) => void
  onDiscardSubscription: (noti: PendingNotification) => void
  onRemoveSubscription: (recurringPaymentId: string) => void
}

type PaymentAmountState =
  | { kind: 'full'; due: number }
  | { kind: 'partial'; amount: number; remaining: number; due: number }
  | { kind: 'invalid'; error: string; due: number }

export function PendingSubscriptionsModal({
  isOpen,
  pendingNotifications,
  currency,
  hideSensitive,
  onClose,
  onConfirmSubscription,
  onDiscardSubscription,
  onRemoveSubscription
}: PendingSubscriptionsModalProps) {
  const [paidDates, setPaidDates] = useState<Record<string, string>>({})
  const [paidAmounts, setPaidAmounts] = useState<Record<string, string>>({})
  const [partialModes, setPartialModes] = useState<Record<string, boolean>>({})
  const [pendingActions, setPendingActions] = useState<Record<string, 'confirm' | 'discard' | 'remove'>>({})

  const prevAmountsRef = useRef<Record<string, number>>({})

  const paymentAmountStateFor = (noti: PendingNotification): PaymentAmountState => {
    const due = Math.abs(noti.amount)
    const isPartial = Boolean(partialModes[noti.id])
    if (!isPartial) {
      return { kind: 'full', due }
    }
    const raw = (paidAmounts[noti.id] ?? '').trim()
    if (raw === '') {
      return {
        kind: 'invalid',
        due,
        error: hideSensitive
          ? 'Enter a part payment amount.'
          : `Enter an amount less than ${formatCurrencyVal(due, currency)}.`
      }
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return {
        kind: 'invalid',
        due,
        error: 'Enter an amount greater than zero, or uncheck to pay in full.'
      }
    }
    if (parsed >= due) {
      return {
        kind: 'invalid',
        due,
        error: hideSensitive
          ? 'Part payment must be less than the bill total. Uncheck to pay in full.'
          : `Part payment must be less than ${formatCurrencyVal(due, currency)}. Uncheck to pay in full.`
      }
    }
    return { kind: 'partial', amount: parsed, remaining: due - parsed, due }
  }

  // Only a genuine part payment is sent as an amount when partial mode is actively chosen.
  // Full mode or undefined amount settles the full occurrence.
  const partialAmountFor = (noti: PendingNotification): number | undefined => {
    if (!partialModes[noti.id]) return undefined
    const amountState = paymentAmountStateFor(noti)
    return amountState.kind === 'partial' ? amountState.amount : undefined
  }

  useEffect(() => {
    if (!isOpen) {
      setPendingActions({})
      setPaidAmounts({})
      setPartialModes({})
      setPaidDates({})
      prevAmountsRef.current = {}
      return
    }
    const visibleIds = new Set(pendingNotifications.map(notification => notification.id))
    setPendingActions(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => {
        if (!visibleIds.has(id)) return false
        const noti = pendingNotifications.find(n => n.id === id)
        const prevAmount = prevAmountsRef.current[id]
        if (noti && prevAmount !== undefined && prevAmount !== noti.amount) {
          return false
        }
        return true
      }),
    ))
    setPaidAmounts(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => {
        if (!visibleIds.has(id)) return false
        const noti = pendingNotifications.find(n => n.id === id)
        const prevAmount = prevAmountsRef.current[id]
        if (noti && prevAmount !== undefined && prevAmount !== noti.amount) {
          return false
        }
        return true
      }),
    ))
    setPartialModes(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => {
        if (!visibleIds.has(id)) return false
        const noti = pendingNotifications.find(n => n.id === id)
        const prevAmount = prevAmountsRef.current[id]
        if (noti && prevAmount !== undefined && prevAmount !== noti.amount) {
          return false
        }
        return true
      }),
    ))
    prevAmountsRef.current = Object.fromEntries(
      pendingNotifications.map(n => [n.id, n.amount]),
    )
  }, [isOpen, pendingNotifications])

  useEffect(() => {
    if (hideSensitive) {
      setPaidAmounts({})
      setPartialModes({})
    }
  }, [hideSensitive])

  const runSubscriptionAction = (
    noti: PendingNotification,
    action: 'confirm' | 'discard' | 'remove',
    callback: () => void,
  ) => {
    const isPartial = action === 'confirm' && partialAmountFor(noti) !== undefined
    if (isPartial) {
      callback()
      setPaidAmounts(prev => ({ ...prev, [noti.id]: '' }))
      setPartialModes(prev => ({ ...prev, [noti.id]: false }))
      setPendingActions(current => {
        const next = { ...current }
        delete next[noti.id]
        return next
      })
    } else {
      setPendingActions(current => ({ ...current, [noti.id]: action }))
      callback()
    }
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
        <div className="flex justify-end">
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
          const amountState = paymentAmountStateFor(noti)
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

            <div className="space-y-3 border-t border-border/30 pt-3">
              <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isPending ? 'pointer-events-none opacity-70' : ''}`}>
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-muted-foreground">Paid Date</span>
                  <DatePicker
                    value={paidDates[noti.id] ?? noti.billingDate}
                    onChange={value => setPaidDates(prev => ({ ...prev, [noti.id]: value }))}
                    max={financialDate()}
                    align="left"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`partial-toggle-${noti.id}`}
                      className="flex cursor-pointer items-center gap-2 select-none"
                    >
                      <Checkbox
                        id={`partial-toggle-${noti.id}`}
                        checked={Boolean(partialModes[noti.id])}
                        onChange={event => {
                          const checked = event.target.checked
                          setPartialModes(prev => ({ ...prev, [noti.id]: checked }))
                          if (!checked) {
                            setPaidAmounts(prev => ({ ...prev, [noti.id]: '' }))
                          }
                        }}
                        disabled={hideSensitive || isPending}
                      />
                      <span className="text-xs font-bold text-foreground">Pay partial amount</span>
                    </label>
                    <InfoHint
                      label="Part payment info"
                      text="By default bills are paid in full. Check this to record a smaller part payment now; the remainder stays due."
                    />
                  </div>

                  {partialModes[noti.id] && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`pending-amount-${noti.id}`}
                          className="block text-xs font-semibold text-muted-foreground"
                        >
                          Amount paid
                        </label>
                        <span className="text-xs font-medium text-muted-foreground">
                          Max {hideSensitive ? '•••' : `< ${formatCurrencyVal(amountState.due, currency)}`}
                        </span>
                      </div>
                      <SmartAmountInput
                        id={`pending-amount-${noti.id}`}
                        type="text"
                        inputMode="decimal"
                        value={paidAmounts[noti.id] ?? ''}
                        onChange={event => setPaidAmounts(prev => ({ ...prev, [noti.id]: event.target.value }))}
                        placeholder={hideSensitive ? '' : '0.00'}
                        disabled={hideSensitive}
                        aria-invalid={amountState.kind === 'invalid' || undefined}
                        aria-describedby={`pending-amount-hint-${noti.id}`}
                        className="w-full font-medium"
                      />
                    </div>
                  )}

                  <div
                    id={`pending-amount-hint-${noti.id}`}
                    role="status"
                    aria-live="polite"
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs leading-relaxed ${
                      amountState.kind === 'invalid'
                        ? 'border-destructive/20 bg-destructive/10 text-destructive'
                        : 'border-border/60 bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    {amountState.kind === 'full' ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                    ) : amountState.kind === 'partial' ? (
                      <CircleDollarSign className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {amountState.kind === 'full' ? (
                        <>
                          <strong className="font-bold text-foreground">Full payment selected{hideSensitive ? '' : ` · ${formatCurrencyVal(amountState.due, currency)}`}.</strong>{' '}
                          {hideSensitive
                            ? 'Amounts are hidden while sensitive mode is on.'
                            : 'Settles this bill in full and advances to the next cycle.'}
                        </>
                      ) : amountState.kind === 'partial' ? (
                        <>
                          <strong className="font-bold text-foreground">Part payment{hideSensitive ? '' : ` · ${formatCurrencyVal(amountState.amount, currency)}`}.</strong>{' '}
                          {hideSensitive
                            ? 'Amounts are hidden while sensitive mode is on.'
                            : `${formatCurrencyVal(amountState.remaining, currency)} remains due.`}
                        </>
                      ) : (
                        <strong className="font-bold">{amountState.error}</strong>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 pt-1 sm:flex sm:w-auto sm:items-center sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={() => runSubscriptionAction(noti, 'discard', () => onDiscardSubscription(noti))}
                  disabled={hideSensitive || isPending}
                  title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                  className="min-h-10 min-w-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-70 sm:min-h-9 sm:flex-initial sm:rounded-lg sm:py-1.5"
                >
                  <MutationButtonContent
                    state={pendingAction === 'discard' ? 'syncing' : null}
                    entityLabel={noti.name}
                    idleLabel="Discard"
                    busyLabel="Discarding…"
                  />
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => onRemoveSubscription(noti.recurringPaymentId)}
                  disabled={hideSensitive || isPending}
                  title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                  className="min-h-10 min-w-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs disabled:cursor-wait disabled:opacity-70 sm:min-h-9 sm:flex-initial sm:rounded-lg sm:py-1.5"
                >
                  Remove
                </Button>
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
                  disabled={hideSensitive || isPending || amountState.kind === 'invalid'}
                  title={hideSensitive ? 'Show sensitive information to change bills' : undefined}
                  className="col-span-2 min-h-10 min-w-0 justify-center whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold shadow-sm disabled:cursor-wait disabled:opacity-70 sm:col-span-1 sm:min-h-9 sm:flex-initial sm:rounded-lg sm:px-3 sm:py-1.5"
                >
                  <MutationButtonContent
                    state={pendingAction === 'confirm' ? 'syncing' : null}
                    entityLabel={noti.name}
                    idleLabel="Confirm Paid"
                    busyLabel="Confirming…"
                  />
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
