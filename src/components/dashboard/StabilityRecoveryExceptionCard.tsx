import React from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronRight, ShieldAlert } from 'lucide-react'
import type { StabilityRecovery } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'

export interface StabilityRecoveryLedgerJump {
  category?: string | null
  startDate?: string | null
  endDate?: string | null
  showAllCycles?: boolean
  range?: 'monthly' | '3month' | '6month' | 'yearly'
}

interface StabilityRecoveryExceptionCardProps {
  recovery: StabilityRecovery | undefined
  formatSensitive: (value: number) => React.ReactNode
  /** Opens the ledger on the movements that produced the shortfall. Absent in tests and previews. */
  onNavigateToLedger?: (options: StabilityRecoveryLedgerJump) => void
}

/**
 * Today speaks up only while the emergency fund is below the highest point it has ever reached,
 * and only while this cycle's share of putting it back is still owed. Those are two separate
 * gates on purpose: the fund can still be short overall after this cycle's share is already back,
 * which is a perfectly healthy state that deserves no card.
 *
 * The card still carries no action that *changes* anything — putting money back happens by ticking
 * the top-up offer on a salary, so the "Add income" button it once had opened a blank transaction
 * form that could not do the thing the card was asking for. What it does carry is the arithmetic
 * and a way to see it: a figure derived from balances across several cycles is otherwise a number
 * the app asserts and the user cannot check.
 */
export function StabilityRecoveryExceptionCard({
  recovery,
  formatSensitive,
  onNavigateToLedger,
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
  // The jump needs a window to filter on, and only the server can say when the fund was last full.
  const canShowMovements = Boolean(onNavigateToLedger && recovery.recoveryFromDate)

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

          {/* The whole figure is one subtraction between two balances, and stating it is the
              difference between a number the app asserts and one the user can check. Behind a
              disclosure because a healthy reader never needs it, and this panel already competes
              with two other exception cards for the top of the page. */}
          <details className="group pt-1">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-bold text-amber-700 transition hover:underline dark:text-amber-300">
              <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden="true" />
              Where this figure comes from
            </summary>
            <div className="mt-2 space-y-2 rounded-xl border border-amber-500/20 bg-card/60 p-3">
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Highest your fund has reached</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatSensitive(recovery.recoverableCeiling)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">In it now</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatSensitive(recovery.currentBalance)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border/40 pt-1.5">
                  <dt className="font-semibold text-foreground">Short by</dt>
                  <dd className="font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatSensitive(recovery.outstandingShortfall)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Spread over {recovery.cyclesRemaining} {recovery.cyclesRemaining === 1 ? 'cycle' : 'cycles'}, already back this cycle
                  </dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatSensitive(recovery.toppedUpThisCycle)}</dd>
                </div>
              </dl>

              {canShowMovements ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    className="w-full justify-center"
                    onClick={() => onNavigateToLedger?.({
                      category: 'Stability',
                      startDate: recovery.recoveryFromDate,
                      endDate: new Date().toLocaleDateString('en-CA'),
                      showAllCycles: true,
                      range: 'yearly',
                    })}
                  >
                    See every movement since then
                  </Button>
                  {/* Said plainly rather than left to be discovered: the ledger totals it lands on
                      are per page, and the window can run to more rows than one page holds. */}
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Opens your ledger filtered to emergency-fund movements from the start of the cycle
                    after it was last full. The list totals each page, so a long window needs more
                    than one page to add up to the figure above.
                  </p>
                </>
              ) : (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Your fund has not yet closed a cycle at its highest point, so there is no window of
                  movements to list.
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </m.section>
  )
}
