import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TOKEN_KEY = 'auth_token'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('tokenStore platform selection', () => {
  it('uses the web store on non-native platforms', async () => {
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => false },
    }))
    const { tokenStore } = await import('./index')
    const { webTokenStore } = await import('./webTokenStore')
    expect(tokenStore).toBe(webTokenStore)
  })

  it('uses the native secure store on native platforms', async () => {
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => true },
    }))
    vi.doMock('@aparajita/capacitor-secure-storage', () => ({
      SecureStorage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    }))
    const { tokenStore } = await import('./index')
    const { nativeTokenStore } = await import('./nativeTokenStore')
    expect(tokenStore).toBe(nativeTokenStore)
  })
})

describe('webTokenStore', () => {
  it('never exposes a bearer token to JS and never persists the secret', async () => {
    const { webTokenStore } = await import('./webTokenStore')

    expect(await webTokenStore.getToken()).toBeNull()

    // Even after "storing" a token, getToken stays null (the cookie is the credential) and the
    // secret is never written to localStorage.
    await webTokenStore.setToken('super-secret-token')
    expect(await webTokenStore.getToken()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('tracks a non-secret session flag for optimistic reload restore', async () => {
    const { webTokenStore, hasWebSessionFlag } = await import('./webTokenStore')

    expect(hasWebSessionFlag()).toBe(false)

    await webTokenStore.setToken('super-secret-token')
    expect(hasWebSessionFlag()).toBe(true)
    expect(localStorage.getItem('auth_session')).toBe('1')

    await webTokenStore.clearToken()
    expect(hasWebSessionFlag()).toBe(false)
  })
})

describe('nativeTokenStore', () => {
  function mockSecureStorage() {
    const store = new Map<string, string>()
    const SecureStorage = {
      get: vi.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
      set: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
      remove: vi.fn(async (key: string) => { store.delete(key) }),
    }
    vi.doMock('@aparajita/capacitor-secure-storage', () => ({ SecureStorage }))
    return { store, SecureStorage }
  }

  it('migrates a legacy localStorage token, verifies the read-back, then deletes it', async () => {
    localStorage.setItem(TOKEN_KEY, 'legacy')
    const { SecureStorage } = mockSecureStorage()
    const { nativeTokenStore } = await import('./nativeTokenStore')

    const token = await nativeTokenStore.getToken()

    expect(token).toBe('legacy')
    expect(SecureStorage.set).toHaveBeenCalledWith(TOKEN_KEY, 'legacy')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('keeps the legacy token when the secure write throws', async () => {
    localStorage.setItem(TOKEN_KEY, 'legacy')
    const { SecureStorage } = mockSecureStorage()
    SecureStorage.set.mockRejectedValueOnce(new Error('secure storage unavailable'))
    const { nativeTokenStore } = await import('./nativeTokenStore')

    const token = await nativeTokenStore.getToken()

    expect(token).toBe('legacy')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('legacy')
  })

  it('keeps the legacy token when the read-back does not match', async () => {
    localStorage.setItem(TOKEN_KEY, 'legacy')
    const { SecureStorage } = mockSecureStorage()
    SecureStorage.get.mockResolvedValueOnce(null) // read-back returns nothing
    const { nativeTokenStore } = await import('./nativeTokenStore')

    const token = await nativeTokenStore.getToken()

    expect(token).toBe('legacy')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('legacy')
  })

  it('reads, writes, and clears the token in secure storage', async () => {
    mockSecureStorage()
    const { nativeTokenStore } = await import('./nativeTokenStore')

    expect(await nativeTokenStore.getToken()).toBeNull()

    await nativeTokenStore.setToken('secure-token')
    expect(await nativeTokenStore.getToken()).toBe('secure-token')

    await nativeTokenStore.clearToken()
    expect(await nativeTokenStore.getToken()).toBeNull()
  })
})

describe('auth session token lifecycle', () => {
  it('clears the web session flag on logout even if the network request fails', async () => {
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
    localStorage.setItem('auth_session', '1')
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })

    const api = await import('../api')
    await api.logout()

    expect(localStorage.getItem('auth_session')).toBeNull()
  })

  it('resolves logout even when token and CSRF storage cleanup both throw', async () => {
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true })
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const api = await import('../api')

    await expect(api.logout()).resolves.toBeUndefined()
    expect(removeItem).toHaveBeenCalledWith('auth_session')
    expect(removeItem).toHaveBeenCalledWith('csrf_token')
  })
})
