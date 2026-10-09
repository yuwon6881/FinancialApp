import React from 'react'
import {
  Save,
  Lock,
  Unlock,
  DatabaseZap,
  Moon,
  Sun,
  Eye,
  EyeOff,
  HardDrive,
} from 'lucide-react'
import type { PushChannel } from '../../types'
import { CustomSelect } from '../ui/CustomSelect'
import { CurrencySelect } from '../ui/CurrencySelect'
import { ToggleButton } from '../ui/ToggleButton'
import { MutationButtonContent } from '../ui/MutationButtonContent'
import { NotificationsCard } from './NotificationsCard'
import { PurchaseCapturePanelSlot } from '../../app/PurchaseCaptureBoundary'
import type { PushBusyAction } from '../../app/usePushNotifications'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { FormField } from '../ui/FormField'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { SensitiveMask } from '../ui/SensitiveAmount'
import { Input } from '../ui/Input'
import { RangeInput } from '../ui/RangeInput'
import { Badge } from '../ui/Badge'
import { SegmentedMeter } from '../ui/SegmentedMeter'
import { panelClass } from '../ui/panelStyles'
import { cn } from '../../lib/utils'
import { getCategoryChartColor } from '../../lib/categoryColors'
import type { useSettingsView } from './view/useSettingsView'

const getDayWithSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th'
  if (day % 10 === 1) return 'st'
  if (day % 10 === 2) return 'nd'
  if (day % 10 === 3) return 'rd'
  return 'th'
}

export interface FinancialModelTabProps {
  view: ReturnType<typeof useSettingsView>
  hideSensitive: boolean
  settingsSyncing: boolean
  settingsPending: boolean
  darkMode: boolean
  darkModeSyncing: boolean
  darkModePending: boolean
  hideSensitiveSyncing: boolean
  hideSensitivePending: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  onToggleDarkMode?: () => void
  onToggleHideSensitive?: () => void
  onClearLocalFinancialData?: () => void
  pushSupported?: boolean
  pushLoading?: boolean
  pushBusyAction?: PushBusyAction
  pushGuidance?: string | null
  billRemindersEnabled?: boolean
  categoryAlertsEnabled?: boolean
  otherDevicesBillReminders?: boolean
  otherDevicesCategoryAlerts?: boolean
  onToggleChannel?: (channel: PushChannel, checked: boolean) => void
  pushEnrolmentRevision?: number
  hasSpendingGuides: boolean
  onNavigateToCategoryLimits: () => void
  /**
   * `plan` is the money model -- allocations, the Stability target, cycle day and currency -- and
   * lives under Plan › Budget. `preferences` is app behaviour -- theme, privacy, local data and
   * notifications -- and lives in Settings.
   */
  part?: 'plan' | 'preferences'
}

