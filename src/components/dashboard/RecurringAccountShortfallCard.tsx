import React from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowRightLeft, Calendar } from 'lucide-react'
import type { RecurringAccountShortfall } from '../../types'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { PANEL_TONES, panelClass } from '../ui/panelStyles'

interface RecurringAccountShortfallCardProps {
  shortfalls: RecurringAccountShortfall[] | undefined
  formatSensitive: (value: number) => React.ReactNode
  onTransferMoney?: () => void
  onNavigateToRecurring?: (recurringId: string) => void
}

/**
 * Warns users when an upcoming auto-deducted recurring bill will exceed the available balance
 * in its assigned account, even if the parent ledger bucket has sufficient overall funds.
 */
export function RecurringAccountShortfallCard({
  shortfalls,
  formatSensitive,
  onTransferMoney,
  onNavigateToRecurring,
}: RecurringAccountShortfallCardProps) {
  const reduceMotion = useReducedMotion()

  if (!shortfalls || shortfalls.length === 0) return null

  // Sort by urgency: closest due date first, then largest shortfall.
  const sorted = [...shortfalls].sort((a, b) => {
    if (a.offsetDays !== b.offsetDays) return a.offsetDays - b.offsetDays
    return b.shortfall - a.shortfall
  })

  const primary = sorted[0]
  const othersCount = sorted.length - 1

  const dueLabel = primary.offsetDays === 0
    ? 'Due today'
    : primary.offsetDays === 1
      ? 'Due tomorrow'
      : `Due in ${primary.offsetDays} days`

  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="recurring-account-shortfall-title"
      className={cn(panelClass, PANEL_TONES.urgent, 'p-4 shadow-xs sm:p-5')}
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <AlertCircle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="recurring-account-shortfall-title" className="text-sm font-bold text-orange-700 dark:text-orange-300">
                {primary.name} auto-deduct shortfall
              </h3>
              <span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
                {dueLabel}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {primary.accountName} has {formatSensitive(primary.accountBalance)}, but {primary.name} needs {formatSensitive(primary.amount)}. Transfer at least {formatSensitive(primary.shortfall)} to avoid a missed auto-deduction.
              {othersCount > 0 && ` ${othersCount} other auto-deduction${othersCount > 1 ? 's are' : ' is'} also short on funds.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0 shrink-0">
          {onTransferMoney && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onTransferMoney}
              className="flex-1 justify-center sm:flex-initial"
            >
              <ArrowRightLeft className="mr-1.5 size-3.5" />
              Transfer money
            </Button>
          )}
          {onNavigateToRecurring && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateToRecurring(primary.recurringPaymentId)}
              className="flex-1 justify-center sm:flex-initial border-orange-500/30 bg-card/60 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300"
            >
              <Calendar className="mr-1.5 size-3.5" />
              View bill
            </Button>
          )}
        </div>
      </div>
    </m.section>
  )
}
