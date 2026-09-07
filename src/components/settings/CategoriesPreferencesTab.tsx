import React, { useState, useEffect, useMemo } from 'react'
import {
  Save,
  ChevronDown,
  ChevronUp,
  Lock,
  Sparkles,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from 'lucide-react'
import type { CategoryFlowType, DashboardData, TransactionCategory } from '../../types'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import type { CategoryCleanupSuggestion } from '../../lib/api'
import { CollapsibleBody } from '../ui/CollapsibleBody'
import type { useSettingsView } from './view/useSettingsView'
import { CategoryLimitsCard } from './CategoryLimitsCard'
import { ManageableNameList } from './ManageableNameList'
import { CategoryFlowFilter } from './CategoryFlowFilter'
import { isSystemCategoryName } from '../../lib/categoryFlow'
import { Button } from '../ui/Button'
import { MutationButtonContent } from '../ui/MutationButtonContent'
import { CategoryCleanupReviewPanel } from './CategoryCleanupReviewPanel'
import { Badge } from '../ui/Badge'

/**
 * One segment per flow type, so a specific type is a single click. The control used to be one pill
 * that cycled both → inflow → outflow, which took up to three clicks to land on a given type.
 */
const CATEGORY_FLOW_SEGMENTS: ReadonlyArray<{
  value: CategoryFlowType
  label: string
  title: string
  Icon: typeof ArrowLeftRight
  activeClass: string
}> = [
  {
    value: 'both',
    label: 'Allow money in and out',
    title: 'Both — money in and money out',
    Icon: ArrowLeftRight,
    activeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  {
    value: 'inflow',
    label: 'Restrict to money in',
    title: 'Inflow only — money in',
    Icon: ArrowDownLeft,
    activeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'outflow',
    label: 'Restrict to money out',
    title: 'Outflow only — money out',
    Icon: ArrowUpRight,
    activeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
]

export interface CategoriesPreferencesTabProps {
  view: ReturnType<typeof useSettingsView>
  categoriesList: TransactionCategory[]
  hideSensitive: boolean
  activeSyncId?: string | null
  activeSyncIds?: string[]
  dashboardData: DashboardData | null
  onAddCategory: (category: Omit<TransactionCategory, 'id'>) => void
  onUpdateCategoryCycleLimit: (id: string, cycleLimit: number | null) => void
  onUpdateCategoryType?: (id: string, type: CategoryFlowType) => void
  onApplyCategoryCleanupSuggestion?: (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => Promise<void> | void
  onNavigateToLedger?: (options: any) => void
}

export const CategoriesPreferencesTab: React.FC<CategoriesPreferencesTabProps> = ({
  view,
  categoriesList,
  hideSensitive,
  activeSyncId,
  activeSyncIds,
  dashboardData,
  onAddCategory,
  onUpdateCategoryCycleLimit,
  onUpdateCategoryType,
  onApplyCategoryCleanupSuggestion,
  onNavigateToLedger,
}) => {
  const [flowTypeDrafts, setFlowTypeDrafts] = useState<Record<string, CategoryFlowType>>({})
  const [isSavingFlowTypes, setIsSavingFlowTypes] = useState(false)

  useEffect(() => {
    if (categoriesList) {
      setFlowTypeDrafts(Object.fromEntries(categoriesList.map((c: TransactionCategory) => [c.id, c.type || 'both'])))
    }
  }, [categoriesList])

  const changedFlowTypeCategories = useMemo(() => {
    return (categoriesList || []).filter((c: TransactionCategory) => {
      if (isSystemCategoryName(c.name)) return false
      const draft = flowTypeDrafts[c.id]
      const current = c.type || 'both'
      return draft !== undefined && draft !== current
    })
  }, [categoriesList, flowTypeDrafts])

  const categoryRows: Array<{ category: TransactionCategory; count: number | null }> =
    view.categoryUsage ?? view.visibleCategories.map(category => ({ category, count: null }))
  const isCategoryListLoading = categoryRows.length === 0 && view.isLoadingUsage

  // Two columns from the expanded tier, matching the Plan tab: the window is wide enough there for
  // both dense panels to keep their rows on one line, and stacking them put the limits card a full
  // category list below the fold. Compact and medium still get one card per row, where side by side
  // would leave each panel about a third of the window and wrap every row inside it.
  return (
    <div id="settings-panel-categories-preferences" role="tabpanel" aria-labelledby="settings-tab-categories-preferences" className="grid min-w-0 grid-cols-1 gap-6 items-start animate-in fade-in duration-200 lg:grid-cols-2">
      {/* Transaction Categories */}
      <div className="min-w-0 p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs order-2 lg:order-1">
        <div
          role="button"
          tabIndex={0}
          onClick={() => view.setCategoriesOpen(!view.categoriesOpen)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view.setCategoriesOpen(!view.categoriesOpen) } }}
          aria-expanded={view.categoriesOpen}
          className={`flex items-center justify-between gap-3 select-none cursor-pointer ${
            view.categoriesOpen ? 'border-b border-border/40 pb-3' : ''
          }`}
        >
          <div className="min-w-0">
            <h3 className="text-subsection text-foreground">Transaction Categories</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {isCategoryListLoading
                  ? 'Loading categories…'
                  : `${view.visibleCategories.length} active`}
              </span>
              {view.isLoadingUsage && (
                <span className="flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  Checking usage…
                </span>
              )}
              {view.categoryUsage && view.unusedCategoryCount > 0 && (
                <Badge tone="urgent">
                  {view.unusedCategoryCount} unused
                </Badge>
              )}
              {view.categoryUsage && view.rarelyUsedCategoryCount > 0 && (
                <Badge tone="warning">
                  {view.rarelyUsedCategoryCount} rarely used
                </Badge>
              )}
              {view.categoryUsage && view.unusedCategoryCount === 0 && view.rarelyUsedCategoryCount === 0 && view.visibleCategories.length > 0 && (
                <Badge tone="success">
                  all used recently
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="tertiary"
              type="button"
              onClick={e => { e.stopPropagation(); void view.handleAiCleanupReview() }}
              disabled={hideSensitive || view.isReviewingCleanup || view.visibleCategories.length === 0}
              title={hideSensitive ? 'Unhide balances to review' : 'AI category review'}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer sm:min-h-8 ${
                view.isReviewingCleanup
                  ? 'border-blue-500/35 bg-blue-500/5 hover:bg-blue-500/5 text-blue-600 dark:text-blue-400'
                  : 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/30 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed'
              }`}
            >
              {view.isReviewingCleanup ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              AI
            </Button>
            {view.categoriesOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </div>
        </div>

        <CollapsibleBody open={view.categoriesOpen}>
          <div className="space-y-4 px-0.5 pt-4">
            <CategoryCleanupReviewPanel
              open={view.cleanupReviewOpen}
              error={view.cleanupReviewError}
              reviewing={view.isReviewingCleanup}
              suggestions={view.cleanupSuggestions}
              editableCategories={view.editableCategories}
              consolidateTargets={view.consolidateTargets}
              setConsolidateTargets={view.setConsolidateTargets}
              applyingId={view.applyingCleanupId}
              canApply={Boolean(onApplyCategoryCleanupSuggestion)}
              onClose={() => view.setCleanupReviewOpen(false)}
              onApply={suggestion => void view.handleApplyCleanupSuggestion(suggestion)}
              onNavigateToLedger={onNavigateToLedger}
            />

            <CategoryFlowFilter rows={categoryRows}>
              {(filteredCategoryRows, flowControl) => <ManageableNameList
              items={filteredCategoryRows.map(({ category, count }) => ({ ...category, count }))}
              duplicateItems={categoryRows.map(({ category, count }) => ({ ...category, count }))}
              itemLabel="Category"
              addPlaceholder="New Category Name"
              addFormTitle="Add a category"
              addFormDescription="It starts open to both money in and money out; change that from the flow buttons beside its name."
              filterSlot={flowControl}
              disabled={hideSensitive}
              isLoading={isCategoryListLoading}
              isItemReadOnly={item => isSystemCategoryName(item.name)}
              validateName={name => isSystemCategoryName(name) ? 'Name is a reserved word.' : null}
              onAdd={name => onAddCategory({ name, type: 'both' })}
              onDelete={item => view.handleDeleteCategory(item.id)}
              renderName={item => {
                const activeType = flowTypeDrafts[item.id] || item.type || 'both'
                const isDraftChanged = flowTypeDrafts[item.id] != null && flowTypeDrafts[item.id] !== (item.type || 'both')
                const isSystemCategory = isSystemCategoryName(item.name)
                return (
                  <div className="flex flex-1 flex-col gap-1.5 min-w-0 sm:flex-row sm:items-center sm:gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 font-semibold ${getCategoryBadgeClass(item.name)}`}>
                        {item.name}
                      </span>
                      {item.count === 0 ? (
                        <span className="truncate text-xs font-semibold text-orange-500">Unused</span>
                      ) : item.count != null && item.count <= view.RARELY_USED_MAX_COUNT ? (
                        <span className="truncate text-xs font-semibold text-amber-600 dark:text-amber-500">Rarely used · {item.count}×</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSystemCategory ? (
                        <span
                          role="img"
                          aria-label={`${item.name} is managed by FinancialApp; flow is ${activeType === 'inflow' ? 'money in' : activeType === 'outflow' ? 'money out' : 'money in and out'}`}
                          title="Managed category; its flow cannot be changed."
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${
                            activeType === 'inflow'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : activeType === 'outflow'
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'border-border/60 bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          <Lock className="size-2.5" aria-hidden="true" />
                          <span className="capitalize">{activeType}</span>
                        </span>
                      ) : (
                        <div
                          role="group"
                          aria-label={`Flow restriction for ${item.name}`}
                          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${
                            isDraftChanged ? 'border-blue-500/50 bg-blue-500/5' : 'border-border/60 bg-muted/40'
                          }`}
                        >
                          {CATEGORY_FLOW_SEGMENTS.map(segment => {
                            const isActive = activeType === segment.value
                            return (
                              <Button size="icon" variant="tertiary"
                                key={segment.value}
                                type="button"
                                disabled={hideSensitive}
                                onClick={() => setFlowTypeDrafts(prev => ({ ...prev, [item.id]: segment.value }))}
                                aria-pressed={isActive}
                                aria-label={`${segment.label} for ${item.name}`}
                                title={segment.title}
                                // `size-*`, not `min-h-*`: the unlayered `button` floor in index.css
                                // outranks layered utilities, so a min-height of 44px never applied.
                                className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 sm:size-7 lg:size-7 ${
                                  isActive ? segment.activeClass : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <segment.Icon className="size-4" aria-hidden="true" />
                              </Button>
                            )
                          })}
                          {isDraftChanged && (
                            <span
                              role="img"
                              aria-label="Unsaved flow change"
                              title="Unsaved change"
                              className="mx-1 inline-block size-1.5 shrink-0 rounded-full bg-blue-500"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }}
              renderStatus={item => (
                <RowSyncStatus
                  isDeleting={view.isCatDeleting(item.id)}
                  isSyncing={view.isCatSyncing(item.id)}
                  isPending={item.isPendingSync}
                  entityLabel="category"
                />
              )}
              />}
            </CategoryFlowFilter>

            {/* Below the list, not above it: appearing on the first edit used to push every row
                down by its own height, so the flow control moved out from under the pointer on the
                very click that summoned it. Sticky keeps Save reachable without displacing rows. */}
            {changedFlowTypeCategories.length > 0 && (
              <div className="sticky bottom-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 backdrop-blur-sm animate-in fade-in duration-150">
                <span className="truncate text-xs font-bold text-accent-ink">
                  {changedFlowTypeCategories.length} category flow type{changedFlowTypeCategories.length > 1 ? 's' : ''} modified
                </span>
                <div className="flex shrink-0 items-center justify-end gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setFlowTypeDrafts({})}
                    disabled={isSavingFlowTypes || hideSensitive}
                    className="bg-card hover:bg-card"
                  >
                    Discard
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      setIsSavingFlowTypes(true)
                      try {
                        for (const cat of changedFlowTypeCategories) {
                          const draft = flowTypeDrafts[cat.id]
                          if (draft) {
                            await onUpdateCategoryType?.(cat.id, draft)
                          }
                        }
                      } finally {
                        setIsSavingFlowTypes(false)
                      }
                    }}
                    disabled={isSavingFlowTypes || hideSensitive}
                    aria-busy={isSavingFlowTypes}
                    className="shrink-0"
                  >
                    <MutationButtonContent
                      state={isSavingFlowTypes ? 'saving' : null}
                      entityLabel="category flow types"
                      idleLabel="Save"
                      busyLabel="Saving…"
                      idleIcon={<Save className="size-3.5" />}
                    />
                  </Button>
                </div>
              </div>
            )}

            {view.categoryUsage && view.visibleCategories.length > 0 && (
              <p className="text-xs text-muted-foreground px-0.5">
                Usage over the last {view.USAGE_LOOKBACK_CYCLES} cycles, least used first.
              </p>
            )}
            {view.usageError && (
              <p className="text-xs font-medium text-destructive px-0.5">{view.usageError}</p>
            )}
          </div>
        </CollapsibleBody>
      </div>

      <div className="min-w-0 order-1 lg:order-2">
        <CategoryLimitsCard
          categories={view.editableCategories}
          currency={view.activeSettings.currency || 'USD'}
          hideSensitive={hideSensitive}
          activeSyncId={activeSyncId}
          activeSyncIds={activeSyncIds}
          last3CategoryBreakdown={dashboardData?.last3CategoryBreakdown}
          last6CategoryBreakdown={dashboardData?.last6CategoryBreakdown}
          onUpdate={onUpdateCategoryCycleLimit}
        />
      </div>
    </div>
  )
}
