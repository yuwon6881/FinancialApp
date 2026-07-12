import { Capacitor } from '@capacitor/core'
import type { TokenStore } from './tokenStore'
import { webTokenStore, hasWebSessionFlag } from './webTokenStore'
import { nativeTokenStore } from './nativeTokenStore'

/** True when running as a browser SPA (cookie auth), false for the native Capacitor app (bearer). */
export const usesCookieAuth = !Capacitor.isNativePlatform()

/**
 * Opaque marker used as the in-memory session token on the web, where the real bearer token is never
 * held by JavaScript. It gates the app's logged-in UI; it is never sent as a credential (the web
 * token store returns null from getToken, so no Authorization header is attached — the cookie is used).
 */
export const WEB_COOKIE_SESSION = 'cookie-session'

export const tokenStore: TokenStore = Capacitor.isNativePlatform()
  ? nativeTokenStore
  : webTokenStore

/** Resolves the session-gate token at startup: the native bearer token, or the web cookie marker. */
export async function resolveSessionToken(): Promise<string | null> {
  const stored = await tokenStore.getToken()
  if (stored) return stored
  if (usesCookieAuth && hasWebSessionFlag()) return WEB_COOKIE_SESSION
  return null
}

export type { TokenStore } from './tokenStore'
export { hasWebSessionFlag } from './webTokenStore'
