import { useState, useCallback, useEffect } from 'react'
import type { VaultDocument, DocumentVaultUsage } from '../../../types'
import * as api from '../../../lib/api/documents'

export function useDocumentsView() {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [usage, setUsage] = useState<DocumentVaultUsage | null>(null)
  
  const [taxYear, setTaxYear] = useState<number | undefined>(undefined)
  const [search, setSearch] = useState<string>('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadDocuments = useCallback(async (isRefresh = false) => {
    try {
      setIsLoading(true)
      const currentPage = isRefresh ? 1 : page
      const skip = (currentPage - 1) * pageSize
      const res = await api.listDocuments(taxYear, undefined, search, skip, pageSize)
      
      setDocuments(res.items)
      setTotalCount(res.totalCount)
      if (isRefresh) setPage(1)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, taxYear, search])

  const loadUsage = useCallback(async () => {
    try {
      const res = await api.getDocumentUsage()
      setUsage(res)
    } catch (err) {
      console.error('Failed to load document usage:', err)
    }
  }, [])

  useEffect(() => {
    loadDocuments(true)
  }, [taxYear, search]) // Reset to page 1 on filter change

  useEffect(() => {
    if (page > 1) {
      loadDocuments()
    }
  }, [page])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  const deleteDocument = async (id: number) => {
    try {
      await api.deleteDocument(id)
      setDocuments(docs => docs.filter(d => d.id !== id))
      setTotalCount(c => Math.max(0, c - 1))
      loadUsage()
    } catch (err) {
      console.error('Failed to delete document:', err)
      throw err
    }
  }

  const updateDocumentMetadata = async (id: number, updates: Partial<VaultDocument>) => {
    try {
      const updated = await api.updateDocument(id, updates)
      setDocuments(docs => docs.map(d => d.id === id ? updated : d))
    } catch (err) {
      console.error('Failed to update document metadata:', err)
      throw err
    }
  }

  return {
    documents,
    totalCount,
    usage,
    isLoading,
    page,
    setPage,
    pageSize,
    taxYear,
    setTaxYear,
    search,
    setSearch,
    loadDocuments,
    loadUsage,
    deleteDocument,
    updateDocumentMetadata
  }
}
