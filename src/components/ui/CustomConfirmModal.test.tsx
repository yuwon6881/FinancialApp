import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomConfirmModal } from './CustomConfirmModal'

describe('CustomConfirmModal pending state', () => {
  it('disables confirmation and shows action-specific progress wording', () => {
    render(
      <CustomConfirmModal
        isOpen
        title="Delete document"
        message="Delete this file?"
        confirmText="Delete"
        isConfirming
        confirmingText="Deleting…"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: 'Deleting document…' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  })
})
