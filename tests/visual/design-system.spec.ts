import { expect, test, type Page, type Route } from '@playwright/test'
import type { VaultDocument, WishlistItem } from '../../src/types'

const transaction = {
  id: 'tx-visual-1',
  date: '2026-08-01',
  description: 'Neighbourhood Grocer',
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -86.4,
}

const vaultDocuments: VaultDocument[] = [
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
    { id: 'food', name: 'Food', target: 800, budget: 800, netChange: -86.4, spent: 86.4, remaining: 713.6 },
    { id: 'salary', name: 'Salary', target: 0, budget: 0, netChange: 5_500, spent: 0, remaining: 5_500 },
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

async function mockApi(page: Page, options: { registered?: boolean; failStatus?: boolean; wishlist?: WishlistItem[]; documents?: VaultDocument[] } = {}) {
  const darkMode = test.info().project.name.endsWith('-dark')
  const themedBootstrap = {
    ...bootstrap,
    wishlist: options.wishlist ?? bootstrap.wishlist,
    dashboard: {
      ...bootstrap.dashboard,
      setting: { ...bootstrap.dashboard.setting, darkMode },
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
    if (pathname.endsWith('/documents/usage')) {
      const documents = options.documents ?? []
      return fulfill(route, {
        totalBytes: documents.reduce((total, document) => total + document.sizeBytes, 0),
        documentCount: documents.length,
      })
    }
    if (pathname.endsWith('/documents/years')) return fulfill(route, [2026])
    // Must stay an object: the generic `GET -> []` fallthrough below would leave `taxYears`
    // undefined, so the Vault and Dashboard would crash rather than render an empty notice.
    if (pathname.endsWith('/documents/retention')) return fulfill(route, { taxYears: [], noticeWindowDays: 180, keepYears: 7 })
    if (pathname.includes('/documents/relief-categories')) return fulfill(route, [])
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
    if (pathname.endsWith('/transactions')) {
      return fulfill(route, url.searchParams.has('page')
        ? { items: [transaction], total: 1, page: 1, pageSize: Number(url.searchParams.get('pageSize') || 25) }
        : [transaction])
    }
    if (pathname.endsWith('/investments/portfolio')) return fulfill(route, emptyInvestmentPortfolio)
    if (pathname.endsWith('/investments/transactions')) return fulfill(route, { items: [], total: 0, page: 1, pageSize: 10 })
    if (pathname.endsWith('/investments/cash-flows')) return fulfill(route, { items: [], total: 0, page: 1, pageSize: 10 })
    if (pathname.endsWith('/investments/allocation')) {
      return fulfill(route, emptyInvestmentAllocation)
    }
    if (route.request().method() === 'GET') return fulfill(route, [])
    return fulfill(route, {})
  })
}

/**
 * Waits until the document stops growing.
 *
 * `toHaveScreenshot` stabilises by comparing consecutive captures, which is not the same as waiting
 * for the page to finish settling: the dashboard reaches its first quiet moment ~137px short of its
 * final height, and two captures taken inside that window agree with each other. The baseline was
 * pinned to that pre-settled frame, so any change to load timing — a padding change was enough —
 * flipped the capture to the settled height and read as a 137px regression that no diff explained.
 */
async function waitForStableLayout(page: Page) {
  await expect.poll(async () => {
    const first = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.waitForTimeout(150)
    const second = await page.evaluate(() => document.documentElement.scrollHeight)
    return first === second ? second : -1
  }, { timeout: 10_000 }).toBeGreaterThan(0)
}

async function establishSession(page: Page) {
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

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
})

test('authentication required validation', async ({ page }) => {
  await mockApi(page, { registered: false })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Username is required.')).toBeVisible()
  await expect(page).toHaveScreenshot('auth-required-errors.png', { fullPage: true })
})

test('authentication workflow error', async ({ page }) => {
  await mockApi(page, { failStatus: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Could not connect to the backend server/i)).toBeVisible()
  await expect(page).toHaveScreenshot('auth-workflow-error.png', { fullPage: true })
})

