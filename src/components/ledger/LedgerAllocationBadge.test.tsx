import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LedgerAllocationBadge } from './LedgerAllocationBadge'

describe('LedgerAllocationBadge', () => {
  it('shows both sides of a pure ledger transfer', () => {
    render(
      <LedgerAllocationBadge
        ledgerCategory="Transfer:Essentials->Rewards"
        transactionId="transfer-1"
      />,
    )

    expect(screen.getByLabelText('Transfer from Essentials to Rewards')).toBeTruthy()
    expect(screen.getByText('Essentials')).toBeTruthy()
    expect(screen.getByText('Rewards')).toBeTruthy()
  })

  it('keeps generated salary allocations focused on the receiving ledger', () => {
    render(
      <LedgerAllocationBadge
        ledgerCategory="Transfer:Income->Growth"
        transactionId="salary-1-split-Growth"
      />,
    )

    expect(screen.getByText('Growth')).toBeTruthy()
    expect(screen.queryByText('Income')).toBeNull()
  })

  it('keeps a normal ledger category as one badge', () => {
    render(<LedgerAllocationBadge ledgerCategory="Stability" transactionId="expense-1" />)

    expect(screen.getByText('Stability')).toBeTruthy()
  })
})
