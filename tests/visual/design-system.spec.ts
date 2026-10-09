import { expect, test } from '@playwright/test'
import { coveredRecovery } from './recoveryFixtures'

import type { InvestmentActivity, SavingsGoal, WishlistItem } from '../../src/types'
import {
  establishSession,
  mockApi,
  stabilityRecoveryFixture,
  waitForStableLayout,
  openTransactionForm,
} from './visualTestSupport'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
})

test('covered recovery shows completed spending cycles without a countdown', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, { stabilityRecovery: coveredRecovery })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'See recovery details' }).click()
  const dialog = page.getByRole('dialog', { name: 'Emergency fund recovery details' })
  await expect(dialog.getByText('This cycle covered')).toBeVisible()
  await waitForStableLayout(page)
  await expect(dialog).toHaveScreenshot('stability-recovery-covered.png')
})

async function openGlobalSearch(page: import('@playwright/test').Page) {
  // The phone top bar and the sidebar both carry search directly.
  await page.getByRole('button', { name: 'Search your records' }).click()
}

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

test('sensitive-mode verification gives the password and device choices a clear order', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-light', 'A single compact baseline covers the verification sheet.')
  await establishSession(page)
  await page.addInitScript(() => {
    localStorage.setItem('fingerprint_credential_id_on_this_device:VISUAL-USER', '01020304')
    if (window.PublicKeyCredential) {
      Object.defineProperty(window.PublicKeyCredential, 'isUserVerifyingPlatformAuthenticatorAvailable', {
        configurable: true,
        value: async () => true,
      })
    }
  })
  await mockApi(page, { setting: { hideSensitive: true } })
  await page.route('**/api/auth/status*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      isRegistered: true,
      hasFingerprint: true,
      hasFingerprintOnDevice: true,
      registrationOpen: false,
    }),
  }))
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Show Sensitive' }).click()

  const dialog = page.getByRole('dialog', { name: 'Verify identity' })
  await expect(dialog).toBeVisible()
  const password = dialog.getByPlaceholder('Enter password')
  const deviceUnlock = dialog.getByRole('button', { name: 'Unlock with device' })
  await expect(password).toBeVisible()
  await expect(deviceUnlock).toBeVisible()
  const passwordBox = await password.boundingBox()
  const deviceUnlockBox = await deviceUnlock.boundingBox()
  expect(passwordBox).not.toBeNull()
  expect(deviceUnlockBox).not.toBeNull()
  expect(deviceUnlockBox!.y).toBeGreaterThan(passwordBox!.y)
  await expect(dialog).toHaveScreenshot('sensitive-mode-verification-modal.png')
})

test('representative dashboard', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await waitForStableLayout(page)
  await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true })
})

test('canonical Lumen interface specimen', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ui-specimen', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Lumen interface' })).toBeVisible()
  await waitForStableLayout(page)
  await expect(page).toHaveScreenshot('lumen-interface-specimen.png', { fullPage: true })
})

// The three reported figures are one subtraction and are only legible if they read as adjacent
// rows. The dashboard keeps that secondary detail out of the default card; the button opens a
// contained sheet with the same breakdown at phone width.
test('emergency fund recovery card reads as one subtraction', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, { stabilityRecovery: stabilityRecoveryFixture })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  const card = page.getByRole('region', { name: /Emergency fund recovery/ })
  await expect(card).toBeVisible()
  if (test.info().project.name === 'mobile-light' || test.info().project.name === 'mobile-dark') {
    await expect(card).toHaveScreenshot('stability-recovery-plan-card.png')
  }
  await expect(card.getByText('Withdrawals still being repaid')).toHaveCount(0)
  await card.getByRole('button', { name: 'See recovery details' }).click()
  const dialog = page.getByRole('dialog', { name: 'Emergency fund recovery details' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Total still to put back')).toBeVisible()
  await waitForStableLayout(page)

  await expect(dialog).toHaveScreenshot('stability-recovery-card.png')
})