export const FinancialModelTab: React.FC<FinancialModelTabProps> = ({
  view,
  hideSensitive,
  settingsSyncing,
  settingsPending,
  darkMode,
  darkModeSyncing,
  darkModePending,
  hideSensitiveSyncing,
  hideSensitivePending,
  sensitivePreferenceStatus,
  onToggleDarkMode,
  onToggleHideSensitive,
  onClearLocalFinancialData,
  pushSupported,
  pushLoading,
  pushBusyAction,
  pushGuidance,
  billRemindersEnabled,
  categoryAlertsEnabled,
  otherDevicesBillReminders,
  otherDevicesCategoryAlerts,
  onToggleChannel,
  pushEnrolmentRevision,
  hasSpendingGuides,
  onNavigateToCategoryLimits,
  part = 'plan',
}) => {
  const showPlan = part === 'plan'
  const showPreferences = part === 'preferences'
  return (
    <div id="settings-panel-financial-model" role="tabpanel" aria-labelledby="settings-tab-financial-model" className="grid w-full grid-cols-1 gap-6 animate-in fade-in duration-200 min-[1280px]:grid-cols-2 min-[1280px]:items-start">
      {showPlan && (
      <form noValidate onSubmit={view.handleSaveSettings} className={cn(panelClass, 'space-y-6 p-5 sm:p-6 min-[1280px]:col-span-2')}>
        <div>
          <h3 className="text-section text-foreground">Financial Model</h3>
          <p className="mt-1 text-body text-muted-foreground">The cycle, the emergency-fund target, and how every pay is divided.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Target stability fund limit" required error={view.errors.target}>
            {hideSensitive ? (
              <div className="flex h-11 items-center rounded-control border border-border bg-surface-2/70 px-3.5 lg:h-10"><SensitiveMask /></div>
            ) : (
              <Input
                type="text"
                inputMode="decimal"
                value={view.targetInput}
                onChange={e => {
                  const val = e.target.value
                  if (!/^\d*\.?\d{0,2}$/.test(val)) return
                  view.setTargetInput(val)
                  if (view.errors.target) {
                    view.setErrors(prev => {
                      const next = { ...prev }
                      delete next.target
                      return next
                    })
                  }
                }}
              />
            )}
          </FormField>

          <FormField label="Ledger cycle day">
            <CustomSelect
              ariaLabel="Ledger cycle day"
              disabled={hideSensitive}
              value={view.cycleDayInput}
              onChange={val => view.setCycleDayInput(String(val))}
              options={Array.from({ length: 28 }, (_, i) => ({
                value: (i + 1).toString(),
                label: `${i + 1}${getDayWithSuffix(i + 1)}`
              }))}
              className="w-full"
            />
          </FormField>

          <FormField label="Default account currency">
            <CurrencySelect
              ariaLabel="Default account currency"
              disabled={hideSensitive}
              value={view.currencyInput}
              onChange={view.setCurrencyInput}
              className="w-full"
            />
          </FormField>

          <FormField label="Stability fund overflow redirect">
            <CustomSelect
              ariaLabel="Stability fund overflow redirect"
              disabled={hideSensitive}
              value={view.stabilityOverflowRedirectInput}
              onChange={val => view.setStabilityOverflowRedirectInput(String(val))}
              options={[
                { value: 'Essentials 100%', label: '100% Essentials' },
                { value: 'Growth 100%', label: '100% Growth' },
                { value: 'Rewards 100%', label: '100% Rewards' },
                { value: 'Split: Essentials 50%, Growth 50%', label: '50% Essentials / 50% Growth' },
                { value: 'Split: Essentials 50%, Rewards 50%', label: '50% Essentials / 50% Rewards' },
                { value: 'Split: Growth 50%, Rewards 50%', label: '50% Growth / 50% Rewards' }
              ]}
              className="w-full"
            />
          </FormField>
        </div>

        <div className="space-y-5 border-t border-border/60 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-subsection text-foreground">Income Allocations</span>
              <Badge tone={view.allocSum === 100 ? 'success' : 'danger'} className={view.allocSum === 100 ? undefined : 'animate-pulse'}>
                {view.allocSum}%
              </Badge>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => view.setGlobalAllocLock(!view.globalAllocLock)}
              disabled={hideSensitive}
            >
              {view.globalAllocLock ? <Lock className="size-3.5" aria-hidden="true" /> : <Unlock className="size-3.5" aria-hidden="true" />}
              {view.globalAllocLock ? 'Locked' : 'Unlocked'}
            </Button>
          </div>

          {/* The split at a glance: one bar, each bucket in its own colour, so moving a slider
              visibly takes room from the others. */}
          <SegmentedMeter
            size="lg"
            total={100}
            label={`Essentials ${Number(view.essentialsAllocInput).toFixed(0)}%, Growth ${Number(view.growthAllocInput).toFixed(0)}%, Stability ${Number(view.stabilityAllocInput).toFixed(0)}%, Rewards ${Number(view.rewardsAllocInput).toFixed(0)}%`}
            segments={([
              ['Essentials', view.essentialsAllocInput],
              ['Growth', view.growthAllocInput],
              ['Stability', view.stabilityAllocInput],
              ['Rewards', view.rewardsAllocInput],
            ] as const).map(([label, value]) => ({ label, value: Number(value) || 0, color: getCategoryChartColor(label) }))}
          />

          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            {([
              ['Essentials', view.essentialsAllocInput, 'essentials'],
              ['Growth', view.growthAllocInput, 'growth'],
              ['Stability', view.stabilityAllocInput, 'stability'],
              ['Rewards', view.rewardsAllocInput, 'rewards'],
            ] as const).map(([label, value, key]) => {
              const locked = view.lockedAllocations.includes(key)
              return (
                <div key={label} className="block space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-label font-medium text-foreground">
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: getCategoryChartColor(label) }} />
                      {label}
                      <IconButton type="button" onClick={() => view.toggleLock(key)} disabled={hideSensitive} className="size-9 text-muted-foreground hover:text-foreground lg:size-8" label={`${locked ? 'Unlock' : 'Lock'} the ${label} allocation`} tooltip={locked ? 'Unlock' : 'Lock'}>
                        {locked ? <Lock className="size-3.5 text-foreground" /> : <Unlock className="size-3.5" />}
                      </IconButton>
                    </span>
                    <span className="text-section text-foreground tabular-nums">{Number(value).toFixed(0)}%</span>
                  </div>
                  <RangeInput
                    aria-label={`${label} allocation percentage`}
                    min="0"
                    max="100"
                    step="5"
                    disabled={hideSensitive || view.globalAllocLock || locked}
                    value={value}
                    onChange={e => view.handleAllocationChange(key, parseFloat(e.target.value))}
                    style={{ '--range-color': getCategoryChartColor(label) } as React.CSSProperties}
                  />
                </div>
              )
            })}
          </div>
          {view.errors.allocationSum && (
            <p className="text-label font-medium text-destructive">{view.errors.allocationSum}</p>
          )}
        </div>

        <div className="flex justify-end pt-3">
          <Button
            type="submit"
            disabled={hideSensitive || settingsSyncing || settingsPending}
            aria-busy={settingsSyncing}
          >
            <MutationButtonContent
              state={settingsSyncing ? 'syncing' : settingsPending ? 'pending' : null}
              entityLabel="financial rules"
              idleLabel="Save Rules"
              busyLabel={settingsSyncing ? 'Saving…' : 'Pending'}
              idleIcon={<Save className="size-3.5" />}
            />
          </Button>
        </div>
      </form>
      )}

      {showPreferences && (
      <>
      <div className="space-y-6">
        <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div>
              <h3 className="text-subsection text-foreground">App Preferences</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-y-3">
            <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
              <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                {darkMode ? <Moon className="size-4 text-muted-foreground shrink-0" /> : <Sun className="size-4 text-muted-foreground shrink-0" />}
                <span className="font-medium text-foreground truncate">Dark Mode</span>
              </div>
              <ToggleButton
                active={darkMode}
                onClick={onToggleDarkMode || (() => {})}
                disabled={darkModeSyncing || darkModePending}
                label="Dark mode"
                mutationStatus={{ isSyncing: darkModeSyncing, isPending: darkModePending }}
                mutationEntityLabel="dark mode"
              />
            </div>
            <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
              <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                {hideSensitive ? <EyeOff className="size-4 text-muted-foreground shrink-0" /> : <Eye className="size-4 text-muted-foreground shrink-0" />}
                <span className="font-medium text-foreground truncate">Sensitive Mode (Masked)</span>
              </div>
              <div className="shrink-0">
                <ToggleButton
                  active={hideSensitive}
                  onClick={onToggleHideSensitive || (() => {})}
                  label={
                    sensitivePreferenceStatus === 'pending'
                      ? 'Sensitive mode, checking privacy settings'
                      : sensitivePreferenceStatus === 'unavailable'
                        ? 'Sensitive mode, privacy setting unavailable'
                        : 'Sensitive mode'
                  }
                  disabled={hideSensitiveSyncing || hideSensitivePending || (sensitivePreferenceStatus !== undefined && sensitivePreferenceStatus !== 'resolved')}
                  mutationStatus={{ isSyncing: hideSensitiveSyncing, isPending: hideSensitivePending }}
                  mutationEntityLabel="sensitive mode"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Local Data</span>
                  <span className="text-xs text-muted-foreground">Remove cached data and offline drafts.</span>
                </div>
              </div>
              <Button variant="tertiary"
                type="button"
                onClick={onClearLocalFinancialData}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer sm:min-h-8"
              >
                <DatabaseZap className="size-3.5 text-muted-foreground" /> Clear
              </Button>
            </div>
          </div>
        </div>

      </div>
        <div>
          <PurchaseCapturePanelSlot />
          <NotificationsCard
            pushSupported={pushSupported !== false}
            pushLoading={pushLoading || false}
            pushBusyChannel={pushBusyAction ?? null}
            pushGuidance={pushGuidance}
            billRemindersEnabled={billRemindersEnabled || false}
            categoryAlertsEnabled={categoryAlertsEnabled || false}
            otherDevicesBillReminders={otherDevicesBillReminders || false}
            otherDevicesCategoryAlerts={otherDevicesCategoryAlerts || false}
            onToggleChannel={(channel, checked) => onToggleChannel?.(channel, checked)}
            enrolmentRevision={pushEnrolmentRevision ?? 0}
            hasSpendingGuides={hasSpendingGuides}
            onNavigateToCategoryLimits={onNavigateToCategoryLimits}
          />
        </div>
      </>
      )}
    </div>
  )
}
