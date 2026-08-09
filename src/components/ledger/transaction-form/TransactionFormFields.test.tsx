import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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
})
