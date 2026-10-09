import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { DashboardData, PendingNotification } from '../types'
import { MONTH_NAMES } from '../lib/cycle'
import type { useAppDialogs } from './useAppDialogs'
import type { useAppPreferences } from './useAppPreferences'
import type { useAppSession } from './useAppSession'
import type { useCycleNavigation } from './useCycleNavigation'
import type { useCycleSummary } from './useCycleSummary'
import { canOpenBlankMutationForm } from '../lib/quickAddAvailability'
import { GlobalSearchLoading } from '../components/search/GlobalSearchLoading'
import { loadGlobalSearch, preloadGlobalSearch } from '../components/search/globalSearchPreload'
import type { useFabMenu } from './useFabMenu'
import type { useFinancialData } from './useFinancialData'
import { openLedgerTransaction } from '../lib/openLedgerTransaction'
import { openSearchResult } from '../lib/search/openSearchResult'
import { CustomConfirmModal } from '../components/ui/CustomConfirmModal'
import { updateAppSearch } from '../lib/appLocation'
import type { QuickAddAction } from '../components/nav/QuickAddSheet'

const PendingSubscriptionsModal = lazy(() => import('../components/PendingSubscriptionsModal').then(module => ({ default: module.PendingSubscriptionsModal })))
const FailedSyncModal = lazy(() => import('../components/FailedSyncModal').then(module => ({ default: module.FailedSyncModal })))
const AccountPlacementReviewSheet = lazy(() => import('../components/AccountPlacementReviewSheet').then(module => ({ default: module.AccountPlacementReviewSheet })))
const PasswordPromptModal = lazy(() => import('../components/PasswordPromptModal').then(module => ({ default: module.PasswordPromptModal })))
const LockScreen = lazy(() => import('../components/LockScreen').then(module => ({ default: module.LockScreen })))
const CycleSummaryModal = lazy(() => import('../components/CycleSummaryModal').then(module => ({ default: module.CycleSummaryModal })))
const CustomAlertModal = lazy(() => import('../components/ui/CustomAlertModal').then(module => ({ default: module.CustomAlertModal })))
const GlobalSearch = lazy(() => loadGlobalSearch().then(module => ({ default: module.GlobalSearch })))
const QuickAddSheet = lazy(() => import('../components/nav/QuickAddSheet').then(module => ({ default: module.QuickAddSheet })))

interface AppOverlaysProps {
  dialogs: ReturnType<typeof useAppDialogs>
  financial: ReturnType<typeof useFinancialData>
  session: ReturnType<typeof useAppSession>
  prefs: ReturnType<typeof useAppPreferences>
  nav: ReturnType<typeof useCycleNavigation>
  cycleSummary: ReturnType<typeof useCycleSummary>
  fabMenu: ReturnType<typeof useFabMenu>
  fabTriggerRef: RefObject<HTMLButtonElement | null>
  todayDashboardData: DashboardData | null
  currentPendingNotifications: PendingNotification[]
  setIsAiOpen: Dispatch<SetStateAction<boolean>>
  /** Opens Investments with the activity form, for the quick-add sheet. */
  onQuickAddInvestment: () => void
  apiClient: Pick<typeof import('../lib/api'), 'fetchTransactionById'>
}

