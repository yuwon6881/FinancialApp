import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DraftStagingView } from './DraftStagingView'

describe('DraftStagingView', () => {
  it('allows editing both normal and ledger categories', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const onUpdateDraftTransaction = vi.fn()
    render(
      <DraftStagingView
        draftTransactions={[{
          id: 'draft-1',
          description: 'Car Fuel',
          amount: -30,
          date: '2026-07-13',
          category: 'Other',
          ledgerCategory: 'Essentials',
          isPendingSync: true,
        }]}
        categories={[
          { id: 'other', name: 'Other' },
          { id: 'transport', name: 'Transport' },
        ]}
        onUpdateDraftTransaction={onUpdateDraftTransaction}
        onDeleteDraftTransaction={vi.fn()}
        hideSensitive={false}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTitle('Edit draft item'))
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Transport' } })
    fireEvent.change(screen.getByLabelText('Ledger Category'), { target: { value: 'Growth' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdateDraftTransaction).toHaveBeenCalledWith('draft-1', expect.objectContaining({
      category: 'Transport',
      ledgerCategory: 'Growth',
    }))
  })
})
