import type {
  InvestmentAccount,
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentInstrument,
  InvestmentPortfolio,
  InvestmentAllocationOverview,
  InvestmentAllocationSleeve,
  InvestmentPlan,
  InvestmentRange,
  InvestmentTransactionType,
} from '../../types'
import { CACHE_KEYS, clearCachedInvestmentPages, getCachedJSON, setCachedJSON } from '../cache'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

export interface InstrumentSearchResult {
  selectedInstrumentId?: string
  symbol: string
  name: string
  type: 'Stock' | 'ETF' | 'MutualFund'
  exchange?: string
  mic?: string
  country?: string
  currency: string
  availableOnBasic: boolean
  source: string
}

export interface InvestmentSearchResponse {
  results: InstrumentSearchResult[]
  providerConfigured: boolean
  providerContacted: boolean
  message?: string
}

export interface MarketRefreshResponse {
  jobId?: string
  status: string
  updated: number
  total: number
  retryAfterSeconds?: number
  complete: boolean
  warnings: string[]
  message?: string
}

export interface CurrencyCatalogItem {
  code: string
  symbol: string
  name: string
  label: string
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface InvestmentPageFilters {
  accountId?: string
  instrumentId?: string
  type?: string
  from?: string
  to?: string
  page?: number
  pageSize?: 10 | 25 | 50
}

export interface AccountMutation {
  id?: string
  name: string
  baseCurrency: string
  isArchived?: boolean
}

export interface InstrumentMutation {
  id?: string
  symbol: string
  name: string
  type: 'Stock' | 'ETF' | 'MutualFund'
  currency: string
  exchange?: string
  mic?: string
  country?: string
  providerSymbol?: string
  providerMic?: string
  isCustom: boolean
  isArchived?: boolean
}

export interface InvestmentActivityMutation {
  id?: string
  destinationLegId?: string
  accountId: string
  instrumentId: string
  type: InvestmentTransactionType
  tradeDate: string
  units?: number
  unitPrice?: number
  cashAmount?: number
  fees: number
  taxes: number
  tradeFxRate?: number
  notes?: string
  linkedTransferId?: string
  destinationAccountId?: string
}

function defaultAllocation(portfolio: Pick<InvestmentPortfolio, 'appCurrency' | 'instruments'>): InvestmentAllocationOverview {
  return {
    status: 'NotStarted',
    appCurrency: portfolio.appCurrency,
    plan: {
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
      watchDrift: 3,
      alertDrift: 5,
    },
    assignments: portfolio.instruments.map(value => ({
      instrumentId: value.id,
      symbol: value.symbol,
      name: value.name,
      sleeve: value.allocationSleeve,
    })),
    sleeves: [
      { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, status: 'NotStarted' },
      { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, status: 'NotStarted' },
      { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, status: 'NotStarted' },
    ],
    recommendations: [],
    incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    investedValue: 0,
    availableCash: 0,
    minimumContribution: 0,
  }
}

export function readCachedInvestmentPortfolio(): InvestmentPortfolio | null {
  const cached = getCachedJSON<InvestmentPortfolio | null>(CACHE_KEYS.investmentPortfolio, null)
  if (!cached) return null
  return cached.allocation ? cached : { ...cached, allocation: defaultAllocation(cached) }
}

export async function fetchInvestmentPortfolio(
  range: InvestmentRange,
  signal?: AbortSignal,
): Promise<InvestmentPortfolio> {
  const data = await request<Omit<InvestmentPortfolio, 'activity' | 'cashFlows'>>(`/investments/portfolio?range=${range}`, {
    signal,
    errorMessage: 'Could not load investments',
  })
  const portfolio: InvestmentPortfolio = { ...data, activity: [], cashFlows: [] }
  setCachedJSON(CACHE_KEYS.investmentPortfolio, portfolio)
  return portfolio
}

export function searchInvestmentInstruments(query: string, signal?: AbortSignal): Promise<InvestmentSearchResponse> {
  return request(`/investments/instruments/search?q=${encodeURIComponent(query)}`, {
    signal,
    errorMessage: 'Could not search investments',
  })
}

export function fetchCurrencyCatalog(signal?: AbortSignal): Promise<CurrencyCatalogItem[]> {
  return request('/investments/currencies', { signal, errorMessage: 'Could not load currencies' })
}

const pageQuery = (filters: InvestmentPageFilters) => {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  return query.toString()
}

export function fetchInvestmentActivity(
  filters: InvestmentPageFilters,
  signal?: AbortSignal,
): Promise<PagedResult<InvestmentActivity>> {
  const query = pageQuery(filters)
  const cacheKey = `cached_investment_activity:${query}`
  return cachedGet(cacheKey, async () => {
    try {
      const result = await request<PagedResult<InvestmentActivity>>(`/investments/transactions?${query}`, {
        errorMessage: 'Could not load investment activity',
      })
      setCachedJSON(cacheKey, result)
      return result
    } catch (error) {
      const cached = getCachedJSON<PagedResult<InvestmentActivity> | null>(cacheKey, null)
      if (cached) return cached
      throw error
    }
  }, { signal })
}

export function fetchInvestmentCashFlows(
  filters: Omit<InvestmentPageFilters, 'instrumentId'>,
  signal?: AbortSignal,
): Promise<PagedResult<InvestmentCashFlow>> {
  const query = pageQuery(filters)
  const cacheKey = `cached_investment_cash_flows:${query}`
  return cachedGet(cacheKey, async () => {
    try {
      const result = await request<PagedResult<InvestmentCashFlow>>(`/investments/cash-flows?${query}`, {
        errorMessage: 'Could not load cash flow activity',
      })
      setCachedJSON(cacheKey, result)
      return result
    } catch (error) {
      const cached = getCachedJSON<PagedResult<InvestmentCashFlow> | null>(cacheKey, null)
      if (cached) return cached
      throw error
    }
  }, { signal })
}

function invalidateAfter<T>(work: Promise<T>): Promise<T> {
  return work.then(result => {
    invalidateCache()
    clearCachedInvestmentPages()
    return result
  })
}

export function createInvestmentAccount(value: AccountMutation): Promise<InvestmentAccount> {
  return invalidateAfter(request('/investments/accounts', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not create account',
  }))
}

