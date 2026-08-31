import { expect, test } from '@playwright/test'
import { establishSession, mockApi, seedDraftTransaction, vaultDocuments, waitForStableLayout } from './visualTestSupport'

const routes = [
  '/dashboard', '/reports', '/recurring', '/ledger', '/commitments-rewards',
  '/settings', '/investments', '/vault', '/drafts',
] as const

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  await seedDraftTransaction(page)
  await mockApi(page, { documents: vaultDocuments })
})

test('every route obeys the window-tier containment and navigation contract', async ({ page }) => {
  const uncaughtErrors: string[] = []
  page.on('pageerror', error => uncaughtErrors.push(error.message))

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await waitForStableLayout(page)

    const contract = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      const visible = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter(element => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }).length
      return {
        width,
        pageWidth: document.documentElement.scrollWidth,
        bottomNavs: visible('nav[aria-label="Primary"]') - visible('aside nav[aria-label="Primary"]'),
        navRails: visible('aside nav[aria-label="Primary"]'),
      }
    })

    expect(contract.pageWidth, `${route} horizontally overflows`).toBeLessThanOrEqual(contract.width + 1)
    if (contract.width < 640) {
      expect(contract.bottomNavs, `${route} must show one compact bottom navigation`).toBe(1)
      expect(contract.navRails).toBe(0)
    } else {
      expect(contract.bottomNavs).toBe(0)
      expect(contract.navRails, `${route} must show one navigation rail`).toBe(1)
    }
  }

  expect(uncaughtErrors, 'responsive route audit raised an uncaught application error').toEqual([])
})

test('compact route controls retain the 44px target floor', async ({ page }) => {
  test.skip(test.info().project.use.viewport?.width >= 1024, 'Touch-target floor applies to compact and medium projects.')

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await waitForStableLayout(page)

    const undersized = await page.locator('main button, main input, main textarea, main [role="button"], main [role="combobox"]').evaluateAll(elements =>
      elements.flatMap(element => {
        const target = element as HTMLElement
        const rect = target.getBoundingClientRect()
        const style = getComputedStyle(target)
        if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none') return []
        if (target.closest('[aria-hidden="true"], [inert]')) return []
        return rect.width + 0.5 < 44 || rect.height + 0.5 < 44
          ? [{ label: target.getAttribute('aria-label') || target.textContent?.trim().slice(0, 40) || target.tagName, width: rect.width, height: rect.height }]
          : []
      }),
    )
    expect(undersized, `${route} has compact controls below 44px`).toEqual([])
  }
})

test('medium ledger rows keep their actions inside the card', async ({ page }) => {
  const width = test.info().project.use.viewport?.width ?? 0
  test.skip(width < 640 || width >= 1024, 'The inline row actions only render on the medium tier.')

  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()
  await waitForStableLayout(page)

  const rows = page.locator('[id^="tx-row-mobile-"]')
  await expect(rows.first(), 'no ledger rows rendered to measure').toBeVisible()

  // The medium tier mounts the card list but SwipeableRow has no drawer, so the row falls back to
  // its inline actions. With none supplied it reused the drawer's full-colour captioned blocks,
  // which clipped their own labels and hung off the card. Compact icon buttons belong here.
  const drawerBlocks = await rows.evaluateAll(elements =>
    elements.flatMap(row => Array.from(row.querySelectorAll('button'))
      .filter(button => /^(Edit|Move to|Delete)$/.test((button.textContent || '').trim()))
      .map(button => ({ id: row.id, caption: (button.textContent || '').trim() }))),
  )
  expect(drawerBlocks, 'medium ledger rows still render the drawer action blocks inline').toEqual([])

  const spilling = await rows.evaluateAll(elements =>
    elements.filter(row => row.scrollWidth - row.clientWidth > 1).map(row => row.id),
  )
  expect(spilling, 'ledger row content escapes the card at the medium tier').toEqual([])

  const geometry = await rows.evaluateAll(elements => elements.map(row => {
    const card = row.getBoundingClientRect()
    const accent = row.querySelector<HTMLElement>(':scope > div > div > div')?.getBoundingClientRect()
    const remove = row.querySelector<HTMLElement>('button[aria-label^="Delete "]')?.getBoundingClientRect()
    return {
      accentLeft: accent ? Math.abs(accent.left - card.left) : null,
      accentRight: accent ? Math.abs(accent.right - card.right) : null,
      deleteInset: remove ? card.right - remove.right : null,
    }
  }))
  expect(geometry.every(item => item.accentLeft != null && item.accentLeft <= 1 && item.accentRight != null && item.accentRight <= 1), 'ledger accent does not span the card').toBe(true)
  expect(geometry.every(item => item.deleteInset != null && item.deleteInset >= 11), 'ledger delete action has no trailing padding').toBe(true)
})

