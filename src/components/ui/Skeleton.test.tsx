import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CycleSkeleton } from './CycleSkeleton'

describe('CycleSkeleton', () => {
  it.each(['dashboard', 'reports', 'ledger', 'recurring', 'loans', 'wishlist', 'drafts', 'settings', 'budget', 'budget-categories', 'accounts', 'investments', 'documents'] as const)(
    'provides a layout-specific placeholder for %s',
    variant => {
      render(<CycleSkeleton variant={variant} />)
      expect(screen.getByTestId(`${variant}-skeleton`)).toBeTruthy()
    },
  )

  it('shows the selected goals layout and preserves the number of pool cards', () => {
    const { container, rerender } = render(<CycleSkeleton variant="wishlist" showEssentialsPool />)
    expect(screen.getAllByTestId('wishlist-pool-skeleton')).toHaveLength(2)
    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelectorAll('section')).toHaveLength(1)
    rerender(<CycleSkeleton variant="wishlist" goalsTab="rewards" />)
    expect(screen.getAllByTestId('wishlist-pool-skeleton')).toHaveLength(1)
    expect(container.querySelector('section .grid-cols-2')).toBeTruthy()
  })

  it('includes the header and one goals panel for a full-page wishlist skeleton', () => {
    const { container } = render(<CycleSkeleton variant="wishlist" fullPage />)

    expect(container.querySelector('header')).toBeTruthy()
    expect(container.querySelectorAll('section')).toHaveLength(1)
  })
})
