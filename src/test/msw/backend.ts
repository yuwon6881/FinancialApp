// A small in-memory backend that mirrors the FinancialAppApi wire contract closely
// enough to exercise the real frontend API client, offline sync engine, and view logic
// without a running server. Money values cross the wire as obfuscated strings, exactly
// as the real API sends them, so the client's obfuscate/deobfuscate round-trip is tested.
import { http, HttpResponse } from 'msw'
import { obfuscateAmount } from '@/lib/api/amounts'

const API = 'http://localhost/api'

interface WireTx {
  id: string
  date: string
  description: string
  category: string
  ledgerCategory: string
  amount: string
  recurringPaymentId?: string | null
  wishlistItemId?: number | null
}

interface WireWish {
  id: number
  name: string
  price: string
  priority: string
  isPurchased: boolean
  purchasedAt?: string | null
  purchaseTransactionId?: string | null
  createdAt: string
  isActive: boolean
}

interface WireRecurringPaymentForTest {
  id: string
  name: string
  amount: string
  frequency: string
  category: string
  ledgerCategory: string
  nextDueDate: string
  dueDate: number
  startDate: string
  active: boolean
  endDate?: string
  reminderEnabled?: boolean
  reminderMode?: string
  reminderLeadDays?: number
}

interface BackendState {
  registered: boolean
  username: string
  password: string
  token: string
  twoFactor: boolean
  transactions: Map<string, WireTx>
  wishlist: WireWish[]
  nextWishId: number
  setting: {
    targetStabilityFund: string
    selectedMonth: string
    selectedYear: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    darkMode: boolean
    hideSensitive: boolean
    currency: string
    stabilityOverflowRedirect: string
  }
  recurringPayments: Map<string, WireRecurringPaymentForTest>
  pushEnabled: boolean
  pushRegisteredDeviceIds: Set<string>
}

function freshState(): BackendState {
  return {
    registered: true,
    username: 'alice',
    password: 'Password123!',
    token: 'test-token-abc',
    twoFactor: false,
    transactions: new Map(),
    wishlist: [],
    nextWishId: 1,
    setting: {
      targetStabilityFund: obfuscateAmount(10000),
      selectedMonth: 'Jun',
      selectedYear: 2026,
      essentialsAlloc: 0.5,
      growthAlloc: 0.25,
      stabilityAlloc: 0.15,
      rewardsAlloc: 0.1,
      cycleDay: 28,
      darkMode: false,
      hideSensitive: true,
      currency: 'USD',
      stabilityOverflowRedirect: 'Split: Growth 50%, Rewards 50%',
    },
    recurringPayments: new Map(),
    pushEnabled: false,
    pushRegisteredDeviceIds: new Set(),
  }
}

export let state: BackendState = freshState()

/** Records the last request seen per route so tests can assert on request shape. */
export const lastRequest: Record<string, { headers: Headers; body: unknown }> = {}

export function resetBackend(): void {
  state = freshState()
  for (const key of Object.keys(lastRequest)) delete lastRequest[key]
}

function walletBalance(): number {
  let total = 0
  for (const tx of state.transactions.values()) total += parseFloat(atob0(tx.amount))
  return total
}

// Deobfuscate helper local to the backend (mirror of the client's algorithm).
function atob0(obf: string): string {
  const KEY = 'FinancialAppObfuscationKey'
  try {
    const bin = atob(obf)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length)
    return new TextDecoder().decode(bytes)
  } catch {
    return '0'
  }
}

