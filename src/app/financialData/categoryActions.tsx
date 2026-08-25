import type { CategoryFlowType, RecurringPayment, TransactionCategory } from '../../types'
import { ExternalLink } from 'lucide-react'
import * as api from '../../lib/api'
import type { CategoryCleanupSuggestion } from '../../lib/api'
import { isSpendingGuideCategory, isSystemCategoryName } from '../../lib/categoryFlow'
import { createFinalId, enqueue } from '../../lib/outbox'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'
import { Button } from '../../components/ui/Button'
// Deliberately the deferred wrapper, not the picker itself: importing CategoryReplacementSelect
// directly here pulled its CustomSelect -> AnchoredPopover chain onto the eager critical path. See
// the comment in CategoryReplacementSelectLazy for the measurement.
import { CategoryReplacementSelectLazy } from '../../components/ui/CategoryReplacementSelectLazy'
import { preloadCategoryReplacementSelect } from '../../components/ui/categoryReplacementSelectChunk'

interface CategoryActionDependencies {
  /** The optimistic projection, so a row visible in Settings is always resolvable here. */
  allCategories: TransactionCategory[]
  allRecurringPayments: RecurringPayment[]
  guardSensitive: () => boolean
  mutateQueue: UseOutboxResult['mutateQueue']
  snapshotForUndo: UseOutboxResult['snapshotForUndo']
  setConfirmModalData: AppDialogs['setConfirmModalData']
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  onNavigateToLedger?: (options: {
    category?: string | null
    range?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
    showAllCycles?: boolean
    search?: string | null
    date?: string | null
    highlightedTxId?: string | null
  }) => void
}

/**
 * Category create/edit/delete plus the AI cleanup applier. Deleting a category the ledger still
 * uses needs a replacement first, so the confirm dialog owns that choice and hands the resolved
 * replacement to the queued op.
 */