test('representative dashboard', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await waitForStableLayout(page)
  await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true })
})

test('mixed input select date form sheet', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer')).toBeVisible()
  await page.getByRole('button', { name: /Post Transaction/i }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  await expect(dialog).toBeVisible()
  const dimensions = await dialog.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    renderedWidth: element.getBoundingClientRect().width,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  expect(dimensions.renderedWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
  await expect(page).toHaveScreenshot('transaction-form-sheet.png')
})

test('destructive confirmation sheet', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer')).toBeVisible()
  await page.getByRole('button', { name: 'Delete' }).first().dispatchEvent('click')
  const dialog = page.getByRole('dialog', { name: 'Confirm Deletion' })
  await expect(dialog).toBeVisible()
  const dimensions = await dialog.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    renderedWidth: element.getBoundingClientRect().width,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  expect(dimensions.renderedWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
  await expect(page).toHaveScreenshot('destructive-confirmation.png')
})

test('production routes do not create viewport horizontal overflow', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)

  for (const route of ['/dashboard', '/reports', '/recurring', '/ledger', '/wishlist', '/settings', '/investments', '/vault']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await page.waitForFunction(() => document.fonts.status === 'loaded')

    const dimensions = await page.evaluate(() => ({
      route: window.location.pathname,
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    }))

    expect(
      dimensions.pageWidth,
      `${dimensions.route} is ${dimensions.pageWidth - dimensions.viewportWidth}px wider than its viewport`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  }
})

test('vault controls stay beside the results and selection actions do not shift them', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, { documents: vaultDocuments })
  const vaultUrl = process.env.VAULT_VISUAL_BASE_URL
    ? new URL('/vault', process.env.VAULT_VISUAL_BASE_URL).toString()
    : '/vault'
  await page.goto(vaultUrl, { waitUntil: 'domcontentloaded' })

  const documentsRegion = page.getByRole('region', { name: 'Your documents' })
  await expect(documentsRegion).toBeVisible()
  await expect(documentsRegion.getByPlaceholder('Search file names or notes...')).toHaveCount(0)
  await expect(documentsRegion.getByRole('combobox', { name: 'Sort vault documents' })).toBeVisible()
  await expect(documentsRegion.getByRole('combobox', { name: 'Filter by tax year' })).toBeVisible()

  const filterBar = documentsRegion.getByTestId('document-filter-bar')
  const toolbar = documentsRegion.getByTestId('document-selection-toolbar')
  const results = documentsRegion.getByTestId('document-results')

  // Selection is opt-in, so the reserved-slot invariant this test guards is scoped to *within* the
  // mode: entering it is a deliberate tap that may reshape the toolbar, but ticking a box afterwards
  // must not shift the results by a pixel. Measuring from before the mode existed would be asserting
  // that a mode switch is invisible, which is not the promise.
  await expect(documentsRegion.getByRole('checkbox', { name: 'Select all documents on this page' })).toHaveCount(0)
  await documentsRegion.getByRole('button', { name: 'Select' }).click()
  const selectAll = documentsRegion.getByRole('checkbox', { name: 'Select all documents on this page' })
  await expect(selectAll).toBeVisible()
  const before = await page.evaluate(() => {
    const filter = document.querySelector<HTMLElement>('[data-testid="document-filter-bar"]')!
    const selection = document.querySelector<HTMLElement>('[data-testid="document-selection-toolbar"]')!
    const documentResults = document.querySelector<HTMLElement>('[data-testid="document-results"]')!
    return {
      filterBottom: filter.getBoundingClientRect().bottom,
      toolbarTop: selection.getBoundingClientRect().top,
      toolbarHeight: selection.getBoundingClientRect().height,
      resultsTop: documentResults.getBoundingClientRect().top,
    }
  })
  expect(before.toolbarTop - before.filterBottom).toBeLessThanOrEqual(16)

  await selectAll.check()
  await expect(documentsRegion.getByRole('button', { name: 'Download selected documents' })).toBeVisible()
  await expect(documentsRegion.getByRole('button', { name: 'Delete selected documents' })).toBeVisible()
  await expect(toolbar.getByText('2 selected')).toBeVisible()

  const after = await page.evaluate(() => {
    const filter = document.querySelector<HTMLElement>('[data-testid="document-filter-bar"]')!
    const selection = document.querySelector<HTMLElement>('[data-testid="document-selection-toolbar"]')!
    const documentResults = document.querySelector<HTMLElement>('[data-testid="document-results"]')!
    return {
      filterBottom: filter.getBoundingClientRect().bottom,
      toolbarTop: selection.getBoundingClientRect().top,
      toolbarHeight: selection.getBoundingClientRect().height,
      resultsTop: documentResults.getBoundingClientRect().top,
    }
  })
  expect(after.toolbarTop - after.filterBottom).toBeCloseTo(before.toolbarTop - before.filterBottom, 0)
  expect(after.toolbarHeight).toBeCloseTo(before.toolbarHeight, 0)
  expect(after.resultsTop - after.toolbarTop).toBeCloseTo(before.resultsTop - before.toolbarTop, 0)
  await expect(filterBar).toBeVisible()
  await expect(results).toBeVisible()
})

