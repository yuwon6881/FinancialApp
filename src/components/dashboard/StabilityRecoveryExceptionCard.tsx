import React from 'react'
import { ChevronRight, ShieldAlert } from 'lucide-react'
import type { StabilityRecovery, StabilityReloadFilter } from '../../types'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/BottomSheet'
import { InfoHint } from '../ui/InfoHint'
import { describeStabilityRecovery } from '../../lib/stabilityRecoveryNarrative'
import { Badge } from '../ui/Badge'
import { NoticeCard } from '../ui/NoticeCard'
import { StabilityRecoveryDetails } from './StabilityRecoveryDetails'

interface StabilityRecoveryLedgerJump {
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
  isMasked?: boolean
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
 * short of target, still owing, and no longer told about it. It is zero in the spending cycle too,
 * where the plan has not opened yet. Being ahead of the plan, or ahead of its start, changes the
 * sentence rather than whether there is one.
 *
 * Which sentence that is comes from `describeStabilityRecovery`, so the precedence between those
 * states is decided in one tested place rather than in nested ternaries here.
 *
 * The card still carries no action that *changes* anything — the transaction form and ledger edit
 * own the answer. What it does carry is the marked/repaid arithmetic and a way to see it: an
 * obligation derived from several ledger rows is otherwise a number the app asserts and the user
 * cannot check.
 */
export function StabilityRecoveryExceptionCard({
  recovery,
  formatSensitive,
  isMasked = false,
  onNavigateToLedger,
}: StabilityRecoveryExceptionCardProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = React.useState(false)

  if (!recovery || !recovery.isActive) return null
  if (recovery.outstandingShortfall <= 0) return null

  const {
    status,
    shortfall,
    askThisCycle,
    // Two money figures side by side read as additive unless the containment is said out loud: this
    // cycle's ask is a slice of the shortfall, never money owed on top of it. Once the ask covers
    // the whole remaining shortfall, naming both would print the same figure twice.
    askIsWholeShortfall,
    cyclePlanFunded,
    cyclePlanPercent,
  } = describeStabilityRecovery(recovery)
  // The jump needs a window to filter on, and only the server can say when the fund was last full.
  const canShowMovements = Boolean(onNavigateToLedger && recovery.recoveryFromDate)

  const statusBadge = status === 'deferred'
    ? <Badge tone="neutral">Starts next cycle</Badge>
    : status === 'aheadOfPace'
      ? <Badge tone="success">Ahead of plan</Badge>
      : status === 'overdue'
        ? <Badge tone="danger">Plan overdue</Badge>
        : status === 'finalCycle'
          ? <Badge tone="warning">Final cycle</Badge>
          : null

  return (
    <NoticeCard
      tone={status === 'overdue' ? 'urgent' : 'attention'}
      icon={<ShieldAlert />}
      titleId="stability-recovery-exception"
      title={(
        <>
          Emergency fund recovery
          <InfoHint
            label="How putting money back is worked out"
            text="Only money you mark as needing to go back creates this reminder. Your normal salary share does not count as putting it back; reaching your target clears it."
            inline
            className="ml-1"
          />
        </>
      )}
      badge={statusBadge}
      description={status === 'deferred' ? (
        <>{formatSensitive(shortfall)} still short · recovery starts next cycle.</>
      ) : status === 'aheadOfPace' ? (
        <>{formatSensitive(shortfall)} still short · nothing due this cycle.</>
      ) : askIsWholeShortfall ? (
        <>Put back {formatSensitive(askThisCycle)} this cycle to clear the shortfall.</>
      ) : (
        <>Put back {formatSensitive(askThisCycle)} this cycle · {formatSensitive(shortfall)} still short.</>
      )}
      actions={(
        <Button
          variant="secondary"
          size="sm"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isBreakdownOpen}
          aria-label="See recovery details"
          onClick={() => setIsBreakdownOpen(true)}
        >
          Details
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-label text-muted-foreground">This cycle</span>
          <span className="text-label font-semibold tabular-nums text-foreground">
            {status === 'deferred' || cyclePlanPercent === null
              ? '—'
              : <>{formatSensitive(cyclePlanFunded)} of {formatSensitive(recovery.requiredThisCycle)}</>}
          </span>
        </div>
        {cyclePlanPercent !== null && (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/8 dark:bg-foreground/10"
            role="progressbar"
            aria-label="This cycle's recovery plan"
            aria-valuemin={isMasked ? undefined : 0}
            aria-valuemax={isMasked ? undefined : 100}
            aria-valuenow={isMasked ? undefined : cyclePlanPercent}
            aria-valuetext={isMasked ? 'Hidden' : undefined}
          >
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-fluid"
              style={{ width: `${isMasked ? 0 : cyclePlanPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* The breakdown names the ledger obligation and its repayments. Keep it out of the dashboard
          flow because a healthy reader never needs it, and this panel already competes with other
          exception cards for the top of the page. The same disclosure works on a phone and desktop,
          but a sheet gives the detail room to breathe without making the card taller by default. */}
      <BottomSheet
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        title="Emergency fund recovery details"
        maxWidthClassName="max-w-xl"
        footer={(
          <Button variant="secondary" size="sm" onClick={() => setIsBreakdownOpen(false)} className="w-full">
            Close
          </Button>
        )}
      >
        <div className="space-y-4">
          <StabilityRecoveryDetails recovery={recovery} formatSensitive={formatSensitive} />

          {canShowMovements ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                className="w-full justify-center"
                onClick={() => {
                  setIsBreakdownOpen(false)
                  onNavigateToLedger?.({
                    category: 'Stability',
                    startDate: recovery.recoveryFromDate,
                    endDate: new Date().toLocaleDateString('en-CA'),
                    reloadFilter: 'needs-put-back',
                    showAllCycles: true,
                    range: 'all',
                  })
                }}
              >
                View pending reload movements
              </Button>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              No reload movements to list yet.
            </p>
          )}
        </div>
      </BottomSheet>
    </NoticeCard>
  )
}