export function updateInvestmentAccount(id: string, value: AccountMutation): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/accounts/${id}`, {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not update account',
  }))
}

export function deleteInvestmentAccount(id: string): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/accounts/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete account',
  }))
}

export function createInvestmentInstrument(value: InstrumentMutation): Promise<InvestmentInstrument> {
  return invalidateAfter(request('/investments/instruments', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save investment',
  }))
}

export function updateInvestmentInstrument(id: string, value: InstrumentMutation): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/instruments/${id}`, {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not update investment',
  }))
}

export function deleteInvestmentInstrument(id: string): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/instruments/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete investment',
  }))
}

export function createInvestmentActivity(value: InvestmentActivityMutation): Promise<InvestmentActivity> {
  return invalidateAfter(request('/investments/transactions', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save investment activity',
  }))
}

export function updateInvestmentActivity(id: string, value: InvestmentActivityMutation): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/transactions/${id}`, {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not update investment activity',
  }))
}

export interface DeletedTransactionsSnapshot {
  transactions: InvestmentActivity[]
}

export function deleteInvestmentActivity(id: string): Promise<DeletedTransactionsSnapshot> {
  return invalidateAfter(request(`/investments/transactions/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete investment activity',
  }))
}

export function restoreInvestmentActivity(snapshot: DeletedTransactionsSnapshot): Promise<void> {
  return invalidateAfter(requestVoid('/investments/transactions/restore', {
    method: 'POST',
    ...jsonBody(snapshot),
    errorMessage: 'Could not restore investment activity',
  }))
}

export function createManualInvestmentPrice(value: {
  id?: string
  instrumentId: string
  marketDate: string
  price: number
  fxRate?: number
}): Promise<{ id: string }> {
  return invalidateAfter(request('/investments/manual-prices', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save manual price',
  }))
}

export function deleteManualInvestmentPrice(id: string): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/manual-prices/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete manual price',
  }))
}

export function createInvestmentCashFlow(value: {
  id?: string
  accountId: string
  currency: string
  type: 'Deposit' | 'Withdrawal'
  amount: number
  date: string
  notes?: string
}): Promise<{ id: string }> {
  return invalidateAfter(request('/investments/cash-flows', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save cash movement',
  }))
}

export function deleteInvestmentCashFlow(id: string): Promise<InvestmentCashFlow> {
  return invalidateAfter(request(`/investments/cash-flows/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete cash movement',
  }))
}

export function restoreInvestmentCashFlow(snapshot: InvestmentCashFlow): Promise<void> {
  return invalidateAfter(requestVoid('/investments/cash-flows/restore', {
    method: 'POST',
    ...jsonBody(snapshot),
    errorMessage: 'Could not restore cash movement',
  }))
}

export function refreshInvestmentMarketData(): Promise<MarketRefreshResponse> {
  return invalidateAfter(request('/investments/market-data/refresh', {
    method: 'POST',
    errorMessage: 'Could not update prices',
  }))
}

export function fetchInvestmentAllocation(signal?: AbortSignal): Promise<InvestmentAllocationOverview> {
  return request('/investments/allocation', {
    signal,
    errorMessage: 'Could not load the investment plan',
  })
}

export function updateInvestmentPlan(value: Omit<InvestmentPlan, 'id' | 'updatedAt'>): Promise<InvestmentPlan> {
  return invalidateAfter(request('/investments/allocation/plan', {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not save the investment plan',
  }))
}

export function updateInvestmentAllocationSleeve(
  instrumentId: string,
  sleeve?: InvestmentAllocationSleeve,
): Promise<void> {
  return invalidateAfter(requestVoid(`/investments/instruments/${instrumentId}/allocation-sleeve`, {
    method: 'PUT',
    ...jsonBody({ sleeve: sleeve ?? null }),
    errorMessage: 'Could not classify the investment',
  }))
}

export function refreshInvestmentMarketDataAutomatically(): Promise<MarketRefreshResponse> {
  return invalidateAfter(request('/investments/market-data/refresh?automatic=true', {
    method: 'POST',
    errorMessage: 'Could not update market data',
  }))
}
