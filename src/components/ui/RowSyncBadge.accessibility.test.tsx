import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RowSyncStatus } from './RowSyncBadge'

describe('RowSyncStatus accessibility', () => {
  it('announces the current mutation without exposing the decorative spinner', () => {
    const { container } = render(<RowSyncStatus isSyncing entityLabel="transaction" />)

    const status = screen.getByRole('status', { name: 'Updating transaction…' })
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByText('Syncing…')).toBeNull()
  })

  it('keeps the same compact slot mounted from idle through every state', () => {
    const { container, rerender } = render(<RowSyncStatus entityLabel="transaction" />)
    const slot = container.querySelector('[data-mutation-status-slot]')

    expect(slot?.getAttribute('data-mutation-state')).toBe('idle')
    expect(slot?.className).toContain('size-5')

    rerender(<RowSyncStatus isPending entityLabel="transaction" />)
    expect(container.querySelector('[data-mutation-status-slot]')).toBe(slot)
    expect(slot?.getAttribute('data-mutation-state')).toBe('pending')

    rerender(<RowSyncStatus isDeleting isSyncing isPending entityLabel="transaction" />)
    expect(container.querySelector('[data-mutation-status-slot]')).toBe(slot)
    expect(slot?.getAttribute('data-mutation-state')).toBe('deleting')
  })
})
