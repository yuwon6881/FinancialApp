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
    expect(filterAndGroupCategoryRows(rows, 'all').map(item => item.category.id)).toEqual([
      'both-one',
      'both-two',
      'in-one',
      'out-one',
    ])
  })

  it('filters by the saved flow type', () => {
    expect(filterAndGroupCategoryRows(rows, 'outflow').map(item => item.category.id)).toEqual(['out-one'])
    expect(filterAndGroupCategoryRows(rows, 'both').map(item => item.category.id)).toEqual(['both-one', 'both-two'])
  })

  it('normalises the stored type before grouping', () => {
    const withJunk = [...rows, row('junk', 'Inflow ' as unknown as TransactionCategory['type'])]
    expect(filterAndGroupCategoryRows(withJunk, 'inflow').map(item => item.category.id)).toEqual(['in-one', 'junk'])
  })
})
