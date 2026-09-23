import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FingerprintSection } from './FingerprintSection'

const {
  createFingerprintCredential,
  getFingerprintAssertion,
  getFingerprintAssertOptions,
  getFingerprintRegisterOptions,
  isPlatformAuthenticatorAvailable,
  verifyFingerprintAssert,
  verifyFingerprintRegistration,
  showToast,
} = vi.hoisted(() => ({
  createFingerprintCredential: vi.fn(),
  getFingerprintAssertion: vi.fn(),
  getFingerprintAssertOptions: vi.fn(),
  getFingerprintRegisterOptions: vi.fn(),
  isPlatformAuthenticatorAvailable: vi.fn(),
  verifyFingerprintAssert: vi.fn(),
  verifyFingerprintRegistration: vi.fn(),
  showToast: vi.fn(),
}))
const listFingerprintCredentials = vi.fn()
const deleteFingerprintCredential = vi.fn()

vi.mock('../../lib/api', () => ({
  listFingerprintCredentials: () => listFingerprintCredentials(),
  getFingerprintAssertOptions,
  getFingerprintRegisterOptions,
  verifyFingerprintAssert,
  verifyFingerprintRegistration,
  deleteFingerprintCredential: (id: string) => deleteFingerprintCredential(id),
}))

vi.mock('../../lib/webauthn', () => ({
  base64UrlToHex: vi.fn((value: string) => value),
  createFingerprintCredential,
  getFingerprintAssertion,
  getFriendlyDeviceLabel: vi.fn(() => 'This device'),
  isPlatformAuthenticatorAvailable,
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false }),
  useAppUi: () => ({ showToast }),
}))

describe('FingerprintSection', () => {
  beforeEach(() => {
    localStorage.clear()
    getFingerprintRegisterOptions.mockReset()
    getFingerprintRegisterOptions.mockResolvedValue({ challengeId: 'register-1', options: {} })
    verifyFingerprintRegistration.mockReset()
    verifyFingerprintRegistration.mockResolvedValue({ verified: true })
    createFingerprintCredential.mockReset()
    deleteFingerprintCredential.mockReset()
    listFingerprintCredentials.mockResolvedValue([
      { id: 'credential-on-another-device', deviceLabel: 'Other phone', createdAt: '2026-08-01T00:00:00Z' },
    ])
    isPlatformAuthenticatorAvailable.mockReset()
    isPlatformAuthenticatorAvailable.mockResolvedValue(true)
    getFingerprintAssertOptions.mockReset()
    getFingerprintAssertOptions.mockResolvedValue({ challengeId: 'assert-1', options: {} })
    getFingerprintAssertion.mockReset()
    verifyFingerprintAssert.mockReset()
    verifyFingerprintAssert.mockResolvedValue({ verified: true })
    showToast.mockReset()
  })

  it('shows account-level availability instead of disabled on an unregistered device', async () => {
    render(<FingerprintSection />)

    expect(await screen.findByText('Available')).toBeTruthy()
    expect(screen.queryByText('Disabled')).toBeNull()
    expect(screen.getByText('Enabled for this account; set up this device to use it here.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    expect(await screen.findByRole('button', { name: 'Set up this device' })).toBeTruthy()
  })

  it('verifies an existing passkey after duplicate creation and records its exact credential id', async () => {
    localStorage.setItem('auth_username', 'alice')
    createFingerprintCredential.mockRejectedValue(Object.assign(new Error('Credential already exists'), { name: 'InvalidStateError' }))
    getFingerprintAssertion.mockResolvedValue({ id: 'AQID', authenticatorAttachment: 'platform' })
    listFingerprintCredentials.mockImplementation(async () => [
      { id: 'AQID', deviceLabel: 'This phone', createdAt: '2026-08-01T00:00:00Z' },
    ])

    render(<FingerprintSection />)
    await screen.findByText('Available')
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    const setupButton = await screen.findByRole('button', { name: 'Set up this device' })
    await waitFor(() => expect(setupButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(setupButton)

    await waitFor(() => expect(verifyFingerprintAssert).toHaveBeenCalledWith('assert-1', expect.objectContaining({ id: 'AQID' })))
    await waitFor(() => expect(localStorage.getItem('fingerprint_credential_id_on_this_device:ALICE')).toBe('AQID'))
    expect(verifyFingerprintRegistration).not.toHaveBeenCalled()
    expect(await screen.findByText('Enabled here')).toBeTruthy()
  })

  it('does not request an assertion challenge when Android has a duplicate passkey absent from the account', async () => {
    localStorage.setItem('auth_username', 'alice')
    listFingerprintCredentials.mockResolvedValue([])
    createFingerprintCredential.mockRejectedValue(Object.assign(new Error('Credential already exists'), { name: 'InvalidStateError' }))

    render(<FingerprintSection />)
    await screen.findByText('Not enabled')
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))
    const setupButton = await screen.findByRole('button', { name: 'Enable on this device' })
    await waitFor(() => expect(setupButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(setupButton)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/passkey already exists on this phone/i),
      'Device unlock needs reset',
      'error',
    ))
    expect(getFingerprintAssertOptions).not.toHaveBeenCalled()
    expect(verifyFingerprintAssert).not.toHaveBeenCalled()
  })

  it('does not offer a separate restore action once this browser knows its credential', async () => {
    listFingerprintCredentials.mockResolvedValue([
      { id: 'ABCDEF', deviceLabel: 'This browser', createdAt: '2026-08-01T00:00:00Z' },
    ])
    localStorage.setItem('auth_username', 'alice')
    localStorage.setItem('fingerprint_credential_id_on_this_device:ALICE', 'ABCDEF')

    render(<FingerprintSection />)
    await screen.findByText('Enabled here')
    fireEvent.click(screen.getByRole('button', { name: /Device Unlock/i }))

    await screen.findByRole('button', { name: 'Add another credential' })
    expect(screen.queryByRole('button', { name: /restore on this device/i })).toBeNull()
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
    expect(screen.queryByRole('button', { name: /restore on this device/i })).toBeNull()
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
