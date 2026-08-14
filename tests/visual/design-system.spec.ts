import { expect, test } from '@playwright/test'
import type { InvestmentActivity, WishlistItem } from '../../src/types'
import { establishSession, mockApi, waitForStableLayout } from './visualTestSupport'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
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

test('accounts settings panel uses the complete card shell', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/settings?section=accounts', { waitUntil: 'domcontentloaded' })

  const panel = page.getByRole('tabpanel', { name: 'Accounts' })
  await expect(panel).toBeVisible()
  await expect(page.getByText('Everyday bank')).toBeVisible()
  await waitForStableLayout(page)

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

  await expect(page).toHaveScreenshot('settings-accounts.png', { fullPage: true })
})

test('desktop top-bar icon actions stay compact', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('desktop'), 'Desktop navigation uses compact pointer targets.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  const sizes = await Promise.all([
    page.getByRole('button', { name: 'Commitments and Rewards', exact: true }).evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    }),
    page.getByRole('button', { name: 'Bills: all caught up' }).evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    }),
  ])
  expect(sizes).toEqual([
    { width: 36, height: 36 },
    { width: 36, height: 36 },
  ])
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

test('rewards rail responds to a desktop mouse wheel and releases page scrolling at its edge', async ({ page }) => {
  test.skip(test.info().project.name.startsWith('mobile'), 'Touch projects use native horizontal swiping, not a mouse-wheel handoff.')

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
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/commitments-rewards', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: /^Rewards/ }).click()

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

  const EDGE_HANDOFF_HEADROOM = 120
  await page.evaluate(headroom => {
    window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight - headroom))
  }, EDGE_HANDOFF_HEADROOM)

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

// The account dropdown and the quick-add menu are the app's only Radix consumers, so they are
// the only surfaces that mount Radix's FocusScope. radix-ui 1.4.3 composed that scope's container
// ref with an inline arrow, so `useComposedRefs`'s `useCallback` deps changed on every render;
// React 19 re-attaches a ref whose identity changed by calling it with `null` and then the node,
// and each of those is a real `setContainer` update, so opening the menu started a self-sustaining
// detach/attach loop and tripped React's nested-update ceiling (#185) before the menu could paint.
// jsdom cannot see it -- TopNav.test.tsx opens the same menu happily -- so the guard has to run in
// a real browser. It asserts on console/page errors rather than pixels: a downgrade or a similar
// unstable-ref regression in any menu primitive would surface here first.
for (const trigger of ['Account menu', 'Quick Add']) {
  test(`${trigger} opens without a React update loop`, async ({ page }) => {
    // Quick Add is a desktop-rail action (`hidden lg:block`); the account menu is on every width.
    test.skip(trigger === 'Quick Add' && !test.info().project.name.startsWith('desktop'),
      'Quick Add is only rendered from the lg breakpoint upward.')
    const failures: string[] = []
    page.on('console', message => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('pageerror', error => failures.push(`pageerror: ${error.message}`))

    await establishSession(page)
    await mockApi(page)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    await page.getByRole('button', { name: trigger }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: trigger === 'Quick Add' ? 'Post Transaction' : 'Settings' })).toBeVisible()

    expect(failures.join('\n')).not.toMatch(/Maximum update depth|React error #185/)
  })
}
