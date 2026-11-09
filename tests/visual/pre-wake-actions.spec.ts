import { expect, test, type Locator, type Page } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'
import { SENSITIVE_AMOUNT_MASK } from '../../src/lib/utils'

const CACHED_ACCOUNTS = ['Essentials', 'Growth', 'Stability', 'Rewards'].map((bucket, index) => ({
  id: `account-visual-${bucket.toLowerCase()}`,
  name: ['Everyday bank', 'Investment account', 'Emergency fund', 'Fun money'][index],
  bucket,
  kind: 'Bank',
  interestEnabled: false,
  interestRatePercent: 0,
  interestFrequency: 'Monthly',
  isArchived: false,
  remaining: 1500,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}))

const CACHED_CATEGORIES = [
  { id: 'food', name: 'Food', type: 'outflow' },
  { id: 'salary', name: 'Salary', type: 'inflow' },
]

const BUCKET_SUMMARIES = [
  { id: 'essentials', name: 'Essentials', allocation: 0.5, target: 800, incomeAllocated: 0, budget: 800, netChange: -86.4, spent: 86.4, remaining: 713.6 },
  { id: 'growth', name: 'Growth', allocation: 0.25, target: 400, incomeAllocated: 0, budget: 400, netChange: 0, spent: 0, remaining: 400 },
  { id: 'stability', name: 'Stability', allocation: 0.15, target: 240, incomeAllocated: 0, budget: 240, netChange: 0, spent: 0, remaining: 1000 },
  { id: 'rewards', name: 'Rewards', allocation: 0.1, target: 160, incomeAllocated: 0, budget: 160, netChange: 0, spent: 0, remaining: 160 },
]

