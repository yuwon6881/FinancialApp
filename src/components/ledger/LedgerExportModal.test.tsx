import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerExportModal } from './LedgerExportModal'
import { describeLedgerScope } from '../../lib/ledgerScopeLabel'

const baseProps = {
  isOpen: true,
  exportIsFetching: false,
  onClose: vi.fn(),
  onExportPage: vi.fn(),
  onExportAll: vi.fn(),
}

describe('LedgerExportModal scope summary', () => {
  it('states the period, filter state and both row counts before downloading', () => {
    render(<LedgerExportModal {...baseProps} scopeLabel="last 3 cycles" filtered pageCount={10} totalCount={1234} />)
    expect(screen.getByText('last 3 cycles, filtered')).toBeTruthy()
    expect(screen.getByText('10 transactions')).toBeTruthy()
    expect(screen.getByText('1,234 transactions')).toBeTruthy()
  })

  it('leaves the total out while it is unknown rather than showing zero', () => {
    render(<LedgerExportModal {...baseProps} scopeLabel="all cycles" pageCount={1} totalCount={null} />)
    expect(screen.getByText('1 transaction')).toBeTruthy()
    expect(screen.queryByText('Entire result')).toBeNull()
  })
})

describe('describeLedgerScope', () => {
  const base = { selectedMonth: 'November', selectedYear: 2026, cycleDay: 25 }
  it.each([
    [{ showAllCycles: false }, 'current cycle'],
    [{ showAllCycles: true, cyclesRange: '3month' as const }, 'last 3 cycles'],
    [{ showAllCycles: true, cyclesRange: '6month' as const }, 'last 6 cycles'],
    [{ showAllCycles: true, cyclesRange: 'yearly' as const }, 'full year 2026'],
    [{ showAllCycles: true, cyclesRange: 'all' as const }, 'all cycles'],
  ])('describes %o as %s', (scope, label) => {
    expect(describeLedgerScope({ ...base, ...scope })).toBe(label)
  })

  it('names a past cycle', () => {
    expect(describeLedgerScope({ ...base, showAllCycles: false, isCurrentCycle: false })).not.toBe('current cycle')
  })
})
