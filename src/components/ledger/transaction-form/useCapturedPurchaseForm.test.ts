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
  const hook = renderHook(({ form }) => useCapturedPurchaseForm(form, suggestions, false), {
    initialProps: { form: state('GRAB*FOOD') },
  })
  return { suggestions, state, hook }
}

describe('useCapturedPurchaseForm suggestions', () => {
  it('asks the AI once per capture, not once per edit to its description', () => {
    const { suggestions, state, hook } = setup()
    for (const typed of ['G', 'Gr', 'Gra', 'Grab', 'Grab lunch']) hook.rerender({ form: state(typed) })

    expect(suggestions.requestCategorySuggestions).toHaveBeenCalledTimes(1)
    expect(suggestions.requestCategorySuggestions).toHaveBeenCalledWith('GRAB*FOOD', null)
    expect(suggestions.requestNoteSuggestions).toHaveBeenCalledTimes(1)
  })

  it('suggests again for the next capture', () => {
    const { suggestions, state, hook } = setup()
    hook.rerender({ form: state('TNG*PARKING', 'capture-2') })

    expect(suggestions.requestCategorySuggestions).toHaveBeenCalledTimes(2)
    expect(suggestions.requestNoteSuggestions).toHaveBeenCalledTimes(2)
  })
})
