import type { Transaction, RecurringPayment, DashboardData, TransactionCategory } from '../types'

const API_BASE_URL = 'http://localhost:5000/api'

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
  }
}

// Dashboard
export async function fetchDashboard(month?: string, year?: number): Promise<DashboardData> {
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
  return response.json()
}

export async function updateSettings(settings: {
  monthlyIncome: number
  targetStabilityFund: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/financial/settings`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(settings),
  })
  if (!response.ok) {
    throw new Error('Failed to update financial settings')
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
}

// Transactions
export async function fetchTransactions(month?: string, year?: number): Promise<Transaction[]> {
  let url = `${API_BASE_URL}/transactions`
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
    throw new Error('Failed to fetch transactions')
  }
  return response.json()
}

export async function addTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(transaction),
  })
  if (!response.ok) {
    throw new Error('Failed to add transaction')
  }
  return response.json()
}

export async function deleteTransaction(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to delete transaction')
  }
}

// Recurring Payments
export async function fetchRecurringPayments(): Promise<RecurringPayment[]> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to fetch recurring payments')
  }
  return response.json()
}

export async function addRecurringPayment(payment: Omit<RecurringPayment, 'id'>): Promise<RecurringPayment> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payment),
  })
  if (!response.ok) {
    throw new Error('Failed to add recurring payment')
  }
  return response.json()
}

export async function toggleRecurringPayment(id: string): Promise<RecurringPayment> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments/${id}/toggle`, {
    method: 'PUT',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to toggle recurring payment')
  }
  return response.json()
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to delete recurring payment')
  }
}

export async function dismissRecurringPayment(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/recurring-payments/dismiss`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ id }),
  })
  if (!response.ok) {
    throw new Error('Failed to dismiss recurring payment')
  }
}

// Categories Management
export async function fetchCategories(): Promise<TransactionCategory[]> {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Failed to fetch custom categories')
  }
  return response.json()
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
}

