import { useEffect, useState } from 'react'
import type { InvestmentHistory } from '../../types'
import * as api from '../../lib/api'

/**
 * Loads the settled month-end history. `refreshToken` changes whenever the portfolio reloads
 * (an edit, a sync, a price update), so the history follows the same data without its own timer.
 */
export function useInvestmentHistory(refreshToken: number) {
  const [history, setHistory] = useState<InvestmentHistory | null>(() => api.readCachedInvestmentHistory())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!history)

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    api.fetchInvestmentHistory(abort.signal)
      .then(result => {
        setHistory(result)
        setError('')
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Could not load investment history.')
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [refreshToken])

  return { history, error, loading }
}
