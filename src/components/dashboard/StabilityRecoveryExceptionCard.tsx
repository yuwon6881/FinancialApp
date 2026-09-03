import React from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronRight, ShieldAlert } from 'lucide-react'
import type { StabilityRecovery, StabilityReloadFilter } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { cn } from '../../lib/utils'
import { PANEL_TONES, panelClass } from '../ui/panelStyles'

export interface StabilityRecoveryLedgerJump {
  category?: string | null
  startDate?: string | null
  endDate?: string | null
  showAllCycles?: boolean
  range?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  reloadFilter?: StabilityReloadFilter
}

interface StabilityRecoveryExceptionCardProps {
  recovery: StabilityRecovery | undefined
  formatSensitive: (value: number) => React.ReactNode
  /** Opens the ledger on the movements that produced the shortfall. Absent in tests and previews. */
  onNavigateToLedger?: (options: StabilityRecoveryLedgerJump) => void
}

function formatRecoveryCycle(cycleKey: string) {
  const [year, month] = cycleKey.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return cycleKey
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
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
  const recoveryCohorts = recovery.recoveryCohorts ?? []
  const hasOverlappingPlans = recoveryCohorts.length > 1

  const percentRepaid = recovery.markedTotal > 0
    ? Math.round(Math.min(1, Math.max(0, recovery.repaidTotal / recovery.markedTotal)) * 100)
    : 0
  // Overdue is checked first: past the window cyclesRemaining sits at 1 forever, so treating that
  // as "the final cycle" announced the last cycle of the plan every cycle from then on.
  //
  // Overlapping plans are excluded too. The aggregate counts down the *most urgent* cohort, so an
  // older plan on its last cycle set this while a newer cohort still had all three -- and the card
  // called the whole recovery final while the list below it said "3 cycles left".
  const isFinalCycle = !recovery.isOverdue && !hasOverlappingPlans && recovery.cyclesRemaining <= 1
  // Two money figures side by side read as additive unless the containment is said out loud: this
  // cycle's ask is a slice of the shortfall, never money owed on top of it. Once the pace asks for
  // the whole remaining shortfall -- the final cycle, and every cycle past the window -- naming both
  // would print the same figure twice, so that case states it once.
  const asksForWholeShortfall =
    recovery.outstandingThisCycle >= recovery.outstandingShortfall - 0.005
  // The jump needs a window to filter on, and only the server can say when the fund was last full.
  const canShowMovements = Boolean(onNavigateToLedger && recovery.recoveryFromDate)

  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="stability-recovery-exception"
      className={cn(panelClass, PANEL_TONES.warning, 'relative overflow-hidden p-4 shadow-xs sm:p-5')}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
              <ShieldAlert className="size-4.5 sm:size-5" />
            </div>
            <h3
              id="stability-recovery-exception"
              className="text-sm font-bold leading-snug text-amber-700 dark:text-amber-300"
            >
              Your emergency fund is below where it was
              <InfoHint
                label="How putting money back is worked out"
                text="Only money you mark as needing to go back creates this reminder. Your normal salary share does not count as putting it back; reaching your target clears it."
                inline
                className="ml-1"
              />
            </h3>
          </div>

          {aheadOfPace ? (
            <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Ahead of plan
            </span>
          ) : recovery.isOverdue ? (
            <span className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
              Plan overdue
            </span>
          ) : isFinalCycle ? (
            <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              Final cycle
            </span>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {aheadOfPace ? (
            <>
              Nothing more is needed this cycle — you are ahead of the plan.{' '}
              {formatSensitive(recovery.outstandingShortfall)} is still short in total.{' '}
            </>
          ) : asksForWholeShortfall ? (
            <>Put back {formatSensitive(recovery.outstandingThisCycle)} this cycle to clear what is still short.{' '}</>
          ) : (
            <>
              Put back {formatSensitive(recovery.outstandingThisCycle)} this cycle — part of the{' '}
              {formatSensitive(recovery.outstandingShortfall)} still short, not money on top of it.{' '}
            </>
          )}
          {hasOverlappingPlans
            ? recovery.isOverdue
              ? <>At least one three-cycle plan is overdue; newer spending keeps its own window.</>
              : <>Each cycle&rsquo;s Stability spending keeps its own three-cycle plan.</>
            : recovery.isOverdue
              ? <>The planned cycles have run out.</>
              : isFinalCycle
                ? <>This is the final planned cycle.</>
                : <>The plan spreads it over {recovery.cyclesRemaining} cycles, counting this one.</>}
        </p>

        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">Putting it back progress</span>
            <span className="font-semibold text-foreground tabular-nums text-right">
              <span className="font-extrabold text-amber-600 dark:text-amber-400">{percentRepaid}%</span> of {formatSensitive(recovery.markedTotal)} put back
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70 border border-border/40">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, percentRepaid))}%` }}
            />
          </div>
        </div>
      </div>

      {/* The breakdown names the ledger obligation and its repayments. Keep it behind a
          disclosure because a healthy reader never needs it, and this panel already competes
          with two other exception cards for the top of the page. */}
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-bold text-amber-700 transition hover:underline dark:text-amber-300">
          <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden="true" />
          Where this figure comes from
        </summary>
        <div className="mt-2 space-y-2.5 rounded-xl border border-border/60 bg-card/60 p-3.5">
          <dl className="space-y-1.5 text-xs sm:text-xs">
            {/* The first three rows are one subtraction and are kept adjacent so they read as one:
                what is still being put back, less what has gone back, is what is still short.
                Anything already put back in full has left all three. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">Taken out and not yet fully back</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.markedTotal)}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">Put back so far</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.repaidTotal)}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 border-t border-border/40 pt-1.5">
              <dt className="font-semibold text-foreground">Still short</dt>
              <dd className="text-right font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                {formatSensitive(recovery.outstandingShortfall)}
              </dd>
            </div>
            {/* One label carrying two unrelated facts left its value attached to only the second of
                them. Split so each figure has its own line, and name the cycle share outright: it is
                what the headline asks for, and reading it directly under "still short" is what shows
                it to be a slice of that figure rather than an addition to it. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 border-t border-border/40 pt-1.5">
              <dt className="min-w-0 leading-snug text-muted-foreground">
                {/* Compact drops only the "spread over N cycles" tail, never the containment
                    wording itself. With overlapping plans the figure is the sum of several
                    cohorts' shares and can exceed the shortfall above it once a cohort has been
                    repaid in full this cycle, so calling it "this cycle's share of that" on a
                    phone described arithmetic that does not add up. */}
                <span className="sm:hidden">
                  {hasOverlappingPlans ? 'Combined plan for this cycle' : <>This cycle&rsquo;s share of that</>}
                </span>
                <span className="hidden sm:inline">
                  {hasOverlappingPlans
                    ? 'Combined plan for this cycle'
                    : <>This cycle&rsquo;s share of that, spread over {recovery.cyclesRemaining} {recovery.cyclesRemaining === 1 ? 'cycle' : 'cycles'}</>}
                </span>
              </dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.requiredThisCycle)}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
              <dt className="min-w-0 leading-snug text-muted-foreground">Of that share, already back</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.toppedUpThisCycle)}</dd>
            </div>
            {/* Context rather than part of the subtraction, so it sits below the plan rows instead
                of between "still short" and the share taken out of it. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 border-t border-border/40 pt-1.5">
              <dt className="min-w-0 leading-snug text-muted-foreground">In it now</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{formatSensitive(recovery.currentBalance)}</dd>
            </div>
          </dl>

          {recoveryCohorts.length > 0 ? (
            <div className="space-y-2 border-t border-border/40 pt-2.5">
              <p className="text-xs font-semibold text-foreground">Three-cycle plans by spending cycle</p>
              <ul className="space-y-2" aria-label="Stability recovery plans">
                {recoveryCohorts.map(cohort => (
                  <li
                    key={`${cohort.originCycleKey}-${cohort.fromDate}`}
                    className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {formatRecoveryCycle(cohort.originCycleKey)} cycle
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {cohort.transactionCount} {cohort.transactionCount === 1 ? 'withdrawal' : 'withdrawals'} since{' '}
                          <time dateTime={cohort.fromDate}>{cohort.fromDate}</time>
                        </p>
                      </div>
                      <span className={cohort.isOverdue
                        ? 'shrink-0 font-semibold text-destructive'
                        : 'shrink-0 font-semibold text-muted-foreground'}
                      >
                        {cohort.isOverdue
                          ? 'Overdue'
                          : `${cohort.cyclesRemaining} ${cohort.cyclesRemaining === 1 ? 'cycle' : 'cycles'} left`}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/40 pt-2">
                      <div>
                        <p className="text-muted-foreground">Still short</p>
                        <p className="font-semibold tabular-nums text-foreground">
                          {formatSensitive(cohort.remainingShortfall)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Planned this cycle</p>
                        <p className="font-semibold tabular-nums text-foreground">
                          {formatSensitive(cohort.requiredThisCycle)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-snug text-muted-foreground">
                Reimbursements reduce the combined plan above; Ledger completion still follows the oldest withdrawal first.
              </p>
            </div>
          ) : null}

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
                  reloadFilter: 'needs-put-back',
                  showAllCycles: true,
                  range: 'all',
                })}
              >
                View pending reload movements
              </Button>
              {/* Said plainly rather than left to be discovered: the ledger totals it lands on
                  are per page, and the window can run to more rows than one page holds. */}
              <p className="text-xs leading-snug text-muted-foreground">
                Opens your ledger on pending and partly put-back emergency fund reload movements since your fund was last full.
                A long window may span more than one page.
              </p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your fund has not yet closed a cycle at its highest point, so there is no window of
              movements to list.
            </p>
          )}
        </div>
      </details>
    </m.section>
  )
}
