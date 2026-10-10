import React from 'react'
import { Lock, Pencil, Save, Unlock } from 'lucide-react'
import type { DashboardData } from '../../../types'
import type { AllocationKey } from '../../../lib/allocations'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { getCurrencySymbol } from '../../../lib/utils'
import { cn } from '../../../lib/utils'
import { AmountText } from '../../ui/AmountText'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { CurrencySelect } from '../../ui/CurrencySelect'
import { CustomSelect } from '../../ui/CustomSelect'
import { IconButton } from '../../ui/IconButton'
import { Input } from '../../ui/Input'
import { MutationButtonContent } from '../../ui/MutationButtonContent'
import { RangeInput } from '../../ui/RangeInput'
import { SegmentedMeter } from '../../ui/SegmentedMeter'
import { SensitiveMask } from '../../ui/SensitiveAmount'
import { panelClass } from '../../ui/panelStyles'
import type { useSettingsView } from '../view/useSettingsView'
import { RuleRow } from './RuleRow'

const DEFAULT_OVERFLOW_REDIRECT = 'Split: Growth 50%, Rewards 50%'

const getDayWithSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th'
  if (day % 10 === 1) return 'st'
  if (day % 10 === 2) return 'nd'
  if (day % 10 === 3) return 'rd'
  return 'th'
}

const CYCLE_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `${i + 1}${getDayWithSuffix(i + 1)}`,
}))

const OVERFLOW_OPTIONS = [
  { value: 'Essentials 100%', label: '100% Essentials' },
  { value: 'Growth 100%', label: '100% Growth' },
  { value: 'Rewards 100%', label: '100% Rewards' },
  { value: 'Split: Essentials 50%, Growth 50%', label: '50% Essentials / 50% Growth' },
  { value: 'Split: Essentials 50%, Rewards 50%', label: '50% Essentials / 50% Rewards' },
  { value: 'Split: Growth 50%, Rewards 50%', label: '50% Growth / 50% Rewards' },
]

/** What each bucket is for, said once beside its share so the split reads as a plan. */
const BUCKET_ROLE: Record<AllocationKey, string> = {
  essentials: 'Bills and everyday spending',
  growth: 'Investing and long-term savings',
  stability: 'Emergency fund, up to its target',
  rewards: 'Guilt-free spending and goals',
}

export interface AllocationPlanProps {
  view: ReturnType<typeof useSettingsView>
  hideSensitive: boolean
  settingsSyncing: boolean
  settingsPending: boolean
  /** Supplies this cycle's income, so each share can be read as money as well as a percentage. */
  dashboardData?: DashboardData | null
}

const differs = (input: string, saved: number) => Math.abs((Number.parseFloat(input) || 0) - saved) > 0.001

/**
 * Plan › Budget › Allocation & rules: the split first, as a plan -- one bar, then each bucket with
 * its share and what that share means per pay -- and the rules that steer it as a grouped settings
 * list. The sliders come out only while the split is being edited, and Save only appears once
 * something has changed.
 */
