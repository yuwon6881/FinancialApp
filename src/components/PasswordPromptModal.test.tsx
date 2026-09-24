import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordPromptModal } from './PasswordPromptModal'

describe('PasswordPromptModal device verification', () => {
  it('places the password verification first and presents device unlock as a separated alternative', () => {
    render(
      <PasswordPromptModal
        isOpen
        onClose={vi.fn()}
        onVerified={vi.fn()}
        onTryFingerprint={vi.fn().mockResolvedValue(true)}
      />,
    )

    const password = screen.getByPlaceholderText('Enter password')
    const verify = screen.getByRole('button', { name: 'Verify' })
    const unlock = screen.getByRole('button', { name: 'Unlock with device' })
    const separator = screen.getByRole('separator', { name: 'Alternative verification' })

    expect(password.compareDocumentPosition(unlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(verify.compareDocumentPosition(unlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(separator.compareDocumentPosition(unlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('silently keeps sensitive values masked when the user dismisses the device prompt', async () => {
    const cancellation = Object.assign(new Error('Prompt dismissed.'), { name: 'NotAllowedError' })
    const onTryFingerprint = vi.fn().mockRejectedValue(cancellation)

    render(
      <PasswordPromptModal
        isOpen
        onClose={vi.fn()}
        onVerified={vi.fn()}
        onTryFingerprint={onTryFingerprint}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Unlock with device' }))

    await waitFor(() => expect(onTryFingerprint).toHaveBeenCalledOnce())
    expect(screen.queryByText('Device verification failed or was cancelled.')).toBeNull()
    expect(screen.queryByText('Prompt dismissed.')).toBeNull()
  })

  it('shows genuine device verification errors without revealing sensitive values', async () => {
    const onTryFingerprint = vi.fn().mockRejectedValue(new Error('The verification server is unavailable.'))

    render(
      <PasswordPromptModal
        isOpen
        onClose={vi.fn()}
        onVerified={vi.fn()}
        onTryFingerprint={onTryFingerprint}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Unlock with device' }))

    expect(await screen.findByText('The verification server is unavailable.')).toBeTruthy()
  })

  it('closes only after the device verification callback confirms success', async () => {
    const onClose = vi.fn()
    const onTryFingerprint = vi.fn().mockResolvedValue(true)

    render(
      <PasswordPromptModal
        isOpen
        onClose={onClose}
        onVerified={vi.fn()}
        onTryFingerprint={onTryFingerprint}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Unlock with device' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(screen.queryByText('Device verification failed or was cancelled.')).toBeNull()
  })
})
