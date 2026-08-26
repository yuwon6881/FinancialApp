import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SavingsGoal } from '../../types'
import { SavingsGoalContributeSheet } from './SavingsGoalContributeSheet'

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

const goal: SavingsGoal = {
  id: 7,
  name: 'Car service',
  targetAmount: 3000,
  earmarkedAmount: 1000,
  targetDate: '2026-10-15',
  priority: 'Medium',
  status: 'active',
  isRecurring: true,
  recurrenceMonths: 3,
  cycleFundedAmount: 250,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('SavingsGoalContributeSheet', () => {
  it('defaults a release to one cycle instead of the whole commitment', async () => {
    const onConfirm = vi.fn()
    render(
      <SavingsGoalContributeSheet
        goal={goal}
        mode="release"
        currency="MYR"
        available={500}
        suggestedTopUp={100}
        suggestedRelease={250}
        formatSensitive={value => `RM ${value.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    )

    expect((screen.getByRole('textbox', { name: /amount/i }) as HTMLInputElement).value).toBe('250.00')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Release' }))
    })

    expect(onConfirm).toHaveBeenCalledWith(-250)
  })

  it('defaults a partial top-up to the amount still outstanding this cycle', () => {
    render(
      <SavingsGoalContributeSheet
        goal={{ ...goal, earmarkedAmount: 1030, cycleFundedAmount: 30 }}
        mode="topUp"
        currency="MYR"
        available={500}
        suggestedTopUp={10}
        suggestedRelease={40}
        formatSensitive={value => `RM ${value.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect((screen.getByRole('textbox', { name: /amount/i }) as HTMLInputElement).value).toBe('10.00')
  })

  it('defaults an untouched top-up to the full current-cycle pace', () => {
    render(
      <SavingsGoalContributeSheet
        goal={goal}
        mode="topUp"
        currency="MYR"
        available={500}
        suggestedTopUp={250}
        suggestedRelease={250}
        formatSensitive={value => `RM ${value.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect((screen.getByRole('textbox', { name: /amount/i }) as HTMLInputElement).value).toBe('250.00')
  })

  it('does not suggest a routine top-up when the cycle is already covered', () => {
    render(
      <SavingsGoalContributeSheet
        goal={goal}
        mode="topUp"
        currency="MYR"
        available={500}
        suggestedTopUp={0}
        suggestedRelease={250}
        formatSensitive={value => `RM ${value.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect((screen.getByRole('textbox', { name: /amount/i }) as HTMLInputElement).value).toBe('')
  })
})