export function AppOverlays({
  dialogs,
  financial,
  session,
  prefs,
  nav,
  cycleSummary,
  fabMenu,
  fabTriggerRef,
  todayDashboardData,
  currentPendingNotifications,
  setIsAiOpen,
  onQuickAddInvestment,
  apiClient,
}: AppOverlaysProps) {

  const openSearchTransaction = async (transactionId: string, transactionDate?: string) => {
    const opened = await openLedgerTransaction({
      transactionId,
      transactionDate,
      transactions: financial.allTransactions,
      cycleDay: financial.optimisticDashboardData?.setting?.cycleDay || 28,
      fetchTransactionById: apiClient.fetchTransactionById,
      navigate: nav.handleNavigateToLedger,
    })
    if (!opened) {
      dialogs.showToast(
        'The linked purchase transaction could not be opened. It may have been deleted or may not be available offline.',
        'Transaction unavailable',
        'warning',
      )
    }
  }
  const searchLoanLoadAttemptedRef = useRef(false)
  const [isAccountReviewOpen, setIsAccountReviewOpen] = useState(false)

  // Warm the search module once the app is otherwise idle. AppOverlays itself only mounts after
  // launch, so this costs the cold start nothing and leaves the first Ctrl+K / trigger press with
  // nothing left to fetch.
  useEffect(() => {
    const idle = window.requestIdleCallback?.(() => preloadGlobalSearch())
    if (idle === undefined) {
      const timer = window.setTimeout(preloadGlobalSearch, 2_000)
      return () => window.clearTimeout(timer)
    }
    return () => window.cancelIdleCallback?.(idle)
  }, [])

  useEffect(() => {
    if (!dialogs.showSearch) {
      searchLoanLoadAttemptedRef.current = false
      return
    }
    if (searchLoanLoadAttemptedRef.current || financial.hasLoadedLoans || financial.loanLoadStatus === 'loading') return
    // Loans are still lazy for normal startup, but search must be complete even when the Loans tab
    // has not been opened first. Reuse the existing loader and let its request dedupe with the
    // Loans section if the user opens that tab while search is visible.
    searchLoanLoadAttemptedRef.current = true
    void financial.loadLoans().catch(() => undefined)
  }, [dialogs.showSearch, financial.hasLoadedLoans, financial.loadLoans, financial.loanLoadStatus])

  // The sheet's dialog machinery traps focus and handles Escape; only the hand-back to the add
  // button is ours, so a keyboard user lands where they started.
  const closeQuickAdd = () => {
    fabMenu.close()
    window.requestAnimationFrame(() => fabTriggerRef.current?.focus({ preventScroll: true }))
  }

  const runQuickAdd = (action: QuickAddAction) => {
    fabMenu.close()
    switch (action) {
      case 'expense': nav.handleQuickAction('transaction', { txType: 'outflow' }); break
      case 'income': nav.handleQuickAction('transaction', { txType: 'inflow' }); break
      case 'transfer': nav.handleQuickAction('transaction', { txType: 'transfer' }); break
      case 'scan-receipt':
        updateAppSearch({ receiptScan: '1' })
        nav.handleQuickAction('transaction')
        break
      case 'bill': nav.handleQuickAction('subscription'); break
      case 'reward': nav.handleQuickAction('wishlist'); break
      case 'investment': onQuickAddInvestment(); break
      case 'ask-ai': setIsAiOpen(true); break
      case 'search': dialogs.setShowSearch(true); break
    }
  }

  return (
    <>
      <PendingSubscriptionsModal
        isOpen={dialogs.showLoginModal}
        pendingNotifications={currentPendingNotifications}
        currency={todayDashboardData?.setting.currency || financial.optimisticDashboardData?.setting?.currency || 'USD'}
        hideSensitive={prefs.hideSensitive}
        onClose={() => dialogs.setShowLoginModal(false)}
        onConfirmSubscription={financial.handleConfirmSubscription}
        onDiscardSubscription={financial.handleDiscardSubscription}
        onRemoveSubscription={(recurringPaymentId) => dialogs.setConfirmModalData({
          title: 'Remove Subscription',
          message: 'Delete this subscription? Future reminders stop; past ledger entries stay.',
          confirmText: 'Remove',
          onConfirm: () => financial.handleDeletePayment(recurringPaymentId)
        })}
      />

      {cycleSummary.target && (
        <CycleSummaryModal
          isOpen={cycleSummary.isOpen}
          onClose={cycleSummary.onClose}
          data={cycleSummary.data}
          previousData={cycleSummary.previousData}
          isLoading={cycleSummary.isLoading}
          loadError={cycleSummary.loadError}
          wishlist={financial.allWishlist}
          transactions={cycleSummary.transactions}
          loans={financial.allLoans}
          monthIndex={cycleSummary.target.monthIndex}
          year={cycleSummary.target.year}
          cycleDay={cycleSummary.cycleDay}
          variant={cycleSummary.variant}
          // Enters the Ledger through handleNavigateToLedger, not setActiveTab: it resets the
          // range and all-cycles state along with the period, and makes selecting the
          // already-active cycle a no-op. A bare setActiveTab left whatever range the user had
          // last applied in place, so a monthly summary could open a yearly all-cycles ledger.
          onViewLedger={() => {
            const target = cycleSummary.target
            if (!target) return
            const monthName = MONTH_NAMES[target.monthIndex - 1]
            if (!monthName) return
            cycleSummary.onClose()
            nav.handleNavigateToLedger({
              targetMonth: monthName,
              targetYear: target.year,
              range: 'monthly',
              showAllCycles: false,
            })
          }}
        />
      )}

      <FailedSyncModal
        isOpen={dialogs.showFailedOpsModal}
        failedOps={financial.failedOps}
        onClose={() => dialogs.setShowFailedOpsModal(false)}
        onDiscard={financial.discardFailedOp}
        onDiscardAll={financial.discardAllFailedOps}
        onRetry={financial.retryFailedOp}
        onOpenAccountReview={() => {
          dialogs.setShowFailedOpsModal(false)
          setIsAccountReviewOpen(true)
        }}
      />

      <AccountPlacementReviewSheet
        isOpen={isAccountReviewOpen}
        failedOps={financial.failedOps}
        accounts={financial.allAccounts}
        recurringPayments={financial.allRecurringPayments}
        onClose={() => setIsAccountReviewOpen(false)}
        onResolve={(operation, selections) => {
          financial.resolveAccountPlacementOps(operation, selections)
          setIsAccountReviewOpen(false)
        }}
      />

      <PasswordPromptModal
        isOpen={session.showPasswordPrompt}
        onClose={() => session.setShowPasswordPrompt(false)}
        onVerified={() => {
          prefs.setHideSensitive(false)
          session.setShowPasswordPrompt(false)
          financial.handleUpdateHideSensitivePreference(false)
        }}
        onTryFingerprint={session.hasFingerprintSetup ? async () => {
          const verified = await session.revealSensitiveWithFingerprint()
          if (verified) financial.handleUpdateHideSensitivePreference(false)
          return verified
        } : undefined}
      />

      <LockScreen
        isOpen={session.isLocked && !!session.token}
        username={session.username}
        onUnlocked={session.handleUnlocked}
        onSignOut={session.handleLogout}
      />

      {dialogs.customAlert && (
        <Suspense fallback={null}>
          <CustomAlertModal
            isOpen
            title={dialogs.customAlert.title || 'Notification'}
            message={dialogs.customAlert.message || ''}
            onClose={() => dialogs.setCustomAlert(null)}
          />
        </Suspense>
      )}

      {dialogs.confirmModalData && (
        <CustomConfirmModal
            isOpen
            title={dialogs.confirmModalData.title || 'Confirmation'}
            message={dialogs.confirmModalData.message || ''}
            confirmText={dialogs.confirmModalData.confirmText || 'Confirm'}
            cancelText="Cancel"
            variant={dialogs.confirmModalData.variant || 'danger'}
            confirmDisabled={dialogs.confirmModalData.confirmDisabled || false}
            onConfirm={() => {
              if (dialogs.confirmModalData) {
                dialogs.confirmModalData.onConfirm()
                dialogs.setConfirmModalData(null)
              }
            }}
            onCancel={() => dialogs.setConfirmModalData(null)}
        />
      )}

      {dialogs.showSearch && (
        <Suspense fallback={<GlobalSearchLoading />}>
          <GlobalSearch
            isOpen={dialogs.showSearch}
            onClose={() => dialogs.setShowSearch(false)}
            data={{
              // The optimistic projection, like every other source here. Reading the raw cycle
              // array meant a transaction added offline was invisible to search while the Ledger
              // showed it, and one queued for deletion was still offered and clickable.
              transactions: financial.allTransactions,
              draftTransactions: financial.draftTransactions,
              accounts: financial.allAccounts,
              recurringPayments: financial.allRecurringPayments,
              loans: financial.allLoans,
              savingsGoals: financial.allSavingsGoals,
              wishlist: financial.allWishlist,
            }}
            onOpenResult={result => {
              openSearchResult(result, {
                transaction: (id, date) => { void openSearchTransaction(id, date) },
                account: nav.handleNavigateToAccounts,
                bill: nav.handleNavigateToRecurring,
                loan: nav.handleNavigateToLoan,
                commitment: nav.handleNavigateToCommitment,
                reward: nav.handleNavigateToReward,
                draft: nav.handleNavigateToDraft,
              })
            }}
            onSearchAllCycles={query => {
              nav.handleNavigateToLedger({ search: query, showAllCycles: true, range: 'all' })
            }}
            formatAmount={financial.formatSensitive}
            maskAmounts={prefs.maskPassiveFinancialFigures}
            isLoadingLoans={financial.loanLoadStatus === 'loading' && financial.allLoans.length === 0}
            didLoansFailToLoad={financial.loanLoadStatus === 'error'}
            onRetryLoans={() => {
              searchLoanLoadAttemptedRef.current = false
              void financial.loadLoans().catch(() => undefined)
            }}
          />
        </Suspense>
      )}

      {session.token && fabMenu.isOpen && (
        <Suspense fallback={null}>
          <QuickAddSheet
            isOpen={fabMenu.isOpen}
            onClose={closeQuickAdd}
            onAction={runQuickAdd}
            mutationsDisabled={!canOpenBlankMutationForm(prefs.hideSensitive, prefs.sensitivePreferenceStatus)}
            mutationsDisabledReason={prefs.hideSensitive && prefs.sensitivePreferenceStatus === 'pending'
              ? 'Finishing security check…'
              : 'Reveal sensitive data to make financial changes'}
          />
        </Suspense>
      )}
    </>
  )
}
