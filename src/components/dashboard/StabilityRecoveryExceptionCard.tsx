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
  const isFinalCycle = recovery.cyclesRemaining <= 1

  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="stability-recovery-exception"
      className="app-panel rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-5" />
          </div>
          <div>
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
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              You used {formatSensitive(recovery.lastDrawdownAmount)} from your emergency fund.
              Putting {formatSensitive(recovery.outstandingShortfall)} back gets it to{' '}
              {formatSensitive(recovery.recoverableCeiling)} again.{' '}
              {isFinalCycle
                ? <>That leaves {formatSensitive(recovery.outstandingThisCycle)} to go, and this is the last cycle of the plan.</>
                : <>Spread over {recovery.cyclesRemaining} cycles that is about {formatSensitive(recovery.requiredThisCycle)} each time — next time money comes in we can add that on top of the usual share.</>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Emergency fund progress: {percentReached}% of {formatSensitive(recovery.target)}.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onAddIncome} className="w-full justify-center sm:w-auto">
          Add income
        </Button>
      </div>
    </m.section>
  )
}
