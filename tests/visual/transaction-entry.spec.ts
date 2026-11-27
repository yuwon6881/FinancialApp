import { expect, test } from '@playwright/test'
import { establishSession, mockApi, openTransactionForm } from './visualTestSupport'

const isCompact = () => (test.info().project.use.viewport?.width ?? 0) < 640

test('the transaction sheet keeps its save actions pinned inside a short viewport', async ({ page }) => {
  const width = test.info().project.use.viewport?.width ?? 390
  await page.setViewportSize({ width, height: 560 })
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer', { exact: true }).first()).toBeVisible({ timeout: 25_000 })
  await openTransactionForm(page)
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  await expect(dialog).toBeVisible()

  const save = dialog.getByRole('button', { name: 'Add Transaction', exact: true })
  const another = dialog.getByRole('button', { name: 'Save & new', exact: true })
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
  // The compact sheet slides up into place; measure once it has settled.
  await expect.poll(
    () => dialog.evaluate(element => element.getBoundingClientRect().bottom <= window.innerHeight + 1),
    { timeout: 5_000 },
  ).toBe(true)
  const geometry = await dialog.evaluate(element => {
    const panel = element.getBoundingClientRect()
    const footer = element.querySelector('form > :last-child')!.getBoundingClientRect()
    return { scrolls: element.scrollHeight > element.clientHeight + 1, panelBottom: panel.bottom, footerBottom: footer.bottom, viewport: window.innerHeight }
  })
  // The form is taller than this viewport, yet the actions sit on the sheet's visible bottom edge.
  expect(geometry.scrolls).toBe(true)
  // Flush with the sheet's bottom edge: no form content may show beneath the bar.
  expect(Math.abs(geometry.footerBottom - geometry.panelBottom)).toBeLessThanOrEqual(2)
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewport + 1)
  for (const button of [save, another, cancel]) {
    await expect(button).toBeInViewport()
    const box = (await button.boundingBox())!
    // Rounded: the centered sheet scales in, which leaves a sub-pixel shortfall mid-animation.
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44)
    // One line of label: a wrapped label doubles the height.
    expect(box.height).toBeLessThan(60)
  }
  if (isCompact()) {
    // Primary on its own row above Cancel and "add another", which share one row.
    const [saveBox, anotherBox, cancelBox] = await Promise.all([save.boundingBox(), another.boundingBox(), cancel.boundingBox()])
    expect(saveBox!.y).toBeLessThan(anotherBox!.y)
    expect(Math.abs(anotherBox!.y - cancelBox!.y)).toBeLessThanOrEqual(1)
  }
  await page.screenshot({ path: test.info().outputPath('transaction-sheet-pinned.png') })

  // Scrolling the form leaves the actions where they are.
  await dialog.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(save).toBeInViewport()
  await dialog.evaluate(element => { element.scrollTop = 0 })
  await expect(save).toBeInViewport()
})

test('Save & new keeps the sheet open on a blank entry', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer', { exact: true }).first()).toBeVisible({ timeout: 25_000 })
  await openTransactionForm(page)
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  const description = dialog.getByLabel('Transaction description', { exact: false })
  await description.fill('Morning coffee')
  await dialog.getByRole('textbox', { name: /Amount/ }).fill('6.50')
  await dialog.getByRole('radiogroup', { name: 'Quick categories' }).getByRole('radio', { name: 'Food', exact: true }).click()
  await dialog.getByRole('radiogroup', { name: 'From bucket' }).getByRole('radio', { name: 'Essentials', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save & new', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(description).toHaveValue('')
  await expect(dialog.getByRole('textbox', { name: /Amount/ })).toHaveValue('')
  await expect(description).toBeFocused()
  // A second draft must be possible before the app navigates to review.
  await description.fill('Afternoon coffee')
  await dialog.getByRole('textbox', { name: /Amount/ }).fill('8.00')
  await dialog.getByRole('radiogroup', { name: 'Quick categories' }).getByRole('radio', { name: 'Food', exact: true }).click()
  await dialog.getByRole('radiogroup', { name: 'From bucket' }).getByRole('radio', { name: 'Essentials', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review drafts', level: 1 })).toBeVisible()
  await expect(page.getByText('Morning coffee', { exact: true })).toBeVisible()
  await expect(page.getByText('Afternoon coffee', { exact: true })).toBeVisible()
})

test('tapping a compact ledger row opens it for editing', async ({ page }) => {
  test.skip(!isCompact(), 'Tap-to-edit is the compact swipe row shortcut; wider tiers show inline actions.')
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  const row = page.locator('[data-swipe-content]').filter({ hasText: 'Neighbourhood Grocer' }).first()
  await expect(row).toBeVisible({ timeout: 25_000 })
  await row.click({ position: { x: 120, y: 20 } })
  await expect(page.getByRole('dialog', { name: 'Edit Transaction' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit Transaction' }).getByLabel('Transaction description', { exact: false })).toHaveValue('Neighbourhood Grocer')
})

test('Enter in a transaction field performs an ordinary save', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Neighbourhood Grocer', { exact: true }).first()).toBeVisible({ timeout: 25_000 })
  await openTransactionForm(page)
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' })
  const description = dialog.getByLabel('Transaction description', { exact: false })
  await description.fill('Keyboard coffee')
  await dialog.getByRole('textbox', { name: /Amount/ }).fill('6.50')
  await dialog.getByRole('radiogroup', { name: 'Quick categories' }).getByRole('radio', { name: 'Food', exact: true }).click()
  await dialog.getByRole('radiogroup', { name: 'From bucket' }).getByRole('radio', { name: 'Essentials', exact: true }).click()
  await description.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Review drafts', level: 1 })).toBeVisible()
})

test('compact ledger actions can be opened and dismissed by keyboard', async ({ page }) => {
  test.skip(!isCompact(), 'Wider ledger rows already expose inline actions.')
  await establishSession(page)
  await mockApi(page)
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: 'Actions for Neighbourhood Grocer', exact: true }).first()
  await trigger.focus({ timeout: 25_000 })
  await trigger.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const edit = page.getByRole('button', { name: 'Edit Neighbourhood Grocer', exact: true })
  await expect(edit).toBeFocused()
  await edit.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.press('Enter')
  await edit.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Edit Transaction' })).toBeVisible()
})
