import type { Transaction, RecurringPayment, DashboardData, TransactionCategory, WishlistItem } from '../types'
import type { CreateOptionsJson, AssertionOptionsJson } from './webauthn'

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  if (import.meta.env.DEV) {
    const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost'
    return `http://${host}:5000/api`
  }
  return '/api'
}

const API_BASE_URL = getApiBaseUrl()
export const SESSION_LOCKED_EVENT = 'financialapp:session-locked'

interface CacheEntry {
  promise: Promise<any>
  timestamp: number
  staleTime: number
}

const queryCache = {
  store: new Map<string, CacheEntry>(),

  get<T>(key: string): Promise<T> | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.staleTime) {
      this.store.delete(key)
      return null
    }
    return entry.promise as Promise<T>
  },

  set(key: string, promise: Promise<any>, staleTime = 30000) {
    this.store.set(key, { promise, timestamp: Date.now(), staleTime })
    promise.catch(() => {
      this.store.delete(key)
    })
  },

  invalidateAll() {
    this.store.clear()
  }
}

const originalFetch = window.fetch
window.fetch = async (...args) => {
  const response = await originalFetch(...args)
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as any).url || ''
  if (!response.ok) {
    if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/status') && !url.includes('/auth/webauthn')) {
      throw new Error('401 Unauthorized')
    }
    if (response.status === 423 && !url.includes('/auth/login') && !url.includes('/auth/status') && !url.includes('/auth/webauthn')) {
      window.dispatchEvent(new CustomEvent(SESSION_LOCKED_EVENT, { detail: { url } }))
      throw new Error('423 Locked')
    }
  }
  return response
}

const getHeaders = (additionalHeaders: Record<string, string> = {}) => {
  const token = localStorage.getItem('auth_token')
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...additionalHeaders
  }
}

export function getDeviceInfo(): { deviceId: string; deviceName: string } {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('deviceId', deviceId)
  }

  const ua = navigator.userAgent
  let browser = "Unknown Browser"
  let os = "Unknown OS"

  if (ua.includes("Firefox/")) browser = "Firefox"
  else if (ua.includes("Edg/")) browser = "Edge"
  else if (ua.includes("Chrome/")) browser = "Chrome"
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari"

  if (ua.includes("Windows NT")) os = "Windows"
  else if (ua.includes("Mac OS X")) os = "macOS"
  else if (ua.includes("Android")) os = "Android"
  else if (ua.includes("iPhone")) os = "iOS"
  else if (ua.includes("Linux")) os = "Linux"

  return { deviceId, deviceName: `${browser} on ${os}` }
}

const OBFUSCATION_KEY = "FinancialAppObfuscationKey";

export function deobfuscateAmount(obfuscated: string | number | undefined | null): number {
  if (obfuscated === undefined || obfuscated === null) return 0;
  if (typeof obfuscated === 'number') return obfuscated;
  try {
    const binaryString = atob(obfuscated);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
    }
    const decoded = new TextDecoder().decode(bytes);
    return parseFloat(decoded);
  } catch (e) {
    console.error("Failed to deobfuscate value:", obfuscated, e);
    return 0;
  }
}

export function obfuscateAmount(val: number | string): string {
  const input = typeof val === 'number' ? val.toFixed(2) : parseFloat(val).toFixed(2);
  const bytes = new TextEncoder().encode(input);
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    const xored = bytes[i] ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
    binaryString += String.fromCharCode(xored);
  }
  return btoa(binaryString);
}

function deobfuscateTransaction(t: any): Transaction {
  return {
    ...t,
    amount: deobfuscateAmount(t.amount)
  }
}

function deobfuscateRecurringPayment(rp: any): RecurringPayment {
  return {
    ...rp,
    amount: deobfuscateAmount(rp.amount)
  }
}

