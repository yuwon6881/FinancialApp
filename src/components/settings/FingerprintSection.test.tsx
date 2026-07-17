import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FingerprintSection } from './FingerprintSection'

const listFingerprintCredentials = vi.fn()

vi.mock('../../lib/api', () => ({
  listFingerprintCredentials: () => listFingerprintCredentials(),
  getFingerprintRegisterOptions: vi.fn(),
  verifyFingerprintRegistration: vi.fn(),
  deleteFingerprintCredential: vi.fn(),
}))

vi.mock('../../lib/webauthn', () => ({
  base64UrlToHex: vi.fn((value: string) => value),
  createFingerprintCredential: vi.fn(),
  getFriendlyDeviceLabel: vi.fn(() => 'This device'),
  isPlatformAuthenticatorAvailable: vi.fn(async () => true),
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppContext: () => ({
    hideSensitive: false,
    showToast: vi.fn(),
  }),
}))

describe('FingerprintSection', () => {
  beforeEach(() => {
    localStorage.clear()
    listFingerprintCredentials.mockResolvedValue([
      { id: 'credential-on-another-device', deviceLabel: 'Other phone' },
    ])
  })

  it('shows account-level availability instead of disabled on an unregistered device', async () => {
    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    expect(screen.queryByText('Disabled')).toBeNull()
    expect(screen.getByText('Enabled for this account; set up this device to use it here.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Fingerprint Login/i }))

    expect(await screen.findByRole('button', { name: 'Set up this device' })).toBeTruthy()
  })
})
