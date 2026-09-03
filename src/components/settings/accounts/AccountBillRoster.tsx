import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AccountBillRoster as AccountBillRosterType, AccountBillSummary } from '../../../lib/accountBillRoster'
import { formatBillDueDate, isBillDueSoon } from '../../../lib/accountBillRoster'
import { hasBillingEnded, RECURRING_PAYMENT_MODE_LABELS } from '../../../lib/recurringPayments'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { navigateToAppTab } from '../../../lib/appLocation'
import { Button } from '../../ui/Button'
import { InfoHint } from '../../ui/InfoHint'
import { SensitiveAmount } from '../../ui/SensitiveAmount'

export interface AccountBillRosterProps {
  roster?: AccountBillRosterType
  currency: string
  hideSensitive: boolean
  onNavigateToRecurring?: (recurringId: string) => void
}

function BillItemRow({
  summary,
  currency,
  hideSensitive,
  onNavigate,
  isPaused = false,
}: {
  summary: AccountBillSummary
  currency: string
  hideSensitive: boolean
  onNavigate: (id: string) => void
  isPaused?: boolean
}) {
  const { payment, nextDueDate } = summary
  const dueFormatted = formatBillDueDate(nextDueDate)
  const isEnded = hasBillingEnded(payment)
  const isDueSoon = !isPaused && isBillDueSoon(nextDueDate)
  const modeLabel = RECURRING_PAYMENT_MODE_LABELS[payment.paymentMode] ?? payment.paymentMode

  return (
    <div
      data-testid={`bill-roster-item-${payment.id}`}
      className={`flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
        isPaused ? 'opacity-70' : ''
      }`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-foreground">
            {payment.name}
          </span>
          {/* The bill's own spending category, in the colour it already carries in the Ledger and
              the charts. This list was previously entirely grey, so a dozen bills read as one
              undifferentiated block and nothing said what kind of spending each one was. */}
          <span className={`rounded border px-1.5 py-0.2 text-xs font-semibold ${getCategoryBadgeClass(payment.category)}`}>
            {payment.category}
          </span>
          {payment.frequency === 'Annually' && (
            <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.2 text-xs font-medium text-muted-foreground">
              Annual
            </span>
          )}
          {payment.linkedLoanName && (
            <span className="rounded border border-border/60 bg-primary/10 px-1.5 py-0.2 text-xs font-medium text-accent-ink">
              {payment.linkedLoanName}
            </span>
          )}
          {isPaused && (
            <span className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.2 text-xs font-semibold text-muted-foreground">
              {isEnded ? 'Ended' : 'Paused'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {/* Auto-deduct is the one mode the bank moves on its own, and the only one that can
              overdraw this account without the user acting, so it is the mode worth a colour. */}
          <span className={payment.paymentMode === 'AutoDeduct' && !isPaused ? 'font-semibold text-blue-500' : ''}>
            {modeLabel}
          </span>
          {dueFormatted && (
            <>
              <span aria-hidden="true">·</span>
              {/* Amber is the app's needs-attention colour, so it is spent only on a bill that is
                  actually near, not on every date in the list. */}
              <span className={isDueSoon ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>
                Next {dueFormatted}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <SensitiveAmount
          value={payment.amount}
          isMasked={hideSensitive}
          formatFn={val => formatCurrencyVal(val, currency)}
          className="text-xs font-bold text-foreground"
        />

        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => onNavigate(payment.id)}
          aria-label={`View ${payment.name} in recurring bills`}
          className="h-7 px-2 text-xs"
        >
          View bill
        </Button>
      </div>
    </div>
  )
}

export function AccountBillRoster({
  roster,
  currency,
  hideSensitive,
  onNavigateToRecurring,
}: AccountBillRosterProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeBills = roster?.active ?? []
  const pausedBills = roster?.paused ?? []
  const totalCount = activeBills.length + pausedBills.length
  const monthlyTotal = roster?.monthlyTotal ?? 0

  const handleNavigate = (recurringId: string) => {
    if (onNavigateToRecurring) {
      onNavigateToRecurring(recurringId)
    } else {
      navigateToAppTab('recurring', { search: { subscription: recurringId } })
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  return (
    <details
      className="group/roster border-t border-border/30 pt-2"
      open={isOpen}
      onToggle={event => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>Bills paid from here · {totalCount}</span>
          {monthlyTotal > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <span>about</span>
                <SensitiveAmount
                  value={monthlyTotal}
                  isMasked={hideSensitive}
                  formatFn={val => formatCurrencyVal(val, currency)}
                  className="font-bold text-foreground"
                />
                <span>/ mo</span>
                <InfoHint
                  label="Monthly bill estimate"
                  text="Annual bills are averaged to a monthly equivalent (amount / 12)."
                />
              </span>
            </>
          )}
        </div>

        <ChevronDown
          className="size-3.5 shrink-0 transition-transform duration-200 group-open/roster:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="mt-2.5 space-y-3 pt-1">
        {totalCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-3 text-center text-xs text-muted-foreground">
            No recurring bills paid from this account.
          </div>
        ) : (
          <>
            {activeBills.length > 0 && (
              <div className="space-y-1.5">
                {activeBills.map(summary => (
                  <BillItemRow
                    key={summary.payment.id}
                    summary={summary}
                    currency={currency}
                    hideSensitive={hideSensitive}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}

            {pausedBills.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paused or ended bills ({pausedBills.length})
                </p>
                {pausedBills.map(summary => (
                  <BillItemRow
                    key={summary.payment.id}
                    summary={summary}
                    currency={currency}
                    hideSensitive={hideSensitive}
                    onNavigate={handleNavigate}
                    isPaused
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </details>
  )
}