test('compact compound controls keep their buttons inside their own boundaries', async ({ page }) => {
  test.skip((test.info().project.use.viewport?.width ?? 0) >= 640, 'Compound-control containment is compact-only.')

  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Post Transaction/i }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  await expect(dialog).toBeVisible()

  const amount = dialog.getByRole('textbox', { name: /Amount/ })
  await expect.poll(() => amount.evaluate(input => input.getBoundingClientRect().width)).toBeGreaterThanOrEqual(260)
  await amount.focus()
  await expect(dialog.locator('[data-smart-amount-calculator]')).toBeVisible()
  const amountGeometry = await amount.evaluate(input => {
    const field = input.parentElement?.parentElement
    const toolbar = input.parentElement?.querySelector<HTMLElement>('[data-smart-amount-calculator]')
    const fieldBounds = field?.getBoundingClientRect()
    const toolbarBounds = toolbar?.getBoundingClientRect()
    return {
      field: fieldBounds && { left: fieldBounds.left, right: fieldBounds.right, top: fieldBounds.top, bottom: fieldBounds.bottom },
      toolbar: toolbarBounds && { left: toolbarBounds.left, right: toolbarBounds.right, top: toolbarBounds.top, bottom: toolbarBounds.bottom },
      buttonOverflow: toolbar
        ? Array.from(toolbar.querySelectorAll('button')).some(button => {
            const buttonBounds = button.getBoundingClientRect()
            return buttonBounds.left < toolbarBounds!.left - 1 || buttonBounds.right > toolbarBounds!.right + 1
              || buttonBounds.top < toolbarBounds!.top - 1 || buttonBounds.bottom > toolbarBounds!.bottom + 1
          })
        : null,
    }
  })
  expect(amountGeometry.toolbar, 'focused amount field did not expose its calculator').toBeTruthy()
  expect(amountGeometry.buttonOverflow, `calculator button escaped its toolbar: ${JSON.stringify(amountGeometry)}`).toBe(false)
  expect(amountGeometry.toolbar!.left).toBeGreaterThanOrEqual(amountGeometry.field!.left - 1)
  expect(amountGeometry.toolbar!.right).toBeLessThanOrEqual(amountGeometry.field!.right + 1)
  expect(amountGeometry.toolbar!.top).toBeGreaterThanOrEqual(amountGeometry.field!.top - 1)
  expect(amountGeometry.toolbar!.bottom).toBeLessThanOrEqual(amountGeometry.field!.bottom + 1)
  const date = dialog.getByRole('button', { name: /Posting date/i })
  await date.click()
  const calendar = page.getByRole('dialog', { name: 'Choose date' })
  await expect(calendar).toBeVisible()
  const calendarGeometry = await calendar.evaluate(element => {
    const grid = element.querySelector<HTMLElement>('[role="grid"]')
    return {
      panelClientWidth: element.clientWidth,
      panelScrollWidth: element.scrollWidth,
      gridClientWidth: grid?.clientWidth,
      gridScrollWidth: grid?.scrollWidth,
    }
  })
  expect(calendarGeometry.panelScrollWidth).toBeLessThanOrEqual(calendarGeometry.panelClientWidth + 1)
  expect(calendarGeometry.gridScrollWidth).toBeLessThanOrEqual((calendarGeometry.gridClientWidth ?? 0) + 1)
  expect(
    amountGeometry.toolbar!.right - amountGeometry.toolbar!.left,
    `calculator consumes the amount-entry area: ${JSON.stringify(amountGeometry)}`,
  ).toBeLessThanOrEqual((amountGeometry.field!.right - amountGeometry.field!.left) * 0.6)
})

