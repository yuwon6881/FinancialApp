import { useEffect, useRef, useState } from 'react'
import type { DashboardData } from '../types'
import * as api from '../lib/api'
import { getCachedCycleSnapshot } from '../lib/cache'
import { getCurrentCycleYearAndMonth, MONTH_NAMES } from '../lib/cycle'
import { getErrorName } from '../lib/errors'

interface UseCurrentCycleDashboardOptions {
  token: string | null
  optimisticDashboardData: DashboardData | null
}

export function useCurrentCycleDashboard({
  token,
  optimisticDashboardData,
}: UseCurrentCycleDashboardOptions) {
  const [currentCycleDashboardData, setCurrentCycleDashboardData] = useState<DashboardData | null>(null)
  const currentCycleDashboardRef = useRef<DashboardData | null>(null)
  const [isCurrentCycleLoading, setIsCurrentCycleLoading] = useState(false)
  const currentCycleDay = optimisticDashboardData?.setting.cycleDay || 28
  const currentCyclePeriod = getCurrentCycleYearAndMonth(currentCycleDay)
  const currentCycleMonth = MONTH_NAMES[currentCyclePeriod.monthIndex - 1]
  const selectedCycleIsCurrent = optimisticDashboardData?.setting.selectedMonth === currentCycleMonth
    && optimisticDashboardData?.setting.selectedYear === currentCyclePeriod.year

  useEffect(() => {
    if (!token || !optimisticDashboardData) return

    const currentData = optimisticDashboardData
    const cycleDay = currentData.setting.cycleDay || 28
    const { year, monthIndex } = getCurrentCycleYearAndMonth(cycleDay)
    const month = MONTH_NAMES[monthIndex - 1]
    const matchesCurrentPeriod = (data: DashboardData | null) =>
      data?.setting.selectedMonth === month && data.setting.selectedYear === year

    if (matchesCurrentPeriod(currentData)) {
      currentCycleDashboardRef.current = currentData
      setCurrentCycleDashboardData(currentData)
      setIsCurrentCycleLoading(false)
      return
    }

    if (!matchesCurrentPeriod(currentCycleDashboardRef.current)) {
      const cached = getCachedCycleSnapshot(month, year)?.dashboardData || null
      currentCycleDashboardRef.current = matchesCurrentPeriod(cached) ? cached : null
      if (currentCycleDashboardRef.current) {
        setCurrentCycleDashboardData(currentCycleDashboardRef.current)
      }
    }

    setIsCurrentCycleLoading(!currentCycleDashboardRef.current)
    const abortController = new AbortController()
    Promise.all([
      api.fetchDashboard(month, year, abortController.signal, false),
      api.fetchDashboardInsights(month, year, abortController.signal),
    ]).then(([core, insights]) => {
      const merged: DashboardData = {
        ...core,
        setting: {
          ...core.setting,
          selectedMonth: month,
          selectedYear: year,
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
  }, [token, optimisticDashboardData])

  const todayDashboardData = selectedCycleIsCurrent
    ? optimisticDashboardData
    : currentCycleDashboardData?.setting.selectedMonth === currentCycleMonth
        && currentCycleDashboardData.setting.selectedYear === currentCyclePeriod.year
      ? currentCycleDashboardData
      : null

  return {
    currentCycleMonth,
    currentCyclePeriod,
    isCurrentCycleLoading,
    todayDashboardData,
  }
}
