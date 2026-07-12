export const SESSION_LOCKED_EVENT = 'financialapp:session-locked'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const getApiBaseUrl = (): string => {
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

export function invalidateCache(): void {
  cacheStore.clear()
}

export function cachedGet<T>(
  key: string,
  load: () => Promise<T>,
  options: { signal?: AbortSignal; staleTime?: number } = {},
): Promise<T> {
  if (options.signal) return load()

  const existing = cacheStore.get(key)
  if (existing) {
    if (Date.now() - existing.timestamp <= existing.staleTime) {
      return existing.promise as Promise<T>
    }
    cacheStore.delete(key)
  }

  const promise = load()
  cacheStore.set(key, {
    promise,
    timestamp: Date.now(),
    staleTime: options.staleTime ?? 30_000,
  })
  promise.catch(() => {
    if (cacheStore.get(key)?.promise === promise) cacheStore.delete(key)
  })
  return promise
}

function handleApiResponse(response: Response, url: string): Response {
  if (!response.ok) {
    const isAuthBootstrap = url.includes('/auth/login')
      || url.includes('/auth/status')
      || url.includes('/auth/webauthn')
    if (response.status === 401 && !isAuthBootstrap) {
      throw new ApiError('401 Unauthorized', 401)
    }
    if (response.status === 423 && !isAuthBootstrap) {
      window.dispatchEvent(new CustomEvent(SESSION_LOCKED_EVENT, { detail: { url } }))
      throw new ApiError('423 Locked', 423)
    }
  }
  return response
}

export function getHeaders(additionalHeaders: HeadersInit = {}): HeadersInit {
  const token = localStorage.getItem('auth_token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...additionalHeaders,
  }
}

export function apiUrl(path: string): string {
  return path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE_URL}${path}`
}

export async function apiFetch(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const url = apiUrl(path)
  const response = await fetch(url, {
    ...init,
    headers: authenticated ? getHeaders(init.headers) : init.headers,
  })
  return handleApiResponse(response, url)
}

export async function throwApiError(
  response: Response,
  fallbackMessage: string,
  messageField: 'message' | 'reply' = 'message',
): Promise<never> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  const message = body[messageField]
  throw new ApiError(typeof message === 'string' && message ? message : fallbackMessage, response.status)
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean
  errorMessage: string
  errorMessageField?: 'message' | 'reply'
}

export async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const {
    authenticated = true,
    errorMessage,
    errorMessageField,
    ...init
  } = options
  const response = await apiFetch(path, init, authenticated)
  if (!response.ok) await throwApiError(response, errorMessage, errorMessageField)
  return response.json() as Promise<T>
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
