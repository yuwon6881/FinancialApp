import { useEffect, useRef, useState } from 'react'
import type { DashboardData } from '../types'
import * as api from '../lib/api'
import { getCachedCycleSnapshot } from '../lib/cache'
import { getCurrentCycleYearAndMonth, MONTH_NAMES } from '../lib/cycle'
import { getErrorName } from '../lib/errors'

interface UseCurrentCycleDashboardOptions {
  token: string | null
  optimisticDashboardData: DashboardData | null
  /**
   * True while the outbox holds a write the server has not acknowledged. Only the fetching branch
   * below consults it: that copy of the dashboard carries no optimistic projection, so a request
   * started while a write is still queued is guaranteed to commit pre-write figures and then be
   * corrected once the drain refreshes. Failed ops move to their own list, so a rejected write
   * cannot hold this true forever.
   */
  hasQueuedWrites: boolean
}

export function useCurrentCycleDashboard({
  token,
  optimisticDashboardData,
  hasQueuedWrites,
}: UseCurrentCycleDashboardOptions) {
  const [currentCycleDashboardData, setCurrentCycleDashboardData] = useState<DashboardData | null>(null)
  const currentCycleDashboardRef = useRef<DashboardData | null>(null)
  const [isCurrentCycleLoading, setIsCurrentCycleLoading] = useState(false)
  const hasDashboard = optimisticDashboardData != null
  const currentCycleDay = optimisticDashboardData?.setting.cycleDay || 28
  const currentCyclePeriod = getCurrentCycleYearAndMonth(currentCycleDay)
  const currentCycleMonth = MONTH_NAMES[currentCyclePeriod.monthIndex - 1]
  const currentCycleYear = currentCyclePeriod.year
  const selectedCycleIsCurrent = optimisticDashboardData?.setting.selectedMonth === currentCycleMonth
    && optimisticDashboardData?.setting.selectedYear === currentCycleYear

  const matchesCurrentCycle = (data: DashboardData | null) =>
    data?.setting.selectedMonth === currentCycleMonth && data.setting.selectedYear === currentCycleYear

  // The selected cycle already *is* the current one, so Today reads the shared optimistic value
  // (see todayDashboardData below) and owes no request at all. Mirroring it here only seeds the
  // placeholder the fetching branch shows if the user later moves to another cycle.
  useEffect(() => {
    if (!optimisticDashboardData || !selectedCycleIsCurrent) return
    currentCycleDashboardRef.current = optimisticDashboardData
    setCurrentCycleDashboardData(optimisticDashboardData)
    setIsCurrentCycleLoading(false)
  }, [optimisticDashboardData, selectedCycleIsCurrent])

  // Viewing another cycle: Today cannot use the selected-cycle data, so fetch the current cycle on
  // its own. Keyed on primitives rather than on optimisticDashboardData, which is re-derived on
  // every optimistic projection — depending on the object re-ran this effect for each queued op,
  // each completion, and each completed-op expiry, spending a pair of requests every time and
  // aborting the pair before it.
  useEffect(() => {
    if (!token || !hasDashboard || selectedCycleIsCurrent) return

    if (!matchesCurrentCycle(currentCycleDashboardRef.current)) {
      const cached = getCachedCycleSnapshot(currentCycleMonth, currentCycleYear)?.dashboardData || null
      currentCycleDashboardRef.current = matchesCurrentCycle(cached) ? cached : null
      if (currentCycleDashboardRef.current) {
        setCurrentCycleDashboardData(currentCycleDashboardRef.current)
      }
    }

    // A queued write has not reached the server yet, and the drain refreshes once it lands, so
    // fetching now buys pre-write figures plus a visible jump moments later. Wait for the queue to
    // settle instead — unless there is nothing on screen at all, where stale beats a skeleton.
    const hasSomethingToShow = currentCycleDashboardRef.current !== null
    if (hasQueuedWrites && hasSomethingToShow) {
      setIsCurrentCycleLoading(false)
      return
    }

    setIsCurrentCycleLoading(!hasSomethingToShow)
    const abortController = new AbortController()
    Promise.all([
      api.fetchDashboard(currentCycleMonth, currentCycleYear, abortController.signal, false),
      api.fetchDashboardInsights(currentCycleMonth, currentCycleYear, abortController.signal),
    ]).then(([core, insights]) => {
      const merged: DashboardData = {
        ...core,
        setting: {
          ...core.setting,
          selectedMonth: currentCycleMonth,
          selectedYear: currentCycleYear,
        },
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
      currentCycleDashboardRef.current = merged
      setCurrentCycleDashboardData(merged)
    }).catch(error => {
      if (getErrorName(error) !== 'AbortError') {
        console.warn('Could not load the current-cycle Today view', error)
      }
    }).finally(() => {
      if (!abortController.signal.aborted) setIsCurrentCycleLoading(false)
    })

    return () => abortController.abort()
  }, [token, hasDashboard, selectedCycleIsCurrent, currentCycleMonth, currentCycleYear, hasQueuedWrites])

  const todayDashboardData = selectedCycleIsCurrent
    ? optimisticDashboardData
    : matchesCurrentCycle(currentCycleDashboardData)
      ? currentCycleDashboardData
      : null

  return {
    currentCycleMonth,
    currentCyclePeriod,
    isCurrentCycle: selectedCycleIsCurrent,
    isCurrentCycleLoading,
    todayDashboardData,
  }
}
