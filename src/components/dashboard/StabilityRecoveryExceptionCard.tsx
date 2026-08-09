import React from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import type { StabilityRecovery } from '../../types'
import { InfoHint } from '../ui/InfoHint'

interface StabilityRecoveryExceptionCardProps {
  recovery: StabilityRecovery | undefined
  formatSensitive: (value: number) => React.ReactNode
}

/**
 * Today speaks up only while the emergency fund is below the highest point it has ever reached,
 * and only while this cycle's share of putting it back is still owed. Those are two separate
 * gates on purpose: the fund can still be short overall after this cycle's share is already back,
 * which is a perfectly healthy state that deserves no card.
 *
 * The card is purely informative and carries no action. Putting money back happens by ticking the
 * top-up offer on a salary, so an "Add income" button here pointed at a blank transaction form that
 * could not do the thing the card was asking for.
 */
export function StabilityRecoveryExceptionCard({
  recovery,
  formatSensitive,
}: StabilityRecoveryExceptionCardProps) {
  const reduceMotion = useReducedMotion()

  if (!recovery || !recovery.isActive) return null
  if (recovery.outstandingShortfall <= 0 || recovery.outstandingThisCycle <= 0) return null

  const percentReached = recovery.recoverableCeiling > 0
    ? Math.round((recovery.currentBalance / recovery.recoverableCeiling) * 100)
    : 0
  // Overdue is checked first: past the window cyclesRemaining sits at 1 forever, so treating that
  // as "the final cycle" announced the last cycle of the plan every cycle from then on.
  const isFinalCycle = !recovery.isOverdue && recovery.cyclesRemaining <= 1

  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="stability-recovery-exception"
      className="app-panel rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-5" />
            </div>
            <h3
              id="stability-recovery-exception"
              className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-300"
            >
              Your emergency fund is below where it was
              <InfoHint
                label="How putting money back is worked out"
                text="Refills use your highest past emergency-fund balance. First-time building has no refill."
              />
            </h3>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Put back {formatSensitive(recovery.outstandingThisCycle)} more this cycle.{' '}
            {recovery.isOverdue
              ? <>{formatSensitive(recovery.outstandingShortfall)} remains overall and the plan is overdue.</>
              : isFinalCycle
                ? <>This is the final planned cycle; {formatSensitive(recovery.outstandingShortfall)} remains overall.</>
                : <>{formatSensitive(recovery.outstandingShortfall)} remains overall across {recovery.cyclesRemaining} cycles.</>}
          </p>

          <div className="space-y-1.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
              <span className="font-semibold text-muted-foreground">Emergency fund progress</span>
              <span className="font-semibold text-foreground tabular-nums">
                <span className="font-extrabold text-amber-600 dark:text-amber-400">{percentReached}%</span> of {formatSensitive(recovery.recoverableCeiling)} to restore
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-amber-500/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, percentReached))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </m.section>
  )
}
