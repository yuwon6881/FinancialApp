import { useMemo } from 'react'
import type { AppContextValue } from '../contexts/AppContext'
import { buildAppContextValue } from './buildAppContextValue'
import type { useAppPreferences } from './useAppPreferences'
import type { useFinancialData } from './useFinancialData'
import type { useAppDialogs } from './useAppDialogs'
import { SENSITIVE_AMOUNT_MASK } from '../lib/utils'

export function useAppRootContext(options: {
  prefs: ReturnType<typeof useAppPreferences>
  financial: ReturnType<typeof useFinancialData>
  dialogs: ReturnType<typeof useAppDialogs>
  guardSensitive: () => boolean
}) {
  const { prefs, financial, dialogs, guardSensitive } = options

  return useMemo<AppContextValue>(() => buildAppContextValue({
    hideSensitive: prefs.hideSensitive,
    maskPassiveFinancialFigures: prefs.maskPassiveFinancialFigures,
    sensitivePreferenceStatus: prefs.sensitivePreferenceStatus,
    currency: financial.optimisticDashboardData?.setting?.currency || 'USD',
    darkMode: prefs.darkMode,
    activeSyncId: financial.activeSyncId,
    activeSyncIds: financial.activeSyncIds,
    deletingId: financial.deletingTxId,
    isSyncing: financial.isBackgroundSyncing || financial.pendingOps.length > 0 || financial.activeSyncIds.length > 0,
    isOffline: financial.isOffline,
    formatSensitive: value => prefs.maskPassiveFinancialFigures ? SENSITIVE_AMOUNT_MASK : financial.formatSensitive(value),
    showToast: dialogs.showToast,
    guardSensitive,
    confirm: dialogs.setConfirmModalData,
    operations: financial.activeOps,
    queueMutation: (entity, type, targetId, payload, isUndo) => {
      if (!guardSensitive()) return false
      return financial.queueMutation(entity, type, targetId, payload, isUndo)
    },
  }), [
    prefs.hideSensitive,
    prefs.maskPassiveFinancialFigures,
    prefs.sensitivePreferenceStatus,
    financial.optimisticDashboardData?.setting?.currency,
    prefs.darkMode,
    financial.activeSyncId,
    financial.activeSyncIds,
    financial.deletingTxId,
    financial.isBackgroundSyncing,
    financial.pendingOps.length,
    financial.activeOps,
    financial.queueMutation,
    financial.isOffline,
    financial.formatSensitive,
    dialogs.showToast,
    guardSensitive,
    dialogs.setConfirmModalData,
  ])
}
