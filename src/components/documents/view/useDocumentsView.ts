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

export function useDocumentsView(showToast?: (message: string, title?: string, tone?: 'success' | 'error' | 'info' | 'warning') => void) {
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
  const requestedCategoryYearsRef = useRef(new Set<number>())
  const taxInsightsRequestIdRef = useRef(0)
  const queryKeyRef = useRef<string | null>(null)
  const overviewYearRef = useRef<number | undefined>(undefined)

  const applyOverview = useCallback((overview: api.DocumentOverview, requestedTaxYear?: number, initialize = false) => {
    const matchesRequestedYear = requestedTaxYear === undefined || overview.selectedTaxYear === requestedTaxYear
    if (initialize || matchesRequestedYear) {
      overviewYearRef.current = initialize ? overview.selectedTaxYear ?? undefined : requestedTaxYear
    }
    setUsage(overview.usage)
    setAvailableYears(overview.availableYears)
    if (!initialize && requestedTaxYear !== undefined && !overview.availableYears.includes(requestedTaxYear)) {
      setTaxYear(overview.availableYears[0])
    }
    setRetentionReview(overview.retention)
    // A partial refresh describes the server's default tax year. Do not replace a mounted user's
    // selected-year summary with that other year's values; fetch the requested year once below.
    if (initialize || matchesRequestedYear || requestedTaxYear === undefined) {
      setSummary(overview.summary)
      setReliefCategories(overview.reliefCategories)
      if (overview.selectedTaxYear !== null) {
        const selectedYear = overview.selectedTaxYear
        requestedCategoryYearsRef.current.add(selectedYear)
        setReliefCategoriesByTaxYear(current => ({ ...current, [selectedYear]: overview.reliefCategories }))
      }
    }
    if (initialize) setTaxYear(overview.selectedTaxYear ?? undefined)
    return matchesRequestedYear
  }, [])

  const loadDocuments = useCallback(async (isRefresh = false, rethrowOnError = false) => {
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
      if (rethrowOnError) throw err
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setHasLoadedDocuments(true)
      }
    }
  }, [page, pageSize, taxYear, selectedReliefCategories, sortOrder])

  const loadOverview = useCallback(async (requestedTaxYear?: number, initialize = false, rethrowOnError = false) => {
    const requestId = ++taxInsightsRequestIdRef.current
    setIsTaxInsightsLoading(true)
    try {
      const overview = await api.getDocumentOverview(requestedTaxYear)
      if (requestId !== taxInsightsRequestIdRef.current) return
      applyOverview(overview, requestedTaxYear, initialize)
      // Merged, never replaced. The list can show documents from several tax years at once (the
      // "All years" filter), and each row's category picker reads this map by the document's own
      // tax year — so discarding the years the overview is not about left those rows with an empty
      // picker and no way to see or change a category the document already had.
    } catch (err) {
      console.error('Failed to load document overview:', err)
      if (rethrowOnError) throw err
    } finally {
      if (requestId === taxInsightsRequestIdRef.current) {
        setIsTaxInsightsLoading(false)
        setHasLoadedYears(true)
      }
    }
  }, [applyOverview])

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

  // A transaction outbox batch can upload, unlink, or delete Vault documents after the ledger
  // row is acknowledged. Refresh an already-mounted Vault without making the ledger wait for a
  // second full bootstrap; an unmounted view simply performs its authoritative load on mount.
  useEffect(() => {
    const refreshAfterSync = (event: Event) => {
      const detail = (event as CustomEvent<{
        overview?: api.DocumentOverview
        acknowledge?: (work: Promise<void>) => void
      }>).detail
      const work = (async () => {
        let matchesRequestedYear = true
        if (detail?.overview) {
          matchesRequestedYear = applyOverview(detail.overview, taxYear)
        } else {
          await loadOverview(taxYear, false, true)
        }
        if (!matchesRequestedYear && taxYear !== undefined) {
          await loadOverview(taxYear, false, true)
        }
        // The partial contract intentionally carries overview data, not a paged list. Refresh the
        // mounted page separately so document add/delete/category changes are visible immediately.
        await loadDocuments(true, true)
      })()
      if (detail?.acknowledge) detail.acknowledge(work)
      else void work.catch(() => undefined)
    }
    window.addEventListener('documents-sync', refreshAfterSync)
    return () => window.removeEventListener('documents-sync', refreshAfterSync)
  }, [applyOverview, loadDocuments, loadOverview, taxYear])

  // Fills in the relief categories for the other tax years on screen. Each year is asked for once
  // and the answers are cached for an hour, so an all-years list costs one request per distinct
  // year rather than one per page.
  useEffect(() => {
    const missingYears = [...new Set(documents.map(document => document.taxYear))]
      .filter(year => !requestedCategoryYearsRef.current.has(year))
    if (missingYears.length === 0) return

    for (const year of missingYears) {
      requestedCategoryYearsRef.current.add(year)
      void api.getTaxReliefCategories(year)
        .then(categories => setReliefCategoriesByTaxYear(current => ({ ...current, [year]: categories })))
        .catch(err => {
          // A year that could not be loaded is asked for again the next time its documents are
          // listed; leaving it marked as requested would make one failure permanent for the session.
          requestedCategoryYearsRef.current.delete(year)
          console.error('Failed to load tax relief categories for', year, err)
        })
    }
  }, [documents])

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
      showToast?.('Document updated.', 'Saved', 'success')
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
