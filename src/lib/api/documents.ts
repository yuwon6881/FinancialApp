import type {
  VaultDocument,
  DocumentVaultUsage,
  DocumentVaultConstraints,
  TaxReliefCategoryDefinition,
  TaxYearReliefSummary,
  DocumentRetentionReview,
} from '../../types'
import {
  API_BASE_URL,
  request,
  requestVoid,
  cachedGet,
  apiFetch,
  throwApiError,
  primeCached,
  invalidateRevalidationPrefix,
} from './client'
import {
  DOCUMENT_CACHE_KEYS,
  DOCUMENT_CACHE_TTL,
  documentListCacheKey,
  invalidateDocumentDerivedData,
  invalidateDocumentReliefCategoryData,
} from './documentsCache'
import { downloadCsvBlob } from '../csvExport'
import type { DocumentSort } from '../documentOrdering'

export async function uploadDocument(
  file: File,
  taxYear: number,
  transactionId?: string,
  clientKey?: string,
  reliefCategory?: string,
  amount?: number,
  amountCurrency?: 'MYR' | 'OTHER',
): Promise<{ id: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('taxYear', taxYear.toString())
  if (transactionId) formData.append('transactionId', transactionId)
  if (clientKey) formData.append('clientKey', clientKey)
  if (reliefCategory) formData.append('reliefCategory', reliefCategory)
  if (amount !== undefined && Number.isFinite(amount)) formData.append('amount', amount.toFixed(2))
  if (amountCurrency) formData.append('amountCurrency', amountCurrency)

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

export interface BulkDocumentCategoryUpdate {
  id: number
  reliefCategory: string
}

export interface BulkDocumentCategoryUpdateResult {
  id: number
  updated: boolean
  message?: string | null
}

export interface DocumentOverview {
  usage: DocumentVaultUsage
  availableYears: number[]
  retention: DocumentRetentionReview
  selectedTaxYear: number | null
  summary: TaxYearReliefSummary | null
  reliefCategories: TaxReliefCategoryDefinition[]
}

/** Seeds overview GETs from an authoritative partial-bootstrap response. */
export function primeDocumentOverview(overview: DocumentOverview): void {
  // A composite refresh has no validator for the individual overview route. Drop any older
  // per-route ETag so the first request after this seed expires cannot resurrect stale data via
  // a 304 response tied to the body that preceded the mutation.
  invalidateRevalidationPrefix('/documents/overview')
  primeCached(DOCUMENT_CACHE_KEYS.overview(), overview, DOCUMENT_CACHE_TTL.derived)
  if (overview.selectedTaxYear !== null) {
    primeCached(DOCUMENT_CACHE_KEYS.overview(overview.selectedTaxYear), overview, DOCUMENT_CACHE_TTL.derived)
  }
}

export function getDocumentOverview(taxYear?: number): Promise<DocumentOverview> {
  const query = taxYear === undefined ? '' : `?taxYear=${taxYear}`
  return cachedGet(DOCUMENT_CACHE_KEYS.overview(taxYear), () => request<DocumentOverview>(`/documents/overview${query}`, {
    method: 'GET',
    errorMessage: 'Failed to load document overview',
  }), { staleTime: DOCUMENT_CACHE_TTL.derived })
}

export async function uploadDocuments(
  files: File[],
  taxYear: number,
  reliefCategory?: string,
): Promise<BulkDocumentResult[]> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('taxYear', taxYear.toString())
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
  skip = 0,
  take = 50,
  reliefCategories?: string[],
  sort: DocumentSort = 'uploaded-desc',
): Promise<{ items: VaultDocument[]; totalCount: number }> {
  const params = new URLSearchParams()
  if (taxYear !== undefined) params.append('taxYear', taxYear.toString())
  if (transactionId) params.append('transactionId', transactionId)
  // Multiple categories are OR'd server-side by joining them into one comma-separated param.
  if (reliefCategories && reliefCategories.length > 0) params.append('reliefCategory', reliefCategories.join(','))
  params.append('skip', skip.toString())
  params.append('take', take.toString())
  params.append('sort', sort)

  const cacheKey = documentListCacheKey(taxYear, transactionId, skip, take, reliefCategories, sort)
  return cachedGet(cacheKey, () => request<{ items: VaultDocument[]; totalCount: number }>(`/documents?${params.toString()}`, {
    method: 'GET',
    errorMessage: 'Failed to load documents',
  }), { staleTime: DOCUMENT_CACHE_TTL.list })
}

export async function listAllDocumentsForTransaction(transactionId: string): Promise<VaultDocument[]> {
  const documents: VaultDocument[] = []
  const pageSize = 100

  while (true) {
    const page = await listDocuments(undefined, transactionId, documents.length, pageSize)
    documents.push(...page.items)
    if (page.items.length === 0 || documents.length >= page.totalCount) {
      return documents
    }
  }
}

export function getDocumentContentUrl(id: number): string {
  return `/documents/${id}/content`
}

/** Same-origin URL for browser PDF/image viewers, which can send the auth cookie themselves. */
export function getDocumentPreviewUrl(id: number): string {
  return `${API_BASE_URL}${getDocumentContentUrl(id)}`
}

