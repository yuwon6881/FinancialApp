import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginView } from './LoginView'
import * as api from '../lib/api'
import { isPlatformAuthenticatorAvailable } from '../lib/webauthn'

vi.mock('../lib/api', () => ({
  fetchAuthStatus: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  verifyTwoFactorLogin: vi.fn(),
  verifyFingerprintLogin: vi.fn(),
}))

vi.mock('../lib/webauthn', () => ({
  isPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
  getFingerprintAssertion: vi.fn(),
}))

describe('LoginView validation', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(isPlatformAuthenticatorAvailable).mockResolvedValue(false)
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: false,
      registrationOpen: true,
      hasFingerprint: false,
      hasFingerprintOnDevice: false,
    })
  })

  it('hides device unlock when the account credential is registered on another device', async () => {
    vi.mocked(isPlatformAuthenticatorAvailable).mockResolvedValue(true)
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: true,
      registrationOpen: false,
      hasFingerprint: true,
      hasFingerprintOnDevice: false,
    })
    render(<LoginView onLoginSuccess={vi.fn()} />)

    fireEvent.change(await screen.findByRole('textbox', { name: /Username/ }), { target: { value: 'alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(api.fetchAuthStatus).toHaveBeenCalledWith('alice'))
    expect(screen.queryByRole('button', { name: 'Unlock with device' })).toBeNull()
  })

  it('shows device unlock when this device credential belongs to the account', async () => {
    vi.mocked(isPlatformAuthenticatorAvailable).mockResolvedValue(true)
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: true,
      registrationOpen: false,
      hasFingerprint: true,
      hasFingerprintOnDevice: true,
    })
    render(<LoginView onLoginSuccess={vi.fn()} />)

    fireEvent.change(await screen.findByRole('textbox', { name: /Username/ }), { target: { value: 'alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('button', { name: 'Unlock with device' })).toBeTruthy()
  })

  it('uses field errors, focuses the first invalid field, and makes no API mutation', async () => {
    render(<LoginView onLoginSuccess={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }))

    const username = screen.getByRole('textbox', { name: /Username/ })
    expect(screen.getByText('Username is required.')).not.toBeNull()
    expect(screen.getByText('Password is required.')).not.toBeNull()
    expect(screen.getByText('Confirm password is required.')).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(username))
    expect(api.register).not.toHaveBeenCalled()
    expect(api.login).not.toHaveBeenCalled()

    fireEvent.change(username, { target: { value: 'alex' } })
    expect(screen.queryByText('Username is required.')).toBeNull()
    expect(screen.getByText('Password is required.')).not.toBeNull()
  })
})
