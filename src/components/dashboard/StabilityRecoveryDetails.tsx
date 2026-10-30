import type { ReactNode } from 'react'
import type { StabilityRecovery } from '../../types'
import { getMonthCycleLabel, getMonthLabel } from '../../lib/monthCycleLabel'
import { STABILITY_RECOVERY_GRACE_CYCLES, STABILITY_RECOVERY_PLAN_CYCLES } from '../../lib/stabilityRecoveryPacing'
import { describeStabilityRecovery } from '../../lib/stabilityRecoveryNarrative'

interface Props {
  recovery: StabilityRecovery
  formatSensitive: (value: number) => ReactNode
}

export function StabilityRecoveryDetails({ recovery, formatSensitive }: Props) {
  const { status, shortfall, askThisCycle, cyclePlanFunded } = describeStabilityRecovery(recovery)
  const covered = status === 'aheadOfPace'

  const activeCohorts = (recovery.recoveryCohorts ?? []).filter(cohort => cohort.remainingShortfall > 0)

  const sortedCohorts = [...activeCohorts].sort((a, b) => a.originCycleKey.localeCompare(b.originCycleKey))
  const latestCohort = sortedCohorts.at(-1)
  const latestEndMonth = latestCohort
    ? getMonthLabel(latestCohort.originCycleKey, STABILITY_RECOVERY_GRACE_CYCLES + STABILITY_RECOVERY_PLAN_CYCLES - 1)
    : undefined

  let topCardSubtitle: string | undefined
  if (activeCohorts.length === 1) {
    const originMonth = getMonthLabel(activeCohorts[0].originCycleKey) ?? activeCohorts[0].originCycleKey
    const endMonth = getMonthLabel(activeCohorts[0].originCycleKey, STABILITY_RECOVERY_GRACE_CYCLES + STABILITY_RECOVERY_PLAN_CYCLES - 1)
    topCardSubtitle = endMonth ? `${originMonth} withdrawal · Plan ends ${endMonth}` : `${originMonth} withdrawal`
  } else if (activeCohorts.length > 1) {
    topCardSubtitle = latestEndMonth
      ? `${activeCohorts.length} active plans · Latest ends ${latestEndMonth}`
      : `${activeCohorts.length} active plans`
  }

  const coveredEndCycle = latestEndMonth
    ?? (recovery.lastDrawdownCycleKey
      ? getMonthLabel(recovery.lastDrawdownCycleKey, STABILITY_RECOVERY_GRACE_CYCLES + STABILITY_RECOVERY_PLAN_CYCLES - 1)
      : undefined)

  const withdrawalsLabel = activeCohorts.length > 1
    ? `Original withdrawals (${activeCohorts.length} plans)`
    : 'Original withdrawals'

  return (
    <div className="space-y-4">
      <div className="rounded-control inset-group p-4">
        <p className="text-sm text-muted-foreground">Total still to put back</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatSensitive(shortfall)}</p>
        {topCardSubtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{topCardSubtitle}</p>
        )}
      </div>

      <section aria-label="Current cycle recovery" className="space-y-2 rounded-control inset-group p-4">
        <h3 className="text-sm font-semibold text-foreground">This cycle</h3>
        {status === 'deferred' ? (
          <>
            <p className="text-sm text-muted-foreground">Starts next cycle</p>
            {recovery.toppedUpThisCycle > 0 && (
              <p className="text-sm text-muted-foreground">
                Already put back early: {formatSensitive(recovery.toppedUpThisCycle)}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatSensitive(cyclePlanFunded)} of {formatSensitive(recovery.requiredThisCycle)}
            </p>
            {covered ? (
              <p className="text-sm text-muted-foreground">
                Covered. Remaining balance is for {coveredEndCycle ? `${coveredEndCycle} cycle.` : 'later cycles.'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {formatSensitive(askThisCycle)} still due this cycle.
              </p>
            )}
          </>
        )}
      </section>

      {activeCohorts.length > 1 && (
        <section aria-label="Withdrawal plans" className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Withdrawal plans</h3>
          <ul className="divide-y divide-foreground/10 rounded-control inset-group" aria-label="Withdrawal plans">
            {activeCohorts.map(cohort => {
              // The three repayment cycles follow the spending cycle; the last one is the deadline.
              const endCycle = getMonthCycleLabel(cohort.originCycleKey,
                STABILITY_RECOVERY_GRACE_CYCLES + STABILITY_RECOVERY_PLAN_CYCLES - 1)
              return (
                // Two columns, so each caption sits under the thing it describes: the deadline under
                // the cycle name, the amount's status under the amount.
                <li key={`${cohort.originCycleKey}-${cohort.fromDate}`} className="flex items-start justify-between gap-3 p-3.5 text-sm">
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-semibold text-foreground">{getMonthCycleLabel(cohort.originCycleKey) ?? cohort.originCycleKey}</p>
                    {endCycle && <p className="text-muted-foreground">Plan ends {endCycle}</p>}
                  </div>
                  <div className="shrink-0 space-y-1.5 text-right">
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatSensitive(cohort.remainingShortfall)}
                    </p>
                    <p className="text-muted-foreground">{cohort.isOverdue ? 'Overdue' : cohort.isDeferred ? 'Starts next cycle' : 'Remaining'}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <details className="rounded-control inset-group p-3.5 text-sm">
        <summary className="min-h-11 cursor-pointer content-center rounded-md text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-9">
          Calculation
        </summary>
        <dl className="mt-3 space-y-2">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">{withdrawalsLabel}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatSensitive(recovery.markedTotal)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Put back so far</dt>
            <dd className="font-semibold tabular-nums text-foreground">− {formatSensitive(recovery.repaidTotal)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-foreground/10 pt-2 font-semibold text-foreground">
            <dt>Remaining shortfall</dt>
            <dd className="tabular-nums">{formatSensitive(shortfall)}</dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
