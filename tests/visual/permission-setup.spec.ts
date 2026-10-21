import { expect, test, type Page } from '@playwright/test'
import { establishSession, mockApi } from './visualTestSupport'

/**
 * A fresh Android installation, simulated through the Capacitor bridge so the shipped React UI is
 * what runs. Not handset proof: the system dialogs themselves are answered by this simulation.
 */
async function freshAndroid(page: Page, { seen = false, notifications = 'prompt' }: { seen?: boolean; notifications?: string } = {}) {
  await page.addInitScript(({ seen, notifications }) => {
    if (seen) localStorage.setItem('financialapp.permissionSetup.v1', 'skipped')
    let receive = notifications
    let enabled = false
    let access = false
    let packages: string[] = []
    let active = true
    const listeners = new Map<string, (event: { isActive: boolean }) => void>()
    let listenerId = 0
    const simulation = window as unknown as { unlockDevice?: () => void; permissionRequests: string[] }
    simulation.permissionRequests = []
    const emit = (value: boolean) => { active = value; listeners.forEach(callback => callback({ isActive: value })) }
    const methods: Record<string, string[]> = {
      PurchaseCapture: ['activate', 'state', 'reconnect', 'configure', 'applications', 'consumeTap', 'update', 'openAccessSettings', 'requestNotifications', 'openNotificationSettings', 'openBatterySettings', 'wipe'],
      PushNotifications: ['checkPermissions', 'requestPermissions', 'register', 'createChannel'],
      FCM: ['getToken', 'refreshToken'],
      NativePushConfiguration: ['isConfigured'],
      Camera: ['checkPermissions', 'requestPermissions'],
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
        if (plugin === 'BiometricAuthNative') return new Promise(resolve => { simulation.unlockDevice = () => resolve({}) })
        if (plugin === 'NativePushConfiguration') return { configured: true }
        if (plugin === 'FCM') return { token: 'visual-fcm-token' }
        // Android needs no camera permission while the manifest does not declare CAMERA.
        if (plugin === 'Camera') return { camera: 'granted', photos: 'granted' }
        if (plugin === 'PushNotifications' && method === 'checkPermissions') return { receive }
        if (plugin === 'PushNotifications' && method === 'requestPermissions') {
          simulation.permissionRequests.push('notifications')
          receive = 'granted'
          return { receive }
        }
        if (plugin !== 'PurchaseCapture') return {}
        if (method === 'state') return { enabled, packages, candidates: [], access, notifications: receive === 'granted', batteryUnrestricted: false, listenerConnected: true }
        if (method === 'configure') { enabled = Boolean(options.enabled); packages = options.packages as string[] }
        if (method === 'openAccessSettings') { simulation.permissionRequests.push('access'); emit(false); access = true }
        if (method === 'openNotificationSettings' || method === 'openBatterySettings') { simulation.permissionRequests.push(method); emit(false) }
        if (method === 'applications') return { applications: [{ packageName: 'bank.example', label: 'Example bank' }, { packageName: 'wallet.example', label: 'Example wallet' }] }
        return {}
      },
    }
  }, { seen, notifications })
}