export async function updateDocument(
  id: number,
  updates: {
    taxYear?: number
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

export async function bulkUpdateDocumentCategories(
  updates: BulkDocumentCategoryUpdate[],
): Promise<BulkDocumentCategoryUpdateResult[]> {
  const results: BulkDocumentCategoryUpdateResult[] = []
  try {
    for (let index = 0; index < updates.length; index += 100) {
      const batch = updates.slice(index, index + 100)
      const result = await request<{ results: BulkDocumentCategoryUpdateResult[] }>('/documents/bulk-update-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: batch }),
        errorMessage: 'Failed to update document categories',
      })
      results.push(...result.results)
    }
  } finally {
    // Invalidated even when a later chunk throws: the earlier chunks were committed, so leaving the
    // list and summary caches in place would keep serving figures that no longer match the server.
    invalidateDocumentDerivedData()
  }
  return results
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

export interface TaxReliefCategoryInput {
  name: string
  limit: number
}

export async function addTaxReliefCategory(
  taxYear: number,
  input: TaxReliefCategoryInput,
): Promise<TaxReliefCategoryDefinition> {
  const result = await request<TaxReliefCategoryDefinition>(`/documents/relief-categories/${taxYear}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    errorMessage: 'Failed to add tax relief category',
  })
  invalidateDocumentReliefCategoryData()
  return result
}

export async function updateTaxReliefCategory(
  taxYear: number,
  categoryId: string,
  input: TaxReliefCategoryInput,
): Promise<TaxReliefCategoryDefinition> {
  const result = await request<TaxReliefCategoryDefinition>(
    `/documents/relief-categories/${taxYear}/${encodeURIComponent(categoryId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      errorMessage: 'Failed to update tax relief category',
    },
  )
  invalidateDocumentReliefCategoryData()
  return result
}

export async function deleteTaxReliefCategory(taxYear: number, categoryId: string): Promise<void> {
  await requestVoid(
    `/documents/relief-categories/${taxYear}/${encodeURIComponent(categoryId)}`,
    {
      method: 'DELETE',
      errorMessage: 'Failed to delete tax relief category',
    },
  )
  invalidateDocumentReliefCategoryData()
}

export function getDocumentRetentionReview(): Promise<DocumentRetentionReview> {
  return cachedGet(DOCUMENT_CACHE_KEYS.retention, () => request<DocumentRetentionReview>('/documents/retention', {
    method: 'GET',
    errorMessage: 'Failed to load retention alerts',
  }), { staleTime: DOCUMENT_CACHE_TTL.derived })
}

/**
 * The most documents one bulk delete or bulk download may carry. The server rejects anything larger
 * outright, so the UI must stop the user before they get there rather than after — selection persists
 * across pages, which is how a 50-per-page list reaches three figures.
 */
export const DOCUMENT_BULK_LIMIT = 100

export interface BulkDocumentTransactionLink {
  id: number
  /** Null detaches the document from the transaction it currently has. */
  transactionId: string | null
}

export interface BulkDocumentTransactionLinkResult {
  id: number
  updated: boolean
  message?: string | null
}

/**
 * Re-points or detaches several documents' owning transaction in one call.
 *
 * Chunked to the same ceiling the server enforces, for the same reason `bulkUpdateDocumentCategories`
 * is: post-sync reconciliation walks every synced transaction's document changes at once, so a batch
 * of drafts pushed together can carry more link changes than one request may hold.
 */
export async function bulkUpdateDocumentTransactionLinks(
  updates: BulkDocumentTransactionLink[],
): Promise<BulkDocumentTransactionLinkResult[]> {
  const results: BulkDocumentTransactionLinkResult[] = []
  if (updates.length === 0) return results
  try {
    for (let index = 0; index < updates.length; index += DOCUMENT_BULK_LIMIT) {
      const batch = updates.slice(index, index + DOCUMENT_BULK_LIMIT)
      const result = await request<{ results: BulkDocumentTransactionLinkResult[] }>('/documents/bulk-update-transaction-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: batch }),
        errorMessage: 'Failed to update document links',
      })
      results.push(...result.results)
    }
  } finally {
    // Earlier chunks are committed even when a later one throws, so the list and summary caches
    // would otherwise keep serving links that no longer exist.
    invalidateDocumentDerivedData()
  }
  return results
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
  await downloadCsvBlob(await response.blob(), taxYear === undefined ? 'tax-vault-all-tax-years.zip' : `tax-vault-${taxYear}.zip`)
}

export async function downloadSelectedDocumentArchive(ids: number[]): Promise<void> {
  const response = await apiFetch('/documents/export-selected', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!response.ok) await throwApiError(response, 'Failed to export selected documents')
  await downloadCsvBlob(await response.blob(), 'tax-vault-selected.zip')
}

export async function deleteDocument(id: number): Promise<void> {
  await requestVoid(`/documents/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete document',
  })
  invalidateDocumentDerivedData()
}

export async function downloadDocument(id: number, fileName: string): Promise<void> {
  const { blob, fileName: responseFileName } = await getDocumentContent(id, fileName)
  await downloadCsvBlob(blob, responseFileName)
}

export interface DocumentContent {
  blob: Blob
  fileName: string
  contentType: string
}

export async function getDocumentContent(id: number, fileName: string): Promise<DocumentContent> {
  const response = await apiFetch(getDocumentContentUrl(id))
  if (!response.ok) await throwApiError(response, 'Failed to download document')
  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition')
  const encodedName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quotedName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1]
  const resolvedName = encodedName
    ? decodeURIComponent(encodedName)
    : quotedName || fileName
  return {
    blob,
    fileName: resolvedName,
    contentType: response.headers.get('content-type') || blob.type || 'application/octet-stream',
  }
}
