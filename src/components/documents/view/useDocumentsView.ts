import { useState, useCallback, useEffect, useRef } from 'react'
import type { VaultDocument, DocumentVaultUsage, TaxYearReliefSummary, DocumentRetentionReview, TaxReliefCategoryDefinition } from '../../../types'
import * as api from '../../../lib/api/documents'
import { EMPTY_RETENTION_REVIEW } from '../../../lib/documentRetention'
import type { DocumentSort } from '../../../lib/documentOrdering'
import { getErrorMessage } from '../../../lib/errors'

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
  const [retentionReview, setRetentionReview] = useState<DocumentRetentionReview>(EMPTY_RETENTION_REVIEW)
  const [reliefCategories, setReliefCategories] = useState<TaxReliefCategoryDefinition[]>([])
  const [reliefCategoriesByTaxYear, setReliefCategoriesByTaxYear] = useState<Record<number, TaxReliefCategoryDefinition[]>>({})
  
  const [taxYear, setTaxYear] = useState<number | undefined>(undefined)
  const [selectedReliefCategories, setSelectedReliefCategories] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<DocumentSort>('uploaded-desc')
  
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isTaxInsightsLoading, setIsTaxInsightsLoading] = useState(true)
  const [hasLoadedYears, setHasLoadedYears] = useState(false)
  const [hasLoadedDocuments, setHasLoadedDocuments] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const requestIdRef = useRef(0)
  const taxInsightsRequestIdRef = useRef(0)
  const queryKeyRef = useRef<string | null>(null)
  const overviewYearRef = useRef<number | undefined>(undefined)

  const loadDocuments = useCallback(async (isRefresh = false) => {
    const requestId = ++requestIdRef.current
    try {
      setIsLoading(true)
      setLoadError(null)
      const currentPage = isRefresh ? 1 : page
      const skip = (currentPage - 1) * pageSize
      const res = await api.listDocuments(taxYear, undefined, skip, pageSize, selectedReliefCategories, sortOrder)

      if (requestId !== requestIdRef.current) return
      setDocuments(res.items)
      setTotalCount(res.totalCount)
      if (isRefresh) setPage(1)
    } catch (err) {
      console.error('Failed to load documents:', err)
      if (requestId === requestIdRef.current) {
        setLoadError(getErrorMessage(err, 'Your documents could not be loaded. Check your connection and try again.'))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setHasLoadedDocuments(true)
      }
    }
  }, [page, pageSize, taxYear, selectedReliefCategories, sortOrder])

  const loadOverview = useCallback(async (requestedTaxYear?: number, initialize = false) => {
    const requestId = ++taxInsightsRequestIdRef.current
    setIsTaxInsightsLoading(true)
    try {
      const overview = await api.getDocumentOverview(requestedTaxYear)
      if (requestId !== taxInsightsRequestIdRef.current) return
      overviewYearRef.current = initialize ? overview.selectedTaxYear ?? undefined : requestedTaxYear
      setUsage(overview.usage)
      setAvailableYears(overview.availableYears)
      if (!initialize && requestedTaxYear !== undefined && !overview.availableYears.includes(requestedTaxYear)) {
        setTaxYear(overview.availableYears[0])
      }
      setRetentionReview(overview.retention)
      setSummary(overview.summary)
      setReliefCategories(overview.reliefCategories)
      setReliefCategoriesByTaxYear(overview.selectedTaxYear === null
        ? {}
        : { [overview.selectedTaxYear]: overview.reliefCategories })
      if (initialize) setTaxYear(overview.selectedTaxYear ?? undefined)
    } catch (err) {
      console.error('Failed to load document overview:', err)
    } finally {
      if (requestId === taxInsightsRequestIdRef.current) {
        setIsTaxInsightsLoading(false)
        setHasLoadedYears(true)
      }
    }
  }, [])

  useEffect(() => {
    void loadOverview(undefined, true)
  }, [loadOverview])

  useEffect(() => {
    if (!hasLoadedYears) return

    const queryKey = JSON.stringify([taxYear ?? 'all', pageSize, [...selectedReliefCategories].sort(), sortOrder])
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
  }, [hasLoadedYears, page, pageSize, taxYear, selectedReliefCategories, sortOrder, loadDocuments])

  useEffect(() => {
    if (!hasLoadedYears || overviewYearRef.current === taxYear) return
    void loadOverview(taxYear)
  }, [hasLoadedYears, loadOverview, taxYear])

  useEffect(() => {
    setSelectedReliefCategories([])
  }, [taxYear])

  const toggleReliefCategory = useCallback((categoryId: string) => {
    setSelectedReliefCategories(current => current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId])
  }, [])

  const clearReliefCategory = useCallback((categoryId: string) => {
    setSelectedReliefCategories(current => current.filter(id => id !== categoryId))
  }, [])

  const clearAllReliefCategories = useCallback(() => setSelectedReliefCategories([]), [])

  const deleteDocument = async (id: number) => {
    try {
      await api.deleteDocument(id)
      const nextTotalCount = Math.max(0, totalCount - 1)
      setDocuments(docs => docs.filter(d => d.id !== id))
      setTotalCount(nextTotalCount)
      const nextPage = clampDocumentPage(nextTotalCount, page, pageSize)
      if (nextPage !== page) setPage(nextPage)
      else if (nextTotalCount > 0) await loadDocuments()
      void loadOverview(taxYear)
    } catch (err) {
      console.error('Failed to delete document:', err)
      throw err
    }
  }

  const updateDocumentMetadata = async (
    id: number,
    updates: Pick<Partial<VaultDocument>, 'taxYear' | 'transactionId' | 'reliefCategory' | 'amount' | 'amountCurrency'> & {
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
      selectedReliefCategories.length === 0 ? Promise.resolve() : loadDocuments(),
      loadOverview(taxYear),
    ])
    return results
  }, [loadDocuments, loadOverview, selectedReliefCategories, taxYear])

  const bulkDelete = async (ids: number[]) => {
    const results = await api.bulkDeleteDocuments(ids)
    const deletedIds = new Set(results.filter(result => result.deleted).map(result => result.id))
    const nextTotalCount = Math.max(0, totalCount - deletedIds.size)
    setDocuments(current => current.filter(document => !deletedIds.has(document.id)))
    setTotalCount(nextTotalCount)
    const nextPage = clampDocumentPage(nextTotalCount, page, pageSize)
    if (nextPage !== page) setPage(nextPage)
    else if (nextTotalCount > 0) await loadDocuments()
    await loadOverview(taxYear)
    return results
  }

  return {
    documents,
    totalCount,
    usage,
    availableYears,
    summary,
    retentionReview,
    reliefCategories,
    reliefCategoriesByTaxYear,
    isLoading,
    loadError,
    isTaxInsightsLoading,
    isInitialLoading: !hasLoadedYears || !hasLoadedDocuments,
    page,
    setPage,
    pageSize,
    setPageSize,
    taxYear,
    setTaxYear,
    selectedReliefCategories,
    toggleReliefCategory,
    clearReliefCategory,
    clearAllReliefCategories,
    sortOrder,
    setSortOrder,
    loadDocuments,
    loadOverview,
    deleteDocument,
    updateDocumentMetadata,
    bulkUpdateDocumentCategories,
    bulkDelete,
  }
}
