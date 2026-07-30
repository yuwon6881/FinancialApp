import type {
  VaultDocument,
  VaultDocumentType,
  DocumentVaultUsage,
  VaultDocumentTypeDefinition,
  VaultTypeCleanupSuggestion,
  DocumentVaultConstraints,
  TaxReliefCategoryDefinition,
  TaxYearReliefSummary,
  ExpiredTaxYearSummary,
} from '../../types'
import { request, requestVoid, cachedGet, apiFetch, throwApiError } from './client'
import {
  DOCUMENT_CACHE_KEYS,
  DOCUMENT_CACHE_TTL,
  documentListCacheKey,
  invalidateDocumentDerivedData,
  invalidateDocumentTypes,
} from './documentsCache'
import { downloadCsvBlob } from '../csvExport'

export async function uploadDocument(
  file: File,
  taxYear: number,
  documentType: VaultDocumentType,
  notes?: string,
  transactionId?: string,
  clientKey?: string,
  reliefCategory?: string
): Promise<{ id: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('taxYear', taxYear.toString())
  formData.append('documentType', documentType)
  if (notes) formData.append('notes', notes)
  if (transactionId) formData.append('transactionId', transactionId)
  if (clientKey) formData.append('clientKey', clientKey)
  if (reliefCategory) formData.append('reliefCategory', reliefCategory)

  const response = await apiFetch('/documents', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) await throwApiError(response, 'Failed to upload document')
  const data = await response.json() as { id: number }
  invalidateDocumentDerivedData()
  return data
}

export interface BulkDocumentResult {
  fileName: string
  uploaded: boolean
  id?: number | null
  message?: string | null
}

export async function uploadDocuments(
  files: File[],
  taxYear: number,
  documentType: VaultDocumentType,
  notes?: string,
  reliefCategory?: string,
): Promise<BulkDocumentResult[]> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('taxYear', taxYear.toString())
  formData.append('documentType', documentType)
  if (notes) formData.append('notes', notes)
  if (reliefCategory) formData.append('reliefCategory', reliefCategory)
  const response = await apiFetch('/documents/bulk', { method: 'POST', body: formData })
  if (!response.ok) await throwApiError(response, 'Failed to upload documents')
  const data = await response.json() as { results: BulkDocumentResult[] }
  invalidateDocumentDerivedData()
  return data.results
}

export async function listDocuments(
  taxYear?: number,
  transactionId?: string,
  search?: string,
  skip = 0,
  take = 50
): Promise<{ items: VaultDocument[]; totalCount: number }> {
  const params = new URLSearchParams()
  if (taxYear !== undefined) params.append('taxYear', taxYear.toString())
  if (transactionId) params.append('transactionId', transactionId)
  if (search) params.append('search', search)
  params.append('skip', skip.toString())
  params.append('take', take.toString())

  const cacheKey = documentListCacheKey(taxYear, transactionId, search, skip, take)
  return cachedGet(cacheKey, () => request<{ items: VaultDocument[]; totalCount: number }>(`/documents?${params.toString()}`, {
    method: 'GET',
    errorMessage: 'Failed to load documents',
  }), { staleTime: DOCUMENT_CACHE_TTL.list })
}

export async function listAllDocumentsForTransaction(transactionId: string): Promise<VaultDocument[]> {
  const documents: VaultDocument[] = []
  const pageSize = 100

  while (true) {
    const page = await listDocuments(undefined, transactionId, undefined, documents.length, pageSize)
    documents.push(...page.items)
    if (page.items.length === 0 || documents.length >= page.totalCount) {
      return documents
    }
  }
}

export function getDocumentContentUrl(id: number): string {
  return `/documents/${id}/content`
}

