import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginView } from './LoginView'
import * as api from '../lib/api'

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
    vi.mocked(api.fetchAuthStatus).mockResolvedValue({
      isRegistered: false,
      registrationOpen: true,
      hasFingerprint: false,
    })
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
