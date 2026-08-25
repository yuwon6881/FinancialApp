import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerActiveFilterSummary, type LedgerActiveFilterSummaryProps } from './LedgerActiveFilterSummary'

const baseProps: LedgerActiveFilterSummaryProps = {
  showAllCycles: false,
  isCurrentCycle: true,
  selectedMonth: 'Aug',
  selectedYear: 2026,
  cycleDay: 1,
  hasAnyFilter: false,
  activeCategoryFilters: [],
  activeTxType: null,
  activeSearch: '',
  activeStartDate: '',
  activeEndDate: '',
  activeMinAmount: '',
  activeMaxAmount: '',
  activeRecurringFilter: 'all',
  activeWishlistFilter: 'all',
  onResetFilters: vi.fn(),
}

describe('LedgerActiveFilterSummary', () => {
  it('stays hidden for an unfiltered current cycle', () => {
    const { container } = render(<LedgerActiveFilterSummary {...baseProps} />)
    expect(container.firstChild).toBeNull()
  })

  it('offers a way out of a scoped range that carries no filters', () => {
    const onResetFilters = vi.fn()
    render(<LedgerActiveFilterSummary
      {...baseProps}
      showAllCycles
      cyclesRange="yearly"
      onResetFilters={onResetFilters}
    />)

    expect(screen.getByText('Showing full year 2026')).toBeTruthy()
    // The scope alone put the banner on screen, so Clear has to be reachable without a filter.
    screen.getByRole('button', { name: /clear filters/i }).click()
    expect(onResetFilters).toHaveBeenCalledTimes(1)
  })

  it('offers the same exit for a rolling window scope', () => {
    render(<LedgerActiveFilterSummary {...baseProps} showAllCycles cyclesRange="3month" />)

    expect(screen.getByText('Showing last 3 cycles')).toBeTruthy()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeTruthy()
  })

  it('stays hidden for the unfiltered all-cycles scope, which the toolbar can already leave', () => {
    const { container } = render(
      <LedgerActiveFilterSummary {...baseProps} showAllCycles cyclesRange="all" />,
    )
    expect(container.firstChild).toBeNull()
  })
})
