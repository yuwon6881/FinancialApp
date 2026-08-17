import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { CreditCard, Search, Sparkles, Wallet } from 'lucide-react'
import { RewardIcon } from '../components/semanticIcons'
import type { DashboardData, PendingNotification } from '../types'
import { MONTH_NAMES } from '../lib/cycle'
import type { useAppDialogs } from './useAppDialogs'
import type { useAppPreferences } from './useAppPreferences'
import type { useAppSession } from './useAppSession'
import type { useCycleNavigation } from './useCycleNavigation'
import type { useCycleSummary } from './useCycleSummary'
import { shouldShowMobileFab } from './useFabMenu'
import { canOpenBlankMutationForm } from '../lib/quickAddAvailability'
import type { useFabMenu } from './useFabMenu'
import type { useFinancialData } from './useFinancialData'

const PendingSubscriptionsModal = lazy(() => import('../components/PendingSubscriptionsModal').then(module => ({ default: module.PendingSubscriptionsModal })))
const FailedSyncModal = lazy(() => import('../components/FailedSyncModal').then(module => ({ default: module.FailedSyncModal })))
const AccountPlacementReviewSheet = lazy(() => import('../components/AccountPlacementReviewSheet').then(module => ({ default: module.AccountPlacementReviewSheet })))
const PasswordPromptModal = lazy(() => import('../components/PasswordPromptModal').then(module => ({ default: module.PasswordPromptModal })))
const LockScreen = lazy(() => import('../components/LockScreen').then(module => ({ default: module.LockScreen })))
const CycleSummaryModal = lazy(() => import('../components/CycleSummaryModal').then(module => ({ default: module.CycleSummaryModal })))
const CustomAlertModal = lazy(() => import('../components/ui/CustomAlertModal').then(module => ({ default: module.CustomAlertModal })))
const CustomConfirmModal = lazy(() => import('../components/ui/CustomConfirmModal').then(module => ({ default: module.CustomConfirmModal })))
const GlobalSearch = lazy(() => import('../components/search/GlobalSearch').then(module => ({ default: module.GlobalSearch })))

const fabMenuVariants = {
  hidden: {
    transition: { staggerChildren: 0.04 },
  },
  visible: {
    transition: {
      delayChildren: 0.06,
      staggerChildren: 0.08,
      staggerDirection: -1,
    },
  },
}

