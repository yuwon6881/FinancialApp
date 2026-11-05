import { useEffect, useState } from 'react'
import type { InvestmentPortfolio } from '../../../../types'
import * as api from '../../../../lib/api'
import { useAppSync } from '../../../../contexts/AppContext'
import { investmentMarketValue } from '../../../../lib/investmentMarketValue'

/**
 * Today's investment worth for the Accounts total: the cached portfolio at once, then one quiet
 * refresh. The same range the Investments page opens with, so the shared cache stays coherent.
 * A failed refresh keeps the cached figure; nothing here is ever written to the ledger.
 */
export function useInvestmentMarketValue(ledgerCurrency: string, enabled: boolean) {
  const { isOffline } = useAppSync()
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(() => api.readCachedInvestmentPortfolio())
  useEffect(() => {
    if (!enabled || isOffline) return
    const abort = new AbortController()
    api.fetchInvestmentPortfolio('3m', abort.signal).then(setPortfolio, () => undefined)
    return () => abort.abort()
  }, [enabled, isOffline])
  return enabled ? investmentMarketValue(portfolio, ledgerCurrency) : null
}