// Authentication
export async function fetchAuthStatus(): Promise<{ isRegistered: boolean; hasFingerprint: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/status`)
  if (!response.ok) {
    throw new Error('Failed to fetch auth status')
  }
  return response.json()
}

export type LoginResult =
  | { token: string; username: string }
  | { requiresTwoFactor: true; pendingToken: string }

export async function login(credentials: any): Promise<LoginResult> {
  const payload = { ...credentials, ...getDeviceInfo() }
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Invalid credentials')
  }
  const data = await response.json()
  if (data.requiresTwoFactor) {
    return data
  }
  localStorage.setItem('auth_token', data.token)
  queryCache.invalidateAll()
  return data
}

export async function verifyTwoFactorLogin(pendingToken: string, code: string): Promise<{ token: string; username: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingToken, code }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Invalid code')
  }
  const data = await response.json()
  localStorage.setItem('auth_token', data.token)
  queryCache.invalidateAll()
  return data
}

export async function register(credentials: any): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Registration failed')
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
    })
  } catch (e) {
    console.error('Logout request failed', e)
  } finally {
    localStorage.removeItem('auth_token')
    queryCache.invalidateAll()
  }
}

export function invalidateCache(): void {
  queryCache.invalidateAll()
}

// Dashboard
export function fetchDashboard(month?: string, year?: number, signal?: AbortSignal): Promise<DashboardData> {
  const cacheKey = `dashboard:${month || ''}:${year || ''}`
  const canUseCache = !signal
  const cachedPromise = canUseCache ? queryCache.get<DashboardData>(cacheKey) : null
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    let url = `${API_BASE_URL}/financial/dashboard`
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    if (year) params.append('year', year.toString())

    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }

    const response = await fetch(url, {
      headers: getHeaders(),
      signal,
    })
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data')
    }
    const data = await response.json()
    return {
      ...data,
      setting: {
        ...data.setting,
        targetStabilityFund: deobfuscateAmount(data.setting.targetStabilityFund)
      },
      categories: (data.categories || []).map((c: any) => ({
        ...c,
        target: deobfuscateAmount(c.target),
        budget: deobfuscateAmount(c.budget),
        netChange: deobfuscateAmount(c.netChange),
        remaining: deobfuscateAmount(c.remaining)
      })),
      stats: {
        ...data.stats,
        totalBalance: deobfuscateAmount(data.stats.totalBalance),
        monthlyIncome: deobfuscateAmount(data.stats.monthlyIncome),
        monthlyInflow: deobfuscateAmount(data.stats.monthlyInflow),
        monthlyExpenses: deobfuscateAmount(data.stats.monthlyExpenses),
        activeRecurringTotal: deobfuscateAmount(data.stats.activeRecurringTotal),
        pastThreeMonthsRewardsAverage: deobfuscateAmount(data.stats.pastThreeMonthsRewardsAverage)
      },
      recentTransactions: (data.recentTransactions || []).map(deobfuscateTransaction),
      activeRecurringPayments: (data.activeRecurringPayments || []).map((rp: any) => ({
        ...rp,
        amount: deobfuscateAmount(rp.amount)
      })),
      trendPoints: (data.trendPoints || []).map((tp: any) => ({
        ...tp,
        balance: deobfuscateAmount(tp.balance)
      })),
      last3TrendPoints: (data.last3TrendPoints || []).map((tp: any) => ({
        ...tp,
        balance: deobfuscateAmount(tp.balance)
      })),
      last6TrendPoints: (data.last6TrendPoints || []).map((tp: any) => ({
        ...tp,
        balance: deobfuscateAmount(tp.balance)
      })),
      pendingNotifications: (data.pendingNotifications || []).map((pn: any) => ({
        ...pn,
        amount: deobfuscateAmount(pn.amount)
      })),
      monthlyCategoryBreakdown: (data.monthlyCategoryBreakdown || []).map((cb: any) => ({
        ...cb,
        amount: deobfuscateAmount(cb.amount)
      })),
      last3CategoryBreakdown: (data.last3CategoryBreakdown || []).map((cb: any) => ({
        ...cb,
        amount: deobfuscateAmount(cb.amount)
      })),
      last6CategoryBreakdown: (data.last6CategoryBreakdown || []).map((cb: any) => ({
        ...cb,
        amount: deobfuscateAmount(cb.amount)
      })),
      yearlyCategoryBreakdown: (data.yearlyCategoryBreakdown || []).map((cb: any) => ({
        ...cb,
        amount: deobfuscateAmount(cb.amount)
      }))
    }
  })()

  if (canUseCache) {
    queryCache.set(cacheKey, promise)
  }
  return promise
}

// Always reflects the real current cycle's wallet total, independent of whatever cycle the
// Dashboard/Ledger has navigated to -- used by the navbar wallet widget.
export async function fetchWalletBalance(signal?: AbortSignal): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/financial/wallet-balance`, {
    headers: getHeaders(),
    signal,
  })
  if (!response.ok) {
    throw new Error('Failed to fetch wallet balance')
  }
  const data = await response.json()
  return deobfuscateAmount(data.totalBalance)
}

