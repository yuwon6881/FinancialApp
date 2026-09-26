import { expect, test, type Page } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

/** Native bridge simulation exercises the actual shipped React UI; it is not handset proof. */
async function nativeCapture(page: Page, tapped: boolean) {
  await page.addInitScript(({ tapped }) => {
    const candidate: Record<string, unknown> = { id: 'capture-one', transactionId: '11111111-1111-4111-8111-111111111111', sourcePackage: 'bank.example', sourceLabel: 'Example bank', capturedAt: Date.now(), excerpt: 'Payment successful at COFFEE HOUSE', description: 'COFFEE HOUSE', possibleDuplicate: false }
    let tapId: string | undefined = tapped ? 'capture-one' : undefined
    let completed = false
    let enabled = true
    let packages = ['bank.example']
    const methods: Record<string, string[]> = {
      PurchaseCapture: ['activate', 'state', 'configure', 'applications', 'consumeTap', 'update', 'openAccessSettings', 'requestNotifications', 'openNotificationSettings', 'wipe'],
      SecureStorage: ['internalGetItem', 'internalSetItem', 'internalRemoveItem', 'getPrefixedKeys', 'setSynchronizeKeychain'],
      PrivacyScreen: ['setHidden'], App: ['getState'], SplashScreen: ['hide'], StatusBar: ['setStyle', 'setBackgroundColor'], Keyboard: ['setResizeMode'], BiometricAuthNative: ['checkBiometry', 'internalAuthenticate'],
    }
    const win = window as unknown as { CapacitorCustomPlatform: unknown; Capacitor: unknown }
    win.CapacitorCustomPlatform = { name: 'android' }
    win.Capacitor = {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({ name, methods: [...names.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] })),
      nativeCallback: () => 'listener',
      nativePromise: async (plugin: string, method: string, options: Record<string, unknown> = {}) => {
        if (plugin === 'SecureStorage' && method === 'internalGetItem') return { data: String(options.prefixedKey).endsWith('auth_token') ? JSON.stringify('visual-token') : null }
        if (plugin === 'App' && method === 'getState') return { isActive: true }
        if (plugin === 'BiometricAuthNative' && method === 'checkBiometry') return { isAvailable: true, deviceIsSecure: true, biometryType: 1, biometryTypes: [1] }
        if (plugin === 'BiometricAuthNative') return new Promise(resolve => { (window as unknown as { unlockDevice: () => void }).unlockDevice = () => resolve({}) })
        if (plugin !== 'PurchaseCapture') return {}
        if (method === 'state') return { enabled, packages, candidates: completed ? [] : [candidate], access: true, notifications: true, tapId }
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
  }, { tapped })
}

async function openNative(page: Page, tapped = false, tab = 'ledger') {
  await establishSession(page)
  await nativeCapture(page, tapped)
  await mockApi(page)
  await page.goto(`/${tab}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).toBeVisible()
  await expect(page.getByText('Detected purchase · Example bank')).not.toBeVisible()
  await page.waitForFunction(() => typeof (window as unknown as { unlockDevice?: unknown }).unlockDevice === 'function')
  await page.evaluate(() => (window as unknown as { unlockDevice: () => void }).unlockDevice())
}

test('native purchase tap opens the real Ledger form with unknown fields empty', async ({ page }) => {
  await openNative(page, true)
  const form = page.getByRole('dialog').filter({ has: page.getByText('Detected purchase · Example bank') })
  await expect(form).toBeVisible()
  await expect(form.getByLabel('Description', { exact: false })).toHaveValue('COFFEE HOUSE')
  await expect(form.getByLabel('Amount', { exact: false }).first()).toHaveValue('')
  await expect(form.getByRole('button', { name: 'Posting date (required)', exact: true })).toHaveText('Select date')
  await expect(form.getByRole('combobox', { name: 'Ledger category', exact: true })).toHaveText('Select a ledger category')
  await expect(form.getByText('Currency was not detected. Confirm the amount in MYR.')).toBeVisible()
  const overflow = await form.evaluate(element => element.scrollWidth > element.clientWidth)
  expect(overflow).toBe(false)
  await page.screenshot({ path: test.info().outputPath('purchase-review.png'), fullPage: true })
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Review (1)', exact: true }).click()
  await expect(page.getByText('COFFEE HOUSE', { exact: true })).toBeVisible()
})

test('Android settings select notification source apps with usable controls', async ({ page }) => {
  await openNative(page, false, 'settings')
  await page.getByRole('button', { name: 'Choose apps', exact: true }).click()
  const selection = page.getByRole('dialog', { name: 'Choose notification sources' })
  await expect(selection).toBeVisible()
  await expect(selection.getByRole('checkbox', { name: 'Example bank' })).toBeChecked()
  await page.screenshot({ path: test.info().outputPath('source-selection.png'), fullPage: true })
  await selection.getByRole('checkbox', { name: 'Example wallet' }).check()
  await selection.getByRole('button', { name: 'Save selection' }).click()
  await expect(page.getByText(/2 apps selected/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
