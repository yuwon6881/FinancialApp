import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../lib/api'
import type { DashboardData } from '../types'
import { MONTH_NAMES, getCurrentCycleYearAndMonth } from '../lib/cycle'
import { getErrorName } from '../lib/errors'

// Stable identity for a budget cycle, e.g. { year: 2026, monthIndex: 8 } -> "2026-08".
// This is what the backend persists in FinancialSetting.lastSummaryCycleSeen.
export function cycleKeyOf(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex).padStart(2, '0')}`
}

function prevCycle(year: number, monthIndex: number): { year: number; monthIndex: number } {
  let m = monthIndex - 1
  let y = year
  if (m < 1) {
    m = 12
    y -= 1
  }
  return { year: y, monthIndex: m }
}

export interface CycleSummaryTarget {
  monthIndex: number
  year: number
}

export interface UseCycleSummaryOptions {
  token: string | null
  // Raw (server) dashboard: source of the persisted marker, cycleDay, and selected period.
  dashboardData: DashboardData | null
  // Live optimistic dashboard for the *selected* cycle -- reflects unsynced edits instantly.
  optimisticDashboardData: DashboardData | null
  onMarkSummarySeen: (cycleKey: string) => void
}

export function useCycleSummary(options: UseCycleSummaryOptions) {
  const { token, dashboardData, optimisticDashboardData, onMarkSummarySeen } = options

  const cycleDay = dashboardData?.setting.cycleDay || 28

  const currentCycle = useMemo(() => getCurrentCycleYearAndMonth(cycleDay), [cycleDay])
  const currentKey = cycleKeyOf(currentCycle.year, currentCycle.monthIndex)
  const justClosed = useMemo(
    () => prevCycle(currentCycle.year, currentCycle.monthIndex),
    [currentCycle.year, currentCycle.monthIndex]
  )

  const [autoOpen, setAutoOpen] = useState(false)
  const [manualTarget, setManualTarget] = useState<CycleSummaryTarget | null>(null)
  // Session guard: a cycle whose auto-summary the user already dismissed this session, so a
  // re-render (or the marker's async server round-trip) can never reopen it. The persisted
  // backend marker is the cross-session/device guarantee; this is the in-session one.
  const dismissedKeyRef = useRef<string | null>(null)

  // Once-per-cycle auto trigger. Fires only when the persisted marker lags the current cycle,
  // i.e. a cycle boundary was crossed since the user last acknowledged a summary.
  useEffect(() => {
    if (!token || !dashboardData) return
    const marker = dashboardData.setting.lastSummaryCycleSeen ?? null
    if (marker == null) {
      // First ever run: silently adopt the current cycle -- never show a summary for a cycle
      // the user was never actually present for.
      onMarkSummarySeen(currentKey)
      return
    }
    if (marker !== currentKey && dismissedKeyRef.current !== currentKey) {
      setAutoOpen(true)
    }
  }, [token, dashboardData, currentKey, onMarkSummarySeen])

  const openManual = useCallback((monthIndex: number, year: number) => {
    setManualTarget({ monthIndex, year })
  }, [])

  const closeManual = useCallback(() => setManualTarget(null), [])

  const closeAuto = useCallback(() => {
    dismissedKeyRef.current = currentKey
    onMarkSummarySeen(currentKey)
    setAutoOpen(false)
  }, [currentKey, onMarkSummarySeen])

  // Manual re-open wins over the auto trigger if both would apply.
  const isManual = manualTarget != null
  const target: CycleSummaryTarget | null = manualTarget ?? (autoOpen ? justClosed : null)

  // Is the summary's target the cycle currently loaded into the app? If so we can serve the live
  // optimistic data (updates on every edit); otherwise we fetch that cycle's dashboard fresh.
  const selectedMonthIndex = dashboardData ? MONTH_NAMES.indexOf(dashboardData.setting.selectedMonth) + 1 : 0
  const selectedYear = dashboardData?.setting.selectedYear ?? 0
  const targetIsSelected =
    target != null && target.monthIndex === selectedMonthIndex && target.year === selectedYear

  const [fetched, setFetched] = useState<{ key: string; data: DashboardData } | null>(null)
  const fetchedKey = target ? cycleKeyOf(target.year, target.monthIndex) : null

  // Fetch the target cycle's dashboard when it isn't the selected cycle. Re-runs when the live
  // dashboard changes (a proxy for "a sync happened") so an edit to the target cycle is reflected.
  useEffect(() => {
    if (!token || !target || targetIsSelected) {
      setFetched(null)
      return
    }
    const key = cycleKeyOf(target.year, target.monthIndex)
    const month = MONTH_NAMES[target.monthIndex - 1]
    const ac = new AbortController()
    Promise.all([
      api.fetchDashboard(month, target.year, ac.signal),
      api.fetchDashboardInsights(month, target.year, ac.signal),
    ])
      .then(([core, insights]) => {
        const merged: DashboardData = {
          ...core,
          last3CategoryBreakdown: insights.last3CategoryBreakdown,
          last6CategoryBreakdown: insights.last6CategoryBreakdown,
          yearlyCategoryBreakdown: insights.yearlyCategoryBreakdown,
          availableYears: insights.availableYears,
          stats: {
            ...core.stats,
            pastThreeMonthsRewardsAverage: insights.pastThreeMonthsRewardsAverage,
            hasRewardsHistory: insights.hasRewardsHistory,
          },
        }
        setFetched({ key, data: merged })
      })
      .catch(err => {
        if (getErrorName(err) !== 'AbortError') {
          console.warn('Could not load end-of-cycle summary data', err)
        }
      })
    return () => ac.abort()
    // optimisticDashboardData is intentionally a dep: it changes reference after any sync, which
    // re-pulls the (non-selected) target so its numbers stay current.
  }, [token, target?.monthIndex, target?.year, targetIsSelected, optimisticDashboardData])

  const data: DashboardData | null = targetIsSelected
    ? optimisticDashboardData
    : fetched && fetched.key === fetchedKey
      ? fetched.data
      : null

  return {
    isOpen: target != null,
    variant: (isManual ? 'manual' : 'auto') as 'manual' | 'auto',
    target,
    data,
    cycleDay,
    onClose: isManual ? closeManual : closeAuto,
    openManual,
  }
}