// The cycle the money left in: the plan is known, it just has not opened. The card has to report
// the shortfall without asking for a share of it, and without the emerald "ahead of plan" badge
// that every other zero-ask cycle earns.
test('emergency fund recovery card reports a plan that starts next cycle', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, {
    stabilityRecovery: {
      ...stabilityRecoveryFixture,
      isDeferred: true,
      toppedUpThisCycle: 0,
      requiredThisCycle: 0,
      outstandingThisCycle: 0,
      recoveryCohorts: [{
        originCycleKey: '2026-08',
        fromDate: '2026-08-09',
        transactionCount: 2,
        remainingShortfall: 351.77,
        cyclesRemaining: 3,
        requiredThisCycle: 0,
        isOverdue: false,
        isDeferred: true,
      }],
    },
  })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  const card = page.getByRole('region', { name: /Emergency fund recovery/ })
  // Exact: the sentence under the badge says "starts next cycle" too.
  await expect(card.getByText('Starts next cycle', { exact: true })).toBeVisible()
  await expect(card.getByText(/recovery starts next cycle/)).toBeVisible()
  await waitForStableLayout(page)

  await expect(card).toHaveScreenshot('stability-recovery-deferred.png')
})

// The route-level commitments-rewards baselines are all captured with no savings goals, so the
// pool card's active state -- the claim tiles, the outstanding wording, the cycle pacing line --
// appeared in none of them. Scoped to the card, so one line moving is a real share of the image
// rather than the fraction of a page the suite's diff tolerance is built to absorb.
//
// Nothing is earmarked, because every bucket in the shared fixture holds a zero balance and
// `mockApi` exposes no accounts override: any positive earmark would render the over-committed
// error instead, which is a state this fixture cannot reach honestly. Covering the funded and
// over-committed variants needs a dashboard fixture that gives Rewards a real balance.
const activeCommitment: SavingsGoal = {
  id: 7,
  name: 'Car Maintenance',
  targetAmount: 350,
  earmarkedAmount: 0,
  fundingBucket: 'Rewards',
  targetDate: '2026-09-15',
  priority: 'Medium',
  status: 'active',
  isRecurring: true,
  recurrenceMonths: 3,
  cycleFundedAmount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

test('rewards pool reports this cycle pacing for an active commitment', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, { savingsGoals: [activeCommitment] })
  await page.goto('/commitments-rewards', { waitUntil: 'domcontentloaded' })

  const card = page.locator('#commitments-rewards-panel-commitments > div').first()
  await expect(card).toBeVisible()

  // Below the expanded tier the pacing block sits inside a collapsed native <details>. A <summary>
  // carries no button role, so it cannot be reached through getByRole('button').
  const disclosure = card.locator('summary').filter({ hasText: 'Details' }).first()
  if (await disclosure.isVisible()) {
    await disclosure.click()
  }
  await expect(card.getByText(/This cycle:/)).toBeVisible()
  await waitForStableLayout(page)

  await expect(card).toHaveScreenshot('commitments-pool-active.png')
})

