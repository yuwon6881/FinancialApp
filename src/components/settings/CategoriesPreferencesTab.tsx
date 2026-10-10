import React, { useState, useEffect, useMemo } from 'react'
import {
  Save,
  Lock,
  Sparkles,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from 'lucide-react'
import type { CategoryFlowType, DashboardData, TransactionCategory } from '../../types'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import type { CategoryCleanupSuggestion } from '../../lib/api'
import { panelClass } from '../ui/panelStyles'
import { cn } from '../../lib/utils'
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
    activeClass: 'bg-card text-foreground shadow-xs dark:bg-surface-3',
  },
  {
    value: 'inflow',
    label: 'Restrict to money in',
    title: 'Inflow only — money in',
    Icon: ArrowDownLeft,
    activeClass: 'bg-card text-emerald-600 shadow-xs dark:bg-surface-3 dark:text-emerald-400',
  },
  {
    value: 'outflow',
    label: 'Restrict to money out',
    title: 'Outflow only — money out',
    Icon: ArrowUpRight,
    activeClass: 'bg-card text-foreground shadow-xs dark:bg-surface-3',
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

  const usageSummary = isCategoryListLoading
    ? 'Loading categories…'
    : `${view.visibleCategories.length} active`

  // Limits lead: they are the plan. The category list beside them is housekeeping -- names, which
  // way money may flow, and what is no longer used. Side by side once the tab is wide enough for
  // both lists to keep their rows on one line; stacked, limits first, below that.
  return (
    <div id="settings-panel-categories-preferences" role="tabpanel" aria-labelledby="settings-tab-categories-preferences" className="@container min-w-0 animate-in fade-in duration-200">
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 @5xl:grid-cols-2">
      <CategoryLimitsCard
        categories={view.editableCategories}
        currency={view.activeSettings.currency || 'USD'}
        hideSensitive={hideSensitive}
        activeSyncId={activeSyncId}
        activeSyncIds={activeSyncIds}
        last3CategoryBreakdown={dashboardData?.last3CategoryBreakdown}
        last6CategoryBreakdown={dashboardData?.last6CategoryBreakdown}
        cycleSpend={dashboardData?.monthlyCategoryBreakdown}
        limitProgress={dashboardData?.categoryLimitProgress}
        onUpdate={onUpdateCategoryCycleLimit}
      />

      <section aria-labelledby="transaction-categories-heading" className={cn(panelClass, 'min-w-0 overflow-hidden')}>
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <h2 id="transaction-categories-heading" className="text-section text-foreground">Categories</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
              <span>{usageSummary}</span>
              {view.isLoadingUsage && (
                <span className="flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Checking usage…
                </span>
              )}
              {view.categoryUsage && view.unusedCategoryCount > 0 && (
                <Badge tone="warning">{view.unusedCategoryCount} unused</Badge>
              )}
              {view.categoryUsage && view.rarelyUsedCategoryCount > 0 && (
                <Badge tone="neutral">{view.rarelyUsedCategoryCount} rarely used</Badge>
              )}
              {view.categoryUsage && view.unusedCategoryCount === 0 && view.rarelyUsedCategoryCount === 0 && view.visibleCategories.length > 0 && (
                <Badge tone="success">all used recently</Badge>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => { void view.handleAiCleanupReview() }}
            disabled={hideSensitive || view.isReviewingCleanup || view.visibleCategories.length === 0}
            title={hideSensitive ? 'Unhide balances to review' : 'AI category review'}
            aria-label="AI category review"
            aria-busy={view.isReviewingCleanup}
            className="shrink-0"
          >
            {view.isReviewingCleanup ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
            Review
          </Button>
        </div>

        <div className="space-y-3">
          {(view.cleanupReviewOpen || view.cleanupReviewError) && (
            <div className="px-4 sm:px-5">
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
            </div>
          )}

          <CategoryFlowFilter rows={categoryRows}>
            {(filteredCategoryRows, flowControl) => <ManageableNameList
            items={filteredCategoryRows.map(({ category, count }) => ({ ...category, count }))}
            duplicateItems={categoryRows.map(({ category, count }) => ({ ...category, count }))}
            itemLabel="Category"
            addPlaceholder="New Category Name"
            addFormTitle="Add a category"
            addFormDescription="Defaults to both money in and money out."
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
              const usage = item.count === 0
                ? <span className="font-medium text-amber-700 dark:text-amber-300">Unused</span>
                : item.count != null && item.count <= view.RARELY_USED_MAX_COUNT
                  ? <span className="font-medium text-amber-700 dark:text-amber-300">Rarely used · {item.count}×</span>
                  : item.count != null
                    ? <span>{item.count} uses</span>
                    : null
              return (
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0 flex-[1_1_6rem]">
                    <p className="truncate text-body font-medium text-foreground">{item.name}</p>
                    {usage && <p className="truncate text-caption text-muted-foreground">{usage}</p>}
                  </div>
                  {isSystemCategory ? (
                    <span
                      role="img"
                      aria-label={`${item.name} is managed by FinancialApp; flow is ${activeType === 'inflow' ? 'money in' : activeType === 'outflow' ? 'money out' : 'money in and out'}`}
                      title="Managed category; its flow cannot be changed."
                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption font-medium text-muted-foreground dark:bg-surface-3"
                    >
                      <Lock className="size-2.5" aria-hidden="true" />
                      <span className="capitalize">{activeType}</span>
                    </span>
                  ) : (
                    <div
                      role="group"
                      aria-label={`Flow restriction for ${item.name}`}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-0.5 rounded-full p-0.5',
                        isDraftChanged ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-surface-2 dark:bg-surface-2/70',
                      )}
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
                            className={cn(
                              'inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 lg:size-8',
                              isActive ? segment.activeClass : 'text-muted-foreground hover:text-foreground',
                            )}
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
                          className="mx-1 inline-block size-1.5 shrink-0 rounded-full bg-primary"
                        />
                      )}
                    </div>
                  )}
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
            <div className="glass-surface sticky bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-20 mx-3 flex items-center gap-2 rounded-full p-2 pl-5 shadow-(--app-shadow-overlay) animate-in fade-in duration-150 sm:bottom-4">
              <span className="min-w-0 flex-1 truncate text-label font-medium text-foreground">
                {changedFlowTypeCategories.length} category flow type{changedFlowTypeCategories.length > 1 ? 's' : ''} modified
              </span>
              <Button
                variant="tertiary"
                size="sm"
                type="button"
                onClick={() => setFlowTypeDrafts({})}
                disabled={isSavingFlowTypes || hideSensitive}
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
          )}

          {(view.categoryUsage && view.visibleCategories.length > 0) || view.usageError ? (
            <div className="border-t border-border/60 px-4 py-3 sm:px-5">
              {view.categoryUsage && view.visibleCategories.length > 0 && (
                <p className="text-caption text-muted-foreground">
                  Usage over the last {view.USAGE_LOOKBACK_CYCLES} cycles, least used first.
                </p>
              )}
              {view.usageError && (
                <p className="text-caption font-medium text-destructive">{view.usageError}</p>
              )}
            </div>
          ) : <div className="pb-1" />}
        </div>
      </section>
      </div>
    </div>
  )
}
