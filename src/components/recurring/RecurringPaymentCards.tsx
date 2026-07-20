import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Calendar, CreditCard, Edit, Repeat, Trash2 } from 'lucide-react'
import type { RecurringPayment } from '../../types'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import { normalizeRecurringFrequency } from '../../lib/recurringPayments'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { ToggleButton } from '../ui/ToggleButton'
import { getDayWithSuffix } from './formatters'

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
}

const HIGHLIGHT_CLASSES = ['ring-2', 'ring-blue-500/60', 'ring-offset-2', 'ring-offset-background', 'bg-blue-500/[0.06]', 'shadow-lg']

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
}) => {
  // When navigated here from the dashboard subscription card, scroll the target
  // card into view and apply a highlight ring that fades out on its own.
  useEffect(() => {
    if (!highlightedId) return
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      const el = document.getElementById(`recur-card-${highlightedId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add(...HIGHLIGHT_CLASSES)
        clearTimer = setTimeout(() => {
          el.classList.remove(...HIGHLIGHT_CLASSES)
          onClearHighlight?.()
        }, 2600)
      } else {
        // Target not rendered (e.g. filtered out) — drop the highlight state.
        onClearHighlight?.()
      }
    }, 350)
    return () => {
      clearTimeout(timer)
      if (clearTimer) clearTimeout(clearTimer)
      document.getElementById(`recur-card-${highlightedId}`)?.classList.remove(...HIGHLIGHT_CLASSES)
    }
  }, [highlightedId, onClearHighlight])

  return (
    <motion.div
      initial="hidden" animate="show"
      variants={listContainerVariants}
      className="grid grid-cols-1 gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]"
    >
      <AnimatePresence>
      {payments.map(rp => {
        const isBusy = isPaymentDeleting(rp.id) || isPaymentSyncing(rp.id) || rp.isPendingSync
        return (
          <motion.div
            key={rp.id}
            id={`recur-card-${rp.id}`}
            variants={listItemVariants}
            exit={listItemExit}
            className={`flex min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 ${
              rp.active
                ? 'border-border/60 hover:border-blue-500/30 shadow-xs'
                : 'border-dashed border-border/60 opacity-60'
            }`}
          >
            <div>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex min-w-0 items-center gap-1.5 text-base font-bold text-foreground">
                    <span className="truncate">{rp.name}</span>
                    {!rp.active && (
                      <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Paused</span>
                    )}
                    <RowSyncStatus isDeleting={isPaymentDeleting(rp.id)} isSyncing={isPaymentSyncing(rp.id)} isPending={rp.isPendingSync} entityLabel="subscription" />
                  </h3>
                  <span className={`mt-1 inline-block max-w-full truncate rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getCategoryBadgeClass(rp.category)}`}>
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
                  <span className="ml-3 min-w-0 truncate text-foreground font-medium" title={rp.startDate}>
                    {rp.startDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Repeat className="size-3.5" /> Recurs
                  </span>
                  <span className="ml-3 min-w-0 truncate text-foreground font-medium" title={`Every ${normalizeRecurringFrequency(rp.frequency) === 'Annually' ? 'year' : 'month'} on the ${getDayWithSuffix(rp.dueDate)}`}>
                    Every {normalizeRecurringFrequency(rp.frequency) === 'Annually' ? 'year' : 'month'} on the {getDayWithSuffix(rp.dueDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="size-3.5" /> Ledger Category
                  </span>
                  <span className={`ml-3 inline-block max-w-[55%] truncate rounded-md border px-1.5 py-0.5 font-semibold ${getCategoryBadgeClass(rp.ledgerCategory)}`} title={rp.ledgerCategory}>
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

            <div className="mt-6 flex items-center justify-between border-t border-border/30 pt-4 gap-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                <Bell className="size-3 text-blue-500" /> Auto-notify
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => onEditPayment(rp)}
                  disabled={isBusy || hideSensitive}
                  title={hideSensitive ? 'Unhide balances to edit' : 'Edit subscription'}
                >
                  <Edit className="size-3.5" /> Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => { if (!hideSensitive) onDeletePayment(rp.id) }}
                  disabled={isBusy || hideSensitive}
                  title={hideSensitive ? 'Unhide balances to edit' : 'Delete subscription'}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          </motion.div>
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
    </motion.div>
  )
}
