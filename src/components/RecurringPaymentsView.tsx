import React, { Suspense } from 'react'
import type { Loan, RecurringPayment, RecurringReminderSettings, TransactionCategory, ActiveRecurringPayment, Transaction } from '../types'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useIsMobile } from '../lib/useIsMobile'
import { useAppContext } from '../contexts/AppContext'
import { RecurringPaymentsHeader } from './recurring/RecurringPaymentsHeader'
import { RecurringTimelineCard } from './recurring/RecurringTimelineCard'
import { RecurringPaymentFormSheet } from './recurring/RecurringPaymentFormSheet'
import { RecurringFilterBar } from './recurring/RecurringFilterBar'
import { RecurringPaymentCards } from './recurring/RecurringPaymentCards'
import { useRecurringPaymentsView } from './recurring/useRecurringPaymentsView'
import { RecurringTabs, type RecurringTabId } from './recurring/RecurringTabs'
import type { LoanLoadStatus } from '../app/financialData/useLoanData'

const LoansSection = React.lazy(() => import('./recurring/loans/LoansSection').then(module => ({ default: module.LoansSection })))

interface RecurringPaymentsViewProps {
  payments: RecurringPayment[]
  activeRecurringPayments: ActiveRecurringPayment[]
  transactions?: Transaction[]
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  onAddPayment: (payment: Omit<RecurringPayment, 'id'>) => void
  onToggleActive: (id: string) => void
  onDeletePayment: (id: string) => void
  onUpdatePayment: (id: string, payment: RecurringPayment) => void
  hideSensitive?: boolean
  categories: TransactionCategory[]
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  isSwitchingCycle?: boolean
  highlightedRecurringId?: string | null
  onClearHighlightedRecurring?: () => void
  activeSyncId?: string | null
  activeSyncIds?: string[]
  deletingId?: string | null
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  globalPushEnabled?: boolean
  thisDevicePushEnabled?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
  onRequestPayEarly?: (id: string) => void
  loans?: Loan[]
  onAddLoan?: (loan: Partial<Loan>) => void
  onUpdateLoan?: (id: string, loan: Loan) => void
  onRequestDeleteLoan?: (id: string) => void
  loanLoadStatus?: LoanLoadStatus
  hasLoadedLoans?: boolean
  onLoadLoans?: () => Promise<Loan[]>
  onExplainLoan?: (loan: Loan) => void
}

