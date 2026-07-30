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
    fireEvent.click(screen.getByRole('button', { name: /^Category/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Transport' }))

    fireEvent.click(screen.getByRole('combobox', { name: /^Ledger category/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Growth' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdateDraftTransaction).toHaveBeenCalledWith('draft-1', expect.objectContaining({
      category: 'Transport',
      ledgerCategory: 'Growth',
    }))
  })

  it('allows editing a transfer draft source and target', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const onUpdateDraftTransaction = vi.fn()
    render(
      <DraftStagingView
        draftTransactions={[{
          id: 'draft-transfer-1',
          description: 'Move to savings',
          amount: 50,
          date: '2026-07-13',
          category: 'Transfer',
          ledgerCategory: 'Transfer:Essentials->Growth',
          isPendingSync: true,
        }]}
        categories={[{ id: 'other', name: 'Other' }]}
        onUpdateDraftTransaction={onUpdateDraftTransaction}
        onDeleteDraftTransaction={vi.fn()}
        hideSensitive={false}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTitle('Edit draft item'))

    fireEvent.click(screen.getByRole('combobox', { name: 'Transfer source category' }))
    fireEvent.click(screen.getByRole('option', { name: 'Stability' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdateDraftTransaction).toHaveBeenCalledWith('draft-transfer-1', expect.objectContaining({
      category: 'Transfer',
      ledgerCategory: 'Transfer:Stability->Growth',
    }))
  })
})
