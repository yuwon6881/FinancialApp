import React from 'react'
import { ChevronRight } from 'lucide-react'
import type { ActiveRecurringPayment } from '../../types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { InteractiveCard } from '../ui/InteractiveCard'
import { SectionHeader } from '../ui/SectionHeader'
import { panelClass } from '../ui/panelStyles'

interface SubscriptionsTimelineCardProps {
  activeRecurring: ActiveRecurringPayment[]
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
  onNavigateToRecurring?: (recurringPaymentId: string) => void
  /** Kept for callers that key the list by cycle; the rows no longer animate in. */
  cycleKey?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDue(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  return `${MONTHS[month - 1]} ${day}`
}

/**
 * The cycle's bills and subscriptions as a compact list: what each was, when it fell due, and
 * whether it was paid. Every row opens that bill on the Bills page.
 */
export const SubscriptionsTimelineCard: React.FC<SubscriptionsTimelineCardProps> = ({
  activeRecurring,
  formatSensitive,
  onNavigate,
  onNavigateToRecurring,
}) => {
  const paidCount = activeRecurring.filter(rp => rp.isPaid && !rp.isDiscarded).length

  return (
    <section
      id="report-section-subscriptions"
      aria-labelledby="report-subscriptions-heading"
      data-testid="subscriptions-timeline-card"
      className="flex min-w-0 flex-col gap-3"
    >
      <SectionHeader
        titleId="report-subscriptions-heading"
        title="Subscriptions"
        description={activeRecurring.length > 0 ? `${paidCount} of ${activeRecurring.length} paid this cycle` : 'Bills due in this cycle'}
        actions={(
          <Button variant="tertiary" size="sm" onClick={() => onNavigate('recurring')} aria-label="Manage subscriptions" className="-mr-2 text-accent-ink">
            Manage
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      />
      <div className={cn(panelClass, 'flex-1 p-2')}>
        {activeRecurring.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center text-caption text-muted-foreground">No subscriptions for this cycle.</p>
        ) : (
          <ul>
            {activeRecurring.map(rp => {
              const status = rp.isDiscarded ? 'Discarded' : rp.isPaid ? 'Paid' : 'Pending'
              return (
                <li key={rp.id}>
                  <InteractiveCard
                    surface="plain"
                    onClick={() => (onNavigateToRecurring ? onNavigateToRecurring(rp.recurringPaymentId) : onNavigate('recurring'))}
                    className="group rounded-control px-2.5 py-2 hover:bg-surface-2 focus-visible:outline-offset-[-2px]"
                  >
                    <span className="flex min-h-10 min-w-0 items-center gap-3">
                      <span className={cn(rp.isDiscarded && 'opacity-50')}>
                        <CategoryIcon category={rp.category} size="sm" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-body font-medium', rp.isDiscarded ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {rp.name}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-caption">
                          <span
                            className={cn(
                              'shrink-0 font-medium',
                              status === 'Pending' ? 'text-amber-700 dark:text-amber-300' : status === 'Paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                            )}
                          >
                            {status}
                          </span>
                          <span className="min-w-0 truncate text-muted-foreground">· Due {formatDue(rp.dueDate)} · {rp.category}</span>
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-body font-medium tabular-nums', rp.isDiscarded ? 'text-muted-foreground line-through' : 'text-foreground')}>
                        {rp.amount == null ? 'Unavailable' : <>-{formatSensitive(rp.amount)}</>}
                      </span>
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
                    </span>
                  </InteractiveCard>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