test('laptop-width Ledger and carryover views avoid horizontal data scrolling', async ({ page }) => {
  const width = test.info().project.use.viewport?.width ?? 0
  test.skip(width < 1024 || width >= 1280, 'The rail-constrained laptop contract is measured from 1024 through 1279px.')

  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  await expect(page.locator('[id^="tx-row-mobile-"]').first()).toBeVisible()
  await expect(page.locator('main table')).toHaveCount(0)

  await mockApi(page, {
    dashboard: {
      categories: [
        { id: 'essentials', name: 'Essentials', allocation: 0.5, target: 1_401.98, budget: 160.36, netChange: 655.55, spent: 746.43, remaining: 815.91 },
        { id: 'growth', name: 'Growth', allocation: 0.25, target: 700.99, budget: 2_943.5, netChange: 500, spent: 200.99, remaining: 3_443.5 },
        { id: 'stability', name: 'Stability', allocation: 0.15, target: 1_016.64, budget: 3_693.68, netChange: 1_016.64, spent: 0, remaining: 4_710.32 },
        { id: 'rewards', name: 'Rewards', allocation: 0.1, target: 280.39, budget: 32.21, netChange: 280.39, spent: 0, remaining: 312.6 },
      ],
      activeRecurringPayments: [{
        id: 'visual-pending', recurringPaymentId: 'visual-bill', name: 'Annual insurance', amount: 172.8,
        category: 'Insurance', ledgerCategory: 'Essentials', dueDate: '2026-08-15', dueDay: 15,
        isPaid: false, isDiscarded: false, status: 'Pending',
      }],
    },
  })
  await page.goto('/reports', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  const carryover = page.getByRole('heading', { name: 'Carryover Rolling Ledgers' }).locator('..')
  await expect(carryover.locator('table')).toHaveCount(0)
  const clippedLabels = await carryover.getByText(/^(Pending|Projected):/).evaluateAll(elements =>
    elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent),
  )
  expect(clippedLabels).toEqual([])
})

test('dense report charts and limit cards keep every value inside its own control', async ({ page }) => {
  const width = test.info().project.use.viewport?.width ?? 0
  test.skip(width < 1024 || width >= 1400, 'The report density regression targets common laptop widths.')

  await mockApi(page, {
    dashboard: {
      monthlyCategoryBreakdown: [
        { category: 'Household', amount: 1_000 },
        { category: 'Loan', amount: 94.29 },
        { category: 'Health', amount: 80 },
        { category: 'Haircut', amount: 22 },
        { category: 'Hobbies', amount: 18 },
        { category: 'Entertainment', amount: 12.5 },
      ],
      categoryLimitProgress: [
        { category: 'Hobbies', spent: 18, limit: 400, remaining: 382, percentUsed: 0.045, projectedSpend: 227.2, status: 'OnTrack' },
        { category: 'Food', spent: 0, limit: 400, remaining: 400, percentUsed: 0, projectedSpend: 0, status: 'OnTrack' },
      ],
    },
  })
  await page.goto('/reports', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const outflowPanel = page.getByRole('heading', { name: 'Outflow Categories' })
    .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " app-panel ")]')
  const legendButtons = outflowPanel.locator('button[aria-label*="%"]')
  await expect(legendButtons.first()).toBeVisible()
  const legendOverflow = await legendButtons.evaluateAll(buttons => buttons.flatMap(button => {
    const bounds = button.getBoundingClientRect()
    const children = Array.from(button.children).map(child => child.getBoundingClientRect())
    return children.some(child => child.left < bounds.left - 1 || child.right > bounds.right + 1)
      ? [button.getAttribute('aria-label')]
      : []
  }))
  expect(legendOverflow).toEqual([])

  const limitCards = page.locator('#report-section-category-limits button[id^="report-category-limit-"]')
  await expect(limitCards.first()).toBeVisible()
  const cardWidths = await limitCards.evaluateAll(cards => cards.map(card => card.getBoundingClientRect().width))
  expect(Math.min(...cardWidths)).toBeGreaterThanOrEqual(208)
})