export const RecurringPaymentsView: React.FC<RecurringPaymentsViewProps> = ({
  payments,
  activeRecurringPayments,
  transactions = [],
  selectedMonth,
  selectedYear,
  cycleDay,
  onAddPayment,
  onToggleActive,
  onDeletePayment,
  onUpdatePayment,
  hideSensitive: hideSensitiveProp,
  categories,
  currency: currencyProp,
  autoOpenAddForm,
  onResetAutoOpen,
  isSwitchingCycle = false,
  highlightedRecurringId = null,
  onClearHighlightedRecurring,
  activeSyncId: activeSyncIdProp,
  activeSyncIds: activeSyncIdsProp,
  deletingId: deletingIdProp,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed,
  globalPushEnabled = false,
  thisDevicePushEnabled = true,
  onUpdateReminder,
  onRequestPayEarly,
  loans = [],
  onAddLoan = () => {},
  onUpdateLoan = () => {},
  onRequestDeleteLoan = () => {},
  loanLoadStatus = 'idle',
  hasLoadedLoans = false,
  onLoadLoans = async () => [],
  onExplainLoan = () => {},
}) => {
  const app = useAppContext()
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const currency = currencyProp ?? app.currency
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const activeSyncIds = activeSyncIdsProp
    ?? (activeSyncIdProp !== undefined
      ? (activeSyncIdProp ? [activeSyncIdProp] : [])
      : (app.activeSyncIds?.length ? app.activeSyncIds : (app.activeSyncId ? [app.activeSyncId] : [])))
  const deletingId = deletingIdProp ?? app.deletingId
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = React.useState<RecurringTabId>('recurring')

  const view = useRecurringPaymentsView({
    payments,
    categories,
    hideSensitive,
    sensitivePreferenceStatus: app.sensitivePreferenceStatus,
    currency,
    activeSyncId,
    activeSyncIds,
    deletingId,
    onAddPayment,
    onUpdatePayment,
    autoOpenAddForm,
    onResetAutoOpen,
    aiDraft,
    aiEditDraft,
    onAiDraftConsumed,
    onAiEditDraftConsumed,
  })

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="recurring" />
  }

  return (
    <div className="space-y-6">

      {/* Header section with Stats */}
      <RecurringPaymentsHeader
        totalCommittedMonthly={view.totalCommittedMonthly}
        activeCount={view.activeCount}
        totalCount={payments.length}
        showAddForm={view.showAddForm}
        hideSensitive={hideSensitive}
        formatSensitive={view.formatSensitive}
        onToggleForm={view.toggleAddForm}
      />

      {/* View Switcher Tabs (Recurring Bills | Loans) */}
      <RecurringTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        recurringCount={payments.length}
        loansCount={hasLoadedLoans ? loans.length : undefined}
      />

      {activeTab === 'recurring' && (
        <>
          {/* Visual Bill Timeline */}
          <RecurringTimelineCard
            activeRecurringPayments={activeRecurringPayments}
            allPayments={payments}
            transactions={transactions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            cycleDay={cycleDay}
            currency={currency}
            hideSensitive={hideSensitive}
          />

          {/* Filter and Sort controls */}
          <RecurringFilterBar
            isMobile={isMobile}
            selectedCategories={view.selectedCategories}
            sortOrder={view.sortOrder}
            isFilterDropdownOpen={view.isFilterDropdownOpen}
            filterButtonRef={view.filterButtonRef}
            setIsFilterDropdownOpen={view.setIsFilterDropdownOpen}
            onToggleCategoryFilter={view.handleToggleCategoryFilter}
            onClearFilters={view.clearCategoryFilters}
            onSortChange={view.setSortOrder}
          />

          {/* Subscriptions Cards Grid */}
          <RecurringPaymentCards
            payments={view.filteredAndSortedPayments}
            totalCount={payments.length}
            hideSensitive={hideSensitive}
            formatSensitive={view.formatSensitive}
            isPaymentSyncing={view.isPaymentSyncing}
            isPaymentDeleting={view.isPaymentDeleting}
            onToggleActive={onToggleActive}
            onDeletePayment={onDeletePayment}
            onEditPayment={view.beginEditPayment}
            highlightedId={highlightedRecurringId}
            onClearHighlight={onClearHighlightedRecurring}
            globalPushEnabled={globalPushEnabled}
            thisDevicePushEnabled={thisDevicePushEnabled}
            onUpdateReminder={onUpdateReminder}
            onRequestPayEarly={onRequestPayEarly}
          />
        </>
      )}

      {activeTab === 'loans' && (
        <Suspense fallback={<div className="app-panel rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:bg-card/92 sm:p-5" aria-busy="true"><div className="h-5 w-24 animate-pulse rounded bg-muted" /></div>}>
          <LoansSection
            loans={loans}
            payments={payments}
            currency={currency}
            hideSensitive={hideSensitive}
            formatSensitive={view.formatSensitive}
            activeSyncIds={activeSyncIds}
            onAddLoan={onAddLoan}
            onUpdateLoan={onUpdateLoan}
            onRequestDeleteLoan={onRequestDeleteLoan}
            loadStatus={loanLoadStatus}
            onLoad={onLoadLoans}
            onExplain={onExplainLoan}
          />
        </Suspense>
      )}

      {/* Add / Edit Subscription Modal (bottom sheet on mobile) */}
      <RecurringPaymentFormSheet
        isOpen={view.showAddForm}
        editingPayment={view.editingPayment}
        errors={view.errors}
        name={view.name}
        amount={view.amount}
        category={view.category}
        ledgerCategory={view.ledgerCategory}
        frequency={view.frequency}
        startDateInput={view.startDateInput}
        endDateInput={view.endDateInput}
        paymentMode={view.paymentMode}
        categories={categories}
        currency={currency}
        mutationBlocked={hideSensitive || app.sensitivePreferenceStatus === 'pending'}
        securityPending={app.sensitivePreferenceStatus === 'pending'}
        firstInputRef={view.firstInputRef}
        onNameChange={view.handleNameChange}
        onAmountChange={view.handleAmountFieldChange}
        onCategoryChange={view.setCategory}
        onLedgerCategoryChange={view.setLedgerCategory}
        onFrequencyChange={view.setFrequency}
        onStartDateChange={view.handleStartDateChange}
        onEndDateChange={view.setEndDateInput}
        onPaymentModeChange={view.handlePaymentModeChange}
        onSubmit={view.handleSubmit}
        onCancel={view.handleCancelForm}
      />
    </div>
  )
}
