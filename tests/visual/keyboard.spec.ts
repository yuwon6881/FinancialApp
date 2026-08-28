import { expect, test } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

test.beforeEach(async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('mobile'), 'Keyboard journey runs once on the phone matrix.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-07-30T10:00:00+08:00'))
  await establishSession(page)
  await mockApi(page)
})

test('menu and global search restore focus after Escape', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const menuButton = page.getByRole('button', { name: 'Open Menu' })
  await menuButton.focus()
  await menuButton.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(menuButton).toBeFocused()

  await menuButton.press('Enter')
  await page.getByRole('menuitem', { name: 'Search' }).press('Enter')
  const search = page.getByRole('combobox', { name: 'Search query' })
  await expect(search).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toBeHidden()
})

test('settings tabs are keyboard reachable and retain a visible focus target', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  const tabs = page.getByRole('tab')
  await expect(tabs.first()).toBeVisible()
  await tabs.first().focus()
  for (let index = 0; index < Math.min(await tabs.count(), 4); index += 1) {
    await page.keyboard.press('ArrowRight')
    await expect(page.locator(':focus')).toBeVisible()
  }
})
