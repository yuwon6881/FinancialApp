import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecurringFilterBar } from './RecurringFilterBar'

function renderFilterBar(overrides: Partial<React.ComponentProps<typeof RecurringFilterBar>> = {}) {
  const props: React.ComponentProps<typeof RecurringFilterBar> = {
    isMobile: false,
    selectedCategories: [],
    sortOrder: 'amount-desc',
    isFilterDropdownOpen: false,
    filterButtonRef: createRef<HTMLButtonElement>(),
    setIsFilterDropdownOpen: vi.fn(),
    onToggleCategoryFilter: vi.fn(),
    onClearFilters: vi.fn(),
    onSortChange: vi.fn(),
    ...overrides,
  }

  return { ...render(<RecurringFilterBar {...props} />), props }
}

describe('RecurringFilterBar', () => {
  it('rotates the category chevron with the dropdown state', () => {
    const { rerender, props } = renderFilterBar()
    const getChevronClass = () => screen
      .getByRole('button', { name: 'All Categories' })
      .querySelector('svg')
      ?.getAttribute('class') ?? ''

    expect(getChevronClass()).not.toContain('rotate-180')

    rerender(
      <RecurringFilterBar
        {...props}
        isFilterDropdownOpen
      />
    )

    expect(getChevronClass()).toContain('rotate-180')
  })

  it('closes the desktop category popover when pressed outside', () => {
    const setIsFilterDropdownOpen = vi.fn()
    renderFilterBar({
      isFilterDropdownOpen: true,
      setIsFilterDropdownOpen,
    })

    fireEvent.mouseDown(document.body)

    expect(setIsFilterDropdownOpen).toHaveBeenCalledWith(false)
  })

  it('keeps the category popover open when pressed inside the portalled panel', () => {
    const setIsFilterDropdownOpen = vi.fn()
    renderFilterBar({
      isFilterDropdownOpen: true,
      setIsFilterDropdownOpen,
    })

    fireEvent.mouseDown(screen.getByRole('dialog', {
      name: 'Filter recurring payment categories',
    }))

    expect(setIsFilterDropdownOpen).not.toHaveBeenCalled()
  })
})
