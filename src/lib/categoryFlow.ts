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

export function isSpendingGuideCategory(category: Pick<TransactionCategory, 'type'>): boolean {
  return normalizeCategoryFlowType(category.type) !== 'inflow'
}