export async function updateDocument(
  id: number,
  updates: {
    taxYear?: number
    documentType?: string
    notes?: string | null
    transactionId?: string | null
    reliefCategory?: string | null
    amount?: number | null
    amountCurrency?: 'MYR' | 'OTHER'
    amountStatus?: 'Confirmed' | 'NeedsReview'
  }
): Promise<VaultDocument> {
  const body: Record<string, unknown> = { ...updates }
  if ('reliefCategory' in updates) body.reliefCategorySpecified = true
  if ('amount' in updates) body.amountSpecified = true
  const data = await request<VaultDocument>(`/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    errorMessage: 'Failed to update document',
  })
  invalidateDocumentDerivedData()
  return data
}

export function getDocumentConstraints(): Promise<DocumentVaultConstraints> {
  return cachedGet(DOCUMENT_CACHE_KEYS.constraints, () => request<DocumentVaultConstraints>('/documents/constraints', {
    method: 'GET',
    errorMessage: 'Failed to load upload limits',
  }), { staleTime: DOCUMENT_CACHE_TTL.constraints })
}

export function getTaxReliefCategories(taxYear: number): Promise<TaxReliefCategoryDefinition[]> {
  return cachedGet(DOCUMENT_CACHE_KEYS.reliefCategories(taxYear), () => request<TaxReliefCategoryDefinition[]>(`/documents/relief-categories?taxYear=${taxYear}`, {
    method: 'GET',
    errorMessage: 'Failed to load tax relief categories',
  }), { staleTime: DOCUMENT_CACHE_TTL.reference })
}

export function getTaxYearReliefSummary(taxYear: number): Promise<TaxYearReliefSummary> {
  return cachedGet(DOCUMENT_CACHE_KEYS.summary(taxYear), () => request<TaxYearReliefSummary>(`/documents/summary/${taxYear}`, {
    method: 'GET',
    errorMessage: 'Failed to load tax relief summary',
  }), { staleTime: DOCUMENT_CACHE_TTL.derived })
}

export function getExpiredTaxYears(): Promise<ExpiredTaxYearSummary[]> {
  return cachedGet(DOCUMENT_CACHE_KEYS.expired, () => request<ExpiredTaxYearSummary[]>('/documents/expired', {
    method: 'GET',
    errorMessage: 'Failed to load retention alerts',
  }), { staleTime: DOCUMENT_CACHE_TTL.derived })
}

export async function bulkDeleteDocuments(ids: number[]): Promise<{ id: number; deleted: boolean; message?: string | null }[]> {
  const result = await request<{ results: { id: number; deleted: boolean; message?: string | null }[] }>('/documents/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    errorMessage: 'Failed to delete documents',
  })
  invalidateDocumentDerivedData()
  return result.results
}

export async function downloadDocumentArchive(taxYear?: number): Promise<void> {
  const query = taxYear === undefined ? '' : `?taxYear=${taxYear}`
  const response = await apiFetch(`/documents/export${query}`)
  if (!response.ok) await throwApiError(response, 'Failed to export documents')
  downloadCsvBlob(await response.blob(), taxYear === undefined ? 'tax-vault-all-tax-years.zip' : `tax-vault-${taxYear}.zip`)
}

export async function deleteDocument(id: number): Promise<void> {
  await requestVoid(`/documents/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete document',
  })
  invalidateDocumentDerivedData()
}

export async function getDocumentUsage(): Promise<DocumentVaultUsage> {
  return cachedGet(DOCUMENT_CACHE_KEYS.usage, () => request<DocumentVaultUsage>('/documents/usage', {
    method: 'GET',
    errorMessage: 'Failed to get document usage',
  }), { staleTime: DOCUMENT_CACHE_TTL.derived })
}

export function getAvailableDocumentYears(): Promise<number[]> {
  return cachedGet(DOCUMENT_CACHE_KEYS.years, () => request<number[]>('/documents/years', {
    method: 'GET',
    errorMessage: 'Failed to load document years',
  }), { staleTime: DOCUMENT_CACHE_TTL.derived })
}

export async function listDocumentTypes(): Promise<VaultDocumentTypeDefinition[]> {
  return cachedGet(DOCUMENT_CACHE_KEYS.types, async () => {
    const types = await request<VaultDocumentTypeDefinition[] | null>('/document-types', {
      method: 'GET',
      errorMessage: 'Failed to load document types',
    })
    return Array.isArray(types) ? types : []
  }, { staleTime: DOCUMENT_CACHE_TTL.types })
}

export async function addDocumentType(name: string, id?: string): Promise<VaultDocumentTypeDefinition> {
  const result = await request<VaultDocumentTypeDefinition>('/document-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, id }),
    errorMessage: 'Failed to add document type',
  })
  invalidateDocumentTypes()
  invalidateDocumentDerivedData()
  return result
}

export async function deleteDocumentType(id: string, replacementId?: string): Promise<void> {
  const query = replacementId ? `?replacementId=${encodeURIComponent(replacementId)}` : ''
  await requestVoid(`/document-types/${encodeURIComponent(id)}${query}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete document type',
  })
  invalidateDocumentTypes()
  invalidateDocumentDerivedData()
}

export function reviewDocumentTypeCleanup(): Promise<{ suggestions: VaultTypeCleanupSuggestion[] }> {
  return request<{ suggestions: VaultTypeCleanupSuggestion[] }>('/document-types/cleanup/review', {
    method: 'POST',
    errorMessage: 'Failed to review document types',
  })
}

export async function applyDocumentTypeCleanup(
  suggestion: VaultTypeCleanupSuggestion,
  targetCategory?: string,
): Promise<void> {
  await request('/document-types/cleanup/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: suggestion.type,
      categories: suggestion.categories,
      targetCategory: targetCategory || suggestion.targetCategory,
      newCategoryName: suggestion.newCategoryName,
    }),
    errorMessage: 'Failed to apply document type cleanup',
  })
  invalidateDocumentTypes()
  invalidateDocumentDerivedData()
}

export async function downloadDocument(id: number, fileName: string): Promise<void> {
  const response = await apiFetch(`/documents/${id}/content`)
  if (!response.ok) await throwApiError(response, 'Failed to download document')
  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition')
  const encodedName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quotedName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1]
  const resolvedName = encodedName
    ? decodeURIComponent(encodedName)
    : quotedName || fileName
  downloadCsvBlob(blob, resolvedName)
}
