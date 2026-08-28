import { useCallback, useRef, useState } from 'react'
import type { Loan } from '../../types'
import { CACHE_KEYS, getCachedJSON, hasCachedKey, setCachedJSON } from '../../lib/cache'

export type LoanLoadStatus = 'idle' | 'loading' | 'cached' | 'ready' | 'error'

export function useLoanData() {
  const [hadCachedLoans] = useState(() => hasCachedKey(CACHE_KEYS.loans))
  const [loans, setLoans] = useState<Loan[]>(() => getCachedJSON(CACHE_KEYS.loans, []))
  const [status, setStatus] = useState<LoanLoadStatus>(hadCachedLoans ? 'cached' : 'idle')
  const requestRef = useRef<Promise<Loan[]> | null>(null)

  const setAuthoritativeLoans = useCallback((result: Loan[]) => {
    setLoans(result)
    setCachedJSON(CACHE_KEYS.loans, result)
    setStatus('ready')
  }, [])

  const refresh = useCallback(async () => {
    if (requestRef.current) return requestRef.current
    setStatus(current => loans.length > 0 ? current : 'loading')
    const request = import('../../lib/api/loans')
      .then(module => module.fetchLoans())
      .then(result => {
        setAuthoritativeLoans(result)
        return result
      })
      .catch(cause => {
        setStatus(loans.length > 0 ? 'cached' : 'error')
        throw cause
      })
      .finally(() => {
        requestRef.current = null
      })
    requestRef.current = request
    return request
  }, [loans.length, setAuthoritativeLoans])

  const load = useCallback(async () => {
    if (status === 'ready') return loans
    return refresh()
  }, [loans, refresh, status])

  const reset = useCallback(() => {
    requestRef.current = null
    setLoans([])
    setStatus('idle')
  }, [])

  return {
    loans,
    setLoans,
    setAuthoritativeLoans,
    status,
    hasLoadedFromServer: status === 'ready',
    load,
    refresh,
    reset,
  }
}