export async function updateSettings(settings: {
  targetStabilityFund: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  darkMode?: boolean
  hideSensitive?: boolean
  currency?: string
  stabilityOverflowRedirect?: string
}): Promise<void> {
  const payload = {
    ...settings,
    targetStabilityFund: obfuscateAmount(settings.targetStabilityFund)
  }
  const response = await fetch(`${API_BASE_URL}/financial/settings`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error('Failed to update financial settings')
  }
  queryCache.invalidateAll()
}

// Lightweight helper that only updates dark mode preference
export async function updateDarkMode(darkMode: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/financial/dark-mode`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ darkMode }),
  })
  if (!response.ok) {
    // Non-fatal: silently fail (preference also stored in localStorage)
    console.warn('Failed to persist dark mode preference to server')
  } else {
    queryCache.invalidateAll()
  }
}

// Lightweight helper that only updates hide sensitive preference
export async function updateHideSensitive(hideSensitive: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/financial/hide-sensitive`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ hideSensitive }),
  })
  if (!response.ok) {
    console.warn('Failed to persist hide sensitive preference to server')
  } else {
    queryCache.invalidateAll()
  }
}

export async function selectPeriod(selectedMonth: string, selectedYear: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/financial/select-period`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ selectedMonth, selectedYear }),
  })
  if (!response.ok) {
    throw new Error('Failed to select active period')
  }
  queryCache.invalidateAll()
}

// Transactions
export async function fetchAutocompleteSuggestions(signal?: AbortSignal): Promise<import('../types').AutocompleteSuggestion[]> {
  const res = await fetch(`${API_BASE_URL}/transactions/autocomplete`, {
    headers: getHeaders(),
    signal,
  })
  if (!res.ok) throw new Error('Failed to fetch autocomplete suggestions')
  return res.json()
}

// A cycle whose calendar month is strictly before the current month is fully in the
// past: its transactions can't change through normal use, so it's safe to cache far
// longer than the live cycle. (Backdated edits to an old cycle still call
// queryCache.invalidateAll() like every other mutation, so a stale entry can never
// outlive an actual change.)
const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CLOSED_CYCLE_STALE_TIME = 24 * 60 * 60 * 1000  // 24h

function isClosedCycle(month?: string, year?: number): boolean {
  if (!month || !year) return false
  const monthIndex = MONTH_ABBREVIATIONS.indexOf(month)
  if (monthIndex === -1) return false
  const now = new Date()
  return year < now.getFullYear() || (year === now.getFullYear() && monthIndex < now.getMonth())
}

export function fetchTransactions(month?: string, year?: number, all?: boolean, signal?: AbortSignal): Promise<Transaction[]> {
  const cacheKey = all ? 'transactions:all' : `transactions:${month || ''}:${year || ''}`
  const canUseCache = !signal
  const cachedPromise = canUseCache ? queryCache.get<Transaction[]>(cacheKey) : null
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    let url = `${API_BASE_URL}/transactions`
    const params = new URLSearchParams()
    if (all) {
      params.append('all', 'true')
    } else {
      if (month) params.append('month', month)
      if (year) params.append('year', year.toString())
    }

    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }

    const response = await fetch(url, {
      headers: getHeaders(),
      signal,
    })
    if (!response.ok) {
      throw new Error('Failed to fetch transactions')
    }
    const data = await response.json()
    return (data || []).map(deobfuscateTransaction)
  })()

  if (canUseCache) {
    queryCache.set(cacheKey, promise, isClosedCycle(month, year) ? CLOSED_CYCLE_STALE_TIME : undefined)
  }
  return promise
}

export async function exportTransactionsCsv(params: {
  search?: string
  ledgerCategories?: string[]
  categories?: string[]
  txType?: 'inflow' | 'outflow' | null
  startDate?: string
  endDate?: string
}): Promise<{ blob: Blob; filename: string }> {
  const url = new URL(`${API_BASE_URL}/transactions/export`)
  url.searchParams.append('all', 'true')
  if (params.search) url.searchParams.append('search', params.search)
  if (params.ledgerCategories && params.ledgerCategories.length > 0)
    url.searchParams.append('ledgerCategory', params.ledgerCategories.join(','))
  if (params.categories && params.categories.length > 0)
    url.searchParams.append('category', params.categories.join(','))
  if (params.txType) url.searchParams.append('txType', params.txType)
  if (params.startDate) url.searchParams.append('startDate', params.startDate)
  if (params.endDate) url.searchParams.append('endDate', params.endDate)

  const response = await fetch(url.toString(), { headers: getHeaders() })
  if (!response.ok) {
    throw new Error('Failed to export transactions')
  }
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

export async function fetchPagedTransactions(params: {
  page: number
  pageSize: number
  search?: string
  ledgerCategories?: string[]
  categories?: string[]
  txType?: 'inflow' | 'outflow' | null
  startDate?: string
  endDate?: string
}): Promise<PagedTransactionResult> {
  const url = new URL(`${API_BASE_URL}/transactions`)
  url.searchParams.append('all', 'true')
  url.searchParams.append('page', params.page.toString())
  url.searchParams.append('pageSize', params.pageSize.toString())
  if (params.search) url.searchParams.append('search', params.search)
  if (params.ledgerCategories && params.ledgerCategories.length > 0)
    url.searchParams.append('ledgerCategory', params.ledgerCategories.join(','))
  if (params.categories && params.categories.length > 0)
    url.searchParams.append('category', params.categories.join(','))
  if (params.txType)
    url.searchParams.append('txType', params.txType)
  if (params.startDate) url.searchParams.append('startDate', params.startDate)
  if (params.endDate) url.searchParams.append('endDate', params.endDate)

  const response = await fetch(url.toString(), { headers: getHeaders() })
  if (!response.ok) throw new Error('Failed to fetch paged transactions')
  const data = await response.json()
  return {
    items: (data.items || []).map(deobfuscateTransaction),
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? params.pageSize
  }
}

export async function addTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
  const payload = {
    ...transaction,
    amount: obfuscateAmount(transaction.amount)
  }
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error('Failed to add transaction')
  }
  queryCache.invalidateAll()
  const data = await response.json()
  return deobfuscateTransaction(data)
}

export async function deleteTransaction(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to delete transaction')
  }
  queryCache.invalidateAll()
}

export async function updateTransaction(id: string, transaction: Omit<Transaction, 'id'>): Promise<void> {
  const payload = {
    ...transaction,
    amount: obfuscateAmount(transaction.amount)
  }
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error('Failed to update transaction')
  }
  queryCache.invalidateAll()
}

// Recurring Payments
export function fetchRecurringPayments(signal?: AbortSignal): Promise<RecurringPayment[]> {
  const cacheKey = 'recurringPayments'
  const canUseCache = !signal
  const cachedPromise = canUseCache ? queryCache.get<RecurringPayment[]>(cacheKey) : null
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    const response = await fetch(`${API_BASE_URL}/recurring-payments`, {
      headers: getHeaders(),
      signal,
    })
    if (!response.ok) {
      throw new Error('Failed to fetch recurring payments')
    }
    const data = await response.json()
    return (data || []).map(deobfuscateRecurringPayment)
  })()

  if (canUseCache) {
    queryCache.set(cacheKey, promise, 300000)
  }
  return promise
}

export async function addRecurringPayment(payment: Omit<RecurringPayment, 'id'> & { id?: string }): Promise<RecurringPayment> {
  const payload = {
    ...payment,
    amount: obfuscateAmount(payment.amount)
  }
  const response = await fetch(`${API_BASE_URL}/recurring-payments`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error('Failed to add recurring payment')
  }
  queryCache.invalidateAll()
  const data = await response.json()
  return deobfuscateRecurringPayment(data)
}

export async function toggleRecurringPayment(id: string): Promise<RecurringPayment> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments/${id}/toggle`, {
    method: 'PUT',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to toggle recurring payment')
  }
  queryCache.invalidateAll()
  const data = await response.json()
  return deobfuscateRecurringPayment(data)
}

