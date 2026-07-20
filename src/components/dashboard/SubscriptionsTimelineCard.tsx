import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronRight } from 'lucide-react'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import type { ActiveRecurringPayment } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'

interface SubscriptionsTimelineCardProps {
  activeRecurring: ActiveRecurringPayment[]
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
  onNavigateToRecurring?: (recurringPaymentId: string) => void
}

export const SubscriptionsTimelineCard: React.FC<SubscriptionsTimelineCardProps> = ({
  activeRecurring,
  formatSensitive,
  onNavigate,
  onNavigateToRecurring,
}) => {
  return (
    <div data-testid="subscriptions-timeline-card" className="app-panel flex h-full min-w-0 flex-col rounded-2xl border border-border/60 bg-card/92 p-6 lg:max-h-[24rem]">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">Subscriptions</h3>
            <p className="text-[10px] text-muted-foreground">Bills for this active cycle</p>
          </div>
          <Calendar className="size-4 text-blue-500 shrink-0" />
        </div>

        <motion.div
          initial="hidden" animate="show"
          variants={listContainerVariants}
          className="-mx-1 mt-3 flex-1 min-h-0 space-y-1.5 overflow-x-hidden overflow-y-auto p-1 no-scrollbar"
        >
          <AnimatePresence>
          {activeRecurring.map((rp: ActiveRecurringPayment) => (
            <motion.div
              key={rp.id}
              variants={listItemVariants}
              exit={listItemExit}
              onClick={() => (onNavigateToRecurring ? onNavigateToRecurring(rp.recurringPaymentId) : onNavigate('recurring'))}
              className={`group relative flex items-center justify-between gap-2 text-xs py-2 pl-3 pr-2 rounded-xl border border-transparent cursor-pointer transition-all duration-200 hover:bg-blue-500/[0.06] hover:border-blue-500/25 hover:shadow-sm hover:-translate-y-px ${rp.isDiscarded ? 'opacity-50' : ''}`}
            >
              {/* Accent bar that grows on hover to signal the row is clickable */}
              <span className="pointer-events-none absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full bg-blue-500 transition-all duration-200 group-hover:h-7" />

              <div className="min-w-0 flex-1">
                <span className={`font-bold text-foreground truncate block transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 ${rp.isDiscarded ? 'line-through' : ''}`}>{rp.name}</span>
                <div className="mt-0.5 flex min-w-0 items-center gap-1 select-none">
                  <span className={`min-w-0 break-words text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}>
                    {rp.category}
                  </span>
                  {rp.isDiscarded ? (
                    <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 font-bold text-slate-500 bg-slate-500/10 border border-slate-500/20 rounded">
                      Discarded
                    </span>
                  ) : rp.isPaid ? (
                    <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded">
                      Paid
                    </span>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded animate-pulse">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className={`font-bold block ${rp.isDiscarded ? 'text-slate-500 line-through' : 'text-orange-500'}`}>-{formatSensitive(rp.amount)}</span>
                <span className="text-muted-foreground text-[9px]">Due {rp.dueDate}</span>
              </div>
              {/* Chevron affordance: fades and slides in on hover */}
              <ChevronRight className="size-4 shrink-0 text-blue-500 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
            </motion.div>
          ))}
          </AnimatePresence>
          {activeRecurring.length === 0 && (
            <div className="text-xs text-muted-foreground py-10 text-center">No subscriptions for this cycle.</div>
          )}
        </motion.div>
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