const CACHED_DASHBOARD = {
  setting: {
    targetStabilityFund: 10_000,
    selectedMonth: 'Jul',
    selectedYear: 2026,
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    darkMode: false,
    hideSensitive: true,
    currency: 'MYR',
    stabilityOverflowRedirect: 'Split: Growth 50%, Rewards 50%',
  },
  cycleLabel: 'Jul 2026',
  categories: BUCKET_SUMMARIES,
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

async function seedReturningUserCaches(page: Page) {
  await establishSession(page)
  await page.addInitScript(({ accounts, categories, dashboard }) => {
    const now = Date.now().toString()
    localStorage.setItem('financial_account_tracking_cache_version', '4')
    localStorage.setItem('cached_ledger_accounts', JSON.stringify(accounts))
    localStorage.setItem('cached_ledger_accounts:cached_at', now)
    localStorage.setItem('cached_categories', JSON.stringify(categories))
    localStorage.setItem('cached_categories:cached_at', now)
    localStorage.setItem('cached_dashboard_data', JSON.stringify(dashboard))
    localStorage.setItem('cached_dashboard_data:cached_at', now)
  }, { accounts: CACHED_ACCOUNTS, categories: CACHED_CATEGORIES, dashboard: CACHED_DASHBOARD })
}

async function gateBootstrap(page: Page) {
  let release!: () => void
  let released = false
  const gate = new Promise<void>(resolve => {
    release = () => {
      if (released) return
      released = true
      resolve()
    }
  })

  let bootstrapRequests = 0
  await page.route(url => url.pathname.endsWith('/bootstrap'), async route => {
    bootstrapRequests += 1
    await gate
    await route.fallback()
  })

  return {
    release,
    getRequestCount: () => bootstrapRequests,
  }
}

async function assertHitTarget(page: Page, locator: Locator) {
  await expect(locator).toBeVisible()
  await locator.click({ trial: true })
  const minHeight = (page.viewportSize()?.width ?? 0) < 1024 ? 44 : 36
  const hit = await locator.evaluate(element => {
    const box = element.getBoundingClientRect()
    return {
      height: box.height,
      width: box.width,
      receivesPointer: element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
    }
  })
  expect(hit.height).toBeGreaterThanOrEqual(minHeight)
  expect(hit.width).toBeGreaterThan(0)
  expect(hit.receivesPointer).toBe(true)
}

async function seedNativePreWakeCapture(page: Page) {
  await seedReturningUserCaches(page)
  await page.addInitScript(() => {
    localStorage.setItem('financialapp.permissionSetup.v1', 'completed')
    const candidate: Record<string, unknown> = {
      id: 'cap-prewake',
      transactionId: '22222222-2222-4222-8222-222222222222',
      sourcePackage: 'bank.example',
      sourceLabel: 'Example bank',
      capturedAt: Date.now(),
      excerpt: 'Paid MYR 42.90 at BAKERY MART',
      amount: '42.90',
      currency: 'MYR',
      description: 'BAKERY MART',
      transactionType: 'outflow',
      possibleDuplicate: false,
    }
    let completed = false
    const captureListeners = new Map<string, (event: { isActive: boolean }) => void>()
    let listenerId = 0
    const methods: Record<string, string[]> = {
      PurchaseCapture: ['activate', 'state', 'reconnect', 'configure', 'applications', 'consumeTap', 'update', 'openAccessSettings', 'requestNotifications', 'openNotificationSettings', 'openBatterySettings', 'wipe'],
      SecureStorage: ['internalGetItem', 'internalSetItem', 'internalRemoveItem', 'getPrefixedKeys', 'setSynchronizeKeychain'],
      PrivacyScreen: ['setHidden'], App: ['getState'], SplashScreen: ['hide'], StatusBar: ['setStyle', 'setBackgroundColor'], Keyboard: ['setResizeMode'], BiometricAuthNative: ['checkBiometry', 'internalAuthenticate'],
    }
    const win = window as unknown as { CapacitorCustomPlatform: unknown; Capacitor: unknown; unlockDevice?: () => void }
    win.CapacitorCustomPlatform = { name: 'android' }
    win.Capacitor = {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({
        name,
        methods: [...names.map(method => ({ name: method, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }],
      })),
      nativeCallback: (plugin: string, method: string, options: Record<string, unknown>, callback: (event: { isActive: boolean }) => void) => {
        const id = String(++listenerId)
        if (plugin === 'PurchaseCapture' && method === 'addListener' && options.eventName === 'changed') {
          captureListeners.set(id, callback)
        }
        return id
      },
      nativePromise: async (plugin: string, method: string, options: Record<string, unknown> = {}) => {
        if (plugin === 'SecureStorage' && method === 'internalGetItem') {
          return { data: String(options.prefixedKey).endsWith('auth_token') ? JSON.stringify('visual-token') : null }
        }
        if (method === 'removeListener') captureListeners.delete(String(options.callbackId))
        if (plugin === 'App' && method === 'getState') return { isActive: true }
        if (plugin === 'BiometricAuthNative' && method === 'checkBiometry') {
          return { isAvailable: true, deviceIsSecure: true, biometryType: 1, biometryTypes: [1] }
        }
        if (plugin === 'BiometricAuthNative') {
          return new Promise(resolve => {
            win.unlockDevice = () => resolve({})
          })
        }
        if (plugin !== 'PurchaseCapture') return {}
        if (method === 'state') {
          return {
            enabled: true,
            packages: ['bank.example'],
            candidates: completed ? [] : [candidate],
            access: true,
            notifications: true,
            batteryUnrestricted: true,
            listenerConnected: true,
          }
        }
        if (method === 'applications') return { applications: [{ packageName: 'bank.example', label: 'Example bank' }] }
        if (method === 'update') {
          if (options.action === 'complete' || options.action === 'discard') completed = true
          return candidate
        }
        return {}
      },
    }
  })
}

test('pre-wake transaction creation stays open across bootstrap hideSensitive resolution and stages a session-safe draft', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await seedReturningUserCaches(page)
  await mockApi(page, {
    setting: { hideSensitive: true },
    dashboard: { categories: BUCKET_SUMMARIES },
  })
  const bootstrap = await gateBootstrap(page)

  try {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    const privacyPill = page.getByTestId('privacy-status')
    await expect(privacyPill).toContainText('Protecting your amounts')
    await expect.poll(() => bootstrap.getRequestCount()).toBeGreaterThanOrEqual(1)

    if ((page.viewportSize()?.width ?? 0) < 640) {
      const quickAdd = page.getByRole('button', { name: 'Quick add', exact: true })
      await assertHitTarget(page, quickAdd)
      await quickAdd.click()

      const quickAddSheet = page.getByRole('dialog', { name: 'Quick add' })
      await expect(quickAddSheet).toBeVisible()
      const expenseTile = quickAddSheet.getByRole('menuitem', { name: /^Expense/ })
      await expect(expenseTile).toBeEnabled()
      await assertHitTarget(page, expenseTile)
      await expenseTile.click()
    } else {
      const newTx = page.getByRole('button', { name: 'New transaction', exact: true })
      await assertHitTarget(page, newTx)
      await newTx.click()
    }

    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add Transaction' }) })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Finishing security check', { exact: false })).toHaveCount(0)

    const amountInput = dialog.getByPlaceholder('0.00')
    const descriptionInput = dialog.getByPlaceholder(/Grocery Store/i)
    await amountInput.fill('18.50')
    await descriptionInput.fill('Pre-wake espresso')
    await dialog.getByRole('radio', { name: 'Food' }).click()
    await dialog.getByRole('radio', { name: 'Essentials' }).click()

    // Bucket impact remains masked while server response is still pending.
    await expect(dialog.getByRole('img', { name: 'Sensitive amount hidden' }).first()).toBeVisible()
    await expect(dialog).not.toContainText('713.6')
    await expect(dialog).not.toContainText('695.1')
    expect(await dialog.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false)

    const saveButton = dialog.getByRole('button', { name: 'Add Transaction', exact: true })
    await assertHitTarget(page, saveButton)

    // Resolve /api/bootstrap with hideSensitive: true while user is in the middle of entering the transaction.
    bootstrap.release()
    await expect(privacyPill).toBeHidden()

    // Form must remain open with typed values preserved and bucket balance masked.
    await expect(dialog).toBeVisible()
    await expect(descriptionInput).toHaveValue('Pre-wake espresso')
    await expect(amountInput).toHaveValue('18.50')
    await expect(dialog.getByRole('img', { name: 'Sensitive amount hidden' }).first()).toBeVisible()
    await expect(dialog).not.toContainText('713.6')

    await saveButton.click()

    // Stage flow navigates to Review drafts while amounts remain masked.
    await expect(page.getByRole('heading', { name: 'Review drafts', level: 1 })).toBeVisible()
    await expect(page.getByText('Pre-wake espresso')).toBeVisible()
    await expect(page.locator('#main-content')).not.toContainText('18.50')

    // Session-safe draft created in this session stays editable / operable while hideSensitive is true.
    await assertHitTarget(page, page.getByRole('button', { name: 'Add draft', exact: true }))
    const addToLedgerBtn = page.getByRole('button', { name: 'Add 1 draft to Ledger', exact: true })
    await assertHitTarget(page, addToLedgerBtn)

    if ((page.viewportSize()?.width ?? 0) >= 640) {
      const editDraft = page.locator('button[aria-label="Edit Pre-wake espresso"]:visible')
      await assertHitTarget(page, editDraft)
      await editDraft.click()

      const editSheet = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit Draft' }) })
      await expect(editSheet).toBeVisible()
      await assertHitTarget(page, editSheet.getByRole('button', { name: 'Save Draft', exact: true }))
      await editSheet.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(editSheet).toBeHidden()
    }
  } finally {
    bootstrap.release()
  }

  expect(pageErrors).toEqual([])
})

