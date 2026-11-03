import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionDescriptionField } from './TransactionDescriptionField'
import { getInitialState } from './transactionFormReducer'

const TestHarness: React.FC<{
  overrides: {
    description?: string
    captureId?: string | null
    mode?: 'create' | 'edit'
    showAddForm?: boolean
    transactionType?: 'inflow' | 'outflow' | 'transfer'
    filteredSuggestions?: any[]
    quickSuggestionEntries?: any[]
    isSuggestingNote?: boolean
    onSelectSuggestion?: (s: any) => void
    onSetField?: (field: any, val: any) => void
  }
  onSuggestNotes: any
  onSelectSuggestion: any
  onSetField: any
  autocompletedDescriptionRef: { current: string | null }
  firstInputRef: React.RefObject<HTMLInputElement | null>
}> = ({
  overrides,
  onSuggestNotes,
  onSelectSuggestion,
  onSetField,
  autocompletedDescriptionRef,
  firstInputRef,
}) => {
  const [description, setDescription] = React.useState(overrides.description ?? '')
  const descriptionRef = React.useRef(overrides.description ?? '')

  return (
    <TransactionDescriptionField
      state={{
        ...getInitialState('2026-08-01', 'Food'),
        showAddForm: overrides.showAddForm ?? true,
        description,
        captureId: overrides.captureId ?? null,
        mode: overrides.mode ?? 'create',
        transactionType: overrides.transactionType ?? 'outflow',
      }}
      firstInputRef={firstInputRef}
      descriptionRef={descriptionRef}
      autocompletedDescriptionRef={autocompletedDescriptionRef}
      errors={{}}
      onSetField={(field, val) => {
        if (field === 'description') {
          setDescription(val)
          descriptionRef.current = val
        }
        onSetField(field, val)
      }}
      onSelectSuggestion={s => {
        setDescription(s.description)
        descriptionRef.current = s.description
        autocompletedDescriptionRef.current = s.description.trim()
        onSelectSuggestion(s)
      }}
      onSuggestNotes={onSuggestNotes}
      onSuggestCategory={vi.fn().mockResolvedValue(undefined)}
      filteredSuggestions={overrides.filteredSuggestions ?? []}
      quickSuggestionEntries={overrides.quickSuggestionEntries ?? []}
      suggestions={{
        categorySuggestions: [],
        isSuggestingCategory: false,
        categorySuggestionUnavailable: false,
        isSuggestingNote: overrides.isSuggestingNote ?? false,
        noteSuggestions: [],
        showNoteSuggestions: false,
        noteSuggestionUnavailable: false,
        setShowNoteSuggestions: vi.fn(),
        setNoteSuggestions: vi.fn(),
        setIsSuggestingNote: vi.fn(),
      }}
    />
  )
}

