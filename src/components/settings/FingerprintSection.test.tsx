import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FingerprintSection } from './FingerprintSection'

const listFingerprintCredentials = vi.fn()
const deleteFingerprintCredential = vi.fn()

vi.mock('../../lib/api', () => ({
  listFingerprintCredentials: () => listFingerprintCredentials(),
  getFingerprintRegisterOptions: vi.fn(),
  verifyFingerprintRegistration: vi.fn(),
  deleteFingerprintCredential: (id: string) => deleteFingerprintCredential(id),
}))

vi.mock('../../lib/webauthn', () => ({
  base64UrlToHex: vi.fn((value: string) => value),
  createFingerprintCredential: vi.fn(),
  getFriendlyDeviceLabel: vi.fn(() => 'This device'),
  isPlatformAuthenticatorAvailable: vi.fn(async () => true),
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false }),
  useAppUi: () => ({ showToast: vi.fn() }),
}))

describe('FingerprintSection', () => {
  beforeEach(() => {
    localStorage.clear()
    deleteFingerprintCredential.mockReset()
    listFingerprintCredentials.mockResolvedValue([
      { id: 'credential-on-another-device', deviceLabel: 'Other phone' },
    ])
  })

  it('shows account-level availability instead of disabled on an unregistered device', async () => {
    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    expect(screen.queryByText('Disabled')).toBeNull()
    expect(screen.getByText('Enabled for this account; set up this device to use it here.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    expect(await screen.findByRole('button', { name: 'Set up this device' })).toBeTruthy()
  })

  it('shows a row-level state while removing a credential', async () => {
    let resolveDelete!: () => void
    deleteFingerprintCredential.mockReturnValue(new Promise<void>(resolve => { resolveDelete = resolve }))

    render(<FingerprintSection />)
    await screen.findByText('Available')
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    const remove = screen.getByRole('button', { name: 'Remove Other phone' })
    fireEvent.click(remove)

    expect(screen.getByText('Deleting…')).toBeTruthy()
    expect(remove.hasAttribute('disabled')).toBe(true)

    await act(async () => resolveDelete())
    await waitFor(() => expect(screen.queryByText('Deleting…')).toBeNull())
  })
})