test('navigation rail packs its destinations under the header and pins settings to its foot', async ({ page }) => {
  test.skip((test.info().project.use.viewport?.width ?? 0) < 640, 'The compact tier uses bottom navigation.')
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  // The rail is viewport-tall and the destinations are not. Centring them left a gap at both ends
  // and detached the list from the header it belongs to, so the destinations are grouped and packed
  // under the header while the utility destination holds the foot.
  const geometry = await page.locator('aside nav[aria-label="Primary"]').evaluate(nav => {
    const items = Array.from(nav.querySelectorAll<HTMLElement>('button'))
    const navRect = nav.getBoundingClientRect()
    // Measured from the first rendered child, not the first button: the expanded rail puts a
    // group label above its destinations, and that label is content rather than empty space.
    const first = nav.firstElementChild
    return {
      above: (first?.getBoundingClientRect().top ?? navRect.top) - navRect.top,
      below: navRect.bottom - (items.at(-1)?.getBoundingClientRect().bottom ?? navRect.bottom),
      groups: nav.querySelectorAll('[role="group"]').length,
    }
  })
  expect(geometry.above, 'navigation destinations are packed under the header').toBeLessThanOrEqual(24)
  expect(geometry.below, 'the utility destination holds the foot of the rail').toBeLessThanOrEqual(24)
  expect(geometry.groups, 'destinations are grouped rather than one flat list').toBeGreaterThanOrEqual(2)
})

test('AI page actions stay beside their page titles', async ({ page }) => {
  for (const route of ['/reports', '/commitments-rewards', '/investments']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await waitForStableLayout(page)
    const button = page.getByRole('button', { name: /Explain .*Ask AI|Explain my portfolio/i }).first()
    await expect(button).toBeVisible()
    const aligned = await button.evaluate(element => {
      const heading = element.closest('header')?.querySelector('h1, h2')
      if (!heading) return false
      return element.parentElement === heading.parentElement
        || element.closest('[data-page-title-actions]')?.parentElement === heading.parentElement
    })
    expect(aligned, `${route} Ask AI action left the title row`).toBe(true)
  }
})

test('bill review never auto-opens and exposes no automatic-open preference', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  await expect(page.getByText('Bills to review')).toHaveCount(0)

  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)
  await expect(page.getByText(/Bill alerts when you open the app|Notify Bills/i)).toHaveCount(0)
})

test('the header action cluster stays pinned to the trailing edge', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()
  await waitForStableLayout(page)

  // Between md and xl both clusters lost their growth (`md:flex-initial` / `md:ml-0`, restored only
  // at `xl`), so every header control bunched against the leading edge instead of splitting.
  const gap = await page.evaluate(() => {
    const header = document.querySelector('header')
    const account = header?.querySelector<HTMLElement>('button[aria-label="Account menu"]')
    if (!header || !account) return null
    // Walk out to the cluster that sits directly inside the header's own flex container.
    let cluster: HTMLElement = account
    while (cluster.parentElement && cluster.parentElement.parentElement !== header) {
      cluster = cluster.parentElement
    }
    const bar = cluster.parentElement
    if (!bar) return null
    const paddingRight = parseFloat(getComputedStyle(bar).paddingRight) || 0
    return bar.getBoundingClientRect().right - paddingRight - cluster.getBoundingClientRect().right
  })
  expect(gap, 'header did not expose its account control').not.toBeNull()
  expect(gap!, 'header actions are not pinned to the trailing edge').toBeLessThanOrEqual(4)
})

