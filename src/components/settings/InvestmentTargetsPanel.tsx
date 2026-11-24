import type { Dispatch, SetStateAction } from 'react'
import type { InvestmentGroup, InvestmentPlan } from '../../types'
import { cn } from '../../lib/utils'
import { PillSwitch } from '../ui/PillSwitch'
import { panelClass } from '../ui/panelStyles'
import { InvestmentDriftSettings } from './InvestmentDriftSettings'
import { InvestmentGroupTargets } from './InvestmentGroupTargets'

/**
 * Targets depend on groups, so the switch explains what it is waiting for instead of letting a
 * person turn on a mix with nothing to divide. Drift alerts only mean something against a target,
 * so they live here too.
 */
export function InvestmentTargetsPanel({
  enabled, grouping, groups, savedTargetsActive, currentMix, plan, savedPlan, setPlan, disabled, onEnabledChange, onGroupsChange,
}: {
  enabled: boolean
  grouping: boolean
  groups: InvestmentGroup[]
  savedTargetsActive: boolean
  currentMix?: ReadonlyMap<string, number>
  plan: InvestmentPlan
  savedPlan?: InvestmentPlan
  setPlan: Dispatch<SetStateAction<InvestmentPlan>>
  disabled: boolean
  onEnabledChange: (enabled: boolean) => void
  onGroupsChange: (groups: InvestmentGroup[]) => void
}) {
  const available = grouping && groups.length > 0
  const active = available && enabled
  const status = !grouping
    ? 'Turn on investment groups first.'
    : groups.length === 0
      ? 'Add a group first.'
      : !enabled
        ? 'Off. Groups still show what you hold.'
        : null

  return (
    <section aria-labelledby="investment-targets-title" className={cn(panelClass, 'w-full min-w-0 p-4 sm:p-6')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="investment-targets-title" className="text-section text-foreground">Portfolio targets</h3>
          <p className="mt-1 text-caption text-muted-foreground">
            How much each group should hold, and when to flag drift.
          </p>
        </div>
        <PillSwitch checked={active} onChange={onEnabledChange} disabled={disabled || !available} ariaLabel="Use portfolio targets" />
      </div>
      {status && <p className="mt-3 rounded-control inset-group p-3 text-caption text-muted-foreground">{status}</p>}
      {active && (
        <>
          <InvestmentGroupTargets groups={groups} disabled={disabled} initiallyLocked={savedTargetsActive}
            currentMix={currentMix} onChange={onGroupsChange} />
          <InvestmentDriftSettings plan={plan} savedPlan={savedPlan} setPlan={setPlan} hideSensitive={disabled} />
        </>
      )}
    </section>
  )
}
