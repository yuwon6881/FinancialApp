import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WishlistSectionToggle } from './WishlistSectionToggle'

// Mock framer-motion cleanly without forwarding non-DOM props like layoutId to <span>
vi.mock('framer-motion', () => ({
  m: {
    span: React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { layoutId?: string }>(
      ({ layoutId: _layoutId, ...props }, ref) => <span ref={ref} {...props} />,
    ),
  },
  useReducedMotion: () => false,
}))

describe('WishlistSectionToggle', () => {
  it('renders all section tabs with correct counts', () => {
    render(
      <WishlistSectionToggle
        activeSection="all"
        onChange={() => undefined}
        commitmentsCount={3}
        rewardsCount={5}
      />
    )

    expect(screen.getByRole('tablist', { name: /goals and rewards sections/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /all/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /commitments/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /rewards/i })).not.toBeNull()

    expect(screen.getByText('8')).not.toBeNull() // All count (3 + 5)
    expect(screen.getByText('3')).not.toBeNull() // Commitments count
    expect(screen.getByText('5')).not.toBeNull() // Rewards count
  })

  it('marks active tab with aria-selected=true', () => {
    render(
      <WishlistSectionToggle
        activeSection="commitments"
        onChange={() => undefined}
        commitmentsCount={2}
        rewardsCount={4}
      />
    )

    const commitmentsTab = screen.getByRole('tab', { name: /commitments/i })
    const rewardsTab = screen.getByRole('tab', { name: /rewards/i })

    expect(commitmentsTab.getAttribute('aria-selected')).toBe('true')
    expect(commitmentsTab.getAttribute('tabindex')).toBe('0')
    expect(rewardsTab.getAttribute('aria-selected')).toBe('false')
    expect(rewardsTab.getAttribute('tabindex')).toBe('-1')
  })

  it('calls onChange when clicking a tab', () => {
    const handleChange = vi.fn()
    render(
      <WishlistSectionToggle
        activeSection="all"
        onChange={handleChange}
        commitmentsCount={1}
        rewardsCount={2}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: /rewards/i }))
    expect(handleChange).toHaveBeenCalledWith('rewards')
  })

  it('handles keyboard navigation across tabs', () => {
    const handleChange = vi.fn()
    render(
      <WishlistSectionToggle
        activeSection="all"
        onChange={handleChange}
        commitmentsCount={1}
        rewardsCount={2}
      />
    )

    const allTab = screen.getByRole('tab', { name: /all/i })
    fireEvent.keyDown(allTab, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenCalledWith('commitments')
  })
})
