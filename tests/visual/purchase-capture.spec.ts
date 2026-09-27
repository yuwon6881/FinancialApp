import { expect, test, type Page } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

/** Native bridge simulation exercises the actual shipped React UI; it is not handset proof. */
async function nativeCapture(page: Page, tapped: boolean, access = true, transactionType: 'outflow' | 'transfer' = 'outflow') {
  await page.addInitScript(({ tapped, access, transactionType }) => {
    const candidate: Record<string, unknown> = { id: 'capture-one', transactionId: '11111111-1111-4111-8111-111111111111', sourcePackage: 'bank.example', sourceLabel: 'Example bank', capturedAt: Date.now(), excerpt: 'Payment successful at COFFEE HOUSE', description: 'COFFEE HOUSE', transactionType, possibleDuplicate: false }
    let tapId: string | undefined = tapped ? 'capture-one' : undefined
    let completed = false
    let enabled = true
    let packages = ['bank.example']
    let active = true
    const listeners = new Map<string, (event: { isActive: boolean }) => void>()
    let listenerId = 0
    const simulation = window as unknown as { emitNativeState: (active: boolean) => void; authRequests: number }
    simulation.authRequests = 0
    simulation.emitNativeState = value => { active = value; listeners.forEach(callback => callback({ isActive: value })) }
    const methods: Record<string, string[]> = {
      PurchaseCapture: ['activate', 'state', 'configure', 'applications', 'consumeTap', 'update', 'openAccessSettings', 'requestNotifications', 'openNotificationSettings', 'wipe'],
      SecureStorage: ['internalGetItem', 'internalSetItem', 'internalRemoveItem', 'getPrefixedKeys', 'setSynchronizeKeychain'],
      PrivacyScreen: ['setHidden'], App: ['getState'], SplashScreen: ['hide'], StatusBar: ['setStyle', 'setBackgroundColor'], Keyboard: ['setResizeMode'], BiometricAuthNative: ['checkBiometry', 'internalAuthenticate'],
    }
    const win = window as unknown as { CapacitorCustomPlatform: unknown; Capacitor: unknown }
    win.CapacitorCustomPlatform = { name: 'android' }
    win.Capacitor = {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({ name, methods: [...names.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] })),
      nativeCallback: (plugin: string, method: string, options: Record<string, unknown>, callback: (event: { isActive: boolean }) => void) => {
        const id = String(++listenerId)
        if (plugin === 'App' && method === 'addListener' && options.eventName === 'appStateChange') listeners.set(id, callback)
        return id
      },
      nativePromise: async (plugin: string, method: string, options: Record<string, unknown> = {}) => {
        if (plugin === 'SecureStorage' && method === 'internalGetItem') return { data: String(options.prefixedKey).endsWith('auth_token') ? JSON.stringify('visual-token') : null }
        if (method === 'removeListener') listeners.delete(String(options.callbackId))
        if (plugin === 'App' && method === 'getState') return { isActive: active }
        if (plugin === 'BiometricAuthNative' && method === 'checkBiometry') return { isAvailable: true, deviceIsSecure: true, biometryType: 1, biometryTypes: [1] }
        if (plugin === 'BiometricAuthNative') { simulation.authRequests++; return new Promise(resolve => { (window as unknown as { unlockDevice: () => void }).unlockDevice = () => resolve({}) }) }
        if (plugin !== 'PurchaseCapture') return {}
        if (method === 'state') return { enabled, packages, candidates: completed ? [] : [candidate], access, notifications: true, tapId }
        if (method === 'openAccessSettings' || method === 'openNotificationSettings') simulation.emitNativeState(false)
        if (method === 'configure') { enabled = Boolean(options.enabled); packages = options.packages as string[] }
        if (method === 'consumeTap') tapId = undefined
        if (method === 'applications') return { applications: [{ packageName: 'bank.example', label: 'Example bank' }, { packageName: 'wallet.example', label: 'Example wallet' }] }
        if (method === 'update') {
          if (options.action === 'edit') candidate.edits = options.data
          if (options.action === 'prepare') candidate.prepared = options.data
          if (options.action === 'complete' || options.action === 'discard') completed = true
          return candidate
        }
        return {}
      },
    }
  }, { tapped, access, transactionType })
}

