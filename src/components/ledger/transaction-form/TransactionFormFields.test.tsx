import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TransactionFormFields } from './TransactionFormFields'
import { getInitialState } from './transactionFormReducer'

describe('TransactionFormFields', () => {
  it('uses the non-searchable category select while preserving AI suggestion badges', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    render(
      <TransactionFormFields
        state={{ ...getInitialState('2026-08-01', 'Entertainment'), showAddForm: true }}
        firstInputRef={React.createRef<HTMLInputElement>()}
        descriptionRef={{ current: '' }}
        autocompletedDescriptionRef={{ current: null }}
        currency="MYR"
        categories={[
          { id: 'entertainment', name: 'Entertainment' },
          { id: 'food', name: 'Food' },
          { id: 'transfer', name: 'Transfer' },
          { id: 'adjustment', name: 'Adjustment' },
        ]}
        errors={{}}
        onSetField={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSuggestNotes={vi.fn()}
        onSuggestCategory={vi.fn()}
        filteredSuggestions={[]}
        quickSuggestionEntries={[]}
        suggestions={{
          categorySuggestions: [{ category: 'Food', confidence: 0.92 }],
          isSuggestingCategory: false,
          categorySuggestionUnavailable: false,
          isSuggestingNote: false,
          noteSuggestions: [],
          showNoteSuggestions: false,
          noteSuggestionUnavailable: false,
          setShowNoteSuggestions: vi.fn(),
          setNoteSuggestions: vi.fn(),
          setIsSuggestingNote: vi.fn(),
        }}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: /Category/ }))

    expect(screen.queryByRole('combobox', { name: 'Search category' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Food, Suggested 92%' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Transfer' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Adjustment' })).toBeNull()
  })

  // A cross-bucket transfer needs both legs named. The source picker used to render only in the
  // ordinary-transaction branch, so validation asked for an account the form never offered --
  // invisible while every bucket had one account and the preselect filled it, and an unsubmittable
  // form the moment a bucket had two.
  it('offers a source account on a cross-bucket transfer and keeps the two legs distinct', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const onSetField = vi.fn()

    render(
      <TransactionFormFields
        state={{
          ...getInitialState('2026-08-01', 'Entertainment'),
          showAddForm: true,
          transactionType: 'transfer',
          transferSource: 'Essentials',
          transferTarget: 'Rewards',
          accountId: null,
          counterAccountId: null,
        }}
        firstInputRef={React.createRef<HTMLInputElement>()}
        descriptionRef={{ current: '' }}
        autocompletedDescriptionRef={{ current: null }}
        currency="MYR"
        categories={[{ id: 'entertainment', name: 'Entertainment' }]}
        accounts={[
          { id: 'ess-1', name: 'Everyday', bucket: 'Essentials', isArchived: false },
          { id: 'ess-2', name: 'Bills', bucket: 'Essentials', isArchived: false },
          { id: 'rew-1', name: 'Treats', bucket: 'Rewards', isArchived: false },
        ] as never}
        errors={{}}
        onSetField={onSetField}
        onSelectSuggestion={vi.fn()}
        onSuggestNotes={vi.fn()}
        onSuggestCategory={vi.fn()}
        filteredSuggestions={[]}
        quickSuggestionEntries={[]}
        suggestions={{
          categorySuggestions: [],
          isSuggestingCategory: false,
          categorySuggestionUnavailable: false,
          isSuggestingNote: false,
          noteSuggestions: [],
          showNoteSuggestions: false,
          noteSuggestionUnavailable: false,
          setShowNoteSuggestions: vi.fn(),
          setNoteSuggestions: vi.fn(),
          setIsSuggestingNote: vi.fn(),
        }}
      />,
    )

    // FormField's `aria-labelledby` wins over the select's own `aria-label`, so the accessible
    // name is the visible label.
    const source = screen.getByRole('combobox', { name: /^Source account/ })
    expect(source).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /^Destination account/ })).toBeTruthy()

    fireEvent.click(source)
    // Filtered to the source bucket, so the destination bucket's account is not on offer here.
    expect(screen.getByRole('option', { name: 'Everyday' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Bills' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Treats' })).toBeNull()

    fireEvent.click(screen.getByRole('option', { name: 'Bills' }))
    expect(onSetField).toHaveBeenCalledWith('accountId', 'ess-2')
  })

  it('triggers onSwapTransfer when the swap direction button is clicked in transfer mode', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const onSwapTransfer = vi.fn()

    render(
      <TransactionFormFields
        state={{
          ...getInitialState('2026-08-01', 'Entertainment'),
          showAddForm: true,
          transactionType: 'transfer',
          transferSource: 'Essentials',
          transferTarget: 'Rewards',
          accountId: null,
          counterAccountId: null,
        }}
        firstInputRef={React.createRef<HTMLInputElement>()}
        descriptionRef={{ current: '' }}
        autocompletedDescriptionRef={{ current: null }}
        currency="MYR"
        categories={[{ id: 'entertainment', name: 'Entertainment' }]}
        accounts={[]}
        errors={{}}
        onSetField={vi.fn()}
        onSwapTransfer={onSwapTransfer}
        onSelectSuggestion={vi.fn()}
        onSuggestNotes={vi.fn()}
        onSuggestCategory={vi.fn()}
        filteredSuggestions={[]}
        quickSuggestionEntries={[]}
        suggestions={{
          categorySuggestions: [],
          isSuggestingCategory: false,
          categorySuggestionUnavailable: false,
          isSuggestingNote: false,
          noteSuggestions: [],
          showNoteSuggestions: false,
          noteSuggestionUnavailable: false,
          setShowNoteSuggestions: vi.fn(),
          setNoteSuggestions: vi.fn(),
          setIsSuggestingNote: vi.fn(),
        }}
      />,
    )

    const swapButton = screen.getByRole('button', { name: /Swap Direction/i })
    expect(swapButton).toBeTruthy()
    fireEvent.click(swapButton)
    expect(onSwapTransfer).toHaveBeenCalledTimes(1)
  })

  it('renders the bucket outflow advisory warning banner when present', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    render(
      <TransactionFormFields
        state={{
          ...getInitialState('2026-08-01', 'Rent'),
          showAddForm: true,
          amount: '800.00',
          transactionType: 'outflow',
          ledgerCategory: 'Essentials',
        }}
        firstInputRef={React.createRef<HTMLInputElement>()}
        descriptionRef={{ current: 'Rent' }}
        autocompletedDescriptionRef={{ current: null }}
        currency="MYR"
        categories={[{ id: 'rent', name: 'Rent' }]}
        accounts={[{ id: 'acc-1', name: 'Main', bucket: 'Essentials', isArchived: false }] as never}
        errors={{}}
        bucketOutflowWarning={{
          bucket: 'Essentials',
          shortfall: 250,
          message: 'This amount leaves your Essentials bucket short of covering upcoming bills this cycle.',
        }}
        onSetField={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSuggestNotes={vi.fn()}
        onSuggestCategory={vi.fn()}
        filteredSuggestions={[]}
        quickSuggestionEntries={[]}
        suggestions={{
          categorySuggestions: [],
          isSuggestingCategory: false,
          categorySuggestionUnavailable: false,
          isSuggestingNote: false,
          noteSuggestions: [],
          showNoteSuggestions: false,
          noteSuggestionUnavailable: false,
          setShowNoteSuggestions: vi.fn(),
          setNoteSuggestions: vi.fn(),
          setIsSuggestingNote: vi.fn(),
        }}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('short of covering upcoming bills this cycle')
    expect(alert.textContent).toContain('250.00')
    expect(alert.textContent).toContain('You can still save this transaction')
  })

  it.each(['create', 'edit', 'draft'] as const)('shows the out-of-cycle posting note in %s mode', mode => {
    render(
      <TransactionFormFields
        state={{
          ...getInitialState('2026-08-20', 'Food'),
          mode,
          editingId: mode === 'create' ? null : `${mode}-1`,
          showAddForm: true,
        }}
        firstInputRef={React.createRef<HTMLInputElement>()}
        descriptionRef={{ current: '' }}
        autocompletedDescriptionRef={{ current: null }}
        currency="MYR"
        categories={[{ id: 'food', name: 'Food' }]}
        errors={{}}
        selectedMonth="Mar"
        selectedYear={2026}
        cycleDay={1}
        onSetField={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSuggestNotes={vi.fn()}
        onSuggestCategory={vi.fn()}
        filteredSuggestions={[]}
        quickSuggestionEntries={[]}
        suggestions={{
          categorySuggestions: [],
          isSuggestingCategory: false,
          categorySuggestionUnavailable: false,
          isSuggestingNote: false,
          noteSuggestions: [],
          showNoteSuggestions: false,
          noteSuggestionUnavailable: false,
          setShowNoteSuggestions: vi.fn(),
          setNoteSuggestions: vi.fn(),
          setIsSuggestingNote: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText(/This posting date belongs to Aug 1st ~ Aug 31st, 2026/)).toBeTruthy()
    cleanup()
  })
})
