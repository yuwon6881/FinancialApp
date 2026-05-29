import type { Transaction, RecurringPayment, DashboardData, TransactionCategory } from '../types'

const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:5000/api' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')

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
  },

  invalidateAll() {
    this.store.clear()
  }
}

const originalFetch = window.fetch
window.fetch = async (...args) => {
  const response = await originalFetch(...args)
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as any).url || ''
  if (!response.ok && response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/status')) {
    throw new Error('401 Unauthorized')
  }
  return response
}

function getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {
    ...extraHeaders
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
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
export async function fetchAuthStatus(): Promise<{ isRegistered: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/status`)
  if (!response.ok) {
    throw new Error('Failed to fetch auth status')
  }
  return response.json()
}

export async function login(credentials: any): Promise<{ token: string; username: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Invalid credentials')
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

// Dashboard
export function fetchDashboard(month?: string, year?: number): Promise<DashboardData> {
  const cacheKey = `dashboard:${month || ''}:${year || ''}`
  const cachedPromise = queryCache.get<DashboardData>(cacheKey)
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
        activeRecurringTotal: deobfuscateAmount(data.stats.activeRecurringTotal)
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

  queryCache.set(cacheKey, promise)
  return promise
}

export async function updateSettings(settings: {
  targetStabilityFund: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  darkMode?: boolean
  currency?: string
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
export function fetchTransactions(month?: string, year?: number, all?: boolean): Promise<Transaction[]> {
  const cacheKey = all ? 'transactions:all' : `transactions:${month || ''}:${year || ''}`
  const cachedPromise = queryCache.get<Transaction[]>(cacheKey)
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
    })
    if (!response.ok) {
      throw new Error('Failed to fetch transactions')
    }
    const data = await response.json()
    return (data || []).map(deobfuscateTransaction)
  })()

  queryCache.set(cacheKey, promise)
  return promise
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

// Recurring Payments
export function fetchRecurringPayments(): Promise<RecurringPayment[]> {
  const cacheKey = 'recurringPayments'
  const cachedPromise = queryCache.get<RecurringPayment[]>(cacheKey)
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    const response = await fetch(`${API_BASE_URL}/recurring-payments`, {
      headers: getHeaders(),
    })
    if (!response.ok) {
      throw new Error('Failed to fetch recurring payments')
    }
    const data = await response.json()
    return (data || []).map(deobfuscateRecurringPayment)
  })()

  queryCache.set(cacheKey, promise, 300000)
  return promise
}

export async function addRecurringPayment(payment: Omit<RecurringPayment, 'id'>): Promise<RecurringPayment> {
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
export function fetchCategories(): Promise<TransactionCategory[]> {
  const cacheKey = 'categories'
  const cachedPromise = queryCache.get<TransactionCategory[]>(cacheKey)
  if (cachedPromise) return cachedPromise

  const promise = (async () => {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      headers: getHeaders(),
    })
    if (!response.ok) {
      throw new Error('Failed to fetch custom categories')
    }
    return response.json()
  })()

  queryCache.set(cacheKey, promise, 300000)
  return promise
}

export async function addCategory(category: Omit<TransactionCategory, 'id'>): Promise<TransactionCategory> {
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
  return response.json()
}