export function AllocationPlan({ view, hideSensitive, settingsSyncing, settingsPending, dashboardData }: AllocationPlanProps) {
  const saved = view.activeSettings
  const currency = saved.currency || 'USD'
  const editing = !view.globalAllocLock && !hideSensitive

  const buckets = ([
    ['Essentials', view.essentialsAllocInput, 'essentials', saved.essentialsAlloc],
    ['Growth', view.growthAllocInput, 'growth', saved.growthAlloc],
    ['Stability', view.stabilityAllocInput, 'stability', saved.stabilityAlloc],
    ['Rewards', view.rewardsAllocInput, 'rewards', saved.rewardsAlloc],
  ] as const).map(([label, value, key, savedShare]) => ({
    label,
    key,
    percent: Number.parseFloat(value) || 0,
    changed: differs(value, savedShare * 100),
    color: getCategoryChartColor(label),
  }))

  // The cycle's actual income when there is one; otherwise the planned bucket targets, which are
  // the same split applied to the expected pay.
  const payBase = React.useMemo(() => {
    const income = dashboardData?.stats?.monthlyIncome ?? 0
    if (income > 0) return income
    const planned = (dashboardData?.categories ?? [])
      .filter(category => ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(category.name))
      .reduce((sum, category) => sum + Math.max(0, category.target || 0), 0)
    return planned
  }, [dashboardData])

  const dirty = !hideSensitive && (
    !view.targetInput.trim()
    || differs(view.targetInput, saved.targetStabilityFund)
    || buckets.some(bucket => bucket.changed)
    || view.cycleDayInput !== String(saved.cycleDay)
    || view.currencyInput !== currency
    || view.stabilityOverflowRedirectInput !== (saved.stabilityOverflowRedirect || DEFAULT_OVERFLOW_REDIRECT)
  )
  const hasErrors = Object.keys(view.errors).length > 0
  const showSaveBar = dirty || settingsSyncing || settingsPending || hasErrors

  const discard = () => {
    view.setTargetInput(saved.targetStabilityFund.toString())
    view.setEssentialsAllocInput((saved.essentialsAlloc * 100).toString())
    view.setGrowthAllocInput((saved.growthAlloc * 100).toString())
    view.setStabilityAllocInput((saved.stabilityAlloc * 100).toString())
    view.setRewardsAllocInput((saved.rewardsAlloc * 100).toString())
    view.setCycleDayInput(saved.cycleDay.toString())
    view.setCurrencyInput(currency)
    view.setStabilityOverflowRedirectInput(saved.stabilityOverflowRedirect || DEFAULT_OVERFLOW_REDIRECT)
    view.setErrors({})
  }

  const symbol = getCurrencySymbol(currency)

  return (
    <form noValidate onSubmit={view.handleSaveSettings} className="@container min-w-0 space-y-4">
      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section aria-labelledby="budget-split-heading" className={cn(panelClass, 'min-w-0 overflow-hidden')}>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="budget-split-heading" className="text-section text-foreground">Your split</h2>
                  {view.allocSum !== 100 && <Badge tone="danger">{view.allocSum}%</Badge>}
                </div>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {payBase > 0 ? (
                    <>Of <AmountText value={payBase} currency={currency} isMasked={hideSensitive} className="font-medium text-foreground" /> income this cycle</>
                  ) : 'How each pay is divided'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => view.setGlobalAllocLock(!view.globalAllocLock)}
                disabled={hideSensitive}
                aria-pressed={editing}
                title={hideSensitive ? 'Unhide balances to edit the split' : undefined}
                className="shrink-0"
              >
                {editing ? <Lock className="size-3.5" aria-hidden="true" /> : <Pencil className="size-3.5" aria-hidden="true" />}
                {editing ? 'Lock split' : 'Edit split'}
              </Button>
            </div>

            {/* The split at a glance: one bar, each bucket in its own colour, so moving a slider
                visibly takes room from the others. */}
            <SegmentedMeter
              size="lg"
              total={100}
              label={buckets.map(bucket => `${bucket.label} ${bucket.percent.toFixed(0)}%`).join(', ')}
              segments={buckets.map(bucket => ({ label: bucket.label, value: bucket.percent, color: bucket.color }))}
            />
          </div>

          <ul className="divide-y divide-border/60 border-t border-border/60">
            {buckets.map(bucket => {
              const locked = view.lockedAllocations.includes(bucket.key)
              return (
                <li key={bucket.key} className="px-4 py-3 sm:px-5">
                  <div className="flex min-h-11 items-center gap-3">
                    <CategoryIcon category={bucket.label} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-foreground">{bucket.label}</p>
                      <p className="truncate text-caption text-muted-foreground">
                        {payBase > 0 && (
                          <>
                            <AmountText value={(payBase * bucket.percent) / 100} currency={currency} isMasked={hideSensitive} />
                            {' a pay'}
                            <span className="hidden @md:inline"> · </span>
                          </>
                        )}
                        <span className={cn(payBase > 0 && 'hidden @md:inline')}>{BUCKET_ROLE[bucket.key]}</span>
                      </p>
                    </div>
                    {editing && (
                      <IconButton
                        type="button"
                        onClick={() => view.toggleLock(bucket.key)}
                        className="text-muted-foreground hover:text-foreground"
                        label={`${locked ? 'Unlock' : 'Lock'} the ${bucket.label} allocation`}
                        tooltip={locked ? 'Unlock' : 'Lock'}
                      >
                        {locked ? <Lock className="size-3.5 text-foreground" /> : <Unlock className="size-3.5" />}
                      </IconButton>
                    )}
                    <span className="w-14 shrink-0 text-right text-section text-foreground tabular-nums">
                      {bucket.percent.toFixed(0)}%
                    </span>
                  </div>
                  {editing && (
                    <div className="pb-2 pl-11 pt-4">
                    <RangeInput
                      aria-label={`${bucket.label} allocation percentage`}
                      min="0"
                      max="100"
                      step="5"
                      disabled={locked}
                      value={bucket.percent}
                      onChange={event => view.handleAllocationChange(bucket.key, Number.parseFloat(event.target.value))}
                      style={{ '--range-color': bucket.color } as React.CSSProperties}
                    />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {view.errors.allocationSum && (
            <p role="alert" className="border-t border-border/60 px-4 py-3 text-label font-medium text-destructive sm:px-5">
              {view.errors.allocationSum}
            </p>
          )}
        </section>

        <section aria-labelledby="budget-rules-heading" className={cn(panelClass, 'min-w-0 overflow-hidden')}>
          <div className="px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
            <h2 id="budget-rules-heading" className="text-section text-foreground">Rules</h2>
            <p className="mt-0.5 text-caption text-muted-foreground">When a cycle starts and where extra money goes</p>
          </div>
          <div className="divide-y divide-border/60">
            <RuleRow
              label="Stability fund target"
              hint="Stability stops filling once it holds this"
              required
              error={view.errors.target}
            >
              {hideSensitive ? (
                <div className="flex h-11 w-36 items-center justify-end rounded-control bg-surface-2/70 px-3.5 lg:h-10"><SensitiveMask /></div>
              ) : (
                <div className="relative w-36">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label text-muted-foreground">{symbol}</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={view.targetInput}
                    className={cn('text-right tabular-nums', symbol.length > 2 ? 'pl-12' : 'pl-9')}
                    onChange={event => {
                      const value = event.target.value
                      if (!/^\d*\.?\d{0,2}$/.test(value)) return
                      view.setTargetInput(value)
                      if (view.errors.target) {
                        view.setErrors(previous => {
                          const next = { ...previous }
                          delete next.target
                          return next
                        })
                      }
                    }}
                  />
                </div>
              )}
            </RuleRow>

            <RuleRow label="Cycle starts on" hint="The day each pay cycle begins">
              <CustomSelect
                ariaLabel="Ledger cycle day"
                variant="ghost"
                align="right"
                disabled={hideSensitive}
                value={view.cycleDayInput}
                onChange={value => view.setCycleDayInput(String(value))}
                options={CYCLE_DAY_OPTIONS}
                className="w-28"
              />
            </RuleRow>

            <RuleRow label="Currency" hint="Used for new accounts">
              <CurrencySelect
                ariaLabel="Default account currency"
                disabled={hideSensitive}
                value={view.currencyInput}
                onChange={view.setCurrencyInput}
                controlSize="sm"
                // Drawn as a quiet value like the selects beside it; the field border belongs to
                // free-text entry, and a lone bordered box in a list of values reads as an error.
                className="w-36 [&_button[aria-haspopup]]:border-transparent [&_button[aria-haspopup]]:bg-transparent [&_button[aria-haspopup]]:justify-end"
              />
            </RuleRow>

            <RuleRow label="Once Stability is full" hint="Where its share goes instead">
              <CustomSelect
                ariaLabel="Stability fund overflow redirect"
                variant="ghost"
                align="right"
                disabled={hideSensitive}
                value={view.stabilityOverflowRedirectInput}
                onChange={value => view.setStabilityOverflowRedirectInput(String(value))}
                options={OVERFLOW_OPTIONS}
                className="w-56 max-w-full"
              />
            </RuleRow>
          </div>
        </section>
      </div>

      {/* Save lives with the changes rather than at the foot of a long form: it appears once
          something differs from what is saved, and stays reachable above the tab bar on a phone. */}
      {showSaveBar && (
        <div className="glass-surface sticky bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-20 flex items-center gap-2 rounded-full p-2 pl-5 shadow-(--app-shadow-overlay) animate-in fade-in duration-150 sm:bottom-4">
          <span className="min-w-0 flex-1 truncate text-label font-medium text-foreground">
            {settingsSyncing ? 'Saving your plan…' : settingsPending ? 'Waiting to sync' : 'Unsaved changes'}
          </span>
          {dirty && (
            <Button variant="tertiary" size="sm" type="button" onClick={discard} disabled={settingsSyncing}>
              Discard
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={hideSensitive || settingsSyncing || settingsPending}
            aria-busy={settingsSyncing}
          >
            <MutationButtonContent
              state={settingsSyncing ? 'syncing' : settingsPending ? 'pending' : null}
              entityLabel="financial rules"
              idleLabel="Save rules"
              busyLabel={settingsSyncing ? 'Saving…' : 'Pending'}
              idleIcon={<Save className="size-3.5" />}
            />
          </Button>
        </div>
      )}
    </form>
  )
}