export async function updateRecurringPayment(id: string, payment: RecurringPayment): Promise<RecurringPayment> {
  const payload = {
    ...payment,
    amount: obfuscateAmount(payment.amount)
  }
  const response = await fetch(`${API_BASE_URL}/recurring-payments/${id}`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error('Failed to update recurring payment')
  }
  queryCache.invalidateAll()
  const data = await response.json()
  return deobfuscateRecurringPayment(data)
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to delete recurring payment')
  }
  queryCache.invalidateAll()
}

// Categories Management
export function fetchCategories(signal?: AbortSignal): Promise<TransactionCategory[]> {
  const cacheKey = 'categories'
  const canUseCache = !signal
  const cachedPromise = canUseCache ? queryCache.get<TransactionCategory[]>(cacheKey) : null
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      headers: getHeaders(),
      signal,
    })
    if (!response.ok) {
      throw new Error('Failed to fetch custom categories')
    }
    return response.json()
  })()

  if (canUseCache) {
    queryCache.set(cacheKey, promise, 300000)
  }
  return promise
}

export async function addCategory(category: Omit<TransactionCategory, 'id'> & { id?: string }): Promise<TransactionCategory> {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(category),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to add custom category')
  }
  queryCache.invalidateAll()
  return response.json()
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to delete custom category')
  }
  queryCache.invalidateAll()
}

