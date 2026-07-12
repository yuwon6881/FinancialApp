import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import type { TokenStore } from './tokenStore'

const TOKEN_KEY = 'auth_token'

export const nativeTokenStore: TokenStore = {
  async getToken(): Promise<string | null> {
    // 1. One-time migration from localStorage if it exists. Only delete the legacy
    // token once we have confirmed the value is readable back from secure storage,
    // so a failed/partial write can never lose the token.
    const legacyToken = localStorage.getItem(TOKEN_KEY)
    if (legacyToken) {
      try {
        await SecureStorage.set(TOKEN_KEY, legacyToken)
        const persisted = await SecureStorage.get(TOKEN_KEY)
        if (persisted === legacyToken) {
          localStorage.removeItem(TOKEN_KEY)
        } else {
          console.warn('Secure storage read-back did not match; keeping legacy token')
        }
        return legacyToken
      } catch (err) {
        console.warn('Failed to migrate legacy token to secure storage', err)
        // Fall back to the still-present legacy token rather than losing the session.
        return legacyToken
      }
    }

    try {
      const value = await SecureStorage.get(TOKEN_KEY)
      return (value as string) || null
    } catch {
      // If key doesn't exist, plugin might throw or return null
      return null
    }
  },

  async setToken(token: string): Promise<void> {
    await SecureStorage.set(TOKEN_KEY, token)
  },

  async clearToken(): Promise<void> {
    try {
      await SecureStorage.remove(TOKEN_KEY)
    } catch {
      // Ignore errors if key didn't exist
    }
  }
}