test('accounts bucket groups use the complete card shell', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/wealth/accounts', { waitUntil: 'domcontentloaded' })

  // The page sits on the canvas; each bucket's accounts are the card. Measure the first of them.
  await expect(page.getByRole('region', { name: 'Accounts', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Everyday bank')).toBeVisible()
  await waitForStableLayout(page)
  const panel = page.locator('[id^="bucket-account-group-"]').first()

  const shell = await panel.evaluate(element => {
    const style = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: Number.parseFloat(style.borderTopWidth),
      borderTopLeftRadius: Number.parseFloat(style.borderTopLeftRadius),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
      left: bounds.left,
      right: bounds.right,
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    }
  })

  expect(shell.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(shell.borderTopWidth).toBeGreaterThan(0)
  expect(shell.borderTopLeftRadius).toBeGreaterThan(0)
  expect(shell.paddingLeft).toBeGreaterThanOrEqual(16)
  expect(shell.paddingRight).toBeGreaterThanOrEqual(16)
  expect(shell.left).toBeGreaterThanOrEqual(0)
  expect(shell.right).toBeLessThanOrEqual(shell.viewportWidth)
  expect(shell.pageWidth).toBeLessThanOrEqual(shell.viewportWidth + 1)

  await expect(page).toHaveScreenshot('settings-accounts.png', { fullPage: true, maxDiffPixelRatio: 0.08 })
})

// The account still owns a credential, but this browser has lost its local marker. Device Unlock
// offers the normal setup action without exposing the removed restore flow.
test('device unlock offers setup without a restore action after the browser loses its marker', async ({ page }) => {
  await establishSession(page)
  // Headless Chromium reports no platform authenticator, which would hide both actions.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: class {
        static isUserVerifyingPlatformAuthenticatorAvailable() { return Promise.resolve(true) }
      },
    })
  })
  await mockApi(page)
  // Registered after mockApi so it wins: Playwright matches the most recent handler first.
  await page.route('**/api/auth/webauthn/credentials', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'AABBCC', deviceLabel: 'Chrome on Windows', createdAt: '2026-06-01T00:00:00Z' },
      ]),
    }))
  await page.goto('/settings?section=security', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: /Device Unlock/i }).click()
  const setup = page.getByRole('button', { name: 'Set up this device', exact: true })
  await expect(setup).toBeVisible()
  await expect(page.getByRole('button', { name: /restore on this device/i })).toHaveCount(0)
  const setupAlignment = await setup.evaluate(button => {
    const row = button.parentElement!
    const buttonBounds = button.getBoundingClientRect()
    const rowBounds = row.getBoundingClientRect()
    return {
      justifyContent: getComputedStyle(row).justifyContent,
      buttonCenter: buttonBounds.left + buttonBounds.width / 2,
      rowCenter: rowBounds.left + rowBounds.width / 2,
    }
  })
  const compact = (page.viewportSize()?.width ?? 0) < 640
  expect(setupAlignment.justifyContent).toBe(compact ? 'center' : 'flex-end')
  if (compact) expect(Math.abs(setupAlignment.buttonCenter - setupAlignment.rowCenter)).toBeLessThanOrEqual(1)
  await waitForStableLayout(page)

  const layout = await setup.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))

  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
})

test('desktop sidebar actions stay compact', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('desktop'), 'Desktop navigation uses compact pointer targets.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  const sidebar = page.locator('aside[aria-label="Sidebar"]')
  const measure = (name: string) => sidebar.getByRole('button', { name, exact: true }).evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { width: Math.round(bounds.width), height: Math.round(bounds.height) }
  })
  expect(await measure('Collapse sidebar')).toEqual({ width: 36, height: 36 })
  expect((await measure('Today')).height).toBe(40)
  expect((await measure('Settings')).height).toBe(40)
})

test('every corner of a header action is clickable, not just its rounded middle', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('desktop'), 'Pointer-precision behaviour.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await waitForStableLayout(page)

  // Chrome hit-tests through border-radius, so the corners of a rounded control belong to
  // whatever is behind it — while :hover and active:scale-95 still fire, which is why this
  // read as a button that responded and did nothing. jsdom has no hit-testing and cannot see
  // it, so the guard has to be a real browser. The app chrome's own ::after rectangle is the fix.
  const trigger = page.getByRole('button', { name: 'Search your records' })
  const box = (await trigger.boundingBox())!
  const corners = [
    [1.5, 1.5],
    [box.width - 1.5, 1.5],
    [1.5, box.height - 1.5],
    [box.width - 1.5, box.height - 1.5],
  ] as const

  for (const [dx, dy] of corners) {
    await page.mouse.click(box.x + dx, box.y + dy)
    await expect(
      page.getByRole('dialog', { name: 'Search' }),
      `clicking (${dx}, ${dy}) inside the trigger must open search`,
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeHidden()
  }
})

test('mixed input select date form sheet', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer')).toBeVisible()
  await openTransactionForm(page)
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
  const showActions = page.getByRole('button', { name: 'Show row actions' }).first()
  if (await showActions.isVisible()) {
    await showActions.click()
  }
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

test('investment activity table explains fees and taxes beside the gross amount', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('desktop'), 'The activity table is desktop-only.')

  const activity: InvestmentActivity = {
    id: 'activity-with-charges',
    accountId: 'account-1',
    instrumentId: 'instrument-1',
    type: 'Dividend',
    tradeDate: '2026-07-01',
    units: 0,
    cashAmount: 0.7,
    fees: 0.02,
    taxes: 0.21,
    createdAt: '2026-07-01T00:00:00Z',
  }

  await establishSession(page)
  await mockApi(page, { investmentTransactions: [activity] })
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Gross amount')).toBeVisible()
  await expect(page.getByText(/Fees.*0\.02.*Taxes.*0\.21/).last()).toBeVisible()
  await expect(page.getByText(/After charges/).last()).toBeVisible()
})

