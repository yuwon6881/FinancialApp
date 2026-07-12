import React from 'react'
import { Plus, Save, Settings, Trash2, AlertCircle, CheckCircle2, Bell, ChevronDown, ChevronUp, Lock, Unlock, Sparkles, Loader2, DatabaseZap } from 'lucide-react'
import type { DashboardData, TransactionCategory } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { RowSyncBadge } from './ui/RowSyncBadge'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import type { CategoryCleanupSuggestion } from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { ToggleButton } from './ui/ToggleButton'
import { TwoFactorSection } from './TwoFactorSection'
import { ChangePasswordSection } from './ChangePasswordSection'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { useAppContext } from '../contexts/AppContext'
import { ActiveDevicesSection } from './settings/ActiveDevicesSection'
import { FingerprintSection } from './settings/FingerprintSection'

import { useSettingsView } from './settings/view/useSettingsView'

interface SettingsViewProps {
  dashboardData: DashboardData | null
  categoriesList: TransactionCategory[]
  darkMode?: boolean
  hideSensitive?: boolean
  onToggleDarkMode?: () => void
  onToggleHideSensitive?: () => void
  onUpdateSettings: (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    currency?: string
    stabilityOverflowRedirect?: string
  }) => void
  onAddCategory: (category: Omit<TransactionCategory, 'id'>) => void
  onDeleteCategory: (id: string) => void
  onApplyCategoryCleanupSuggestion?: (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => Promise<void> | void
  notifyOnLoginEnabled?: boolean
  onToggleNotifyOnLogin?: (checked: boolean) => void
  activeSyncId?: string | null
  deletingId?: string | null
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
  onNavigateToLedger?: (options: any) => void
  onClearLocalFinancialData?: () => void
}

const getDayWithSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th'
  if (day % 10 === 1) return 'st'
  if (day % 10 === 2) return 'nd'
  if (day % 10 === 3) return 'rd'
  return 'th'
}

