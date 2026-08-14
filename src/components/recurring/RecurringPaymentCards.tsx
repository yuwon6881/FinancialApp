import React from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronRight, CreditCard, Edit, FastForward, Link2, Repeat, Trash2, Wallet } from 'lucide-react'
import type { RecurringPayment, RecurringReminderSettings } from '../../types'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import { isEligibleForPayEarly, normalizeRecurringFrequency, RECURRING_PAYMENT_MODE_LABELS } from '../../lib/recurringPayments'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { ToggleButton } from '../ui/ToggleButton'
import { getRecurrenceDescription } from './formatters'
import { ReminderControls } from './ReminderControls'
import { useHighlightedElement } from '../ui/useHighlightedElement'

interface RecurringPaymentCardsProps {
  payments: RecurringPayment[]
  totalCount: number
  hideSensitive: boolean
  formatSensitive: (val: number) => React.ReactNode
  isPaymentSyncing: (id: string | number) => boolean
  isPaymentDeleting: (id: string | number) => boolean
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onEditPayment: (payment: RecurringPayment) => void
  highlightedId?: string | null
  onClearHighlight?: () => void
  globalPushEnabled: boolean
  thisDevicePushEnabled?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
  onRequestPayEarly?: (id: string) => void
  onNavigateToLoan?: (loanId: string) => void
}