export async function verifyPassword(password: string): Promise<{ verified: boolean; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-password`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ password }),
  })
  if (!response.ok) {
    throw new Error('Password verification request failed')
  }
  const data = await response.json()
  if (data && data.verified) {
    queryCache.invalidateAll()
  }
  return data
}

export async function lockSession(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/lock`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    console.warn('Failed to lock session on server')
  } else {
    queryCache.invalidateAll()
  }
}

export async function fetchWishlist(signal?: AbortSignal): Promise<WishlistItem[]> {
  const canUseCache = !signal
  const cachedPromise = canUseCache ? queryCache.get<WishlistItem[]>('wishlist') : null
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    const response = await fetch(`${API_BASE_URL}/wishlist`, {
      headers: getHeaders(),
      signal,
    })
    if (!response.ok) {
      throw new Error('Failed to fetch wishlist')
    }
    return response.json()
  })()
  
  if (canUseCache) {
    queryCache.set('wishlist', promise, 120000)
  }
  return promise
}

export async function addWishlistItem(item: Partial<WishlistItem>): Promise<WishlistItem> {
  const response = await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(item),
  })
  if (!response.ok) {
    throw new Error('Failed to create wishlist item')
  }
  queryCache.invalidateAll()
  return response.json()
}

export async function updateWishlistItem(id: number, item: WishlistItem): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/wishlist/${id}`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(item),
  })
  if (!response.ok) {
    throw new Error('Failed to update wishlist item')
  }
  queryCache.invalidateAll()
}

export async function deleteWishlistItem(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/wishlist/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to delete wishlist item')
  }
  queryCache.invalidateAll()
}

export async function purchaseWishlistItem(id: number): Promise<{ item: WishlistItem; transaction: Transaction }> {
  const response = await fetch(`${API_BASE_URL}/wishlist/${id}/purchase`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Failed to purchase wishlist item')
  }
  queryCache.invalidateAll()
  const data = await response.json()
  return { ...data, transaction: deobfuscateTransaction(data.transaction) }
}

export async function pingServer(): Promise<{ status: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/ping?t=${Date.now()}`)
    if (!response.ok) throw new Error('Status not ok')
    return response.json()
  } catch {
    return { status: 'waking_up' }
  }
}

// WebAuthn (fingerprint) enrollment - requires an existing password-authenticated session
export async function getFingerprintRegisterOptions(): Promise<{ challengeId: string; options: CreateOptionsJson }> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/register/options`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to start fingerprint registration')
  }
  return response.json()
}

export async function verifyFingerprintRegistration(challengeId: string, credential: unknown, deviceLabel?: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/register/verify`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ challengeId, credential, deviceLabel }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to register fingerprint')
  }
}

export interface FingerprintCredentialSummary {
  id: string
  deviceLabel: string | null
  createdAt: string
}

export async function listFingerprintCredentials(): Promise<FingerprintCredentialSummary[]> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/credentials`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to load fingerprint credentials')
  }
  return response.json()
}

export async function deleteFingerprintCredential(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/credentials/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to remove fingerprint credential')
  }
}

// WebAuthn (fingerprint) login - unauthenticated, this is how a session is obtained
export async function getFingerprintLoginOptions(): Promise<{ challengeId: string; options: AssertionOptionsJson }> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/login/options`, {
    method: 'POST',
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Fingerprint login is not available')
  }
  return response.json()
}