// The legend is a scrolling box (max-h-40). Highlighting a row the user cannot see is no feedback
// at all, so hovering an arc brings its row into the legend's own view. jsdom reports every box as
// zero-sized, so this behaviour can only be proven with real layout.
test('hovering an outflow arc scrolls its legend row into the legend view', async ({ page }) => {
  await mockApi(page, {
    dashboard: {
      monthlyCategoryBreakdown: [
        { category: 'Household', amount: 1_400 },
        { category: 'Groceries', amount: 900 },
        { category: 'Transport', amount: 620 },
        { category: 'Loan', amount: 480 },
        { category: 'Health', amount: 300 },
        { category: 'Insurance', amount: 260 },
        { category: 'Utilities', amount: 210 },
        { category: 'Haircut', amount: 160 },
        { category: 'Hobbies', amount: 120 },
        { category: 'Entertainment', amount: 90 },
        { category: 'Subscriptions', amount: 60 },
        { category: 'Stationery', amount: 40 },
      ],
    },
  })
  await page.goto('/reports', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const outflowPanel = page.getByRole('heading', { name: 'Outflow Categories' })
    .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " app-panel ")]')
  const legendButtons = outflowPanel.locator('button[aria-label*="%"]')
  await expect(legendButtons.first()).toBeVisible()

  const lastRow = legendButtons.last()
  const arcs = outflowPanel.locator('svg path[tabindex="0"]')
  await expect(arcs).toHaveCount(await legendButtons.count())

  // Read the row's position relative to its own scroll box rather than the viewport: the panel
  // itself may sit anywhere on the page, and only the legend's clipping is under test.
  const containment = () => lastRow.evaluate(row => {
    const box = row.parentElement!
    const rowRect = row.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    return {
      scrollTop: box.scrollTop,
      scrolls: box.scrollHeight > box.clientHeight + 1,
      visible: rowRect.top >= boxRect.top - 1 && rowRect.bottom <= boxRect.bottom + 1,
    }
  })

  const before = await containment()
  expect(before.scrolls, 'the seeded categories overflow the legend box').toBe(true)
  expect(before.scrollTop).toBe(0)
  expect(before.visible, 'the last row starts out of view').toBe(false)

  // dispatchEvent rather than hover(): the smallest slice is a sliver whose bounding-box centre is
  // not on the path, so a real pointer move would land on a neighbour. It must be `mouseover` —
  // React synthesises onMouseEnter from delegated mouseover/mouseout at the root, so a native
  // non-bubbling `mouseenter` reaches no React handler at all.
  await arcs.last().dispatchEvent('mouseover')
  await expect.poll(async () => (await containment()).visible).toBe(true)
  expect((await containment()).scrollTop).toBeGreaterThan(0)

  // The highlight is what the scroll exists to show, so the row must actually be marked active.
  await expect(lastRow).toHaveClass(/bg-muted\/60/)
})

// The allocation legend used to be `overflow-hidden`, so in "Individual fund" mode every holding
// past the panel height was unreachable and the shared arc-hover reveal had nowhere to scroll. It is
// now a bounded scroll box, which only real layout can confirm.
test('hovering an allocation arc scrolls its legend row into the legend view', async ({ page }) => {
  const holding = (symbol: string, value: number) => ({
    accountId: 'acct-1',
    accountName: 'Broker',
    instrumentId: `inst-${symbol}`,
    symbol,
    name: `${symbol} Fund`,
    type: 'Etf',
    currency: 'MYR',
    units: 10,
    averageCostNative: value / 10,
    valueApp: value,
    fxIncomplete: false,
  })
  const holdings = [
    'AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF',
    'GGG', 'HHH', 'III', 'JJJ', 'KKK', 'LLL',
  ].map((symbol, index) => holding(symbol, 5_000 - index * 300))

  await mockApi(page, {
    investmentPortfolio: {
      holdings,
      accounts: [{ id: 'acct-1', name: 'Broker', currency: 'MYR' }],
      marketDataConfigured: true,
      summary: { growthLedgerBalance: 40_000, marketValue: 40_000, totalValue: 40_000 },
    },
  })
  await page.goto('/investments', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const panel = page.getByRole('heading', { name: 'Where your money sits' })
    .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " app-panel ")]')

  // The default "basket" grouping folds unclassified holdings into a single slice. Individual-fund
  // mode is the case this change exists for: one legend row per holding, more than the box can show.
  await panel.getByRole('combobox', { name: 'Group by' }).click()
  await page.getByRole('option', { name: 'Individual fund' }).click()

  const legendButtons = panel.locator('button[aria-label*="%"]')
  await expect.poll(() => legendButtons.count()).toBeGreaterThan(6)

  const lastRow = legendButtons.last()
  const containment = () => lastRow.evaluate(row => {
    const box = row.parentElement!
    const rowRect = row.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    return {
      scrollTop: box.scrollTop,
      scrolls: box.scrollHeight > box.clientHeight + 1,
      visible: rowRect.top >= boxRect.top - 1 && rowRect.bottom <= boxRect.bottom + 1,
    }
  })

  const before = await containment()
  expect(before.scrolls, 'the legend is a bounded scroll box, not a clipped one').toBe(true)
  expect(before.visible, 'the last holding starts out of view').toBe(false)

  await panel.locator('svg path[tabindex="0"]').last().dispatchEvent('mouseover')
  await expect.poll(async () => (await containment()).visible).toBe(true)
  expect((await containment()).scrollTop).toBeGreaterThan(0)
})
