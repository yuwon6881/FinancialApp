import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountsSection } from './AccountsSection'

describe('AccountsSection', () => {
  it('explains that past-cycle navigation does not change today-based account corrections', () => {
    render(
      <AccountsSection
        accounts={[]}
        currency="MYR"
        hideSensitive={false}
        isCurrentCycle={false}
        onAddAccount={vi.fn()}
        onUpdateAccount={vi.fn()}
        onRequestDeleteAccount={vi.fn()}
        onReconcileAccounts={vi.fn()}
      />,
    )

    expect(screen.getByText("Balances shown here are today's")).toBeTruthy()
    expect(screen.getByText(/corrections always use today's balance and post to today's cycle/)).toBeTruthy()
  })

  it('does not repeat the cycle explanation on the current cycle', () => {
    render(
      <AccountsSection
        accounts={[]}
        currency="MYR"
        hideSensitive={false}
        isCurrentCycle
        onAddAccount={vi.fn()}
        onUpdateAccount={vi.fn()}
        onRequestDeleteAccount={vi.fn()}
        onReconcileAccounts={vi.fn()}
      />,
    )

    expect(screen.queryByText("Balances shown here are today's")).toBeNull()
  })
})
