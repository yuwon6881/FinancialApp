import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import type { InvestmentAllocationOverview } from '../types'
import * as api from '../lib/api'

let sharedRefresh: Promise<void> | null = null

export function useInvestmentRefreshCoordinator(enabled: boolean, isOffline: boolean) {
  const [allocation, setAllocation] = useState<InvestmentAllocationOverview | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadAndRefresh = useCallback(async () => {
    if (!enabled || isOffline) return
    if (sharedRefresh) return sharedRefresh
    sharedRefresh = (async () => {
      const overview = await api.fetchInvestmentAllocation()
      if (mounted.current) setAllocation(overview)
      const allocationNeedsRefresh = overview.freshness.isStale || overview.freshness.hasMissingData

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
      if (!allocationNeedsRefresh && !marketDataChanged) return
      const updated = await api.fetchInvestmentAllocation()
      if (mounted.current) setAllocation(updated)
      window.dispatchEvent(new CustomEvent('investment-market-data-refreshed', { detail: updated }))
    })().catch(error => {
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
    void loadAndRefresh()
  }, [enabled, isOffline, loadAndRefresh])

  useEffect(() => {
    if (!enabled) return
    const resume = () => void loadAndRefresh()
    const visible = () => {
      if (document.visibilityState === 'visible') resume()
    }
    window.addEventListener('online', resume)
    window.addEventListener('pageshow', resume)
    window.addEventListener('investment-sync', resume)
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
      window.removeEventListener('investment-sync', resume)
      document.removeEventListener('visibilitychange', visible)
      removeNative?.()
    }
  }, [enabled, loadAndRefresh])

  return allocation
}
