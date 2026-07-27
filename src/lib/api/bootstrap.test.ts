import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBootstrap } from './bootstrap'
import { obfuscateAmount } from './amounts'

const okResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => payload,
})

// A minimal but realistically-shaped server payload. Amounts are obfuscated on the wire, so
// these tests double as a check that the composite response is decoded with the same mappers
// the individual endpoints use rather than passed through raw.
const wirePayload = {
  month: 'Jul',
  year: 2026,
  dashboard: {
    setting: {
      selectedMonth: 'Jul',
      selectedYear: 2026,
      targetStabilityFund: obfuscateAmount(10000),
      hideSensitive: false,
      darkMode: null,
      currency: 'MYR',
    },
    stats: {
      totalBalance: obfuscateAmount(1234.56),
      monthlyIncome: obfuscateAmount(3000),
      monthlyInflow: obfuscateAmount(3000),
      monthlyExpenses: obfuscateAmount(500),
      activeRecurringTotal: obfuscateAmount(120),
    },
    categories: [],
    activeRecurringPayments: [],
    trendPoints: [],
    pendingNotifications: [],
    monthlyCategoryBreakdown: [],
    categoryLimitProgress: [],
  },
  insights: {
    last3CategoryBreakdown: [],
    last6CategoryBreakdown: [],
    yearlyCategoryBreakdown: [],
    pastThreeMonthsRewardsAverage: obfuscateAmount(42),
    hasRewardsHistory: true,
    availableYears: [2026],
  },
  transactions: [
    {
      id: 'tx-1',
      date: '2026-07-09',
      description: 'Coffee',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: obfuscateAmount(-12.5),
    },
  ],
  recurringPayments: [],
  categories: [{ id: 'c1', name: 'Food', cycleLimit: obfuscateAmount(300) }],
  wishlist: [],
  autocomplete: [{ description: 'Coffee', category: 'Food' }],
  walletBalance: { totalBalance: obfuscateAmount(1234.56) },
}

describe('fetchBootstrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches the whole boot payload in a single request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(wirePayload))
    vi.stubGlobal('fetch', fetchMock)

    await fetchBootstrap()

    // The point of the endpoint: one round trip, not eight.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/bootstrap')
  })

  it('passes an explicit period through as query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(wirePayload))
    vi.stubGlobal('fetch', fetchMock)

    await fetchBootstrap('Mar', 2025)

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('month=Mar')
    expect(url).toContain('year=2025')
  })

  it('decodes every slice with the shared mappers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(wirePayload)))

    const result = await fetchBootstrap()

    expect(result.month).toBe('Jul')
    expect(result.year).toBe(2026)
    // Amounts must come back deobfuscated, not as their wire representation.
    expect(result.dashboard.stats.totalBalance).toBe(1234.56)
    expect(result.dashboard.setting.targetStabilityFund).toBe(10000)
    expect(result.insights.pastThreeMonthsRewardsAverage).toBe(42)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].amount).toBe(-12.5)
    expect(result.categories[0].cycleLimit).toBe(300)
    expect(result.walletBalance).toBe(1234.56)
    expect(result.autocomplete).toHaveLength(1)
  })

  it('tolerates null collections from the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
      ...wirePayload,
      transactions: null,
      recurringPayments: null,
      categories: null,
      wishlist: null,
      autocomplete: null,
    })))

    const result = await fetchBootstrap()

    expect(result.transactions).toEqual([])
    expect(result.recurringPayments).toEqual([])
    expect(result.categories).toEqual([])
    expect(result.wishlist).toEqual([])
    expect(result.autocomplete).toEqual([])
  })

  it('rejects with a 404 status so callers can fall back to the per-endpoint path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({ message: 'Not Found' }),
      text: async () => 'Not Found',
    }))

    // useFinancialData distinguishes this case from every other failure: a 404 means the
    // server predates the endpoint, so it retries with the eight individual GETs.
    await expect(fetchBootstrap()).rejects.toMatchObject({ status: 404 })
  })
})
