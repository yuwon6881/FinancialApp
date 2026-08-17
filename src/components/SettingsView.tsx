import { Input } from './ui/Input'
import { RangeInput } from './ui/RangeInput'
import React from 'react'
import { Save, Settings, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Lock, Unlock, Sparkles, Loader2, DatabaseZap, Moon, Sun, Eye, EyeOff, HardDrive, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react'
import type { CategoryFlowType, DashboardData, LedgerAccount, PushChannel, RecurringPayment, TransactionCategory } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { CurrencySelect } from './ui/CurrencySelect'
import { RowSyncStatus } from './ui/RowSyncBadge'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { PerimeterBeam } from './ui/PerimeterBeam'
import type { CategoryCleanupSuggestion } from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { ToggleButton } from './ui/ToggleButton'
import { NotificationsCard } from './settings/NotificationsCard'
import type { PushBusyAction } from '../app/usePushNotifications'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { useAppContext } from '../contexts/AppContext'
import { useSettingsView } from './settings/view/useSettingsView'
import { CategoryLimitsCard } from './settings/CategoryLimitsCard'
import { ManageableNameList } from './settings/ManageableNameList'
import { CategoryFlowFilter } from './settings/CategoryFlowFilter'
import { isSystemCategoryName } from '../lib/categoryFlow'
import { AccountsSkeleton } from './settings/accounts/AccountsSkeleton'
import type { SensitivePreferenceStatus } from '../app/useAppPreferences'
import { FormField } from './ui/FormField'
import { Button } from './ui/Button'
import { SensitiveMask } from './ui/SensitiveAmount'
import { SettingsTabs, type SettingsTabId } from './settings/SettingsTabs'
import type { LedgerAccountInput } from '../app/financialData/accountActions'
import type { LedgerAccountReconcileInput } from '../lib/api/accounts'

const TwoFactorSection = React.lazy(() => import('./TwoFactorSection').then(m => ({ default: m.TwoFactorSection })))
const ChangePasswordSection = React.lazy(() => import('./ChangePasswordSection').then(m => ({ default: m.ChangePasswordSection })))
const ActiveDevicesSection = React.lazy(() => import('./settings/ActiveDevicesSection').then(m => ({ default: m.ActiveDevicesSection })))
const FingerprintSection = React.lazy(() => import('./settings/FingerprintSection').then(m => ({ default: m.FingerprintSection })))
const InvestmentPlanSection = React.lazy(() => import('./settings/InvestmentPlanSection').then(m => ({ default: m.InvestmentPlanSection })))
const AccountsSection = React.lazy(() => import('./settings/accounts/AccountsSection').then(m => ({ default: m.AccountsSection })))

interface SettingsViewProps {
  dashboardData: DashboardData | null
  categoriesList: TransactionCategory[]
  darkMode?: boolean
  hideSensitive?: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
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
  onUpdateCategoryCycleLimit: (id: string, cycleLimit: number | null) => void
  onUpdateCategoryType?: (id: string, type: CategoryFlowType) => void
  onDeleteCategory: (id: string) => void | Promise<void>
  onApplyCategoryCleanupSuggestion?: (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => Promise<void> | void
  accounts?: LedgerAccount[]
  recurringPayments?: RecurringPayment[]
  highlightedAccountId?: string | null
  onClearHighlightedAccount?: () => void
  onAddAccount?: (input: LedgerAccountInput) => Promise<void> | void
  onUpdateAccount?: (id: string, input: LedgerAccountInput) => Promise<void> | void
  onRequestDeleteAccount?: (id: string) => void
  onReconcileAccounts?: (input: LedgerAccountReconcileInput) => Promise<void> | void
  notifyOnLoginEnabled?: boolean
  onToggleNotifyOnLogin?: (checked: boolean) => void
  activeSyncId?: string | null
  activeSyncIds?: string[]
  deletingId?: string | null
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
  onNavigateToLedger?: (options: any) => void
  onClearLocalFinancialData?: () => void
  pushSupported?: boolean
  pushLoading?: boolean
  /** Which push switch is mid-flight, so only that row shows a busy state. */
  pushBusyAction?: PushBusyAction
  pushGuidance?: string | null
  /** This device's own opt-in, per kind. Never an account-wide flag — see NotificationsCard. */
  billRemindersEnabled?: boolean
  categoryAlertsEnabled?: boolean
  otherDevicesBillReminders?: boolean
  otherDevicesCategoryAlerts?: boolean
  onToggleChannel?: (channel: PushChannel, checked: boolean) => void
  /** Rises per server-confirmed enrolment change; the devices roster re-reads on it. */
  pushEnrolmentRevision?: number
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
  const activeSyncIds = props.activeSyncIds
    ?? (props.activeSyncId !== undefined
      ? (props.activeSyncId ? [props.activeSyncId] : [])
      : (app.activeSyncIds?.length ? app.activeSyncIds : (app.activeSyncId ? [app.activeSyncId] : [])))
  const deletingId = props.deletingId ?? app.deletingId
  const onToast = props.onToast ?? app.showToast
  const syncIds = activeSyncIds.length > 0 ? activeSyncIds : activeSyncId ? [activeSyncId] : []
  const settingsOperation = [...(app.operations ?? [])].reverse().find(operation =>
    operation.entity === 'settings' && operation.type === 'update' && operation.targetId === 'settings')
  const darkModeOperation = [...(app.operations ?? [])].reverse().find(operation =>
    operation.entity === 'settings' && operation.type === 'update' && operation.targetId === 'darkMode')
  const hideSensitiveOperation = [...(app.operations ?? [])].reverse().find(operation =>
    operation.entity === 'settings' && operation.type === 'update' && operation.targetId === 'hideSensitive')
  const settingsSyncing = syncIds.includes('settings')
  const settingsPending = Boolean(settingsOperation && !settingsOperation.isCompleted && !settingsSyncing)
  const darkModeSyncing = syncIds.includes('darkMode')
  const darkModePending = Boolean(darkModeOperation && !darkModeOperation.isCompleted && !darkModeSyncing)
  const hideSensitiveSyncing = syncIds.includes('hideSensitive')
  const hideSensitivePending = Boolean(hideSensitiveOperation && !hideSensitiveOperation.isCompleted && !hideSensitiveSyncing)

  const view = useSettingsView({
    ...props,
    darkMode,
    hideSensitive,
    activeSyncId,
    activeSyncIds,
    deletingId,
    onToast,
  })

  const [flowTypeDrafts, setFlowTypeDrafts] = React.useState<Record<string, CategoryFlowType>>({})
  const [isSavingFlowTypes, setIsSavingFlowTypes] = React.useState(false)

  React.useEffect(() => {
    if (props.categoriesList) {
      setFlowTypeDrafts(Object.fromEntries(props.categoriesList.map((c: TransactionCategory) => [c.id, c.type || 'both'])))
    }
  }, [props.categoriesList])

  const changedFlowTypeCategories = React.useMemo(() => {
    return (props.categoriesList || []).filter((c: TransactionCategory) => {
      if (isSystemCategoryName(c.name)) return false
      const draft = flowTypeDrafts[c.id]
      const current = c.type || 'both'
      return draft != null && draft !== current
    })
  }, [props.categoriesList, flowTypeDrafts])

  // A spending alert can only fire against a category that has a planned amount, so the
  // notifications panel says so rather than offering a switch with nothing to watch.
  const hasSpendingGuides = React.useMemo(
    () => (props.categoriesList || []).some((category: TransactionCategory) =>
      typeof category.cycleLimit === 'number' && category.cycleLimit > 0),
    [props.categoriesList])

  const [activeTab, setActiveTab] = React.useState<SettingsTabId>(() => {
    if (props.highlightedAccountId) return 'accounts'
    if (typeof window !== 'undefined') {
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('investment-plan') || hash.includes('investment-plan')) return 'investment-plan'
      if (search.includes('category') || search.includes('limits') || hash.includes('category') || hash.includes('limits')) {
        return 'categories-preferences'
      }
      if (search.includes('account') || hash.includes('account')) return 'accounts'
    }
    return 'financial-model'
  })

  React.useEffect(() => {
    if (props.highlightedAccountId) {
      setActiveTab('accounts')
      return
    }
    if (typeof window !== 'undefined') {
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('investment-plan') || hash.includes('investment-plan')) {
        setActiveTab('investment-plan')
        return
      }
      if (search.includes('category') || search.includes('limits') || hash.includes('category') || hash.includes('limits')) {
        setActiveTab('categories-preferences')
        requestAnimationFrame(() => {
          const el = document.getElementById('category-limits-card')
          if (el) {
            const rect = el.getBoundingClientRect()
            if (rect.top > window.innerHeight || rect.top < 0) {
              el.scrollIntoView({ behavior: 'auto', block: 'start' })
            }
          }
        })
        return
      }
      if (search.includes('account') || hash.includes('account')) {
        setActiveTab('accounts')
      }
    }
  }, [props.highlightedAccountId])

  // Category rows for the list. When usage stats are available they are already sorted
  // least-used-first (so removal candidates surface at the top); otherwise fall back to the
  // plain category order with no per-row usage figure.
  const categoryRows: Array<{ category: TransactionCategory; count: number | null }> =
    view.categoryUsage ?? view.visibleCategories.map(category => ({ category, count: null }))
  const isCategoryListLoading = categoryRows.length === 0 && view.isLoadingUsage

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="w-full min-w-0 flex flex-col gap-2 p-4 sm:p-6 bg-card rounded-2xl border border-border/60">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-blue-500" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage your budget, app, and categories.
        </p>
      </div>

      <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'financial-model' && (
        <div id="settings-panel-financial-model" role="tabpanel" aria-labelledby="settings-tab-financial-model" className="w-full grid grid-cols-1 lg:grid-cols-3 lg:items-start lg:gap-6 space-y-6 lg:space-y-0 animate-in fade-in duration-200">
          <form noValidate onSubmit={view.handleSaveSettings} className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  Financial Model
                  <RowSyncStatus isSyncing={settingsSyncing} isPending={settingsPending} entityLabel="financial rules" />
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Controls budget targets and cycle calculations.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Target stability fund limit" required error={view.errors.target}>
                {hideSensitive ? (
                  <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3"><SensitiveMask /></div>
                ) : (
                  <Input
                    type="text"
                    inputMode="decimal"
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
                  />
                )}
              </FormField>

              <FormField label="Ledger cycle day">
                <CustomSelect
                  ariaLabel="Ledger cycle day"
                  disabled={hideSensitive}
                  value={view.cycleDayInput}
                  onChange={val => view.setCycleDayInput(String(val))}
                  options={Array.from({ length: 28 }, (_, i) => ({
                    value: (i + 1).toString(),
                    label: `${i + 1}${getDayWithSuffix(i + 1)}`
                  }))}
                  className="w-full"
                />
              </FormField>

              <FormField label="Default account currency">
                <CurrencySelect
                  ariaLabel="Default account currency"
                  disabled={hideSensitive}
                  value={view.currencyInput}
                  onChange={view.setCurrencyInput}
                  className="w-full"
                />
              </FormField>

              <FormField label="Stability fund overflow redirect">
                <CustomSelect
                  ariaLabel="Stability fund overflow redirect"
                  disabled={hideSensitive}
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
              </FormField>
            </div>

            <div className="space-y-4 border-t border-border/30 pt-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Income Allocations</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${view.allocSum === 100 ? 'bg-blue-500/10 text-blue-500' : 'bg-destructive/15 text-destructive animate-pulse'}`}>
                    {view.allocSum}%
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => view.setGlobalAllocLock(!view.globalAllocLock)}
                  disabled={hideSensitive}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer sm:min-h-8"
                >
                  {view.globalAllocLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                  {view.globalAllocLock ? 'Locked' : 'Unlocked'}
                </Button>
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
                      <span className="text-muted-foreground flex items-center gap-1.5"><span className="uppercase tracking-wider">{label}</span><Button variant="ghost" size="icon" type="button" onClick={() => view.toggleLock(key)} disabled={hideSensitive} className="size-11 text-muted-foreground hover:text-foreground hover:bg-muted sm:size-8" title={view.lockedAllocations.includes(key) ? 'Unlock' : 'Lock'}>{view.lockedAllocations.includes(key) ? <Lock className="size-3.5 text-blue-500" /> : <Unlock className="size-3.5" />}</Button></span>
                      <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md">{Number(value).toFixed(0)}%</span>
                    </div>
                    <RangeInput  min="0" max="100" step="5" disabled={hideSensitive || view.globalAllocLock || view.lockedAllocations.includes(key)} value={value} onChange={e => view.handleAllocationChange(key, parseFloat(e.target.value))} className={`w-full h-2 rounded-full cursor-pointer ${accentClass} bg-border disabled:opacity-50 disabled:cursor-not-allowed`} />
                  </label>
                ))}
              </div>
              {view.errors.allocationSum && (
                <p className="text-[10px] text-destructive font-semibold">{view.errors.allocationSum}</p>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <Button
                type="submit"
                disabled={hideSensitive || settingsSyncing || settingsPending}
                aria-busy={settingsSyncing}
                className="rounded-xl px-4 py-2 shadow-lg shadow-primary/10 hover:shadow-primary/20"
              >
                {settingsSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {settingsSyncing ? 'Saving…' : 'Save Rules'}
              </Button>
            </div>
          </form>

          {/* The two narrow panels share one column so both sit *beside* the Financial Model form.
              As three direct grid children the third one wrapped to a second row under the wide
              form on lg, leaving Notifications stranded below with a column of empty space
              alongside it. */}
          <div className="space-y-6 lg:col-span-1">
          <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">App Preferences</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Customize display and local storage.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-y-3">
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                  {darkMode ? <Moon className="size-4 text-muted-foreground shrink-0" /> : <Sun className="size-4 text-muted-foreground shrink-0" />}
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground truncate">
                    <span className="truncate">Dark Mode</span>
                    <RowSyncStatus isSyncing={darkModeSyncing} isPending={darkModePending} entityLabel="dark mode" />
                  </span>
                </div>
                <ToggleButton active={darkMode} onClick={props.onToggleDarkMode || (() => {})} disabled={darkModeSyncing || darkModePending} label="Dark mode" />
              </div>
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <div className="flex flex-1 min-w-0 pr-4 items-center gap-2">
                  {hideSensitive ? <EyeOff className="size-4 text-muted-foreground shrink-0" /> : <Eye className="size-4 text-muted-foreground shrink-0" />}
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground truncate">
                    <span className="truncate">Sensitive Mode (Masked)</span>
                    <RowSyncStatus isSyncing={hideSensitiveSyncing} isPending={hideSensitivePending} entityLabel="sensitive mode" />
                  </span>
                </div>
                <ToggleButton
                  active={hideSensitive}
                  onClick={props.onToggleHideSensitive || (() => {})}
                  label={
                    props.sensitivePreferenceStatus === 'pending'
                      ? 'Sensitive mode, checking privacy settings'
                      : props.sensitivePreferenceStatus === 'unavailable'
                        ? 'Sensitive mode, privacy setting unavailable'
                        : 'Sensitive mode'
                  }
                  disabled={hideSensitiveSyncing || hideSensitivePending || (props.sensitivePreferenceStatus !== undefined && props.sensitivePreferenceStatus !== 'resolved')}
                />
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <HardDrive className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">Local Device Cache</span>
                    <span className="text-[10px] text-muted-foreground">Clear cached data on this device.</span>
                  </div>
                </div>
                <Button variant="unstyled"
                  type="button"
                  onClick={props.onClearLocalFinancialData}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer sm:min-h-8"
                >
                  <DatabaseZap className="size-3.5 text-muted-foreground" /> Clear
                </Button>
              </div>
            </div>
          </div>

          {/* Notifications live in their own panel rather than among the display preferences:
              every switch here is about what a browser is allowed to show, which is a different
              question from how figures are displayed, and stacking them as peers read as one
              undifferentiated list. */}
          <div>
            <NotificationsCard
              notifyOnLoginEnabled={props.notifyOnLoginEnabled || false}
              onToggleNotifyOnLogin={checked => props.onToggleNotifyOnLogin?.(checked)}
              pushSupported={props.pushSupported !== false}
              pushLoading={props.pushLoading || false}
              pushBusyChannel={props.pushBusyAction ?? null}
              pushGuidance={props.pushGuidance}
              billRemindersEnabled={props.billRemindersEnabled || false}
              categoryAlertsEnabled={props.categoryAlertsEnabled || false}
              otherDevicesBillReminders={props.otherDevicesBillReminders || false}
              otherDevicesCategoryAlerts={props.otherDevicesCategoryAlerts || false}
              onToggleChannel={(channel, checked) => props.onToggleChannel?.(channel, checked)}
              enrolmentRevision={props.pushEnrolmentRevision ?? 0}
              hasSpendingGuides={hasSpendingGuides}
              onNavigateToCategoryLimits={() => setActiveTab('categories-preferences')}
            />
          </div>
          </div>
        </div>
      )}

      {activeTab === 'investment-plan' && (
        <React.Suspense fallback={<div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
          <InvestmentPlanSection />
        </React.Suspense>
      )}

      {activeTab === 'categories-preferences' && (
        <div id="settings-panel-categories-preferences" role="tabpanel" aria-labelledby="settings-tab-categories-preferences" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-in fade-in duration-200">
          {/* Transaction Categories */}
          <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs order-2 lg:order-1">
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
                <h3 className="text-sm font-bold text-foreground">Transaction Categories</h3>
                {/* One row of chips, not up to four stacked lines. Each line was independently
                    conditional, so the header grew and shrank as the usage request resolved and
                    the collapse control moved out from under the cursor reaching for it. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
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
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 font-semibold text-orange-500">
                      {view.unusedCategoryCount} unused
                    </span>
                  )}
                  {view.categoryUsage && view.rarelyUsedCategoryCount > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-500">
                      {view.rarelyUsedCategoryCount} rarely used
                    </span>
                  )}
                  {view.categoryUsage && view.unusedCategoryCount === 0 && view.rarelyUsedCategoryCount === 0 && view.visibleCategories.length > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500">
                      all used recently
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="unstyled"
                  type="button"
                  onClick={e => { e.stopPropagation(); void view.handleAiCleanupReview() }}
                  disabled={hideSensitive || view.isReviewingCleanup || view.visibleCategories.length === 0}
                  title={hideSensitive ? 'Unhide balances to review' : 'AI category review'}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer sm:min-h-8 ${
                    view.isReviewingCleanup
                      ? 'border-blue-500/35 bg-blue-500/5 text-blue-600 dark:text-blue-400'
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
                {(view.cleanupReviewOpen || view.cleanupReviewError) && (
                  <div className={`rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2 ${view.isReviewingCleanup ? 'perimeter-beam-host' : ''}`}>
                    {view.isReviewingCleanup && <PerimeterBeam size={120} />}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Sparkles className="size-3.5 text-accent-ink" />
                        AI Category Review
                      </div>
                      <Button variant="unstyled"
                        type="button"
                        onClick={() => { view.setCleanupReviewOpen(false) }}
                        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition cursor-pointer sm:size-8"
                        aria-label="Close AI category review"
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                    </div>

                    {view.isReviewingCleanup && (
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-accent-ink" />
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
                          const consolidateOptions = view.editableCategories.filter(cat =>
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
                                    <Button variant="unstyled"
                                      key={name}
                                      type="button"
                                      onClick={() => props.onNavigateToLedger?.({ category: name, showAllCycles: true })}
                                      title={`Filter ledger by ${name}`}
                                      className={`press-scale inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer hover:opacity-85 transition ${getCategoryBadgeClass(name)}`}
                                    >
                                      {name}
                                    </Button>
                                  ))}
                                </div>
                              )}

                              {suggestion.type === 'consolidate' && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground">Move its entries to:</span>
                                  <div>
                                    <CustomSelect
                                      ariaLabel="Category consolidation target"
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
                                  <Button variant="unstyled"
                                    type="button"
                                    onClick={() => props.onNavigateToLedger?.({ category: suggestion.categories[0], showAllCycles: true })}
                                    title="View entries in ledger"
                                    className="press-scale inline-flex min-h-11 min-w-0 items-center px-2.5 rounded-full border sm:h-8 sm:min-h-0 border-orange-500/20 bg-orange-500/10 text-[9px] font-bold uppercase text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition cursor-pointer select-none"
                                  >
                                    <span className="truncate">{suggestion.affectedTransactionCount} ledger {suggestion.affectedTransactionCount === 1 ? 'entry' : 'entries'} need validation</span>
                                  </Button>
                                ) : (
                                  <span className="inline-flex min-h-11 min-w-0 items-center px-2.5 rounded-full border sm:h-8 sm:min-h-0 border-border bg-muted/30 text-[9px] font-bold uppercase text-muted-foreground select-none">
                                    {suggestion.affectedTransactionCount > 0
                                      ? `${suggestion.affectedTransactionCount} ledger entr${suggestion.affectedTransactionCount === 1 ? 'y' : 'ies'} need validation`
                                      : 'No ledger entries affected'}
                                  </span>
                                )}
                                <Button variant="unstyled"
                                  type="button"
                                  onClick={() => void view.handleApplyCleanupSuggestion(suggestion)}
                                  disabled={!props.onApplyCategoryCleanupSuggestion || view.applyingCleanupId !== null || isConsolidateDisabled}
                                  title={!props.onApplyCategoryCleanupSuggestion ? 'Category cleanup is unavailable' : isConsolidateDisabled ? 'Choose a category first' : 'Accept'}
                                  className="inline-flex min-h-11 w-20 shrink-0 items-center justify-center rounded-lg border sm:h-8 sm:min-h-0 border-blue-500/30 bg-blue-500/5 px-3 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isApplyingThis ? <Loader2 className="size-3 animate-spin" /> : 'Accept'}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Same shape as the vault's selection toolbar: a one-row grid so the count can
                    truncate instead of wrapping the actions onto a second line, with the way out
                    sitting beside the way forward — an unsaved edit needs a free exit, and the only
                    one before this was toggling every badge back by hand. */}
                {changedFlowTypeCategories.length > 0 && (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 animate-in fade-in duration-150">
                    <span className="truncate text-[11px] font-bold text-accent-ink">
                      {changedFlowTypeCategories.length} category flow type{changedFlowTypeCategories.length > 1 ? 's' : ''} modified
                    </span>
                    <div className="flex shrink-0 items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setFlowTypeDrafts({})}
                        disabled={isSavingFlowTypes || hideSensitive}
                        className="bg-card"
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
                                await props.onUpdateCategoryType?.(cat.id, draft)
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
                        {isSavingFlowTypes ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        {isSavingFlowTypes ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}

                <CategoryFlowFilter rows={categoryRows} flowTypeDrafts={flowTypeDrafts}>
                  {(filteredCategoryRows, flowControl) => <ManageableNameList
                  items={filteredCategoryRows.map(({ category, count }) => ({ ...category, count }))}
                  duplicateItems={categoryRows.map(({ category, count }) => ({ ...category, count }))}
                  itemLabel="Category"
                  addPlaceholder="New Category Name"
                  addFormTitle="Add a category"
                  addFormDescription="It starts open to both money in and money out; change that from the badge beside its name."
                  filterSlot={flowControl}
                  disabled={hideSensitive}
                  isLoading={isCategoryListLoading}
                  isItemReadOnly={item => isSystemCategoryName(item.name)}
                  validateName={name => isSystemCategoryName(name) ? 'Name is a reserved word.' : null}
                  onAdd={name => props.onAddCategory({ name, type: 'both' })}
                  onDelete={item => view.handleDeleteCategory(item.id)}
                  renderName={item => {
                    const activeType = flowTypeDrafts[item.id] || item.type || 'both'
                    const isDraftChanged = flowTypeDrafts[item.id] != null && flowTypeDrafts[item.id] !== (item.type || 'both')
                    const isSystemCategory = isSystemCategoryName(item.name)
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 font-semibold ${getCategoryBadgeClass(item.name)}`}>
                          {item.name}
                        </span>
                        {isSystemCategory ? (
                          <span
                            role="img"
                            aria-label={`${item.name} is managed by FinancialApp; flow is ${activeType === 'inflow' ? 'money in' : activeType === 'outflow' ? 'money out' : 'money in and out'}`}
                            title="Managed category; its flow cannot be changed."
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
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
                          <Button variant="unstyled"
                            type="button"
                            disabled={hideSensitive}
                            onClick={() => {
                              const current = flowTypeDrafts[item.id] || item.type || 'both'
                              const next: CategoryFlowType = current === 'both' ? 'inflow' : current === 'inflow' ? 'outflow' : 'both'
                              setFlowTypeDrafts(prev => ({ ...prev, [item.id]: next }))
                            }}
                            aria-label={`Change ${item.name} flow. Currently ${activeType === 'inflow' ? 'money in' : activeType === 'outflow' ? 'money out' : 'money in and out'}.`}
                            title="Click to toggle flow restriction (Both → Inflow → Outflow)"
                            className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition hover:scale-105 active:scale-95 disabled:opacity-50 sm:min-h-8 ${
                              activeType === 'inflow'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : activeType === 'outflow'
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'border-border/60 bg-muted/40 text-muted-foreground'
                            } ${isDraftChanged ? 'ring-2 ring-blue-500/50' : ''}`}
                          >
                            {activeType === 'inflow' && <ArrowDownLeft className="size-2.5" />}
                            {activeType === 'outflow' && <ArrowUpRight className="size-2.5" />}
                            {activeType === 'both' && <ArrowLeftRight className="size-2.5" />}
                            <span className="capitalize">{activeType}</span>
                            {isDraftChanged && <span className="size-1.5 rounded-full bg-blue-500 inline-block" title="Unsaved change" />}
                          </Button>
                        )}
                      </div>
                    )
                  }}
                  renderMeta={item => item.count === 0
                    ? <span className="truncate text-[10px] font-semibold text-orange-500">Unused</span>
                    : item.count != null && item.count <= view.RARELY_USED_MAX_COUNT
                      ? <span className="truncate text-[10px] font-semibold text-amber-600 dark:text-amber-500">Rarely used · {item.count}×</span>
                      : null}
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

                {view.categoryUsage && view.visibleCategories.length > 0 && (
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    Usage over the last {view.USAGE_LOOKBACK_CYCLES} cycles, least used first.
                  </p>
                )}
                {view.usageError && (
                  <p className="text-[10px] font-medium text-destructive px-0.5">{view.usageError}</p>
                              )}


              </div>
            </CollapsibleBody>
          </div>

          <div className="order-1 lg:order-2">
            <CategoryLimitsCard
              categories={view.editableCategories}
              currency={view.activeSettings.currency || 'USD'}
              hideSensitive={hideSensitive}
              activeSyncId={activeSyncId}
              activeSyncIds={activeSyncIds}
              onUpdate={props.onUpdateCategoryCycleLimit}
            />
          </div>
        </div>
      )}

      {activeTab === 'accounts' && (
        <React.Suspense fallback={<AccountsSkeleton />}>
          <AccountsSection
            accounts={props.accounts ?? []}
            recurringPayments={props.recurringPayments}
            currency={view.activeSettings.currency || 'USD'}
            hideSensitive={hideSensitive}
            activeSyncId={activeSyncId}
            activeSyncIds={activeSyncIds}
            deletingId={deletingId}
            disabled={hideSensitive}
            highlightedAccountId={props.highlightedAccountId}
            onClearHighlightedAccount={props.onClearHighlightedAccount}
            onAddAccount={input => props.onAddAccount?.(input)}
            onUpdateAccount={(id, input) => props.onUpdateAccount?.(id, input)}
            onRequestDeleteAccount={id => props.onRequestDeleteAccount?.(id)}
            onReconcileAccounts={input => props.onReconcileAccounts?.(input)}
          />
        </React.Suspense>
      )}

      {activeTab === 'security' && (
        <React.Suspense fallback={<div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
          <div id="settings-panel-security" role="tabpanel" aria-labelledby="settings-tab-security" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-in fade-in duration-200">
            <div className="space-y-6">
              <ActiveDevicesSection />
              <ChangePasswordSection hideSensitive={hideSensitive} />
            </div>
            <div className="space-y-6">
              <TwoFactorSection hideSensitive={hideSensitive} />
              <FingerprintSection />
            </div>
          </div>
        </React.Suspense>
      )}
    </div>
  )
}
export default SettingsView
