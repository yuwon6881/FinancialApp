import { fireEvent, render, screen } from '@testing-library/react'
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
  it('defaults a release to one cycle instead of the whole commitment', () => {
    const onConfirm = vi.fn()
    render(
      <SavingsGoalContributeSheet
        goal={goal}
        mode="release"
        currency="MYR"
        available={500}
        suggested={250}
        formatSensitive={value => `RM ${value.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    )

    expect((screen.getByRole('textbox', { name: /amount/i }) as HTMLInputElement).value).toBe('250.00')
    fireEvent.click(screen.getByRole('button', { name: 'Release' }))

    expect(onConfirm).toHaveBeenCalledWith(-250)
  })
})
