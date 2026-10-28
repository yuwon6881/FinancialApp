import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StabilityTopUpOffer } from './StabilityTopUpOffer'

const offer = {
  requestedTopUp: 0,
  proposedTopUp: 0,
  maxTopUp: 600,
  safeCap: 500,
  isReduced: false,
  isDeferred: false,
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

    expect(screen.getByText(/This cycle’s planned amount is covered/i)).toBeTruthy()
    expect(screen.queryByText(/Suggested:/i)).toBeNull()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  // Same zero suggestion, a different reason: calling a plan that has not started "covered" told
  // the user they had already put money back when they had not.
  it('says a plan that has not started rather than calling it covered', () => {
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, isDeferred: true }}
        accepted={false}
        onToggle={vi.fn()}
        amount=""
        onAmountChange={vi.fn()}
        buckets={[]}
        currency="USD"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    expect(screen.getByText(/Putting this back starts next cycle/i)).toBeTruthy()
    expect(screen.queryByText(/planned amount is covered/i)).toBeNull()
    // The option itself stays available, so an early put-back is still possible.
    expect(screen.getByRole('checkbox')).toBeTruthy()
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

  it('shows a "Put back RM x" button when unticked with a proposal and clicking it calls onToggle(true) and onAmountChange("")', () => {
    const onToggle = vi.fn()
    const onAmountChange = vi.fn()
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 100, maxTopUp: 200 }}
        accepted={false}
        onToggle={onToggle}
        amount=""
        onAmountChange={onAmountChange}
        buckets={[]}
        currency="MYR"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    const button = screen.getByRole('button', { name: /Put back/i })
    expect(button.textContent).toMatch(/Put back RM\s*100\.00/)
    expect(screen.getByText(/of the RM\s*200\.00 still to go\./i)).toBeTruthy()
    expect(screen.getByText(/Up to RM\s*200\.00 can go back from this income\./i)).toBeTruthy()

    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledWith(true)
    expect(onAmountChange).toHaveBeenCalledWith('')
  })

  it('shows Suggested chip pressed when amount is empty and clicking All calls onAmountChange(maxTopUp.toFixed(2))', () => {
    const onAmountChange = vi.fn()
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 100, maxTopUp: 300 }}
        accepted
        onToggle={vi.fn()}
        amount=""
        onAmountChange={onAmountChange}
        buckets={[]}
        currency="MYR"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    const suggestedChip = screen.getByRole('button', { name: /^Suggested/i })
    const allChip = screen.getByRole('button', { name: /^All/i })

    expect(suggestedChip.getAttribute('aria-pressed')).toBe('true')
    expect(allChip.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(allChip)
    expect(onAmountChange).toHaveBeenCalledWith('300.00')
  })

  it('omits the All chip when maxTopUp === proposedTopUp', () => {
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 250, maxTopUp: 250 }}
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

    expect(screen.getByRole('button', { name: /^Suggested/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^All/i })).toBeNull()
  })

  it('omits the Suggested chip when proposedTopUp <= 0', () => {
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 0, maxTopUp: 300 }}
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

    expect(screen.queryByRole('button', { name: /^Suggested/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^All/i })).toBeTruthy()
  })

  it('never prints a digit inside chips or result line when hideSensitive is true', () => {
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 150, maxTopUp: 450, safeCap: 500 }}
        accepted
        onToggle={vi.fn()}
        amount=""
        onAmountChange={vi.fn()}
        buckets={[]}
        currency="USD"
        hideSensitive
        stabilityAlloc={0.15}
      />,
    )

    const chipGroup = screen.getByRole('group', { name: 'Amount to put back' })
    expect(chipGroup.textContent).not.toMatch(/\d/)

    const resultLine = screen.getByText(/goes back into your emergency fund/i)
    expect(resultLine.textContent).not.toMatch(/\d/)
  })

  it('shows the result line for a valid amount and hides it for an over-max amount', () => {
    const { rerender } = render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 100, maxTopUp: 200 }}
        accepted
        onToggle={vi.fn()}
        amount="150"
        onAmountChange={vi.fn()}
        buckets={[]}
        currency="USD"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    expect(screen.getByText(/150\.00 goes back into your emergency fund\./i)).toBeTruthy()

    rerender(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 100, maxTopUp: 200 }}
        accepted
        onToggle={vi.fn()}
        amount="250"
        onAmountChange={vi.fn()}
        buckets={[]}
        currency="USD"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    expect(screen.queryByText(/goes back into your emergency fund\./i)).toBeNull()
    expect(screen.getByText(/That is more than the .* this pay packet can put back\./i)).toBeTruthy()
  })

  it('renders "Where it comes from" open by default so content is visible without clicking', () => {
    render(
      <StabilityTopUpOffer
        offer={{ ...offer, proposedTopUp: 100, maxTopUp: 200 }}
        accepted
        onToggle={vi.fn()}
        amount="100"
        onAmountChange={vi.fn()}
        buckets={[
          { bucket: 'Essentials', alloc: 0.5, balance: 1000, committed: 0 },
          { bucket: 'Growth', alloc: 0.3, balance: 500, committed: 0 },
        ]}
        currency="USD"
        hideSensitive={false}
        stabilityAlloc={0.15}
      />,
    )

    const details = screen.getByText('Where it comes from').closest('details')
    expect(details?.hasAttribute('open')).toBe(true)
    expect(screen.getByText(/Your usual 15% emergency-fund share is added on top, as set in your plan\./i)).toBeTruthy()
    expect(screen.getByText('Essentials')).toBeTruthy()
  })
})
