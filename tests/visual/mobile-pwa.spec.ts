import { expect, test } from '@playwright/test'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../src/types'
import {
  establishSession,
  mockApi,
  seedDraftTransaction,
  vaultDocuments,
  waitForStableLayout,
} from './visualTestSupport'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
})

test('production routes do not create viewport horizontal overflow', async ({ page }) => {
  if (test.info().project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 320, height: 844 })
  }
  await establishSession(page)
  await seedDraftTransaction(page)
  await mockApi(page)

  for (const route of ['/dashboard', '/reports', '/recurring', '/ledger', '/commitments-rewards', '/settings', '/investments', '/vault', '/drafts']) {
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

  if (test.info().project.name.startsWith('mobile')) {
    await page.goto('/settings?section=accounts', { waitUntil: 'domcontentloaded' })
    const panel = page.getByRole('tabpanel', { name: 'Accounts' })
    const searchInput = panel.getByRole('searchbox', { name: 'Filter accounts' })
    const firstAddButton = panel.getByRole('button', { name: 'Add account' }).first()

    await expect(panel).toBeVisible()
    await expect(searchInput).toBeVisible()
    await expect(firstAddButton).toBeVisible()

    const geometry = await panel.evaluate(element => {
      const searchElement = element.querySelector('input[type="search"]')
      if (!searchElement) throw new Error('Accounts search was not rendered')
      const panelBounds = element.getBoundingClientRect()
      const searchBounds = searchElement.getBoundingClientRect()
      return {
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        searchLeft: searchBounds.left,
        searchRight: searchBounds.right,
        panelLeft: panelBounds.left,
        panelRight: panelBounds.right,
      }
    })
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
    expect(geometry.searchLeft).toBeGreaterThanOrEqual(geometry.panelLeft)
    expect(geometry.searchRight).toBeLessThanOrEqual(geometry.panelRight)
  }
})

test('saved theme is applied before the PWA application bundle runs', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-light', 'One mobile project proves the pre-React launch contract.')

  await page.addInitScript(() => {
    localStorage.setItem('auth_username', 'visual-user')
    localStorage.setItem('dark_mode', 'false')
    localStorage.setItem('dark_mode:visual-user', 'true')
  })
  await page.route('**/assets/index-*.js', route => route.abort())
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b0e14')

  const manifestResponse = await page.request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({
    display: 'standalone',
    background_color: '#0b0e14',
    theme_color: '#fcfcfc',
    orientation: 'portrait-primary',
  })
})

test('mobile PWA runs with touch input and an active service worker', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-light', 'One mobile project proves the installed-PWA runtime contract.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/', { waitUntil: 'load' })

  const inputCapabilities = await page.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
  }))
  expect(inputCapabilities.maxTouchPoints).toBeGreaterThan(0)
  expect(inputCapabilities.coarsePointer).toBe(true)
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.getRegistrations().then(registrations => registrations.length)),
    { timeout: 15_000 },
  ).toBeGreaterThan(0)
})

test('mobile quick actions move focus into the menu and restore it on Escape', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The floating action menu is mobile-only.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: 'Open Menu' })
  await trigger.click()

  // The menu grows upwards, so its first item is the topmost one: the reads sit there and
  // Post Transaction sits last, nearest the thumb.
  const firstAction = page.getByRole('menuitem', { name: 'Search' })
  await expect(firstAction).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('settings tabs support roving keyboard focus on mobile', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The narrow settings tab rail is the focus of this check.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  const planTab = page.getByRole('tab', { name: 'Plan & Preferences' })
  await planTab.focus()
  await page.keyboard.press('ArrowRight')

  const investmentTab = page.getByRole('tab', { name: 'Investment Plan' })
  await expect(investmentTab).toBeFocused()
  await expect(investmentTab).toHaveAttribute('aria-selected', 'true')
})

test('Investment Plan and Security settings render without a suspended chunk', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })

  await page.getByRole('tab', { name: 'Investment Plan' }).click()
  await expect(page.getByRole('heading', { name: /Portfolio targets/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Investment classification/ })).toBeVisible()

  await page.getByRole('tab', { name: 'Security & Devices' }).click()
  for (const heading of ['Active Devices', 'Change Password', 'Two-Factor Authentication', 'Device Unlock']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
})

