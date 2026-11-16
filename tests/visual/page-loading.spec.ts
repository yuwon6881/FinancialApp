import { expect, test } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

test.use({ reducedMotion: 'no-preference' })

test('Budget reserves the split and rules layout while its view downloads', async ({ page }) => {
  await mockApi(page)
  await establishSession(page)
  const chunk = Promise.withResolvers<void>()
  await page.route('**/assets/SettingsView-*.js', async route => {
    await chunk.promise
    await route.continue()
  })
  await page.goto('/plan/budget', { waitUntil: 'domcontentloaded' })

  const skeleton = page.getByTestId('budget-skeleton')
  const stubSplit = skeleton.locator('.app-panel').first()
  const stubRules = skeleton.locator('.app-panel').last()
  let loadingSplit
  let loadingRules
  try {
    await expect(skeleton).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Plan sections' })).toBeVisible()
    loadingSplit = await stubSplit.boundingBox()
    loadingRules = await stubRules.boundingBox()
  } finally {
    chunk.resolve()
  }

  const split = page.getByRole('region', { name: 'Your split' })
  const rules = page.getByRole('region', { name: 'Rules' })
  await expect(split).toBeVisible()
  await expect(skeleton).toHaveCount(0)
  const loadedSplit = await split.boundingBox()
  const loadedRules = await rules.boundingBox()
  expect(Math.abs(loadedSplit!.y - loadingSplit!.y)).toBeLessThan(10)
  expect(Math.abs(loadedRules!.x - loadingRules!.x)).toBeLessThan(2)
  expect(loadedRules!.x > loadedSplit!.x).toBe(loadingRules!.x > loadingSplit!.x)
})

test('Vault keeps its header fixed as the document list resolves', async ({ page }) => {
  await mockApi(page)
  await establishSession(page)
  const documents = Promise.withResolvers<void>()
  await page.route(url => url.pathname.endsWith('/api/documents'), async route => {
    await documents.promise
    await route.fallback()
  })
  await page.goto('/vault', { waitUntil: 'domcontentloaded' })

  const heading = page.getByRole('heading', { name: 'Vault', exact: true })
  const listHeading = page.getByRole('heading', { name: 'Your documents' })
  const skeleton = page.getByTestId('documents-skeleton').filter({ has: heading })
  const upload = page.getByRole('button', { name: 'Upload', exact: true })
  let loadingHeader
  let loadingListHeading
  try {
    await expect(skeleton).toBeVisible()
    await expect(upload).toBeDisabled()
    await expect(listHeading).toBeVisible()
    loadingHeader = await heading.boundingBox()
    loadingListHeading = await listHeading.boundingBox()
  } finally {
    documents.resolve()
  }

  await expect(upload).toBeEnabled()
  await expect(skeleton).toHaveCount(0)
  expect(await heading.boundingBox()).toEqual(loadingHeader)
  expect(await listHeading.boundingBox()).toEqual(loadingListHeading)
  await expect(heading.locator('xpath=ancestor::*[contains(@class, "view-enter")]')).toHaveCount(0)
})