test('detected transaction review and discard work pre-wake and across hideSensitive resolution without exposing amounts', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await seedNativePreWakeCapture(page)
  await mockApi(page, {
    setting: { hideSensitive: true },
    dashboard: { categories: BUCKET_SUMMARIES },
  })
  const bootstrap = await gateBootstrap(page)

  try {
    await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).toBeVisible()
    await page.waitForFunction(() => typeof (window as unknown as { unlockDevice?: unknown }).unlockDevice === 'function')
    await page.evaluate(() => (window as unknown as { unlockDevice: () => void }).unlockDevice())

    const privacyPill = page.getByTestId('privacy-status')
    await expect(privacyPill).toContainText('Protecting your amounts')

    const reviewBannerBtn = page.getByRole('button', { name: 'Review 1 detected transaction', exact: true })
    await assertHitTarget(page, reviewBannerBtn)
    await reviewBannerBtn.click()

    const sheet = page.getByRole('dialog', { name: 'Detected transactions' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('BAKERY MART', { exact: true })).toBeVisible()
    await expect(sheet.getByText(SENSITIVE_AMOUNT_MASK)).toBeVisible()
    await expect(sheet).not.toContainText('42.90')

    const reviewCandidateBtn = sheet.getByRole('button', { name: 'Review BAKERY MART', exact: true })
    await assertHitTarget(page, reviewCandidateBtn)
    await reviewCandidateBtn.click()

    const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Review Detected Transaction' }) })
    await expect(form).toBeVisible()
    await expect(form.getByRole('textbox', { name: /description/i })).toHaveValue('BAKERY MART')
    // CapturedAlertNotice excerpt stays hidden under sensitive mode.
    await expect(form.getByText('Detected from Example bank')).toHaveCount(0)
    await expect(form).not.toContainText('42.90')

    // Bootstrap resolves hideSensitive: true while review form is open.
    bootstrap.release()
    await expect(privacyPill).toBeHidden()
    await expect(form).toBeVisible()
    await expect(form.getByRole('textbox', { name: /description/i })).toHaveValue('BAKERY MART')
    expect(await form.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false)

    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(form).toBeHidden()

    await reviewBannerBtn.click()
    const discardBtn = sheet.getByRole('button', { name: 'Discard', exact: true })
    await assertHitTarget(page, discardBtn)
    await discardBtn.click()
    await expect(sheet.getByText('You’re all caught up')).toBeVisible()
  } finally {
    bootstrap.release()
  }

  expect(pageErrors).toEqual([])
})

