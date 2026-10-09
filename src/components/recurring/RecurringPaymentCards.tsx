import React from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ChevronRight, FastForward, Link2, Pencil, Repeat, Trash2 } from 'lucide-react'
import type { RecurringPayment, RecurringReminderSettings } from '../../types'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import { hasBillingEnded, isEligibleForPayEarly, normalizeRecurringFrequency, RECURRING_PAYMENT_MODE_LABELS } from '../../lib/recurringPayments'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'
import { LedgerAllocationBadge } from '../ledger/LedgerAllocationBadge'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { IconButton } from '../ui/IconButton'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { ToggleButton } from '../ui/ToggleButton'
import { getRecurrenceDescription } from './formatters'
import { ReminderControls } from './ReminderControls'
import { useHighlightedElement } from '../ui/useHighlightedElement'
import { DataTablePagination } from '../ui/DataTable'
import { useClientPagination } from '../ui/useClientPagination'

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
  const highlightedIndex = highlightedId ? payments.findIndex(payment => payment.id === highlightedId) : -1
  const pagination = useClientPagination(payments.length, 9, highlightedIndex)
  const visiblePayments = payments.slice(pagination.start, pagination.end)
  // When navigated here from the dashboard subscription card, scroll the target
  // card into view and apply a highlight ring that fades out on its own.
  useHighlightedElement(highlightedId ? `recur-card-${highlightedId}` : null, onClearHighlight)

  return (
    <div className="space-y-4">
    <m.div
      initial="hidden" animate="show"
      variants={listContainerVariants}
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-3"
    >
      <AnimatePresence>
      {visiblePayments.map(rp => {
        const isBusy = isPaymentDeleting(rp.id) || isPaymentSyncing(rp.id) || rp.isPendingSync
        const isEnded = hasBillingEnded(rp)
        return (
          <m.div
            key={rp.id}
            id={`recur-card-${rp.id}`}
            variants={listItemVariants}
            exit={listItemExit}
            className={cn(
              panelClass,
              'flex flex-col p-5 transition-colors',
              !(rp.active && !isEnded) && 'border-dashed opacity-70',
            )}
          >
            <div className="flex items-start gap-3">
              <CategoryIcon category={rp.category} />
              <div className="min-w-0 flex-1">
                <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 text-subsection text-foreground">
                  <span className="min-w-0 break-words">{rp.name}</span>
                  {(!rp.active || isEnded) && <Badge tone="neutral">{isEnded ? 'Ended' : 'Paused'}</Badge>}
                  <RowSyncStatus isDeleting={isPaymentDeleting(rp.id)} isSyncing={isPaymentSyncing(rp.id)} isPending={rp.isPendingSync} entityLabel="subscription" />
                </h3>
                <p className="mt-0.5 truncate text-label text-muted-foreground">{rp.category}</p>
              </div>
              {/* Status Toggle Button */}
              <ToggleButton
                active={rp.active}
                onClick={() => onToggleActive(rp.id)}
                label={`${rp.active ? 'Pause' : 'Resume'} ${rp.name}`}
                disabled={isBusy || hideSensitive}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-title text-foreground tabular-nums">{formatSensitive(Math.abs(rp.amount))}</span>
                <span className="text-label text-muted-foreground">{normalizeRecurringFrequency(rp.frequency) === 'Annually' ? '/yr' : '/mo'}</span>
              </div>
              {rp.active && !isEnded && (
                <span className="text-caption text-muted-foreground tabular-nums">
                  ≈ {formatSensitive(Math.abs(rp.amount) * (normalizeRecurringFrequency(rp.frequency) === 'Annually' ? 1 : 12) / 365)} / day
                </span>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-label">
              <dt className="text-muted-foreground">Recurs</dt>
              <dd className="min-w-0 text-right text-foreground">{getRecurrenceDescription(normalizeRecurringFrequency(rp.frequency), rp.startDate, rp.dueDate)}</dd>
              {/* Stated on every card because it is the reason Pay Early is or isn't offered
                  below -- without it, an auto-deducted bill just looks like a card missing a
                  button. */}
              <dt className="text-muted-foreground">How it&rsquo;s paid</dt>
              <dd className="min-w-0 text-right text-foreground">{RECURRING_PAYMENT_MODE_LABELS[rp.paymentMode]}</dd>
              <dt className="text-muted-foreground">Bucket</dt>
              <dd className="min-w-0 text-right"><LedgerAllocationBadge ledgerCategory={rp.ledgerCategory} transactionId={rp.id} /></dd>
              <dt className="text-muted-foreground">Starts</dt>
              <dd className="min-w-0 text-right text-foreground tabular-nums">{rp.startDate}</dd>
              {rp.endDate && (
                <>
                  <dt className="text-muted-foreground">Ends</dt>
                  <dd className="min-w-0 text-right text-foreground tabular-nums">{rp.endDate}</dd>
                </>
              )}
            </dl>

            {rp.linkedLoanId && (
              <a
                href={`/recurring?loan=${encodeURIComponent(rp.linkedLoanId)}`}
                onClick={event => {
                  if (!onNavigateToLoan || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onNavigateToLoan(rp.linkedLoanId!)
                }}
                className="mt-3 inline-flex min-h-9 max-w-full items-center gap-1.5 self-start rounded-full bg-primary/8 px-3 text-label font-medium text-accent-ink transition hover:bg-primary/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                title={`View linked loan: ${rp.linkedLoanName || 'Loan'}`}
                aria-label={`View linked loan: ${rp.linkedLoanName || 'Loan'}`}
              >
                <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Linked to {rp.linkedLoanName || 'Loan'}</span>
                <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
              </a>
            )}

            {/* mt-auto keeps the reminder + action rows flush with the bottom of the
                card, so cards in a row line up even when reminders are toggled off. */}
            <div className="mt-auto">
              <ReminderControls
                payment={rp}
                globalPushEnabled={globalPushEnabled}
                thisDevicePushEnabled={thisDevicePushEnabled}
                disabled={isBusy || hideSensitive || isEnded}
                isSyncing={isPaymentSyncing(rp.id)}
                onUpdateReminder={onUpdateReminder}
              />

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                {isEligibleForPayEarly(rp) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRequestPayEarly?.(rp.id)}
                    disabled={isBusy || hideSensitive}
                    aria-label={`Pay Early for ${rp.name}`}
                    title={hideSensitive ? 'Unhide balances to pay early' : 'Pay this subscription now'}
                  >
                    <FastForward className="size-3.5 shrink-0" aria-hidden="true" /> Pay early
                  </Button>
                ) : <span />}
                <div className="flex items-center gap-0.5">
                  <IconButton
                    onClick={() => onEditPayment(rp)}
                    disabled={isBusy || hideSensitive}
                    label={`Edit ${rp.name}`}
                    tooltip={hideSensitive ? 'Unhide balances to edit' : 'Edit subscription'}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    onClick={() => { if (!hideSensitive) onDeletePayment(rp.id) }}
                    disabled={isBusy || hideSensitive || Boolean(rp.linkedLoanId)}
                    label={`Delete ${rp.name}`}
                    tooltip={hideSensitive
                      ? 'Unhide balances to edit'
                      : rp.linkedLoanId
                        ? `Linked to ${rp.linkedLoanName || 'a loan'} and cannot be deleted`
                        : 'Delete subscription'}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconButton>
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
          className="flex min-h-28 items-center gap-3 rounded-panel bg-surface-2/70 p-4 text-left text-body text-muted-foreground lg:col-span-2 2xl:col-span-3 sm:min-h-36 sm:flex-col sm:justify-center sm:gap-3 sm:p-12 sm:text-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
            <Repeat className="size-5" aria-hidden="true" />
          </span>
          <p className="min-w-0 max-w-md leading-relaxed">
            {totalCount > 0
              ? 'No subscriptions match your filter criteria.'
              : 'Add a recurring bill, loan, or subscription above to track it here.'
            }
          </p>
        </div>
      )}
    </m.div>
    {payments.length > pagination.pageSize && (
      <DataTablePagination
        centerOnMobile
        currentPage={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={payments.length}
        totalPages={pagination.totalPages}
        showPageSize={false}
        onPageChange={pagination.setPage}
        onPageSizeChange={() => undefined}
      />
    )}
    </div>
  )
}
