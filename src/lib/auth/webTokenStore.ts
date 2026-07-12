import type { TokenStore } from './tokenStore'

// Browser sessions authenticate purely via the HttpOnly `auth_token` cookie set by the server, so
// the bearer secret is never exposed to JavaScript (and cannot be exfiltrated by XSS). We persist
// only a non-secret flag so a reload can optimistically restore the logged-in view; the cookie is
// the real credential, and an invalid/expired cookie simply 401s on the first request.
const SESSION_FLAG = 'auth_session'

export const webTokenStore: TokenStore = {
  async getToken(): Promise<string | null> {
    // No bearer token on the web — the cookie carries auth. Returning null means getHeadersAsync
    // never attaches an Authorization header, so requests are authenticated by the cookie alone.
    return null
  },
  async setToken(): Promise<void> {
    localStorage.setItem(SESSION_FLAG, '1')
  },
  async clearToken(): Promise<void> {
    localStorage.removeItem(SESSION_FLAG)
  },
}

/** Whether this browser has an established (cookie-backed) session to optimistically restore. */
export function hasWebSessionFlag(): boolean {
  return localStorage.getItem(SESSION_FLAG) === '1'
}