// Subscriptions Cards Grid
export const RecurringPaymentCards: React.FC<RecurringPaymentCardsProps> = ({
  payments,
  totalCount,
  hideSensitive,
  formatSensitive,
  isPaymentSyncing,
  isPaymentDeleting,
  onToggleActive,
  onDeletePayment,
  onEditPayment,
  highlightedId = null,
  onClearHighlight,
  globalPushEnabled,
  thisDevicePushEnabled,
  onUpdateReminder,
  onRequestPayEarly,
  onNavigateToLoan,
}) => {
  // When navigated here from the dashboard subscription card, scroll the target
  // card into view and apply a highlight ring that fades out on its own.
  useHighlightedElement(highlightedId ? `recur-card-${highlightedId}` : null, onClearHighlight)

  return (
    <m.div
      initial="hidden" animate="show"
      variants={listContainerVariants}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch"
    >
      <AnimatePresence>
      {payments.map(rp => {
        const isBusy = isPaymentDeleting(rp.id) || isPaymentSyncing(rp.id) || rp.isPendingSync
        return (
          <m.div
            key={rp.id}
            id={`recur-card-${rp.id}`}
            variants={listItemVariants}
            exit={listItemExit}
            className={`p-6 rounded-2xl bg-card border transition-all duration-300 flex flex-col ${
              rp.active
                ? 'border-border/60 hover:border-blue-500/30 shadow-xs'
                : 'border-dashed border-border/60 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 text-base font-bold text-foreground">
                    <span className="min-w-0 break-words">{rp.name}</span>
                    {!rp.active && (
                      <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Paused</span>
                    )}
                    <RowSyncStatus isDeleting={isPaymentDeleting(rp.id)} isSyncing={isPaymentSyncing(rp.id)} isPending={rp.isPendingSync} entityLabel="subscription" />
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}>
                      {rp.category}
                    </span>
                    {rp.linkedLoanId && (
                      <Button
                        variant="unstyled"
                        type="button"
                        onClick={() => onNavigateToLoan?.(rp.linkedLoanId!)}
                        className="inline-flex items-center gap-1 rounded border border-accent-ink/25 bg-accent/30 hover:bg-accent/50 text-accent-ink px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer"
                        title={`View linked loan: ${rp.linkedLoanName || 'Loan'}`}
                        aria-label={`View linked loan: ${rp.linkedLoanName || 'Loan'}`}
                      >
                        <Link2 className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[140px]">Linked to {rp.linkedLoanName || 'Loan'}</span>
                        <ChevronRight className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status Toggle Button */}
                <ToggleButton
                  active={rp.active}
                  onClick={() => onToggleActive(rp.id)}
                  label={`${rp.active ? 'Pause' : 'Resume'} ${rp.name}`}
                  disabled={isBusy || hideSensitive}
                />
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-foreground">{formatSensitive(Math.abs(rp.amount))}</span>
                <span className="text-xs text-muted-foreground">{normalizeRecurringFrequency(rp.frequency) === 'Annually' ? '/yr' : '/mo'}</span>
              </div>

              <div className="mt-6 space-y-2 border-t border-border/30 pt-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" /> Billing Starts
                  </span>
                  <span className="min-w-0 max-w-full break-words text-right font-medium text-foreground">
                    {rp.startDate}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Repeat className="size-3.5" /> Recurs
                  </span>
                  <span className="min-w-0 max-w-full break-words text-right font-medium text-foreground">
                    {getRecurrenceDescription(normalizeRecurringFrequency(rp.frequency), rp.startDate, rp.dueDate)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <CreditCard className="size-3.5" /> Ledger Category
                  </span>
                  <span className={`inline-block max-w-full break-words px-1.5 py-0.5 text-right rounded-md border font-semibold ${getCategoryBadgeClass(rp.ledgerCategory)}`}>
                    {rp.ledgerCategory}
                  </span>
                </div>
                {/* Stated on every card because it is the reason Pay Early is or isn't offered
                    below -- without it, an auto-deducted bill just looks like a card missing a
                    button. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Wallet className="size-3.5" /> How it&rsquo;s paid
                  </span>
                  <span className="min-w-0 max-w-full break-words text-right font-medium text-foreground">
                    {RECURRING_PAYMENT_MODE_LABELS[rp.paymentMode]}
                  </span>
                </div>
                {rp.endDate && (
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-3.5" /> End Date
                    </span>
                    <span className="min-w-0 max-w-full break-words text-right font-medium text-foreground">{rp.endDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* mt-auto keeps the reminder + action rows flush with the bottom of the
                card, so cards in a row line up even when reminders are toggled off. */}
            <div className="mt-auto">
              <ReminderControls
                payment={rp}
                globalPushEnabled={globalPushEnabled}
                thisDevicePushEnabled={thisDevicePushEnabled}
                disabled={isBusy || hideSensitive}
                isSyncing={isPaymentSyncing(rp.id)}
                onUpdateReminder={onUpdateReminder}
              />

              <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-4 gap-2">
                {isEligibleForPayEarly(rp) ? (
                  <Button
                    variant="ghost"
                    onClick={() => onRequestPayEarly?.(rp.id)}
                    disabled={isBusy || hideSensitive}
                    aria-label={`Pay Early for ${rp.name}`}
                    title={hideSensitive ? 'Unhide balances to pay early' : 'Pay this subscription now'}
                  >
                    <FastForward className="size-3.5 shrink-0" /> <span className="max-[420px]:hidden">Pay Early</span>
                  </Button>
                ) : <span />}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => onEditPayment(rp)}
                    disabled={isBusy || hideSensitive}
                    aria-label={`Edit ${rp.name}`}
                    title={hideSensitive ? 'Unhide balances to edit' : 'Edit subscription'}
                  >
                    <Edit className="size-3.5 shrink-0" /> <span className="max-[420px]:hidden">Edit</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => { if (!hideSensitive) onDeletePayment(rp.id) }}
                    disabled={isBusy || hideSensitive || Boolean(rp.linkedLoanId)}
                    aria-label={`Delete ${rp.name}`}
                    title={hideSensitive
                      ? 'Unhide balances to edit'
                      : rp.linkedLoanId
                        ? `Linked to ${rp.linkedLoanName || 'a loan'} and cannot be deleted`
                        : 'Delete subscription'}
                  >
                    <Trash2 className="size-3.5 shrink-0" /> <span className="max-[420px]:hidden">Delete</span>
                  </Button>
                </div>
              </div>
            </div>
          </m.div>
        )
      })}
      </AnimatePresence>

      {payments.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-28 items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left text-sm text-muted-foreground md:col-span-3 sm:min-h-36 sm:flex-col sm:justify-center sm:gap-3 sm:p-12 sm:text-center"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border/60 bg-muted/35 text-accent-ink sm:size-11">
            <Repeat className="size-5" aria-hidden="true" />
          </span>
          <p className="min-w-0 max-w-md leading-relaxed">
            {totalCount > 0
              ? 'No subscriptions match your filter criteria.'
              : 'You don\'t have any subscriptions yet. Click “New Subscription” above to create one.'
            }
          </p>
        </div>
      )}
    </m.div>
  )
}
