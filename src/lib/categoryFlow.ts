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

/** Names owned by the app itself; people cannot create, edit, delete, or select them. */
export function isSystemCategoryName(name: string | null | undefined): boolean {
  const normalizedName = name?.trim().toLowerCase()
  return normalizedName === 'transfer' || normalizedName === 'adjustment' || normalizedName === 'interest'
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

export function filterAndGroupCategoryRows(
  rows: CategoryFlowRow[],
  flowTypeDrafts: Record<string, CategoryFlowType>,
  filter: CategoryFlowFilterValue,
): CategoryFlowRow[] {
  const flowType = (row: CategoryFlowRow) => normalizeCategoryFlowType(
    flowTypeDrafts[row.category.id] ?? row.category.type,
  )
  const filteredRows = filter === 'all' ? rows : rows.filter(row => flowType(row) === filter)
  if (filter !== 'all') return filteredRows
  return [...filteredRows].sort((left, right) => FLOW_GROUP_ORDER[flowType(left)] - FLOW_GROUP_ORDER[flowType(right)])
}

export function isSpendingGuideCategory(category: Pick<TransactionCategory, 'type'>): boolean {
  return normalizeCategoryFlowType(category.type) !== 'inflow'
}
