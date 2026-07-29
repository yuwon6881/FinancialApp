import React from 'react'
import type { RecurringPayment, RecurringReminderSettings, TransactionCategory, ActiveRecurringPayment, Transaction } from '../types'
import { CycleSkeleton } from './ui/Skeleton'
import { useIsMobile } from '../lib/useIsMobile'
import { useAppContext } from '../contexts/AppContext'
import { RecurringPaymentsHeader } from './recurring/RecurringPaymentsHeader'
import { RecurringTimelineCard } from './recurring/RecurringTimelineCard'
import { RecurringPaymentFormSheet } from './recurring/RecurringPaymentFormSheet'
import { RecurringFilterBar } from './recurring/RecurringFilterBar'
import { RecurringPaymentCards } from './recurring/RecurringPaymentCards'
import { useRecurringPaymentsView } from './recurring/useRecurringPaymentsView'

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
  deletingId?: string | null
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  globalPushEnabled?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
  onRequestPayEarly?: (id: string) => void
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
  deletingId: deletingIdProp,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed,
  globalPushEnabled = false,
  onUpdateReminder,
  onRequestPayEarly,
}) => {
  const app = useAppContext()
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const currency = currencyProp ?? app.currency
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const deletingId = deletingIdProp ?? app.deletingId
  const isMobile = useIsMobile()

  const view = useRecurringPaymentsView({
    payments,
    categories,
    hideSensitive,
    currency,
    activeSyncId,
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
    <div className="space-y-6 soft-rise">

      {/* Header section with Stats */}
      <RecurringPaymentsHeader
        totalCommittedMonthly={view.totalCommittedMonthly}
        activeCount={view.activeCount}
        totalCount={payments.length}
        showAddForm={view.showAddForm}
        formatSensitive={view.formatSensitive}
        onToggleForm={view.toggleAddForm}
      />

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
        categories={categories}
        currency={currency}
        firstInputRef={view.firstInputRef}
        onNameChange={view.handleNameChange}
        onAmountChange={view.handleAmountFieldChange}
        onCategoryChange={view.setCategory}
        onLedgerCategoryChange={view.setLedgerCategory}
        onFrequencyChange={view.setFrequency}
        onStartDateChange={view.handleStartDateChange}
        onEndDateChange={view.setEndDateInput}
        onSubmit={view.handleSubmit}
        onCancel={view.handleCancelForm}
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
        onUpdateReminder={onUpdateReminder}
        onRequestPayEarly={onRequestPayEarly}
      />
    </div>
  )
}