export function createCategoryActions(deps: CategoryActionDependencies) {
  const {
    allCategories,
    allRecurringPayments,
    guardSensitive,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
    showToast,
    onNavigateToLedger,
  } = deps

  const handleAddCategory = (newCat: Omit<TransactionCategory, 'id'>) => {
    if (!guardSensitive()) return
    const finalId = createFinalId('category')
    mutateQueue(prev => enqueue(prev, 'category', 'add', finalId, { ...newCat, id: finalId }))
  }

  const updateCatMeta = (id: string, patch: { cycleLimit?: number | null; type?: CategoryFlowType }) => {
    if (!guardSensitive()) return
    const category = allCategories.find(cat => String(cat.id) === String(id))
    if (!category || isSystemCategoryName(category.name)) return
    snapshotForUndo('category', String(id), category)
    // Restricting a category to money in retires its spending guide: the server clears
    // `CycleLimit` (and the current cycle's guide row) as part of the same write, so the
    // projection has to say so too, or the limit stays on screen with nothing watching it. It
    // also keeps the merged payload valid — `enqueue` folds a queued limit edit into this op,
    // and the server refuses a limit and an inflow type in one request.
    const clearsSpendingGuide = patch.type !== undefined && !isSpendingGuideCategory({ type: patch.type })
    mutateQueue(prev => enqueue(prev, 'category', 'update', id, {
      name: category?.name,
      type: category?.type,
      ...(patch.cycleLimit !== undefined ? { cycleLimit: patch.cycleLimit } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(clearsSpendingGuide ? { cycleLimit: null } : {}),
      undoSnapshot: category,
    }))
  }

  const handleUpdateCategoryCycleLimit = (id: string, cycleLimit: number | null) => updateCatMeta(id, { cycleLimit })
  const handleUpdateCategoryType = (id: string, type: CategoryFlowType) => updateCatMeta(id, { type })

  const handleDeleteCategory = (id: string, replacementCategoryId?: string) => {
    if (!guardSensitive()) return
    const category = allCategories.find(cat => String(cat.id) === String(id))
    if (!category || isSystemCategoryName(category.name)) return
    const replacementCategory = replacementCategoryId
      ? allCategories.find(cat => String(cat.id) === String(replacementCategoryId))
      : undefined
    snapshotForUndo('category', String(id), category)
    mutateQueue(prev => enqueue(prev, 'category', 'delete', id, {
      name: category?.name,
      replacementCategoryId,
      replacementCategoryName: replacementCategory?.name,
      undoSnapshot: category,
    }))
  }

  const requestDeleteCategory = async (id: string) => {
    if (!guardSensitive()) return
    const category = allCategories.find(cat => String(cat.id) === String(id))
    if (!category || isSystemCategoryName(category.name)) return
    const replacementOptions = allCategories.filter(cat => {
      return String(cat.id) !== String(id) && !isSystemCategoryName(cat.name) && !cat.isPendingDelete
    })
    preloadCategoryReplacementSelect()
    let transactionCount = 0
    let usageLookupFailed = false
    try {
      const usage = await api.fetchPagedTransactions({ page: 1, pageSize: 1, categories: [category.name] })
      transactionCount = usage.total
    } catch (err) {
      console.error(err)
      usageLookupFailed = true
    }
    const recurringPaymentCount = allRecurringPayments.filter(payment =>
      !payment.isPendingDelete && payment.category.trim().toLowerCase() === category.name.trim().toLowerCase()
    ).length
    const requiresReplacement = usageLookupFailed || transactionCount > 0 || recurringPaymentCount > 0
    let selectedReplacementId = ''
    setConfirmModalData({
      title: 'Delete Category',
      message: (
        <div className="space-y-3.5">
          <p className="text-sm text-foreground">
            Delete <strong className="font-semibold text-foreground">"{category.name}"</strong>?
          </p>
          {requiresReplacement ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Ledger transactions</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-semibold text-foreground">
                      {usageLookupFailed ? '1+ transactions' : `${transactionCount} ${transactionCount === 1 ? 'transaction' : 'transactions'}`}
                    </span>
                    {(transactionCount > 0 || usageLookupFailed) && onNavigateToLedger && (
                      <Button
                        variant="outline"
                        size="xs"
                        type="button"
                        onClick={() => {
                          setConfirmModalData(null)
                          onNavigateToLedger({
                            category: category.name,
                            showAllCycles: true,
                            range: 'all',
                          })
                        }}
                        className="gap-1 rounded-lg text-[11px]"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                        <span>View in Ledger</span>
                      </Button>
                    )}
                  </div>
                </div>
                {recurringPaymentCount > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Recurring bills</span>
                    <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-semibold text-foreground">
                      {recurringPaymentCount} {recurringPaymentCount === 1 ? 'bill' : 'bills'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Choose a replacement category before deleting:
                </p>
                <CategoryReplacementSelectLazy
                  options={replacementOptions}
                  onChange={selected => {
                    selectedReplacementId = selected
                    setConfirmModalData(previous => previous ? { ...previous, confirmDisabled: selectedReplacementId.length === 0 } : previous)
                  }}
                />
                {replacementOptions.length === 0 && (
                  <p className="text-[11px] font-semibold text-destructive">
                    Add another category before deleting this one.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>No ledger transactions or recurring payments currently use this category. It can be safely deleted.</p>
            </div>
          )}
        </div>
      ),
      confirmText: requiresReplacement ? 'Transfer and Delete' : 'Delete',
      confirmDisabled: requiresReplacement,
      onConfirm: () => {
        handleDeleteCategory(id, selectedReplacementId || undefined)
      }
    })
  }

  const handleApplyCategoryCleanupSuggestion = async (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => {
    if (!guardSensitive()) return
    if (suggestion.type === 'consolidate' && !targetCategoryOverride) {
      showToast('Choose a category to move these entries to first.', 'AI Cleanup', 'warning')
      return
    }
    const actions = suggestion.type === 'add'
      ? [{ type: 'add' as const, newCategoryName: suggestion.newCategoryName || undefined, categoryId: createFinalId('category') }]
      : suggestion.type === 'merge'
      ? [{ type: 'merge' as const, categories: suggestion.categories, targetCategory: suggestion.targetCategory || undefined }]
      : suggestion.type === 'consolidate'
      ? [{ type: 'merge' as const, categories: suggestion.categories, targetCategory: targetCategoryOverride }]
      : [{ type: 'delete' as const, categories: suggestion.categories }]

    const description = suggestion.type === 'add'
      ? suggestion.newCategoryName || 'new category'
      : suggestion.type === 'consolidate'
        ? `${suggestion.categories.join(', ')} → ${targetCategoryOverride}`
        : suggestion.type === 'merge'
          ? `${suggestion.categories.join(', ')} → ${suggestion.targetCategory || 'target category'}`
          : suggestion.categories.join(', ')
    mutateQueue(previous => enqueue(previous, 'category', 'cleanup', suggestion.id, {
      actions,
      description,
    }))
  }

  return {
    handleAddCategory,
    handleUpdateCategoryCycleLimit,
    handleUpdateCategoryType,
    handleDeleteCategory,
    requestDeleteCategory,
    handleApplyCategoryCleanupSuggestion,
  }
}
