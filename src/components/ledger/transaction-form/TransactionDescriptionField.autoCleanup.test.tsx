import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionDescriptionField } from './TransactionDescriptionField'
import { getInitialState } from './transactionFormReducer'

function renderField(overrides: { description?: string; captureId?: string | null; mode?: 'create' | 'edit' } = {}) {
  const onSuggestNotes = vi.fn().mockResolvedValue(undefined)
  const autocompletedDescriptionRef = { current: null as string | null }
  render(
    <TransactionDescriptionField
      state={{
        ...getInitialState('2026-08-01', 'Food'),
        showAddForm: true,
        description: overrides.description ?? '',
        captureId: overrides.captureId ?? null,
        mode: overrides.mode ?? 'create',
      }}
      firstInputRef={React.createRef<HTMLInputElement>()}
      descriptionRef={{ current: overrides.description ?? '' }}
      autocompletedDescriptionRef={autocompletedDescriptionRef}
      errors={{}}
      onSetField={vi.fn()}
      onSelectSuggestion={vi.fn()}
      onSuggestNotes={onSuggestNotes}
      onSuggestCategory={vi.fn().mockResolvedValue(undefined)}
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
  return { onSuggestNotes, autocompletedDescriptionRef, input: screen.getByRole('textbox') }
}

describe('TransactionDescriptionField automatic cleanup', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('runs once, quietly, after the description has sat untouched for one second', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'grab food' } })
    act(() => { vi.advanceTimersByTime(999) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(onSuggestNotes).toHaveBeenCalledWith({ auto: true })
  })

  it('restarts the wait on every keystroke', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'gra' } })
    act(() => { vi.advanceTimersByTime(800) })
    fireEvent.change(input, { target: { value: 'grab' } })
    act(() => { vi.advanceTimersByTime(800) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(200) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
  })

  it('leaves a description read from a notification alone until the user types', () => {
    const { onSuggestNotes } = renderField({ description: 'GRAB*A-123 KUALA LUMPUR', captureId: 'cap-1' })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not run when the user leaves the field, picks an autocomplete entry or edits a saved transaction', () => {
    const left = renderField()
    fireEvent.change(left.input, { target: { value: 'grab food' } })
    fireEvent.blur(left.input)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(left.onSuggestNotes).not.toHaveBeenCalled()
    cleanup()

    const picked = renderField()
    picked.autocompletedDescriptionRef.current = 'Grab Food'
    fireEvent.change(picked.input, { target: { value: 'Grab Food' } })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(picked.onSuggestNotes).not.toHaveBeenCalled()
    cleanup()

    const editing = renderField({ mode: 'edit' })
    fireEvent.change(editing.input, { target: { value: 'grab food' } })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(editing.onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not ask again for text it has already tried', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'grab food' } })
    act(() => { vi.advanceTimersByTime(1000) })
    fireEvent.change(input, { target: { value: 'grab food ' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
  })
})
