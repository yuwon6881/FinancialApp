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

test('navigation rail balances the unused space above and below its destinations', async ({ page }) => {
  test.skip((test.info().project.use.viewport?.width ?? 0) < 640, 'The compact tier uses bottom navigation.')
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await waitForStableLayout(page)

  const gaps = await page.locator('aside nav[aria-label="Primary"]').evaluate(nav => {
    const items = Array.from(nav.querySelectorAll<HTMLElement>(':scope > button'))
    const navRect = nav.getBoundingClientRect()
    return {
      above: (items[0]?.getBoundingClientRect().top ?? navRect.top) - navRect.top,
      below: navRect.bottom - (items.at(-1)?.getBoundingClientRect().bottom ?? navRect.bottom),
    }
  })
  expect(Math.abs(gaps.above - gaps.below), 'navigation destinations remain top-packed').toBeLessThanOrEqual(2)
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
