import React, { Suspense } from 'react'
import type { LedgerAccount, Loan, RecurringPayment, RecurringReminderSettings, TransactionCategory, ActiveRecurringPayment, Transaction } from '../types'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { LoansSectionSkeleton } from './ui/skeletons/FeatureSkeletons'
import { useIsExpanded } from '../lib/breakpoints'
import { useAppContext } from '../contexts/AppContext'
import { RecurringPaymentsHeader } from './recurring/RecurringPaymentsHeader'
import { RecurringTimelineCard } from './recurring/RecurringTimelineCard'
import { RecurringPaymentFormSheet } from './recurring/RecurringPaymentFormSheet'
import { RecurringFilterBar } from './recurring/RecurringFilterBar'
import { RecurringPaymentCards } from './recurring/RecurringPaymentCards'
import { useRecurringPaymentsView } from './recurring/useRecurringPaymentsView'
import { APP_LOCATION_CHANGED_EVENT, updateAppSearch } from '../lib/appLocation'
import { RecurringTabs, type RecurringTabId } from './recurring/RecurringTabs'
import type { LoanLoadStatus } from '../app/financialData/useLoanData'
import { formatSensitiveAmount } from './recurring/formatters'
import { occurrencePaidSoFar, occurrenceRemaining } from '../lib/recurringPayments'

const LoansSection = React.lazy(() => import('./recurring/loans/LoansSection').then(module => ({ default: module.LoansSection })))
import { PayEarlySheet } from './recurring/PayEarlySheet'

function parseInitialRecurringTab(highlightedLoanId: string | null | undefined): RecurringTabId {
  if (highlightedLoanId) return 'loans'
  if (typeof window !== 'undefined') {
    const search = window.location.search
    const hash = window.location.hash
    if (search.includes('loan') || hash.includes('loan') || search.includes('section=loans')) return 'loans'
  }
  return 'recurring'
}

interface RecurringPaymentsViewProps {
  payments: RecurringPayment[]
  accounts: LedgerAccount[]
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
  highlightedLoanId?: string | null
  onClearHighlightedLoan?: () => void
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
  onPayEarly?: (id: string, amount?: number, accountId?: string, settlesOccurrence?: boolean) => Promise<void> | void
  loans?: Loan[]
  onAddLoan?: (loan: Partial<Loan>) => void
  onUpdateLoan?: (id: string, loan: Loan) => void
  onRequestDeleteLoan?: (id: string) => void
  loanLoadStatus?: LoanLoadStatus
  hasLoadedLoans?: boolean
  onLoadLoans?: () => Promise<Loan[]>
  onExplainLoan?: (loan: Loan) => void
  onAdvanceRepayment?: (id: string, cycles: number, accountId?: string, previewFingerprint?: string) => Promise<void>
  onFullSettlement?: (id: string, quoteAmount: number, accountId?: string) => Promise<void>
  onUndoRepayment?: (actionId: string, loanId?: string) => Promise<void>
}

