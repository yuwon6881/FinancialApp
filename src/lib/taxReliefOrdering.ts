import type { TaxReliefCategorySummary } from '../types'

/**
 * Keep reached limits visible first, then make the order deterministic without
 * inventing a creation timestamp that the category contract does not provide.
 */
export function orderTaxReliefCategories(
  categories: readonly TaxReliefCategorySummary[],
): TaxReliefCategorySummary[] {
  return [...categories].sort((left, right) => {
    const leftReached = left.limit > 0 && left.confirmedAmount >= left.limit
    const rightReached = right.limit > 0 && right.confirmedAmount >= right.limit
    if (leftReached !== rightReached) return leftReached ? -1 : 1

    if (leftReached && rightReached && left.confirmedAmount !== right.confirmedAmount) {
      return right.confirmedAmount - left.confirmedAmount
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      || left.id.localeCompare(right.id)
  })
}
