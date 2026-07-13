import React from 'react'
import { Plus, Save, Settings, Trash2, AlertCircle, CheckCircle2, Bell, ChevronDown, ChevronUp, Lock, Unlock, Sparkles, Loader2, DatabaseZap } from 'lucide-react'
import { motion } from 'framer-motion'
import type { DashboardData, TransactionCategory } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { RowSyncBadge } from './ui/RowSyncBadge'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { PerimeterBeam } from './ui/PerimeterBeam'
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
  onDeleteCategory: (id: string) => void | Promise<void>
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

  const [activeTab, setActiveTab] = React.useState<'financial-model' | 'categories-preferences' | 'security'>('financial-model')

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

      {/* Tabs Control */}
      <div className="flex border-b border-border/30 gap-6 select-none overflow-x-auto no-scrollbar pb-1">
        {([
          ['financial-model', 'Financial Model'],
          ['categories-preferences', 'Categories & Preferences'],
          ['security', 'Security & Devices']
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`pb-3 text-xs font-bold transition relative cursor-pointer whitespace-nowrap px-1 ${
              activeTab === id
                ? 'text-blue-500 font-extrabold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {activeTab === id && (
              <motion.div
                layoutId="activeSettingsTabLine"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'financial-model' && (
        <div className="w-full animate-in fade-in duration-200">
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
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={hideSensitive}
                  value={view.targetInput}
                  onChange={e => {
                    const val = e.target.value
                    if (!/^\d*\.?\d{0,2}$/.test(val)) return
                    view.setTargetInput(val)
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
                    { value: 'Essentials 100%', label: '100% Essentials' },
                    { value: 'Growth 100%', label: '100% Growth' },
                    { value: 'Rewards 100%', label: '100% Rewards' },
                    { value: 'Split: Essentials 50%, Growth 50%', label: '50% Essentials / 50% Growth' },
                    { value: 'Split: Essentials 50%, Rewards 50%', label: '50% Essentials / 50% Rewards' },
                    { value: 'Split: Growth 50%, Rewards 50%', label: '50% Growth / 50% Rewards' }
                  ]}
                  className="w-full"
                />
              </label>
            </div>

            <div className="space-y-4 border-t border-border/30 pt-4">
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-secondary/60 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  {view.globalAllocLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                  {view.globalAllocLock ? 'Locked' : 'Unlocked'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                {([
                  ['Essentials', view.essentialsAllocInput, 'essentials', 'accent-blue-500'],
                  ['Growth', view.growthAllocInput, 'growth', 'accent-green-500'],
                  ['Stability', view.stabilityAllocInput, 'stability', 'accent-purple-500'],
                  ['Rewards', view.rewardsAllocInput, 'rewards', 'accent-amber-500'],
                ] as const).map(([label, value, key, accentClass]) => (
                  <label key={label} className="space-y-2 block">
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">{label}<button type="button" onClick={() => view.toggleLock(key)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer" title={view.lockedAllocations.includes(key) ? 'Unlock' : 'Lock'}>{view.lockedAllocations.includes(key) ? <Lock className="size-3.5 text-blue-500" /> : <Unlock className="size-3.5" />}</button></span>
                      <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md">{Number(value).toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" disabled={view.globalAllocLock || view.lockedAllocations.includes(key)} value={value} onChange={e => view.handleAllocationChange(key, parseFloat(e.target.value))} className={`w-full h-2 rounded-full cursor-pointer ${accentClass} bg-border disabled:opacity-50 disabled:cursor-not-allowed`} />
                  </label>
                ))}
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
        </div>
      )}

      {activeTab === 'categories-preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-in fade-in duration-200">
          {/* Transaction Categories */}
          <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <div className="border-b border-border/40 pb-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => view.setCategoriesOpen(!view.categoriesOpen)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view.setCategoriesOpen(!view.categoriesOpen) } }}
                aria-expanded={view.categoriesOpen}
                className="flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground">Transaction Categories</h3>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    <div>{view.visibleCategories.length} active categories.</div>
                    {view.categoryUsage && view.unusedCategoryCount > 0 && (
                      <div className="text-orange-500 font-semibold mt-0.5">
                        {view.unusedCategoryCount} unused in last {view.USAGE_LOOKBACK_CYCLES} cycles
                      </div>
                    )}
                    {view.categoryUsage && view.unusedCategoryCount === 0 && view.visibleCategories.length > 0 && (
                      <div className="text-emerald-500 font-semibold mt-0.5">
                        all used recently
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {view.categoryUsage && view.visibleCategories.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); view.setShowUsageDetails(!view.showUsageDetails) }}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground bg-background border border-border/60 hover:text-foreground hover:bg-muted transition cursor-pointer"
                      >
                        Usage
                        {view.showUsageDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>

                      {view.showUsageDetails && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="absolute right-[-80px] sm:right-0 top-full mt-2 w-72 max-w-[calc(100vw-32px)] md:w-80 z-50 bg-card border border-border/80 shadow-lg rounded-xl p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Usage over the last {view.USAGE_LOOKBACK_CYCLES} cycles, least used first. Categories with no recent activity are good candidates to remove.
                          </p>
                          {view.usageError ? (
                            <p className="text-[10px] font-medium text-destructive">{view.usageError}</p>
                          ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {view.categoryUsage.map(({ category, count }) => (
                                <div
                                  key={category.id}
                                  className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 rounded-lg text-[11px] ${
                                    count === 0 ? 'bg-orange-500/5 border-orange-500/25' : 'bg-background border-border/50'
                                  }`}
                                >
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${getCategoryBadgeClass(category.name)}`}>
                                    {category.name}
                                  </span>
                                  {count === 0 ? (
                                    <span className="text-orange-500 font-semibold text-right text-[10px]">No activity in last {view.USAGE_LOOKBACK_CYCLES} cycles</span>
                                  ) : (
                                    <span className="text-muted-foreground font-semibold text-[10px]">{count}&times; in {view.USAGE_LOOKBACK_CYCLES} cycles</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); void view.handleAiCleanupReview() }}
                    disabled={hideSensitive || view.isReviewingCleanup || view.visibleCategories.length === 0}
                    title={hideSensitive ? 'Unhide balances to review' : 'AI category review'}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      view.isReviewingCleanup
                        ? 'border-blue-500/35 bg-blue-500/5 text-blue-600 dark:text-blue-400'
                        : 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/30 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed'
                    }`}
                  >
                    {view.isReviewingCleanup ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    AI
                  </button>
                  {view.categoriesOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </div>
              </div>
            </div>

            <CollapsibleBody open={view.categoriesOpen}>
              <div className="space-y-4 px-0.5 pt-1 animate-in fade-in duration-200">
                {(view.cleanupReviewOpen || view.cleanupReviewError) && (
                  <div className={`rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2 ${view.isReviewingCleanup ? 'perimeter-beam-host' : ''}`}>
                    {view.isReviewingCleanup && <PerimeterBeam radius={12} size={120} />}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Sparkles className="size-3.5 text-blue-500" />
                        AI Category Review
                      </div>
                      <button
                        type="button"
                        onClick={() => { view.setCleanupReviewOpen(false) }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition cursor-pointer"
                        aria-label="Close AI category review"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                    </div>

                    {view.isReviewingCleanup && (
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-blue-500" />
                        Reviewing category usage...
                      </div>
                    )}

                    {view.cleanupReviewError && (
                      <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {view.cleanupReviewError}
                      </p>
                    )}

                    {!view.isReviewingCleanup && !view.cleanupReviewError && view.cleanupSuggestions.length === 0 && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        No cleanup proposals right now.
                      </p>
                    )}

                    {!view.isReviewingCleanup && view.cleanupSuggestions.length > 0 && (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {view.cleanupSuggestions.map(suggestion => {
                          const confidence = Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100)
                          const consolidateOptions = view.visibleCategories.filter(cat =>
                            !suggestion.categories.some(name => name.toLowerCase() === cat.name.toLowerCase())
                          )
                          const consolidateTarget = view.consolidateTargets[suggestion.id] || ''
                          const isApplyingThis = view.applyingCleanupId === suggestion.id
                          const isConsolidateDisabled = suggestion.type === 'consolidate' && !consolidateTarget

                          return (
                            <div key={suggestion.id} className="rounded-lg border border-border/60 bg-background p-2.5 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-foreground">{suggestion.title}</div>
                                  <div className="text-[11px] text-muted-foreground leading-relaxed">{suggestion.summary}</div>
                                </div>
                                <span className="shrink-0 rounded-md border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400">
                                  Confidence {confidence}%
                                </span>
                              </div>

                              {suggestion.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {suggestion.categories.map(name => (
                                    <button
                                      key={name}
                                      type="button"
                                      onClick={() => props.onNavigateToLedger?.({ category: name, showAllCycles: true })}
                                      title={`Filter ledger by ${name}`}
                                      className={`press-scale inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer hover:opacity-85 transition ${getCategoryBadgeClass(name)}`}
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {suggestion.type === 'consolidate' && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground">Move its entries to:</span>
                                  <div>
                                    <CustomSelect
                                      value={consolidateTarget}
                                      onChange={val => view.setConsolidateTargets(prev => ({ ...prev, [suggestion.id]: String(val) }))}
                                      options={[
                                        { value: '', label: 'Choose a category' },
                                        ...consolidateOptions.map(cat => ({ value: cat.name, label: cat.name }))
                                      ]}
                                      className="max-w-full"
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-2">
                                {suggestion.affectedTransactionCount > 0 && suggestion.categories.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => props.onNavigateToLedger?.({ category: suggestion.categories[0], showAllCycles: true })}
                                    title="View entries in ledger"
                                    className="press-scale inline-flex h-8 min-w-0 items-center px-2.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-[9px] font-bold uppercase text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition cursor-pointer select-none"
                                  >
                                    <span className="truncate">{suggestion.affectedTransactionCount} ledger {suggestion.affectedTransactionCount === 1 ? 'entry' : 'entries'} need validation</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex h-8 min-w-0 items-center px-2.5 rounded-full border border-border bg-muted/30 text-[9px] font-bold uppercase text-muted-foreground select-none">
                                    {suggestion.affectedTransactionCount > 0
                                      ? `${suggestion.affectedTransactionCount} ledger entr${suggestion.affectedTransactionCount === 1 ? 'y' : 'ies'} need validation`
                                      : 'No ledger entries affected'}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void view.handleApplyCleanupSuggestion(suggestion)}
                                  disabled={!props.onApplyCategoryCleanupSuggestion || view.applyingCleanupId !== null || isConsolidateDisabled}
                                  title={!props.onApplyCategoryCleanupSuggestion ? 'Category cleanup is unavailable' : isConsolidateDisabled ? 'Choose a category first' : 'Accept'}
                                  className="inline-flex h-8 w-20 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isApplyingThis ? <Loader2 className="size-3 animate-spin" /> : 'Accept'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New Category Name"
                    disabled={hideSensitive}
                    value={view.newCatName}
                    onChange={e => view.setNewCatName(e.target.value)}
                    className="flex-1 h-9 px-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!view.isCatValid}
                    onClick={view.handleAddCategory}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-white bg-blue-600 hover:bg-blue-500 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none hover:shadow-lg hover:shadow-blue-500/10 transition cursor-pointer shrink-0"
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

                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 select-none">
                  {view.visibleCategories.map(cat => {
                    const isSyncing = view.isCatSyncing(cat.id)
                    const isDeleting = view.isCatDeleting(cat.id)
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-2 bg-background border border-border/50 px-2.5 py-2 rounded-lg text-xs"
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${getCategoryBadgeClass(cat.name)}`}>{cat.name}</span>
                        {(isSyncing || isDeleting) && (
                          <RowSyncBadge state={isSyncing ? 'syncing' : 'deleting'} entityLabel="category" />
                        )}
                        {!isSyncing && !isDeleting && (
                          <button
                            type="button"
                            disabled={view.checkingDeleteId !== null}
                            onClick={() => view.handleDeleteCategory(cat.id)}
                            title={view.checkingDeleteId === cat.id ? 'Checking usage…' : 'Delete category'}
                            className="text-muted-foreground hover:text-destructive transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {view.checkingDeleteId === cat.id ? <Loader2 className="size-3 animate-spin text-destructive" /> : <Trash2 className="size-3" />}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CollapsibleBody>
          </div>

          {/* App Preferences */}
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
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-in fade-in duration-200">
          <div className="space-y-6">
            <ActiveDevicesSection />
            <ChangePasswordSection hideSensitive={hideSensitive} />
          </div>
          <div className="space-y-6">
            <TwoFactorSection hideSensitive={hideSensitive} />
            <FingerprintSection />
          </div>
        </div>
      )}
    </div>
  )
}
export default SettingsView
