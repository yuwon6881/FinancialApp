import * as api from './api'
import type { AssertionOptionsJson } from './webauthn'

type AssertionOptionsResult = {
  challengeId: string
  options: AssertionOptionsJson
}

type CacheKind = 'login' | 'assert'

type CacheEntry = {
  promise: Promise<AssertionOptionsResult>
  createdAt: number
  username?: string
}

const PREFETCH_TTL_MS = 4 * 60 * 1000
const cache: Record<CacheKind, CacheEntry | null> = {
  login: null,
  assert: null,
}

function getCachedOptions(
  kind: CacheKind,
  fetcher: () => Promise<AssertionOptionsResult>,
  username?: string
): Promise<AssertionOptionsResult> {
  const existing = cache[kind]
  if (existing && Date.now() - existing.createdAt < PREFETCH_TTL_MS && existing.username === username) {
    return existing.promise
  }

  const promise = fetcher()
  cache[kind] = { promise, createdAt: Date.now(), username }
  promise.catch(() => {
    if (cache[kind]?.promise === promise) {
      cache[kind] = null
    }
  })
  return promise
}

export function prefetchFingerprintLoginOptions(username?: string): Promise<AssertionOptionsResult> {
  return getCachedOptions('login', () => api.getFingerprintLoginOptions(username), username)
}

export function getCachedFingerprintLoginOptions(username?: string): Promise<AssertionOptionsResult> {
  return getCachedOptions('login', () => api.getFingerprintLoginOptions(username), username)
}

export function clearCachedFingerprintLoginOptions(): void {
  cache.login = null
}

export function prefetchFingerprintAssertOptions(): Promise<AssertionOptionsResult> {
  return getCachedOptions('assert', api.getFingerprintAssertOptions)
}

export function getCachedFingerprintAssertOptions(): Promise<AssertionOptionsResult> {
  return getCachedOptions('assert', api.getFingerprintAssertOptions)
}

export function clearCachedFingerprintAssertOptions(): void {
  cache.assert = null
}
