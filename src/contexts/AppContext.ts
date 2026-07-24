import { createContext, useContext, type ReactNode } from 'react'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import type { EntityKind, OpType, OutboxPayload, QueuedOp } from '../lib/outbox'

interface ConfirmRequest {
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
  investmentOps?: QueuedOp[]
  queueInvestmentMutation?: (entity: EntityKind, type: OpType, targetId: string, payload?: OutboxPayload, isUndo?: boolean) => void
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
  investmentOps: [],
  queueInvestmentMutation: () => undefined,
}

export const AppContext = createContext<AppContextValue>(defaultValue)

export function useAppContext(): AppContextValue {
  return useContext(AppContext)
}
