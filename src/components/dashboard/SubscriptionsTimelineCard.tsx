import React from 'react'
import { m, type Variants } from 'framer-motion'
import { Calendar, ChevronRight, CheckCircle2, Clock, Minus } from 'lucide-react'
import type { ActiveRecurringPayment } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'

interface SubscriptionsTimelineCardProps {
  activeRecurring: ActiveRecurringPayment[]
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
  onNavigateToRecurring?: (recurringPaymentId: string) => void
  cycleKey?: string
}

const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
}

const subItemVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
}

export const SubscriptionsTimelineCard: React.FC<SubscriptionsTimelineCardProps> = ({
  activeRecurring,
  formatSensitive,
  onNavigate,
  onNavigateToRecurring,
  cycleKey,
}) => {
  const containerKey = cycleKey || activeRecurring.map(r => r.id).join(',')

  return (
    <div data-testid="subscriptions-timeline-card" className="app-panel flex h-full min-w-0 flex-col rounded-2xl border border-border/60 bg-card/92 p-6 lg:max-h-[24rem]">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">Subscriptions</h3>
            <p className="text-[10px] text-muted-foreground">Bills for this selected cycle</p>
          </div>
          <Calendar className="size-4 text-blue-500 shrink-0" />
        </div>

        <m.div
          key={containerKey}
          initial="hidden"
          animate="show"
          variants={listContainerVariants}
          className="-mx-1 mt-3 flex-1 min-h-0 space-y-1.5 overflow-x-hidden overflow-y-auto p-1 no-scrollbar"
        >
          {activeRecurring.map((rp: ActiveRecurringPayment) => (
            <m.div
              key={rp.id}
              variants={subItemVariants}
              onClick={() => (onNavigateToRecurring ? onNavigateToRecurring(rp.recurringPaymentId) : onNavigate('recurring'))}
              className={`group relative flex items-center justify-between gap-2 text-xs py-2 pl-3 pr-2 rounded-xl border border-transparent cursor-pointer transition-colors duration-150 hover:bg-blue-500/[0.06] hover:border-blue-500/25 hover:shadow-xs ${rp.isDiscarded ? 'opacity-50' : ''}`}
            >
              {/* Accent bar that grows on hover to signal the row is clickable */}
              <span className="pointer-events-none absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full bg-blue-500 transition-all duration-200 group-hover:h-7" />

              <div className="min-w-0 flex-1">
                <span className={`font-bold text-foreground truncate block transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 ${rp.isDiscarded ? 'line-through' : ''}`}>{rp.name}</span>
                <div className="mt-0.5 flex min-w-0 items-center gap-1 select-none">
                  <span
                    title={rp.category}
                    className={`min-w-0 truncate text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}
                  >
                    {rp.category}
                  </span>
                  {rp.isDiscarded ? (
                    <Minus className="size-3.5 shrink-0 text-slate-500" aria-label="Discarded" role="img">
                      <title>Discarded</title>
                    </Minus>
                  ) : rp.isPaid ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-label="Paid" role="img">
                      <title>Paid</title>
                    </CheckCircle2>
                  ) : (
                    <Clock className="size-3.5 shrink-0 text-amber-500 animate-pulse" aria-label="Pending" role="img">
                      <title>Pending</title>
                    </Clock>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className={`font-bold block ${rp.isDiscarded ? 'text-slate-500 line-through' : 'text-orange-500'}`}>-{formatSensitive(rp.amount)}</span>
                <span className="text-muted-foreground text-[9px]">Due {rp.dueDate}</span>
              </div>
              {/* Chevron affordance: fades and slides in on hover */}
              <ChevronRight className="size-4 shrink-0 text-blue-500 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
            </m.div>
          ))}
          {activeRecurring.length === 0 && (
            <div className="text-xs text-muted-foreground py-10 text-center">No subscriptions for this cycle.</div>
          )}
        </m.div>
      </div>

      <button
        onClick={() => onNavigate('recurring')}
        className="w-full py-2 mt-4 text-center text-xs font-semibold text-blue-500 hover:text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 rounded-xl transition duration-200 cursor-pointer shrink-0"
      >
        Manage Subscriptions
      </button>
    </div>
  )
}