test('global search reveals far commitment and reward cards in place', async ({ page }) => {
  const rewardItems: WishlistItem[] = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    name: `Search Reward ${index + 1}`,
    price: 100 + index * 25,
    priority: index === 0 ? 'High' : 'Medium',
    isPurchased: false,
    createdAt: `2026-07-${String(index + 1).padStart(2, '0')}`,
    isActive: index === 0,
  }))
  const goals: SavingsGoal[] = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    name: `Search Commitment ${index + 1}`,
    targetAmount: 500 + index * 100,
    earmarkedAmount: 25,
    fundingBucket: 'Rewards',
    targetDate: `2027-0${index + 1}-15`,
    priority: 'Medium',
    status: 'active',
    isRecurring: false,
    recurrenceMonths: 0,
    cycleFundedAmount: 0,
    createdAt: `2026-07-${String(index + 1).padStart(2, '0')}`,
  }))

  await establishSession(page)
  await mockApi(page, { wishlist: rewardItems, savingsGoals: goals })
  // Checked on a phone, where the page is longest and the targets start furthest off-screen.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await openGlobalSearch(page)
  await page.getByRole('combobox', { name: 'Search query' }).fill('Search Commitment 5')
  await page.getByRole('option', { name: /^Search Commitment 5 / }).click()

  await expect(page).toHaveURL(/\/plan\/goals\?.*commitment=5/)
  const commitment = page.locator('#commitment-card-5')
  await expect(commitment).toHaveClass(/search-target-highlight/)
  await expect.poll(() => commitment.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.top >= 0 && rect.top < window.innerHeight
  })).toBe(true)

  await openGlobalSearch(page)
  await page.getByRole('combobox', { name: 'Search query' }).fill('Search Reward 5')
  await page.getByRole('option', { name: /^Search Reward 5 / }).click()

  await expect(page).toHaveURL(/\/plan\/goals\?.*reward=5/)
  const target = page.locator('#reward-card-5')
  await expect(target).toHaveClass(/search-target-highlight/)
  await expect.poll(() => target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.top >= 0 && rect.top < window.innerHeight
  })).toBe(true)
})

test('global search uses the shared highlight on the responsive Ledger row', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await openGlobalSearch(page)
  await page.getByRole('combobox', { name: 'Search query' }).fill('Neighbourhood Grocer')
  await page.getByRole('option', { name: /^Neighbourhood Grocer / }).click()

  await expect(page).toHaveURL(/\/activity\?.*tx=tx-visual-1/)
  const isCompactLedger = (page.viewportSize()?.width ?? 0) < 1024
  const target = page.locator(`#tx-row-${isCompactLedger ? 'mobile' : 'desktop'}-tx-visual-1`)
  await expect(target).toHaveClass(/search-target-highlight/)
  await expect(target).toBeInViewport()
})

// The account dropdown is the app's only Radix menu consumer, so it is the only surface that
// mounts Radix's FocusScope. radix-ui 1.4.3 composed that scope's container ref with an inline
// arrow, so `useComposedRefs`'s `useCallback` deps changed on every render; React 19 re-attaches a
// ref whose identity changed by calling it with `null` and then the node, and each of those is a
// real `setContainer` update, so opening the menu started a self-sustaining detach/attach loop and
// tripped React's nested-update ceiling (#185) before the menu could paint. jsdom cannot see it,
// so the guard has to run in a real browser. It asserts on console/page errors rather than pixels:
// a downgrade or a similar unstable-ref regression in any menu primitive would surface here first.
for (const trigger of ['Account menu']) {
  test(`${trigger} opens without a React update loop`, async ({ page }) => {
    const failures: string[] = []
    page.on('console', message => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('pageerror', error => failures.push(`pageerror: ${error.message}`))

    await establishSession(page)
    await mockApi(page)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    await page.getByRole('button', { name: trigger }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()

    expect(failures.join('\n')).not.toMatch(/Maximum update depth|React error #185/)
  })
}
