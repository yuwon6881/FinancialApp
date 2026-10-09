import React from 'react'
import { PageHeader } from './ui/PageHeader'
import type {
  CategoryFlowType,
  DashboardData,
  LedgerAccount,
  PushChannel,
  RecurringPayment,
  Transaction,
  TransactionCategory,
  InvestmentAllocationOverview,
} from '../types'
import type { CategoryCleanupSuggestion } from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import type { PushBusyAction } from '../app/usePushNotifications'
import { useAppContext } from '../contexts/AppContext'
import { useSettingsView } from './settings/view/useSettingsView'
import type { RequestDeleteCategoryOptions } from '../app/financialData/categoryActions'
import { isSpendingGuideCategory, isSystemCategoryName } from '../lib/categoryFlow'
import { AccountsSkeleton } from './settings/accounts/AccountsSkeleton'
import type { SensitivePreferenceStatus } from '../app/useAppPreferences'
import { APP_LOCATION_CHANGED_EVENT, navigateToAppTab, updateAppSearch } from '../lib/appLocation'
import { SettingsTabs } from './settings/SettingsTabs'
import { SETTINGS_TABS_BY_SCOPE, type SettingsScope, type SettingsTabId } from './settings/settingsScopes'
import type { LedgerAccountInput } from '../app/financialData/accountActions'
import type { LedgerAccountReconcileInput } from '../lib/api/accounts'
import { FinancialModelTab } from './settings/FinancialModelTab'
import { CategoriesPreferencesTab } from './settings/CategoriesPreferencesTab'
import { TwoFactorSection } from './TwoFactorSection'
import { ChangePasswordSection } from './ChangePasswordSection'
import { ActiveDevicesSection } from './settings/ActiveDevicesSection'
import { FingerprintSection } from './settings/FingerprintSection'
import { InvestmentPlanSection } from './settings/InvestmentPlanSection'

const AccountsSection = React.lazy(() => import('./settings/accounts/AccountsSection').then(m => ({ default: m.AccountsSection })))

/** The `section` value each tab is addressed by, matching what the navigation rail links to. */
const SECTION_BY_SETTINGS_TAB: Record<SettingsTabId, string> = {
  'financial-model': 'model',
  'investment-plan': 'investment-plan',
  'categories-preferences': 'categories',
  accounts: 'accounts',
  security: 'security',
}

interface SettingsViewProps {
  /** Which surface this is: Settings, Plan › Budget or Wealth › Accounts. */
  scope?: SettingsScope
  investmentAllocation?: InvestmentAllocationOverview | null
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
  onDeleteCategory: (id: string, options: RequestDeleteCategoryOptions) => void | Promise<void>
  onApplyCategoryCleanupSuggestion?: (suggestion: CategoryCleanupSuggestion, targetCategoryOverride?: string) => Promise<void> | void
  accounts?: LedgerAccount[]
  recurringPayments?: RecurringPayment[]
  highlightedAccountId?: string | null
  onClearHighlightedAccount?: () => void
  onAddAccount?: (input: LedgerAccountInput) => Promise<void> | void
  onUpdateAccount?: (id: string, input: LedgerAccountInput) => Promise<void> | void
  onRequestDeleteAccount?: (id: string) => void
  onReconcileAccounts?: (input: LedgerAccountReconcileInput) => Promise<void> | void
  onSettleCard?: (transactions: Array<Omit<Transaction, 'id'>>) => void
  isCurrentCycle?: boolean
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

  const hasSpendingGuides = React.useMemo(
    () => (props.categoriesList || []).some((category: TransactionCategory) =>
      typeof category.cycleLimit === 'number' && category.cycleLimit > 0
      && !isSystemCategoryName(category.name)
      && isSpendingGuideCategory(category)),
    [props.categoriesList])

  const scope = props.scope ?? 'settings'
  const allowedTabs = React.useMemo(() => SETTINGS_TABS_BY_SCOPE[scope].map(([id]) => id), [scope])
  const fitScope = React.useCallback(
    (tab: SettingsTabId): SettingsTabId => (allowedTabs.includes(tab) ? tab : allowedTabs[0]),
    [allowedTabs],
  )

