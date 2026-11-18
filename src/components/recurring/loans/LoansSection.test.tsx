import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoansSection } from './LoansSection'

describe('LoansSection', () => {
  it('does not open a blank loan form from the empty state while balances are hidden', () => {
    const onOpenAddForm = vi.fn()
    render(
      <LoansSection
        loans={[]}
        payments={[]}
        currency="MYR"
        hideSensitive
        formatSensitive={() => '••••'}
        activeSyncIds={[]}
        onAddLoan={vi.fn()}
        onUpdateLoan={vi.fn()}
        onRequestDeleteLoan={vi.fn()}
        loadStatus="ready"
        onLoad={vi.fn().mockResolvedValue([])}
        onExplain={vi.fn()}
        isAddFormOpen={false}
        onOpenAddForm={onOpenAddForm}
        onCloseAddForm={vi.fn()}
      />,
    )

    const add = screen.getByRole('button', { name: /Add your first loan/ }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
  })
})
