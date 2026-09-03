import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerToolbar } from './LedgerToolbar'

const renderToolbar = (showAllCycles: boolean, onShowAllCyclesChange = vi.fn()) => render(
  <LedgerToolbar
    selectedYear={2026}
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

    expect(screen.getByRole('tab', { name: 'Current cycle' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'All cycles' }))
    expect(onShowAllCyclesChange).toHaveBeenCalledWith(true)
  })

  // The cycle pickers moved to the shared switcher above the page, so the toolbar keeps only the
  // scope choice and must not grow a second copy of them.
  it('leaves cycle selection to the shared switcher', () => {
    renderToolbar(true)

    expect(screen.queryByLabelText('Ledger cycle')).toBeNull()
    expect(screen.queryByLabelText('Ledger cycle year')).toBeNull()
    expect(screen.getByText(/server/)).toBeTruthy()
  })
})
