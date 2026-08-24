import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import type { InvestmentAllocationOverview } from '../types'
import * as api from '../lib/api'

let sharedRefresh: Promise<void> | null = null
let lastCompletedRefreshAt = 0
const RESUME_REFRESH_COOLDOWN_MS = 60_000

export function useInvestmentRefreshCoordinator(enabled: boolean, isOffline: boolean) {
  const [allocation, setAllocation] = useState<InvestmentAllocationOverview | null>(() => api.readCachedInvestmentAllocation())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadAndRefresh = useCallback(async (force = false) => {
    if (!enabled || isOffline) return
    if (!force && Date.now() - lastCompletedRefreshAt < RESUME_REFRESH_COOLDOWN_MS) return
    if (sharedRefresh) return sharedRefresh
    sharedRefresh = (async () => {
      const overview = await api.fetchInvestmentAllocation()
      if (mounted.current) setAllocation(overview)
      const allocationNeedsRefresh = overview.freshness.isStale || overview.freshness.hasMissingData
      if (!allocationNeedsRefresh) return

      let complete = false
      let marketDataChanged = false
      while (!complete) {
        const result = await api.refreshInvestmentMarketDataAutomatically()
        marketDataChanged ||= result.updated > 0 || result.total > 0
        complete = result.complete
        if (!complete && result.retryAfterSeconds) {
          await new Promise(resolve => window.setTimeout(resolve, result.retryAfterSeconds! * 1000))
        } else if (!complete) {
          break
        }
      }
      if (!marketDataChanged) return
      const updated = await api.fetchInvestmentAllocation()
      if (mounted.current) setAllocation(updated)
      window.dispatchEvent(new CustomEvent('investment-market-data-refreshed', { detail: updated }))
    })().then(() => {
      lastCompletedRefreshAt = Date.now()
    }).catch(error => {
      // Background refresh is deliberately quiet. The investment page keeps its
      // explicit refresh error UI for user-initiated work.
      console.warn('Background investment refresh was unavailable', error)
    }).finally(() => {
      sharedRefresh = null
    })
    return sharedRefresh
  }, [enabled, isOffline])

  useEffect(() => {
    if (!enabled || isOffline) return
    void loadAndRefresh(true)
  }, [enabled, isOffline, loadAndRefresh])

  useEffect(() => {
    if (!enabled) return
    const resume = () => void loadAndRefresh()
    const investmentSync = () => void loadAndRefresh(true)
    const visible = () => {
      if (document.visibilityState === 'visible') resume()
    }
    window.addEventListener('online', resume)
    window.addEventListener('pageshow', resume)
    window.addEventListener('investment-sync', investmentSync)
    document.addEventListener('visibilitychange', visible)
    let removeNative: (() => void) | undefined
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) resume()
    }).then(handle => {
      removeNative = () => { void handle.remove() }
    })
    return () => {
      window.removeEventListener('online', resume)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('investment-sync', investmentSync)
      document.removeEventListener('visibilitychange', visible)
      removeNative?.()
    }
  }, [enabled, loadAndRefresh])

  return allocation
}
