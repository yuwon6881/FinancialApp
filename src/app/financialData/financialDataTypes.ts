import type { QueuedOp } from '../../lib/outbox'
import type { FinancialSetting } from '../../types'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'
import type { ConfirmModalData } from '../useAppDialogs'

export function queuedTransactionDeleteCoversTarget(
  pending: Pick<QueuedOp, 'entity' | 'type' | 'targetId' | 'payload'>,
  targetId: string,
): boolean {
  if (pending.entity !== 'transaction') return false
  if (pending.type === 'delete') return pending.targetId === targetId
  if (pending.type !== 'bulkDelete') return false
  const transactionIds = pending.payload?.transactionIds
  return Array.isArray(transactionIds) && transactionIds.some(id => String(id) === targetId)
}

export const createLocalId = (prefix: string, separator = '_') => {
  return `${prefix}${separator}${Date.now()}${separator}${Math.random().toString(36).substring(2, 9)}`
}

export const PERSISTED_SETTING_KEYS = [
  'targetStabilityFund',
  'selectedMonth',
  'selectedYear',
  'essentialsAlloc',
  'growthAlloc',
  'stabilityAlloc',
  'rewardsAlloc',
  'cycleDay',
  'darkMode',
  'hideSensitive',
  'stabilityOverflowRedirect',
  'currency',
  'lastSummaryCycleSeen',
] as const satisfies ReadonlyArray<keyof FinancialSetting>

export interface UseFinancialDataOptions {
  token: string | null
  username: string
  usernameRef: React.MutableRefObject<string>
  lastUnlockedTimeRef: React.MutableRefObject<number>
  isLocked: boolean
  markSessionLocked: () => void
  handleLogout: () => Promise<void>
  hideSensitive: boolean
  darkMode: boolean
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  guardSensitive: () => boolean
  setConfirmModalData: React.Dispatch<React.SetStateAction<ConfirmModalData | null>>
  onRequestSensitiveReveal?: () => void
  resolveHideSensitive: (value: boolean) => void
  markSensitivePreferenceUnavailable: () => void
  setDarkMode: (value: boolean) => void
  notifyOnLogin: boolean
  loadAllAbortRef: React.MutableRefObject<AbortController | null>
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  selectedYear: number
  setSelectedYear: (year: number) => void
  setIsSwitchingCycle: (switching: boolean) => void
  setHasShownModalThisSession: (value: boolean) => void
  hasShownModalThisSession: boolean
  setShowLoginModal: (value: boolean) => void
  setShowFailedOpsModal: (value: boolean) => void
}