async function openApp(page: Page, options: Parameters<typeof freshAndroid>[1] = {}) {
  await establishSession(page)
  await freshAndroid(page, options)
  await mockApi(page)
  // The push status follows what this installation enrols for, as the API's does.
  const channels = { billRemindersEnabled: false, categoryAlertsEnabled: false }
  await page.route('**/api/push/**', async route => {
    const request = route.request()
    if (request.method() === 'PUT' || request.method() === 'POST') {
      const body = request.postDataJSON() as { billReminders?: boolean; categoryAlerts?: boolean } | null
      if (body?.billReminders) channels.billRemindersEnabled = true
      if (body?.categoryAlerts) channels.categoryAlertsEnabled = true
      return route.fulfill({ status: 204 })
    }
    if (new URL(request.url()).pathname.endsWith('/push/status')) {
      const registered = channels.billRemindersEnabled || channels.categoryAlertsEnabled
      return route.fulfill({ json: { enabled: registered, deviceRegistered: registered, tokenRenewalRequired: false, ...channels, otherDevicesBillReminders: false, otherDevicesCategoryAlerts: false } })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).toBeVisible()
  await page.waitForFunction(() => typeof (window as unknown as { unlockDevice?: unknown }).unlockDevice === 'function')
  await page.evaluate(() => (window as unknown as { unlockDevice: () => void }).unlockDevice())
}

const sheetOf = (page: Page) => page.getByRole('dialog', { name: 'App permissions' })

test('a fresh installation is offered every permission in one sheet after sign-in', async ({ page }) => {
  await openApp(page)
  const sheet = sheetOf(page)
  await expect(sheet).toBeVisible()
  const rows = sheet.getByRole('list', { name: 'Permissions' })
  await expect(rows.getByRole('listitem', { name: 'Notifications' })).toContainText('Not allowed')
  await expect(rows.getByRole('listitem', { name: 'Camera' })).toContainText('Allowed')
  await expect(rows.getByRole('listitem', { name: 'Transaction detection' })).toContainText('Not allowed')
  await expect(sheet.getByText('1 of 3 allowed')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Not now' })).toBeVisible()
  expect(await sheet.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(false)
  for (const name of ['Allow all', 'Not now', 'Allow: Notifications', 'Set up: Transaction detection']) {
    const button = sheet.getByRole('button', { name })
    await button.click({ trial: true })
    const hit = await button.evaluate(element => {
      const box = element.getBoundingClientRect()
      return { height: box.height, receivesPointer: element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) }
    })
    expect(hit.receivesPointer).toBe(true)
    expect(hit.height).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) < 1024 ? 44 : 36)
  }
  await sheet.screenshot({ path: test.info().outputPath('permission-setup-fresh.png') })

  await sheet.getByRole('button', { name: 'Allow: Notifications' }).click()
  await expect(rows.getByRole('listitem', { name: 'Notifications' })).toContainText('Allowed')
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: string[] }).permissionRequests)).toContain('notifications')
  await expect(sheet.getByText('2 of 3 allowed')).toBeVisible()
  await sheet.screenshot({ path: test.info().outputPath('permission-setup-partial.png') })

  // Detection goes through its own consent first, then Android's access page, then source apps.
  await sheet.getByRole('button', { name: 'Set up: Transaction detection' }).click()
  const consent = page.getByRole('dialog', { name: 'Read transaction notifications' })
  await expect(consent).toBeVisible()
  await consent.getByRole('button', { name: 'Agree and continue' }).click()
  const sources = page.getByRole('dialog', { name: 'Choose notification sources' })
  await expect(sources).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: string[] }).permissionRequests)).toContain('access')

  await page.keyboard.press('Escape')
  await expect(sources).toHaveCount(0)
  await expect(rows.getByRole('listitem', { name: 'Transaction detection' })).toContainText('Setup needed')
  await expect(sheet.getByRole('button', { name: 'Choose apps: Transaction detection' })).toBeVisible()
  await expect(rows.getByRole('listitem', { name: 'Keep detection running' })).toContainText('Optional')
  await sheet.screenshot({ path: test.info().outputPath('permission-setup-detection.png') })

  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('financialapp.permissionSetup.v1'))).toBe('skipped')
})

test('the sheet is not offered again, and Settings opens the same one', async ({ page }) => {
  await openApp(page, { seen: true, notifications: 'denied' })
  await expect(page.getByRole('navigation').first()).toBeVisible()
  await page.waitForTimeout(1_500)
  await expect(sheetOf(page)).toHaveCount(0)

  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Unlock FinancialApp' })).toBeVisible()
  await page.waitForFunction(() => typeof (window as unknown as { unlockDevice?: unknown }).unlockDevice === 'function')
  await page.evaluate(() => (window as unknown as { unlockDevice: () => void }).unlockDevice())
  const card = page.getByRole('region', { name: 'App permissions' })
  await expect(card).toBeVisible()
  await card.screenshot({ path: test.info().outputPath('permission-settings-card.png') })
  await card.getByRole('button', { name: 'Manage permissions' }).click()
  const sheet = sheetOf(page)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Close' })).toBeVisible()
  const notifications = sheet.getByRole('listitem', { name: 'Notifications' })
  await expect(notifications).toContainText('Blocked')
  await expect(notifications.getByText('Turn them on in Android settings.', { exact: false })).toBeVisible()
  await sheet.screenshot({ path: test.info().outputPath('permission-setup-blocked.png') })
  await notifications.getByRole('button', { name: 'Open settings: Notifications' }).click()
  expect(await page.evaluate(() => (window as unknown as { permissionRequests: string[] }).permissionRequests)).toContain('openNotificationSettings')
})
