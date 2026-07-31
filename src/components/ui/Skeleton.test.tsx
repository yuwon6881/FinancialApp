import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CycleSkeleton } from './Skeleton'

describe('CycleSkeleton', () => {
  it.each(['dashboard', 'reports', 'ledger', 'recurring', 'wishlist', 'drafts', 'settings', 'documents'] as const)(
    'provides a layout-specific placeholder for %s',
    variant => {
      render(<CycleSkeleton variant={variant} />)
      expect(screen.getByTestId(`${variant}-skeleton`)).toBeTruthy()
    },
  )
})
