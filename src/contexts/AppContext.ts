import { createContext, useContext, type ReactNode } from 'react'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'

export interface ConfirmRequest {
  title: string
  message: ReactNode
  confirmText?: string
  confirmDisabled?: boolean
  onConfirm: () => void
}

export interface AppContextValue {
  hideSensitive: boolean
  currency: string
  darkMode: boolean
  activeSyncId: string | null
  deletingId: string | null
  isSyncing: boolean
  isOffline: boolean
  formatSensitive: (value: number) => ReactNode
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  guardSensitive: () => boolean
  confirm: (request: ConfirmRequest) => void
}

const defaultValue: AppContextValue = {
  hideSensitive: false,
  currency: 'USD',
  darkMode: false,
  activeSyncId: null,
  deletingId: null,
  isSyncing: false,
  isOffline: false,
  formatSensitive: value => value.toString(),
  showToast: () => undefined,
  guardSensitive: () => true,
  confirm: () => undefined,
}

export const AppContext = createContext<AppContextValue>(defaultValue)

export function useAppContext(): AppContextValue {
  return useContext(AppContext)
}
