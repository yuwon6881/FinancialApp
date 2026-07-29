import type { VaultDocument, VaultDocumentType, DocumentVaultUsage } from '../../types'
import { request, requestVoid, invalidateCache, apiFetch, throwApiError } from './client'
import { downloadCsvBlob } from '../csvExport'

export async function uploadDocument(
  file: File,
  taxYear: number,
  documentType: VaultDocumentType,
  notes?: string,
  transactionId?: string,
  clientKey?: string
): Promise<{ id: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('taxYear', taxYear.toString())
  formData.append('documentType', documentType)
  if (notes) formData.append('notes', notes)
  if (transactionId) formData.append('transactionId', transactionId)
  if (clientKey) formData.append('clientKey', clientKey)

  const response = await apiFetch('/documents', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) await throwApiError(response, 'Failed to upload document')
  const data = await response.json() as { id: number }
  invalidateCache()
  return data
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

  return request<{ items: VaultDocument[]; totalCount: number }>(`/documents?${params.toString()}`, {
    method: 'GET',
    errorMessage: 'Failed to load documents',
  })
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
  }
): Promise<VaultDocument> {
  const data = await request<VaultDocument>(`/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
    errorMessage: 'Failed to update document',
  })
  invalidateCache()
  return data
}

export async function deleteDocument(id: number): Promise<void> {
  await requestVoid(`/documents/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete document',
  })
  invalidateCache()
}

export async function getDocumentUsage(): Promise<DocumentVaultUsage> {
  return request<DocumentVaultUsage>('/documents/usage', {
    method: 'GET',
    errorMessage: 'Failed to get document usage',
  })
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
