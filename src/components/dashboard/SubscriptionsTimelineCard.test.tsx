import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ActiveRecurringPayment } from '../../types'
import { SubscriptionsTimelineCard } from './SubscriptionsTimelineCard'
import { formatSensitiveAmount } from './formatters'

const payment = (overrides: Partial<ActiveRecurringPayment> = {}): ActiveRecurringPayment => ({
  id: 'occ-1',
  recurringPaymentId: 'rp-1',
  name: 'Streaming',
  category: 'Entertainment',
  amount: 19.9,
  dueDate: '2026-08-14',
  isPaid: false,
  isDiscarded: false,
  ...overrides,
} as ActiveRecurringPayment)

// This is the card's real formatter: dashboard/formatters returns a React element, never a string.
const formatSensitive = (value: number) => formatSensitiveAmount(value, false, 'USD')

describe('SubscriptionsTimelineCard', () => {
  it('renders each subscription as a native keyboard action', () => {
    render(
      <SubscriptionsTimelineCard
        activeRecurring={[payment()]}
        formatSensitive={formatSensitive}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Streaming/ })).toBeTruthy()
  })

  // The amount was built with a template literal, and interpolating an element into a string
  // yields "[object Object]" — which is what every bill on the Reports subscriptions card showed.
  it('renders the amount rather than stringifying the formatter node', () => {
    render(
      <SubscriptionsTimelineCard
        activeRecurring={[payment()]}
        formatSensitive={formatSensitive}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
    expect(screen.getByText(/19\.90/)).toBeTruthy()
  })

  // A bill whose amount was never recorded is honestly blank rather than coerced to zero.
  it('says so when a bill has no amount', () => {
    render(
      <SubscriptionsTimelineCard
        activeRecurring={[payment({ amount: null as unknown as number })]}
        formatSensitive={formatSensitive}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByText('Unavailable')).toBeTruthy()
  })
})
