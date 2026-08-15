import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nativePlatform = vi.hoisted(() => ({ value: false }))
const secureStorage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativePlatform.value },
}))

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: secureStorage,
}))

async function loadClient() {
  vi.resetModules()
  return import('./client')
}

describe('cachedGet', () => {
  beforeEach(() => {
    nativePlatform.value = false
    secureStorage.get.mockReset()
    secureStorage.set.mockReset()
    secureStorage.remove.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('dedupes concurrent callers even when they pass AbortSignals', async () => {
    const { cachedGet } = await loadClient()
    const load = vi.fn().mockResolvedValue('data')
    const a = cachedGet('key', load, { signal: new AbortController().signal })
    const b = cachedGet('key', load, { signal: new AbortController().signal })

    await expect(a).resolves.toBe('data')
    await expect(b).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('serves the cached promise to signal-less callers within staleTime', async () => {
    const { cachedGet } = await loadClient()
    const load = vi.fn().mockResolvedValue('data')
    await cachedGet('key', load)
    await cachedGet('key', load)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('aborting one subscriber rejects only that subscriber and keeps the cache warm', async () => {
    const { cachedGet } = await loadClient()
    let resolveLoad: (value: string) => void = () => {}
    const load = vi.fn().mockImplementation(
      () => new Promise<string>(resolve => { resolveLoad = resolve }),
    )
    const ac = new AbortController()
    const aborted = cachedGet('key', load, { signal: ac.signal })
    const kept = cachedGet('key', load, { signal: new AbortController().signal })

    ac.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })

    resolveLoad('data')
    await expect(kept).resolves.toBe('data')
    await expect(cachedGet('key', load)).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('rejects immediately for an already-aborted signal without evicting the cache', async () => {
    const { cachedGet } = await loadClient()
    const load = vi.fn().mockResolvedValue('data')
    await cachedGet('key', load)

    const ac = new AbortController()
    ac.abort()
    await expect(cachedGet('key', load, { signal: ac.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })

    await expect(cachedGet('key', load)).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('evicts a failed load so the next caller retries', async () => {
    const { cachedGet } = await loadClient()
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('data')

    await expect(cachedGet('key', load)).rejects.toThrow('network down')
    await expect(cachedGet('key', load)).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reloads after staleTime expires', async () => {
    const { cachedGet } = await loadClient()
    const load = vi.fn().mockResolvedValue('data')
    await cachedGet('key', load, { staleTime: 1000 })
    vi.advanceTimersByTime(1001)
    await cachedGet('key', load, { staleTime: 1000 })
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('api client transport contracts', () => {
  beforeEach(() => {
    nativePlatform.value = false
    secureStorage.get.mockReset()
    secureStorage.set.mockReset()
    secureStorage.remove.mockReset()
    localStorage.setItem('auth_session', '1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches the web CSRF header and cookie credentials to unsafe requests', async () => {
    const { apiFetch } = await loadClient()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 200,
        headers: { 'X-CSRF-Token': 'csrf-from-server' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/transactions', { method: 'POST', body: '{}' })

    const bootstrapInit = fetchMock.mock.calls[0][1] as RequestInit
    const mutationInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost/api/auth/csrf')
    expect(bootstrapInit.credentials).toBe('include')
    expect(new Headers(mutationInit.headers).get('X-CSRF-Token')).toBe('csrf-from-server')
    expect(new Headers(mutationInit.headers).get('Authorization')).toBeNull()
    expect(mutationInit.credentials).toBe('include')
  })

  it('attaches the native bearer token and omits cookies', async () => {
    nativePlatform.value = true
    secureStorage.get.mockResolvedValue('native-token')
    const { apiFetch } = await loadClient()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/transactions')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer native-token')
    expect(headers.get('X-FinancialApp-Client')).toBe('native')
    expect(init.credentials).toBe('omit')
  })

  it('turns protected 401 and 423 responses into the expected client errors', async () => {
    const { apiFetch, SESSION_LOCKED_EVENT } = await loadClient()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 423 }))
    vi.stubGlobal('fetch', fetchMock)
    const locked = vi.fn()
    window.addEventListener(SESSION_LOCKED_EVENT, locked)

    await expect(apiFetch('/transactions')).rejects.toMatchObject({ status: 401 })
    await expect(apiFetch('/transactions')).rejects.toMatchObject({ status: 423 })

    expect(locked).toHaveBeenCalledOnce()
    window.removeEventListener(SESSION_LOCKED_EVENT, locked)
  })

  it('parses Retry-After into ApiError.retryAfterMs', async () => {
    const { request, parseRetryAfter } = await loadClient()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'try later', code: 'busy' }),
      { status: 429, headers: { 'Retry-After': '3' } },
    )))

    await expect(request('/transactions', { errorMessage: 'fallback' }))
      .rejects.toMatchObject({ message: 'try later', status: 429, retryAfterMs: 3000, code: 'busy' })
    expect(parseRetryAfter('0')).toBe(0)
    expect(parseRetryAfter('not-a-date')).toBeUndefined()
  })

  it('reuses the decoded ETag payload after a conditional 304', async () => {
    const { request } = await loadClient()
    sessionStorage.setItem('csrf_token', 'csrf-for-test')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'first' }), {
        status: 200,
        headers: { ETag: 'W/"first"' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/documents/usage', { errorMessage: 'failed' })).resolves.toEqual({ value: 'first' })
    await expect(request('/documents/usage', { errorMessage: 'failed' })).resolves.toEqual({ value: 'first' })

    const revalidationCall = fetchMock.mock.calls.find(([, init]) => {
      return new Headers((init as RequestInit).headers).has('If-None-Match')
    })
    expect(revalidationCall).toBeDefined()
    expect(new Headers((revalidationCall?.[1] as RequestInit).headers).get('If-None-Match'))
      .toBe('W/"first"')
  })

  it('passes the caller AbortSignal through to fetch', async () => {
    const { apiFetch } = await loadClient()
    const signal = new AbortController().signal
    let observedSignal: AbortSignal | null | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      observedSignal = init.signal
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
    }))

    await expect(apiFetch('/transactions', { signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(observedSignal).toBe(signal)
  })
})
