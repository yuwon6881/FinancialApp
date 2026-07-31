import { useState, useCallback, useEffect, useRef } from 'react'
import type { VaultDocument, DocumentVaultUsage, TaxYearReliefSummary, ExpiredTaxYearSummary, TaxReliefCategoryDefinition } from '../../../types'
import * as api from '../../../lib/api/documents'

export function useDocumentsView() {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [usage, setUsage] = useState<DocumentVaultUsage | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [summary, setSummary] = useState<TaxYearReliefSummary | null>(null)
  const [expiredYears, setExpiredYears] = useState<ExpiredTaxYearSummary[]>([])
  const [reliefCategories, setReliefCategories] = useState<TaxReliefCategoryDefinition[]>([])
  
  const [taxYear, setTaxYear] = useState<number | undefined>(undefined)
  const [search, setSearch] = useState<string>('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const requestIdRef = useRef(0)

  const loadDocuments = useCallback(async (isRefresh = false) => {
    const requestId = ++requestIdRef.current
    try {
      setIsLoading(true)
      const currentPage = isRefresh ? 1 : page
      const skip = (currentPage - 1) * pageSize
      const res = await api.listDocuments(taxYear, undefined, search, skip, pageSize)
      
      if (requestId !== requestIdRef.current) return
      setDocuments(res.items)
      setTotalCount(res.totalCount)
      if (isRefresh) setPage(1)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
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

  const loadAvailableYears = useCallback(async () => {
    try {
      const years = await api.getAvailableDocumentYears()
      setAvailableYears(years)
      setTaxYear(current => current === undefined ? years[0] : !years.includes(current) ? years[0] : current)
    } catch (err) {
      console.error('Failed to load document years:', err)
    }
  }, [])

  const loadTaxInsights = useCallback(async () => {
    const selectedYear = taxYear ?? availableYears[0]
    try {
      const [expired, yearSummary, categories] = await Promise.all([
        api.getExpiredTaxYears(),
        selectedYear ? api.getTaxYearReliefSummary(selectedYear).catch(() => null) : Promise.resolve(null),
        selectedYear ? api.getTaxReliefCategories(selectedYear) : Promise.resolve([]),
      ])
      setExpiredYears(expired)
      setSummary(yearSummary)
      setReliefCategories(categories)
    } catch (err) {
      console.error('Failed to load tax insights:', err)
    }
  }, [taxYear, availableYears])

  const addReliefCategory = useCallback(async (input: { name: string; limit: number; detail?: string }) => {
    const selectedYear = taxYear ?? availableYears[0]
    if (selectedYear === undefined) throw new Error('Choose a tax year first.')
    const result = await api.addTaxReliefCategory(selectedYear, input)
    await loadTaxInsights()
    return result
  }, [taxYear, availableYears, loadTaxInsights])

  const updateReliefCategory = useCallback(async (
    categoryId: string,
    input: { name: string; limit: number; detail?: string },
  ) => {
    const selectedYear = taxYear ?? availableYears[0]
    if (selectedYear === undefined) throw new Error('Choose a tax year first.')
    const result = await api.updateTaxReliefCategory(selectedYear, categoryId, input)
    await loadTaxInsights()
    return result
  }, [taxYear, availableYears, loadTaxInsights])

  useEffect(() => {
    setPage(1)
    void loadDocuments(true)
  }, [taxYear, search, pageSize]) // Reset to page 1 when the query shape changes

  useEffect(() => {
    if (page > 1) {
      void loadDocuments()
    }
  }, [page])

  useEffect(() => {
    loadUsage()
    loadAvailableYears()
  }, [loadUsage, loadAvailableYears])

  useEffect(() => {
    void loadTaxInsights()
  }, [loadTaxInsights])

  const deleteDocument = async (id: number) => {
    try {
      await api.deleteDocument(id)
      setDocuments(docs => docs.filter(d => d.id !== id))
      setTotalCount(c => Math.max(0, c - 1))
      void loadUsage()
      void loadAvailableYears()
    } catch (err) {
      console.error('Failed to delete document:', err)
      throw err
    }
  }

  const updateDocumentMetadata = async (
    id: number,
    updates: Pick<Partial<VaultDocument>, 'taxYear' | 'notes' | 'transactionId' | 'reliefCategory' | 'amount' | 'amountCurrency'> & {
      amountStatus?: 'Confirmed' | 'NeedsReview'
    },
  ) => {
    try {
      const updated = await api.updateDocument(id, updates)
      setDocuments(docs => docs.map(d => d.id === id ? updated : d))
    } catch (err) {
      console.error('Failed to update document metadata:', err)
      throw err
    }
  }

  const bulkUpdateDocumentCategories = useCallback(async (
    updates: api.BulkDocumentCategoryUpdate[],
  ) => {
    const results = await api.bulkUpdateDocumentCategories(updates)
    const categoryById = new Map(updates.map(update => [update.id, update.reliefCategory]))
    const updatedIds = new Set(results.filter(result => result.updated).map(result => result.id))
    setDocuments(current => current.map(document => updatedIds.has(document.id)
      ? { ...document, reliefCategory: categoryById.get(document.id) ?? document.reliefCategory }
      : document))
    await loadTaxInsights()
    return results
  }, [loadTaxInsights])

  const bulkDelete = async (ids: number[]) => {
    const results = await api.bulkDeleteDocuments(ids)
    const deletedIds = new Set(results.filter(result => result.deleted).map(result => result.id))
    setDocuments(current => current.filter(document => !deletedIds.has(document.id)))
    setTotalCount(current => Math.max(0, current - deletedIds.size))
    await Promise.all([loadUsage(), loadAvailableYears(), loadTaxInsights()])
    return results
  }

  return {
    documents,
    totalCount,
    usage,
    availableYears,
    summary,
    expiredYears,
    reliefCategories,
    isLoading,
    page,
    setPage,
    pageSize,
    setPageSize,
    taxYear,
    setTaxYear,
    search,
    setSearch,
    loadDocuments,
    loadUsage,
    loadAvailableYears,
    loadTaxInsights,
    addReliefCategory,
    updateReliefCategory,
    deleteDocument,
    updateDocumentMetadata,
    bulkUpdateDocumentCategories,
    bulkDelete,
  }
}
