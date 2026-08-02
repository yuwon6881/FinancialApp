import { useMemo, type ReactNode } from 'react'
import {
  AppPrefsContext,
  AppSyncContext,
  AppUiContext,
  type AppContextValue,
} from './AppContext'

/**
 * Splits the flat app context value into its three independently-memoized slices.
 *
 * Callers keep passing one object; the split happens here so a change to the sync fields
 * does not produce a new prefs or UI value. Each useMemo depends on its own fields only —
 * that is the entire mechanism, so keep the dependency lists exact. Widening one (or
 * memoizing on `value` itself) silently restores the old behaviour, where a single outbox
 * tick re-rendered every consumer of every field.
 */
export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  const prefs = useMemo(() => ({
    hideSensitive: value.hideSensitive,
    currency: value.currency,
    darkMode: value.darkMode,
    formatSensitive: value.formatSensitive,
  }), [value.hideSensitive, value.currency, value.darkMode, value.formatSensitive])

  const ui = useMemo(() => ({
    showToast: value.showToast,
    guardSensitive: value.guardSensitive,
    confirm: value.confirm,
  }), [value.showToast, value.guardSensitive, value.confirm])

  const sync = useMemo(() => ({
    activeSyncId: value.activeSyncId,
    activeSyncIds: value.activeSyncIds,
    deletingId: value.deletingId,
    isSyncing: value.isSyncing,
    isOffline: value.isOffline,
    operations: value.operations,
    queueMutation: value.queueMutation,
  }), [
    value.activeSyncId,
    value.activeSyncIds,
    value.deletingId,
    value.isSyncing,
    value.isOffline,
    value.operations,
    value.queueMutation,
  ])

  return (
    <AppPrefsContext.Provider value={prefs}>
      <AppUiContext.Provider value={ui}>
        <AppSyncContext.Provider value={sync}>
          {children}
        </AppSyncContext.Provider>
      </AppUiContext.Provider>
    </AppPrefsContext.Provider>
  )
}
