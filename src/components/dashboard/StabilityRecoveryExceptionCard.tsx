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
 * Today speaks up while an explicitly marked emergency-fund obligation remains, and stops only when
 * it is gone.
 *
 * `outstandingThisCycle` is deliberately *not* a gate. It is the three-cycle pace's ask for this
 * cycle, and it hits zero the moment this cycle's share is back -- so 871.77 marked with 520 already
 * put back left 351.77 genuinely owed while the pace asked for ceil(871.77/3) = 290.59, which 520
 * already covers. Gating on it hid the card in exactly the state the user was trying to read: still
 * short of target, still owing, and no longer told about it. Being ahead of pace changes the
 * sentence, not whether there is one.
 *
 * The card still carries no action that *changes* anything — the transaction form and ledger edit
 * own the answer. What it does carry is the marked/repaid arithmetic and a way to see it: an
 * obligation derived from several ledger rows is otherwise a number the app asserts and the user
 * cannot check.
 */
export function StabilityRecoveryExceptionCard({
  recovery,
  formatSensitive,
  onNavigateToLedger,
}: StabilityRecoveryExceptionCardProps) {
  const reduceMotion = useReducedMotion()

  if (!recovery || !recovery.isActive) return null
  if (recovery.outstandingShortfall <= 0) return null

  const aheadOfPace = recovery.outstandingThisCycle <= 0

  const percentRepaid = recovery.markedTotal > 0
    ? Math.round(Math.min(1, Math.max(0, recovery.repaidTotal / recovery.markedTotal)) * 100)
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
      className="app-panel rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id="stability-recovery-exception"
            className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-300"
          >
            Your emergency fund is below where it was
            <InfoHint
              label="How putting money back is worked out"
              text="Only money you mark as needing to go back creates this reminder. Your normal salary share does not count as putting it back; reaching your target clears it."
            />
          </h3>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {aheadOfPace
              ? <>Nothing more is needed this cycle — you are ahead of the plan.{' '}</>
              : <>Put back {formatSensitive(recovery.outstandingThisCycle)} more this cycle.{' '}</>}
            {recovery.isOverdue
              ? <>{formatSensitive(recovery.outstandingShortfall)} remains overall and the plan is overdue.</>
              : isFinalCycle
                ? <>This is the final planned cycle; {formatSensitive(recovery.outstandingShortfall)} remains overall.</>
                : <>{formatSensitive(recovery.outstandingShortfall)} remains overall across {recovery.cyclesRemaining} cycles.</>}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="grid gap-0.5 text-xs sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-2 sm:gap-y-1">
          <span className="font-semibold text-muted-foreground">Putting it back progress</span>
          <span className="font-semibold text-foreground tabular-nums sm:text-right">
            <span className="font-extrabold text-amber-600 dark:text-amber-400">{percentRepaid}%</span> of {formatSensitive(recovery.markedTotal)} put back
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-amber-500/20">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, percentRepaid))}%` }}
          />
        </div>
      </div>

      {/* The breakdown names the ledger obligation and its repayments. Keep it behind a
          disclosure because a healthy reader never needs it, and this panel already competes
          with two other exception cards for the top of the page. */}
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-bold text-amber-700 transition hover:underline dark:text-amber-300">
          <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden="true" />
          Where this figure comes from
        </summary>
        <div className="mt-2 space-y-2 rounded-xl border border-amber-500/20 bg-card/60 p-3">
          <dl className="space-y-1.5 text-[11px] sm:text-xs">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">You marked as needing to go back</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.markedTotal)}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">Put back so far</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.repaidTotal)}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">In it now</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.currentBalance)}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 border-t border-border/40 pt-1.5">
              <dt className="font-semibold text-foreground">Still short</dt>
              <dd className="text-right font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                {formatSensitive(recovery.outstandingShortfall)}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">
                <span className="sm:hidden">Back this cycle ({recovery.cyclesRemaining} {recovery.cyclesRemaining === 1 ? 'cycle' : 'cycles'})</span>
                <span className="hidden sm:inline">
                  Spread over {recovery.cyclesRemaining} {recovery.cyclesRemaining === 1 ? 'cycle' : 'cycles'}, already back this cycle
                </span>
              </dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.toppedUpThisCycle)}</dd>
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
              <p className="text-[10px] leading-snug text-muted-foreground">
                Opens your ledger on emergency-fund movements from when your fund was last full.
                A long window may span more than one page.
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
    </m.section>
  )
}
