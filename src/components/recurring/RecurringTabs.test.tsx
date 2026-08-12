import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecurringTabs } from './RecurringTabs'

vi.mock('framer-motion', () => ({
  m: {
    span: React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { layoutId?: string }>(
      ({ layoutId: _layoutId, ...props }, ref) => <span ref={ref} {...props} />,
    ),
  },
  useReducedMotion: () => false,
}))

describe('RecurringTabs', () => {
  it('renders section tabs with correct counts', () => {
    render(
      <RecurringTabs
        activeTab="recurring"
        onChange={() => undefined}
        recurringCount={5}
        loansCount={2}
      />
    )

    expect(screen.getByRole('tablist', { name: /recurring view sections/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /recurring bills/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /loans/i })).not.toBeNull()

    expect(screen.getByText('5')).not.toBeNull()
    expect(screen.getByText('2')).not.toBeNull()
  })

  it('marks active tab with aria-selected=true', () => {
    render(
      <RecurringTabs
        activeTab="loans"
        onChange={() => undefined}
        recurringCount={5}
        loansCount={2}
      />
    )

    const recurringTab = screen.getByRole('tab', { name: /recurring bills/i })
    const loansTab = screen.getByRole('tab', { name: /loans/i })

    expect(loansTab.getAttribute('aria-selected')).toBe('true')
    expect(loansTab.getAttribute('tabindex')).toBe('0')
    expect(recurringTab.getAttribute('aria-selected')).toBe('false')
    expect(recurringTab.getAttribute('tabindex')).toBe('-1')
  })

  it('calls onChange when clicking a tab', () => {
    const handleChange = vi.fn()
    render(
      <RecurringTabs
        activeTab="recurring"
        onChange={handleChange}
        recurringCount={5}
        loansCount={2}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: /loans/i }))
    expect(handleChange).toHaveBeenCalledWith('loans')
  })

  it('handles keyboard navigation across tabs', () => {
    const handleChange = vi.fn()
    render(
      <RecurringTabs
        activeTab="recurring"
        onChange={handleChange}
        recurringCount={5}
        loansCount={2}
      />
    )

    const recurringTab = screen.getByRole('tab', { name: /recurring bills/i })
    fireEvent.keyDown(recurringTab, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenCalledWith('loans')
  })
})
