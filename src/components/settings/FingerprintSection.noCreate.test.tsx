import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FingerprintSection } from './FingerprintSection'

const mocks = vi.hoisted(() => ({
  createCredential: vi.fn(),
  listCredentials: vi.fn(),
  platformAuthenticatorAvailable: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  listFingerprintCredentials: mocks.listCredentials,
}))

vi.mock('../../lib/webauthn', () => ({
  createFingerprintCredential: mocks.createCredential,
  getFriendlyDeviceLabel: vi.fn(() => 'This device'),
  isPlatformAuthenticatorAvailable: mocks.platformAuthenticatorAvailable,
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false }),
  useAppUi: () => ({ showToast: vi.fn() }),
}))

describe('FingerprintSection mount contract', () => {
  beforeEach(() => {
    mocks.createCredential.mockReset()
    mocks.listCredentials.mockResolvedValue([])
    mocks.platformAuthenticatorAvailable.mockResolvedValue(true)
    localStorage.clear()
  })

  it('does not create a WebAuthn credential while the Security tab mounts', async () => {
    render(<FingerprintSection />)

    expect(await screen.findByText('Not enabled')).toBeTruthy()
    expect(mocks.platformAuthenticatorAvailable).toHaveBeenCalledOnce()
    expect(mocks.createCredential).not.toHaveBeenCalled()
  })
})
