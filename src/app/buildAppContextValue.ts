import type { AppContextValue } from '../contexts/AppContext'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'

export function buildAppContextValue(params: {
  hideSensitive: boolean
  currency: string
  darkMode: boolean
  activeSyncId: string | null
  deletingId: string | null
  isSyncing: boolean
  isOffline: boolean
  formatSensitive: (value: number) => any
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  guardSensitive: () => boolean
  confirm: (request: any) => void
}): AppContextValue {
  return {
    hideSensitive: params.hideSensitive,
    currency: params.currency,
    darkMode: params.darkMode,
    activeSyncId: params.activeSyncId,
    deletingId: params.deletingId,
    isSyncing: params.isSyncing,
    isOffline: params.isOffline,
    formatSensitive: params.formatSensitive,
    showToast: params.showToast,
    guardSensitive: params.guardSensitive,
    confirm: params.confirm,
  }
}
