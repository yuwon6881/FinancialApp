import { useState, useCallback, useEffect, useRef } from 'react'
import type { VaultDocument, DocumentVaultUsage, TaxYearReliefSummary, ExpiredTaxYearSummary, TaxReliefCategoryDefinition } from '../../../types'
import * as api from '../../../lib/api/documents'
import type { DocumentSort } from '../../../lib/documentOrdering'

function clampDocumentPage(totalCount: number, page: number, pageSize: number): number {
  if (totalCount <= 0) return 1
  return Math.max(1, Math.min(page, Math.ceil(totalCount / pageSize)))
}

export function useDocumentsView() {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [usage, setUsage] = useState<DocumentVaultUsage | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [summary, setSummary] = useState<TaxYearReliefSummary | null>(null)
  const [expiredYears, setExpiredYears] = useState<ExpiredTaxYearSummary[]>([])
  const [reliefCategories, setReliefCategories] = useState<TaxReliefCategoryDefinition[]>([])
  const [reliefCategoriesByTaxYear, setReliefCategoriesByTaxYear] = useState<Record<number, TaxReliefCategoryDefinition[]>>({})
  
  const [taxYear, setTaxYear] = useState<number | undefined>(undefined)
  const [reliefCategory, setReliefCategory] = useState<string | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<DocumentSort>('uploaded-desc')
  
  const [isLoading, setIsLoading] = useState(true)
  const [isTaxInsightsLoading, setIsTaxInsightsLoading] = useState(true)
  const [hasLoadedYears, setHasLoadedYears] = useState(false)
  const [hasLoadedDocuments, setHasLoadedDocuments] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const requestIdRef = useRef(0)
  const taxInsightsRequestIdRef = useRef(0)
  const queryKeyRef = useRef<string | null>(null)

  const loadDocuments = useCallback(async (isRefresh = false) => {
    const requestId = ++requestIdRef.current
    try {
      setIsLoading(true)
      const currentPage = isRefresh ? 1 : page
      const skip = (currentPage - 1) * pageSize
      const res = await api.listDocuments(taxYear, undefined, skip, pageSize, reliefCategory, sortOrder)
      
      if (requestId !== requestIdRef.current) return
      setDocuments(res.items)
      setTotalCount(res.totalCount)
      if (isRefresh) setPage(1)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setHasLoadedDocuments(true)
      }
    }
  }, [page, pageSize, taxYear, reliefCategory, sortOrder])

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
    } finally {
      setHasLoadedYears(true)
    }
  }, [])

  const loadTaxInsights = useCallback(async () => {
    const requestId = ++taxInsightsRequestIdRef.current
    const selectedYear = taxYear ?? availableYears[0]
    const categoryYears = taxYear === undefined ? availableYears : selectedYear === undefined ? [] : [selectedYear]
    setIsTaxInsightsLoading(true)
    try {
      const [expired, yearSummary, categoryResults] = await Promise.all([
        api.getExpiredTaxYears(),
        selectedYear ? api.getTaxYearReliefSummary(selectedYear).catch(() => null) : Promise.resolve(null),
        Promise.all(categoryYears.map(async year => [year, await api.getTaxReliefCategories(year).catch(() => [])] as const)),
      ])
      if (requestId !== taxInsightsRequestIdRef.current) return
      const categoriesByYear = Object.fromEntries(categoryResults) as Record<number, TaxReliefCategoryDefinition[]>
      setExpiredYears(expired)
      setSummary(yearSummary)
      setReliefCategories(selectedYear === undefined ? [] : categoriesByYear[selectedYear] ?? [])
      setReliefCategoriesByTaxYear(categoriesByYear)
    } catch (err) {
      console.error('Failed to load tax insights:', err)
    } finally {
      if (requestId === taxInsightsRequestIdRef.current) setIsTaxInsightsLoading(false)
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
    loadUsage()
    loadAvailableYears()
  }, [loadUsage, loadAvailableYears])

  useEffect(() => {
    if (!hasLoadedYears) return

    const queryKey = JSON.stringify([taxYear ?? 'all', pageSize, reliefCategory ?? '', sortOrder])
    const queryChanged = queryKeyRef.current !== queryKey
    queryKeyRef.current = queryKey

    // A filter/page-size change always starts at page one. If the user was on a later page,
    // update the visible page first and let this effect run again so the request uses the
    // state that the pagination control displays. This also means page 1 is fetched when the
    // user navigates backwards; the old `page > 1` guard left that page visibly stale.
    if (queryChanged && page !== 1) {
      setPage(1)
      return
    }

    void loadDocuments()
  }, [hasLoadedYears, page, pageSize, taxYear, reliefCategory, sortOrder, loadDocuments])

  useEffect(() => {
    void loadTaxInsights()
  }, [loadTaxInsights])

  useEffect(() => {
    setReliefCategory(undefined)
  }, [taxYear])

  const deleteDocument = async (id: number) => {
    try {
      await api.deleteDocument(id)
      const nextTotalCount = Math.max(0, totalCount - 1)
      setDocuments(docs => docs.filter(d => d.id !== id))
      setTotalCount(nextTotalCount)
      const nextPage = clampDocumentPage(nextTotalCount, page, pageSize)
      if (nextPage !== page) setPage(nextPage)
      else if (nextTotalCount > 0) await loadDocuments()
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
    await Promise.all([
      reliefCategory === undefined ? Promise.resolve() : loadDocuments(),
      loadTaxInsights(),
    ])
    return results
  }, [loadDocuments, loadTaxInsights, reliefCategory])

  const bulkDelete = async (ids: number[]) => {
    const results = await api.bulkDeleteDocuments(ids)
    const deletedIds = new Set(results.filter(result => result.deleted).map(result => result.id))
    const nextTotalCount = Math.max(0, totalCount - deletedIds.size)
    setDocuments(current => current.filter(document => !deletedIds.has(document.id)))
    setTotalCount(nextTotalCount)
    const nextPage = clampDocumentPage(nextTotalCount, page, pageSize)
    if (nextPage !== page) setPage(nextPage)
    else if (nextTotalCount > 0) await loadDocuments()
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
    reliefCategoriesByTaxYear,
    isLoading,
    isTaxInsightsLoading,
    isInitialLoading: !hasLoadedYears || !hasLoadedDocuments,
    page,
    setPage,
    pageSize,
    setPageSize,
    taxYear,
    setTaxYear,
    reliefCategory,
    setReliefCategory,
    sortOrder,
    setSortOrder,
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
