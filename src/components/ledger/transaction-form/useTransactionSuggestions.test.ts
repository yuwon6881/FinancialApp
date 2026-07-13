import { describe, expect, it } from 'vitest'
import { getSelectableCategoryNames } from './useTransactionSuggestions'

describe('transaction category suggestion selection', () => {
  const categories = [
    { name: 'Food' },
    { name: 'Transport' },
    { name: 'Transfer' },
    { name: 'Adjustment' },
    { name: 'Archived', isPendingDelete: true },
  ]

  it('only sends normal selectable categories for ranking', () => {
    expect(getSelectableCategoryNames(categories)).toEqual(['Food', 'Transport'])
  })
})
