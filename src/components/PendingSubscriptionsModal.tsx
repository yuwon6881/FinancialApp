import { useEffect, useRef, useState } from 'react'
import type { PendingNotification } from '../types'
import { cn, formatCurrencyVal } from '../lib/utils'
import { BottomSheet } from './ui/BottomSheet'
import { ToggleButton } from './ui/ToggleButton'
import { DatePicker } from './ui/DatePicker'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { SensitiveMask } from './ui/SensitiveAmount'
import { Button } from './ui/Button'
import { MutationButtonContent } from './ui/MutationButtonContent'
import { Meter } from './ui/Meter'
import { AlertCircle, BellRing, CalendarClock, CheckCircle2, CircleDollarSign, Trash2 } from 'lucide-react'
import { CategoryIcon } from './ui/CategoryIcon'
import { financialDate } from '../lib/financialDate'

// Quick fills for the common "half now, half later" cases. All stay strictly below the total,
// so a quick fill can never be mistaken for a full settlement.
const QUICK_FRACTIONS = [0.25, 0.5, 0.75] as const

const quickFractionAmount = (due: number, fraction: number) => (Math.round(due * fraction * 100) / 100).toFixed(2)

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

  const headingRef = useRef<HTMLDivElement>(null)
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

  const today = financialDate()
  const totalDue = pendingNotifications.reduce((sum, noti) => sum + Math.abs(noti.amount), 0)
  const isEmpty = pendingNotifications.length === 0

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName={isEmpty ? 'max-w-md' : 'max-w-2xl'}
      initialFocusRef={headingRef}
      layerClassName="z-[300]"
      backdropClassName="max-sm:p-2"
      panelClassName="max-sm:gap-3 max-sm:p-4"
      title={
        <div ref={headingRef} tabIndex={-1} className="flex items-center gap-2.5 outline-none">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-300">
            <BellRing className="size-4" />
          </span>
          <span className="text-section text-foreground">Bills to review</span>
        </div>
      }
      description={isEmpty ? undefined : (
        <span className="text-label text-muted-foreground">
          {pendingNotifications.length} {pendingNotifications.length === 1 ? 'bill' : 'bills'}
          {' · '}
          {hideSensitive ? <SensitiveMask /> : <span className="tabular-nums text-foreground">{formatCurrencyVal(totalDue, currency)}</span>}
          {' '}to confirm
        </span>
      )}
      footer={
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </div>
      }
    >
      {isEmpty ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
          <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-7" />
          </span>
          <h3 className="mt-4 text-section text-foreground">All caught up</h3>
          <p className="mt-1 max-w-xs text-body text-muted-foreground">
            When a bill comes due, it waits here so you can confirm what was paid.
          </p>
        </div>
      ) : (
        <div key={isOpen ? 'open' : 'closed'} className="space-y-3">
        {pendingNotifications.map((noti) => {
          const pendingAction = pendingActions[noti.id]
          const isPending = pendingAction !== undefined
          const amountState = paymentAmountStateFor(noti)
          const isPartial = Boolean(partialModes[noti.id])
          const paidPercent = amountState.kind === 'partial' ? (amountState.amount / amountState.due) * 100 : 0
          return (
          <article
            key={noti.id}
            aria-label={noti.name}
            className={cn(
              'space-y-4 rounded-[1.125rem] bg-surface-2/60 p-4 ring-1 ring-inset transition-shadow duration-200 sm:p-5',
              isPartial ? 'ring-primary/30' : 'ring-border/50',
            )}
          >
            <header className="flex items-start gap-3">
              <CategoryIcon category={noti.category} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-subsection text-foreground">{noti.name}</h3>
                  <span className="shrink-0 text-subsection tabular-nums text-foreground">
                    {hideSensitive ? <SensitiveMask /> : formatCurrencyVal(Math.abs(noti.amount), currency)}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-muted-foreground">
                  <span>{noti.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Due {formatDueDate(noti.billingDate)}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-amber-700 dark:text-amber-300">{dueDistance(noti.billingDate, today)}</span>
                </p>
              </div>
            </header>

            <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4', isPending && 'pointer-events-none opacity-70')}>
              <div className="space-y-1.5">
                <span className="block text-label text-muted-foreground">Paid on</span>
                <DatePicker
                  value={paidDates[noti.id] ?? noti.billingDate}
                  onChange={value => setPaidDates(prev => ({ ...prev, [noti.id]: value }))}
                  max={today}
                  align="left"
                  className="w-full"
                />
              </div>
              <div className="flex min-h-11 items-center gap-1 rounded-control bg-card/70 pr-3.5 sm:h-11">
                <ToggleButton
                  active={isPartial}
                  label={`Pay partial amount for ${noti.name}`}
                  onClick={() => {
                    const checked = !partialModes[noti.id]
                    setPartialModes(prev => ({ ...prev, [noti.id]: checked }))
                    if (!checked) {
                      setPaidAmounts(prev => ({ ...prev, [noti.id]: '' }))
                    }
                  }}
                  disabled={hideSensitive || isPending}
                />
                <span className="text-label text-foreground">Pay partial amount</span>
              </div>
            </div>

            {isPartial && (
              <div className={cn('space-y-3 rounded-control bg-card/70 p-3 sm:p-4', isPending && 'pointer-events-none opacity-70')}>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`pending-amount-${noti.id}`}
                    className="block text-label text-muted-foreground"
                  >
                    Amount paid
                  </label>
                  <span className="text-caption text-muted-foreground">
                    Less than {hideSensitive ? '•••' : formatCurrencyVal(amountState.due, currency)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Quick part payment">
                    {QUICK_FRACTIONS.map(fraction => {
                      const value = quickFractionAmount(amountState.due, fraction)
                      const label = `${fraction * 100}%`
                      const selected = paidAmounts[noti.id] !== undefined
                        && paidAmounts[noti.id] !== ''
                        && Number(paidAmounts[noti.id]) === Number(value)
                      return (
                        <Button
                          key={fraction}
                          variant={selected ? 'primary' : 'secondary'}
                          size="sm"
                          aria-pressed={selected}
                          disabled={hideSensitive}
                          onClick={() => setPaidAmounts(prev => ({ ...prev, [noti.id]: value }))}
                          className="w-full tabular-nums sm:w-16"
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
                {amountState.kind === 'partial' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
                      <span>Paid now</span>
                      <span className="tabular-nums text-foreground">{Math.round(paidPercent)}%</span>
                    </div>
                    <Meter
                      percent={paidPercent}
                      label={`${noti.name} paid now`}
                      tone="bg-primary"
                      valueHidden={hideSensitive}
                    />
                  </div>
                )}
                {amountState.kind !== 'full' && (
                  <div
                    id={`pending-amount-hint-${noti.id}`}
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'flex items-start gap-2 text-caption',
                      amountState.kind === 'invalid' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {amountState.kind === 'partial' ? (
                      <CircleDollarSign className="mt-px size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {amountState.kind === 'partial' ? (
                        hideSensitive
                          ? 'Part payment'
                          : <><strong className="font-semibold text-foreground">{formatCurrencyVal(amountState.amount, currency)}</strong> now · {formatCurrencyVal(amountState.remaining, currency)} remains due</>
                      ) : (
                        <strong className="font-medium">{amountState.error}</strong>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-4 sm:flex sm:items-center">
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
                size="sm"
                className="col-span-2 min-w-0 justify-center whitespace-nowrap px-5 disabled:cursor-wait disabled:opacity-70 sm:order-3 sm:min-w-36"
              >
                <MutationButtonContent
                  state={pendingAction === 'confirm' ? 'syncing' : null}
                  entityLabel={noti.name}
                  idleLabel="Confirm Paid"
                  busyLabel="Confirming…"
                />
              </Button>
              <Button
                variant="secondary"
                onClick={() => runSubscriptionAction(noti, 'discard', () => onDiscardSubscription(noti))}
                disabled={hideSensitive || isPending}
                title={hideSensitive ? 'Show sensitive information to change bills' : 'Skip this occurrence without recording a payment'}
                size="sm"
                className="min-w-0 whitespace-nowrap px-4 disabled:cursor-wait disabled:opacity-70 sm:order-2 sm:ml-auto"
              >
                <MutationButtonContent
                  state={pendingAction === 'discard' ? 'syncing' : null}
                  entityLabel={noti.name}
                  idleLabel="Discard"
                  busyLabel="Discarding…"
                />
              </Button>
              <Button
                variant="tertiary"
                onClick={() => onRemoveSubscription(noti.recurringPaymentId)}
                disabled={hideSensitive || isPending}
                title={hideSensitive ? 'Show sensitive information to change bills' : 'Stop tracking this bill'}
                size="sm"
                className="min-w-0 gap-1.5 whitespace-nowrap px-3 text-red-600 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-wait disabled:opacity-70 sm:order-1 dark:text-red-400 dark:hover:text-red-400"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </article>
          )
        })}
        </div>
      )}
    </BottomSheet>
  )
}

const DUE_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** "Oct 5" from "2026-10-05"; the stored value is a calendar date, so it is read as UTC. */
function formatDueDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? isoDate : DUE_DATE_FORMAT.format(date)
}

/** How long ago a bill came due, counted in calendar days against the financial day. */
function dueDistance(isoDate: string, today: string): string {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${isoDate}T00:00:00Z`)) / 86_400_000)
  if (!Number.isFinite(days) || days <= 0) return days < 0 ? `in ${-days} ${-days === 1 ? 'day' : 'days'}` : 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
