import type { AppContextValue } from '../contexts/AppContext'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import type { EntityKind, OpType, OutboxPayload, QueuedOp } from '../lib/outbox'
import type { SensitivePreferenceStatus } from './useAppPreferences'

export function buildAppContextValue(params: {
  hideSensitive: boolean
  maskPassiveFinancialFigures: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  currency: string
  darkMode: boolean
  activeSyncId: string | null
  activeSyncIds?: string[]
  deletingId: string | null
  isSyncing: boolean
  isOffline: boolean
  formatSensitive: (value: number) => any
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  guardSensitive: () => boolean
  confirm: (request: any) => void
  operations: QueuedOp[]
  failedOperations: QueuedOp[]
  queueMutation: (entity: EntityKind, type: OpType, targetId: string, payload?: OutboxPayload, isUndo?: boolean) => boolean
}): AppContextValue {
  return {
    hideSensitive: params.hideSensitive,
    maskPassiveFinancialFigures: params.maskPassiveFinancialFigures,
    sensitivePreferenceStatus: params.sensitivePreferenceStatus,
    currency: params.currency,
    darkMode: params.darkMode,
    activeSyncId: params.activeSyncId,
    activeSyncIds: params.activeSyncIds,
    deletingId: params.deletingId,
    isSyncing: params.isSyncing,
    isOffline: params.isOffline,
    formatSensitive: params.formatSensitive,
    showToast: params.showToast,
    guardSensitive: params.guardSensitive,
    confirm: params.confirm,
    operations: params.operations,
    failedOperations: params.failedOperations,
    queueMutation: params.queueMutation,
  }
}
