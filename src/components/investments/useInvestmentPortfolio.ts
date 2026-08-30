import { useCallback, useEffect, useRef, useState } from 'react'
import type { InvestmentAllocationOverview, InvestmentPortfolio, InvestmentRange } from '../../types'
import * as api from '../../lib/api'
import { useAppSync, useAppUi } from '../../contexts/AppContext'

export function useInvestmentPortfolio() {
  const { isOffline } = useAppSync()
  const { showToast } = useAppUi()
  const [range, setRange] = useState<InvestmentRange>('3m')
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(
    () => api.readCachedInvestmentPortfolio(),
  )
  const [loading, setLoading] = useState(!portfolio)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [isSyncRefreshing, setIsSyncRefreshing] = useState(false)
  const [activityRevision, setActivityRevision] = useState(0)
  const cancelRefreshRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)
  const requestRevisionRef = useRef(0)

  const load = useCallback(async (
    nextRange: InvestmentRange,
    quiet = false,
    rethrow = false,
    signal?: AbortSignal,
  ) => {
    const requestRevision = ++requestRevisionRef.current
    if (!quiet) setLoading(true)
    else setIsSyncRefreshing(true)
    setLoadError('')
    try {
      const result = await api.fetchInvestmentPortfolio(nextRange, signal)
      if (requestRevision !== requestRevisionRef.current) return
      setPortfolio(result)
      setActivityRevision(value => value + 1)
    } catch (error) {
      if (requestRevision !== requestRevisionRef.current) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      const cached = api.readCachedInvestmentPortfolio()
      if (cached) {
        setPortfolio(cached)
        setLoadError('Showing the last cached investment snapshot.')
      } else {
        setLoadError(error instanceof Error ? error.message : 'Could not load investments.')
      }
      if (rethrow) throw error
    } finally {
      if (requestRevision === requestRevisionRef.current) {
        setLoading(false)
        setIsSyncRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    void load(range, false, false, abort.signal)
    return () => {
      abort.abort()
      requestRevisionRef.current += 1
    }
  }, [load, range])

  useEffect(() => {
    const refreshAfterSync = (event: Event) => {
      const detail = (event as CustomEvent<{
        allocation?: InvestmentAllocationOverview
        acknowledge?: (work: Promise<void>) => void
      }>).detail
      if (event.type === 'investment-sync' && detail?.allocation) {
        setPortfolio(current => current ? { ...current, allocation: detail.allocation! } : current)
      }
      const work = load(range, true, Boolean(detail?.acknowledge))
      if (detail?.acknowledge) detail.acknowledge(work)
      else void work
    }
    window.addEventListener('investment-sync', refreshAfterSync)
    window.addEventListener('investment-market-data-refreshed', refreshAfterSync)
    return () => {
      window.removeEventListener('investment-sync', refreshAfterSync)
      window.removeEventListener('investment-market-data-refreshed', refreshAfterSync)
    }
  }, [load, range])

  useEffect(() => () => {
    cancelRefreshRef.current = true
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
  }, [])

  const updatePrices = useCallback(async () => {
    if (isOffline || refreshing) return
    cancelRefreshRef.current = false
    setRefreshing(true)
    try {
      let complete = false
      while (!complete && !cancelRefreshRef.current) {
        const result = await api.refreshInvestmentMarketData()
        if (result.total > 0) {
          showToast(`${result.updated} of ${result.total} updated.`, 'Updating prices')
        } else if (result.message) {
          showToast(result.message, 'Market data')
        }
        complete = result.complete
        if (!complete && result.retryAfterSeconds) {
          await new Promise<void>(resolve => {
            refreshTimerRef.current = window.setTimeout(resolve, result.retryAfterSeconds! * 1000)
          })
        }
        if (result.warnings.length) {
          showToast(result.warnings[0], 'Prices may be stale', 'warning')
        }
      }
      if (!cancelRefreshRef.current) await load(range, true)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Prices could not be updated.',
        'Market data',
        'warning',
      )
    } finally {
      setRefreshing(false)
    }
  }, [isOffline, load, range, refreshing, showToast])

  return {
    activityRevision,
    isBackgroundRefreshing: refreshing || isSyncRefreshing || (loading && portfolio !== null),
    load,
    loadError,
    loading,
    portfolio,
    range,
    refreshing,
    setRange,
    updatePrices,
  }
}
