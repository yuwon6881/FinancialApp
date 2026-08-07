import React from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import type { StabilityRecovery } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'

interface StabilityRecoveryExceptionCardProps {
  recovery: StabilityRecovery | undefined
  formatSensitive: (value: number) => React.ReactNode
  onAddIncome: () => void
}

/**
 * Today speaks up only while the emergency fund is below the highest point it has ever reached,
 * and only while this cycle's share of putting it back is still owed. Those are two separate
 * gates on purpose: the fund can still be short overall after this cycle's share is already back,
 * which is a perfectly healthy state that deserves no card.
 */
export function StabilityRecoveryExceptionCard({
  recovery,
  formatSensitive,
  onAddIncome,
}: StabilityRecoveryExceptionCardProps) {
  const reduceMotion = useReducedMotion()

  if (!recovery || !recovery.isActive) return null
  if (recovery.outstandingShortfall <= 0 || recovery.outstandingThisCycle <= 0) return null

  const percentReached = recovery.target > 0
    ? Math.round((recovery.currentBalance / recovery.target) * 100)
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3 min-w-0 flex-1">
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
                text="This compares your emergency fund with the highest it has ever reached, so it only asks for money back that was actually in there. Still building it up for the first time? You will not see this."
              />
            </h3>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            You used {formatSensitive(recovery.lastDrawdownAmount)} from your emergency fund.{' '}
            {recovery.isOverdue
              ? <>{formatSensitive(recovery.outstandingShortfall)} is still to go.</>
              : isFinalCycle
                ? <>That leaves {formatSensitive(recovery.outstandingThisCycle)} to go, and this is the last cycle of the plan.</>
                : <>Spread over {recovery.cyclesRemaining} cycles that is about {formatSensitive(recovery.requiredThisCycle)} each time.</>}
          </p>

          <div className="space-y-1.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
              <span className="font-semibold text-muted-foreground">Emergency fund progress</span>
              <span className="font-semibold text-foreground tabular-nums">
                <span className="font-extrabold text-amber-600 dark:text-amber-400">{percentReached}%</span> of {formatSensitive(recovery.target)}
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
        <div className="shrink-0 pt-1 lg:pt-0">
          <Button variant="primary" onClick={onAddIncome} className="w-full justify-center sm:w-auto">
            Add income
          </Button>
        </div>
      </div>
    </m.section>
  )
}
