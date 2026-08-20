import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerToolbar } from './LedgerToolbar'

const renderToolbar = (showAllCycles: boolean, onShowAllCyclesChange = vi.fn()) => render(
  <LedgerToolbar
    selectedMonth="Aug"
    selectedYear={2026}
    availableYears={[2026]}
    cycleDay={28}
    onSelectPeriod={vi.fn()}
    hideSensitive={false}
    isFormOpen={false}
    onToggleForm={vi.fn()}
    onOpenExport={vi.fn()}
    showAllCycles={showAllCycles}
    onShowAllCyclesChange={onShowAllCyclesChange}
  />,
)

describe('LedgerToolbar', () => {
  it('switches directly between current-cycle and all-cycle modes', () => {
    const onShowAllCyclesChange = vi.fn()
    renderToolbar(false, onShowAllCyclesChange)

    expect(screen.getByRole('button', { name: 'Current cycle' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'All cycles' }))
    expect(onShowAllCyclesChange).toHaveBeenCalledWith(true)
  })

  it('removes irrelevant cycle selectors when all saved cycles are shown', () => {
    renderToolbar(true)

    expect(screen.queryByLabelText('Ledger cycle')).toBeNull()
    expect(screen.getByText(/server/)).toBeTruthy()
  })
})
