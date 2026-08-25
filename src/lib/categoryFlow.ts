import type { CategoryFlowType, TransactionCategory } from '../types'

export function normalizeCategoryFlowType(type: string | null | undefined): CategoryFlowType {
  switch (type?.trim().toLowerCase()) {
    case 'inflow':
      return 'inflow'
    case 'outflow':
      return 'outflow'
    default:
      return 'both'
  }
}

export function allowsCategoryFlow(
  categoryType: string | null | undefined,
  transactionType: 'inflow' | 'outflow',
): boolean {
  const normalizedType = normalizeCategoryFlowType(categoryType)
  return normalizedType === 'both' || normalizedType === transactionType
}

/**
 * Names owned by the app itself; people cannot create, edit, delete, or select them.
 *
 * Kept in step with `TransactionCategoryService.IsReservedName`. `Interest` is deliberately
 * absent: nothing writes those rows but the user now, so bank interest is recorded by hand like
 * any other income and the category has to be selectable. It stayed listed here after the
 * interest engine was removed, which hid the seeded category from Settings entirely — no limit,
 * no flow, not counted — and left no way to categorise a real interest payment.
 */
export function isSystemCategoryName(name: string | null | undefined): boolean {
  const normalizedName = name?.trim().toLowerCase()
  return normalizedName === 'transfer' || normalizedName === 'adjustment'
}

interface SelectableTransactionCategory {
  name?: string | null
  type?: string | null
  isPendingDelete?: boolean
}

export function isSelectableTransactionCategory(
  category: SelectableTransactionCategory,
  transactionType?: 'inflow' | 'outflow',
): boolean {
  const normalizedName = category.name?.trim().toLowerCase()
  if (!normalizedName || category.isPendingDelete) return false
  if (isSystemCategoryName(normalizedName)) return false
  return !transactionType || allowsCategoryFlow(category.type, transactionType)
}

export type CategoryFlowFilterValue = 'all' | CategoryFlowType

export interface CategoryFlowRow {
  category: TransactionCategory
  count: number | null
}

const FLOW_GROUP_ORDER: Record<CategoryFlowType, number> = {
  both: 0,
  inflow: 1,
  outflow: 2,
}

/**
 * Grouping and filtering read the saved type, never an unsaved draft.
 *
 * Reading the draft made a row change group on the click that edited it, so the control moved out
 * from under the pointer mid-edit — and with a flow filter active the row left the list before it
 * could be saved. Order is a property of saved data; unsaved intent is shown by the row's own
 * changed marker instead, and the list regroups when the save lands and new categories arrive.
 */
export function filterAndGroupCategoryRows(
  rows: CategoryFlowRow[],
  filter: CategoryFlowFilterValue,
): CategoryFlowRow[] {
  const flowType = (row: CategoryFlowRow) => normalizeCategoryFlowType(row.category.type)
  const filteredRows = filter === 'all' ? rows : rows.filter(row => flowType(row) === filter)
  if (filter !== 'all') return filteredRows
  return [...filteredRows].sort((left, right) => FLOW_GROUP_ORDER[flowType(left)] - FLOW_GROUP_ORDER[flowType(right)])
}

export function isSpendingGuideCategory(category: Pick<TransactionCategory, 'type'>): boolean {
  return normalizeCategoryFlowType(category.type) !== 'inflow'
}
