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

    // Category is a SearchableSelect: open its trigger (shows the current value)
    // then pick the desired option from the panel.
    fireEvent.click(screen.getByRole('button', { name: 'Other' }))
    fireEvent.click(screen.getByRole('button', { name: 'Transport' }))

    // Ledger Category is a CustomSelect: trigger shows the current value.
    fireEvent.click(screen.getByRole('button', { name: 'Essentials' }))
    fireEvent.click(screen.getByRole('button', { name: 'Growth' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdateDraftTransaction).toHaveBeenCalledWith('draft-1', expect.objectContaining({
      category: 'Transport',
      ledgerCategory: 'Growth',
    }))
  })
})
