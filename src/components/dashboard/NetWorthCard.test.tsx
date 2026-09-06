import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NetWorthCard } from './NetWorthCard'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'

const formatCurrency = (value: number) => `$${value.toFixed(2)}`

const renderCard = (props: Partial<React.ComponentProps<typeof NetWorthCard>> = {}) => render(
  <NetWorthCard
    totalAccountBalance={1_000}
    investmentValue={500}
    loanDebt={200}
    isMasked={false}
    formatCurrency={formatCurrency}
    {...props}
  />,
)

describe('NetWorthCard', () => {
  it('states the position as owned minus owed and names each part once', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: 'Net worth' })).toBeTruthy()
    expect(screen.getByText('$1300.00')).toBeTruthy()
    expect(screen.getByText('$1000.00')).toBeTruthy()
    expect(screen.getByText('$500.00')).toBeTruthy()
    expect(screen.getByText('$-200.00')).toBeTruthy()
    expect(screen.queryByText('Partial')).toBeNull()
  })

  it('leaves a part that has not loaded out of the total instead of counting it as zero', () => {
    renderCard({ investmentValue: undefined, loanDebt: null })

    // The total is the cash on its own, quoted twice: as the total and as the one part that loaded.
    expect(screen.getAllByText('$1000.00').length).toBe(2)
    expect(screen.getAllByText('Not counted yet').length).toBe(2)
    expect(screen.getByText('Partial')).toBeTruthy()
  })

  it('marks the figure partial while only one part is still missing', () => {
    renderCard({ investmentValue: undefined })

    expect(screen.getByText('Partial')).toBeTruthy()
    expect(screen.getByText('$800.00')).toBeTruthy()
  })

  it('masks every amount in sensitive mode', () => {
    renderCard({ isMasked: true })

    expect(screen.queryByText(/\$/)).toBeNull()
    expect(screen.getAllByText(SENSITIVE_AMOUNT_MASK).length).toBe(4)
  })
})
