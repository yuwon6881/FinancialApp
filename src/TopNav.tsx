import { Button } from './components/ui/Button'
import React from 'react'
import { 
  CalendarCheck2,
  Wallet, 
  CreditCard,
  Bell,
  FileText,
  Sparkles,
  BarChart3,
  Loader2,
  ShieldAlert,
  Search as SearchIcon,
  ClipboardList,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { CommitmentIcon } from './components/semanticIcons'
import { AppLogo } from './components/ui/AppLogo'
import { mutationBusyLabel } from './components/ui/rowSyncState'
import { useIsCompact } from './lib/breakpoints'
import type { AppTab, PendingNotification } from './types'
import type { SensitivePreferenceStatus } from './app/useAppPreferences'
import { MobileBottomNav, type NavItemConfig } from './components/nav/MobileBottomNav'
import { QuickActionsDropdown } from './components/nav/QuickActionsDropdown'
import { UserProfileDropdown } from './components/nav/UserProfileDropdown'
import { PageContainer } from './components/ui/PageContainer'
import { DesktopNavRail } from './components/nav/DesktopNavRail'

interface TopNavProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  onQuickAction?: (action: 'transaction' | 'subscription' | 'wishlist') => void
  onAskAI?: () => void
  onOpenSearch?: () => void
  hideSensitive: boolean
  sensitivePreferenceStatus: SensitivePreferenceStatus
  onToggleHideSensitive: () => void
  onRetrySensitivePreference: () => void
  onLogout: () => void
  username: string
  pendingNotifications: PendingNotification[]
  onOpenNotifications: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  isSyncing?: boolean
  syncLabel?: string
  isOffline?: boolean
  draftCount?: number
  failedOpsCount?: number
  onOpenFailedOps?: () => void
}

const compactNavItems: NavItemConfig[] = [
  {
    tab: 'dashboard',
    label: 'Today',
    mobileLabel: 'Today',
    Icon: CalendarCheck2,
    activeClass: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25 shadow-blue-500/10',
    iconClass: 'text-blue-500',
    dotClass: 'bg-blue-500'
  },
  {
    tab: 'reports',
    label: 'Reports',
    mobileLabel: 'Reports',
    Icon: BarChart3,
    activeClass: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 shadow-indigo-500/10',
    iconClass: 'text-indigo-500',
    dotClass: 'bg-indigo-500'
  },
  {
    tab: 'ledger',
    label: 'Ledger',
    mobileLabel: 'Ledger',
    Icon: Wallet,
    activeClass: 'bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25 shadow-teal-500/10',
    iconClass: 'text-teal-500',
    dotClass: 'bg-teal-500'
  },
  {
    tab: 'recurring',
    label: 'Recurring',
    mobileLabel: 'Recurring',
    Icon: CreditCard,
    activeClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25 shadow-violet-500/10',
    iconClass: 'text-violet-500',
    dotClass: 'bg-violet-500'
  },
  {
    tab: 'documents',
    label: 'Vault',
    mobileLabel: 'Vault',
    Icon: FileText,
    activeClass: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25 shadow-amber-500/10',
    iconClass: 'text-amber-500',
    dotClass: 'bg-amber-500'
  }
]

const navItems: NavItemConfig[] = [
  ...compactNavItems.slice(0, 4),
  {
    tab: 'wishlist', label: 'Commitments & Rewards', mobileLabel: 'Rewards', Icon: CommitmentIcon,
    activeClass: 'bg-pink-500/12 text-pink-600 dark:text-pink-400 border-pink-500/25 shadow-pink-500/10',
    iconClass: 'text-pink-500', dotClass: 'bg-pink-500',
  },
  {
    tab: 'drafts', label: 'Drafts', mobileLabel: 'Drafts', Icon: ClipboardList,
    activeClass: 'bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25 shadow-sky-500/10',
    iconClass: 'text-sky-500', dotClass: 'bg-sky-500',
  },
  {
    tab: 'investments', label: 'Investments', mobileLabel: 'Invest', Icon: TrendingUp,
    activeClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25 shadow-violet-500/10',
    iconClass: 'text-violet-500', dotClass: 'bg-violet-500',
  },
  compactNavItems[4],
  {
    tab: 'settings', label: 'Settings', mobileLabel: 'Settings', Icon: Settings,
    activeClass: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25 shadow-blue-500/10',
    iconClass: 'text-blue-500', dotClass: 'bg-blue-500',
  },
]