async function openNative(page: Page, tapped = false, tab = 'ledger', access = true, transactionType: 'outflow' | 'transfer' = 'outflow') {
  await establishSession(page)
  await nativeCapture(page, tapped, access, transactionType)
  await mockApi(page)
  await page.goto(`/${tab}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).toBeVisible()
  await expect(page.getByText('Detected from Example bank')).not.toBeVisible()
  await page.waitForFunction(() => typeof (window as unknown as { unlockDevice?: unknown }).unlockDevice === 'function')
  await page.evaluate(() => (window as unknown as { unlockDevice: () => void }).unlockDevice())
}

test('native purchase tap opens the real Ledger form with unknown fields empty', async ({ page }) => {
  await openNative(page, true)
  const form = page.getByRole('dialog').filter({ has: page.getByText('Detected from Example bank') })
  await expect(form).toBeVisible()
  await expect(form.getByLabel('Description', { exact: false })).toHaveValue('COFFEE HOUSE')
  await expect(form.getByLabel('Amount', { exact: false }).first()).toHaveValue('')
  await expect(form.getByRole('button', { name: 'Posting date (required)', exact: true })).not.toHaveText('Select date')
  await expect(form.getByText('Date is taken from when the alert arrived. Change it if the payment happened on another day.')).toBeVisible()
  await expect(form.getByRole('combobox', { name: 'Ledger category', exact: true })).toHaveText('Select a ledger category')
  await expect(form.getByText('The alert did not show a currency. Enter the amount in MYR.')).toBeVisible()
  const overflow = await form.evaluate(element => element.scrollWidth > element.clientWidth)
  expect(overflow).toBe(false)
  await page.screenshot({ path: test.info().outputPath('purchase-review.png'), fullPage: true })
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Review 1 detected transaction', exact: true }).click()
  await expect(page.getByText('COFFEE HOUSE', { exact: true })).toBeVisible()
})

test('permission setup is required and does not launch biometrics over Android settings', async ({ page }) => {
  await openNative(page, false, 'settings', false)
  const card = page.getByRole('region', { name: 'Transaction detection' })
  await expect(card.getByText('Not listening yet — allow notification access in Android settings.')).toBeVisible()
  await expect(card.getByRole('switch')).toBeChecked()
  await card.screenshot({ path: test.info().outputPath('purchase-detection-settings.png') })
  await card.getByRole('button', { name: 'Finish setup' }).click()
  await page.getByRole('button', { name: 'Grant notification access', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { authRequests: number }).authRequests)).toBe(1)
  await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).not.toBeVisible()
  await page.evaluate(() => (window as unknown as { emitNativeState: (active: boolean) => void }).emitNativeState(true))
  await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { authRequests: number }).authRequests)).toBe(2)
})

test('transfer notification opens as an outflow purchase draft', async ({ page }) => {
  await openNative(page, true, 'ledger', true, 'transfer')
  const form = page.getByRole('dialog').filter({ has: page.getByText('Detected from Example bank') })
  await expect(form).toBeVisible()
  await expect(form.getByRole('radio', { name: /Outflow/ })).toBeChecked()
  await expect(form.getByRole('combobox', { name: 'Ledger category', exact: true })).toHaveText('Select a ledger category')
})

test('Android settings select notification source apps with usable controls', async ({ page }) => {
  await openNative(page, false, 'settings')
  await expect(page.getByRole('switch', { name: 'Detect transactions on this device' })).toBeChecked()
  await page.getByRole('button', { name: 'Manage detection' }).click()
  await page.getByRole('button', { name: 'Change apps', exact: true }).click()
  const selection = page.getByRole('dialog', { name: 'Choose notification sources' })
  await expect(selection).toBeVisible()
  await expect(selection.getByRole('checkbox', { name: 'Example bank' })).toBeChecked()
  await page.screenshot({ path: test.info().outputPath('source-selection.png'), fullPage: true })
  await selection.getByRole('checkbox', { name: 'Example wallet' }).check()
  await selection.getByRole('button', { name: 'Save selection' }).click()
  await expect(selection).toBeHidden()
  await expect(page.getByText('2 apps selected. Only these apps are read.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
