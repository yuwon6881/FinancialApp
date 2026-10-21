import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCapturedPurchaseForm } from './useCapturedPurchaseForm'
import type { TransactionFormState } from './transactionFormReducer'
import type { useTransactionSuggestions } from './useTransactionSuggestions'

vi.mock('../../../contexts/PurchaseCaptureContext', () => ({ usePurchaseCaptureActions: () => null }))

function setup() {
  const suggestions = {
    requestCategorySuggestions: vi.fn(async () => []),
    requestNoteSuggestions: vi.fn(async () => undefined),
  } as unknown as ReturnType<typeof useTransactionSuggestions>
  const state = (description: string, captureId = 'capture-1') =>
    ({ captureId, showAddForm: true, description } as TransactionFormState)
  const hook = renderHook(({ form }) => useCapturedPurchaseForm(form, false), {
    initialProps: { form: state('GRAB*FOOD') },
  })
  return { suggestions, state, hook }
}

// The hook no longer takes the suggestions; these stand in for the form's own, to prove that
// opening or editing a capture leaves them untouched.
describe('useCapturedPurchaseForm suggestions', () => {
  it('asks the AI for nothing when a capture opens or its description is edited', () => {
    const { suggestions, state, hook } = setup()
    for (const typed of ['G', 'Gr', 'Gra', 'Grab', 'Grab lunch']) hook.rerender({ form: state(typed) })
    hook.rerender({ form: state('TNG*PARKING', 'capture-2') })

    expect(suggestions.requestCategorySuggestions).not.toHaveBeenCalled()
    expect(suggestions.requestNoteSuggestions).not.toHaveBeenCalled()
  })
})
