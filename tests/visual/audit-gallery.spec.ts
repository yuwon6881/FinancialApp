import { expect, test, type Page } from '@playwright/test'
import {
  establishSession,
  mockApi,
  seedDraftTransaction,
  stabilityRecoveryFixture,
  vaultDocuments,
  waitForStableLayout,
} from './visualTestSupport'

/**
 * Evidence gallery for the responsive audit. Not a regression baseline: it writes plain PNGs to
 * `test-results/audit-gallery/` so every page can be checked by eye at each width, scrolled to the
 * top and to the bottom, with a frozen clock and a session that is proven live before each capture.
 * Run it on demand: `AUDIT_GALLERY=1 npx playwright test audit-gallery`.
 */
test.skip(!process.env.AUDIT_GALLERY, 'Evidence gallery runs only when AUDIT_GALLERY is set.')

const scenario = {
  dashboard: {
    categories: [
      { id: 'essentials', name: 'Essentials', allocation: 0.5, target: 3_100, incomeAllocated: 3_100, budget: 3_100, netChange: -227.5, spent: 227.5, remaining: 2_872.5 },
      { id: 'growth', name: 'Growth', allocation: 0.25, target: 1_550, incomeAllocated: 1_550, budget: 1_550, netChange: 6_200, spent: 0, remaining: 7_750 },
      { id: 'stability', name: 'Stability', allocation: 0.15, target: 930, incomeAllocated: 930, budget: 930, netChange: 500, spent: 0, remaining: 4_354.98 },
      { id: 'rewards', name: 'Rewards', allocation: 0.1, target: 620, incomeAllocated: 620, budget: 620, netChange: -24, spent: 24, remaining: 1_226 },
    ],
    categoryLimitProgress: [
      { category: 'Food & Dining', spent: 142.5, limit: 1_200, remaining: 1_057.5, pendingCommitted: 0, percentUsed: 0.119, projectedSpend: 1_472.5, status: 'Watch' },
    ],
  },
  recurringPayments: [
    { id: 'tnb', name: 'Tenaga Nasional Electricity', amount: 215.4, frequency: 'Monthly', category: 'Bills & Utilities', ledgerCategory: 'Essentials', accountId: 'account-visual-essentials', nextDueDate: '2026-08-18', dueDate: 18, startDate: '2026-01-18', active: true, paymentMode: 'Manual', reminderEnabled: true, reminderMode: 'Once', reminderLeadDays: 3 },
    { id: 'unifi', name: 'Unifi High-Speed Fiber', amount: 149, frequency: 'Monthly', category: 'Bills & Utilities', ledgerCategory: 'Essentials', accountId: 'account-visual-essentials', nextDueDate: '2026-08-15', dueDate: 15, startDate: '2026-01-15', active: true, paymentMode: 'Manual', reminderEnabled: false, reminderMode: 'Once', reminderLeadDays: 3 },
    { id: 'ptptn', name: 'PTPTN Student Loan', amount: 94.29, frequency: 'Monthly', category: 'Loan', ledgerCategory: 'Essentials', accountId: 'account-visual-essentials', nextDueDate: '2026-08-28', dueDate: 28, startDate: '2026-07-28', active: true, paymentMode: 'Manual', linkedLoanId: 'ptptn-loan', linkedLoanName: 'PTPTN Student Loan', reminderEnabled: false, reminderMode: 'Once', reminderLeadDays: 3 },
  ],
  loans: [{
    id: 'ptptn-loan', name: 'PTPTN Student Loan', recurringPaymentId: 'ptptn',
    openingPrincipal: 12_000, trackingStartDate: '2026-07-28', annualRatePercent: 1,
    termPeriods: 120, interestMethod: 'ReducingBalance',
    snapshot: { outstandingBalance: 12_000, scheduledPayment: 94.29, totalScheduledInterest: 0, totalInterestPaid: 0, payments: [], futureSchedule: [] },
  }],
  savingsGoals: [
    { id: 1, name: 'Emergency Laptop Replacement', targetAmount: 3_200, earmarkedAmount: 1_800, fundingBucket: 'Rewards', targetDate: '2026-12-01', priority: 'High', status: 'active', isRecurring: false, recurrenceMonths: 12, cycleFundedAmount: 0, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 2, name: 'Kyoto Spring Holiday', targetAmount: 8_500, earmarkedAmount: 3_400, fundingBucket: 'Rewards', targetDate: '2027-04-01', priority: 'Medium', status: 'active', isRecurring: false, recurrenceMonths: 12, cycleFundedAmount: 0, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  wishlist: [
    { id: 7, name: 'Sony WH-1000XM5 Headphones', price: 1_499, priority: 'High', isPurchased: false, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  pendingNotifications: [{
    id: 'unifi-2026-07', recurringPaymentId: 'unifi', name: 'Unifi High-Speed Fiber', amount: 149,
    category: 'Bills & Utilities', ledgerCategory: 'Essentials', billingDate: '2026-07-15',
    year: 2026, month: 7, cycleLabel: 'Jun 28th ~ Jul 27th, 2026',
  }],
  transactions: [
    { id: 'tx-1', accountId: 'account-visual-essentials', date: '2026-07-29', description: 'Village Grocer Kiara', category: 'Food & Dining', ledgerCategory: 'Essentials', amount: -142.5 },
    { id: 'tx-2', accountId: 'account-visual-growth', date: '2026-07-28', description: 'Monthly Tech Salary', category: 'Monthly Salary', ledgerCategory: 'Growth', amount: 6_200 },
    { id: 'tx-3', accountId: 'account-visual-essentials', date: '2026-07-28', description: 'Shell Petrol Station', category: 'Transport & Fuel', ledgerCategory: 'Essentials', amount: -85 },
  ],
  categories: [
    { id: 'bills', name: 'Bills & Utilities', type: 'outflow' },
    { id: 'food', name: 'Food & Dining', type: 'outflow' },
    { id: 'salary', name: 'Monthly Salary', type: 'both' },
    { id: 'transport', name: 'Transport & Fuel', type: 'outflow' },
  ],
  documents: vaultDocuments,
  stabilityRecovery: stabilityRecoveryFixture,
}

const routes = [
  ['dashboard', '/dashboard'],
  ['ledger', '/ledger'],
  ['drafts', '/drafts'],
  ['budget', '/plan/budget'],
  ['bills', '/plan/bills'],
  ['loans', '/plan/loans'],
  ['goals', '/plan/goals'],
  ['accounts', '/wealth/accounts'],
  ['investments', '/wealth/investments'],
  ['vault', '/wealth/vault'],
  ['reports', '/reports'],
  ['settings', '/settings'],
] as const

async function openLive(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()
  // A capture is only evidence when it shows the signed-in app, not a login or crash screen.
  await expect(page.getByRole('heading', { name: /Welcome back|Create your account/ })).toHaveCount(0)
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await page.waitForFunction(() => document.fonts.status === 'loaded')
  await waitForStableLayout(page)
}

async function shoot(page: Page, name: string) {
  const project = test.info().project.name
  await page.screenshot({ path: `${process.env.AUDIT_GALLERY_DIR ?? 'test-results/audit-gallery'}/${project}/${name}.png` })
}

test.beforeEach(async ({ page }) => {
  test.skip(!/^(mobile|medium|desktop)-light$/.test(test.info().project.name), 'Light theme at the three audit widths.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  await seedDraftTransaction(page)
  await mockApi(page, scenario as Parameters<typeof mockApi>[1])
})

for (const [name, path] of routes) {
  test(`gallery: ${name}`, async ({ page }) => {
    await openLive(page, path)
    await shoot(page, `${name}-top`)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(200)
    await shoot(page, `${name}-bottom`)
  })
}

test('gallery: settings sub-panels', async ({ page }) => {
  await openLive(page, '/settings')
  for (const tab of await page.getByRole('tab').all()) {
    const label = ((await tab.textContent()) ?? 'tab').trim().toLowerCase().replace(/[^a-z]+/g, '-')
    await tab.click()
    await waitForStableLayout(page)
    await shoot(page, `settings-tab-${label}`)
  }
  await openLive(page, '/plan/budget')
  await page.getByRole('tab', { name: /Categories/ }).click()
  await waitForStableLayout(page)
  await shoot(page, 'budget-categories')
})

test('gallery: account coverage gate', async ({ page }) => {
  await mockApi(page, { ...(scenario as Parameters<typeof mockApi>[1]), accounts: [] })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Set up your four accounts' })).toBeVisible()
  await waitForStableLayout(page)
  await shoot(page, 'coverage-gate-top')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await shoot(page, 'coverage-gate-bottom')
})

test('gallery: pending bills', async ({ page }) => {
  await openLive(page, '/dashboard')
  const reviewButton = page.getByRole('button', { name: /^(Review 1 pending bills|Bills to review, 1)$/ })
  if (await reviewButton.count()) {
    await reviewButton.first().click()
    await shoot(page, 'overlay-pending-bills')
    await page.keyboard.press('Escape')
  }
})

test('gallery: transaction entry', async ({ page }) => {
  const phone = (page.viewportSize()?.width ?? 0) < 640
  await openLive(page, '/ledger')
  if (phone) {
    await page.getByRole('button', { name: 'Quick add', exact: true }).click()
    await shoot(page, 'overlay-quick-add')
    await page.getByRole('menuitem', { name: /Expense/ }).click()
  } else {
    await page.getByRole('button', { name: /Post Transaction/i }).first().click()
  }
  await page.waitForTimeout(300)
  await shoot(page, 'overlay-transaction-form')
})
