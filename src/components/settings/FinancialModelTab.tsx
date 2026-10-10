import React from 'react'
import {
  DatabaseZap,
  Moon,
  Sun,
  Eye,
  EyeOff,
  HardDrive,
} from 'lucide-react'
import type { DashboardData, PushChannel } from '../../types'
import { ToggleButton } from '../ui/ToggleButton'
import { NotificationsCard } from './NotificationsCard'
import { PurchaseCapturePanelSlot } from '../../app/PurchaseCaptureBoundary'
import type { PushBusyAction } from '../../app/usePushNotifications'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import type { useSettingsView } from './view/useSettingsView'
import { AllocationPlan } from './budget/AllocationPlan'

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
  /** This cycle's figures, so the split can be read as money per pay. Only the plan part uses it. */
  dashboardData?: DashboardData | null
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
  dashboardData,
}) => {
  const showPlan = part === 'plan'
  const showPreferences = part === 'preferences'
  return (
    <div id="settings-panel-financial-model" role="tabpanel" aria-labelledby="settings-tab-financial-model" className={cn('grid w-full grid-cols-1 gap-6 animate-in fade-in duration-200', showPreferences && 'min-[1280px]:grid-cols-2 min-[1280px]:items-start')}>
      {showPlan && (
        <AllocationPlan
          view={view}
          hideSensitive={hideSensitive}
          settingsSyncing={settingsSyncing}
          settingsPending={settingsPending}
          dashboardData={dashboardData}
        />
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
