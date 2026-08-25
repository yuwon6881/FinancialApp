import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TransactionCategory } from '../../types'
import { CategoriesPreferencesTab } from './CategoriesPreferencesTab'

const category = (id: string, name: string, type: TransactionCategory['type']): TransactionCategory =>
  ({ id, name, type } as TransactionCategory)

// Spans all three flow groups so a regroup would be visible, and is deliberately not already in
// group order: `both → inflow → outflow` has to be the grouping's work, not the input's.
const categories = [
  category('c-out', 'Groceries', 'outflow'),
  category('c-both', 'Refunds', 'both'),
  category('c-in', 'Salary', 'inflow'),
]

const makeView = (list: TransactionCategory[]) => ({
  activeSettings: { currency: 'USD' },
  applyingCleanupId: null,
  categoriesOpen: true,
  categoryUsage: null,
  cleanupReviewError: null,
  cleanupReviewOpen: false,
  cleanupSuggestions: null,
  consolidateTargets: {},
  editableCategories: list,
  handleAiCleanupReview: vi.fn(),
  handleApplyCleanupSuggestion: vi.fn(),
  handleDeleteCategory: vi.fn(),
  isCatDeleting: () => false,
  isCatSyncing: () => false,
  isLoadingUsage: false,
  isReviewingCleanup: false,
  RARELY_USED_MAX_COUNT: 2,
  rarelyUsedCategoryCount: 0,
  setCategoriesOpen: vi.fn(),
  setCleanupReviewOpen: vi.fn(),
  setConsolidateTargets: vi.fn(),
  unusedCategoryCount: 0,
  USAGE_LOOKBACK_CYCLES: 3,
  usageError: null,
  visibleCategories: list,
}) as unknown as React.ComponentProps<typeof CategoriesPreferencesTab>['view']

const renderTab = (list: TransactionCategory[], onUpdateCategoryType = vi.fn()) => render(
  <CategoriesPreferencesTab
    view={makeView(list)}
    categoriesList={list}
    hideSensitive={false}
    dashboardData={null}
    onAddCategory={vi.fn()}
    onUpdateCategoryCycleLimit={vi.fn()}
    onUpdateCategoryType={onUpdateCategoryType}
  />,
)

const renderedOrder = () => screen.getAllByRole('group', { name: /^Flow restriction for / })
  .map(group => group.getAttribute('aria-label'))

describe('CategoriesPreferencesTab flow type editing', () => {
  it('groups rows by saved flow type', () => {
    renderTab(categories)
    expect(renderedOrder()).toEqual([
      'Flow restriction for Refunds',
      'Flow restriction for Salary',
      'Flow restriction for Groceries',
    ])
  })

  it('reaches a specific flow type in one click', () => {
    renderTab(categories)
    const salarySegment = screen.getByRole('button', { name: 'Restrict to money out for Salary' })
    expect(salarySegment.getAttribute('aria-pressed')).toBe('false')

    act(() => salarySegment.click())

    expect(screen.getByRole('button', { name: 'Restrict to money out for Salary' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Restrict to money in for Salary' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('holds the row order still while a flow type is unsaved', () => {
    renderTab(categories)
    const before = renderedOrder()

    // Salary moves from the inflow group to the outflow group only once this is saved.
    act(() => screen.getByRole('button', { name: 'Restrict to money out for Salary' }).click())

    expect(renderedOrder()).toEqual(before)
    expect(screen.getByLabelText('Unsaved flow change')).toBeTruthy()
    expect(screen.getByText(/1 category flow type modified/)).toBeTruthy()
  })

  it('regroups once the saved categories carry the new type', () => {
    const { rerender } = renderTab(categories)
    act(() => screen.getByRole('button', { name: 'Restrict to money out for Salary' }).click())
    expect(renderedOrder()).toEqual([
      'Flow restriction for Refunds',
      'Flow restriction for Salary',
      'Flow restriction for Groceries',
    ])

    const saved = categories.map(c => (c.id === 'c-in' ? category('c-in', 'Salary', 'outflow') : c))
    rerender(
      <CategoriesPreferencesTab
        view={makeView(saved)}
        categoriesList={saved}
        hideSensitive={false}
        dashboardData={null}
        onAddCategory={vi.fn()}
        onUpdateCategoryCycleLimit={vi.fn()}
        onUpdateCategoryType={vi.fn()}
      />,
    )

    expect(renderedOrder()).toEqual([
      'Flow restriction for Refunds',
      'Flow restriction for Groceries',
      'Flow restriction for Salary',
    ])
    expect(screen.queryByLabelText('Unsaved flow change')).toBeNull()
  })
})
