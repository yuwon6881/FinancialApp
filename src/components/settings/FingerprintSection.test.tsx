import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FingerprintSection } from './FingerprintSection'

const { createFingerprintCredential, getFingerprintRegisterOptions, isPlatformAuthenticatorAvailable } = vi.hoisted(() => ({
  createFingerprintCredential: vi.fn(),
  getFingerprintRegisterOptions: vi.fn(),
  isPlatformAuthenticatorAvailable: vi.fn(),
}))
const listFingerprintCredentials = vi.fn()
const deleteFingerprintCredential = vi.fn()

vi.mock('../../lib/api', () => ({
  listFingerprintCredentials: () => listFingerprintCredentials(),
  getFingerprintRegisterOptions,
  verifyFingerprintRegistration: vi.fn(),
  deleteFingerprintCredential: (id: string) => deleteFingerprintCredential(id),
}))

vi.mock('../../lib/webauthn', () => ({
  base64UrlToHex: vi.fn((value: string) => value),
  createFingerprintCredential,
  getFriendlyDeviceLabel: vi.fn(() => 'This device'),
  isPlatformAuthenticatorAvailable,
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false }),
  useAppUi: () => ({ showToast: vi.fn() }),
}))

describe('FingerprintSection', () => {
  beforeEach(() => {
    localStorage.clear()
    getFingerprintRegisterOptions.mockReset()
    createFingerprintCredential.mockReset()
    deleteFingerprintCredential.mockReset()
    listFingerprintCredentials.mockResolvedValue([
      { id: 'credential-on-another-device', deviceLabel: 'Other phone', createdAt: '2026-08-01T00:00:00Z' },
    ])
    isPlatformAuthenticatorAvailable.mockReset()
    isPlatformAuthenticatorAvailable.mockResolvedValue(true)
  })

  it('shows account-level availability instead of disabled on an unregistered device', async () => {
    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    expect(screen.queryByText('Disabled')).toBeNull()
    expect(screen.getByText('Enabled for this account; set up this device to use it here.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    expect(await screen.findByRole('button', { name: 'Set up this device' })).toBeTruthy()
  })

  it('does not open a native passkey prompt while the security tab loads', async () => {
    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    expect(getFingerprintRegisterOptions).not.toHaveBeenCalled()
    expect(createFingerprintCredential).not.toHaveBeenCalled()
  })

  it.each([
    ['unsupported', () => Promise.resolve(false)],
    ['rejected', () => Promise.reject(new Error('probe failed'))],
  ])('keeps account credentials visible when the capability probe is %s', async (_label, probe) => {
    isPlatformAuthenticatorAvailable.mockImplementation(probe)

    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))
    expect(await screen.findByText('Other phone')).toBeTruthy()
    expect(screen.getByText(/cannot add a local biometric/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set up this device' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps account credentials visible while the capability probe is pending', async () => {
    isPlatformAuthenticatorAvailable.mockReturnValue(new Promise(() => {}))

    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))
    expect(await screen.findByText('Other phone')).toBeTruthy()
    expect(screen.getByText(/Checking whether this device/i)).toBeTruthy()
  })

  it('shows credential load failures separately and retries', async () => {
    listFingerprintCredentials.mockRejectedValueOnce(new Error('Credentials unavailable'))

    render(<FingerprintSection />)

    expect(await screen.findByText('Unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))
    expect((await screen.findByRole('alert')).textContent).toContain('Credentials unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Other phone')).toBeTruthy()
  })

  it('shows a row-level state while removing a credential', async () => {
    let resolveDelete!: () => void
    deleteFingerprintCredential.mockReturnValue(new Promise<void>(resolve => { resolveDelete = resolve }))

    render(<FingerprintSection />)
    await screen.findByText('Available')
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    const remove = screen.getByRole('button', { name: 'Remove Other phone' })
    fireEvent.click(remove)

    expect(screen.getByRole('status', { name: 'Deleting Other phone…' })).toBeTruthy()
    expect(remove.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.queryByText('Deleting…')).toBeNull()
    expect(remove.hasAttribute('disabled')).toBe(true)

    await act(async () => resolveDelete())
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Deleting Other phone…' })).toBeNull())
  })
})
