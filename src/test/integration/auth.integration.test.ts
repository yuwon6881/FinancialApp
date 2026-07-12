import { describe, it, expect, beforeEach } from 'vitest'
import { login, register, fetchAuthStatus, verifyTwoFactorLogin } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { state } from '@/test/msw/backend'

describe('auth integration (real api client ↔ mock backend)', () => {
  it('reports registration status from the backend', async () => {
    const status = await fetchAuthStatus()
    expect(status.isRegistered).toBe(true)
  })

  it('logs in and returns a token + username', async () => {
    const result = await login({ username: 'alice', password: 'Password123!' })
    expect(result).toMatchObject({ token: 'test-token-abc', username: 'alice' })
    expect('requiresTwoFactor' in result && result.requiresTwoFactor).toBeFalsy()
  })

  it('surfaces a wrong-password login as an ApiError(401)', async () => {
    await expect(login({ username: 'alice', password: 'nope' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
  })

  describe('two-factor', () => {
    beforeEach(() => {
      state.twoFactor = true
    })

    it('signals that a second factor is required, then completes with a code', async () => {
      const first = await login({ username: 'alice', password: 'Password123!' })
      expect('requiresTwoFactor' in first && first.requiresTwoFactor).toBe(true)
      const pendingToken = 'requiresTwoFactor' in first ? first.pendingToken : ''

      const second = await verifyTwoFactorLogin(pendingToken!, '123456')
      expect(second).toMatchObject({ token: 'test-token-abc', username: 'alice' })
    })

    it('rejects an invalid 2FA code', async () => {
      const first = await login({ username: 'alice', password: 'Password123!' })
      const pendingToken = 'requiresTwoFactor' in first ? first.pendingToken : ''
      await expect(verifyTwoFactorLogin(pendingToken!, '000000')).rejects.toBeInstanceOf(ApiError)
    })
  })

  it('rejects registration when a user already exists', async () => {
    // freshState() seeds registered=true, so register is closed.
    await expect(register({ username: 'bob', password: 'Password123!' })).rejects.toMatchObject({
      status: 400,
    })
  })
})
