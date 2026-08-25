import { expect, test, type Page, type Route } from '@playwright/test'
import type { InvestmentActivity, SavingsGoal, TaxReliefCategoryDefinition, VaultDocument, WishlistItem } from '../../src/types'

const transaction = {
  id: 'tx-visual-1',
  date: '2026-08-01',
  description: 'Neighbourhood Grocer',
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -86.4,
}

export const vaultDocuments: VaultDocument[] = [
  {
    id: 1,
    originalFileName: '2026-tax-return.pdf',
    contentType: 'application/pdf',
    sizeBytes: 245_760,
    taxYear: 2026,
    notes: 'Annual tax filing',
    transactionId: null,
    uploadedAt: '2026-07-29T00:00:00Z',
    retentionUntil: '2033-12-31',
    reliefCategory: null,
    amount: 1_250,
    amountCurrency: 'MYR',
    amountStatus: 'Confirmed',
    amountConfidence: null,
    amountExtractionMessage: null,
  },
  {
    id: 2,
    originalFileName: 'medical-receipt.png',
    contentType: 'image/png',
    sizeBytes: 98_304,
    taxYear: 2026,
    notes: null,
    transactionId: null,
    uploadedAt: '2026-07-28T00:00:00Z',
    retentionUntil: '2033-12-31',
    reliefCategory: null,
    amount: 180,
    amountCurrency: 'MYR',
    amountStatus: 'Confirmed',
    amountConfidence: null,
    amountExtractionMessage: null,
  },
]

const setting = {
  targetStabilityFund: 10_000,
  selectedMonth: 'Jul',
  selectedYear: 2026,
  essentialsAlloc: 0.5,
  growthAlloc: 0.25,
  stabilityAlloc: 0.15,
  rewardsAlloc: 0.1,
  cycleDay: 28,
  darkMode: false,
  hideSensitive: false,
  currency: 'MYR',
  stabilityOverflowRedirect: 'Split: Growth 50%, Rewards 50%',
}

const dashboard = {
  setting,
  cycleLabel: 'Jul 2026',
  categories: [
    { id: 'food', name: 'Food', allocation: 0.5, target: 800, budget: 800, netChange: -86.4, spent: 86.4, remaining: 713.6 },
    { id: 'salary', name: 'Salary', allocation: 0, target: 0, budget: 0, netChange: 5_500, spent: 0, remaining: 5_500 },
  ],
  stats: {
    totalBalance: 12_480.25,
    monthlyIncome: 5_500,
    monthlyInflow: 5_500,
    monthlyExpenses: 1_840.75,
    activeRecurringTotal: 320,
    growthPercentAchieved: 64,
    stabilityPercentReached: 72,
  },
  activeRecurringPayments: [],
  trendPoints: [],
  last3TrendPoints: [],
  last6TrendPoints: [],
  pendingNotifications: [],
  monthlyCategoryBreakdown: [{ category: 'Food', amount: 86.4 }],
  todayPlanInsights: {
    unpaidRecurringCount: 0,
    unpaidRecurringTotal: 0,
    unpaidEssentialsTotal: 0,
    nonRecurringEssentialsSpent: 86.4,
    nonRecurringEssentialsDailyAverage: 5.76,
    projectedEssentialsEndingBalance: 713.6,
  },
  categoryLimitProgress: [],
}

const accounts = ['Essentials', 'Growth', 'Stability', 'Rewards'].map((bucket, index) => ({
  id: `account-visual-${bucket.toLowerCase()}`,
  name: ['Everyday bank', 'Investment account', 'Emergency fund', 'Fun money'][index],
  bucket,
  kind: 'Bank',
  interestEnabled: false,
  interestRatePercent: 0,
  interestFrequency: 'Monthly',
  isArchived: false,
  remaining: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}))

const bootstrap = {
  month: 'Jul',
  year: 2026,
  dashboard,
  insights: {
    last3CategoryBreakdown: [],
    last6CategoryBreakdown: [],
    yearlyCategoryBreakdown: [],
    pastThreeMonthsRewardsAverage: 500,
    hasRewardsHistory: true,
    availableYears: [2026],
  },
  transactions: [transaction],
  recurringPayments: [],
  categories: [
    { id: 'food', name: 'Food' },
    { id: 'salary', name: 'Salary' },
  ],
  wishlist: [] as WishlistItem[],
  savingsGoals: [],
  autocomplete: [],
  accounts,
  walletBalance: { totalBalance: 12_480.25 },
}

