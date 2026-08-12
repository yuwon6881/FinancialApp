import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CommitmentIcon, RewardIcon } from './semanticIcons'

describe('financial semantic icons', () => {
  it('uses a banknote for commitments and a piggy bank for rewards', () => {
    const { container } = render(
      <>
        <CommitmentIcon data-testid="commitment-icon" />
        <RewardIcon data-testid="reward-icon" />
      </>,
    )

    expect(container.querySelector('[data-testid="commitment-icon"]')?.classList.contains('lucide-banknote')).toBe(true)
    expect(container.querySelector('[data-testid="reward-icon"]')?.classList.contains('lucide-piggy-bank')).toBe(true)
  })
})
