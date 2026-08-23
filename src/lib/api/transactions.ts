import type { AutocompleteSuggestion, Transaction } from '../../types'
import type { TransactionSort } from '../transactionOrdering'
import type { TransactionLinkFilter, TransactionSearchMode } from '../transactionFilters'
import type { WirePagedTransactionResult, WireTransaction } from '../apiTypes'
import { deobfuscateTransaction, obfuscateAmount } from './amounts'
import { API_BASE_URL, apiFetch, cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CLOSED_CYCLE_STALE_TIME = 24 * 60 * 60 * 1000

function isClosedCycle(month?: string, year?: number): boolean {
  if (!month || !year) return false
  const monthIndex = MONTH_ABBREVIATIONS.indexOf(month)
  if (monthIndex === -1) return false
  const now = new Date()
  return year < now.getFullYear() || (year === now.getFullYear() && monthIndex < now.getMonth())
}

export async function fetchAutocompleteSuggestions(signal?: AbortSignal): Promise<AutocompleteSuggestion[]> {
  return request<AutocompleteSuggestion[]>('/transactions/autocomplete', {
    signal,
    errorMessage: 'Failed to fetch autocomplete suggestions',
  })
}

export function fetchTransactions(month?: string, year?: number, all?: boolean, signal?: AbortSignal): Promise<Transaction[]> {
  const cacheKey = all ? 'transactions:all' : `transactions:${month || ''}:${year || ''}`
  const params = new URLSearchParams()
  if (all) params.append('all', 'true')
  else {
    if (month) params.append('month', month)
    if (year) params.append('year', year.toString())
  }
  const query = params.size ? `?${params}` : ''

  return cachedGet(cacheKey, async () => {
    // No signal here: the fetch is shared between callers via the cache (see cachedGet).
    const data = await request<WireTransaction[] | null>(`/transactions${query}`, {
      errorMessage: 'Failed to fetch transactions',
    })
    return (data || []).map(deobfuscateTransaction)
  }, {
    signal,
    staleTime: isClosedCycle(month, year) ? CLOSED_CYCLE_STALE_TIME : undefined,
  })
}

export async function fetchTransactionById(id: string, signal?: AbortSignal): Promise<Transaction> {
  const data = await request<WireTransaction>(`/transactions/${encodeURIComponent(id)}`, {
    signal,
    errorMessage: 'Failed to fetch transaction',
  })
  return deobfuscateTransaction(data)
}

export interface TransactionQuery {
  search?: string
  searchMode?: TransactionSearchMode
  ledgerCategories?: string[]
  categories?: string[]
  txType?: 'inflow' | 'outflow' | 'transfer' | null
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  recurringFilter?: TransactionLinkFilter
  wishlistFilter?: TransactionLinkFilter
  sort?: TransactionSort
}

function appendTransactionQuery(params: URLSearchParams, query: TransactionQuery): void {
  const search = query.search?.trim()
  if (search) params.append('search', search)
  if (search && query.searchMode === 'whole-word') params.append('searchMode', 'whole-word')
  if (query.ledgerCategories?.length) params.append('ledgerCategory', query.ledgerCategories.join(','))
  if (query.categories?.length) params.append('category', query.categories.join(','))
  if (query.txType) params.append('txType', query.txType)
  if (query.startDate) params.append('startDate', query.startDate)
  if (query.endDate) params.append('endDate', query.endDate)
  if (query.minAmount !== undefined) params.append('minAmount', query.minAmount.toString())
  if (query.maxAmount !== undefined) params.append('maxAmount', query.maxAmount.toString())
  if (query.recurringFilter && query.recurringFilter !== 'all') {
    params.append('recurringFilter', query.recurringFilter)
  }
  if (query.wishlistFilter && query.wishlistFilter !== 'all') {
    params.append('wishlistFilter', query.wishlistFilter)
  }
  if (query.sort) params.append('sort', query.sort)
}

export async function exportTransactionsCsv(params: TransactionQuery): Promise<{ blob: Blob; filename: string }> {
  const url = new URL(`${API_BASE_URL}/transactions/export`)
  url.searchParams.append('all', 'true')
  appendTransactionQuery(url.searchParams, params)
  const response = await apiFetch(url.toString())
  if (!response.ok) throw new Error('Failed to export transactions')
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  const fallback = `financial_ledger_${new Date().toLocaleDateString('en-CA')}.csv`
  return { blob, filename: match?.[1] || fallback }
}

export interface PagedTransactionResult {
  items: Transaction[]
  total: number
  page: number
  pageSize: number
}

export async function fetchPagedTransactions(params: TransactionQuery & { page: number; pageSize: number; signal?: AbortSignal }): Promise<PagedTransactionResult> {
  const query = new URLSearchParams({
    all: 'true',
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  })
  appendTransactionQuery(query, params)
  const data = await request<WirePagedTransactionResult>(`/transactions?${query}`, {
    signal: params.signal,
    errorMessage: 'Failed to fetch paged transactions',
  })
  return {
    items: (data.items || []).map(deobfuscateTransaction),
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? params.pageSize,
  }
}

export async function addTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
  const data = await request<WireTransaction>('/transactions', {
    method: 'POST',
    ...jsonBody({
      ...transaction,
      amount: obfuscateAmount(transaction.amount),
      stabilityRecoveryTopUpAmount: transaction.stabilityRecoveryTopUpAmount == null
        ? transaction.stabilityRecoveryTopUpAmount
        : obfuscateAmount(transaction.stabilityRecoveryTopUpAmount),
    }),
    errorMessage: 'Failed to add transaction',
  })
  invalidateCache()
  return deobfuscateTransaction(data)
}

export async function deleteTransaction(id: string): Promise<void> {
  await requestVoid(`/transactions/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete transaction',
  })
  invalidateCache()
}

export async function updateTransaction(id: string, transaction: Omit<Transaction, 'id'>): Promise<void> {
  await requestVoid(`/transactions/${id}`, {
    method: 'PUT',
    ...jsonBody({
      ...transaction,
      amount: obfuscateAmount(transaction.amount),
      stabilityRecoveryTopUpAmount: transaction.stabilityRecoveryTopUpAmount == null
        ? transaction.stabilityRecoveryTopUpAmount
        : obfuscateAmount(transaction.stabilityRecoveryTopUpAmount),
    }),
    errorMessage: 'Failed to update transaction',
  })
  invalidateCache()
}
