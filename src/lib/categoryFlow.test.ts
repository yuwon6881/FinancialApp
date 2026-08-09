import { describe, expect, it } from 'vitest'
import {
  allowsCategoryFlow,
  isSelectableTransactionCategory,
  isSpendingGuideCategory,
  normalizeCategoryFlowType,
} from './categoryFlow'

describe('category flow rules', () => {
  it('normalizes missing and invalid legacy flow values to both', () => {
    expect(normalizeCategoryFlowType(undefined)).toBe('both')
    expect(normalizeCategoryFlowType('')).toBe('both')
    expect(normalizeCategoryFlowType('INFLOW')).toBe('inflow')
    expect(normalizeCategoryFlowType('unknown')).toBe('both')
  })

  it('only allows matching flow categories for a transaction type', () => {
    expect(allowsCategoryFlow('both', 'outflow')).toBe(true)
    expect(allowsCategoryFlow('inflow', 'outflow')).toBe(false)
    expect(allowsCategoryFlow('outflow', 'outflow')).toBe(true)
    expect(allowsCategoryFlow(undefined, 'inflow')).toBe(true)
  })

  it('allows guides only for categories that can receive spending', () => {
    expect(isSpendingGuideCategory({ type: 'inflow' })).toBe(false)
    expect(isSpendingGuideCategory({ type: 'outflow' })).toBe(true)
    expect(isSpendingGuideCategory({ type: undefined })).toBe(true)
  })

  it('keeps reserved categories out of ordinary transaction category lists', () => {
    expect(isSelectableTransactionCategory({ name: 'Transfer', type: 'both' }, 'inflow')).toBe(false)
    expect(isSelectableTransactionCategory({ name: ' adjustment ', type: 'both' }, 'outflow')).toBe(false)
    expect(isSelectableTransactionCategory({ name: 'Salary', type: 'inflow' }, 'inflow')).toBe(true)
  })
})
