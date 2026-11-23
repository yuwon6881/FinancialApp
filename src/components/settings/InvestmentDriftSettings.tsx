import { useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { Lock, Unlock } from 'lucide-react'
import type { InvestmentPlan } from '../../types'
import { IconButton } from '../ui/IconButton'
import { RangeInput } from '../ui/RangeInput'

type DriftKey = 'watchDrift' | 'alertDrift'

const DRIFT_BANDS: ReadonlyArray<{
  key: DriftKey
  label: string
  hint: string
  badge: string
  /** Slider fill. */
  color: string
  lockColor: string
}> = [
  {
    key: 'watchDrift',
    label: 'Watch threshold',
    hint: 'From this threshold up to the off-target threshold, Investments marks the group as Drifting.',
    badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    color: 'var(--color-amber-500)',
    lockColor: 'text-amber-500',
  },
  {
    key: 'alertDrift',
    label: 'Off-target alert',
    hint: 'At this difference or higher, the group is Off target and your Dashboard shows an alert.',
    badge: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
    color: 'var(--color-orange-500)',
    lockColor: 'text-orange-500',
  },
]

/** Thresholds past thirty points are theoretical, so the scale stops there unless a saved plan
    already sits above it. Taken from the loaded plan rather than the live one, so the axis cannot
    move under the handle mid-drag. */
const driftScaleMax = (plan?: InvestmentPlan | null) =>
  Math.max(30, plan?.watchDrift ?? 0, plan?.alertDrift ?? 0)

export function InvestmentDriftSettings({ plan, savedPlan, setPlan, hideSensitive }: {
  plan: InvestmentPlan
  savedPlan?: InvestmentPlan
  setPlan: Dispatch<SetStateAction<InvestmentPlan>>
  hideSensitive: boolean
}) {
  const [lockedDrift, setLockedDrift] = useState<Record<DriftKey, boolean>>({
    watchDrift: true,
    alertDrift: true,
  })
  const driftMax = driftScaleMax(savedPlan)

  // The plan is only valid while Alert sits above Watch, so dragging one past the other pushes the
  // other along instead of parking the form on a validation error the slider caused.
  const changeDrift = (key: DriftKey, value: number) => {
    if (hideSensitive || lockedDrift[key]) return
    const isOtherLocked = key === 'watchDrift' ? lockedDrift.alertDrift : lockedDrift.watchDrift
    if (isOtherLocked) {
      if (key === 'watchDrift') {
        const next = Math.max(1, Math.min(plan.alertDrift - 1, Math.round(value)))
        setPlan(previous => ({ ...previous, watchDrift: next }))
      } else {
        const next = Math.max(plan.watchDrift + 1, Math.min(driftMax, Math.round(value)))
        setPlan(previous => ({ ...previous, alertDrift: next }))
      }
      return
    }
    const next = key === 'watchDrift'
      ? Math.max(1, Math.min(driftMax - 1, Math.round(value)))
      : Math.max(2, Math.min(driftMax, Math.round(value)))
    setPlan(previous => key === 'watchDrift'
      ? { ...previous, watchDrift: next, alertDrift: Math.max(previous.alertDrift, Math.min(driftMax, next + 1)) }
      : { ...previous, alertDrift: next, watchDrift: Math.min(previous.watchDrift, Math.max(1, next - 1)) })
  }

  const toggleDriftLock = (key: DriftKey) => {
    if (hideSensitive) return
    setLockedDrift(previous => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  return (
    <div className="mt-2 border-t border-border/60 pt-5">
      <h4 className="text-subsection text-foreground">Drift alerts</h4>
      <p className="mt-1 text-caption text-muted-foreground">Compare each group’s actual share with its target. If the target is 50% and the group holds 55%, it is 5 percentage points above target. Both thresholds apply when a group is above or below its target.</p>
      <div className="mt-2 divide-y divide-border/60">
        {DRIFT_BANDS.map(band => {
          const isLocked = lockedDrift[band.key]
          const minVal = band.key === 'watchDrift'
            ? 1
            : (lockedDrift.watchDrift ? plan.watchDrift + 1 : 2)
          const maxVal = band.key === 'watchDrift'
            ? (lockedDrift.alertDrift ? Math.min(driftMax - 1, plan.alertDrift - 1) : driftMax - 1)
            : driftMax

          return (
            <div key={band.key} className="w-full min-w-0 space-y-2 py-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-label text-foreground">{band.label}</span>
                  <IconButton
                    type="button"
                    label={`${isLocked ? 'Unlock' : 'Lock'} ${band.key === 'watchDrift' ? 'watch' : 'alert'} drift threshold`}
                    onClick={(e) => {
                      e.preventDefault()
                      toggleDriftLock(band.key)
                    }}
                    className="-my-2 shrink-0 text-muted-foreground hover:text-foreground"
                    disabled={hideSensitive}
                    tooltip={isLocked ? `Unlock ${band.key === 'watchDrift' ? 'watch' : 'alert'} drift threshold` : `Lock ${band.key === 'watchDrift' ? 'watch' : 'alert'} drift threshold`}
                  >
                    {isLocked ? <Lock className={`size-3.5 ${band.lockColor}`} /> : <Unlock className="size-3.5" />}
                  </IconButton>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-label tabular-nums ${band.badge}`}>
                  {plan[band.key]} percentage points
                </span>
              </div>
              <RangeInput
                aria-label={`${band.label}, in percentage points`}
                aria-valuetext={`${plan[band.key]} percentage points`}
                min={minVal}
                max={maxVal}
                step="1"
                disabled={hideSensitive || isLocked}
                value={plan[band.key]}
                onChange={event => changeDrift(band.key, Number(event.target.value))}
                style={{ '--range-color': band.color } as CSSProperties}
              />
              <p className="text-caption text-muted-foreground">{band.hint}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