test('quick add and ledger toolbar allow safe new transactions while resolved sensitive mode keeps secondary mutations disabled', async ({ page }) => {
  await seedReturningUserCaches(page)
  await mockApi(page, {
    setting: { hideSensitive: true },
    dashboard: { categories: BUCKET_SUMMARIES },
  })

  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('privacy-status')).toBeHidden()

  if ((page.viewportSize()?.width ?? 0) < 640) {
    const quickAdd = page.getByRole('button', { name: 'Quick add', exact: true })
    await assertHitTarget(page, quickAdd)
    await quickAdd.click()

    const sheet = page.getByRole('dialog', { name: 'Quick add' })
    await expect(sheet.getByRole('menuitem', { name: /^Expense/ })).toBeEnabled()
    await expect(sheet.getByRole('menuitem', { name: /^Income/ })).toBeEnabled()
    await expect(sheet.getByRole('menuitem', { name: /^Transfer/ })).toBeEnabled()

    await expect(sheet.getByRole('menuitem', { name: /^Scan receipt/ })).toBeDisabled()
    await expect(sheet.getByRole('menuitem', { name: /^New bill/ })).toBeDisabled()
    await expect(sheet.getByRole('menuitem', { name: /^New reward/ })).toBeDisabled()
    await expect(sheet.getByRole('menuitem', { name: /^Investment/ })).toBeDisabled()
  } else {
    const postBtn = page.getByRole('button', { name: 'Post Transaction', exact: true })
    await expect(postBtn).toBeEnabled()
    await assertHitTarget(page, postBtn)
    await postBtn.click()

    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add Transaction' }) })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})
