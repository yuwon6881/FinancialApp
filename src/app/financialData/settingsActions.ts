import type { DashboardData } from '../../types'
import { CACHE_KEYS, setCachedJSON } from '../../lib/cache'
import { enqueue } from '../../lib/outbox'
import type { UseOutboxResult } from '../../lib/useOutbox'

interface SettingsActionDependencies {
  darkMode: boolean
  hideSensitive: boolean
  dashboardData: DashboardData | null
  guardSensitive: () => boolean
  mutateQueue: UseOutboxResult['mutateQueue']
  unconfirmedSettingWritesRef: React.MutableRefObject<Map<string, unknown>>
  setDashboardData: React.Dispatch<React.SetStateAction<DashboardData | null>>
}

/**
 * Settings writes. Each one records the key in `unconfirmedSettingWritesRef` before queueing, so a
 * dashboard response that started earlier cannot restore the value the user just replaced.
 */
export function createSettingsActions(deps: SettingsActionDependencies) {
  const {
    darkMode,
    hideSensitive,
    dashboardData,
    guardSensitive,
    mutateQueue,
    unconfirmedSettingWritesRef,
    setDashboardData,
  } = deps

  const handleUpdateSettings = (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    currency?: string
    stabilityOverflowRedirect?: string
    darkMode?: boolean
    hideSensitive?: boolean
  }) => {
    if (!guardSensitive()) return
    const payload = {
      ...settings,
      darkMode: settings.darkMode ?? darkMode,
      hideSensitive: settings.hideSensitive ?? hideSensitive,
    }
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) unconfirmedSettingWritesRef.current.set(key, value)
    }
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'settings', {
      ...payload,
      undoSnapshot: dashboardData?.setting,
    }))
  }

  const handleUpdateDarkModePreference = (value: boolean) => {
    unconfirmedSettingWritesRef.current.set('darkMode', value)
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'darkMode', {
      darkMode: value,
      undoSnapshot: { darkMode },
    }))
  }

  const handleUpdateHideSensitivePreference = (value: boolean) => {
    const previousValue = dashboardData?.setting.hideSensitive ?? !value
    unconfirmedSettingWritesRef.current.set('hideSensitive', value)
    setDashboardData(previous => {
      if (!previous) return previous
      const next = {
        ...previous,
        setting: {
          ...previous.setting,
          hideSensitive: value,
        },
      }
      setCachedJSON(CACHE_KEYS.dashboardData, next)
      return next
    })
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'hideSensitive', {
      hideSensitive: value,
      undoSnapshot: { hideSensitive: previousValue },
    }))
  }

  // Acknowledge (or silently adopt) the end-of-cycle summary for a given cycle key. Patches the
  // marker into local dashboard state + cache immediately so the once-per-cycle trigger won't
  // re-fire before the server write round-trips, then queues the durable server update.
  const handleMarkSummarySeen = (cycleKey: string) => {
    unconfirmedSettingWritesRef.current.set('lastSummaryCycleSeen', cycleKey)
    const patchSetting = (data: DashboardData | null) =>
      data
        ? {
            ...data,
            setting: {
              ...data.setting,
              ...Object.fromEntries(unconfirmedSettingWritesRef.current),
              lastSummaryCycleSeen: cycleKey,
            },
          }
        : data
    setDashboardData(prev => {
      const next = patchSetting(prev)
      if (next) setCachedJSON(CACHE_KEYS.dashboardData, next)
      return next
    })
    mutateQueue(prev => enqueue(prev, 'settings', 'update', 'summarySeen', { cycleKey }))
  }

  return {
    handleUpdateSettings,
    handleUpdateDarkModePreference,
    handleUpdateHideSensitivePreference,
    handleMarkSummarySeen,
  }
}
