import {
  invalidateCacheKey,
  invalidateCachePrefix,
  invalidateRevalidationPrefix,
} from './client'
import type { DocumentSort } from '../documentOrdering'

export const DOCUMENT_CACHE_KEYS = {
  constraints: 'documents:constraints',
  retention: 'documents:retention',
  overviewPrefix: 'documents:overview:',
  overview: (taxYear?: number) => `documents:overview:${taxYear ?? 'latest'}`,
  listPrefix: 'documents:list:',
  reliefCategoriesPrefix: 'documents:relief-categories:',
  reliefCategories: (taxYear: number) => `documents:relief-categories:${taxYear}`,
  summaryPrefix: 'documents:summary:',
  summary: (taxYear: number) => `documents:summary:${taxYear}`,
  usage: 'documents:usage',
  years: 'documents:years',
} as const

export const DOCUMENT_CACHE_TTL = {
  constraints: 60 * 60_000,
  derived: 30_000,
  list: 15_000,
  reference: 60 * 60_000,
} as const

export function documentListCacheKey(
  taxYear: number | undefined,
  transactionId: string | undefined,
  skip: number,
  take: number,
  reliefCategories?: string[],
  sort: DocumentSort = 'uploaded-desc',
): string {
  return DOCUMENT_CACHE_KEYS.listPrefix + JSON.stringify([
    taxYear ?? 'all',
    transactionId ?? 'none',
    skip,
    take,
    // Sorted so selection order never changes the cache key for the same set of categories.
    [...(reliefCategories ?? [])].sort(),
    sort,
  ])
}

export function invalidateDocumentDerivedData(): void {
  invalidateCachePrefix(DOCUMENT_CACHE_KEYS.listPrefix)
  invalidateCachePrefix(DOCUMENT_CACHE_KEYS.summaryPrefix)
  invalidateCachePrefix(DOCUMENT_CACHE_KEYS.overviewPrefix)
  invalidateCacheKey(DOCUMENT_CACHE_KEYS.usage)
  invalidateCacheKey(DOCUMENT_CACHE_KEYS.years)
  invalidateCacheKey(DOCUMENT_CACHE_KEYS.retention)
  for (const prefix of ['/documents?', '/documents/overview', '/documents/summary', '/documents/usage', '/documents/years', '/documents/retention']) {
    invalidateRevalidationPrefix(prefix)
  }
}

export function invalidateDocumentReliefCategoryData(): void {
  invalidateDocumentDerivedData()
  invalidateCachePrefix(DOCUMENT_CACHE_KEYS.reliefCategoriesPrefix)
  invalidateRevalidationPrefix('/documents/relief-categories')
}

export function invalidateAllDocumentCaches(): void {
  invalidateCachePrefix('documents:')
  invalidateRevalidationPrefix('/documents')
}
