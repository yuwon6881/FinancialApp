import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import type { EntityKind, OpType, OutboxPayload, QueuedOp } from '../lib/outbox'
import type { SensitivePreferenceStatus } from '../app/useAppPreferences'

interface ConfirmRequest {
  title: string
  message: ReactNode
  confirmText?: string
  confirmDisabled?: boolean
  onConfirm: () => void
}

/**
 * App-wide state, split into three contexts by how often each part changes.
 *
 * This used to be a single context object. The sync fields (`activeSyncId`, `deletingId`,
 * `isSyncing`, `operations`) change on every outbox tick, so one tick re-rendered every
 * consumer of the near-static fields too — including the dashboard charts and report
 * tables, which only ever read `hideSensitive`/`currency`/`formatSensitive`. Splitting the
 * value is what lets a component subscribe to just the part it uses: the React Compiler can
 * skip a re-render caused by unchanged props, but not one a changed context value forces.
 *
 * - Prefs: display preferences. Change only on explicit user action.
 * - Ui:    stable callbacks for toasts, confirms and sensitive-mode guarding.
 * - Sync:  outbox and connectivity state. Changes constantly.
 */
export interface AppPrefsValue {
  hideSensitive: boolean
  maskPassiveFinancialFigures?: boolean
  /** Privacy is safe-by-default while the server-backed preference is still resolving. */
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  currency: string
  darkMode: boolean
  formatSensitive: (value: number) => ReactNode
}

export interface AppUiValue {
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  guardSensitive: () => boolean
  confirm: (request: ConfirmRequest) => void
}

export interface AppSyncValue {
  activeSyncId: string | null
  /** All records participating in the current direct/queue mutation. */
  activeSyncIds?: string[]
  deletingId: string | null
  isSyncing: boolean
  isOffline: boolean
  operations?: QueuedOp[]
  failedOperations?: QueuedOp[]
  queueMutation?: (entity: EntityKind, type: OpType, targetId: string, payload?: OutboxPayload, isUndo?: boolean) => boolean
}

/** The flat shape callers pass to AppProvider, which splits it into the three above. */
export interface AppContextValue extends AppPrefsValue, AppUiValue, AppSyncValue {}

const defaultPrefs: AppPrefsValue = {
  hideSensitive: false,
  maskPassiveFinancialFigures: false,
  sensitivePreferenceStatus: 'resolved',
  currency: 'USD',
  darkMode: false,
  formatSensitive: value => value.toString(),
}

const defaultUi: AppUiValue = {
  showToast: () => undefined,
  guardSensitive: () => true,
  confirm: () => undefined,
}

const defaultSync: AppSyncValue = {
  activeSyncId: null,
  activeSyncIds: [],
  deletingId: null,
  isSyncing: false,
  isOffline: false,
  operations: [],
  failedOperations: [],
  queueMutation: () => false,
}

export const AppPrefsContext = createContext<AppPrefsValue>(defaultPrefs)
export const AppUiContext = createContext<AppUiValue>(defaultUi)
export const AppSyncContext = createContext<AppSyncValue>(defaultSync)

/** Display preferences only. Does not re-render on outbox activity. */
export function useAppPrefs(): AppPrefsValue {
  return useContext(AppPrefsContext)
}

/** Stable UI callbacks only. Does not re-render on outbox activity. */
export function useAppUi(): AppUiValue {
  return useContext(AppUiContext)
}

/** Sync/connectivity state. Consumers re-render on every outbox tick, by design. */
export function useAppSync(): AppSyncValue {
  return useContext(AppSyncContext)
}

/**
 * Compatibility hook composing all three contexts.
 *
 * Prefer the narrow hooks: a component using this subscribes to sync churn even if it only
 * reads `currency`. This remains for the views that genuinely read from all three
 * (LedgerView, SettingsView, CommitmentsRewardsView, InvestmentsView, RecurringPaymentsView).
 */
export function useAppContext(): AppContextValue {
  const prefs = useContext(AppPrefsContext)
  const ui = useContext(AppUiContext)
  const sync = useContext(AppSyncContext)
  return useMemo(() => ({ ...prefs, ...ui, ...sync }), [prefs, ui, sync])
}
