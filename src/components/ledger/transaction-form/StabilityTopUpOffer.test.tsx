import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StabilityTopUpOffer } from './StabilityTopUpOffer'

const offer = {
  requestedTopUp: 0,
  proposedTopUp: 0,
  maxTopUp: 600,
  safeCap: 500,
  isReduced: false,
  draws: [],
}

describe('StabilityTopUpOffer', () => {
  it('keeps a no-default optional reimbursement visible after the cycle plan is covered', () => {
    const onToggle = vi.fn()
    render(
      <StabilityTopUpOffer
        offer={offer}
        accepted={false}
        onToggle={onToggle}
        amount=""
        onAmountChange={vi.fn()}
        buckets={[]}
        currency="USD"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    expect(screen.getByText(/This cycleâ€™s planned amount is covered/i)).toBeTruthy()
    expect(screen.queryByText(/Suggested:/i)).toBeNull()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('requires an entered amount when there is no suggested default', () => {
    render(
      <StabilityTopUpOffer
        offer={offer}
        accepted
        onToggle={vi.fn()}
        amount=""
        onAmountChange={vi.fn()}
        buckets={[]}
        currency="USD"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    expect(screen.getByPlaceholderText('Enter an amount').getAttribute('aria-invalid')).toBe('true')
  })
})
