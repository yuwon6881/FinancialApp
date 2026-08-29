export const SESSION_LOCKED_EVENT = 'financialapp:session-locked'
import { hasWebSessionFlag, tokenStore, usesCookieAuth } from '../auth'
import { STALE_LOCK_CODE } from '../errors'
import { recordRefreshHeader, REFRESH_HEADER_NAME } from '../refreshSlices'

export class ApiError extends Error {
  status: number
  /**
   * The server's own `Retry-After`, in milliseconds, when it sent one. The outbox
   * honours it instead of its own backoff curve: a 429 or a 503 that names a wait
   * is the only party that knows when the next attempt can succeed.
   */
  retryAfterMs?: number
  /**
   * The server's machine-readable reason, when it sent one (`ledger_account_required`,
   * `ledger_account_invalid`). A 4xx is normally terminal and unactionable, but a refusal the user
   * can fix has to be told apart from one they cannot — the outbox turns this into the account
   * review path instead of the generic "this change could not be saved".
   */
  code?: string
  /** The buckets the refusal names, so the fix can say which accounts are missing. */
  missingBuckets?: string[]
  constructor(
    message: string,
    status: number,
    retryAfterMs?: number,
    code?: string,
    missingBuckets?: string[],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterMs = retryAfterMs
    this.code = code
    this.missingBuckets = missingBuckets
  }
}

