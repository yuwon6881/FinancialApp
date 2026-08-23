import React, { lazy } from 'react'
import { clearLocalFinancialData } from '../lib/cache'
import { buildMutationSuccessToast, buildUndoSuccessToast } from '../lib/mutationToast'
import type { useAppPreferences } from './useAppPreferences'
import type { useFinancialData } from './useFinancialData'
import type { useCycleNavigation } from './useCycleNavigation'
import type { useAppSession } from './useAppSession'
import type { useAppDialogs } from './useAppDialogs'
import type { usePushNotifications } from './usePushNotifications'

const SettingsView = lazy(() => import('../components/SettingsView').then(module => ({ default: module.SettingsView })))

export interface AuthenticatedSettingsRouteProps {
  prefs: ReturnType<typeof useAppPreferences>
  financial: ReturnType<typeof useFinancialData>
  nav: ReturnType<typeof useCycleNavigation>
  session: ReturnType<typeof useAppSession>
  dialogs: ReturnType<typeof useAppDialogs>
  push: ReturnType<typeof usePushNotifications>
  isCurrentCycle: boolean
  handleToggleDarkMode: () => void
  handleToggleHideSensitive: () => void
  hasPendingLocalChanges: boolean
  unsyncedChangeCount: number
  draftCount: number
}

export const AuthenticatedSettingsRoute: React.FC<AuthenticatedSettingsRouteProps> = ({
  prefs,
  financial,
  nav,
  session,
  dialogs,
  push,
  isCurrentCycle,
  handleToggleDarkMode,
  handleToggleHideSensitive,
  hasPendingLocalChanges,
  unsyncedChangeCount,
  draftCount,
}) => {
  return (
    <SettingsView 
      dashboardData={financial.optimisticDashboardData}
      categoriesList={financial.allCategories}
      onToggleDarkMode={handleToggleDarkMode}
      onToggleHideSensitive={handleToggleHideSensitive}
      sensitivePreferenceStatus={prefs.sensitivePreferenceStatus}
      onUpdateSettings={financial.handleUpdateSettings}
      onAddCategory={financial.handleAddCategory}
      onUpdateCategoryCycleLimit={financial.handleUpdateCategoryCycleLimit}
      onUpdateCategoryType={financial.handleUpdateCategoryType}
      onDeleteCategory={financial.requestDeleteCategory}
      onApplyCategoryCleanupSuggestion={financial.handleApplyCategoryCleanupSuggestion}
      accounts={financial.allAccounts}
      recurringPayments={financial.allRecurringPayments}
      highlightedAccountId={nav.highlightedAccountId}
      onClearHighlightedAccount={nav.clearHighlightedAccount}
      onAddAccount={financial.handleAddAccount}
      onUpdateAccount={financial.handleUpdateAccount}
      onRequestDeleteAccount={financial.requestDeleteAccount}
      onReconcileAccounts={financial.handleReconcileAccounts}
      isCurrentCycle={isCurrentCycle}
      notifyOnLoginEnabled={prefs.notifyOnLogin}
      onToggleNotifyOnLogin={(checked) => {
        const previous = prefs.notifyOnLogin
        prefs.setNotifyOnLogin(checked)
        const copy = buildMutationSuccessToast({
          entity: 'Settings',
          action: 'Updated',
          message: `Login notifications were ${checked ? 'enabled' : 'disabled'}.`,
        })
        dialogs.showToast(copy.message, copy.title, copy.tone, {
          label: 'Undo',
          onAction: () => {
            prefs.setNotifyOnLogin(previous)
            const undoCopy = buildUndoSuccessToast('Login notifications', 'settings')
            dialogs.showToast(undoCopy.message, undoCopy.title, undoCopy.tone)
          },
        })
      }}
      pushSupported={push.supported}
      pushLoading={push.loading}
      pushBusyAction={push.busyAction}
      pushGuidance={push.guidance}
      billRemindersEnabled={push.billRemindersEnabled}
      categoryAlertsEnabled={push.categoryAlertsEnabled}
      otherDevicesBillReminders={push.otherDevicesBillReminders}
      otherDevicesCategoryAlerts={push.otherDevicesCategoryAlerts}
      pushEnrolmentRevision={push.enrolmentRevision}
      onToggleChannel={(channel, checked) => {
        void (async () => {
          const succeeded = await push.setChannelEnabled(channel, checked)
          if (!succeeded) {
            const isBills = channel === 'billReminders'
            dialogs.showToast(
              checked
                ? `${isBills ? 'Bill reminders' : 'Spending alerts'} could not be turned on for this device. Check your browser notification permission and try again.`
                : `${isBills ? 'Bill reminders' : 'Spending alerts'} could not be turned off. Please try again.`,
              'Notification setting not saved',
              'error',
            )
            return
          }
          const isBills = channel === 'billReminders'
          const copy = buildMutationSuccessToast({
            entity: isBills ? 'Bill reminders' : 'Spending alerts',
            action: checked ? 'Turned on' : 'Turned off',
            message: checked
              ? isBills
                ? 'This device will now be reminded before each bill is due.'
                : 'This device will now be told when a category gets close to its planned amount.'
              : 'This device will no longer show these. Your other devices are unchanged.',
          })
          dialogs.showToast(copy.message, copy.title, copy.tone)
        })()
      }}
      onNavigateToLedger={nav.handleNavigateToLedger}
      onClearLocalFinancialData={() => {
        const month = nav.selectedMonth
        const year = nav.selectedYear
        const atStake = [
          unsyncedChangeCount > 0
            ? `${unsyncedChangeCount} ${unsyncedChangeCount === 1 ? 'change has' : 'changes have'} not synced yet`
            : null,
          draftCount > 0
            ? `${draftCount} ${draftCount === 1 ? 'draft is' : 'drafts are'} saved only on this device`
            : null,
        ].filter(Boolean)
        const message = hasPendingLocalChanges
          ? `${atStake.join(' and ')}. Clearing removes them permanently.`
          : 'This removes saved copies of your data from this device. Your account is unaffected.'
        dialogs.setConfirmModalData({
          title: 'Clear local data?',
          message,
          confirmText: 'Clear local data',
          onConfirm: () => {
            void (async () => {
              try {
                await financial.handleLogoutCleanup(session.username, false)
              } finally {
                clearLocalFinancialData()
              }
              await financial.loadAll(month, year, true)
              const copy = buildMutationSuccessToast({
                entity: 'Local Data',
                action: 'Cleared',
                message: 'Cached financial data, offline drafts and unsynced changes were removed from this device.',
              })
              dialogs.showToast(copy.message, copy.title, copy.tone)
            })()
          },
        })
      }}
    />
  )
}
