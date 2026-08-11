import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LedgerBalanceReconciliation } from './LedgerBalanceReconciliation'

describe('LedgerBalanceReconciliation', () => {
  it('shows the opening balance, full-cycle movement, and amount left', () => {
    render(
      <LedgerBalanceReconciliation
        category={{ name: 'Essentials', allocation: 0.5, target: 2500, incomeAllocated: 2500, budget: 100, netChange: -92.07, remaining: 7.93 }}
        cycleLabel="Jul 28 – Aug 27"
        formatSensitive={value => `RM ${value.toFixed(2)}`}
      />,
    )
    expect(screen.getByText('Essentials balance for Jul 28 – Aug 27')).toBeTruthy()
    expect(screen.getByText('RM 100.00')).toBeTruthy()
    expect(screen.getByText(/RM 92.07/)).toBeTruthy()
    expect(screen.getByText('RM 7.93')).toBeTruthy()
  })
})