export const RecurringPaymentsView: React.FC<RecurringPaymentsViewProps> = ({
  payments,
  accounts,
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
  highlightedLoanId: highlightedLoanIdProp = null,
  onClearHighlightedLoan: onClearHighlightedLoanProp,
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
  onPayEarly = () => {},
  loans = [],
  onAddLoan = () => {},
  onUpdateLoan = () => {},
  onRequestDeleteLoan = () => {},
  loanLoadStatus = 'idle',
  hasLoadedLoans = false,
  onLoadLoans = async () => [],
  onExplainLoan = () => {},
  onAdvanceRepayment,
  onFullSettlement,
  onUndoRepayment,
}) => {
  const app = useAppContext()
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const currency = currencyProp ?? app.currency
  const passiveMask = hideSensitive || Boolean(app.maskPassiveFinancialFigures)
  const formatPassive = React.useCallback((value: number) => formatSensitiveAmount(value, passiveMask, currency), [currency, passiveMask])
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const activeSyncIds = activeSyncIdsProp
    ?? (activeSyncIdProp !== undefined
      ? (activeSyncIdProp ? [activeSyncIdProp] : [])
      : (app.activeSyncIds?.length ? app.activeSyncIds : (app.activeSyncId ? [app.activeSyncId] : [])))
  const deletingId = deletingIdProp ?? app.deletingId
  const isMobile = !useIsExpanded()
  const [activeTab, setActiveTab] = React.useState<RecurringTabId>(() => parseInitialRecurringTab(highlightedLoanIdProp))
  const [internalHighlightedLoanId, setInternalHighlightedLoanId] = React.useState<string | null>(null)
  const [payEarlyPayment, setPayEarlyPayment] = React.useState<RecurringPayment | null>(null)
  // Pay Early always targets an occurrence that is still in the future, and the pending-due list
  // only ever holds occurrences due today or earlier -- so the lookup below never matched and the
  // sheet fell back to the bill's full price. That is only wrong once the occurrence already has a
  // part payment against it, which is exactly what paying part of it early creates: the second
  // sheet then quoted the whole bill again and posted an optimistic row for it, and the amount
  // visibly dropped to the real remainder after the server answered.
  const payEarlyOccurrence = React.useMemo<ActiveRecurringPayment | null>(() => {
    if (!payEarlyPayment?.nextDueDate) return null
    const dueOccurrence = activeRecurringPayments.find(occurrence =>
      occurrence.recurringPaymentId === payEarlyPayment.id
      && occurrence.dueDate === payEarlyPayment.nextDueDate)
    if (dueOccurrence) return dueOccurrence

    const scheduledAmount = Math.abs(payEarlyPayment.amount)
    const paidAmount = occurrencePaidSoFar(transactions, payEarlyPayment.id, payEarlyPayment.nextDueDate)
    // Nothing recorded yet: leave it to the sheet's own fallback rather than inventing an occurrence
    // the ledger has no rows for.
    if (paidAmount <= 0) return null
    return {
      id: `${payEarlyPayment.id}-${payEarlyPayment.nextDueDate}`,
      recurringPaymentId: payEarlyPayment.id,
      name: payEarlyPayment.name,
      amount: scheduledAmount,
      scheduledAmount,
      paidAmount,
      remainingAmount: occurrenceRemaining(scheduledAmount, paidAmount),
      category: payEarlyPayment.category,
      ledgerCategory: payEarlyPayment.ledgerCategory,
      dueDate: payEarlyPayment.nextDueDate,
      isPaid: false,
      isDiscarded: false,
      status: 'PartiallyPaid',
    }
  }, [activeRecurringPayments, payEarlyPayment, transactions])
  const currentHighlightedLoanId = highlightedLoanIdProp || internalHighlightedLoanId

  const handleClearHighlightedLoan = React.useCallback(() => {
    setInternalHighlightedLoanId(null)
    onClearHighlightedLoanProp?.()
  }, [onClearHighlightedLoanProp])

  const handleTabChange = React.useCallback((nextTab: RecurringTabId) => {
    if (nextTab !== 'recurring' && highlightedRecurringId) onClearHighlightedRecurring?.()
    if (nextTab !== 'loans' && currentHighlightedLoanId) handleClearHighlightedLoan()
    setActiveTab(nextTab)
    // Recurring Bills and Loans are two destinations on the navigation rail, so switching between
    // them by tab has to move the address too -- otherwise the rail keeps pointing at the section
    // the reader just left, and a reload or a shared link reopens the wrong one.
    updateAppSearch({ section: nextTab })
  }, [currentHighlightedLoanId, handleClearHighlightedLoan, highlightedRecurringId, onClearHighlightedRecurring])

  React.useEffect(() => {
    const syncFromLocation = () => {
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('loan') || hash.includes('loan') || search.includes('section=loans')) {
        setActiveTab('loans')
      } else if (search.includes('section=recurring') || search.includes('subscription')) {
        setActiveTab('recurring')
      }
    }
    window.addEventListener(APP_LOCATION_CHANGED_EVENT, syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    return () => {
      window.removeEventListener(APP_LOCATION_CHANGED_EVENT, syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [])

  React.useEffect(() => {
    if (highlightedRecurringId) {
      setActiveTab('recurring')
    }
  }, [highlightedRecurringId])

  React.useEffect(() => {
    if (currentHighlightedLoanId) {
      setActiveTab('loans')
    }
  }, [currentHighlightedLoanId])

  const prevActiveTabRef = React.useRef(activeTab)
  React.useEffect(() => {
    if (prevActiveTabRef.current === 'loans' && activeTab !== 'loans' && currentHighlightedLoanId) {
      handleClearHighlightedLoan()
    }
    prevActiveTabRef.current = activeTab
  }, [activeTab, currentHighlightedLoanId, handleClearHighlightedLoan])

  React.useEffect(() => {
    void onLoadLoans().catch(() => undefined)
  }, [onLoadLoans])

  const [isLoanFormOpen, setIsLoanFormOpen] = React.useState(false)
  const isLoansKnown = hasLoadedLoans || loanLoadStatus === 'cached' || loanLoadStatus === 'ready'
  const loanTotalOutstanding = isLoansKnown && loans.every(loan => loan.scheduleStatus !== 'Incomplete' && !loan.isRecalculating)
    ? loans.reduce((total, loan) => total + Math.max(0, loan.snapshot.outstandingBalance), 0)
    : null
  const loanTotalAnnual = isLoansKnown && loans.every(loan => loan.scheduleStatus !== 'Incomplete' && !loan.isRecalculating)
    ? loans.reduce((total, loan) => {
        if (loan.snapshot.outstandingBalance <= 0) return total
        const isAnnual = loan.scheduleFrequency === 'Annually'
        const annualAmt = isAnnual ? loan.snapshot.scheduledPayment : loan.snapshot.scheduledPayment * 12
        return total + annualAmt
      }, 0)
    : null

  const view = useRecurringPaymentsView({
    payments,
    accounts,
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

  React.useEffect(() => {
    if (!highlightedRecurringId) return
    // A global-search destination must win over a page-local filter that would otherwise leave
    // the user on the right page with no matching card to reveal.
    view.clearCategoryFilters()
    view.setIsFilterDropdownOpen(false)
  }, [highlightedRecurringId, view.clearCategoryFilters, view.setIsFilterDropdownOpen])

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="recurring" />
  }

  return (
    <div className="space-y-6">

      {/* Header section with Stats */}
      <RecurringPaymentsHeader
        activeView={activeTab}
        totalCommittedMonthly={view.totalCommittedMonthly}
        totalCommittedAnnual={view.totalCommittedAnnual}
        totalCommittedDaily={view.totalCommittedDaily}
        activeCount={view.activeCount}
        totalCount={payments.length}
        loanTotalOutstanding={loanTotalOutstanding}
        loanTotalAnnual={loanTotalAnnual}
        loanCount={loans.length}
        payments={payments}
        loans={loans}
        showAddForm={view.showAddForm}
        hideSensitive={hideSensitive}
        formatSensitive={formatPassive}
        onToggleForm={view.toggleAddForm}
        onAddLoan={() => setIsLoanFormOpen(true)}
      />

      {/* View Switcher Tabs (Recurring Bills | Loans) */}
      <RecurringTabs
        activeTab={activeTab}
        onChange={handleTabChange}
        recurringCount={payments.length}
        loansCount={isLoansKnown ? loans.length : undefined}
      />

      {activeTab === 'recurring' && (
        <div
          id="recurring-panel-recurring"
          role="tabpanel"
          aria-labelledby="recurring-tab-recurring"
          className="space-y-6"
        >
          {/* Visual Bill Timeline */}
          <RecurringTimelineCard
            activeRecurringPayments={activeRecurringPayments}
            allPayments={payments}
            transactions={transactions}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            cycleDay={cycleDay}
            currency={currency}
            hideSensitive={passiveMask}
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
            formatSensitive={formatPassive}
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
            onRequestPayEarly={(id) => {
              const payment = payments.find(p => p.id === id)
              if (payment) setPayEarlyPayment(payment)
            }}
            onNavigateToLoan={(loanId) => {
              setActiveTab('loans')
              setInternalHighlightedLoanId(loanId)
            }}
          />
        </div>
      )}

      {/* The fallback is a real skeleton, not a lone pulsing bar: it is the first thing a user
          sees when the Loans tab opens, so it should have the shape of what is about to arrive. */}
      {activeTab === 'loans' && (
        <div
          id="recurring-panel-loans"
          role="tabpanel"
          aria-labelledby="recurring-tab-loans"
          className="space-y-6"
        >
          <Suspense fallback={<LoansSectionSkeleton />}>
            <LoansSection
              loans={loans}
              payments={payments}
              accounts={accounts}
              currency={currency}
              hideSensitive={hideSensitive}
              formatSensitive={formatPassive}
              activeSyncIds={activeSyncIds}
              onAddLoan={onAddLoan}
              onUpdateLoan={onUpdateLoan}
              onRequestDeleteLoan={onRequestDeleteLoan}
              loadStatus={loanLoadStatus}
              onLoad={onLoadLoans}
              onExplain={onExplainLoan}
              onAdvanceRepayment={onAdvanceRepayment}
              onFullSettlement={onFullSettlement}
              onUndoRepayment={onUndoRepayment}
              highlightedLoanId={currentHighlightedLoanId}
              onClearHighlightedLoan={handleClearHighlightedLoan}
              isAddFormOpen={isLoanFormOpen}
              onOpenAddForm={() => setIsLoanFormOpen(true)}
              onCloseAddForm={() => setIsLoanFormOpen(false)}
            />
          </Suspense>
        </div>
      )}

      {/* Slide-over Form for Adding / Editing a Subscription */}
      <RecurringPaymentFormSheet
        isOpen={view.showAddForm}
        editingPayment={view.editingPayment}
        errors={view.errors}
        name={view.name}
        amount={view.amount}
        category={view.category}
        ledgerCategory={view.ledgerCategory}
        accountId={view.accountId}
        accounts={accounts}
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
        onAccountIdChange={view.setAccountId}
        onFrequencyChange={view.setFrequency}
        onStartDateChange={view.handleStartDateChange}
        onEndDateChange={view.setEndDateInput}
        onPaymentModeChange={view.handlePaymentModeChange}
        onSubmit={view.handleSubmit}
        onCancel={view.handleCancelForm}
      />

      <Suspense fallback={null}>
        {payEarlyPayment && (
          <PayEarlySheet
            isOpen={true}
            onClose={() => setPayEarlyPayment(null)}
            payment={payEarlyPayment}
            occurrence={payEarlyOccurrence}
            accounts={accounts}
            currency={currency}
            onPayEarly={onPayEarly}
          />
        )}
      </Suspense>
    </div>
  )
}
