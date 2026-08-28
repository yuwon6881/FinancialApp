import React from 'react'
import {
  Save,
  Lock,
  Unlock,
  Loader2,
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
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { ToggleButton } from '../ui/ToggleButton'
import { NotificationsCard } from './NotificationsCard'
import type { PushBusyAction } from '../../app/usePushNotifications'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { FormField } from '../ui/FormField'
import { Button } from '../ui/Button'
import { SensitiveMask } from '../ui/SensitiveAmount'
import { Input } from '../ui/Input'
import { RangeInput } from '../ui/RangeInput'
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
  notifyOnLoginEnabled?: boolean
  onToggleNotifyOnLogin?: (checked: boolean) => void
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
  notifyOnLoginEnabled,
  onToggleNotifyOnLogin,
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
}) => {
  return (
    <div id="settings-panel-financial-model" role="tabpanel" aria-labelledby="settings-tab-financial-model" className="w-full grid grid-cols-1 lg:grid-cols-3 lg:items-start lg:gap-6 space-y-6 lg:space-y-0 animate-in fade-in duration-200">
      <form noValidate onSubmit={view.handleSaveSettings} className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              Financial Model
              <RowSyncStatus isSyncing={settingsSyncing} isPending={settingsPending} entityLabel="financial rules" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Controls budget targets and cycle calculations.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Target stability fund limit" required error={view.errors.target}>
            {hideSensitive ? (
              <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3"><SensitiveMask /></div>
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

        <div className="space-y-4 border-t border-border/30 pt-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Income Allocations</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${view.allocSum === 100 ? 'bg-blue-500/10 text-blue-500' : 'bg-destructive/15 text-destructive animate-pulse'}`}>
                {view.allocSum}%
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => view.setGlobalAllocLock(!view.globalAllocLock)}
              disabled={hideSensitive}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer sm:min-h-8"
            >
              {view.globalAllocLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
              {view.globalAllocLock ? 'Locked' : 'Unlocked'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {([
              ['Essentials', view.essentialsAllocInput, 'essentials', 'accent-blue-500'],
              ['Growth', view.growthAllocInput, 'growth', 'accent-green-500'],
              ['Stability', view.stabilityAllocInput, 'stability', 'accent-purple-500'],
              ['Rewards', view.rewardsAllocInput, 'rewards', 'accent-amber-500'],
            ] as const).map(([label, value, key, accentClass]) => (
              <div key={label} className="space-y-2 block">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-muted-foreground flex items-center gap-1.5"><span className="uppercase tracking-wider">{label}</span><Button variant="ghost" size="icon" type="button" onClick={() => view.toggleLock(key)} disabled={hideSensitive} className="size-11 text-muted-foreground hover:text-foreground hover:bg-muted sm:size-8" title={view.lockedAllocations.includes(key) ? 'Unlock' : 'Lock'}>{view.lockedAllocations.includes(key) ? <Lock className="size-3.5 text-blue-500" /> : <Unlock className="size-3.5" />}</Button></span>
                  <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md">{Number(value).toFixed(0)}%</span>
                </div>
                <RangeInput aria-label={`${label} allocation percentage`} min="0" max="100" step="5" disabled={hideSensitive || view.globalAllocLock || view.lockedAllocations.includes(key)} value={value} onChange={e => view.handleAllocationChange(key, parseFloat(e.target.value))} className={`w-full h-2 rounded-full cursor-pointer ${accentClass} bg-border disabled:opacity-50 disabled:cursor-not-allowed`} />
              </div>
            ))}
          </div>
          {view.errors.allocationSum && (
            <p className="text-xs text-destructive font-semibold">{view.errors.allocationSum}</p>
          )}
        </div>

        <div className="flex justify-end pt-3">
          <Button
            type="submit"
            disabled={hideSensitive || settingsSyncing || settingsPending}
            aria-busy={settingsSyncing}
            className="rounded-xl px-4 py-2 shadow-lg shadow-primary/10 hover:shadow-primary/20"
          >
            {settingsSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {settingsSyncing ? 'Saving…' : 'Save Rules'}
          </Button>
        </div>
      </form>

      <div className="space-y-6 lg:col-span-1">
        <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">App Preferences</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Customize display and local storage.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-y-3">
            <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
              <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                {darkMode ? <Moon className="size-4 text-muted-foreground shrink-0" /> : <Sun className="size-4 text-muted-foreground shrink-0" />}
                <span className="font-medium text-foreground truncate">Dark Mode</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <RowSyncStatus isSyncing={darkModeSyncing} isPending={darkModePending} entityLabel="dark mode" />
                <ToggleButton active={darkMode} onClick={onToggleDarkMode || (() => {})} disabled={darkModeSyncing || darkModePending} label="Dark mode" />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
              <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                {hideSensitive ? <EyeOff className="size-4 text-muted-foreground shrink-0" /> : <Eye className="size-4 text-muted-foreground shrink-0" />}
                <span className="font-medium text-foreground truncate">Sensitive Mode (Masked)</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <RowSyncStatus isSyncing={hideSensitiveSyncing} isPending={hideSensitivePending} entityLabel="sensitive mode" />
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
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Local Data</span>
                  <span className="text-xs text-muted-foreground">Remove cached data, offline drafts and any changes still waiting to sync.</span>
                </div>
              </div>
              <Button variant="unstyled"
                type="button"
                onClick={onClearLocalFinancialData}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer sm:min-h-8"
              >
                <DatabaseZap className="size-3.5 text-muted-foreground" /> Clear
              </Button>
            </div>
          </div>
        </div>

        <div>
          <NotificationsCard
            notifyOnLoginEnabled={notifyOnLoginEnabled || false}
            onToggleNotifyOnLogin={checked => onToggleNotifyOnLogin?.(checked)}
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
      </div>
    </div>
  )
}
