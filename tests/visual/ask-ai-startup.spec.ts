import { expect, test, type Page } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

async function openChat(page: Page) {
  await page.goto('/ledger', { waitUntil: 'domcontentloaded' })
  if ((page.viewportSize()?.width ?? 0) < 640) {
    await page.getByRole('button', { name: 'Open Menu' }).click()
    await page.getByRole('menuitem', { name: 'Ask AI', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'ASK AI', exact: true }).click()
  }
}

async function holdHistory(page: Page) {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/ai/conversation*', async route => {
    await ready
    await route.fulfill({ json: {
      conversationId: 'saved-chat', conversationVersion: 4,
      messages: [{ role: 'user', content: 'Earlier question' }, { role: 'assistant', content: 'Earlier answer' }],
      state: null, pendingActionBatches: [],
    } })
  })
  return release
}

test('history arriving preserves the focused composer, text and caret', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  const release = await holdHistory(page)
  await openChat(page)
  const input = page.getByRole('combobox', { name: 'Ask AI', exact: true })
  await expect(input).toBeEditable()
  await input.fill('Badminton 20')
  await input.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(5, 5)
    element.dataset.blurs = '0'
    element.addEventListener('blur', () => { element.dataset.blurs = String(Number(element.dataset.blurs) + 1) })
  })
  if ((page.viewportSize()?.width ?? 0) < 640) await page.setViewportSize({ width: 390, height: 500 })
  await page.screenshot({ path: test.info().outputPath('typing-during-startup.png') })
  release()
  await expect(page.getByText('Earlier answer', { exact: true })).toBeVisible()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('Badminton 20')
  expect(await input.evaluate((element: HTMLTextAreaElement) => ({ caret: element.selectionStart, blurs: element.dataset.blurs }))).toEqual({ caret: 5, blurs: '0' })
  await input.press('End')
  await input.press('!')
  await expect(input).toHaveValue('Badminton 20!')
  await page.screenshot({ path: test.info().outputPath('history-loaded-while-typing.png') })
})

test('an explicitly sent startup message waits for history and then opens its transaction draft once', async ({ page }) => {
  await establishSession(page)
  await mockApi(page)
  const release = await holdHistory(page)
  const requests: Record<string, unknown>[] = []
  await page.route('**/api/ai/chat/stream', async route => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ contentType: 'text/event-stream', body: `event: done\ndata: ${JSON.stringify({
      reply: 'I prepared a draft for review.',
      actions: [{ type: 'openAddLedgerDraft', payload: { description: 'Badminton', amount: 20, transactionType: 'outflow', category: 'Entertainment', ledgerCategory: 'Essentials' } }],
      closeChat: true, conversationId: 'saved-chat', conversationVersion: 5,
    })}\n\n` })
  })
  await openChat(page)
  await page.getByRole('combobox', { name: 'Ask AI', exact: true }).fill('Badminton 20')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(page.getByText(/Your message will send when/)).toBeVisible()
  expect(requests).toHaveLength(0)
  release()
  await expect(page).toHaveURL(/\/drafts/)
  await expect(page.getByText('Badminton', { exact: true })).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ message: 'Badminton 20', conversationId: 'saved-chat', conversationVersion: 4 })
  await page.screenshot({ path: test.info().outputPath('startup-transaction-draft.png') })
})