const emptyInvestmentAllocation = {
  status: 'NotStarted',
  appCurrency: 'MYR',
  plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
  assignments: [],
  sleeves: [],
  recommendations: [],
  incompleteReasons: [],
  freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
  investedValue: 0,
  availableCash: 0,
  minimumContribution: 0,
}

const emptyInvestmentPortfolio = {
  appCurrency: 'MYR',
  summary: {
    growthLedgerBalance: 0,
    netDeposits: 0,
    marketValue: 0,
    costBasis: 0,
    unrealisedProfitLoss: 0,
    unrealisedPercent: 0,
    realisedProfitLoss: 0,
    netDividends: 0,
    dailyChange: 0,
    cashValue: 0,
    totalValue: 0,
  },
  accounts: [],
  instruments: [],
  holdings: [],
  chart: [],
  cashBalances: [],
  activityCount: 0,
  cashFlowCount: 0,
  insights: [],
  warnings: [],
  marketDataConfigured: false,
  allocation: emptyInvestmentAllocation,
}

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/**
 * The dashboard's emergency-fund recovery block. Opt-in so the shared dashboard baselines keep
 * showing a healthy fund; a test that wants the exception card asks for it. Amounts are plain
 * numbers, which `deobfuscateAmount` passes through unchanged.
 */
export const stabilityRecoveryFixture = {
  isActive: true,
  // 676.77 taken out and not yet fully back, 325 of it already returned, 351.77 still short. The
  // drawdown that was put back in full is deliberately absent from all three.
  markedTotal: 676.77,
  repaidTotal: 325,
  target: 10_000,
  currentBalance: 4_354.98,
  outstandingShortfall: 351.77,
  openingOutstanding: 0,
  openingObligations: [],
  cyclesRemaining: 3,
  requiredThisCycle: 117.26,
  toppedUpThisCycle: 520,
  outstandingThisCycle: 0,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-08',
  recoveryFromDate: '2026-08-09',
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [
    { bucket: 'Essentials', share: 0.588235 },
    { bucket: 'Growth', share: 0.294118 },
    { bucket: 'Rewards', share: 0.117647 },
  ],
}

interface MockApiOptions {
  registered?: boolean
  stabilityRecovery?: typeof stabilityRecoveryFixture
  failStatus?: boolean
  failDocuments?: boolean
  wishlist?: WishlistItem[]
  savingsGoals?: SavingsGoal[]
  documents?: VaultDocument[]
  reliefCategories?: TaxReliefCategoryDefinition[]
  investmentTransactions?: InvestmentActivity[]
  /** Lets a spec give categories explicit flow types; the default fixture leaves them all `both`. */
  categories?: Array<{ id: string; name: string; type?: string }>
}