export async function verifyFingerprintLogin(challengeId: string, credential: any): Promise<{ token: string; username: string }> {
  const payload = { challengeId, credential, ...getDeviceInfo() }
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Verification failed')
  }
  const data = await response.json()
  localStorage.setItem('auth_token', data.token)
  queryCache.invalidateAll()
  return data
}

export interface SessionSummary {
  id: string
  deviceName: string
  createdAt: string
  expiresAt: string
  isLocked: boolean
  lastActiveAt: string | null
  ipAddress: string | null
  userAgent: string | null
  isCurrent: boolean
}

export async function getSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to fetch sessions')
  }
  return response.json()
}

export async function revokeSession(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to revoke session')
  }
}

export async function revokeAllSessions(keepCurrent: boolean = true): Promise<{ revokedCount: number }> {
  const response = await fetch(`${API_BASE_URL}/auth/sessions/revoke-all?keepCurrent=${keepCurrent}`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to log out other devices')
  }
  return response.json()
}

export async function sendSessionHeartbeat(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/sessions/heartbeat`, {
      method: 'POST',
      headers: getHeaders(),
    })
  } catch {
    // Best-effort -- the client-side inactivity timer doesn't depend on this succeeding.
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to change password')
  }
}

// Two-factor authentication (TOTP)
export interface TwoFactorStatus {
  enabled: boolean
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const response = await fetch(`${API_BASE_URL}/auth/2fa/status`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to load two-factor status')
  }
  return response.json()
}

export async function setupTotp(): Promise<{ secret: string; otpauthUri: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/2fa/totp/setup`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to start two-factor setup')
  }
  return response.json()
}

export async function enableTotp(code: string): Promise<{ enabled: boolean; recoveryCodes: string[] }> {
  const response = await fetch(`${API_BASE_URL}/auth/2fa/totp/enable`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Invalid code')
  }
  return response.json()
}

export async function disableTotp(password: string, code: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/2fa/totp/disable`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ password, code }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to disable two-factor authentication')
  }
}

export async function regenerateRecoveryCodes(password: string): Promise<{ recoveryCodes: string[] }> {
  const response = await fetch(`${API_BASE_URL}/auth/2fa/recovery-codes/regenerate`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ password }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to regenerate recovery codes')
  }
  return response.json()
}

// WebAuthn (fingerprint) re-verification against the CALLER'S EXISTING
// session -- unlocking the lock screen or proving identity to reveal
// sensitive figures. Unlike verifyFingerprintLogin, this never issues a new
// session token (mirrors verifyPassword's "reuse the current session" shape).
export async function getFingerprintAssertOptions(): Promise<{ challengeId: string; options: AssertionOptionsJson }> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/assert/options`, {
    method: 'POST',
    headers: getHeaders(),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Fingerprint verification is not available')
  }
  return response.json()
}

export async function verifyFingerprintAssert(challengeId: string, credential: unknown): Promise<{ verified: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/webauthn/assert/verify`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ challengeId, credential }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Fingerprint verification failed')
  }
  return response.json()
}

// ── Receipt OCR ───────────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  description: string
  amount: number | null
  date: string | null          // ISO date YYYY-MM-DD, or null if not found
  category: string
  ledgerCategory: string       // Essentials | Growth | Stability | Rewards | Income
  txType: 'inflow' | 'outflow'
  confidence: number           // 0.0 – 1.0
}

export interface ReceiptScanJob {
  scanId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result: ReceiptScanResult | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

export async function startReceiptScan(imageFile: File): Promise<{ scanId: string; status: string }> {
  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await fetch(`${API_BASE_URL}/ocr/scan-receipt/jobs`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Could not start receipt scan. Please try again.')
  }

  return response.json()
}

export async function fetchReceiptScanJob(scanId: string): Promise<ReceiptScanJob> {
  const response = await fetch(`${API_BASE_URL}/ocr/scan-receipt/jobs/${scanId}`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Could not fetch receipt scan status.')
  }

  return response.json()
}

export async function deleteReceiptScanJob(scanId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/ocr/scan-receipt/jobs/${scanId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Could not clear receipt scan job.')
  }
}

