import { describe, expect, it } from 'vitest'
import { orderTaxReliefCategories } from './taxReliefOrdering'

const category = (id: string, name: string, limit: number, confirmedAmount: number) => ({
  id,
  name,
  limit,
  detail: '',
  confirmedAmount,
  pendingReviewAmount: 0,
  documentCount: 0,
  pendingReviewCount: 0,
})

describe('orderTaxReliefCategories', () => {
  it('puts reached limits first and sorts reached amounts high to low', () => {
    const result = orderTaxReliefCategories([
      category('education', 'Education', 2_000, 500),
      category('sports', 'Sports', 1_000, 1_000),
      category('lifestyle', 'Lifestyle', 3_000, 3_000),
    ])

    expect(result.map(item => item.id)).toEqual(['lifestyle', 'sports', 'education'])
  })

  it('uses alphabetical order for equal amounts and unreached categories', () => {
    const result = orderTaxReliefCategories([
      category('z', 'Zoology', 1_000, 100),
      category('a', 'Arts', 1_000, 100),
      category('b', 'Books', 0, 100),
    ])

    expect(result.map(item => item.id)).toEqual(['a', 'b', 'z'])
  })
})