test('rewards rail responds to a desktop mouse wheel and releases page scrolling at its edge', async ({ page }) => {
  const rewardItems: WishlistItem[] = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    name: `Reward ${index + 1}`,
    price: 100 + index * 25,
    priority: index === 0 ? 'High' : 'Medium',
    isPurchased: false,
    createdAt: `2026-07-${String(index + 1).padStart(2, '0')}`,
    isActive: index === 0,
  }))

  await establishSession(page)
  await mockApi(page, { wishlist: rewardItems })
  // Keep the desktop width while making the page tall enough to prove the edge handoff.
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/wishlist', { waitUntil: 'domcontentloaded' })

  const rail = page.getByRole('group', { name: 'Rewards' })
  await expect(rail).toBeVisible()
  const dimensions = await rail.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth)

  await rail.scrollIntoViewIfNeeded()
  const box = await rail.boundingBox()
  if (!box) throw new Error('Rewards rail did not have a layout box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  await expect(rail).toHaveCSS('scroll-snap-type', 'none')
  await page.mouse.wheel(0, 100)
  await expect.poll(() => rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)

  await rail.evaluate(element => { element.scrollLeft = element.scrollWidth })

  // Put the page somewhere it can actually move from, rather than trusting where scrolling the rail
  // into view happened to leave it. The rail sits at the bottom of Rewards, so bringing it into view
  // pins the page at its end — and a page that cannot scroll is indistinguishable from a rail that
  // refused to hand the wheel over, which is the whole point of the assertion below. This used to
  // pass on 32px of incidental headroom, so a content change worth 100px of page height broke it
  // while the handoff itself still worked.
  const EDGE_HANDOFF_HEADROOM = 120
  await page.evaluate(headroom => {
    window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight - headroom))
  }, EDGE_HANDOFF_HEADROOM)

  // The page moved, so the rail did too; re-read it and hover a point inside both the rail and the
  // viewport. Hovering outside the rail would let the wheel reach the page directly and pass for the
  // wrong reason. `rail.hover()` is not usable here — it would scroll the rail back into view.
  const edgeBox = await rail.boundingBox()
  if (!edgeBox) throw new Error('Rewards rail did not have a layout box at the page edge')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Viewport size was unavailable')
  const hoverY = Math.min(edgeBox.y + edgeBox.height / 2, viewport.height - 4)
  expect(hoverY, 'the hover point must sit inside the rail').toBeGreaterThan(edgeBox.y)
  await page.mouse.move(edgeBox.x + edgeBox.width / 2, hoverY)

  const pageOffsetBeforeEdgeWheel = await page.evaluate(() => window.scrollY)
  const remainingPageScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
  )
  expect(remainingPageScroll, 'the page needs somewhere to scroll for the handoff to be observable').toBeGreaterThan(0)

  await page.mouse.wheel(0, 240)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(pageOffsetBeforeEdgeWheel)
})

