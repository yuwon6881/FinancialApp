import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar } from 'lucide-react'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import type { ActiveRecurringPayment } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'

interface SubscriptionsTimelineCardProps {
  activeRecurring: ActiveRecurringPayment[]
  formatSensitive: (val: number) => React.ReactNode
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
}

export const SubscriptionsTimelineCard: React.FC<SubscriptionsTimelineCardProps> = ({
  activeRecurring,
  formatSensitive,
  onNavigate,
}) => {
  return (
    <div className="app-panel p-6 rounded-2xl bg-card/92 border border-border/60 flex flex-col h-full">
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
          className="space-y-2 mt-4 flex-1 overflow-y-auto pr-1 min-h-0"
        >
          <AnimatePresence>
          {activeRecurring.map((rp: ActiveRecurringPayment) => (
            <motion.div
              key={rp.id}
              variants={listItemVariants}
              exit={listItemExit}
              onClick={() => onNavigate('recurring')}
              className={`flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-foreground/5 transition-colors px-2 -mx-2 rounded-md ${rp.isDiscarded ? 'opacity-50' : ''}`}
            >
              <div className="truncate mr-2">
                <span className={`font-bold text-foreground truncate block max-w-[120px] ${rp.isDiscarded ? 'line-through' : ''}`}>{rp.name}</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5 select-none">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}>
                    {rp.category}
                  </span>
                  {rp.isDiscarded ? (
                    <span className="text-[10px] px-1.5 py-0.5 font-bold text-slate-500 bg-slate-500/10 border border-slate-500/20 rounded">
                      Discarded
                    </span>
                  ) : rp.isPaid ? (
                    <span className="text-[10px] px-1.5 py-0.5 font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded">
                      Paid
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded animate-pulse">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className={`font-bold block ${rp.isDiscarded ? 'text-slate-500 line-through' : 'text-orange-500'}`}>-{formatSensitive(rp.amount)}</span>
                <span className="text-muted-foreground text-[9px]">Due {rp.dueDate}</span>
              </div>
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
