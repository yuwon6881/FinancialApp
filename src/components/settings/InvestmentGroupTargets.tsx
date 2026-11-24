import { useState, type CSSProperties } from 'react'
import { Lock, Unlock } from 'lucide-react'
import type { InvestmentGroup } from '../../types'
import { changeGroupTarget, groupTargetLimit, groupTargetStep, investmentGroupColor } from '../../lib/investmentGroups'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { RangeInput } from '../ui/RangeInput'
import { SegmentedMeter } from '../ui/SegmentedMeter'

export function InvestmentGroupTargets({ groups, disabled, onChange }: {
  groups: InvestmentGroup[]
  disabled: boolean
  onChange: (groups: InvestmentGroup[]) => void
}) {
  const [locked, setLocked] = useState(true)
  const [lockedKey, setLockedKey] = useState<string | null>(null)
  const currentLock = groups.length >= 3 && groups.some(group => group.key === lockedKey) ? lockedKey : null
  const editable = !disabled && !locked
  const step = groupTargetStep(groups)
  const total = Math.round(groups.reduce((sum, group) => sum + group.targetPercentage, 0) * 100) / 100

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">The share of your Growth investments each group should hold.</p>
        <Button variant="secondary" size="sm" onClick={() => setLocked(!locked)}
          disabled={disabled} aria-pressed={locked} className="shrink-0">
          {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          {locked ? 'Locked' : 'Unlocked'}
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        <SegmentedMeter size="md" total={100}
          label={`Target mix: ${groups.map(group => `${group.label} ${group.targetPercentage}%`).join(', ')}`}
          segments={groups.map((group, index) => ({ label: group.label, value: group.targetPercentage, color: investmentGroupColor(index) }))}
        />
        <p className="text-right text-caption tabular-nums text-muted-foreground">Total: {total}%</p>
      </div>
      <div className="mt-2 divide-y divide-border/60">
        {groups.map((group, index) => {
          const color = investmentGroupColor(index)
          const isLocked = currentLock === group.key
          return (
            <div key={group.key} className="w-full min-w-0 space-y-2 py-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="min-w-0 wrap-break-word text-label text-foreground">{group.label}</span>
                  {groups.length >= 3 && (
                    <IconButton label={`${isLocked ? 'Unlock' : 'Lock'} ${group.label} target`}
                      onClick={() => setLockedKey(isLocked ? null : group.key)}
                      className="-my-2 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={disabled || (currentLock !== null && !isLocked)}>
                      {isLocked ? <Lock className="size-3.5 text-accent-ink" /> : <Unlock className="size-3.5" />}
                    </IconButton>
                  )}
                </span>
                <span className="text-subsection text-foreground tabular-nums">{group.targetPercentage}%</span>
              </div>
              <RangeInput aria-label={`${group.label} target`} min={step}
                max={isLocked ? 100 : groupTargetLimit(groups, currentLock)} step={step}
                disabled={!editable || isLocked || groups.length - Number(Boolean(currentLock)) < 2}
                value={group.targetPercentage} onChange={event => onChange(changeGroupTarget(groups, group.key, Number(event.target.value), currentLock))}
                style={{ '--range-color': color } as CSSProperties} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
