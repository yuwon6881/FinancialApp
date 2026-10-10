import type { ReactNode } from 'react'
import type { StabilityRecovery } from '../../types'
import { getMonthCycleLabel } from '../../lib/monthCycleLabel'
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

  return (
    <div className="space-y-4">
      <div className="rounded-control bg-surface-2/70 p-4">
        <p className="text-sm text-muted-foreground">Total still to put back</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatSensitive(shortfall)}</p>
      </div>

      <section aria-label="Current cycle recovery" className="space-y-2 rounded-control bg-surface-2/70 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          {status === 'deferred' ? 'Starts next cycle' : covered ? 'This cycle covered' : 'Still due this cycle'}
        </h3>
        {status !== 'deferred' && (
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {covered
              ? <>{formatSensitive(cyclePlanFunded)} of {formatSensitive(recovery.requiredThisCycle)}</>
              : formatSensitive(askThisCycle)}
          </p>
        )}
        {covered ? (
          <p className="text-sm text-muted-foreground">The remaining balance is for later cycles.</p>
        ) : status !== 'deferred' ? (
          <p className="text-sm text-muted-foreground">
            Put back {formatSensitive(cyclePlanFunded)} of {formatSensitive(recovery.requiredThisCycle)} planned.
          </p>
        ) : recovery.toppedUpThisCycle > 0 ? (
          <p className="text-sm text-muted-foreground">Already put back early: {formatSensitive(recovery.toppedUpThisCycle)}</p>
        ) : null}
      </section>

      {activeCohorts.length > 0 && (
        <section aria-label="Recovery by spending cycle" className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">By spending cycle</h3>
          <ul className="divide-y divide-border/50 rounded-control bg-surface-2/70" aria-label="Stability recovery plans">
            {activeCohorts.map(cohort => {
              // The three repayment cycles follow the spending cycle; the last one is the deadline.
              const endCycle = getMonthCycleLabel(cohort.originCycleKey,
                STABILITY_RECOVERY_GRACE_CYCLES + STABILITY_RECOVERY_PLAN_CYCLES - 1)
              return (
                <li key={`${cohort.originCycleKey}-${cohort.fromDate}`} className="space-y-1.5 p-3.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-semibold text-foreground">{getMonthCycleLabel(cohort.originCycleKey) ?? cohort.originCycleKey}</p>
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatSensitive(cohort.remainingShortfall)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-muted-foreground">
                    <p>{cohort.isOverdue ? 'Overdue' : cohort.isDeferred ? 'Starts next cycle' : 'Remaining'}</p>
                    {endCycle && <p>Plan ends {endCycle}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <details className="rounded-control bg-surface-2/70 p-3.5 text-sm">
        <summary className="min-h-11 cursor-pointer content-center rounded-md text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-9">
          How the total is calculated
        </summary>
        <p className="mt-2 text-muted-foreground">Fully repaid withdrawals are excluded from these figures.</p>
        <dl className="mt-3 space-y-2">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Withdrawals still being repaid</dt>
            <dd className="font-semibold tabular-nums">{formatSensitive(recovery.markedTotal)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Put back against those withdrawals</dt>
            <dd className="font-semibold tabular-nums">{formatSensitive(recovery.repaidTotal)}</dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
