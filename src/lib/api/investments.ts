import type {
  InvestmentAccount,
  InvestmentActivity,
  InvestmentInstrument,
  InvestmentPortfolio,
  InvestmentRange,
  InvestmentTransactionType,
} from '../../types'
import { CACHE_KEYS, getCachedJSON, setCachedJSON } from '../cache'
import { jsonBody, request, requestVoid } from './client'

export interface InstrumentSearchResult {
  selectedInstrumentId?: string
  symbol: string
  name: string
  type: 'Stock' | 'ETF'
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

export interface AccountMutation {
  name: string
  baseCurrency: string
  isArchived?: boolean
}

export interface InstrumentMutation {
  symbol: string
  name: string
  type: 'Stock' | 'ETF'
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

export function readCachedInvestmentPortfolio(): InvestmentPortfolio | null {
  return getCachedJSON<InvestmentPortfolio | null>(CACHE_KEYS.investmentPortfolio, null)
}

export async function fetchInvestmentPortfolio(
  range: InvestmentRange,
  signal?: AbortSignal,
): Promise<InvestmentPortfolio> {
  const data = await request<InvestmentPortfolio>(`/investments/portfolio?range=${range}`, {
    signal,
    errorMessage: 'Could not load investments',
  })
  setCachedJSON(CACHE_KEYS.investmentPortfolio, data)
  return data
}

export function searchInvestmentInstruments(query: string, signal?: AbortSignal): Promise<InvestmentSearchResponse> {
  return request(`/investments/instruments/search?q=${encodeURIComponent(query)}`, {
    signal,
    errorMessage: 'Could not search investments',
  })
}

export function createInvestmentAccount(value: AccountMutation): Promise<InvestmentAccount> {
  return request('/investments/accounts', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not create account',
  })
}

export function updateInvestmentAccount(id: string, value: AccountMutation): Promise<void> {
  return requestVoid(`/investments/accounts/${id}`, {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not update account',
  })
}

export function archiveInvestmentAccount(id: string): Promise<void> {
  return requestVoid(`/investments/accounts/${id}/archive`, {
    method: 'POST',
    errorMessage: 'Could not archive account',
  })
}

export function unarchiveInvestmentAccount(id: string, name: string, baseCurrency: string): Promise<void> {
  return requestVoid(`/investments/accounts/${id}`, {
    method: 'PUT',
    ...jsonBody({ name, baseCurrency, isArchived: false }),
    errorMessage: 'Could not unarchive account',
  })
}

export function deleteInvestmentAccount(id: string): Promise<void> {
  return requestVoid(`/investments/accounts/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete account',
  })
}

export function createInvestmentInstrument(value: InstrumentMutation): Promise<InvestmentInstrument> {
  return request('/investments/instruments', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save investment',
  })
}

export function updateInvestmentInstrument(id: string, value: InstrumentMutation): Promise<void> {
  return requestVoid(`/investments/instruments/${id}`, {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not update investment',
  })
}

export function deleteInvestmentInstrument(id: string): Promise<void> {
  return requestVoid(`/investments/instruments/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete investment',
  })
}

export function createInvestmentActivity(value: InvestmentActivityMutation): Promise<InvestmentActivity> {
  return request('/investments/transactions', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save investment activity',
  })
}

export function updateInvestmentActivity(id: string, value: InvestmentActivityMutation): Promise<void> {
  return requestVoid(`/investments/transactions/${id}`, {
    method: 'PUT',
    ...jsonBody(value),
    errorMessage: 'Could not update investment activity',
  })
}

export function deleteInvestmentActivity(id: string): Promise<void> {
  return requestVoid(`/investments/transactions/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete investment activity',
  })
}

export function createManualInvestmentPrice(value: {
  instrumentId: string
  marketDate: string
  price: number
  fxRate?: number
}): Promise<{ id: string }> {
  return request('/investments/manual-prices', {
    method: 'POST',
    ...jsonBody(value),
    errorMessage: 'Could not save manual price',
  })
}

export function deleteManualInvestmentPrice(id: string): Promise<void> {
  return requestVoid(`/investments/manual-prices/${id}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete manual price',
  })
}

export function refreshInvestmentMarketData(): Promise<MarketRefreshResponse> {
  return request('/investments/market-data/refresh', {
    method: 'POST',
    errorMessage: 'Could not update prices',
  })
}
