import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommitmentsRewardsTabs } from './CommitmentsRewardsTabs'

// Mock framer-motion cleanly without forwarding non-DOM props like layoutId to <span>
vi.mock('framer-motion', () => ({
  m: {
    span: React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { layoutId?: string }>(
      ({ layoutId: _layoutId, ...props }, ref) => <span ref={ref} {...props} />,
    ),
  },
  useReducedMotion: () => false,
}))

describe('CommitmentsRewardsTabs', () => {
  it('renders exactly the two section tabs with correct counts', () => {
    render(
      <CommitmentsRewardsTabs
        activeTab="commitments"
        onChange={() => undefined}
        commitmentsCount={3}
        rewardsCount={5}
      />
    )

    expect(screen.getByRole('tablist', { name: /commitments and rewards sections/i })).not.toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: /commitments/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /rewards/i })).not.toBeNull()

    expect(screen.getByText('3')).not.toBeNull() // Commitments count
    expect(screen.getByText('5')).not.toBeNull() // Rewards count
  })

  it('marks active tab with aria-selected=true', () => {
    render(
      <CommitmentsRewardsTabs
        activeTab="commitments"
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

  it('keeps the tab order stable when the selected view changes', () => {
    const { rerender } = render(
      <CommitmentsRewardsTabs
        activeTab="commitments"
        onChange={() => undefined}
        commitmentsCount={2}
        rewardsCount={4}
      />
    )

    expect(screen.getAllByRole('tab')[0].textContent).toContain('Commitments')

    rerender(
      <CommitmentsRewardsTabs
        activeTab="rewards"
        onChange={() => undefined}
        commitmentsCount={2}
        rewardsCount={4}
      />
    )

    expect(screen.getAllByRole('tab')[0].textContent).toContain('Commitments')
    expect(screen.getAllByRole('tab')[1].textContent).toContain('Rewards')
  })

  it('calls onChange when clicking a tab', () => {
    const handleChange = vi.fn()
    render(
      <CommitmentsRewardsTabs
        activeTab="commitments"
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
      <CommitmentsRewardsTabs
        activeTab="commitments"
        onChange={handleChange}
        commitmentsCount={1}
        rewardsCount={2}
      />
    )

    const commitmentsTab = screen.getByRole('tab', { name: /commitments/i })
    fireEvent.keyDown(commitmentsTab, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenCalledWith('rewards')

    fireEvent.keyDown(commitmentsTab, { key: 'ArrowLeft' })
    expect(handleChange).toHaveBeenCalledWith('rewards')

    fireEvent.keyDown(commitmentsTab, { key: 'End' })
    expect(handleChange).toHaveBeenCalledWith('rewards')

    const rewardsTab = screen.getByRole('tab', { name: /rewards/i })
    fireEvent.keyDown(rewardsTab, { key: 'Home' })
    expect(handleChange).toHaveBeenCalledWith('commitments')
  })

  it('wires each tab to its matching panel id', () => {
    render(
      <CommitmentsRewardsTabs
        activeTab="commitments"
        onChange={() => undefined}
        commitmentsCount={1}
        rewardsCount={2}
      />
    )

    // Only the active panel is mounted, so only the selected tab may point at one:
    // an aria-controls referencing an absent id is a critical axe violation.
    expect(screen.getByRole('tab', { name: /commitments/i }).getAttribute('aria-controls'))
      .toBe('commitments-rewards-panel-commitments')
    expect(screen.getByRole('tab', { name: /rewards/i }).getAttribute('aria-controls'))
      .toBeNull()
  })
})
