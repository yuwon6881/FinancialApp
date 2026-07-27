import type { TransactionCategory } from '../../types'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'
import { deobfuscateAmount, obfuscateAmount } from './amounts'

export type WireTransactionCategory = Omit<TransactionCategory, 'cycleLimit'> & {
  cycleLimit?: string | number | null
}

export interface CategorySuggestion {
  category: string
  confidence: number
}

export interface TransactionNoteSuggestion {
  note: string
  reason: string
}

export interface CategoryCleanupSuggestion {
  id: string
  type: 'add' | 'delete' | 'merge' | 'consolidate'
  title: string
  summary: string
  categories: string[]
  targetCategory?: string | null
  newCategoryName?: string | null
  affectedTransactionCount: number
  confidence: number
}

export interface CategoryCleanupAction {
  type: 'add' | 'delete' | 'deleteByName' | 'merge' | 'restoreTransactions' | 'restoreRecurringPayments'
  categories?: string[]
  targetCategory?: string | null
  newCategoryName?: string | null
  transactionIds?: string[]
  recurringPaymentIds?: string[]
  categoryId?: string | null
}

export interface CategoryCleanupApplyResult {
  appliedCount: number
  undoActions: CategoryCleanupAction[]
}

export async function suggestTransactionCategories(params: {
  description: string
  txType: 'inflow' | 'outflow'
  categories: string[]
}, signal?: AbortSignal): Promise<CategorySuggestion[]> {
  const data = await request<{ suggestions?: CategorySuggestion[] }>('/categories/suggest', {
    method: 'POST',
    ...jsonBody(params),
    signal,
    errorMessage: 'Failed to suggest categories',
  })
  return data.suggestions || []
}

export async function suggestTransactionNotes(params: {
  description: string
  category?: string
  ledgerCategory?: string
  txType: 'inflow' | 'outflow' | 'transfer'
  historyDescriptions?: string[]
}, signal?: AbortSignal): Promise<TransactionNoteSuggestion[]> {
  const data = await request<{ suggestions?: TransactionNoteSuggestion[] }>('/categories/suggest-notes', {
    method: 'POST',
    ...jsonBody(params),
    signal,
    errorMessage: 'Failed to suggest transaction notes',
  })
  return data.suggestions || []
}

export async function reviewCategoryCleanup(signal?: AbortSignal): Promise<{ suggestions: CategoryCleanupSuggestion[] }> {
  const data = await request<{ suggestions?: CategoryCleanupSuggestion[] }>('/categories/cleanup/review', {
    method: 'POST',
    ...jsonBody({}),
    signal,
    errorMessage: 'Failed to review categories',
  })
  return { suggestions: data.suggestions || [] }
}

export async function applyCategoryCleanup(actions: CategoryCleanupAction[]): Promise<CategoryCleanupApplyResult> {
  const data = await request<CategoryCleanupApplyResult>('/categories/cleanup/apply', {
    method: 'POST',
    ...jsonBody({ actions }),
    errorMessage: 'Failed to apply category cleanup',
  })
  invalidateCache()
  return { appliedCount: data.appliedCount || 0, undoActions: data.undoActions || [] }
}

/** Wire -> domain mapping for a category. Shared with the bootstrap decoder. */
export function mapCategory(category: WireTransactionCategory): TransactionCategory {
  return {
    ...category,
    cycleLimit: category.cycleLimit == null ? null : deobfuscateAmount(category.cycleLimit),
  }
}

export function fetchCategories(signal?: AbortSignal): Promise<TransactionCategory[]> {
  return cachedGet('categories', async () => {
    const categories = await request<WireTransactionCategory[]>('/categories', {
      errorMessage: 'Failed to fetch custom categories',
    })
    return categories.map(mapCategory)
  }, { signal, staleTime: 300_000 })
}

export async function addCategory(category: Omit<TransactionCategory, 'id'> & { id?: string }): Promise<TransactionCategory> {
  const result = await request<WireTransactionCategory>('/categories', {
    method: 'POST',
    ...jsonBody(category),
    errorMessage: 'Failed to add custom category',
  })
  invalidateCache()
  return {
    ...result,
    cycleLimit: result.cycleLimit == null ? null : deobfuscateAmount(result.cycleLimit),
  }
}

export async function updateCategoryCycleLimit(id: string, cycleLimit: number | null): Promise<TransactionCategory> {
  const result = await request<WireTransactionCategory>(`/categories/${encodeURIComponent(id)}/cycle-limit`, {
    method: 'PUT',
    ...jsonBody({ cycleLimit: cycleLimit == null ? null : obfuscateAmount(cycleLimit) }),
    errorMessage: 'Failed to update category spending guide',
  })
  invalidateCache()
  return {
    ...result,
    cycleLimit: result.cycleLimit == null ? null : deobfuscateAmount(result.cycleLimit),
  }
}

export async function deleteCategory(id: string, replacementCategoryId?: string): Promise<void> {
  const query = replacementCategoryId
    ? `?replacementCategoryId=${encodeURIComponent(replacementCategoryId)}`
    : ''
  await requestVoid(`/categories/${id}${query}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete custom category',
  })
  invalidateCache()
}
