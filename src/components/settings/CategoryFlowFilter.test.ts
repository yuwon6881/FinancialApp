import { describe, expect, it } from 'vitest'
import type { TransactionCategory } from '../../types'
import { filterAndGroupCategoryRows } from '../../lib/categoryFlow'

const row = (id: string, type: TransactionCategory['type']) => ({
  category: { id, name: id, type },
  count: null,
})

describe('transaction category flow filtering', () => {
  const rows = [row('out-one', 'outflow'), row('both-one', 'both'), row('in-one', 'inflow'), row('both-two', 'both')]

  it('groups all categories by flow while preserving order inside each group', () => {
    expect(filterAndGroupCategoryRows(rows, {}, 'all').map(item => item.category.id)).toEqual([
      'both-one',
      'both-two',
      'in-one',
      'out-one',
    ])
  })

  it('filters by the currently selected draft flow type', () => {
    expect(filterAndGroupCategoryRows(rows, { 'both-one': 'outflow' }, 'outflow').map(item => item.category.id)).toEqual([
      'out-one',
      'both-one',
    ])
  })
})
