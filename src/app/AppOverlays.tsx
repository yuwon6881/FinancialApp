import { lazy, Suspense, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { CreditCard, PiggyBank, Sparkles, Wallet, X, Zap } from 'lucide-react'
import type { DashboardData, PendingNotification } from '../types'
import { MONTH_NAMES } from '../lib/cycle'
import type { useAppDialogs } from './useAppDialogs'
import type { useAppPreferences } from './useAppPreferences'
import type { useAppSession } from './useAppSession'
import type { useCycleNavigation } from './useCycleNavigation'
import type { useCycleSummary } from './useCycleSummary'
import type { useFabMenu } from './useFabMenu'
import type { useFinancialData } from './useFinancialData'

const PendingSubscriptionsModal = lazy(() => import('../components/PendingSubscriptionsModal').then(module => ({ default: module.PendingSubscriptionsModal })))
const FailedSyncModal = lazy(() => import('../components/FailedSyncModal').then(module => ({ default: module.FailedSyncModal })))
const PasswordPromptModal = lazy(() => import('../components/PasswordPromptModal').then(module => ({ default: module.PasswordPromptModal })))
const LockScreen = lazy(() => import('../components/LockScreen').then(module => ({ default: module.LockScreen })))
const CycleSummaryModal = lazy(() => import('../components/CycleSummaryModal').then(module => ({ default: module.CycleSummaryModal })))
const CustomAlertModal = lazy(() => import('../components/ui/CustomAlertModal').then(module => ({ default: module.CustomAlertModal })))
const CustomConfirmModal = lazy(() => import('../components/ui/CustomConfirmModal').then(module => ({ default: module.CustomConfirmModal })))

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
  todayDashboardData,
  currentPendingNotifications,
  setIsAiOpen,
}: AppOverlaysProps) {
  const reduceMotion = useReducedMotion()
  const fabActionsRef = useRef<HTMLDivElement>(null)
  const fabTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (prefs.hideSensitive) fabMenu.close()
  }, [prefs.hideSensitive, fabMenu.close])

  useEffect(() => {
    if (!fabMenu.isOpen || prefs.activeTab === 'drafts') return
    const frame = window.requestAnimationFrame(() => {
      fabActionsRef.current
        ?.querySelector<HTMLButtonElement>('[data-fab-action]:not(:disabled)')
        ?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fabMenu.isOpen, prefs.activeTab])

  useEffect(() => {
    if (!fabMenu.isOpen || prefs.activeTab === 'drafts') return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      fabMenu.close()
      window.requestAnimationFrame(() => fabTriggerRef.current?.focus({ preventScroll: true }))
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [fabMenu.close, fabMenu.isOpen, prefs.activeTab])

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
          onViewLedger={() => {
            const month = MONTH_NAMES[cycleSummary.target!.monthIndex - 1]
            const year = cycleSummary.target!.year
            cycleSummary.onClose()
            nav.handleNavigateToLedger({
              targetMonth: month,
              targetYear: year,
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

      <footer className="border-t border-border/40 py-6 pb-24 md:pb-6 bg-background/45 backdrop-blur select-none">
        <div className="mx-auto w-full max-w-[1440px] px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} FinancialApp. All rights reserved.
        </div>
      </footer>

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

      {session.token && (
        <>
          <AnimatePresence>
            {fabMenu.isOpen && prefs.activeTab !== 'drafts' && (
              <m.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
                className="lg:hidden fixed inset-0 z-30 bg-background/45 backdrop-blur-sm cursor-pointer"
                onClick={closeFabAndRestoreFocus}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {fabMenu.isOpen && prefs.activeTab !== 'drafts' && (
              <m.div
                ref={fabActionsRef}
                id="mobile-fab-actions"
                role="menu"
                aria-label="Quick actions"
                variants={fabMenuVariants}
                initial={reduceMotion ? false : 'hidden'}
                animate="visible"
                exit="hidden"
                className="lg:hidden fixed right-8 z-40 flex flex-col gap-3.5 items-end pointer-events-auto"
                style={{ bottom: 'calc(164px + env(safe-area-inset-bottom, 0px))' }}
              >
                {([
                  { key: 'wishlist' as const, label: 'Add Wish Goal', Icon: PiggyBank, color: 'bg-pink-500' },
                  { key: 'subscription' as const, label: 'New Subscription', Icon: CreditCard, color: 'bg-violet-500' },
                  { key: 'transaction' as const, label: 'Post Transaction', Icon: Wallet, color: 'bg-emerald-500' },
                  { key: 'ai' as const, label: 'Ask AI', Icon: Sparkles, color: 'bg-indigo-500' },
                ]).map(({ key, label, Icon, color }) => (
                  <m.button
                    key={key}
                    type="button"
                    role="menuitem"
                    data-fab-action
                    variants={fabActionVariants}
                    whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                    disabled={prefs.hideSensitive && key !== 'ai'}
                    title={prefs.hideSensitive && key !== 'ai' ? 'Reveal sensitive data to make financial changes' : label}
                    onClick={() => {
                      if (key === 'ai') {
                        setIsAiOpen(true)
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
                ))}
              </m.div>
            )}
          </AnimatePresence>
          {prefs.activeTab !== 'drafts' && <m.button
            ref={fabTriggerRef}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
            onClick={fabMenu.toggle}
            className="fixed right-6 z-40 flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/25 lg:hidden"
            style={{
              bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))'
            }}
            title={fabMenu.isOpen ? 'Close Menu' : 'Open Menu'}
            aria-label={fabMenu.isOpen ? 'Close Menu' : 'Open Menu'}
            aria-expanded={fabMenu.isOpen}
            aria-controls="mobile-fab-actions"
          >
            {fabMenu.isOpen ? (
              <X className="size-6" />
            ) : (
              <Zap className="size-6" />
            )}
          </m.button>}
        </>
      )}
    </>
  )
}
