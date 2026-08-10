import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormEvent } from 'react'
import type { SavingsGoal } from '../../types'
import { useSavingsGoalForm } from './useSavingsGoalForm'

const goal: SavingsGoal = {
  id: 7,
  name: 'Car Maintenance',
  targetAmount: 1200,
  earmarkedAmount: 400,
  targetDate: '2030-09-20',
  priority: 'Medium',
  status: 'active',
  isRecurring: false,
  recurrenceMonths: 12,
  cycleFundedAmount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function setup() {
  const onAddGoal = vi.fn()
  const onUpdateGoal = vi.fn()
  const view = renderHook(() => useSavingsGoalForm({
    goals: [goal],
    hideSensitive: false,
    onAddGoal,
    onUpdateGoal,
  }))
  return { ...view, onAddGoal, onUpdateGoal }
}

// A form event stands in for the submit; the hook only reads currentTarget to move focus.
const submitEvent = () => ({
  preventDefault: () => undefined,
  currentTarget: document.createElement('form'),
}) as unknown as FormEvent<HTMLFormElement>

// The amount field is the shared right-to-left cents mask, so a value is reached by clearing the
// field and typing digits, exactly as it is on screen — "250" typed into it means 2.50.
const typeAmount = (
  form: ReturnType<typeof useSavingsGoalForm>,
  digits: string,
) => {
  form.handleTargetChange({ target: { value: '' } } as never)
  form.handleTargetChange({ target: { value: digits } } as never)
}

describe('useSavingsGoalForm', () => {
  // Lowering the target releases the surplus — SavingsGoalService.UpdateGoalAsync clamps the
  // earmark and reopens the cycle tally. As a validation error this refused the only path to the
  // behaviour its own message described, so the target could never be lowered once money was in.
  it('saves a target below what is already set aside, and reports what that releases', async () => {
    const { result, onUpdateGoal } = setup()

    act(() => { result.current.handleOpenEditModal(goal) })
    act(() => { typeAmount(result.current, '25000') })

    expect(result.current.releasedByLowerTarget).toBe(150)

    await act(async () => { await result.current.handleSaveEdit(submitEvent()) })

    expect(result.current.errors.target).toBeFalsy()
    expect(onUpdateGoal).toHaveBeenCalledWith(7, expect.objectContaining({ targetAmount: 250 }))
  })

  it('has nothing to release while the target still covers the money set aside', () => {
    const { result } = setup()

    act(() => { result.current.handleOpenEditModal(goal) })
    act(() => { typeAmount(result.current, '90000') })

    expect(result.current.releasedByLowerTarget).toBe(0)
  })

  it('still refuses an empty target, which is a half-typed field rather than a release', async () => {
    const { result, onUpdateGoal } = setup()

    act(() => { result.current.handleOpenEditModal(goal) })
    act(() => { typeAmount(result.current, '') })
    await act(async () => { await result.current.handleSaveEdit(submitEvent()) })

    expect(result.current.errors.target).toBeTruthy()
    expect(onUpdateGoal).not.toHaveBeenCalled()
  })

  it('closes and clears an open goal workflow when sensitive mode activates', () => {
    const onAddGoal = vi.fn()
    const onUpdateGoal = vi.fn()
    const { result, rerender } = renderHook(
      ({ hideSensitive }) => useSavingsGoalForm({
        goals: [goal],
        hideSensitive,
        onAddGoal,
        onUpdateGoal,
      }),
      { initialProps: { hideSensitive: false } },
    )

    act(() => {
      result.current.handleOpenEditModal(goal)
      result.current.setNameInput('Unsaved private value')
    })
    expect(result.current.showEditModal).toBe(true)

    rerender({ hideSensitive: true })

    expect(result.current.showEditModal).toBe(false)
    expect(result.current.editingGoal).toBeNull()
    expect(result.current.nameInput).toBe('')
    expect(onUpdateGoal).not.toHaveBeenCalled()
  })
})