const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  onQuickAction,
  onAskAI,
  onOpenSearch,
  hideSensitive,
  sensitivePreferenceStatus,
  onToggleHideSensitive,
  onRetrySensitivePreference,
  onLogout,
  username,
  pendingNotifications,
  onOpenNotifications,
  darkMode,
  onToggleDarkMode,
  isSyncing = false,
  syncLabel,
  isOffline = false,
  draftCount = 0,
  failedOpsCount = 0,
  onOpenFailedOps
}) => {
  const hasAlerts = pendingNotifications.length > 0
  const isPhone = useIsCompact()
  const syncStatusLabel = syncLabel || mutationBusyLabel('syncing')
  const isBusy = !isOffline && (isSyncing || Boolean(syncLabel))

  const draftStatus = draftCount > 0 ? (
    <Button variant="unstyled"
      type="button"
      onClick={() => onTabChange('drafts')}
      className="ml-2.5 flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs font-bold text-amber-500 cursor-pointer select-none shrink-0 hover:bg-amber-500/25 transition duration-150 animate-in fade-in zoom-in-95"
      title="Draft transactions waiting to be synced to the server"
    >
      <FileText className="size-3" />
      <span>{draftCount} Draft{draftCount > 1 ? 's' : ''}</span>
    </Button>
  ) : null

  const failedOpsStatus = failedOpsCount > 0 ? (
    <Button variant="unstyled"
      type="button"
      role="status"
      aria-label={`${failedOpsCount} failed sync ${failedOpsCount === 1 ? 'item' : 'items'}`}
      onClick={() => onOpenFailedOps?.()}
      className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-destructive/10 border border-destructive/20 rounded-md text-xs font-bold text-destructive cursor-pointer select-none shrink-0 hover:bg-destructive/20 transition duration-150"
      title="Operations that failed to sync and were removed from the active queue — click to view details"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
      <span>{failedOpsCount} failed</span>
    </Button>
  ) : null

  return (
    <>
      <header
        className="glass-nav sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div
          className={`h-[2.5px] w-full bg-gradient-to-r from-blue-500 via-teal-500 via-amber-500 to-pink-500 ${isBusy ? 'nav-activity-bar' : ''}`}
          data-busy={isBusy || undefined}
          aria-hidden="true"
        />
        <PageContainer className="relative flex h-16 items-center">
        
        {/* Left Side (Logo and Brand) */}
        {/* `flex-1` here and `ml-auto` on the right group are what push the two clusters apart. They
            used to be cancelled between md and xl (`md:flex-initial`/`md:ml-0`, restored only by
            `xl:flex-1`), which left nothing growing and bunched the whole header to the left. */}
        <div className="flex min-w-0 flex-1 items-center justify-start overflow-hidden z-10">
          <Button
            variant="unstyled"
            type="button"
            aria-label="Go to Today"
            onClick={() => onTabChange('dashboard')}
            className="brand-home-button flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl cursor-pointer select-none active:scale-95"
          >
            <span className="relative shrink-0">
              <AppLogo className="size-9 rounded-xl transition-transform duration-200 hover:scale-105" />
              {(isOffline || isSyncing || syncLabel) && (
                <span
                  role="status"
                  aria-label={isOffline ? 'Offline' : syncStatusLabel}
                  title={isOffline ? 'No network connection — showing saved data; changes will sync when you are back online' : syncStatusLabel}
                  className={`absolute -right-0.5 -top-0.5 z-10 flex size-3.5 items-center justify-center rounded-full border-2 border-background ${isOffline ? 'bg-amber-500' : 'animate-pulse bg-blue-500'}`}
                />
              )}
            </span>
            <span className="brand-home-label hidden sm:inline text-base lg:text-lg font-extrabold tracking-tight bg-linear-to-r from-foreground via-foreground to-blue-500 bg-clip-text text-transparent truncate">
              FinancialApp
            </span>
          </Button>

          {isPhone && (isOffline || syncLabel) && (
            <span
              role="status"
              className={`ml-2 shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold ${isOffline ? 'border-amber-500/20 bg-amber-500/10 text-amber-500' : 'border-blue-500/20 bg-blue-500/10 text-blue-500'}`}
            >
              {isOffline ? 'Offline' : syncStatusLabel}
            </span>
          )}

          {onOpenSearch && (
            <Button
              variant="unstyled"
              type="button"
              onClick={onOpenSearch}
              aria-label="Search your records"
              title="Search (Ctrl+K)"
              className="ml-2 hidden size-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-muted-foreground transition duration-150 cursor-pointer active:scale-95 hover:border-primary/40 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus:outline-none sm:flex 2xl:ml-3 2xl:w-52 2xl:justify-start 2xl:px-3"
            >
              <SearchIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden truncate text-xs font-medium 2xl:inline">Search records…</span>
              <span
                aria-hidden
                className="ml-auto hidden shrink-0 rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 text-xs font-bold 2xl:inline"
              >
                Ctrl K
              </span>
            </Button>
          )}
          {isPhone && draftStatus}
          {isPhone && failedOpsStatus}
        </div>

        {/* Right Side Widgets & Actions */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 z-10 ml-auto sm:gap-2.5 xl:gap-3">
          {!isPhone && (
            <>
              {failedOpsStatus}
              {draftStatus}
            </>
          )}
          
          <Button variant="unstyled"
            type="button"
            onClick={onAskAI}
            className="hidden sm:flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/8 text-blue-600 hover:border-blue-500/35 hover:bg-blue-500/14 dark:text-blue-400 select-none transition-all duration-150 cursor-pointer active:scale-95 xl:h-9 xl:w-auto xl:gap-1.5 xl:px-3"
            title="ASK AI"
            aria-label="ASK AI"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden xl:inline text-xs font-extrabold tracking-wide">ASK AI</span>
          </Button>

          <Button variant="unstyled"
            type="button"
            size="icon"
            onClick={() => onTabChange('wishlist')}
            aria-label="Commitments and Rewards"
            aria-current={activeTab === 'wishlist' ? 'page' : undefined}
            title="Commitments and Rewards"
            className={`flex items-center justify-center rounded-xl border transition duration-150 cursor-pointer active:scale-95 ${
              activeTab === 'wishlist'
                ? 'border-violet-500/40 bg-violet-500/20 text-violet-400 shadow-sm'
                : 'border-border/40 bg-muted/30 text-muted-foreground hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400'
            }`}
          >
            <CommitmentIcon className="size-4" aria-hidden />
          </Button>

          <div className="relative">
            <Button variant="unstyled"
              type="button"
              size="icon"
              onClick={onOpenNotifications}
              className="relative flex items-center justify-center rounded-xl border border-amber-500/10 bg-amber-500/5 text-amber-500 hover:border-amber-500/20 hover:bg-amber-500/10 cursor-pointer transition duration-150 active:scale-95"
              title={hasAlerts ? `${pendingNotifications.length} bills need review` : 'No bills need review'}
              aria-label={hasAlerts ? `Review ${pendingNotifications.length} pending bills` : 'Bills: all caught up'}
            >
              <Bell className="size-4 text-amber-500" />
              {hasAlerts && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />
              )}
            </Button>
          </div>

          <QuickActionsDropdown onQuickAction={onQuickAction} />

          <UserProfileDropdown
            username={username}
            onTabChange={onTabChange}
            hideSensitive={hideSensitive}
            sensitivePreferenceStatus={sensitivePreferenceStatus}
            onToggleHideSensitive={onToggleHideSensitive}
            darkMode={darkMode}
            onToggleDarkMode={onToggleDarkMode}
            onLogout={onLogout}
          />
        </div>
        </PageContainer>
        {sensitivePreferenceStatus !== 'resolved' && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="privacy-status"
            className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-50 w-max max-w-[calc(100vw_-_1.5rem)] -translate-x-1/2 rounded-xl border border-amber-500/30 bg-card/96 p-4 shadow-xl backdrop-blur-xl transition-[opacity,transform] duration-200"
          >
            <span className="pointer-events-auto flex items-start gap-3">
              {sensitivePreferenceStatus === 'pending' ? (
                <>
                  <div className="mt-0.5 shrink-0 text-amber-500">
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-bold text-foreground">Protecting your amounts</div>
                    <div className="text-body leading-relaxed text-muted-foreground mt-0.5">Checking privacy settings before anything is revealed.</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-0.5 shrink-0 text-amber-500">
                    <ShieldAlert className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-bold text-foreground">Amounts remain protected</div>
                    <div className="text-body leading-relaxed text-muted-foreground mt-0.5">Privacy settings couldn't be verified.</div>
                  </div>
                  <Button variant="unstyled"
                    type="button"
                    onClick={onRetrySensitivePreference}
                    className="ml-2 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer self-center"
                  >
                    Retry
                  </Button>
                </>
              )}
            </span>
          </div>
        )}
      </header>

      {isPhone ? (
        <MobileBottomNav
          navItems={compactNavItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      ) : (
        <DesktopNavRail navItems={navItems} activeTab={activeTab} onTabChange={onTabChange} />
      )}
    </>
  )
}

export default TopNav