const fabActionVariants = {
  hidden: { opacity: 0, scale: 0.7, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 18 },
  },
}

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
}: AppOverlaysProps) {
  const reduceMotion = useReducedMotion()
  const fabActionsRef = useRef<HTMLDivElement>(null)
  const searchLoanLoadAttemptedRef = useRef(false)
  const [isAccountReviewOpen, setIsAccountReviewOpen] = useState(false)
  const showMobileFab = shouldShowMobileFab(prefs.activeTab)

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

  useEffect(() => {
    if (!fabMenu.isOpen || !showMobileFab) return
    const frame = window.requestAnimationFrame(() => {
      fabActionsRef.current
        ?.querySelector<HTMLButtonElement>('[data-fab-action]:not(:disabled)')
        ?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fabMenu.isOpen, showMobileFab])

  useEffect(() => {
    if (!fabMenu.isOpen || !showMobileFab) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      fabMenu.close()
      window.requestAnimationFrame(() => fabTriggerRef.current?.focus({ preventScroll: true }))
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [fabMenu.close, fabMenu.isOpen, showMobileFab])

  const closeFabAndRestoreFocus = () => {
    fabMenu.close()
    window.requestAnimationFrame(() => fabTriggerRef.current?.focus({ preventScroll: true }))
  }

  return (
    <>
      <PendingSubscriptionsModal
        isOpen={dialogs.showLoginModal}
        pendingNotifications={currentPendingNotifications}
        currency={todayDashboardData?.setting.currency || financial.optimisticDashboardData?.setting?.currency || 'USD'}
        hideSensitive={prefs.hideSensitive}
        showOnLoginChecked={prefs.notifyOnLogin}
        onToggleShowOnLogin={(checked) => {
          prefs.setNotifyOnLogin(checked)
        }}
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
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {dialogs.showSearch && (
        <Suspense fallback={null}>
          <GlobalSearch
            isOpen={dialogs.showSearch}
            onClose={() => dialogs.setShowSearch(false)}
            data={{
              transactions: financial.transactions,
              accounts: financial.allAccounts,
              recurringPayments: financial.allRecurringPayments,
              loans: financial.allLoans,
              savingsGoals: financial.allSavingsGoals,
              wishlist: financial.allWishlist,
            }}
            onOpenResult={result => {
              const { target } = result
              if (target.to === 'transaction') {
                nav.handleNavigateToLedger({ highlightedTxId: target.transactionId })
              } else if (target.to === 'account') {
                nav.handleNavigateToAccounts(target.accountId)
              } else if (target.to === 'bill') {
                nav.handleNavigateToRecurring(target.recurringPaymentId)
              } else if (target.to === 'loans') {
                prefs.setActiveTab('recurring')
              } else {
                prefs.setActiveTab('wishlist')
              }
            }}
            onSearchAllCycles={query => {
              nav.handleNavigateToLedger({ search: query, showAllCycles: true, range: 'yearly' })
            }}
            formatAmount={financial.formatSensitive}
            maskAmounts={prefs.hideSensitive}
            isLoadingLoans={financial.loanLoadStatus === 'loading' && financial.allLoans.length === 0}
          />
        </Suspense>
      )}

      {session.token && (
        <>
          <AnimatePresence>
            {fabMenu.isOpen && showMobileFab && (
              <m.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
                className="md:hidden fixed inset-0 z-30 bg-background/45 backdrop-blur-sm cursor-pointer"
                onClick={closeFabAndRestoreFocus}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {fabMenu.isOpen && showMobileFab && (
              <m.div
                ref={fabActionsRef}
                id="mobile-fab-actions"
                role="menu"
                aria-label="Quick actions"
                variants={fabMenuVariants}
                initial={reduceMotion ? false : 'hidden'}
                animate="visible"
                exit="hidden"
                className="md:hidden fixed right-8 z-40 flex flex-col gap-3.5 items-end pointer-events-auto"
                style={{ bottom: 'calc(164px + env(safe-area-inset-bottom, 0px))' }}
              >
                {/* Search lives here rather than in the phone header: the header's right lane is
                    already the app's tightest space, and unlike the quick-add actions search is a
                    read, so it is never blocked by sensitive mode. */}
                {([
                  { key: 'wishlist' as const, label: 'Add Reward', Icon: RewardIcon, color: 'bg-pink-500' },
                  { key: 'subscription' as const, label: 'New Subscription', Icon: CreditCard, color: 'bg-violet-500' },
                  { key: 'transaction' as const, label: 'Post Transaction', Icon: Wallet, color: 'bg-emerald-500' },
                  { key: 'ai' as const, label: 'Ask AI', Icon: Sparkles, color: 'bg-indigo-500' },
                  { key: 'search' as const, label: 'Search', Icon: Search, color: 'bg-sky-500' },
                ]).map(({ key, label, Icon, color }) => {
                  // Ask AI and Search are reads; only the three quick-add actions open a blank
                  // mutation form and are therefore gated by sensitive mode.
                  const isMutation = key !== 'ai' && key !== 'search'
                  return (
                  <m.button
                    key={key}
                    type="button"
                    role="menuitem"
                    data-fab-action
                    variants={fabActionVariants}
                    whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                    disabled={isMutation && !canOpenBlankMutationForm(prefs.hideSensitive, prefs.sensitivePreferenceStatus)}
                    title={isMutation && prefs.hideSensitive && prefs.sensitivePreferenceStatus === 'pending'
                      ? 'Finishing security check…'
                      : isMutation && prefs.hideSensitive
                        ? 'Reveal sensitive data to make financial changes'
                        : label}
                    onClick={() => {
                      if (key === 'ai') {
                        setIsAiOpen(true)
                      } else if (key === 'search') {
                        dialogs.setShowSearch(true)
                      } else {
                        nav.handleQuickAction(key)
                      }
                      fabMenu.close()
                    }}
                    className="flex items-center gap-2.5 group cursor-pointer"
                  >
                    <span className="bg-card border border-border px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-foreground shadow-xs">{label}</span>
                    {/* Ayu's 500 steps are bright tints on a near-black surface, so a white
                        glyph on them is close to invisible; the dark surface colour is the
                        readable pairing there. Light mode keeps white on its darker fills. */}
                    <span className={`size-11 rounded-full ${color} text-on-vivid flex items-center justify-center shadow-lg`}><Icon className="size-5" /></span>
                  </m.button>
                  )
                })}
              </m.div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  )
}