/** `Retry-After` is either delta-seconds or an HTTP date; both resolve to a wait in ms. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, at - now)
}

const getApiBaseUrl = (): string => {
  // Browser clients use the Vercel same-origin proxy in production. Keeping the
  // auth cookie first-party prevents installed mobile PWAs from losing access to
  // a cross-site Cloud Run cookie when the standalone app process is restarted.
  // Native Capacitor builds continue to call Cloud Run directly and authenticate
  // with the bearer token held in secure storage.
  if (!import.meta.env.DEV && usesCookieAuth) return '/api'
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (import.meta.env.DEV) {
    const host = typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost'
    return `http://${host}:5000/api`
  }
  return '/api'
}

export const API_BASE_URL = getApiBaseUrl()

interface CacheEntry {
  promise: Promise<unknown>
  timestamp: number
  staleTime: number
}

const cacheStore = new Map<string, CacheEntry>()
const revalidationStore = new Map<string, { etag: string; payload: unknown }>()

export function invalidateCache(): void {
  cacheStore.clear()
  revalidationStore.clear()
}

// The cached promise is shared between callers, so `load` must NOT be tied to any
// caller's AbortSignal: one subscriber aborting would poison the entry for the rest.
// Instead the caller's signal only detaches that caller (their promise rejects with
// AbortError) while the underlying fetch runs to completion and warms the cache.
export function cachedGet<T>(
  key: string,
  load: () => Promise<T>,
  options: { signal?: AbortSignal; staleTime?: number } = {},
): Promise<T> {
  const existing = cacheStore.get(key)
  let promise: Promise<T>
  if (existing && Date.now() - existing.timestamp <= existing.staleTime) {
    promise = existing.promise as Promise<T>
  } else {
    if (existing) cacheStore.delete(key)
    promise = load()
    cacheStore.set(key, {
      promise,
      timestamp: Date.now(),
      staleTime: options.staleTime ?? 30_000,
    })
    promise.catch(() => {
      if (cacheStore.get(key)?.promise === promise) cacheStore.delete(key)
    })
  }
  return withAbort(promise, options.signal)
}

/** Seed a GET cache with an authoritative response received through another endpoint. */
export function primeCached<T>(key: string, value: T, staleTime = 30_000): void {
  const promise = Promise.resolve(value)
  cacheStore.set(key, { promise, timestamp: Date.now(), staleTime })
  // The composite response has no ETag for this individual path. Establish a fresh validator
  // when this seeded value expires instead of reusing a validator for an older body.
  revalidationStore.delete(key)
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(newAbortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(newAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      err => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

function newAbortError(): Error {
  return new DOMException('The operation was aborted.', 'AbortError')
}

/**
 * A 423 only means "locked now" if the session has not been unlocked since the request left.
 *
 * The inactivity lock and an unlock overlap on a cold start: the idle check locks the session on
 * the server while the user is already typing their password, and every request in flight across
 * that window answers 423 afterwards. Re-locking on those replies threw the user straight back to
 * the lock screen, which is why the first unlock never appeared to take. Each request stamps the
 * unlock counter it started under; a reply carrying an older stamp is stale, so it neither
 * re-locks the app nor counts as a lock error.
 */
let sessionUnlockEpoch = 0

/** Record that the session is unlocked again, invalidating every 423 still in flight. */
export function noteSessionUnlocked(): void {
  sessionUnlockEpoch += 1
}

function handleApiResponse(response: Response, url: string, requestUnlockEpoch: number): Response {
  if (!response.ok) {
    const isAuthBootstrap = url.includes('/auth/login')
      || url.includes('/auth/status')
      || url.includes('/auth/webauthn')
    if (response.status === 401 && !isAuthBootstrap) {
      throw new ApiError('401 Unauthorized', 401)
    }
    if (response.status === 423 && !isAuthBootstrap) {
      if (requestUnlockEpoch !== sessionUnlockEpoch) {
        throw new ApiError('423 Locked (stale)', 423, undefined, STALE_LOCK_CODE)
      }
      window.dispatchEvent(new CustomEvent(SESSION_LOCKED_EVENT, { detail: { url } }))
      throw new ApiError('423 Locked', 423)
    }
  }
  return response
}

async function getHeadersAsync(additionalHeaders: HeadersInit = {}): Promise<HeadersInit> {
  const token = await tokenStore.getToken()
  const headers = new Headers(additionalHeaders)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

function apiUrl(path: string): string {
  return path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE_URL}${path}`
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const CSRF_SESSION_KEY = 'csrf_token'
let csrfBootstrapPromise: Promise<string | null> | null = null

// Backs the double-submit CSRF defence: the server issues a readable `csrf_token` cookie alongside
// the HttpOnly auth cookie, and browser mutations must echo it in the X-CSRF-Token header. Native
// clients authenticate with a bearer header and no cookie, so this returns null and is a no-op there.
function readCsrfToken(): string | null {
  const stored = sessionStorage.getItem(CSRF_SESSION_KEY)
  if (stored) return stored
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function rememberCsrfToken(response: Response): void {
  const token = response.headers.get(CSRF_HEADER_NAME)
  if (token) sessionStorage.setItem(CSRF_SESSION_KEY, token)
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCsrfToken()
  // Avoid a needless bootstrap request for anonymous calls (login, registration,
  // and tests). A cookie-authenticated session always has this non-secret marker.
  if (existing || !usesCookieAuth || !hasWebSessionFlag()) return existing

  csrfBootstrapPromise ??= fetch(apiUrl('/auth/csrf'), {
    credentials: 'include',
  })
    .then(response => {
      rememberCsrfToken(response)
      return response.ok ? readCsrfToken() : null
    })
    .catch(() => null)
    .finally(() => { csrfBootstrapPromise = null })

  return csrfBootstrapPromise
}

export async function apiFetch(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const url = apiUrl(path)
  const requestUnlockEpoch = sessionUnlockEpoch
  const headers = new Headers(authenticated ? await getHeadersAsync(init.headers) : init.headers)
  if (!usesCookieAuth) headers.set('X-FinancialApp-Client', 'native')
  const method = (init.method ?? 'GET').toUpperCase()
  if (UNSAFE_METHODS.has(method)) {
    const csrfToken = await ensureCsrfToken()
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  }
  const response = await fetch(url, {
    ...init,
    credentials: usesCookieAuth ? 'include' : 'omit',
    headers,
  })
  rememberCsrfToken(response)
  if (UNSAFE_METHODS.has(method) && response.ok) {
    recordRefreshHeader(response.headers.get(REFRESH_HEADER_NAME))
  }
  return handleApiResponse(response, url, requestUnlockEpoch)
}

export async function throwApiError(
  response: Response,
  fallbackMessage: string,
  messageField: 'message' | 'reply' = 'message',
): Promise<never> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  const message = body[messageField]
  throw new ApiError(
    typeof message === 'string' && message ? message : fallbackMessage,
    response.status,
    parseRetryAfter(response.headers.get('Retry-After')),
    typeof body.code === 'string' ? body.code : undefined,
    Array.isArray(body.missingBuckets)
      ? body.missingBuckets.filter((bucket): bucket is string => typeof bucket === 'string')
      : undefined,
  )
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean
  errorMessage: string
  errorMessageField?: 'message' | 'reply'
}

/**
 * Last seen ETag and decoded body per GET path, for conditional requests.
 *
 * The API returns weak ETags with `Cache-Control: private, no-cache` (see the backend's
 * ConditionalGetMiddleware). Sending `If-None-Match` lets an unchanged payload come back as a
 * bodyless 304, which saves the download *and* the JSON parse — on a phone the parse is often
 * the more noticeable half.
 *
 * This is intentionally its own in-memory map rather than a hook into `cache.ts`: cache.ts
 * stores a few named offline snapshots keyed by domain concept, whereas revalidation needs the
 * exact bytes that produced a specific ETag, keyed by request path. Conflating them would let a
 * 304 on one path resolve to a snapshot written by another.
 *
 * Per-tab and in-memory only, so it is dropped on reload and never outlives a logout (which
 * calls invalidateCache below).
 */
// A bound so a long session cannot accumulate a payload per distinct query string (the ledger's
// filter combinations are effectively unbounded). Oldest insertion is evicted first; losing an
// entry only costs one full response.
const MAX_REVALIDATION_ENTRIES = 32

function rememberRevalidation(key: string, etag: string, payload: unknown) {
  if (revalidationStore.size >= MAX_REVALIDATION_ENTRIES && !revalidationStore.has(key)) {
    const oldest = revalidationStore.keys().next()
    if (!oldest.done) revalidationStore.delete(oldest.value)
  }
  revalidationStore.set(key, { etag, payload })
}

export function invalidateCacheKey(key: string): void {
  cacheStore.delete(key)
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key)
  }
}

export function invalidateRevalidationPrefix(prefix: string): void {
  for (const key of revalidationStore.keys()) {
    if (key.startsWith(prefix)) revalidationStore.delete(key)
  }
}

export async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const {
    authenticated = true,
    errorMessage,
    errorMessageField,
    ...init
  } = options

  const method = (init.method ?? 'GET').toUpperCase()
  const revalidationKey = method === 'GET' && authenticated ? path : null
  const known = revalidationKey ? revalidationStore.get(revalidationKey) : undefined

  if (known) {
    const headers = new Headers(init.headers)
    headers.set('If-None-Match', known.etag)
    init.headers = headers
  }

  const response = await apiFetch(path, init, authenticated)

  if (response.status === 304 && known) {
    // Unchanged: reuse the decoded body we already hold. No parse, no transfer.
    return known.payload as T
  }

  if (!response.ok) await throwApiError(response, errorMessage, errorMessageField)

  // A successful response may intentionally have no representation. Collection
  // callers normalize this to an empty list instead of treating it as a load error.
  if (response.status === 204) return undefined as T

  const payload = await response.json() as T
  const etag = revalidationKey ? response.headers.get('ETag') : null
  if (revalidationKey && etag) rememberRevalidation(revalidationKey, etag, payload)
  return payload
}

export async function requestVoid(path: string, options: RequestOptions): Promise<void> {
  const {
    authenticated = true,
    errorMessage,
    errorMessageField,
    ...init
  } = options
  const response = await apiFetch(path, init, authenticated)
  if (!response.ok) await throwApiError(response, errorMessage, errorMessageField)
}

export function jsonBody(value: unknown): Pick<RequestInit, 'headers' | 'body'> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }
}
