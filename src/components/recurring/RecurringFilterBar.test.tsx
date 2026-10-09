import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecurringFilterBar } from './RecurringFilterBar'

function renderFilterBar(overrides: Partial<React.ComponentProps<typeof RecurringFilterBar>> = {}) {
  const props: React.ComponentProps<typeof RecurringFilterBar> = {
    selectedCategories: [],
    sortOrder: 'amount-desc',
    onToggleCategoryFilter: vi.fn(),
    onClearFilters: vi.fn(),
    onSortChange: vi.fn(),
    ...overrides,
  }

  return { ...render(<RecurringFilterBar {...props} />), props }
}

describe('RecurringFilterBar', () => {
  it('shows every bucket as a chip, with All pressed while nothing is filtered', () => {
    renderFilterBar()
    const group = screen.getByRole('group', { name: 'Filter recurring payment categories' })
    expect(group.querySelectorAll('button')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Rewards' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('toggles a bucket and clears back to All', () => {
    const { props } = renderFilterBar({ selectedCategories: ['Growth'] })
    expect(screen.getByRole('button', { name: 'Growth' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Essentials' }))
    expect(props.onToggleCategoryFilter).toHaveBeenCalledWith('Essentials')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(props.onClearFilters).toHaveBeenCalled()
  })
})