  const [activeTab, setActiveTab] = React.useState<SettingsTabId>(() => {
    if (props.highlightedAccountId) return fitScope('accounts')
    if (typeof window !== 'undefined') {
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('investment-plan') || hash.includes('investment-plan') || search.includes('section=investment-plan')) return fitScope('investment-plan')
      if (search.includes('category') || search.includes('limits') || hash.includes('category') || hash.includes('limits') || search.includes('section=categories')) {
        return fitScope('categories-preferences')
      }
      if (search.includes('account') || hash.includes('account') || search.includes('section=accounts')) return fitScope('accounts')
      if (search.includes('security') || hash.includes('security') || search.includes('section=security')) return fitScope('security')
    }
    return fitScope('financial-model')
  })

  // A tab pressed on this page writes the address itself, so the limits card must not be scrolled
  // to as if the reader had arrived from a link. Set synchronously before the address changes,
  // which dispatches the location event in the same call.
  const cameFromTabPress = React.useRef(false)

  const handleTabChange = React.useCallback((nextTab: SettingsTabId) => {
    if (nextTab !== 'accounts' && props.highlightedAccountId) props.onClearHighlightedAccount?.()
    setActiveTab(nextTab)
    cameFromTabPress.current = true
    // Every section is linkable, so the address follows the tab rather than lagging a section
    // behind it.
    updateAppSearch({ section: scope === 'budget' && nextTab === 'financial-model' ? 'rules' : SECTION_BY_SETTINGS_TAB[nextTab] })
    cameFromTabPress.current = false
  }, [props, scope])

  React.useEffect(() => {
    const syncFromLocation = () => {
      if (props.highlightedAccountId) {
        setActiveTab(fitScope('accounts'))
        return
      }
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('investment-plan') || hash.includes('investment-plan') || search.includes('section=investment-plan')) {
        setActiveTab(fitScope('investment-plan'))
      } else if (search.includes('category') || search.includes('limits') || hash.includes('category') || hash.includes('limits') || search.includes('section=categories')) {
        setActiveTab(fitScope('categories-preferences'))
        if (cameFromTabPress.current) return
        requestAnimationFrame(() => {
          const el = document.getElementById('category-limits-card')
          if (el) {
            const rect = el.getBoundingClientRect()
            if (rect.top > window.innerHeight || rect.top < 0) {
              el.scrollIntoView({ behavior: 'auto', block: 'start' })
            }
          }
        })
      } else if (search.includes('account') || hash.includes('account') || search.includes('section=accounts')) {
        setActiveTab(fitScope('accounts'))
      } else if (search.includes('security') || hash.includes('security') || search.includes('section=security')) {
        setActiveTab(fitScope('security'))
      } else if (search.includes('section=model') || search.includes('section=rules') || search.includes('financial-model')) {
        setActiveTab(fitScope('financial-model'))
      }
    }
    window.addEventListener(APP_LOCATION_CHANGED_EVENT, syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    return () => {
      window.removeEventListener(APP_LOCATION_CHANGED_EVENT, syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [props.highlightedAccountId, fitScope])

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title={scope === 'budget' ? 'Budget' : scope === 'accounts' ? 'Accounts' : 'Settings'}
        description={scope === 'budget'
          ? 'How each pay is split, and how much each category may spend in a cycle.'
          : scope === 'accounts'
            ? 'Where your money is held, bucket by bucket.'
            : undefined}
      />

      <SettingsTabs scope={scope} activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === 'financial-model' && (
        <FinancialModelTab
          view={view}
          hideSensitive={hideSensitive}
          settingsSyncing={settingsSyncing}
          settingsPending={settingsPending}
          darkMode={darkMode}
          darkModeSyncing={darkModeSyncing}
          darkModePending={darkModePending}
          hideSensitiveSyncing={hideSensitiveSyncing}
          hideSensitivePending={hideSensitivePending}
          sensitivePreferenceStatus={props.sensitivePreferenceStatus}
          onToggleDarkMode={props.onToggleDarkMode}
          onToggleHideSensitive={props.onToggleHideSensitive}
          onClearLocalFinancialData={props.onClearLocalFinancialData}
          pushSupported={props.pushSupported}
          pushLoading={props.pushLoading}
          pushBusyAction={props.pushBusyAction}
          pushGuidance={props.pushGuidance}
          billRemindersEnabled={props.billRemindersEnabled}
          categoryAlertsEnabled={props.categoryAlertsEnabled}
          otherDevicesBillReminders={props.otherDevicesBillReminders}
          otherDevicesCategoryAlerts={props.otherDevicesCategoryAlerts}
          onToggleChannel={props.onToggleChannel}
          pushEnrolmentRevision={props.pushEnrolmentRevision}
          hasSpendingGuides={hasSpendingGuides}
          onNavigateToCategoryLimits={() => navigateToAppTab('budget', { search: { section: 'categories' } })}
          part={scope === 'budget' ? 'plan' : 'preferences'}
        />
      )}

      {activeTab === 'investment-plan' && (
        <InvestmentPlanSection initialOverview={props.investmentAllocation} />
      )}

      {activeTab === 'categories-preferences' && (
        <CategoriesPreferencesTab
          view={view}
          categoriesList={props.categoriesList}
          hideSensitive={hideSensitive}
          activeSyncId={activeSyncId}
          activeSyncIds={activeSyncIds}
          dashboardData={props.dashboardData}
          onAddCategory={props.onAddCategory}
          onUpdateCategoryCycleLimit={props.onUpdateCategoryCycleLimit}
          onUpdateCategoryType={props.onUpdateCategoryType}
          onApplyCategoryCleanupSuggestion={props.onApplyCategoryCleanupSuggestion}
          onNavigateToLedger={props.onNavigateToLedger}
        />
      )}

      {activeTab === 'accounts' && (
        <React.Suspense fallback={<AccountsSkeleton isCurrentCycle={props.isCurrentCycle !== false} />}>
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
            categories={props.categoriesList || []}
            onSettleCard={props.onSettleCard}
            isCurrentCycle={props.isCurrentCycle !== false}
          />
        </React.Suspense>
      )}

      {/* Four cards in one grid, not two stacked columns. As columns, each side grew to its own
          content height and the pairs stopped lining up -- a one-line card sat beside a three-line
          one with a ragged gap between them. In one grid each row shares a height. */}
      {activeTab === 'security' && (
        <div id="settings-panel-security" role="tabpanel" aria-labelledby="settings-tab-security" className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-in fade-in duration-200">
          <ActiveDevicesSection />
          <TwoFactorSection hideSensitive={hideSensitive} />
          <ChangePasswordSection hideSensitive={hideSensitive} />
          <FingerprintSection />
        </div>
      )}
    </div>
  )
}

export default SettingsView