export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const darkMode = test.info().project.name.endsWith('-dark')
  const themedBootstrap = {
    ...bootstrap,
    wishlist: options.wishlist ?? bootstrap.wishlist,
    savingsGoals: options.savingsGoals ?? bootstrap.savingsGoals,
    categories: options.categories ?? bootstrap.categories,
    dashboard: {
      ...bootstrap.dashboard,
      setting: { ...bootstrap.dashboard.setting, darkMode },
      ...(options.stabilityRecovery ? { stabilityRecovery: options.stabilityRecovery } : {}),
    },
  }

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    if (pathname.endsWith('/auth/status')) {
      if (options.failStatus) return route.abort('failed')
      return fulfill(route, {
        isRegistered: options.registered ?? true,
        registrationOpen: options.registered === false,
        hasFingerprint: false,
      })
    }
    if (pathname.endsWith('/bootstrap')) return fulfill(route, themedBootstrap)
    if (options.failDocuments && pathname.includes('/documents')) {
      return fulfill(route, { message: 'Vault temporarily unavailable.' }, 503)
    }
    if (pathname.endsWith('/documents/overview')) {
      const documents = options.documents ?? []
      return fulfill(route, {
        usage: {
          totalBytes: documents.reduce((total, document) => total + document.sizeBytes, 0),
          documentCount: documents.length,
        },
        availableYears: [2026],
        retention: { taxYears: [], noticeWindowDays: 180, keepYears: 7 },
        selectedTaxYear: 2026,
        summary: {
          taxYear: 2026,
          confirmedTotal: 0,
          possibleTotal: 0,
          categories: [],
        },
        reliefCategories: options.reliefCategories ?? [],
      })
    }
    if (pathname.endsWith('/documents/usage')) {
      const documents = options.documents ?? []
      return fulfill(route, {
        totalBytes: documents.reduce((total, document) => total + document.sizeBytes, 0),
        documentCount: documents.length,
      })
    }
    if (pathname.endsWith('/documents/years')) return fulfill(route, [2026])
    // The generic GET fallback returns an array, which would leave `taxYears` undefined and crash
    // the Vault and Dashboard instead of rendering an honest empty notice.
    if (pathname.endsWith('/documents/retention')) return fulfill(route, { taxYears: [], noticeWindowDays: 180, keepYears: 7 })
    if (pathname.includes('/documents/relief-categories')) return fulfill(route, options.reliefCategories ?? [])
    if (pathname.includes('/documents/summary/')) {
      return fulfill(route, {
        taxYear: 2026,
        confirmedTotal: 0,
        possibleTotal: 0,
        categories: [],
      })
    }
    if (pathname.endsWith('/documents')) {
      const documents = options.documents ?? []
      return fulfill(route, { items: documents, totalCount: documents.length })
    }
    if (pathname.endsWith('/wishlist')) return fulfill(route, options.wishlist ?? [])
    if (pathname.endsWith('/savings-goals')) return fulfill(route, options.savingsGoals ?? [])
    if (pathname.endsWith('/investments/transactions')) {
      const items = options.investmentTransactions ?? []
      return fulfill(route, { items, total: items.length, page: 1, pageSize: Number(url.searchParams.get('pageSize') || 10) })
    }
    if (pathname.endsWith('/transactions')) {
      return fulfill(route, url.searchParams.has('page')
        ? { items: [transaction], total: 1, page: 1, pageSize: Number(url.searchParams.get('pageSize') || 25) }
        : [transaction])
    }
    if (pathname.endsWith('/investments/portfolio')) {
      return fulfill(route, { ...emptyInvestmentPortfolio, activityCount: (options.investmentTransactions ?? []).length })
    }
    if (pathname.endsWith('/investments/cash-flows')) return fulfill(route, { items: [], total: 0, page: 1, pageSize: 10 })
    if (pathname.endsWith('/investments/allocation')) return fulfill(route, emptyInvestmentAllocation)
    if (route.request().method() === 'GET') return fulfill(route, [])
    return fulfill(route, {})
  })
}

/** Waits for asynchronous content to stop changing the document height. */
export async function waitForStableLayout(page: Page) {
  await expect.poll(async () => {
    const first = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.waitForTimeout(150)
    const second = await page.evaluate(() => document.documentElement.scrollHeight)
    return first === second ? second : -1
  }, { timeout: 10_000 }).toBeGreaterThan(0)
}

export async function establishSession(page: Page) {
  await page.addInitScript(({ dark }) => {
    localStorage.setItem('auth_session', '1')
    localStorage.setItem('auth_username', 'visual-user')
    localStorage.setItem('dark_mode:visual-user', String(dark))
    localStorage.setItem('hide_balance_amounts:visual-user', 'false')
    localStorage.setItem('show_notifications_on_login:visual-user', 'false')
    localStorage.setItem('cached_is_registered', 'true')
    localStorage.setItem('session_locked_global', 'false')
    sessionStorage.setItem('session_locked', 'false')
  }, { dark: test.info().project.name.endsWith('-dark') })
}

export async function seedDraftTransaction(page: Page) {
  await page.addInitScript(draft => {
    localStorage.setItem('draft_transactions', JSON.stringify([draft]))
  }, {
    id: 'draft-visual-1',
    date: '2026-08-02',
    description: 'Weekend market',
    category: 'Food',
    ledgerCategory: 'Essentials',
    amount: -42.5,
  })
}