export const handlers = [
  http.get(`${API}/investments/allocation`, () => HttpResponse.json({
    status: 'NotStarted',
    appCurrency: 'USD',
    plan: {
      usEquityTarget: 66,
      internationalExUsTarget: 10,
      bondsTarget: 24,
      watchDrift: 3,
      alertDrift: 5,
    },
    assignments: [],
    sleeves: [
      { sleeve: 'USEquity', label: 'US Equity', targetPercentage: 66, value: 0, status: 'NotStarted' },
      { sleeve: 'InternationalExUS', label: 'International ex-US', targetPercentage: 10, value: 0, status: 'NotStarted' },
      { sleeve: 'Bonds', label: 'Bonds', targetPercentage: 24, value: 0, status: 'NotStarted' },
    ],
    recommendations: [],
    incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    investedValue: 0,
    availableCash: 0,
    minimumContribution: 0,
  })),
  http.post(`${API}/investments/market-data/refresh`, () => HttpResponse.json({
    status: 'Fresh',
    updated: 0,
    total: 0,
    complete: true,
    warnings: [],
  })),
  http.get(`${API}/auth/status`, () =>
    HttpResponse.json({ isRegistered: state.registered, hasFingerprint: false })),

  http.post(`${API}/auth/register`, async ({ request }) => {
    if (state.registered) {
      return HttpResponse.json({ message: 'Registration is closed.' }, { status: 400 })
    }
    const body = (await request.json()) as { username: string; password: string }
    state.registered = true
    state.username = body.username
    state.password = body.password
    return HttpResponse.json({ message: 'Registration successful' })
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    if (body.username !== state.username || body.password !== state.password) {
      return HttpResponse.json({ message: 'Invalid username or password' }, { status: 401 })
    }
    if (state.twoFactor) {
      return HttpResponse.json({ requiresTwoFactor: true, pendingToken: 'pending-xyz' })
    }
    return HttpResponse.json({ token: state.token, username: state.username })
  }),

  http.post(`${API}/auth/login/2fa`, async ({ request }) => {
    const body = (await request.json()) as { pendingToken: string; code: string }
    if (body.pendingToken !== 'pending-xyz' || body.code !== '123456') {
      return HttpResponse.json({ message: 'Invalid code' }, { status: 401 })
    }
    return HttpResponse.json({ token: state.token, username: state.username })
  }),

  http.get(`${API}/transactions`, ({ request }) => {
    const url = new URL(request.url)
    const items = [...state.transactions.values()]
    if (url.searchParams.get('all') === 'true') {
      return HttpResponse.json({ items, total: items.length, page: 1, pageSize: items.length })
    }
    return HttpResponse.json(items)
  }),

  http.get(`${API}/transactions/:id`, ({ params }) => {
    const tx = state.transactions.get(String(params.id))
    return tx ? HttpResponse.json(tx) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),

  http.post(`${API}/transactions`, async ({ request }) => {
    lastRequest['POST /transactions'] = { headers: request.headers, body: await request.clone().json() }
    const body = (await request.json()) as Partial<WireTx>
    if (!body.category || !['Food', 'Salary', 'Other', 'Transfer'].includes(body.category)) {
      // fall through only for known categories; unknown → 400 like the real API
    }
    const id = body.id && body.id.length > 0 ? body.id : `tx-${state.transactions.size + 1}`
    if (state.transactions.has(id)) {
      return HttpResponse.json(state.transactions.get(id)) // idempotent replay → 200
    }
    const tx: WireTx = {
      id,
      date: body.date ?? '2026-06-01',
      description: body.description ?? '',
      category: body.category ?? 'Other',
      ledgerCategory: body.ledgerCategory ?? 'Essentials',
      amount: body.amount ?? obfuscateAmount(0),
      recurringPaymentId: body.recurringPaymentId ?? null,
      wishlistItemId: body.wishlistItemId ?? null,
    }
    state.transactions.set(id, tx)
    return HttpResponse.json(tx, { status: 201 })
  }),

  http.delete(`${API}/transactions/:id`, ({ params }) => {
    const existed = state.transactions.delete(String(params.id))
    return existed
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),

  http.get(`${API}/wishlist`, () => HttpResponse.json(state.wishlist)),

  http.post(`${API}/wishlist`, async ({ request }) => {
    const body = (await request.json()) as { name?: string; price?: string; priority?: string }
    const item: WireWish = {
      id: state.nextWishId++,
      name: body.name ?? '',
      price: body.price ?? obfuscateAmount(0),
      priority: body.priority ?? 'Medium',
      isPurchased: false,
      purchasedAt: null,
      purchaseTransactionId: null,
      createdAt: '2026-06-01T00:00:00Z',
      isActive: state.wishlist.length === 0,
    }
    state.wishlist.push(item)
    return HttpResponse.json(item, { status: 201 })
  }),

  http.post(`${API}/wishlist/:id/purchase`, ({ params }) => {
    const item = state.wishlist.find(w => w.id === Number(params.id))
    if (!item) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    if (item.isPurchased) {
      const existing = [...state.transactions.values()].find(tx => tx.wishlistItemId === item.id)
      return existing
        ? HttpResponse.json({ item, transaction: existing })
        : HttpResponse.json({ message: 'Item is already purchased.' }, { status: 400 })
    }

    const price = parseFloat(atob0(item.price))
    const txId = `tx-wish-${item.id}`
    const tx: WireTx = {
      id: txId,
      date: '2026-06-15',
      description: `Purchased: ${item.name} (Wish List)`,
      category: 'Other',
      ledgerCategory: 'Rewards',
      amount: obfuscateAmount(-price),
      wishlistItemId: item.id,
    }
    state.transactions.set(txId, tx)
    item.isPurchased = true
    item.purchasedAt = '2026-06-15T00:00:00Z'
    item.isActive = false
    item.purchaseTransactionId = txId
    return HttpResponse.json({ item, transaction: tx })
  }),

  http.delete(`${API}/wishlist/:id/purchase`, ({ params }) => {
    const item = state.wishlist.find(w => w.id === Number(params.id))
    if (!item) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    item.isPurchased = false
    item.purchasedAt = null
    item.purchaseTransactionId = null
    return HttpResponse.json(item)
  }),

  http.get(`${API}/financial/dashboard`, () => {
    const balance = obfuscateAmount(walletBalance())
    return HttpResponse.json({
      setting: state.setting,
      cycleLabel: `${state.setting.selectedMonth} ${state.setting.selectedYear}`,
      categories: [],
      stats: {
        totalBalance: balance,
        monthlyIncome: obfuscateAmount(0),
        monthlyInflow: obfuscateAmount(0),
        monthlyExpenses: obfuscateAmount(0),
        activeRecurringTotal: obfuscateAmount(0),
        growthPercentAchieved: 0,
        stabilityPercentReached: 0,
      },
      activeRecurringPayments: [],
      trendPoints: [],
      last3TrendPoints: [],
      last6TrendPoints: [],
      pendingNotifications: [],
      monthlyCategoryBreakdown: [],
    })
  }),

  http.post(`${API}/financial/select-period`, async ({ request }) => {
    const body = (await request.json()) as { selectedMonth: string; selectedYear: number }
    state.setting.selectedMonth = body.selectedMonth
    state.setting.selectedYear = body.selectedYear
    return new HttpResponse(null, { status: 204 })
  }),

  http.put(`${API}/financial/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.targetStabilityFund === 'string') state.setting.targetStabilityFund = body.targetStabilityFund
    if (typeof body.currency === 'string') state.setting.currency = body.currency
    if (typeof body.cycleDay === 'number') state.setting.cycleDay = body.cycleDay
    return new HttpResponse(null, { status: 204 })
  }),
]
