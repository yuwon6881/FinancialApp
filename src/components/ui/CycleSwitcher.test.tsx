import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CycleSwitcher } from './CycleSwitcher'

const renderSwitcher = (overrides: Partial<React.ComponentProps<typeof CycleSwitcher>> = {}) => {
  const onSelectPeriod = vi.fn()
  render(
    <CycleSwitcher
      selectedMonth="Aug"
      selectedYear={2026}
      availableYears={[2025, 2026]}
      cycleDay={28}
      onSelectPeriod={onSelectPeriod}
      currentCycleMonth="Aug"
      currentCycleYear={2026}
      surfaceLabel="Ledger"
      {...overrides}
    />,
  )
  return onSelectPeriod
}

describe('CycleSwitcher', () => {
  it('offers no way back while the current cycle is already selected', () => {
    renderSwitcher()

    expect(screen.queryByRole('button', { name: /Back to current cycle/ })).toBeNull()
  })

  it('returns to the current cycle from an older month', () => {
    const onSelectPeriod = renderSwitcher({ selectedMonth: 'Mar' })

    fireEvent.click(screen.getByRole('button', { name: /Back to current cycle/ }))
    expect(onSelectPeriod).toHaveBeenCalledWith('Aug', 2026)
  })

  it('returns to the current cycle from an older year', () => {
    const onSelectPeriod = renderSwitcher({ selectedYear: 2025 })

    fireEvent.click(screen.getByRole('button', { name: /Back to current cycle/ }))
    expect(onSelectPeriod).toHaveBeenCalledWith('Aug', 2026)
  })

  it('drops the cycle picker for a scope pinned to a whole year', () => {
    renderSwitcher({ periodMode: 'year' })

    expect(screen.queryByRole('combobox', { name: 'Ledger cycle' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Ledger cycle year' })).toBeTruthy()
  })
})
