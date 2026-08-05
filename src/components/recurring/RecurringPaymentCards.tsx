import React from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Calendar, CreditCard, Edit, FastForward, Repeat, Trash2 } from 'lucide-react'
import type { RecurringPayment, RecurringReminderSettings } from '../../types'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import { isEligibleForPayEarly, normalizeRecurringFrequency } from '../../lib/recurringPayments'
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
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
  onRequestPayEarly?: (id: string) => void
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
  onUpdateReminder,
  onRequestPayEarly,
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
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                    {rp.name}
                    {!rp.active && (
                      <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Paused</span>
                    )}
                    <RowSyncStatus isDeleting={isPaymentDeleting(rp.id)} isSyncing={isPaymentSyncing(rp.id)} isPending={rp.isPendingSync} entityLabel="subscription" />
                  </h3>
                  <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}>
                    {rp.category}
                  </span>
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
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> Billing Starts
                  </span>
                  <span className="text-foreground font-medium">
                    {rp.startDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Repeat className="size-3.5" /> Recurs
                  </span>
                  <span className="text-foreground font-medium">
                    {getRecurrenceDescription(normalizeRecurringFrequency(rp.frequency), rp.startDate, rp.dueDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="size-3.5" /> Ledger Category
                  </span>
                  <span className={`inline-block px-1.5 py-0.5 rounded-md border font-semibold ${getCategoryBadgeClass(rp.ledgerCategory)}`}>
                    {rp.ledgerCategory}
                  </span>
                </div>
                {rp.endDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5" /> End Date
                    </span>
                    <span className="text-foreground font-medium">{rp.endDate}</span>
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
                    title={hideSensitive ? 'Unhide balances to edit' : 'Edit subscription'}
                  >
                    <Edit className="size-3.5 shrink-0" /> <span className="max-[420px]:hidden">Edit</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => { if (!hideSensitive) onDeletePayment(rp.id) }}
                    disabled={isBusy || hideSensitive}
                    title={hideSensitive ? 'Unhide balances to edit' : 'Delete subscription'}
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
        <div className="p-12 text-center border border-dashed border-border rounded-2xl md:col-span-3 text-muted-foreground text-sm">
          {totalCount > 0
            ? 'No subscriptions match your filter criteria.'
            : 'You don\'t have any subscription added yet. Click "New Subscription" above to create one.'
          }
        </div>
      )}
    </m.div>
  )
}
