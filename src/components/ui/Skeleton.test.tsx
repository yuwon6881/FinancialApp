import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CycleSkeleton } from './Skeleton'

describe('CycleSkeleton', () => {
  it.each(['dashboard', 'reports', 'ledger', 'recurring', 'wishlist', 'drafts', 'settings', 'investments', 'documents'] as const)(
    'provides a layout-specific placeholder for %s',
    variant => {
      render(<CycleSkeleton variant={variant} />)
      expect(screen.getByTestId(`${variant}-skeleton`)).toBeTruthy()
    },
  )

  it('keeps a cycle-refresh wishlist skeleton to the pool only', () => {
    const { container } = render(<CycleSkeleton variant="wishlist" />)

    expect(screen.getByTestId('wishlist-pool-skeleton')).toBeTruthy()
    expect(container.querySelectorAll('section')).toHaveLength(0)
  })

  it('adds both horizontal rails for a full-page wishlist skeleton', () => {
    const { container } = render(<CycleSkeleton variant="wishlist" fullPage />)

    expect(container.querySelectorAll('section')).toHaveLength(2)
  })
})
