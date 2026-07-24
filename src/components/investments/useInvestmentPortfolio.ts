import { useCallback, useEffect, useRef, useState } from 'react'
import type { InvestmentPortfolio, InvestmentRange } from '../../types'
import * as api from '../../lib/api'
import { useAppContext } from '../../contexts/AppContext'

export function useInvestmentPortfolio() {
  const { isOffline, showToast } = useAppContext()
  const [range, setRange] = useState<InvestmentRange>('3m')
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(
    () => api.readCachedInvestmentPortfolio(),
  )
  const [loading, setLoading] = useState(!portfolio)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [activityRevision, setActivityRevision] = useState(0)
  const cancelRefreshRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)

  const load = useCallback(async (nextRange: InvestmentRange, quiet = false) => {
    if (!quiet) setLoading(!portfolio)
    setLoadError('')
    try {
      const result = await api.fetchInvestmentPortfolio(nextRange)
      setPortfolio(result)
      setActivityRevision(value => value + 1)
    } catch (error) {
      const cached = api.readCachedInvestmentPortfolio()
      if (cached) {
        setPortfolio(cached)
        setLoadError('Showing the last cached investment snapshot.')
      } else {
        setLoadError(error instanceof Error ? error.message : 'Could not load investments.')
      }
    } finally {
      setLoading(false)
    }
  }, [portfolio])

  useEffect(() => {
    const abort = new AbortController()
    setLoading(!portfolio)
    setLoadError('')
    api.fetchInvestmentPortfolio(range, abort.signal)
      .then(result => {
        setPortfolio(result)
        setActivityRevision(value => value + 1)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const cached = api.readCachedInvestmentPortfolio()
        if (cached) {
          setPortfolio(cached)
          setLoadError('Showing the last cached investment snapshot.')
        } else {
          setLoadError(error instanceof Error ? error.message : 'Could not load investments.')
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [range])

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
