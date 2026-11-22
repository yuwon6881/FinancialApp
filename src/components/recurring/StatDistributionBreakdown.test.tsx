import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RecurringPayment } from '../../types'
import { buildRecurringYearProjection } from '../../lib/recurringPayments'
import { StatDistributionBreakdown } from './StatDistributionBreakdown'

const payment = (id: string, amount: number): RecurringPayment => ({
  id, name: id, amount, frequency: 'Monthly', category: 'Bills', ledgerCategory: 'Essentials',
  nextDueDate: '2099-08-20', dueDate: 20, startDate: '2026-01-20', active: true, paymentMode: 'Manual',
} as RecurringPayment)

const recurringYear = buildRecurringYearProjection([
  payment('Internet', -25), payment('Phone', -75),
], '2026-11-22')

describe('StatDistributionBreakdown', () => {
  it('masks each share of a masked total', () => {
    render(
      <StatDistributionBreakdown
        mode="recurring-annual"
        recurringYear={recurringYear}
        formatSensitive={() => '••••'}
        hideSensitive
      />,
    )

    expect(screen.queryByText(/25\.0%|75\.0%/)).toBeNull()
  })

  it('shows each share when amounts are visible', () => {
    render(
      <StatDistributionBreakdown
        mode="recurring-annual"
        recurringYear={recurringYear}
        formatSensitive={value => String(value)}
      />,
    )

    expect(screen.getByText('75.0%')).not.toBeNull()
  })
})
