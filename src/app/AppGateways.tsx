import React, { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { AppLogo } from '../components/ui/AppLogo'
import { ToastViewport } from '../components/ui/ToastViewport'
import { AppProvider } from '../contexts/AppProvider'
import type { AppContextValue } from '../contexts/AppContext'
import { LaunchReady } from './LaunchReady'
import { ViewFallback, CycleSkeletonFallback } from './AppShellComponents'
import { getPageSkeletonVariant } from './pageSkeletonUtils'
import type { useAppSession } from './useAppSession'
import type { useAppPreferences } from './useAppPreferences'
import type { useAppDialogs } from './useAppDialogs'
import type { useFinancialData } from './useFinancialData'
import type { useCycleNavigation } from './useCycleNavigation'
import { hasCompleteAccountCoverage } from '../lib/ledgerAccountCoverage'
import { PageContainer } from '../components/ui/PageContainer'

const LoginView = lazy(() => import('../components/LoginView').then(m => ({ default: m.LoginView })))
const AccountCoverageGate = lazy(() => import('../components/AccountCoverageGate').then(m => ({ default: m.AccountCoverageGate })))
const LockScreen = lazy(() => import('../components/LockScreen').then(m => ({ default: m.LockScreen })))
const PwaLaunchGate = lazy(() => import('./PwaLaunchGate').then(m => ({ default: m.PwaLaunchGate })))
const CycleSkeleton = lazy(() => import('../components/ui/CycleSkeleton').then(m => ({ default: m.CycleSkeleton })))

export interface AppGatewaysProps {
  session: ReturnType<typeof useAppSession>
  prefs: ReturnType<typeof useAppPreferences>
  dialogs: ReturnType<typeof useAppDialogs>
  financial: ReturnType<typeof useFinancialData>
  nav: ReturnType<typeof useCycleNavigation>
  appContextValue: AppContextValue
  children: React.ReactNode
}

export const AppGateways: React.FC<AppGatewaysProps> = ({
  session,
  prefs,
  dialogs,
  financial,
  nav,
  appContextValue,
  children,
}) => {
  if (!session.isSessionResolved) {
    return (
      <LaunchReady>
        <ViewFallback />
      </LaunchReady>
    )
  }

  if (!session.token) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LaunchReady>
          <LoginView onLoginSuccess={session.handleLoginSuccess} />
        </LaunchReady>
      </Suspense>
    )
  }

  if (session.isPwaLaunchGateLocked) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <PwaLaunchGate
          appContextValue={appContextValue}
          toasts={dialogs.toasts}
          onDismissToast={dialogs.dismissToast}
          username={session.username}
          onTryDeviceUnlock={session.unlockPwaLaunchGateWithDevice}
          onUnlocked={session.handlePwaLaunchGateUnlocked}
          onSignOut={session.handleLogout}
        />
      </Suspense>
    )
  }

  if (session.isNativeAppGateLocked) {
    return (
      <LaunchReady>
        <AppProvider value={appContextValue}>
          <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-primary/25 selection:text-foreground">
            <ToastViewport toasts={dialogs.toasts} onDismiss={dialogs.dismissToast} />
            <LockScreen
              mode="native-app"
              isOpen
              username={session.username}
              onUnlocked={session.unlockNativeAppGate}
              onSignOut={session.handleLogout}
            />
          </div>
        </AppProvider>
      </LaunchReady>
    )
  }

  if (financial.loading && !financial.optimisticDashboardData) {
    return (
      <LaunchReady>
        <div
          data-testid="app-loading-skeleton"
          className="app-shell min-h-screen min-h-dvh text-foreground"
          aria-busy="true"
          aria-label="Loading your financial data securely"
        >
          <PageContainer className="safe-screen-inset space-y-6 [--safe-screen-block:1.5rem] !px-0 sm:[--safe-screen-inline:1.5rem] lg:[--safe-screen-inline:2rem]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AppLogo className="size-10 rounded-xl" pulse />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-2 w-20" />
                </div>
              </div>
              <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-xs font-semibold text-blue-500">
                <Loader2 className="animate-spin size-5" aria-hidden="true" />
                <span className="hidden sm:inline">Loading your financial data securely…</span>
              </div>
            </div>
            <Suspense fallback={<CycleSkeletonFallback />}>
              <CycleSkeleton variant={getPageSkeletonVariant(prefs.activeTab)} fullPage />
            </Suspense>
          </PageContainer>
        </div>
      </LaunchReady>
    )
  }

  if (session.isLocked && !!session.token) {
    return (
      <LaunchReady>
        <AppProvider value={appContextValue}>
          <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-primary/25 selection:text-foreground">
            <ToastViewport toasts={dialogs.toasts} onDismiss={dialogs.dismissToast} />
            <LockScreen
              isOpen
              username={session.username}
              onUnlocked={session.handleUnlocked}
              onSignOut={session.handleLogout}
            />
          </div>
        </AppProvider>
      </LaunchReady>
    )
  }

  if (!hasCompleteAccountCoverage(financial.allAccounts)) {
    return (
      <LaunchReady>
        {/*
          * The gate is a full return, so nothing below it is mounted -- including the toast
          * surface the outbox reports a rejected mutation through. Account writes are queued, so
          * their verdict always arrives after the sheet has closed; without this the first-run
          * user whose account the server refused watched the row vanish and was told nothing.
          */}
        <ToastViewport toasts={dialogs.toasts} onDismiss={dialogs.dismissToast} />
        <Suspense fallback={<ViewFallback />}>
          <AccountCoverageGate
            accounts={financial.allAccounts}
            currency={financial.optimisticDashboardData?.setting?.currency || 'USD'}
            loading={financial.loading}
            error={financial.error}
            hideSensitive={prefs.hideSensitive}
            formatSensitive={financial.formatSensitive}
            onAddAccount={financial.handleAddAccount}
            onUpdateAccount={financial.handleUpdateAccount}
            onRetry={() => financial.loadAll(nav.selectedMonth || undefined, nav.selectedYear || undefined, true)}
          />
        </Suspense>
      </LaunchReady>
    )
  }

  return <>{children}</>
}