export const SettingsView: React.FC<SettingsViewProps> = (props) => {
  const app = useAppContext()
  const darkMode = props.darkMode ?? app.darkMode
  const hideSensitive = props.hideSensitive ?? app.hideSensitive
  const activeSyncId = props.activeSyncId ?? app.activeSyncId
  const deletingId = props.deletingId ?? app.deletingId
  const onToast = props.onToast ?? app.showToast

  const view = useSettingsView({
    ...props,
    darkMode,
    hideSensitive,
    activeSyncId,
    deletingId,
    onToast,
  })

  return (
    <div className="space-y-6 soft-rise">
      <div className="flex flex-col gap-2 p-4 sm:p-6 bg-card rounded-2xl border border-border/60">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-blue-500" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage financial model rules, app preferences, and transaction categories.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] gap-6">
        <form noValidate onSubmit={view.handleSaveSettings} className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Financial Model</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Controls budget targets and cycle calculations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground block">Target Stability Fund Limit</span>
              <SmartAmountInput
                type="text"
                disabled={hideSensitive}
                value={view.targetInput}
                onChange={e => {
                  view.setTargetInput(e.target.value)
                  if (view.errors.target) {
                    view.setErrors(prev => {
                      const next = { ...prev }
                      delete next.target
                      return next
                    })
                  }
                }}
                className={`w-full px-3 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  hideSensitive 
                    ? 'border-transparent text-transparent blur-sm select-none pointer-events-none' 
                    : view.errors.target 
                      ? 'border-destructive focus:ring-destructive' 
                      : 'border-border focus:ring-blue-500'
                }`}
              />
              {view.errors.target && (
                <p className="text-[10px] text-destructive font-medium mt-1">{view.errors.target}</p>
              )}
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground block">Ledger Cycle Day</span>
              <CustomSelect
                value={view.cycleDayInput}
                onChange={val => view.setCycleDayInput(String(val))}
                options={Array.from({ length: 28 }, (_, i) => ({
                  value: (i + 1).toString(),
                  label: `${i + 1}${getDayWithSuffix(i + 1)} of month`
                }))}
                className="w-full"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground block">Default Account Currency</span>
              <CustomSelect
                value={view.currencyInput}
                onChange={val => view.setCurrencyInput(String(val))}
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'GBP', label: 'GBP (£)' }
                ]}
                className="w-full"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground block">Stability Fund Overflow Redirect</span>
              <CustomSelect
                value={view.stabilityOverflowRedirectInput}
                onChange={val => view.setStabilityOverflowRedirectInput(String(val))}
                options={[
                  { value: 'Split: Growth 50%, Rewards 50%', label: 'Split between Growth and Rewards' },
                  { value: 'Redirect: Growth', label: 'All to Growth' },
                  { value: 'Redirect: Rewards', label: 'All to Rewards' }
                ]}
                className="w-full"
              />
            </label>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Income Allocations</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${view.allocSum === 100 ? 'bg-blue-500/10 text-blue-500' : 'bg-destructive/15 text-destructive animate-pulse'}`}>
                  {view.allocSum}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => view.setGlobalAllocLock(!view.globalAllocLock)}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                {view.globalAllocLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                {view.globalAllocLock ? 'Locked' : 'Unlocked'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(['essentials', 'growth', 'stability', 'rewards'] as const).map(key => {
                const isLocked = view.lockedAllocations.includes(key)
                const isMaxLocks = view.lockedAllocations.length >= 2 && !isLocked
                const val = key === 'essentials' ? view.essentialsAllocInput : key === 'growth' ? view.growthAllocInput : key === 'stability' ? view.stabilityAllocInput : view.rewardsAllocInput
                const setter = key === 'essentials' ? view.setEssentialsAllocInput : key === 'growth' ? view.setGrowthAllocInput : key === 'stability' ? view.setStabilityAllocInput : view.setRewardsAllocInput
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-muted-foreground">
                      <span className="capitalize">{key}</span>
                      {!view.globalAllocLock && (
                        <button
                          type="button"
                          disabled={isMaxLocks}
                          onClick={() => view.toggleLock(key)}
                          className="hover:text-foreground transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {isLocked ? <Lock className="size-3 text-blue-500" /> : <Unlock className="size-3" />}
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        disabled={view.globalAllocLock}
                        value={val}
                        onChange={e => {
                          const num = parseFloat(e.target.value) || 0
                          if (num >= 0 && num <= 100) {
                            setter(e.target.value)
                            if (!view.globalAllocLock) {
                              view.handleAllocationChange(key, num)
                            }
                          }
                        }}
                        className="w-full pr-7 px-3 py-1.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                      />
                      <span className="absolute right-3 text-xs font-semibold text-muted-foreground select-none pointer-events-none">%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {view.errors.allocationSum && (
              <p className="text-[10px] text-destructive font-semibold">{view.errors.allocationSum}</p>
            )}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition cursor-pointer"
            >
              <Save className="size-3.5" /> Save Rules
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">App Preferences</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Customize display options.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <span className="font-medium text-foreground">Dark Mode</span>
                <ToggleButton active={darkMode} onClick={props.onToggleDarkMode || (() => {})} />
              </div>
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <span className="font-medium text-foreground">Sensitive Mode (Blur)</span>
                <ToggleButton active={hideSensitive} onClick={props.onToggleHideSensitive || (() => {})} />
              </div>
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Notify bills on Login</span>
                </div>
                <ToggleButton active={props.notifyOnLoginEnabled || false} onClick={() => props.onToggleNotifyOnLogin?.(!props.notifyOnLoginEnabled)} />
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Local Device Cache</span>
                  <span className="text-[10px] text-muted-foreground">Clear cached data on this device.</span>
                </div>
                <button
                  type="button"
                  onClick={props.onClearLocalFinancialData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <DatabaseZap className="size-3.5 text-muted-foreground" /> Clear
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <button
                type="button"
                onClick={() => view.setCategoriesOpen(!view.categoriesOpen)}
                className="w-full text-left flex items-center justify-between gap-2 text-sm font-bold text-foreground cursor-pointer"
              >
                <span>Transaction Categories ({view.visibleCategories.length})</span>
                {view.categoriesOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>
            </div>

            <CollapsibleBody open={view.categoriesOpen}>
              <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New Category Name"
                    disabled={hideSensitive}
                    value={view.newCatName}
                    onChange={e => view.setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!view.isCatValid}
                    onClick={view.handleAddCategory}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none hover:shadow-lg hover:shadow-blue-500/10 transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {view.isCatDuplicate && (
                  <p className="text-[10px] text-destructive font-semibold mt-0.5">Category name already exists.</p>
                )}
                {view.isCatReserved && (
                  <p className="text-[10px] text-destructive font-semibold mt-0.5">Name is a reserved word.</p>
                )}

                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {view.visibleCategories.map(cat => {
                    const isSyncing = view.isCatSyncing(cat.id)
                    const isDeleting = view.isCatDeleting(cat.id)
                    return (
                      <span
                        key={cat.id}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${getCategoryBadgeClass(
                          cat.name
                        )}`}
                      >
                        <span>{cat.name}</span>
                        {(isSyncing || isDeleting) && (
                          <RowSyncBadge state={isSyncing ? 'syncing' : 'deleting'} entityLabel="category" />
                        )}
                        {!isSyncing && !isDeleting && (
                          <button
                            type="button"
                            onClick={() => view.handleDeleteCategory(cat.id)}
                            className="text-muted-foreground hover:text-destructive transition cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </span>
                    )
                  })}
                </div>

                <div className="border-t border-border/40 pt-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground">AI Category Cleanup</span>
                      <span className="text-[10px] text-muted-foreground">Consolidate unused or duplicate categories.</span>
                    </div>
                    <button
                      type="button"
                      onClick={view.handleAiCleanupReview}
                      disabled={view.isReviewingCleanup || hideSensitive}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {view.isReviewingCleanup ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                      AI Review
                    </button>
                  </div>

                  <CollapsibleBody open={view.cleanupReviewOpen}>
                    <div className="space-y-2 pt-1 border-t border-border/20">
                      {view.isReviewingCleanup ? (
                        <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground font-semibold">
                          <Loader2 className="size-3.5 animate-spin text-blue-500" /> Checking categories...
                        </div>
                      ) : view.cleanupReviewError ? (
                        <div className="text-[11px] text-destructive font-semibold flex items-center gap-1.5">
                          <AlertCircle className="size-3.5 shrink-0" /> {view.cleanupReviewError}
                        </div>
                      ) : view.cleanupSuggestions.length > 0 ? (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                          {view.cleanupSuggestions.map(s => {
                            const isApplying = view.applyingCleanupId === s.id
                            const consolidateTarget = view.consolidateTargets[s.id] || ''
                            return (
                              <div key={s.id} className="p-3 rounded-xl border border-blue-500/15 bg-blue-500/5 space-y-2 relative overflow-hidden">
                                {isApplying && (
                                  <div className="absolute inset-0 bg-background/50 backdrop-blur-xs z-10 flex items-center justify-center">
                                    <Loader2 className="size-4 animate-spin text-blue-500" />
                                  </div>
                                )}
                                <div className="flex items-start gap-1.5 text-xs font-semibold text-foreground leading-relaxed">
                                  <Sparkles className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
                                  <span>{s.description}</span>
                                </div>
                                {s.type === 'consolidate' && (
                                  <div className="space-y-1 pt-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">Select Consolidate Target</label>
                                    <CustomSelect
                                      value={consolidateTarget}
                                      onChange={val => view.setConsolidateTargets(prev => ({ ...prev, [s.id]: String(val) }))}
                                      options={[
                                        { value: '', label: 'Select Target Category...' },
                                        ...props.categoriesList.filter(c => !c.isPendingDelete && !s.categories.includes(c.name) && c.name.toLowerCase() !== 'transfer' && c.name.toLowerCase() !== 'adjustment').map(c => ({
                                          value: c.name,
                                          label: c.name
                                        }))
                                      ]}
                                      className="w-full text-xs"
                                    />
                                  </div>
                                )}
                                <div className="flex justify-end pt-1">
                                  <button
                                    type="button"
                                    onClick={() => view.handleApplyCleanupSuggestion(s)}
                                    disabled={s.type === 'consolidate' && !consolidateTarget}
                                    className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold text-white disabled:bg-muted disabled:text-muted-foreground transition cursor-pointer"
                                  >
                                    Apply Cleanup
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                          Category naming and usage is clean.
                        </div>
                      )}
                    </div>
                  </CollapsibleBody>

                  <div className="pt-2 flex items-center justify-between border-t border-border/20">
                    <button
                      type="button"
                      onClick={() => view.setShowUsageDetails(!view.showUsageDetails)}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {view.showUsageDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      {view.showUsageDetails ? 'Hide' : 'Show'} Category Usage details
                    </button>
                    {view.unusedCategoryCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 font-bold">
                        {view.unusedCategoryCount} unused
                      </span>
                    )}
                  </div>

                  <CollapsibleBody open={view.showUsageDetails}>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1.5 border-t border-border/20">
                      {view.usageError ? (
                        <div className="text-[10px] font-medium text-destructive">{view.usageError}</div>
                      ) : view.categoryUsage ? (
                        view.categoryUsage.map(cu => (
                          <div key={cu.category.id} className="flex items-center justify-between py-1 border-b border-border/10 last:border-0 text-xs">
                            <span className="font-medium text-foreground">{cu.category.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${cu.count === 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'bg-slate-500/10 text-muted-foreground'}`}>
                              {cu.count} transaction{cu.count === 1 ? '' : 's'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-muted-foreground animate-pulse">Calculating usage statistics...</div>
                      )}
                    </div>
                  </CollapsibleBody>
                </div>
              </div>
            </CollapsibleBody>
          </div>

          <ChangePasswordSection hideSensitive={hideSensitive} />

          <TwoFactorSection hideSensitive={hideSensitive} />

          <FingerprintSection />

          <ActiveDevicesSection />
        </div>
      </div>
    </div>
  )
}
export default SettingsView
