import { Button } from './components/ui/Button'
import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  CalendarCheck2,
  Wallet, 
  LogOut, 
  Plus, 
  CreditCard,
  Eye,
  EyeOff,
  Bell,
  Moon,
  Sun,
  FileText,
  Settings,
  Sparkles,
  BarChart3,
  Loader2,
  ShieldAlert,
  TrendingUp,
  Search as SearchIcon,
} from 'lucide-react'
import { CommitmentIcon } from './components/semanticIcons'
import { triggerHaptic } from './lib/haptics'
import { AppLogo } from './components/ui/AppLogo'
import { mutationBusyLabel } from './components/ui/rowSyncState'
import { useIsMobile } from './lib/useIsMobile'
import type { AppTab, PendingNotification } from './types'
import type { SensitivePreferenceStatus } from './app/useAppPreferences'

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
  const isPhone = useIsMobile(640)
  const syncStatusLabel = syncLabel || mutationBusyLabel('syncing')

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  const navItems: Array<{
    tab: AppTab
    label: string
    mobileLabel: string
    Icon: React.ComponentType<{ className?: string }>
    activeClass: string
    iconClass: string
    dotClass: string
  }> = [
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

  const draftStatus = draftCount > 0 ? (
    <Button variant="unstyled"
      type="button"
      onClick={() => onTabChange('drafts')}
      className="ml-2.5 flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] font-bold text-amber-500 cursor-pointer select-none shrink-0 hover:bg-amber-500/25 transition duration-150 animate-in fade-in zoom-in-95"
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
      className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-destructive/10 border border-destructive/20 rounded-md text-[10px] font-bold text-destructive cursor-pointer select-none shrink-0 hover:bg-destructive/20 transition duration-150"
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
        <div className="h-[2.5px] w-full bg-gradient-to-r from-blue-500 via-teal-500 via-amber-500 to-pink-500" />
        <div className="relative mx-auto flex h-16 w-full max-w-[1440px] items-center px-4 sm:px-6 lg:px-8">
        
        {/* Left Side (Logo and Brand) */}
        {/* min-w-0 (not min-w-max): the status badges below are shrink-0, so a
            max-content floor here would push the whole header past a phone
            viewport and make the page scroll sideways. */}
        <div className="flex min-w-0 flex-1 items-center justify-start overflow-hidden z-10 md:flex-initial md:shrink-0 xl:flex-1">
          <Button
            variant="unstyled"
            type="button"
            aria-label="Go to Today"
            onClick={() => onTabChange('dashboard')}
            className="brand-home-button flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl cursor-pointer select-none active:scale-95"
          >
            <AppLogo className="size-9 rounded-xl transition-transform duration-200 hover:scale-105" />
            {(isOffline || isSyncing || syncLabel) && (
              <span
                role="status"
                aria-label={isOffline ? 'Offline' : syncStatusLabel}
                title={isOffline ? 'No network connection — showing saved data; changes will sync when you are back online' : syncStatusLabel}
                className={`absolute left-7 top-1 z-10 flex size-3.5 items-center justify-center rounded-full border-2 border-background ${isOffline ? 'bg-amber-500' : 'animate-pulse bg-blue-500'}`}
              />
            )}
            <span className="brand-home-label hidden sm:inline md:hidden lg:inline text-base lg:text-lg font-extrabold tracking-tight bg-linear-to-r from-foreground via-foreground to-blue-500 bg-clip-text text-transparent truncate">
              FinancialApp
            </span>
          </Button>

          {isPhone && (isOffline || syncLabel) && (
            <span
              role="status"
              className={`ml-2 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${isOffline ? 'border-amber-500/20 bg-amber-500/10 text-amber-500' : 'border-blue-500/20 bg-blue-500/10 text-blue-500'}`}
            >
              {isOffline ? 'Offline' : syncStatusLabel}
            </span>
          )}

          {/* Field-shaped, button-behaved — the shape is what says "type here to find a record";
              a bare magnifier says nothing, which is why it read as one more command icon among
              five. It sits in this lane rather than the right one for two reasons: from xl the
              tab rail leaves the flow (xl:absolute) so the room is here, and the right lane is
              the app's tightest space, which is the crowding this moved away from. It stays a
              36px chip below xl, where the rail is still inline and there is no room to spend.
              No ⌘ glyph: that is the macOS Command key, absent from the Windows, Android and PWA
              targets this ships to. Phones reach search from the FAB menu, so it starts at md. */}
          {onOpenSearch && (
            <Button
              variant="unstyled"
              type="button"
              onClick={onOpenSearch}
              aria-label="Search your records"
              title="Search (Ctrl+K)"
              className="ml-2 hidden size-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-muted-foreground transition duration-150 cursor-pointer active:scale-95 hover:border-primary/40 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus:outline-none md:flex 2xl:ml-3 2xl:w-52 2xl:justify-start 2xl:px-3"
            >
              <SearchIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden truncate text-xs font-medium 2xl:inline">Search records…</span>
              <span
                aria-hidden
                className="ml-auto hidden shrink-0 rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold 2xl:inline"
              >
                Ctrl K
              </span>
            </Button>
          )}
          {/* On phones, keep the actionable draft count anchored beside the logo. Transient
              refresh/offline text may then clip at the edge of the left lane instead of
              shifting the draft into the fixed actions on the right. */}
          {isPhone && draftStatus}
          {isPhone && failedOpsStatus}
        </div>

        {/* Navigation Tabs - flow beside the actions on medium/tablet screens, centered mathematically on wide desktop */}
        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex xl:absolute xl:left-1/2 xl:top-1/2 xl:z-20 xl:w-max xl:-translate-x-1/2 xl:-translate-y-1/2 xl:flex-none">
          <nav className="flex min-w-0 max-w-full items-center gap-0.5 rounded-xl border border-border/50 bg-card/72 p-1 shadow-sm select-none lg:gap-1 lg:p-1.5">
            {navItems.map(({ tab, label, Icon, activeClass, iconClass, dotClass }) => {
              const isActive = activeTab === tab
              return (
                <Button variant="unstyled"
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex min-w-0 items-center gap-1 px-1.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 cursor-pointer lg:gap-1.5 lg:px-3 ${
                    isActive
                      ? `${activeClass} font-bold shadow-sm scale-[1.02]`
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/45'
                  }`}
                >
                  <Icon className={`size-3.5 ${isActive ? iconClass : 'text-muted-foreground'}`} />
                  <span>{label}</span>
                  {isActive && <span className={`absolute -bottom-1 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full ${dotClass}`} />}
                </Button>
              )
            })}
          </nav>
        </div>

        {/* Right Side Widgets & Actions */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 z-10 sm:gap-2.5 ml-auto md:ml-0 xl:flex-1 xl:gap-3">
          {!isPhone && (
            <>
              {failedOpsStatus}
              {draftStatus}
            </>
          )}
          
          
          <Button variant="unstyled"
            type="button"
            onClick={onAskAI}
            className="hidden md:flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/8 text-blue-600 hover:border-blue-500/35 hover:bg-blue-500/14 dark:text-blue-400 select-none transition-all duration-150 cursor-pointer active:scale-95 xl:h-9 xl:w-auto xl:gap-1.5 xl:px-3"
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
                ? 'border-primary/40 bg-primary/20 text-accent-ink shadow-sm'
                : 'border-primary/20 bg-primary/10 text-accent-ink hover:border-primary/30 hover:bg-primary/15'
            }`}
          >
            <CommitmentIcon className="size-4" aria-hidden />
          </Button>

          {/* One notification entry point; the shared review sheet is owned by App. */}
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

          {/* Quick Actions menu. A single isolated menu, so it uses DropdownMenu like the account
              menu rather than a Menubar root: a Menubar exists to give a *row* of sibling menus one
              roving focus group, and standing one menu inside it bought nothing while costing the
              menubar and roving-focus primitives on the eager critical path. */}
          <div className="hidden md:block border border-border/60 rounded-xl bg-background shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 px-2 py-1 sm:px-2.5 text-xs font-semibold hover:bg-muted/50 rounded-lg cursor-pointer flex items-center gap-1 whitespace-nowrap">
                <Plus className="size-3.5 text-blue-500" />
                <span className="hidden xl:inline">Quick Add</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-50 min-w-[160px] bg-card border border-border p-1 rounded-xl shadow-md">
                <DropdownMenuItem
                  onSelect={() => onQuickAction?.('transaction')}
                  className="flex min-h-11 items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
                >
                  Post Transaction <Plus className="size-3 text-blue-500" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onQuickAction?.('subscription')}
                  className="flex min-h-11 items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
                >
                  New Subscription <Plus className="size-3 text-violet-500" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onQuickAction?.('wishlist')}
                  className="flex min-h-11 items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
                >
                  Add Reward <Plus className="size-3 text-pink-500" aria-hidden />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Profile/Account menu */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                title="Account menu"
                className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-background p-0 cursor-pointer hover:bg-muted/50 active:scale-95 sm:size-9 transition duration-150"
              >
                <div className="flex size-7 items-center justify-center rounded-full border border-blue-500/20 bg-linear-to-tr from-blue-500 to-sky-400 text-[11px] font-extrabold text-on-vivid">
                  {getInitials(username)}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50 min-w-[180px] bg-card border border-border p-1 rounded-xl shadow-md">
                {/* Signed-in identity only. This carried a "Premium Account" line, which no part
                    of the app can substantiate -- there are no tiers, plans or entitlements here,
                    so it was decoration that read as a factual claim about the account. */}
                <div className="px-2.5 py-2">
                  <p className="text-xs font-bold text-foreground">{username || 'User'}</p>
                </div>

                <DropdownMenuSeparator className="my-1 border-t border-border/30" />

                <DropdownMenuItem
                  onSelect={() => onTabChange('investments')}
                  className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
                >
                  <TrendingUp className="size-3.5 text-violet-500" />
                  <span>Investments</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => onTabChange('settings')}
                  className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
                >
                  <Settings className="size-3.5 text-blue-500" />
                  <span>Settings</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={sensitivePreferenceStatus === 'resolved' ? onToggleHideSensitive : undefined}
                  disabled={sensitivePreferenceStatus !== 'resolved'}
                  className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground disabled:cursor-not-allowed sm:min-h-0"
                >
                  {sensitivePreferenceStatus === 'pending'
                    ? <Loader2 className="size-3.5 animate-spin text-blue-500" />
                    : hideSensitive
                      ? <Eye className="size-3.5 text-blue-500" />
                      : <EyeOff className="size-3.5 text-blue-500" />}
                  <span>
                    {sensitivePreferenceStatus === 'pending'
                      ? 'Checking Privacy Settings'
                      : sensitivePreferenceStatus === 'unavailable'
                        ? 'Privacy Setting Unavailable'
                        : hideSensitive ? 'Show Sensitive' : 'Hide Sensitive'}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={onToggleDarkMode}
                  className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
                >
                  {darkMode ? <Sun className="size-3.5 text-blue-500" /> : <Moon className="size-3.5 text-blue-500" />}
                  <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-t border-border/30" />
                  
                <DropdownMenuItem
                  onSelect={onLogout}
                  className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-orange-500 hover:bg-orange-500/10 outline-hidden cursor-pointer sm:min-h-0"
                >
                  <LogOut className="size-3.5" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
        </div>
        </div>
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
                    <div className="text-[13px] leading-relaxed text-muted-foreground mt-0.5">Checking privacy settings before anything is revealed.</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-0.5 shrink-0 text-amber-500">
                    <ShieldAlert className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-bold text-foreground">Amounts remain protected</div>
                    <div className="text-[13px] leading-relaxed text-muted-foreground mt-0.5">Privacy settings couldn't be verified.</div>
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

    {/* Mobile Navigation bar (Sticky Bottom Nav) */}
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/88 backdrop-blur-xl select-none shadow-[var(--app-shadow-nav-up)] transform-gpu"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', paddingTop: '10px', willChange: 'transform' }}
    >
      <nav aria-label="Primary" className="grid grid-cols-5 w-full max-w-md md:max-w-none px-2 md:px-8 mx-auto justify-items-center">
        {navItems.map(({ tab, mobileLabel, Icon, activeClass, iconClass, dotClass }) => {
          const isActive = activeTab === tab
          return (
            <Button variant="unstyled"
              key={tab}
              onClick={() => { triggerHaptic(8); onTabChange(tab) }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
                isActive ? 'scale-105 font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`relative flex size-8 items-center justify-center rounded-xl border transition-all duration-200 ${
                isActive ? `${activeClass} shadow-sm` : 'border-transparent bg-transparent'
              }`}>
                <Icon className={`size-4.5 mx-auto ${isActive ? iconClass : 'text-muted-foreground'}`} />
                {isActive && <span className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${dotClass}`} />}
              </span>
              <span className="truncate max-w-full px-0.5">{mobileLabel}</span>
            </Button>
          )
        })}
      </nav>
    </div>
    </>
  )
}

export default TopNav