function renderField(overrides: {
  description?: string
  captureId?: string | null
  mode?: 'create' | 'edit'
  showAddForm?: boolean
  transactionType?: 'inflow' | 'outflow' | 'transfer'
  filteredSuggestions?: any[]
  quickSuggestionEntries?: any[]
  isSuggestingNote?: boolean
  autoFocus?: boolean
  onSelectSuggestion?: (s: any) => void
  onSetField?: (field: any, val: any) => void
} = {}) {
  const onSuggestNotes = vi.fn().mockResolvedValue(undefined)
  const onSelectSuggestion = overrides.onSelectSuggestion ?? vi.fn()
  const onSetField = overrides.onSetField ?? vi.fn()
  const autocompletedDescriptionRef = { current: null as string | null }
  const firstInputRef = React.createRef<HTMLInputElement>()
  const result = render(
    <TestHarness
      overrides={overrides}
      onSuggestNotes={onSuggestNotes}
      onSelectSuggestion={onSelectSuggestion}
      onSetField={onSetField}
      autocompletedDescriptionRef={autocompletedDescriptionRef}
      firstInputRef={firstInputRef}
    />
  )
  const input = result.getByRole('textbox') as HTMLInputElement
  const shouldFocus = overrides.autoFocus ?? (!overrides.description)
  if (shouldFocus) {
    act(() => {
      input.focus()
    })
  }
  return {
    onSuggestNotes,
    onSelectSuggestion,
    onSetField,
    autocompletedDescriptionRef,
    firstInputRef,
    input,
    rerender: (newOverrides: typeof overrides) => {
      result.rerender(
        <TestHarness
          overrides={{ ...overrides, ...newOverrides }}
          onSuggestNotes={onSuggestNotes}
          onSelectSuggestion={onSelectSuggestion}
          onSetField={onSetField}
          autocompletedDescriptionRef={autocompletedDescriptionRef}
          firstInputRef={firstInputRef}
        />,
      )
    },
  }
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

  it('cancels auto cleanup if user leaves or blurs before one full second has elapsed', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'grab food' } })
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels auto cleanup on Tab keydown before one full second has elapsed', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'grab food' } })
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.keyDown(input, { key: 'Tab' })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger auto cleanup when user refocused without typing', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'grab food' } })
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.focus(input)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels pending cleanup and does not trigger automatic cleanup when selecting an autocomplete suggestion', () => {
    const onSelectSuggestion = vi.fn()
    const { onSuggestNotes, input } = renderField({
      filteredSuggestions: [{ description: 'Coffee Bean', ledgerCategory: 'Essentials', category: 'Coffee' }],
      onSelectSuggestion,
    })
    fireEvent.change(input, { target: { value: 'Cof' } })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    const suggestionButton = screen.getByRole('button', { name: /Coffee Bean/i })
    fireEvent.mouseDown(suggestionButton)
    fireEvent.click(suggestionButton)
    expect(onSelectSuggestion).toHaveBeenCalledWith(expect.objectContaining({ description: 'Coffee Bean' }))

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels pending cleanup and does not trigger automatic cleanup when selecting autocomplete with Enter key', () => {
    const onSelectSuggestion = vi.fn()
    const { onSuggestNotes, input } = renderField({
      filteredSuggestions: [{ description: 'Coffee Bean', ledgerCategory: 'Essentials', category: 'Coffee' }],
      onSelectSuggestion,
    })
    fireEvent.change(input, { target: { value: 'Cof' } })
    act(() => { vi.advanceTimersByTime(500) })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectSuggestion).toHaveBeenCalledWith(expect.objectContaining({ description: 'Coffee Bean' }))

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger automatic cleanup when selecting a quick suggestion', () => {
    const onSelectSuggestion = vi.fn()
    const { onSuggestNotes } = renderField({
      quickSuggestionEntries: [{ description: 'Quick Lunch' }],
      onSelectSuggestion,
    })
    const quickButton = screen.getByRole('button', { name: 'Quick Lunch' })
    fireEvent.mouseDown(quickButton)
    fireEvent.click(quickButton)
    expect(onSelectSuggestion).toHaveBeenCalledWith(expect.objectContaining({ description: 'Quick Lunch' }))

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger automatic cleanup on receipt scan prefill on load, open, focus, or blur', () => {
    const { onSuggestNotes, input } = renderField({ description: 'TARGET 1234 GROCERY' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    fireEvent.focus(input)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger automatic cleanup on notification detection prefill on load, open, focus, or blur', () => {
    const { onSuggestNotes, input } = renderField({ description: 'GRAB*A-123 KUALA LUMPUR', captureId: 'cap-1' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    fireEvent.focus(input)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    fireEvent.blur(input)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('keeps manual AI suggestion button enabled and functional for valid descriptions regardless of prefill origin', () => {
    const receiptField = renderField({ description: 'TARGET 1234 GROCERY' })
    const aiButtonReceipt = screen.getByRole('button', { name: /^AI$/i }) as HTMLButtonElement
    expect(aiButtonReceipt.disabled).toBe(false)
    fireEvent.click(aiButtonReceipt)
    expect(receiptField.onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(receiptField.onSuggestNotes).toHaveBeenCalledWith()
    cleanup()

    const notifField = renderField({ description: 'GRAB*A-123', captureId: 'cap-1' })
    const aiButtonNotif = screen.getByRole('button', { name: /^AI$/i }) as HTMLButtonElement
    expect(aiButtonNotif.disabled).toBe(false)
    fireEvent.click(aiButtonNotif)
    expect(notifField.onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(notifField.onSuggestNotes).toHaveBeenCalledWith()
    cleanup()

    const editField = renderField({ description: 'Dinner with team', mode: 'edit' })
    const aiButtonEdit = screen.getByRole('button', { name: /^AI$/i }) as HTMLButtonElement
    expect(aiButtonEdit.disabled).toBe(false)
    fireEvent.click(aiButtonEdit)
    expect(editField.onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(editField.onSuggestNotes).toHaveBeenCalledWith()
  })

  it('disables manual AI button when description has fewer than 2 characters', () => {
    renderField({ description: 'a' })
    const btnShort = screen.getByRole('button', { name: /^AI$/i }) as HTMLButtonElement
    expect(btnShort.disabled).toBe(true)
    cleanup()

    renderField({ description: '' })
    const btnEmpty = screen.getByRole('button', { name: /^AI$/i }) as HTMLButtonElement
    expect(btnEmpty.disabled).toBe(true)
  })

  it('cancels auto cleanup when manual AI button is clicked during the typing hold', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'coffee' } })
    act(() => { vi.advanceTimersByTime(500) })

    const aiButton = screen.getByRole('button', { name: /^AI$/i })
    fireEvent.click(aiButton)
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(onSuggestNotes).toHaveBeenCalledWith()

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
  })

  it('cancels auto cleanup when clear button is clicked during typing hold', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'dinner' } })
    act(() => { vi.advanceTimersByTime(500) })

    const clearButton = screen.getByRole('button', { name: /clear description/i })
    fireEvent.click(clearButton)

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels auto cleanup if focus shifts to document.body without a synthetic blur event', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'dinner' } })
    expect(document.activeElement).toBe(input)
    act(() => { vi.advanceTimersByTime(500) })

    // Simulate focus shifting to document.body (e.g. tapping sheet backdrop / keyboard dismiss)
    // without React synthetic onBlur firing
    document.body.setAttribute('tabindex', '-1')
    document.body.focus()
    expect(document.activeElement).toBe(document.body)

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
    document.body.removeAttribute('tabindex')
  })

  it('cancels auto cleanup if window blurs during typing hold (e.g. app switch or tab switch)', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'coffee break' } })
    act(() => { vi.advanceTimersByTime(500) })

    fireEvent(window, new Event('blur'))

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels auto cleanup if document visibility changes to hidden during typing hold', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'quick coffee' } })
    act(() => { vi.advanceTimersByTime(500) })

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    fireEvent(document, new Event('visibilitychange'))

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('cancels auto cleanup when Enter key is pressed even with no suggestions open or selected', () => {
    const { onSuggestNotes, input } = renderField({ filteredSuggestions: [] })
    fireEvent.change(input, { target: { value: 'groceries' } })
    act(() => { vi.advanceTimersByTime(500) })

    fireEvent.keyDown(input, { key: 'Enter' })

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels auto cleanup when user backspaces to fewer than 2 characters during typing hold', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'hi' } })
    act(() => { vi.advanceTimersByTime(500) })

    fireEvent.change(input, { target: { value: 'h' } })

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger auto cleanup and does not steal focus when change event fires while unfocused (e.g. browser autofill)', () => {
    const { onSuggestNotes, input } = renderField({ autoFocus: false })
    const otherInput = document.createElement('input')
    document.body.appendChild(otherInput)
    try {
      otherInput.focus()
      expect(document.activeElement).toBe(otherInput)

      fireEvent.change(input, { target: { value: 'Autofilled Restaurant' } })

      expect(document.activeElement).toBe(otherInput)
      act(() => { vi.advanceTimersByTime(2000) })
      expect(onSuggestNotes).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(otherInput)
    }
  })

  it('cancels auto cleanup if transaction form closes (showAddForm becomes false) during typing hold', () => {
    const { onSuggestNotes, input, rerender } = renderField({ showAddForm: true })
    fireEvent.change(input, { target: { value: 'target groceries' } })
    act(() => { vi.advanceTimersByTime(500) })

    rerender({ showAddForm: false })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger auto cleanup if input element is detached/unmounted when timer fires', () => {
    const { onSuggestNotes, input, firstInputRef } = renderField()
    fireEvent.change(input, { target: { value: 'quick dinner' } })
    act(() => { vi.advanceTimersByTime(500) })

    firstInputRef.current = null
    input.remove()

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('cancels auto cleanup on Escape keydown during typing hold', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'cinema tickets' } })
    act(() => { vi.advanceTimersByTime(500) })

    fireEvent.keyDown(input, { key: 'Escape' })

    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('does not trigger auto cleanup when isSuggestingNote is already true (concurrent request in flight)', () => {
    const { onSuggestNotes, input } = renderField({ isSuggestingNote: true })
    fireEvent.change(input, { target: { value: 'coffee shop' } })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('allows auto cleanup to run again after clicking clear button and re-typing the same description', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'coffee' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)

    const clearButton = screen.getByRole('button', { name: /clear description/i })
    fireEvent.click(clearButton)

    fireEvent.change(input, { target: { value: 'coffee' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(2)
  })

  it('allows auto cleanup to run again after backspacing to empty and re-typing the same description', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'groceries' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)

    // Backspace to empty
    fireEvent.change(input, { target: { value: '' } })
    act(() => { vi.advanceTimersByTime(100) })

    // Re-type
    fireEvent.change(input, { target: { value: 'groceries' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(2)
  })

  it('triggers auto cleanup when user types while a previous suggestion was in flight and that suggestion finishes before the 1s hold completes', () => {
    const { onSuggestNotes, input, rerender } = renderField({ isSuggestingNote: true })
    // User types new text while a previous suggestion was in flight
    fireEvent.change(input, { target: { value: 'coffee shop' } })
    act(() => { vi.advanceTimersByTime(300) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    // In-flight suggestion finishes at 300ms
    rerender({ isSuggestingNote: false })

    // User holds focus for the remainder of the 1000ms idle window (700ms more)
    act(() => { vi.advanceTimersByTime(700) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(onSuggestNotes).toHaveBeenCalledWith({ auto: true })
  })

  it('cancels auto cleanup on ArrowDown and ArrowUp keydown when navigating autocomplete suggestions', () => {
    const { onSuggestNotes, input } = renderField({
      filteredSuggestions: [
        { description: 'Coffee Bean', ledgerCategory: 'Essentials', category: 'Coffee' },
        { description: 'Coffee House', ledgerCategory: 'Essentials', category: 'Coffee' },
      ],
    })
    fireEvent.change(input, { target: { value: 'Cof' } })
    act(() => { vi.advanceTimersByTime(500) })

    // User navigates suggestions via ArrowDown
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()

    // User types more: restarts timer
    fireEvent.change(input, { target: { value: 'Coffee H' } })
    act(() => { vi.advanceTimersByTime(500) })

    // User navigates suggestions via ArrowUp
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(onSuggestNotes).not.toHaveBeenCalled()
  })

  it('resets lastAutoCleanupTextRef when unfocused change event clears the field', () => {
    const { onSuggestNotes, input } = renderField()
    fireEvent.change(input, { target: { value: 'market purchase' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)

    // Unfocus and simulate autofill/script clearing the input
    const otherInput = document.createElement('input')
    document.body.appendChild(otherInput)
    try {
      otherInput.focus()
      fireEvent.change(input, { target: { value: '' } })
    } finally {
      document.body.removeChild(otherInput)
    }

    // Refocus and re-type same description
    act(() => { input.focus() })
    fireEvent.change(input, { target: { value: 'market purchase' } })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(2)
  })

  it('invokes the latest onSuggestNotes callback reference when parent re-renders during the 1s hold', () => {
    const { onSuggestNotes, input, rerender } = renderField()
    fireEvent.change(input, { target: { value: 'new subscription' } })
    act(() => { vi.advanceTimersByTime(500) })

    // Trigger re-render with new prop reference during the hold
    rerender({ description: 'new subscription' })

    act(() => { vi.advanceTimersByTime(500) })
    expect(onSuggestNotes).toHaveBeenCalledTimes(1)
    expect(onSuggestNotes).toHaveBeenCalledWith({ auto: true })
  })
})
