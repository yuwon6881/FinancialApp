import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RowSyncStatus } from './RowSyncBadge'

describe('RowSyncStatus accessibility', () => {
  it('announces the current mutation without exposing the decorative spinner', () => {
    const { container } = render(<RowSyncStatus isSyncing entityLabel="transaction" />)

    const status = screen.getByRole('status', { name: 'Updating transaction…' })
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