test('mobile transaction sheet remains contained at keyboard height', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The virtual-keyboard viewport is mobile-only.')

  await page.setViewportSize({ width: 390, height: 500 })
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Post Transaction/i }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await expect.poll(
    () => dialog.evaluate(element => element.getBoundingClientRect().bottom),
    { timeout: 2_000 },
  ).toBeLessThanOrEqual(501)

  const dimensions = await dialog.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const backdrop = element.closest('.sheet-backdrop')?.getBoundingClientRect()
    const entrance = element.parentElement
    const entranceBounds = entrance?.getBoundingClientRect()
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      viewportHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height,
      appViewportHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-vvh'),
      panelMaxHeight: getComputedStyle(element).maxHeight,
      panelTransform: getComputedStyle(element).transform,
      backdrop: backdrop ? { top: backdrop.top, bottom: backdrop.bottom, height: backdrop.height } : null,
      entrance: entrance && entranceBounds ? {
        top: entranceBounds.top,
        bottom: entranceBounds.bottom,
        height: entranceBounds.height,
        transform: getComputedStyle(entrance).transform,
      } : null,
    }
  })
  expect(dimensions.top).toBeGreaterThanOrEqual(-1)
  expect(dimensions.bottom, `Sheet geometry: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.viewportHeight + 1)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
})

test('draft attachments survive a reload before the batch is added', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-light', 'One browser project proves IndexedDB draft persistence.')

  await establishSession(page)
  await seedDraftTransaction(page)
  await mockApi(page, {
    reliefCategories: [{ id: 'medical', name: 'Medical', limit: 10_000 }],
  })
  await page.goto('/drafts', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  await expect(page.getByText('Weekend market')).toBeVisible({ timeout: 15_000 })
  const showActions = page.getByRole('button', { name: 'Show row actions' })
  if (await showActions.first().isVisible()) {
    await showActions.first().click()
    await expect(page.getByRole('button', { name: 'Hide row actions' }).first()).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Edit Weekend market' }).first()).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Edit Weekend market' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Edit Draft' })
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await dialog.locator('input[type="file"][multiple]').setInputFiles({
    name: 'weekend-market.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 draft receipt'),
  })
  await dialog.getByRole('combobox', { name: 'Tax relief category for weekend-market.pdf' }).click()
  await page.getByRole('option', { name: /Medical/ }).click()
  await dialog.getByRole('button', { name: 'Save Draft' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('1 attachment')).toBeVisible()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('1 attachment')).toBeVisible()
  await expect(page.getByText('Weekend market')).toBeVisible({ timeout: 15_000 })
  const reloadShowActions = page.getByRole('button', { name: 'Show row actions' }).first()
  if (await reloadShowActions.isVisible()) {
    await reloadShowActions.click()
    await expect(page.getByRole('button', { name: 'Hide row actions' }).first()).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Edit Weekend market' }).first()).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Edit Weekend market' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Edit Draft' }).getByText('weekend-market.pdf')).toBeVisible()
})

const responsiveRoutes = [
  { path: '/reports', slug: 'reports', readyText: 'Carryover Rolling Ledgers' },
  { path: '/recurring', slug: 'recurring', readyText: 'Recurring Bills & Subscriptions' },
  { path: '/ledger', slug: 'ledger', readyText: 'Neighbourhood Grocer' },
  { path: '/ledger?all=1', slug: 'ledger-all-cycles', readyText: 'Neighbourhood Grocer' },
  { path: '/commitments-rewards', slug: 'commitments-rewards', readyText: 'Commitments & Rewards' },
  { path: '/settings', slug: 'settings', readyText: 'Financial Model' },
  { path: '/investments', slug: 'investments', readyText: 'Build your investment view' },
  { path: '/vault', slug: 'vault', readyText: '2 documents stored' },
  { path: '/drafts', slug: 'drafts', readyText: 'Weekend market' },
] as const

test('draft recording order control persists at every responsive size', async ({ page }) => {
  await establishSession(page)
  await page.addInitScript(drafts => {
    if (!sessionStorage.getItem('draft-order-seeded')) {
      localStorage.setItem('draft_transactions', JSON.stringify(drafts))
      sessionStorage.setItem('draft-order-seeded', 'true')
    }
  }, [
    {
      id: 'draft-order-1',
      date: '2026-08-02',
      description: 'Weekend market',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -42.5,
      accountId: 'acct-essentials',
    },
    {
      id: 'draft-order-2',
      date: '2026-08-02',
      description: 'Car fuel',
      category: 'Transport',
      ledgerCategory: 'Essentials',
      amount: -30,
      accountId: 'acct-essentials',
    },
  ])
  await mockApi(page)
  await page.goto('/drafts', { waitUntil: 'domcontentloaded' })

  const firstGrip = page.getByRole('button', { name: /Reorder Weekend market\. Position 1 of 2/i })
  const secondGrip = page.getByRole('button', { name: /Reorder Car fuel\. Position 2 of 2/i })
  await expect(firstGrip).toBeVisible()
  await expect(secondGrip).toBeVisible()
  const firstBox = await firstGrip.boundingBox()
  expect(firstBox).not.toBeNull()
  if (!firstBox) return
  if (test.info().project.name.startsWith('mobile')) {
    expect(firstBox.width).toBeGreaterThanOrEqual(44)
    expect(firstBox.height).toBeGreaterThanOrEqual(44)
  }

  await firstGrip.press('ArrowDown')

  await expect(page.getByRole('button', { name: /Reorder Car fuel\. Position 1 of 2/i })).toBeVisible()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Reorder Car fuel\. Position 1 of 2/i })).toBeVisible()
  await expect(page).toHaveScreenshot('draft-recording-order.png')
})

test('mobile draft review queue clears fixed navigation at keyboard height', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The keyboard-height check is mobile-only.')

  await establishSession(page)
  await page.addInitScript(drafts => {
    localStorage.setItem('draft_transactions', JSON.stringify(drafts))
  }, [{
    id: 'draft-keyboard-height',
    date: '2026-08-02',
    description: 'Weekend market',
    category: 'Food',
    ledgerCategory: 'Essentials',
    amount: -42.5,
    accountId: 'acct-essentials',
  }])
  await mockApi(page)
  await page.setViewportSize({ width: 390, height: 500 })
  await page.goto('/drafts', { waitUntil: 'domcontentloaded' })

  const reorder = page.getByRole('button', { name: /Reorder Weekend market\. Position 1 of 1/i })
  const menu = page.getByRole('button', { name: 'More actions for Weekend market' })
  const addDraft = page.getByRole('button', { name: 'Add draft' })
  const batchAction = page.getByRole('button', { name: 'Add 1 draft to Ledger' })
  await expect(reorder).toBeVisible()
  await expect(menu).toBeVisible()
  await expect(addDraft).toBeVisible()
  await expect(batchAction).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Open Menu' })).toHaveCount(0)

  for (const control of [reorder, menu, addDraft, batchAction]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    if (!box) continue
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  await batchAction.scrollIntoViewIfNeeded()
  const batchBox = await batchAction.boundingBox()
  expect(batchBox).not.toBeNull()
  if (batchBox) {
    expect(batchBox.width).toBeGreaterThanOrEqual(300)
    expect(batchBox.y + batchBox.height).toBeLessThanOrEqual(500 - 76 + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

for (const route of responsiveRoutes) {
  test(`responsive ${route.slug} viewport`, async ({ page }) => {

    await establishSession(page)
    if (route.path === '/drafts') await seedDraftTransaction(page)
    await mockApi(page, { documents: vaultDocuments })
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    // Scoped to main: the navigation rail carries the same destination labels in the shell,
    // and at medium they are present but visually hidden.
    await expect(page.locator('main').getByText(route.readyText, { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    const logo = page.getByRole('button', { name: 'Go to Today' })
    const wishlistAction = page.locator('header').getByRole('button', { name: 'Commitments and Rewards', exact: true })
    const billsAction = page.getByRole('button', { name: /Bills:/ })
    await expect(logo).toBeVisible()
    await expect(wishlistAction).toBeVisible()
    await expect(billsAction).toBeVisible()
    await page.waitForFunction(() => document.fonts.status === 'loaded')
    await waitForStableLayout(page)

    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }))
    expect(width.page).toBeLessThanOrEqual(width.viewport + 1)
    for (const action of [logo, wishlistAction, billsAction]) {
      const bounds = await action.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right }
      })
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(width.viewport)
    }
    if (route.path === '/reports' || route.path === '/ledger') {
      const yearSelect = page.getByRole('combobox', {
        name: route.path === '/reports' ? 'Report cycle year' : 'Ledger cycle year',
      })
      const yearWidth = await yearSelect.evaluate(element => element.getBoundingClientRect().width)
      expect(yearWidth, `${route.path} year control must leave room for all four digits`).toBeGreaterThanOrEqual(108)
      const yearLabel = yearSelect.locator('span').first()
      const labelWidth = await yearLabel.evaluate(element => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }))
      expect(labelWidth.scroll, `${route.path} year label must not truncate`).toBeLessThanOrEqual(labelWidth.client + 1)
    }
    await expect(page).toHaveScreenshot(`responsive-${route.slug}.png`)
  })
}

test('mobile Vault failure is explicit and never impersonates an empty vault', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-dark', 'One mobile theme records the unavailable state.')

  await establishSession(page)
  await mockApi(page, { failDocuments: true })
  await page.goto('/vault', { waitUntil: 'domcontentloaded' })
  const errorHeading = page.getByText('Documents unavailable')
  await expect(errorHeading).toBeVisible()
  await expect(page.getByText('No documents match your filters.')).toHaveCount(0)
  await expect(page.getByText('© 2026 FinancialApp. All rights reserved.')).toBeVisible()
  await waitForStableLayout(page)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page).toHaveScreenshot('mobile-pwa-vault-unavailable.png')
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

test('mobile document cards keep amount editing and tax relief controls aligned', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The card layout is mobile-only.')

  const document: VaultDocument = {
    ...vaultDocuments[0],
    id: 3,
    originalFileName: 'INV-049837.pdf',
    amount: 56,
    reliefCategory: 'sports-lifestyle',
  }
  const reliefCategories: TaxReliefCategoryDefinition[] = [{
    id: 'sports-lifestyle',
    name: 'Sports Lifestyle',
    limit: 1_000,
  }]

  await establishSession(page)
  await mockApi(page, { documents: [document], reliefCategories })
  await page.goto('/vault', { waitUntil: 'domcontentloaded' })

  const card = page.getByTestId('document-card-3')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /56\.00/ }).click()

  const amountInput = card.getByRole('textbox', { name: 'Amount for INV-049837.pdf' })
  const reliefButton = card.getByRole('button', { name: 'Change tax relief category for INV-049837.pdf' })
  await expect(amountInput).toBeVisible()
  await expect(reliefButton).toBeVisible()

  const amountControls = await amountInput.evaluate(element => {
    const row = element.parentElement
    const bounds = row?.getBoundingClientRect()
    return bounds ? { top: bounds.top, bottom: bounds.bottom } : null
  })
  const reliefBounds = await reliefButton.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right }
  })
  const cardBounds = await card.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { left: bounds.left, right: bounds.right }
  })

  expect(amountControls).not.toBeNull()
  expect(reliefBounds.top).toBeLessThanOrEqual(amountControls!.bottom)
  expect(reliefBounds.bottom).toBeGreaterThanOrEqual(amountControls!.top)
  expect(reliefBounds.left).toBeGreaterThanOrEqual(cardBounds.left)
  expect(reliefBounds.right).toBeLessThanOrEqual(cardBounds.right)
})

test('mobile category toolbar keeps the filter and Add action on one row', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The compact toolbar is mobile-only.')

  await page.setViewportSize({ width: 320, height: 844 })
  await establishSession(page)
  await mockApi(page)
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Categories & Limits' }).click()

  const search = page.getByRole('searchbox', { name: 'Search categories' })
  const filter = page.getByRole('combobox', { name: 'Filter transaction categories by flow' })
  const toolbar = search.locator('..').locator('..')
  const add = toolbar.getByRole('button', { name: 'Add', exact: true })
  await expect(search).toBeVisible()
  await expect(filter).toBeVisible()
  await expect(add).toBeVisible()

  const [toolbarBounds, filterBounds, addBounds] = await Promise.all([
    toolbar.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return { top: bounds.top, bottom: bounds.bottom }
    }),
    filter.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return { top: bounds.top, bottom: bounds.bottom }
    }),
    add.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return { top: bounds.top, bottom: bounds.bottom }
    }),
  ])

  expect(filterBounds.top).toBeGreaterThanOrEqual(toolbarBounds.top)
  expect(addBounds.top).toBeGreaterThanOrEqual(toolbarBounds.top)
  expect(filterBounds.bottom).toBeLessThanOrEqual(toolbarBounds.bottom)
  expect(addBounds.bottom).toBeLessThanOrEqual(toolbarBounds.bottom)
})

// The two tabs share one summary card, so switching tabs must not change its shape or move its
// primary action. This measures the card on both tabs rather than trusting the snapshot alone.
test('recurring summary card keeps its shape and top action across both tabs', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'The tab summary card is measured on mobile.')

  await establishSession(page)
  await mockApi(page)
  await page.goto('/recurring', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Recurring Bills & Subscriptions', { exact: true })).toBeVisible({ timeout: 15_000 })
  await page.waitForFunction(() => document.fonts.status === 'loaded')
  await waitForStableLayout(page)

  const cardBounds = async () => page.getByRole('heading', { level: 2 })
    .evaluate(heading => {
      const card = heading.closest('div[class*="rounded"]') ?? heading.parentElement!.parentElement!
      const rect = card.getBoundingClientRect()
      return { width: Math.round(rect.width), height: Math.round(rect.height) }
    })

  const billsCard = await cardBounds()
  const newSubscription = page.getByRole('button', { name: 'New Subscription' })
  await expect(newSubscription).toBeVisible()
  const subscriptionTop = await newSubscription.evaluate(element => Math.round(element.getBoundingClientRect().top))

  await page.getByRole('tab', { name: /Loans/ }).click()
  await expect(page.getByRole('heading', { name: 'Loans', level: 2 })).toBeVisible()
  await waitForStableLayout(page)

  const loansCard = await cardBounds()
  const newLoan = page.getByRole('button', { name: 'New Loan' })
  await expect(newLoan).toBeVisible()
  const loanTop = await newLoan.evaluate(element => Math.round(element.getBoundingClientRect().top))

  expect(loansCard.width).toBe(billsCard.width)
  expect(Math.abs(loansCard.height - billsCard.height)).toBeLessThanOrEqual(24)
  expect(Math.abs(loanTop - subscriptionTop)).toBeLessThanOrEqual(24)
  // Adding a loan lives in the summary card now, not beside the "Tracked loans" sub-heading.
  await expect(page.getByRole('button', { name: 'Add loan' })).toHaveCount(0)

  await expect(page).toHaveScreenshot('mobile-pwa-recurring-loans.png')
})

test('editing a category flow type holds the row still and keeps a 44px target', async ({ page }) => {
  await establishSession(page)
  await mockApi(page, {
    categories: [
      { id: 'groceries', name: 'Groceries', type: 'outflow' },
      { id: 'refunds', name: 'Refunds', type: 'both' },
      { id: 'salary', name: 'Salary', type: 'inflow' },
    ],
  })
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Categories & Limits' }).click()

  // The card starts collapsed on a phone, so the list is not interactive until it is opened.
  const categoriesHeader = page.getByRole('button', { name: /Transaction Categories/ })
  if (await categoriesHeader.getAttribute('aria-expanded') === 'false') {
    await categoriesHeader.click()
    await expect(categoriesHeader).toHaveAttribute('aria-expanded', 'true')
  }

  const groups = page.getByRole('group', { name: /^Flow restriction for / })
  const order = () => groups.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
  // Grouped by saved type: both, then inflow, then outflow.
  await expect.poll(order).toEqual([
    'Flow restriction for Refunds',
    'Flow restriction for Salary',
    'Flow restriction for Groceries',
  ])

  const target = page.getByRole('button', { name: 'Restrict to money out for Salary' })
  // Measured against the first row rather than the viewport or the document: clicking can scroll
  // an ancestor into view, and any such scroll cancels out of a difference between two rows.
  const offsetFromFirstRow = () => groups.evaluateAll(nodes => {
    const first = nodes[0].getBoundingClientRect().y
    const salary = nodes.find(node => node.getAttribute('aria-label')!.endsWith('Salary'))!
    return Math.round(salary.getBoundingClientRect().y - first)
  })
  const offsetBefore = await offsetFromFirstRow()
  const boxBefore = (await target.boundingBox())!
  if (test.info().project.name.startsWith('mobile')) {
    expect(boxBefore.height).toBeGreaterThanOrEqual(44)
    expect(boxBefore.width).toBeGreaterThanOrEqual(44)
  }

  await target.click()

  // The pointer must still be over the same control: an unsaved type change may not reorder rows.
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  expect(await offsetFromFirstRow()).toBe(offsetBefore)
  expect(await order()).toEqual([
    'Flow restriction for Refunds',
    'Flow restriction for Salary',
    'Flow restriction for Groceries',
  ])
  await expect(page.getByText(/1 category flow type modified/)).toBeVisible()

  // The whole row cluster stays inside the viewport at 390px rather than overflowing sideways.
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflows).toBe(false)
})
