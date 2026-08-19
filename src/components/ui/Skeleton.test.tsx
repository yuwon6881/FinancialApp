import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CycleSkeleton } from './CycleSkeleton'

describe('CycleSkeleton', () => {
  it.each(['dashboard', 'reports', 'ledger', 'recurring', 'wishlist', 'drafts', 'settings', 'investments', 'documents'] as const)(
    'provides a layout-specific placeholder for %s',
    variant => {
      render(<CycleSkeleton variant={variant} />)
      expect(screen.getByTestId(`${variant}-skeleton`)).toBeTruthy()
    },
  )

  it('keeps both rails on a cycle-refresh wishlist skeleton, but not the page header', () => {
    const { container } = render(<CycleSkeleton variant="wishlist" />)

    // The rails are deliberately present without fullPage: standing in for the real content they
    // hold the page's height while a cycle switch resolves, and rendering only the pool let the
    // whole view collapse and then spring back. The page header and tab strip stay out, because
    // switching cycles never replaces them.
    expect(screen.getByTestId('wishlist-pool-skeleton')).toBeTruthy()
    expect(screen.queryByTestId('wishlist-header-skeleton')).toBeNull()
    expect(container.querySelectorAll('section')).toHaveLength(2)
  })

  it('adds both horizontal rails for a full-page wishlist skeleton', () => {
    const { container } = render(<CycleSkeleton variant="wishlist" fullPage />)

    expect(screen.getByTestId('wishlist-header-skeleton')).toBeTruthy()
    expect(container.querySelectorAll('section')).toHaveLength(2)
    expect(container.querySelectorAll('.app-panel')).toHaveLength(3)
  })
})
